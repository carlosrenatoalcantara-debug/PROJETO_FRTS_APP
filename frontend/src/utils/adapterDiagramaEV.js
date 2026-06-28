/**
 * adapterDiagramaEV.js — RE-EXPORT do adapter EV compartilhado.
 *
 * P3-F4: o adapter foi movido para o pacote neutro (packages/diagram-engine/
 * adapters/ev.js) para ser a ÚNICA ponte EV→Engine usada por frontend (preview/
 * React Flow) E backend (PDF). Este arquivo mantém os imports existentes do
 * frontend funcionando sem duplicar lógica.
 */
export {
  avaliarNormas,
  adaptarProjetoEV,
  construirCanonicalEV,
  renderarSVGEV,
  argsDeProjetoEV,
  construirCanonicalDeProjetoEV,
  toReactFlow,
} from '../../../packages/diagram-engine/adapters/ev.js'
