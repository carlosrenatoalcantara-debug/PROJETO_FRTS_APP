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

export const DEFAULT_VIEWPORT = Object.freeze({ x: 0, y: 0, zoom: 1 })

/** BUG-014: detecta sobreposição entre componentes (caixas COMPONENTE.W×H). */
function haSobreposicao(layout = {}) {
  const ids = Object.keys(layout)
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = layout[ids[i]]; const b = layout[ids[j]]
      if (a && b && a.x < b.x + COMPONENTE.W && b.x < a.x + COMPONENTE.W &&
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
 * @param {object} [input.overrides]
 * @returns {{version, metadata, components, connections, layout, viewport, overrides}}
 */
export function build({ components = [], connections = [], metadata = {}, viewport = null, overrides = {} } = {}) {
  // Poda overrides órfãos (componentes que não existem mais no projeto elétrico).
  const { overrides: overridesLimpos } = podarOverridesOrfaos(overrides, components)

  // Layout base é SEMPRE recalculado pelo Engine; overrides apenas sobrepõem.
  const layoutBase = computeLayout(components, connections)
  const comOverrides = aplicarOverrides(layoutBase, overridesLimpos)
  // BUG-014: geometria congelada — overrides manuais são aplicados apenas se mantiverem
  // o layout SEM sobreposição; caso contrário, volta à distribuição determinística
  // (sempre contida no DIAGRAM_BOX e sem overlap). SVG, PDF e Editor usam este layout.
  const layout = haSobreposicao(comOverrides) ? layoutBase : comOverrides

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
