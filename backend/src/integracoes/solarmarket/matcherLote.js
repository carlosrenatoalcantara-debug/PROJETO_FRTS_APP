/**
 * matcherLote.js — P0-SOLARMARKET-CACHE-BATCH-01
 *
 * Matching EM LOTE: carrega o catálogo do Atlas UMA vez (1 query) e resolve o match
 * EM MEMÓRIA, substituindo as ~340–1000 chamadas `findOne` do `matcher.encontrarMatch`
 * (1–3 por item) por **1 query + lookups O(1)**.
 *
 * Replica fielmente as 3 estratégias e as confianças do `matcher.js`:
 *   1. hash_unico exato        → 1.00 ('hash')
 *   2. normalizados exatos     → 0.95 ('normalizado')
 *   3. fuzzy por fabricante    → 0.70–0.92 ('fuzzy')
 *
 * 100% leitura: NÃO grava no Atlas.
 */
import { Equipamento } from '../../models/Equipamento.js'

/** Carrega o catálogo (1 query) e monta índices em memória. */
export async function carregarIndice() {
  const docs = await Equipamento.find({}, {
    fabricante: 1, modelo: 1, tipo: 1,
    'identificacao.fabricante_normalizado': 1,
    'identificacao.modelo_normalizado': 1,
    'identificacao.hash_unico': 1,
  }).lean()
  const porHash = new Map(), porNorm = new Map()
  for (const d of docs) {
    const id = d.identificacao || {}
    if (id.hash_unico) porHash.set(id.hash_unico, d)
    if (id.fabricante_normalizado && id.modelo_normalizado) {
      porNorm.set(`${id.fabricante_normalizado}|${id.modelo_normalizado}`, d)
    }
  }
  return { porHash, porNorm, todos: docs, queries: 1 }
}

// Estratégia 3 (fuzzy) em memória — mesma lógica/pontuação do matcher.js.
function _fuzzy(fabricante, modelo, todos) {
  if (!fabricante || !modelo) return null
  const tokens = modelo.replace(/[^A-Za-z0-9]/g, ' ').trim().split(/\s+/).filter(t => t.length > 1)
  if (!tokens.length) return null
  const fabRe = new RegExp(fabricante.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  const candidatos = todos.filter(d => fabRe.test(d.fabricante || '')).slice(0, 20)
  if (!candidatos.length) return null
  const modeloBusca = modelo.toUpperCase()
  let melhor = null, melhorPontos = 0
  for (const doc of candidatos) {
    const modeloDoc = (doc.modelo || '').toUpperCase()
    if (modeloDoc === modeloBusca) return { doc, confianca: 0.92 }
    const enc = tokens.filter(t => modeloDoc.includes(t.toUpperCase()))
    const pontos = enc.length / tokens.length
    if (pontos > melhorPontos && pontos >= 0.7) { melhorPontos = pontos; melhor = doc }
  }
  if (!melhor) return null
  const confianca = 0.70 + (melhorPontos - 0.7) * (0.20 / 0.30)
  return { doc: melhor, confianca: Math.min(confianca, 0.89) }
}

/**
 * Resolve o match de um item normalizado contra o índice em memória.
 * Retorna o MESMO shape de `matcher.encontrarMatch`.
 */
export function matchEmMemoria(normalizado, indice) {
  const { equipamento, meta } = normalizado
  const hash = meta?.hash_unico
  const fn = equipamento?.identificacao?.fabricante_normalizado
  const mn = equipamento?.identificacao?.modelo_normalizado
  if (hash && indice.porHash.has(hash)) {
    return { encontrado: true, equipamento: indice.porHash.get(hash), confianca: 1.0, estrategia: 'hash' }
  }
  if (fn && mn) {
    const d = indice.porNorm.get(`${fn}|${mn}`)
    if (d) return { encontrado: true, equipamento: d, confianca: 0.95, estrategia: 'normalizado' }
  }
  const fz = _fuzzy(equipamento?.fabricante, equipamento?.modelo, indice.todos)
  if (fz) return { encontrado: true, equipamento: fz.doc, confianca: fz.confianca, estrategia: 'fuzzy' }
  return { encontrado: false, equipamento: null, confianca: 0.0, estrategia: 'nenhuma' }
}

/** Matching em lote para uma lista de normalizados — 1 query total. */
export async function encontrarMatchesEmLoteBatch(normalizados) {
  const indice = await carregarIndice()
  const resultados = normalizados.map(n => ({ normalizado: n, match: matchEmMemoria(n, indice) }))
  return { resultados, queries: indice.queries, catalogo: indice.todos.length }
}
