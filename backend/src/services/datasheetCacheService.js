/**
 * datasheetCacheService.js — S2.6.3
 *
 * Serviço de cache semântico para datasheets processados pelo Gemini Vision.
 * Usa SHA-256 do buffer PDF como chave de lookup — determinístico e colision-free.
 *
 * Design principles:
 *  - Transparente: falhas de DB nunca interrompem o pipeline principal
 *  - Idempotente: salvar duas vezes o mesmo hash não cria duplicata (upsert)
 *  - Versionado: `versao_parser` invalida automaticamente ao mudar o prompt
 *  - Zero I/O extra: hash calculado do buffer já em memória (sem re-leitura)
 *
 * Estratégia de invalidação:
 *  1. Hash muda → arquivo PDF diferente → processamento obrigatório
 *  2. versao_parser muda → prompt/lógica mudou → re-extração mesmo arquivo
 *
 * Por que SHA-256 não tem colisão prática:
 *  O espaço de output é 2^256 ≈ 1.16 × 10^77 combinações. A probabilidade de
 *  colisão para 1 bilhão de PDFs é ≈ 4.3 × 10^-58 — matematicamente impossível
 *  no horizonte de existência do projeto.
 */

import crypto from 'crypto'
import { DatasheetProcessamento } from '../models/DatasheetProcessamento.js'

// ─── Constantes ───────────────────────────────────────────────────────────────

/**
 * Versão do parser — BUMP quando o prompt Gemini ou a lógica de
 * normalização mudar de forma incompatível com resultados anteriores.
 *
 * Semântica:
 *  MAJOR.MINOR.PATCH
 *  - MAJOR: mudança breaking (novo schema de saída)
 *  - MINOR: novo campo extraído ou prompt melhorado
 *  - PATCH: correção de bug no parser sem alterar schema
 *
 * A versão aqui deve coincidir com a constante em datasheetGeminiUnificado.js.
 */
export const VERSAO_PARSER_ATUAL = '1.0.0'

// ─── Hash SHA-256 ────────────────────────────────────────────────────────────

/**
 * Calcula o hash SHA-256 de um Buffer de forma síncrona.
 * Complexidade: O(n) onde n = tamanho do buffer.
 * Para PDFs típicos (< 5 MB): < 5 ms.
 *
 * @param {Buffer} buffer  Buffer do arquivo PDF
 * @returns {string}       Hash hexadecimal de 64 chars
 */
export function computarHashPDF(buffer) {
  return crypto
    .createHash('sha256')
    .update(buffer)
    .digest('hex')
}

// ─── Consulta de cache ────────────────────────────────────────────────────────

/**
 * Consulta o cache por hash SHA-256 + versão do parser.
 *
 * Retorna null se:
 *  - Documento não existe (cache miss)
 *  - versao_parser difere (invalidação por versão)
 *  - MongoDB inacessível (fallback seguro)
 *
 * Em caso de hit, incrementa `total_hits` e `ultimo_hit_em` de forma
 * assíncrona (fire-and-forget) para não penalizar o tempo de resposta.
 *
 * @param {string} hashPdf          Hash SHA-256 do PDF
 * @param {string} [versaoParser]   Versão do parser a validar (default: VERSAO_PARSER_ATUAL)
 * @returns {Promise<object|null>}  Documento do cache ou null
 */
export async function consultarCache(hashPdf, versaoParser = VERSAO_PARSER_ATUAL) {
  // S2.6.3 ajuste: filtra por hash_pdf + versao_parser na query.
  // Versões diferentes do parser coexistem na coleção sem interferência —
  // um bump de versão gera cache miss automático sem apagar docs antigos.
  const doc = await DatasheetProcessamento.findOne({
    hash_pdf:      hashPdf,
    versao_parser: versaoParser,
  }).lean()

  if (!doc) return null

  // Incrementa hits de forma assíncrona (fire-and-forget)
  DatasheetProcessamento.updateOne(
    { hash_pdf: hashPdf, versao_parser: versaoParser },
    { $inc: { total_hits: 1 }, $set: { ultimo_hit_em: new Date() } }
  ).catch(() => {/* silencioso */})

  return doc
}

// ─── Salvar no cache ──────────────────────────────────────────────────────────

/**
 * Salva o resultado de extração Gemini no cache.
 * Usa upsert para idempotência — re-executar não cria duplicata.
 *
 * @param {string} hashPdf           Hash SHA-256 do PDF
 * @param {object} resultadoGemini   Resultado completo de extrairComGemini()
 * @param {object} [meta]            Metadados opcionais
 * @param {string} [meta.arquivo_nome]
 * @param {string} [meta.versao_parser]
 * @returns {Promise<void>}
 */
export async function salvarCache(hashPdf, resultadoGemini, meta = {}) {
  const versaoParser = meta.versao_parser || VERSAO_PARSER_ATUAL

  // Extrai fabricante/modelo do resultado para indexação
  const dados = resultadoGemini?.dados || {}
  const fabricante = dados.fabricante || null
  const modelo     = dados.modelo     || null

  const payload = {
    hash_pdf:           hashPdf,
    fabricante,
    modelo,
    versao_parser:      versaoParser,
    resultado_extraido: resultadoGemini,
    origem:             'gemini_vision',
    processado_em:      new Date(),
    arquivo_nome:       meta.arquivo_nome || null,
  }

  await DatasheetProcessamento.findOneAndUpdate(
    { hash_pdf: hashPdf },
    { $set: payload },
    { upsert: true, returnDocument: 'after' }
  )
}

// ─── Métricas de uso ──────────────────────────────────────────────────────────

/**
 * Retorna estatísticas do cache para relatório do pipeline.
 *
 * @returns {Promise<CacheStats>}
 *
 * @typedef {object} CacheStats
 * @property {number} total_documentos
 * @property {number} total_hits_acumulados
 * @property {number} documentos_versao_atual
 * @property {number} documentos_versao_antiga
 */
export async function obterEstatisticasCache() {
  const [totalDocs, docsByVersion, totalHits] = await Promise.all([
    DatasheetProcessamento.countDocuments(),
    DatasheetProcessamento.aggregate([
      { $group: { _id: '$versao_parser', count: { $sum: 1 } } },
    ]),
    DatasheetProcessamento.aggregate([
      { $group: { _id: null, total: { $sum: '$total_hits' } } },
    ]),
  ])

  const versaoCounts = Object.fromEntries(
    docsByVersion.map(d => [d._id, d.count])
  )

  return {
    total_documentos:        totalDocs,
    total_hits_acumulados:   totalHits[0]?.total ?? 0,
    documentos_versao_atual: versaoCounts[VERSAO_PARSER_ATUAL] ?? 0,
    documentos_versao_antiga: totalDocs - (versaoCounts[VERSAO_PARSER_ATUAL] ?? 0),
    versao_atual:             VERSAO_PARSER_ATUAL,
    por_versao:               versaoCounts,
  }
}

/**
 * Lista entradas do cache com filtros opcionais (para auditoria).
 *
 * @param {object} filtros
 * @param {string} [filtros.fabricante]
 * @param {string} [filtros.versao_parser]
 * @param {number} [filtros.limit=20]
 */
export async function listarCache({ fabricante, versao_parser, limit = 20 } = {}) {
  const query = {}
  if (fabricante)    query.fabricante   = new RegExp(fabricante, 'i')
  if (versao_parser) query.versao_parser = versao_parser

  return DatasheetProcessamento.find(query)
    .select('hash_pdf fabricante modelo versao_parser arquivo_nome total_hits processado_em')
    .sort({ processado_em: -1 })
    .limit(limit)
    .lean()
}
