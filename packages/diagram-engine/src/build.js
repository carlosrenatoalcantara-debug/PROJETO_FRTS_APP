/**
 * build.js — DiagramEngine.build()
 *
 * Projeto (já mapeado para componentes elétricos genéricos por um adapter de domínio)
 *   → JSON CANÔNICO determinístico.
 *
 * Esta é a FONTE ÚNICA consumida por: React Flow (edição), SVG e PDF (impressão).
 */

import { VERSION } from './model.js'
import { computeLayout } from './layout.js'
import { aplicarOverrides, podarOverridesOrfaos } from './overrides.js'
import { COMPONENTE } from './geometry.js'
import { larguraComponente } from './symbols.js'

export const DEFAULT_VIEWPORT = Object.freeze({ x: 0, y: 0, zoom: 1 })

/**
 * BUG-014: detecta sobreposição entre componentes.
 *
 * BUG-018: a checagem usa a LARGURA REAL de cada símbolo (larguraComponente:
 * Disjuntor/IDR=54, DPS=42, Medidor=80, Carregador=90) — NÃO a largura nominal
 * da caixa do editor (COMPONENTE.W=120). Antes, a caixa nominal de 120px era
 * larga demais: dois componentes estreitos (ex.: IDR 54 + DPS 42) espaçados
 * 60px — que NÃO se tocam visualmente — eram falsamente detectados como
 * sobrepostos, fazendo o build DESCARTAR TODOS os overrides (inclusive as
 * posições fixas do template) e cair no layout genérico do computeLayout. Isso
 * quebrava silenciosamente o unifilar de qualquer projeto salvo pelo editor
 * (Aterramento à esquerda, DPS numa fileira abaixo). A altura continua nominal
 * (H): todas as fileiras dos templates ficam a >=108px umas das outras, então
 * a altura nunca gera falso-positivo — só a largura precisava ser real.
 */
function haSobreposicao(layout = {}, byId = new Map()) {
  const larg = (id) => larguraComponente(byId.get(id)) || COMPONENTE.W
  const ids = Object.keys(layout)
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = layout[ids[i]]; const b = layout[ids[j]]
      const wa = larg(ids[i]); const wb = larg(ids[j])
      if (a && b && a.x < b.x + wb && b.x < a.x + wa &&
          a.y < b.y + COMPONENTE.H && b.y < a.y + COMPONENTE.H) return true
    }
  }
  return false
}

/**
 * @param {object} input
 * @param {Array}  input.components
 * @param {Array}  input.connections
 * @param {object} [input.metadata]
 * @param {object} [input.viewport]
 * @param {object} [input.overrides]  posições manuais (deltas do usuário) por id
 * @param {object} [input.baseLayout] BUG-018: layout-base FIXO por id (ex.: posições do
 *   template EV). Quando presente, é a base sobre a qual os overrides são aplicados E o
 *   destino do fallback anti-sobreposição — em vez do layout genérico do computeLayout.
 *   O computeLayout continua sendo o backstop para ids ausentes no baseLayout.
 * @returns {{version, metadata, components, connections, layout, viewport, overrides}}
 */
export function build({ components = [], connections = [], metadata = {}, viewport = null, overrides = {}, baseLayout = null } = {}) {
  // Poda overrides órfãos (componentes que não existem mais no projeto elétrico).
  const { overrides: overridesLimpos } = podarOverridesOrfaos(overrides, components)

  // Layout base: quando um baseLayout (template) é fornecido, ele tem prioridade e o
  // layout genérico só preenche ids que faltarem nele. Sem baseLayout, comportamento
  // legado: base = computeLayout. BUG-018: assim, um override ruim degrada para o
  // TEMPLATE LIMPO (baseLayout) — nunca para o layout genérico (que espalha Aterramento
  // à esquerda e DPS numa fileira abaixo).
  const layoutAuto = computeLayout(components, connections)
  const layoutBase = baseLayout ? { ...layoutAuto, ...baseLayout } : layoutAuto
  const comOverrides = aplicarOverrides(layoutBase, overridesLimpos)
  // BUG-014: geometria congelada — overrides manuais são aplicados apenas se mantiverem
  // o layout SEM sobreposição; caso contrário, volta à base (template ou determinística).
  // BUG-018: a checagem usa a largura REAL de cada símbolo (byId → larguraComponente).
  const byId = new Map(components.map(c => [c.id, c]))
  const layout = haSobreposicao(comOverrides, byId) ? layoutBase : comOverrides

  return {
    version: VERSION,
    metadata: {
      atualizadoEm: metadata.atualizadoEm || new Date().toISOString(),
      ...metadata,
    },
    components,
    connections,
    layout,
    viewport: viewport || { ...DEFAULT_VIEWPORT },
    overrides: overridesLimpos,
  }
}
