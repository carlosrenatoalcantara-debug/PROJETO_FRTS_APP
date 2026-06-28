/**
 * @fortesolar/diagram-engine — API pública.
 *
 * Motor determinístico e NEUTRO de diagramas elétricos (EV/FV/BESS/...).
 * Fonte única de verdade para: React Flow (edição), SVG e PDF (impressão).
 *
 * O Engine conhece componentes elétricos genéricos (quadro, disjuntor, dr, dps,
 * barramento, cabo, eletroduto, equipamento, carga). NÃO conhece domínio (EV/FV).
 * O mapeamento Projeto→componentes é responsabilidade de um adapter de domínio.
 */

import { build } from './src/build.js'
import { computeLayout } from './src/layout.js'
import { aplicarOverrides, podarOverridesOrfaos } from './src/overrides.js'
import { toReactFlow, overridesDeReactFlow } from './src/toReactFlow.js'
import { renderSVG } from './src/svgRenderer.js'

export const DiagramEngine = {
  build,
  computeLayout,
  aplicarOverrides,
  podarOverridesOrfaos,
  toReactFlow,
  overridesDeReactFlow,
  renderSVG,
}

export { build, computeLayout, aplicarOverrides, podarOverridesOrfaos, toReactFlow, overridesDeReactFlow, renderSVG }
export { TIPOS, PAPEL_CONEXAO, CORES_CONDUTOR, componente, conexao, VERSION } from './src/model.js'
export default DiagramEngine
