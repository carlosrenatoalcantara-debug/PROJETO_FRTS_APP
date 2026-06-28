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

export const DEFAULT_VIEWPORT = Object.freeze({ x: 0, y: 0, zoom: 1 })

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
  const layout = aplicarOverrides(layoutBase, overridesLimpos)

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
