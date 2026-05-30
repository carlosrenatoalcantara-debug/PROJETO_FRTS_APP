/**
 * pipelineAuditor.js — Sprint 8.6.1
 *
 * PURO. Auditoria estágio-a-estágio do pipeline de datasheet:
 *   OCR/PDF-parse → Gemini → JSON parse → Validação mínima → Persistência
 *
 * Classifica a falha exata: OCR_FALHOU | GEMINI_FALHOU | PARSER_FALHOU |
 * VALIDACAO_FALHOU | MONGO_FALHOU | API_FALHOU | UI_FALHOU | OK.
 *
 * Não faz I/O. Recebe os artefatos de cada etapa e devolve um relatório.
 */
import { extrairFabricanteModelo, ehDefaultLixo } from './fabricanteModeloFallback.js'

export const FALHAS = {
  OK:               'OK',
  OCR_FALHOU:       'OCR_FALHOU',
  GEMINI_FALHOU:    'GEMINI_FALHOU',
  PARSER_FALHOU:    'PARSER_FALHOU',
  VALIDACAO_FALHOU: 'VALIDACAO_FALHOU',
  MONGO_FALHOU:     'MONGO_FALHOU',
  API_FALHOU:       'API_FALHOU',
  UI_FALHOU:        'UI_FALHOU',
  IMPORTACAO_FALHOU:'IMPORTACAO_FALHOU',
}

function _truncar(s, n = 240) {
  const t = String(s ?? '')
  return t.length > n ? `${t.slice(0, n)}…(+${t.length - n})` : t
}

/**
 * Roda a auditoria sobre o resultado de cada etapa.
 *
 * @param {object} stages
 * @param {{ ok: boolean, texto?: string, erro?: string, bytes?: number }} stages.ocr
 * @param {{ ok: boolean, raw?: string, json?: object, erro?: string, modelo?: string }} stages.gemini
 *      raw: resposta textual antes do JSON.parse
 *      json: objeto após parse (se sucesso)
 * @param {{ fabricante: ?string, modelo: ?string }} [stages.normalizado]
 *      o objeto FINAL pronto para persistir
 * @param {{ ok: boolean, _id?: string, erro?: string }} [stages.mongo]
 * @returns {{ etapa: string, falha: string, etapas: object[], resumo: string,
 *             evidencia: object, sugestao: string, fallback_aplicado?: object }}
 */
export function auditarPipeline(stages = {}) {
  const etapas = []

  // ── 1. OCR / pdf-parse ───────────────────────────────────────────────────
  const ocr = stages.ocr || {}
  const ocrTextoLen = (ocr.texto || '').trim().length
  etapas.push({
    etapa: 'OCR', sucesso: !!ocr.ok && ocrTextoLen > 0,
    texto_bytes: ocrTextoLen,
    amostra: _truncar(ocr.texto, 200),
    erro: ocr.erro || null,
  })
  if (!ocr.ok || ocrTextoLen < 20) {
    return {
      etapa: 'OCR', falha: FALHAS.OCR_FALHOU, etapas,
      resumo: `OCR/pdf-parse não extraiu texto suficiente (${ocrTextoLen} chars).`,
      evidencia: { texto_extraido_bytes: ocrTextoLen, erro: ocr.erro },
      sugestao: 'PDF pode ser imagem sem OCR. Reprocessar com tesseract ou upload de imagem direta.',
    }
  }

  // ── 2. Gemini / Claude ───────────────────────────────────────────────────
  const gemini = stages.gemini || {}
  etapas.push({
    etapa: 'GEMINI', sucesso: !!gemini.ok,
    resposta_bytes: gemini.raw ? gemini.raw.length : 0,
    modelo: gemini.modelo || null,
    erro: gemini.erro || null,
  })
  if (!gemini.ok) {
    // Tenta fallback regex AGORA, com o texto OCR
    const fb = extrairFabricanteModelo(ocr.texto)
    return {
      etapa: 'GEMINI', falha: FALHAS.GEMINI_FALHOU, etapas,
      resumo: `Gemini falhou: ${gemini.erro || 'sem detalhe'}.`,
      evidencia: { gemini_raw_bytes: gemini.raw?.length || 0, gemini_erro: gemini.erro },
      sugestao: fb.fabricante || fb.modelo
        ? `Fallback regex extraiu: fabricante=${fb.fabricante || '?'} modelo=${fb.modelo || '?'}. Aceitar e marcar IMPORTACAO_FALHOU se ambos vazios.`
        : 'Nem regex encontrou pistas. Marcar IMPORTACAO_FALHOU e exigir entrada manual.',
      fallback_aplicado: fb,
    }
  }

  // ── 3. Parse JSON ────────────────────────────────────────────────────────
  if (!gemini.json || typeof gemini.json !== 'object') {
    etapas.push({ etapa: 'PARSER', sucesso: false, erro: 'JSON inválido / vazio' })
    return {
      etapa: 'PARSER', falha: FALHAS.PARSER_FALHOU, etapas,
      resumo: 'Gemini respondeu mas a resposta não é JSON válido.',
      evidencia: { amostra_resposta: _truncar(gemini.raw, 240) },
      sugestao: 'Ajustar prompt para forçar JSON puro sem markdown.',
    }
  }
  etapas.push({
    etapa: 'PARSER', sucesso: true,
    campos_extraidos: Object.keys(gemini.json).length,
    fabricante: gemini.json.fabricante || null,
    modelo: gemini.json.modelo || null,
    tipo: gemini.json.tipo || gemini.json.tipoDocumento || null,
  })

  // ── 4. Validação mínima (fabricante OU modelo presente E não-lixo) ──────
  const norm = stages.normalizado || gemini.json
  const fabOk = !ehDefaultLixo(norm.fabricante, 'fabricante')
  const modOk = !ehDefaultLixo(norm.modelo, 'modelo')

  if (!fabOk && !modOk) {
    // Tenta fallback regex
    const fb = extrairFabricanteModelo(ocr.texto)
    etapas.push({
      etapa: 'VALIDACAO', sucesso: false,
      fabricante_recebido: norm.fabricante, modelo_recebido: norm.modelo,
      fallback_fabricante: fb.fabricante, fallback_modelo: fb.modelo, fallback_confianca: fb.confianca,
    })
    return {
      etapa: 'VALIDACAO', falha: FALHAS.VALIDACAO_FALHOU, etapas,
      resumo: 'Nem fabricante nem modelo foram extraídos sem cair em defaults lixo.',
      evidencia: { fabricante: norm.fabricante, modelo: norm.modelo },
      sugestao: fb.fabricante || fb.modelo
        ? `Use fallback regex: fabricante=${fb.fabricante || '?'} modelo=${fb.modelo || '?'} (conf ${fb.confianca}).`
        : 'Marcar IMPORTACAO_FALHOU. Exigir entrada manual antes de salvar.',
      fallback_aplicado: fb,
    }
  }
  etapas.push({
    etapa: 'VALIDACAO', sucesso: true,
    fabricante: norm.fabricante, modelo: norm.modelo,
    aviso: (!fabOk || !modOk) ? 'Parcial — só um dos dois foi extraído.' : null,
  })

  // ── 5. Mongo (opcional — só se foi tentada persistência) ────────────────
  if (stages.mongo !== undefined) {
    if (!stages.mongo?.ok) {
      etapas.push({ etapa: 'MONGO', sucesso: false, erro: stages.mongo?.erro })
      return {
        etapa: 'MONGO', falha: FALHAS.MONGO_FALHOU, etapas,
        resumo: `Persistência falhou: ${stages.mongo?.erro || 'erro desconhecido'}.`,
        evidencia: { erro: stages.mongo?.erro },
        sugestao: 'Verificar conexão Mongo, índices únicos, schema validation.',
      }
    }
    etapas.push({ etapa: 'MONGO', sucesso: true, _id: stages.mongo?._id })
  }

  return {
    etapa: 'OK', falha: FALHAS.OK, etapas,
    resumo: `Pipeline completou com sucesso: ${norm.fabricante} ${norm.modelo}`,
    evidencia: { fabricante: norm.fabricante, modelo: norm.modelo },
    sugestao: null,
  }
}

/**
 * Versão simplificada para auditoria offline a partir SÓ do texto OCR.
 * Usada pelo endpoint /api/admin/catalogo/auditar-pipeline.
 */
export function auditarTextoOCR(texto, geminiResposta = null) {
  return auditarPipeline({
    ocr: { ok: true, texto },
    gemini: geminiResposta
      ? { ok: true, raw: JSON.stringify(geminiResposta), json: geminiResposta, modelo: geminiResposta.modelo }
      : { ok: false, erro: 'Gemini não chamado nesta auditoria' },
    normalizado: geminiResposta,
  })
}
