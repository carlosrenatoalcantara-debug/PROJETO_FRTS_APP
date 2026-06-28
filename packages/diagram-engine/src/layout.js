/**
 * layout.js — Layout DETERMINÍSTICO.
 *
 * O Engine (não o React Flow) decide posicionamento, alinhamento e distribuição.
 * Entrada: components + connections (topologia elétrica, sem geometria).
 * Saída: mapa { [componentId]: { x, y } } em pixels.
 *
 * Regras:
 *  - Fluxo principal (conexões 'serie') distribuído horizontalmente, esquerda→direita.
 *  - A coluna de cada componente vem da ordem topológica da cadeia série.
 *  - Componentes em derivação ('derivacao') vão para a faixa inferior, na coluna do
 *    componente de origem.
 *  - Empates na mesma célula são resolvidos por `ordem` e depois `id` (determinístico).
 */

import { PAPEL_CONEXAO } from './model.js'

export const LAYOUT_CONST = Object.freeze({
  MARGEM_X: 80,
  RAIL_Y: 200,
  DX: 190,        // distância entre colunas
  DY: 150,        // deslocamento da faixa inferior
  STACK_DY: 90,   // empilhamento na mesma célula
})

/** Ordena ids de forma determinística por (ordem, id). */
function ordenarDeterministico(ids, byId) {
  return [...ids].sort((a, b) => {
    const oa = byId.get(a)?.ordem ?? 0
    const ob = byId.get(b)?.ordem ?? 0
    if (oa !== ob) return oa - ob
    return String(a).localeCompare(String(b))
  })
}

/**
 * Calcula colunas via ordem topológica da cadeia 'serie'.
 * @returns {Map<string, number>} id → coluna
 */
function calcularColunas(components, connections) {
  const byId = new Map(components.map(c => [c.id, c]))
  const serie = connections.filter(c => c.papel === PAPEL_CONEXAO.SERIE)

  const incoming = new Map(components.map(c => [c.id, 0]))
  const adj = new Map(components.map(c => [c.id, []]))
  for (const e of serie) {
    if (!byId.has(e.from) || !byId.has(e.to)) continue
    adj.get(e.from).push(e.to)
    incoming.set(e.to, (incoming.get(e.to) || 0) + 1)
  }

  // Fontes = sem aresta série de entrada; ordem determinística.
  let fronteira = ordenarDeterministico(
    components.filter(c => (incoming.get(c.id) || 0) === 0).map(c => c.id),
    byId,
  )

  const coluna = new Map()
  const grauRestante = new Map(incoming)
  let col = 0
  const visitados = new Set()
  while (fronteira.length) {
    for (const id of fronteira) if (!coluna.has(id)) coluna.set(id, col)
    const proxima = []
    for (const id of fronteira) {
      visitados.add(id)
      for (const viz of adj.get(id) || []) {
        grauRestante.set(viz, (grauRestante.get(viz) || 0) - 1)
        if ((grauRestante.get(viz) || 0) <= 0 && !visitados.has(viz)) proxima.push(viz)
      }
    }
    fronteira = ordenarDeterministico([...new Set(proxima)], byId)
    col++
  }

  // Derivações: coluna = coluna do componente de origem da derivação.
  for (const e of connections) {
    if (e.papel !== PAPEL_CONEXAO.DERIVACAO) continue
    if (coluna.has(e.to)) continue
    if (coluna.has(e.from)) coluna.set(e.to, coluna.get(e.from))
  }
  // Qualquer componente solto recebe coluna 0 (determinístico, nunca undefined).
  for (const c of components) if (!coluna.has(c.id)) coluna.set(c.id, 0)
  return coluna
}

/** Determina a faixa de cada componente: explícita > derivação(inferior) > principal. */
function calcularFaixas(components, connections) {
  const faixa = new Map()
  const alvosDerivacao = new Set(
    connections.filter(c => c.papel === PAPEL_CONEXAO.DERIVACAO).map(c => c.to),
  )
  for (const c of components) {
    if (c.faixa === 'principal' || c.faixa === 'inferior') faixa.set(c.id, c.faixa)
    else faixa.set(c.id, alvosDerivacao.has(c.id) ? 'inferior' : 'principal')
  }
  return faixa
}

/**
 * computeLayout — posições determinísticas em pixels.
 * @returns {Object<string,{x:number,y:number}>}
 */
export function computeLayout(components = [], connections = []) {
  const byId = new Map(components.map(c => [c.id, c]))
  const coluna = calcularColunas(components, connections)
  const faixa = calcularFaixas(components, connections)
  const { MARGEM_X, RAIL_Y, DX, DY, STACK_DY } = LAYOUT_CONST

  // Agrupa por célula (coluna|faixa) para empilhar deterministicamente.
  const celulas = new Map()
  for (const c of components) {
    const chave = `${coluna.get(c.id)}|${faixa.get(c.id)}`
    if (!celulas.has(chave)) celulas.set(chave, [])
    celulas.get(chave).push(c.id)
  }

  const layout = {}
  for (const [chave, ids] of celulas) {
    const [colStr, fx] = chave.split('|')
    const col = Number(colStr)
    const ordenados = ordenarDeterministico(ids, byId)
    const baseY = fx === 'inferior' ? RAIL_Y + DY : RAIL_Y
    ordenados.forEach((id, i) => {
      layout[id] = { x: MARGEM_X + col * DX, y: baseY + i * STACK_DY }
    })
  }
  return layout
}
