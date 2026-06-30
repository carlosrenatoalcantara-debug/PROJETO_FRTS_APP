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
import { DIAGRAM_BOX, COMPONENTE } from './geometry.js'

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

/**
 * Determina a faixa de cada componente.
 * Um componente só vai para a faixa INFERIOR se for alvo APENAS de derivação e NÃO
 * participar da cadeia série (nem como alvo nem como fonte). Assim, DR/Carregador —
 * que também recebem o condutor de terra (derivação) — permanecem na faixa principal.
 */
function calcularFaixas(components, connections) {
  const faixa = new Map()
  const alvosDerivacao = new Set(connections.filter(c => c.papel === PAPEL_CONEXAO.DERIVACAO).map(c => c.to))
  const naSerie = new Set([
    ...connections.filter(c => c.papel === PAPEL_CONEXAO.SERIE).map(c => c.to),
    ...connections.filter(c => c.papel === PAPEL_CONEXAO.SERIE).map(c => c.from),
  ])
  for (const c of components) {
    if (c.faixa === 'principal' || c.faixa === 'inferior') { faixa.set(c.id, c.faixa); continue }
    faixa.set(c.id, (alvosDerivacao.has(c.id) && !naSerie.has(c.id)) ? 'inferior' : 'principal')
  }
  return faixa
}

/**
 * computeLayout — distribui os componentes AUTOMATICAMENTE dentro do DIAGRAM_BOX.
 *
 * Não há coordenadas fixas por equipamento: a cadeia principal é distribuída
 * uniformemente na largura da caixa; as derivações (ex.: DPS) ficam numa faixa
 * inferior centralizada. Tudo é clampado para NUNCA ultrapassar o DIAGRAM_BOX.
 * Funciona para qualquer projeto (1/2 carregadores, mono/tri, com/sem DPS).
 *
 * @returns {Object<string,{x:number,y:number}>}
 */
export function computeLayout(components = [], connections = []) {
  const box = DIAGRAM_BOX
  const { W, H } = COMPONENTE
  const coluna = calcularColunas(components, connections)
  const faixa = calcularFaixas(components, connections)

  const ordenar = (lista) => [...lista].sort((a, b) =>
    ((coluna.get(a.id) ?? 0) - (coluna.get(b.id) ?? 0)) || String(a.id).localeCompare(String(b.id)))
  const principal = ordenar(components.filter(c => faixa.get(c.id) !== 'inferior'))
  const inferior = ordenar(components.filter(c => faixa.get(c.id) === 'inferior'))

  const PAD = 8
  const yMain = box.y + 16
  const yInf = box.y + box.h - H - 16
  const minX = box.x + PAD
  const maxX = box.x + box.w - W - PAD

  const layout = {}
  // Distribui `lista` uniformemente numa `largura` a partir de `x0`, na altura `y`.
  const distribuir = (lista, largura, x0, y) => {
    const n = lista.length || 1
    lista.forEach((c, i) => {
      const cx = x0 + (i + 0.5) * (largura / n)
      const x = Math.max(minX, Math.min(Math.round(cx - W / 2), maxX))
      layout[c.id] = { x, y }
    })
  }

  // Cadeia principal: largura inteira da caixa (uniforme, centralizada por célula).
  distribuir(principal, box.w, box.x, yMain)

  // Derivações: grupo centralizado horizontalmente, na faixa inferior da caixa.
  if (inferior.length) {
    const larguraGrupo = Math.min(box.w, inferior.length * (W + 50))
    distribuir(inferior, larguraGrupo, box.x + (box.w - larguraGrupo) / 2, yInf)
  }
  return layout
}
