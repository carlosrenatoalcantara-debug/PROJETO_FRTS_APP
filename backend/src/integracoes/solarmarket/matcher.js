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
import { normalizarAgressive } from './normalizer.js'

// ─── Tabela de aliases de fabricante ─────────────────────────────────────────
// Mapeamento SM → Atlas para casos onde o nome do fabricante difere.
// Ordenado por comprimento DESC para que prefixos mais longos sejam verificados primeiro.
//
// Duas formas de uso:
//   { sm: 'HONOR SOLAR',  atlas: 'HONOR' }   — "HONOR SOLAR" como prefixo ou exato
//   { sm: 'OSDA',         atlas: 'OSDA SOLAR' } — SM tem nome MAIS CURTO que Atlas
//
// Comprovado empiricamente em P0-CATALOG-COVERAGE-GAP-02 + P0-CATALOG-MATCHER-FIX-01.
const FABRICANTE_ALIASES = [
  { sm: 'SIRIUS BIFACIAL',    atlas: 'SIRIUS ENERGIAS RENOVAVEIS' },
  { sm: 'CANADIAN SOLAR',     atlas: 'CANADIAN' },
  { sm: 'TONGWEI SOLAR',      atlas: 'TONGWEI' },
  { sm: 'LEAPTON SOLAR',      atlas: 'LEAPTON' },
  { sm: 'HONOR SOLAR',        atlas: 'HONOR' },
  { sm: 'TRINA SOLAR',        atlas: 'TRINA' },
  { sm: 'RESUN SOLAR',        atlas: 'RESUN' },
  { sm: 'OSDA',               atlas: 'OSDA SOLAR' },
].sort((a, b) => b.sm.length - a.sm.length)

// ─── Resolução de candidatos (combinações marca+modelo a testar) ──────────────

/**
 * Gera lista de pares {marca, modelo} candidatos a partir da marca/modelo brutos,
 * aplicando aliases de fabricante e rebalanceamento de prefixo.
 *
 * @param {string} marcaBruta
 * @param {string} modeloBruto
 * @returns {Array<{marca: string, modelo: string}>}
 */
function resolverCandidatos(marcaBruta, modeloBruto) {
  const candidates = [{ marca: marcaBruta, modelo: modeloBruto }]
  const marcaUpper = marcaBruta.trim().toUpperCase()

  for (const alias of FABRICANTE_ALIASES) {
    const aliasUpper = alias.sm.toUpperCase()
    if (marcaUpper === aliasUpper) {
      // Correspondência exata: substitui o fabricante
      candidates.push({ marca: alias.atlas, modelo: modeloBruto })
    } else if (marcaUpper.startsWith(aliasUpper + ' ')) {
      // Correspondência de prefixo: sufixo da marca passa para o modelo
      const suffix = marcaBruta.trim().slice(alias.sm.length).trim()
      const modeloComSuffix = suffix ? `${suffix} ${modeloBruto}` : modeloBruto
      candidates.push({ marca: alias.atlas, modelo: modeloComSuffix })
    }
  }

  return candidates
}

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

// ─── Índice flexível ──────────────────────────────────────────────────────────

/**
 * Carrega todos os equipamentos do Atlas e constrói um índice de busca flexível.
 *
 * A chave do índice é normalizarAgressive(fabricante + ' ' + modelo): remove todos
 * os caracteres não-alfanuméricos (barras, asteriscos, hífens, espaços) antes de
 * indexar. Isso torna o índice tolerante às inconsistências de normalização entre
 * o runtime e o que foi armazenado no Atlas na época do import.
 *
 * Chamar uma vez no startup do script; reutilizar o Map retornado para todo o lote.
 *
 * @returns {Promise<Map<string, object>>}  hash_flexivel → doc Equipamento (lean)
 */
export async function carregarIndiceFlexivel() {
  const docs = await Equipamento.find({})
    .select('_id tipo fabricante modelo especificacoes identificacao')
    .lean()

  const indice = new Map()
  for (const doc of docs) {
    const hash = normalizarAgressive((doc.fabricante || '') + ' ' + (doc.modelo || ''))
    if (hash && !indice.has(hash)) {
      indice.set(hash, doc)
    }
  }
  return indice
}

/**
 * Busca no índice flexível usando normalização agressiva + resolução de aliases.
 *
 * Estratégia 2.5 — tolerância a:
 *   A1  backfill split: "GROWATT MIN" + "5000TL-X" → combina igual a Atlas "GROWATT" + "MIN 5000TL-X"
 *   A2  alias de marca: "HONOR SOLAR" → "HONOR", "OSDA" → "OSDA SOLAR", etc.
 *   A3  chars especiais: "JAM72S30-550/MR" e "JAM72S30-550 MR" → mesmo hash flexível
 *
 * @param {string} marcaBruta    Valor bruto de `marca` no ProjetoFV
 * @param {string} modeloBruto   Valor bruto de `modelo` no ProjetoFV
 * @param {Map}    indice         Retornado por carregarIndiceFlexivel()
 * @returns {{equipamento: object, confianca: number, estrategia: string}|null}
 */
export function encontrarMatchFlexivel(marcaBruta, modeloBruto, indice) {
  if (!indice || !marcaBruta || !modeloBruto) return null

  const candidatos = resolverCandidatos(marcaBruta, modeloBruto)

  for (const { marca, modelo } of candidatos) {
    const hash = normalizarAgressive(marca + ' ' + modelo)
    const doc = indice.get(hash)
    if (doc) {
      return {
        equipamento: doc,
        confianca:   0.95,
        estrategia:  'flexivel',
      }
    }
  }

  return null
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
