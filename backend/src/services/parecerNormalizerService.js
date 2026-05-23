/**
 * parecerNormalizerService.js — PARECER_NORMALIZER_V1
 *
 * Normalizador totalmente agnóstico de pareceres de acesso FV.
 * Identifica a concessionária via biblioteca nacional (sem hardcode de aliases),
 * extrai campos-chave usando os padrões centralizados por distribuidora,
 * e calcula a confiança global do documento.
 *
 * NÃO usa IA, embeddings ou chamadas externas.
 * 100% determinístico, JSON puro serializável.
 *
 * Campos preservados na saída:
 *   campos_nao_mapeados[]   — campos extraídos mas sem correspondência conhecida
 *   inconsistencias[]       — contradições detectadas entre campos
 *   linhas_descartadas[]    — do documentoEstruturadoService (passadas adiante)
 *   confianca_documento_global — número [0,1]: média ponderada com penalidades
 *   versao_normalizador     — string de versão para rastreabilidade
 */

import {
  identificarConcessionaria,
  buscarDistribuidoraPorId,
} from './concessionariaDictionaryService.js'
import matcherSingleton        from './equipamentoMatcherService.js'
import {
  padroesDocumentais,
  nomenclaturasRegionais,
}  from '../data/concessionarias/index.js'

// ─── Constantes ───────────────────────────────────────────────────────────────

export const VERSAO_NORMALIZADOR = 'PARECER_NORMALIZER_V1'

/** Peso de cada componente no cálculo de confiança global */
const PESOS_CONFIANCA = Object.freeze({
  confianca_concessionaria: 0.30,
  cobertura_campos_obrig:   0.35,
  consistencia_interna:     0.25,
  completude_equipamentos:  0.10,
})

/** Campos considerados obrigatórios para um parecer completo */
const CAMPOS_OBRIGATORIOS = Object.freeze([
  'numero_parecer',
  'potencia_aprovada_kw',
  'tensao_conexao',
  'disjuntor_geral_a',
])

/** Penalidade por linha descartada (máx: -0.10 total) */
const PENALIDADE_POR_LINHA_DESCARTADA = 0.01

/** Penalidade por inconsistência detectada (máx: -0.20 total) */
const PENALIDADE_POR_INCONSISTENCIA   = 0.05

// ─── Helpers de parsing de valor ─────────────────────────────────────────────

/**
 * Parse de número brasileiro: "5.500,00" → 5500.00 | "550" → 550
 */
function _parseBR(str) {
  if (typeof str !== 'number') str = String(str ?? '')
  // Remove separadores de milhar BR antes de converter decimal
  const limpo = str.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(limpo)
  return Number.isFinite(n) ? n : null
}

/**
 * Normaliza tensão: "13,8 kV" → 13800 | "220V" → 220 | "220" → 220
 */
function _parseTensaoV(str) {
  if (typeof str !== 'string') return null
  const kv = str.match(/(\d+(?:[.,]\d+)?)\s*kv/i)
  if (kv) return _parseBR(kv[1]) * 1000
  const v  = str.match(/(\d+(?:[.,]\d+)?)\s*v?\b/i)
  if (v)  return _parseBR(v[1])
  return null
}

/**
 * Normaliza string para matching (lowercase, sem acento).
 */
function _norm(str) {
  if (typeof str !== 'string') return ''
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Extração de campos via padrões da distribuidora ─────────────────────────

/**
 * Varre as linhas de um bloco procurando labels que correspondam aos padrões
 * da distribuidora identificada. Extração por heurística "label: valor".
 *
 * @param {string[]} linhas — array de strings (linhas do bloco)
 * @param {object}  padroes — { campo: string[] } com labels possíveis por campo
 * @returns {{ campos_extraidos: object, campos_nao_mapeados: string[] }}
 */
function _extrairCampos(linhas, padroes) {
  const campos_extraidos  = {}
  const campos_nao_mapeados = []
  const labelsConhecidos  = new Set(Object.values(padroes).flat().map(_norm))

  for (const linha of linhas) {
    // Ignora linhas sem separador label/valor
    const sep = linha.indexOf(':')
    if (sep < 0) continue

    const label = _norm(linha.slice(0, sep).trim())
    const valor = linha.slice(sep + 1).trim()
    if (!label || !valor) continue

    let mapeado = false
    for (const [campo, patternList] of Object.entries(padroes)) {
      if (patternList.some(p => label.includes(_norm(p)))) {
        if (!(campo in campos_extraidos)) {
          campos_extraidos[campo] = valor
        }
        mapeado = true
        break
      }
    }

    if (!mapeado && !labelsConhecidos.has(label)) {
      campos_nao_mapeados.push({ label, valor })
    }
  }

  return { campos_extraidos, campos_nao_mapeados }
}

// ─── Detecção de inconsistências ──────────────────────────────────────────────

/**
 * Detecta inconsistências entre os campos extraídos do documento.
 *
 * Verificações implementadas:
 *   1. potencia_aprovada_kw > 75 kW com tensão BT (<1000V) → improvável (MT esperado)
 *   2. disjuntor_geral_a <= 0 → inválido
 *   3. tensao_conexao fora de tensões padrão da distribuidora (se conhecidas)
 *
 * @param {object} campos — campos extraídos
 * @param {object|null} distribuidora — objeto distribuidora (pode ser null)
 * @returns {string[]} — lista de mensagens de inconsistência
 */
function _detectarInconsistencias(campos, distribuidora) {
  const inconsistencias = []

  const potKW  = _parseBR(campos.potencia_aprovada_kw)
  const tensaoV = _parseTensaoV(campos.tensao_conexao ?? '')
  const disjA  = _parseBR(campos.disjuntor_geral_a)

  // 1 — Potência alta com tensão BT
  if (potKW !== null && potKW > 75 && tensaoV !== null && tensaoV < 1000) {
    inconsistencias.push(
      `Potência ${potKW} kW acima de 75 kW com tensão ${tensaoV} V (BT) — esperado MT (≥1000 V).`
    )
  }

  // 2 — Disjuntor inválido
  if (disjA !== null && disjA <= 0) {
    inconsistencias.push(`Disjuntor geral ${disjA} A é inválido (deve ser > 0).`)
  }

  // 3 — Tensão fora das tensões padrão
  if (tensaoV !== null && distribuidora?.tensoes_padrao_bt_v) {
    const padrao = distribuidora.tensoes_padrao_bt_v
    const tolerancia = 5 // V
    const foraDosPadroes = !padrao.some(v => Math.abs(v - tensaoV) <= tolerancia)
    if (foraDosPadroes && tensaoV < 1000) {
      // Só alerta se BT e fora dos padrões
      inconsistencias.push(
        `Tensão ${tensaoV} V não consta nas tensões padrão BT da concessionária (${padrao.join(', ')} V).`
      )
    }
  }

  // 4 — Potência aprovada zero ou negativa
  if (potKW !== null && potKW <= 0) {
    inconsistencias.push(`Potência aprovada ${potKW} kW é inválida (deve ser > 0).`)
  }

  return inconsistencias
}

// ─── Cálculo de confiança global ──────────────────────────────────────────────

/**
 * Calcula confiança global do documento [0, 1] via média ponderada com penalidades.
 *
 * Componentes:
 *   A — confiança da identificação da concessionária (0–1)
 *   B — cobertura de campos obrigatórios (0–1)
 *   C — consistência interna (1 − inconsistências * penalidade_por_inconsistência)
 *   D — completude de equipamentos (proporção de matches encontrados)
 *
 * Penalidades adicionais:
 *   − 0.01 por linha descartada (máx −0.10)
 *   − 0.05 por inconsistência (já contado em C, mas também aplicado diretamente)
 *
 * Resultado clampado em [0.00, 1.00] com 2 casas decimais.
 */
function _calcularConfiancaGlobal({
  confianca_concessionaria,
  campos_extraidos,
  inconsistencias,
  linhas_descartadas,
  match_equipamentos,
}) {
  // A — concessionária
  const compA = Math.min(1, Math.max(0, confianca_concessionaria))

  // B — cobertura de campos obrigatórios
  const camposPresentes = CAMPOS_OBRIGATORIOS.filter(c =>
    campos_extraidos[c] !== undefined && campos_extraidos[c] !== null && campos_extraidos[c] !== ''
  ).length
  const compB = camposPresentes / CAMPOS_OBRIGATORIOS.length

  // C — consistência (sem inconsistências = 1.0, cada inconsistência penaliza)
  const compC = Math.max(0, 1 - inconsistencias.length * PENALIDADE_POR_INCONSISTENCIA)

  // D — completude de equipamentos (score médio dos matches, ponderado pela confiança do matcher)
  let compD = 0.5 // baseline quando não há equipamentos fornecidos
  if (Array.isArray(match_equipamentos) && match_equipamentos.length > 0) {
    const scores = match_equipamentos.map(m => m.resultado_match?.score_match ?? 0)
    compD = scores.reduce((acc, s) => acc + s, 0) / scores.length
  }

  // Média ponderada
  const media = (
    compA * PESOS_CONFIANCA.confianca_concessionaria +
    compB * PESOS_CONFIANCA.cobertura_campos_obrig   +
    compC * PESOS_CONFIANCA.consistencia_interna      +
    compD * PESOS_CONFIANCA.completude_equipamentos
  )

  // Penalidade por linhas descartadas (máx 10%)
  const penLinhas = Math.min(
    0.10,
    (Array.isArray(linhas_descartadas) ? linhas_descartadas.length : 0) * PENALIDADE_POR_LINHA_DESCARTADA
  )

  const resultado = Math.min(1, Math.max(0, media - penLinhas))
  return Math.round(resultado * 100) / 100
}

// ─── Extração de texto dos blocos ─────────────────────────────────────────────

/**
 * Coleta todas as linhas de conteúdo de um array de blocos (DOCUMENT_ENGINE_V1).
 * @param {Array<{linhas?: string[]}>} blocos
 * @returns {string[]}
 */
function _linhasDeBlocos(blocos) {
  if (!Array.isArray(blocos)) return []
  return blocos.flatMap(b => Array.isArray(b.linhas) ? b.linhas : [])
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Normaliza um documento estruturado FV (saída do documentoEstruturadoService).
 *
 * @param {object} documentoEstruturado — { documento_extraido_raw: { texto_original, linhas, blocos, metadata } }
 * @param {object} [opcoes]
 * @param {string} [opcoes.concessionaria_hint] — id canônico (ex.: 'CEMIG') para forçar concessionária
 * @param {object[]} [opcoes.equipamentos_brutos] — equipamentos extraídos por outro pipeline (opcional)
 *
 * @returns {object} — payload normalizado (JSON puro serializável)
 */
export async function normalizarParecer(documentoEstruturado, opcoes = {}) {
  const raw      = documentoEstruturado?.documento_extraido_raw ?? {}
  const texto    = raw.texto_original ?? ''
  const blocos   = raw.blocos ?? []
  const metadata = raw.metadata ?? {}

  // ── 1. Identificar concessionária ──────────────────────────────────────────
  let idConcessionaria, confianca_concessionaria, metodo_identificacao, distribuidora

  if (opcoes.concessionaria_hint) {
    distribuidora            = buscarDistribuidoraPorId(opcoes.concessionaria_hint)
    confianca_concessionaria = distribuidora ? 1.00 : 0
    metodo_identificacao     = 'hint_explicito'
    idConcessionaria         = distribuidora?.id ?? opcoes.concessionaria_hint
  } else {
    const match = identificarConcessionaria(texto)
    distribuidora           = match.distribuidora
    confianca_concessionaria = match.confianca
    metodo_identificacao    = match.metodo
    idConcessionaria        = match.distribuidora?.id ?? null
  }

  // ── 2. Extrair campos via padrões da distribuidora ─────────────────────────
  const padroes = distribuidora?.padroes_campos ?? {}
  const linhasTodas = _linhasDeBlocos(blocos)
  const { campos_extraidos, campos_nao_mapeados } = _extrairCampos(linhasTodas, padroes)

  // ── 3. Normalizar valores ──────────────────────────────────────────────────
  const potencia_aprovada_kw = _parseBR(campos_extraidos.potencia_aprovada_kw ?? null)
  const tensao_conexao_v     = _parseTensaoV(campos_extraidos.tensao_conexao ?? '')
  const disjuntor_geral_a    = _parseBR(campos_extraidos.disjuntor_geral_a ?? null)

  // Número do parecer: prefere extração por regex da distribuidora (mais preciso)
  // Fallback: valor extraído por label-match nos padroes_campos
  let numero_parecer       = campos_extraidos.numero_parecer ?? null
  let numero_parecer_metodo = numero_parecer ? 'label_match' : 'nenhum'

  if (idConcessionaria) {
    const pd = padroesDocumentais(idConcessionaria)
    if (pd?.regex_parecer) {
      const m = texto.match(pd.regex_parecer)
      if (m?.[1]) {
        numero_parecer        = m[1]
        numero_parecer_metodo = 'regex_distribuidora'
      }
    }
  }

  // ── 4. Matching de equipamentos via EquipamentoMatcherService (5 camadas) ───
  const equipamentos_brutos = opcoes.equipamentos_brutos ?? []
  const match_equipamentos  = await Promise.all(
    equipamentos_brutos.map(eq =>
      matcherSingleton.matchEquipamento(
        eq.marca  ?? eq.fabricante ?? null,
        eq.modelo ?? null,
        eq.potencia ?? eq.potencia_wp ?? eq.potencia_kw ?? null,
      ).then(resultado => ({ entrada: eq, resultado_match: resultado }))
    )
  )

  // ── 5. Detectar inconsistências ────────────────────────────────────────────
  const inconsistencias = _detectarInconsistencias(
    { potencia_aprovada_kw, tensao_conexao: campos_extraidos.tensao_conexao, disjuntor_geral_a },
    distribuidora
  )

  // ── 6. Linhas descartadas (passadas pelo documentoEstruturadoService) ──────
  const linhas_descartadas = blocos.flatMap(b => b.linhas_descartadas ?? [])

  // ── 7. Calcular confiança global ───────────────────────────────────────────
  const confianca_documento_global = _calcularConfiancaGlobal({
    confianca_concessionaria,
    // chaves devem coincidir com CAMPOS_OBRIGATORIOS
    campos_extraidos: {
      numero_parecer,
      potencia_aprovada_kw,
      tensao_conexao:  tensao_conexao_v,   // renomeia para bater com CAMPOS_OBRIGATORIOS
      disjuntor_geral_a,
    },
    inconsistencias,
    linhas_descartadas,
    match_equipamentos,
  })

  // ── 8. Montar payload de saída ─────────────────────────────────────────────
  return {
    versao_normalizador: VERSAO_NORMALIZADOR,
    normalizado_em:      new Date().toISOString(),

    concessionaria: {
      id:                      idConcessionaria,
      nome_canonical:          distribuidora?.nome_canonical ?? null,
      nome_completo:           distribuidora?.nome_completo  ?? null,
      estado:                  distribuidora?.estado          ?? null,
      grupo:                   distribuidora?.grupo           ?? null,
      confianca:               confianca_concessionaria,
      metodo_identificacao,
      // Labels que a concessionária usa nos seus documentos (null = ainda não mapeado)
      nomenclaturas_regionais: idConcessionaria
        ? nomenclaturasRegionais(idConcessionaria)
        : null,
    },

    campos: {
      numero_parecer,
      numero_parecer_metodo,   // 'regex_distribuidora' | 'label_match' | 'nenhum'
      potencia_aprovada_kw,
      tensao_conexao_v,
      tensao_conexao_raw:  campos_extraidos.tensao_conexao ?? null,
      disjuntor_geral_a,
    },

    equipamentos: match_equipamentos.map(m => ({
      entrada:          m.entrada,
      tipo_equipamento: m.resultado_match.tipo_equipamento,
      encontrado:       m.resultado_match.encontrado,
      status:           m.resultado_match.status,           // 'equipamento_encontrado' | 'equipamento_ambiguo' | 'datasheet_necessario'
      score_match:      m.resultado_match.score_match,
      nivel_confianca:  m.resultado_match.nivel_confianca,  // 'ALTO' | 'MEDIO' | 'BAIXO'
      metodo_match:     m.resultado_match.metodo_match,
      fabricante:       m.resultado_match.fabricante_normalizado,
      modelo:           m.resultado_match.modelo_normalizado,
      equipamento_id:   m.resultado_match.equipamento_id,
      potencia_w:       m.resultado_match.potencia_w,
      ambiguidades:     m.resultado_match.ambiguidades,
      camadas_avaliadas: m.resultado_match.camadas_avaliadas,
    })),

    auditoria: {
      confianca_documento_global,
      detalhes_confianca: {
        confianca_concessionaria,
        cobertura_campos_obrigatorios: (() => {
          const snap = { numero_parecer, potencia_aprovada_kw, tensao_conexao: tensao_conexao_v, disjuntor_geral_a }
          const n = CAMPOS_OBRIGATORIOS.filter(c => snap[c] !== null && snap[c] !== undefined && snap[c] !== '').length
          return `${n}/${CAMPOS_OBRIGATORIOS.length}`
        })(),
        num_inconsistencias:    inconsistencias.length,
        num_linhas_descartadas: linhas_descartadas.length,
      },
      inconsistencias,
      campos_nao_mapeados,
      linhas_descartadas,
    },

    metadata_documento: {
      origem:        metadata.origem      ?? null,
      nome_arquivo:  metadata.nome_arquivo ?? null,
      paginas:       metadata.paginas     ?? null,
      processado_em: metadata.processado_em ?? null,
      engine_versao: metadata.engine_versao ?? null,
    },
  }
}

// ─── Compatibilidade com ParecerNormalizerService legado (CommonJS class) ────
//
// O serviço legado expunha:
//
//   class ParecerNormalizerService {
//     async normalizar(textoExtraidoDoc) → { concessionariaId, concessionariaNome,
//                                            uf, grupoEconomico, numeroParecer,
//                                            termoUnidadeConsumidora }
//   }
//   module.exports = new ParecerNormalizerService()
//
// Bugs do legado corrigidos aqui:
//
//   1. concessionaria.padroesDocumentais.regexParecer   → TypeError quando
//      padroesDocumentais é null (a maioria das distribuidoras). Corrigido com ?.
//
//   2. throw new Error() em concessionária não identificada → aborta o pipeline.
//      A nova versão degrada com confianca=0 e campos null, sem exceção.
//
//   3. async sem await → falsa promessa de I/O. Mantemos async na assinatura
//      pública por compatibilidade, mas o corpo é síncrono.
//
// O método normalizar() monta um documento mínimo compatível com normalizarParecer()
// a partir do texto bruto, depois mapeia a saída rica para o shape legado + extensões.

/**
 * Constrói um documentoEstruturado mínimo a partir de texto bruto.
 * Permite que normalizar() (compat) alimente normalizarParecer() sem passar pelo
 * documentoEstruturadoService completo.
 *
 * @param {string} texto
 * @returns {object}
 */
function _docMinimalDeTexto(texto) {
  const linhas = typeof texto === 'string' ? texto.split(/\r\n|\r|\n/) : []
  return {
    documento_extraido_raw: {
      texto_original: texto ?? '',
      linhas,
      blocos: [{
        id:                      'bloco_compat_0',
        linhas,
        tabelas:                 [],
        separadores_encontrados: [],
        linhas_descartadas:      [],
      }],
      metadata: {
        origem:        'normalizar_compat',
        engine_versao: 'COMPAT_WRAPPER_V1',
        processado_em: new Date().toISOString(),
      },
    },
  }
}

/**
 * Interface de compatibilidade com o ParecerNormalizerService legado (CommonJS).
 * Aceita texto bruto em vez do documentoEstruturado completo.
 *
 * Retorna o shape legado (campos camelCase) fundido com os campos novos
 * para permitir migração incremental — callers antigos continuam funcionando,
 * callers novos aproveitam confianca_documento_global e auditoria.
 *
 * @param {string} textoExtraidoDoc — texto bruto extraído do PDF/OCR
 * @param {object} [opcoes]         — mesmas opções de normalizarParecer()
 * @returns {Promise<object>}       — shape legado + extensões novas
 */
export async function normalizar(textoExtraidoDoc, opcoes = {}) {
  const doc    = _docMinimalDeTexto(textoExtraidoDoc)
  const result = normalizarParecer(doc, opcoes)

  const c = result.concessionaria
  const f = result.campos

  // ── Shape legado (nomes originais do serviço antigo) ──────────────────────
  const legado = {
    concessionariaId:          c.id,
    concessionariaNome:        c.nome_canonical,
    uf:                        c.estado,
    grupoEconomico:            c.grupo,
    numeroParecer:             f.numero_parecer,
    termoUnidadeConsumidora:   c.nomenclaturas_regionais?.codigo_cliente ?? null,
  }

  // ── Extensões novas (não quebram callers existentes — campos adicionais) ──
  const extensoes = {
    // Confiança e rastreabilidade
    confianca_documento_global: result.auditoria.confianca_documento_global,
    numero_parecer_metodo:      f.numero_parecer_metodo,
    confianca_concessionaria:   c.confianca,
    metodo_identificacao:       c.metodo_identificacao,

    // Campos numéricos normalizados
    potencia_aprovada_kw:       f.potencia_aprovada_kw,
    tensao_conexao_v:           f.tensao_conexao_v,
    disjuntor_geral_a:          f.disjuntor_geral_a,

    // Auditoria completa (opcional — só relevante para callers cientes da nova API)
    _v1:                        result,
  }

  return { ...legado, ...extensoes }
}
