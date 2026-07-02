/**
 * toReactFlow.js — Projeção do JSON canônico para o formato do React Flow.
 *
 * O React Flow é APENAS um renderizador/editor: recebe nodes/edges já posicionados
 * pelo Engine. Nunca decide layout. As edições manuais retornam como overrides
 * (ver overrides.js) e não como nova fonte de verdade.
 */

import { CORES_CONDUTOR, PAPEL_CONEXAO } from './model.js'

/** Mapa tipo genérico → tipo de nó do React Flow (realista). */
const TIPO_NODE = {
  rede: 'gridNodeRealista',
  quadro: 'customNodeRealista',
  disjuntor: 'breakerNodeRealista',
  dr: 'drNodeRealista',
  dps: 'dpsNodeRealista',
  barramento: 'customNodeRealista',
  cabo: 'cableNodeRealista',
  eletroduto: 'customNodeRealista',
  equipamento: 'chargerNodeRealista',
  carga: 'customNodeRealista',
}

/** canonical → { nodes, edges, viewport } */
export function toReactFlow(canonical) {
  const { components = [], connections = [], layout = {}, viewport } = canonical || {}

  const nodes = components.map(c => ({
    id: c.id,
    type: TIPO_NODE[c.tipo] || 'customNodeRealista',
    position: layout[c.id] || { x: 0, y: 0 },
    data: {
      tipo: c.tipo,
      subtipo: c.subtipo,
      label: c.label,
      polos: c.polos,
      ...c.specs,
      // P3-PARITY: componente original — o nó do Editor desenha o MESMO símbolo do SVG.
      componente: c,
    },
  }))

  const edges = connections.map(cx => {
    const primeiro = cx.condutores?.[0]
    const cor = primeiro ? (CORES_CONDUTOR[primeiro.papel] || '#555') : '#555'
    const derivacao = cx.papel === PAPEL_CONEXAO.DERIVACAO
    // Fluxo principal: saída direita ('out') → entrada esquerda ('in').
    // Derivação de terra: por baixo ('gnd') → topo do componente de proteção ('gtop').
    return {
      id: cx.id,
      source: cx.from,
      target: cx.to,
      sourceHandle: derivacao ? 'gnd' : 'out',
      targetHandle: derivacao ? 'gtop' : 'in',
      type: 'custom',
      // specs da ligação (bitola_mm2/comprimento_m/observacoes) ficam na edge — o cabo é a edge.
      data: { papel: cx.papel, condutores: cx.condutores, tracejado: derivacao, ...(cx.specs || {}) },
      style: { stroke: cor, strokeWidth: 2, strokeDasharray: derivacao ? '6 4' : undefined },
    }
  })

  return { nodes, edges, viewport: viewport || { x: 0, y: 0, zoom: 1 } }
}

/**
 * Extrai overrides a partir de nodes editados no React Flow, comparando as posições
 * com o layout base do Engine. Só persiste o que o usuário realmente moveu.
 */
export function overridesDeReactFlow(nodes = [], layoutBase = {}) {
  const overrides = {}
  for (const n of nodes) {
    const base = layoutBase[n.id]
    if (!base || !n.position) continue
    const dx = Math.round(n.position.x - base.x)
    const dy = Math.round(n.position.y - base.y)
    if (dx !== 0 || dy !== 0) overrides[n.id] = { position: { x: n.position.x, y: n.position.y } }
  }
  return overrides
}
