/**
 * matcher.js — S2.9 ETL SolarMarket
 *
 * Responsabilidade: encontrar um Equipamento existente no banco que corresponda
 * ao item normalizado do SolarMarket.
 *
 * Estratégia de matching (por ordem de precisão):
 *  1. hash_unico exato (sha256 de fabricante_norm + modelo_norm) — confiança: 1.0
 *  2. fabricante_normalizado + modelo_normalizado exatos         — confiança: 0.95
 *  3. fabricante_normalizado + modelo_normalizado fuzzy          — confiança: 0.70–0.90
 *  4. Sem match → retorna { encontrado: false }
 *
 * O matcher NÃO salva nada — apenas consulta o banco.
 * Decisões de atualização ficam com o deduplicator.
 */

import { Equipamento } from '../../models/Equipamento.js'

// ─── Estratégia 1: hash exato ─────────────────────────────────────────────

/**
 * Busca por hash_unico exato (match mais confiável).
 *
 * @param {string} hashUnico
 * @returns {Promise<object|null>}  Documento Equipamento ou null
 */
async function buscarPorHash(hashUnico) {
  return Equipamento.findOne({ 'identificacao.hash_unico': hashUnico }).lean()
}

// ─── Estratégia 2: fabricante + modelo normalizados exatos ────────────────

/**
 * Busca por correspondência exata nos campos normalizados.
 *
 * @param {string} fabricanteNorm
 * @param {string} modeloNorm
 * @returns {Promise<object|null>}
 */
async function buscarPorNormalizados(fabricanteNorm, modeloNorm) {
  return Equipamento.findOne({
    'identificacao.fabricante_normalizado': fabricanteNorm,
    'identificacao.modelo_normalizado':     modeloNorm,
  }).lean()
}

// ─── Estratégia 3: fuzzy por fabricante + modelo brutos ───────────────────

/**
 * Busca por fabricante e modelo usando regex case-insensitive.
 * Retorna o primeiro match mais provável.
 *
 * @param {string} fabricante  Fabricante bruto (não normalizado)
 * @param {string} modelo      Modelo bruto
 * @returns {Promise<{doc: object, confianca: number}|null>}
 */
async function buscarFuzzy(fabricante, modelo) {
  if (!fabricante || !modelo) return null

  // Cria regex de tokens: cada palavra do modelo deve aparecer no doc
  const tokens = modelo
    .replace(/[^A-Za-z0-9]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(t => t.length > 1)

  if (tokens.length === 0) return null

  // Busca documentos com mesmo fabricante primeiro
  const fabricanteRegex = new RegExp(
    fabricante.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    'i'
  )

  const candidatos = await Equipamento.find({
    fabricante: fabricanteRegex,
  })
    .limit(20)
    .lean()

  if (candidatos.length === 0) return null

  // Pontua cada candidato por quantos tokens do modelo aparecem
  let melhor = null
  let melhorPontos = 0

  for (const doc of candidatos) {
    const modeloDoc = (doc.modelo || '').toUpperCase()
    const modeloBusca = modelo.toUpperCase()

    // Correspondência exata no modelo
    if (modeloDoc === modeloBusca) {
      return { doc, confianca: 0.92 }
    }

    // Pontua por tokens
    const tokensEncontrados = tokens.filter(t =>
      modeloDoc.includes(t.toUpperCase())
    )
    const pontos = tokensEncontrados.length / tokens.length

    if (pontos > melhorPontos && pontos >= 0.7) {
      melhorPontos = pontos
      melhor = doc
    }
  }

  if (!melhor) return null

  // Confiança baseada em % de tokens encontrados
  const confianca = 0.70 + (melhorPontos - 0.7) * (0.20 / 0.30)
  return { doc: melhor, confianca: Math.min(confianca, 0.89) }
}

// ─── Função principal de matching ─────────────────────────────────────────

/**
 * Busca no banco o Equipamento que melhor corresponde ao item normalizado.
 *
 * @param {object} normalizado  Resultado de normalizer.normalizar()
 * @returns {Promise<MatchResult>}
 *
 * @typedef {object} MatchResult
 * @property {boolean} encontrado
 * @property {object|null} equipamento   Documento encontrado (lean)
 * @property {number} confianca          0.0 = sem match, 1.0 = hash exato
 * @property {string} estrategia         'hash' | 'normalizado' | 'fuzzy' | 'nenhuma'
 */
export async function encontrarMatch(normalizado) {
  const { equipamento, meta } = normalizado
  const { hash_unico }        = meta
  const { fabricante_normalizado, modelo_normalizado } = equipamento.identificacao

  // ── Estratégia 1: hash exato ─────────────────────────────────────────────
  if (hash_unico) {
    const doc = await buscarPorHash(hash_unico)
    if (doc) {
      return {
        encontrado: true,
        equipamento: doc,
        confianca: 1.0,
        estrategia: 'hash',
      }
    }
  }

  // ── Estratégia 2: normalizados exatos ────────────────────────────────────
  if (fabricante_normalizado && modelo_normalizado) {
    const doc = await buscarPorNormalizados(fabricante_normalizado, modelo_normalizado)
    if (doc) {
      return {
        encontrado: true,
        equipamento: doc,
        confianca: 0.95,
        estrategia: 'normalizado',
      }
    }
  }

  // ── Estratégia 3: fuzzy ──────────────────────────────────────────────────
  const fuzzyResult = await buscarFuzzy(equipamento.fabricante, equipamento.modelo)
  if (fuzzyResult) {
    return {
      encontrado: true,
      equipamento: fuzzyResult.doc,
      confianca: fuzzyResult.confianca,
      estrategia: 'fuzzy',
    }
  }

  // ── Sem match ─────────────────────────────────────────────────────────────
  return {
    encontrado: false,
    equipamento: null,
    confianca: 0.0,
    estrategia: 'nenhuma',
  }
}

/**
 * Versão em lote — executa encontrarMatch para cada item e retorna array.
 * Cada item deve ser um resultado de normalizer.normalizar().
 *
 * @param {Array} normalizados
 * @returns {Promise<Array<{normalizado, match}>>}
 */
export async function encontrarMatchesEmLote(normalizados) {
  const resultados = []

  for (const normalizado of normalizados) {
    try {
      const match = await encontrarMatch(normalizado)
      resultados.push({ normalizado, match })
    } catch (err) {
      console.warn(
        `[SM:matcher] Erro ao buscar match para ${normalizado.meta?.hash_unico}:`,
        err.message
      )
      resultados.push({
        normalizado,
        match: { encontrado: false, equipamento: null, confianca: 0, estrategia: 'erro', erro: err.message },
      })
    }
  }

  return resultados
}
