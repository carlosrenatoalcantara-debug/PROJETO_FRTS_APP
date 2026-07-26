/**
 * obterTopologiaState.js — S4B-FV-READERS-TOPOLOGY-ADAPTER
 *
 * PONTO ÚNICO de leitura da topologia no FRONTEND (espelha o papel de
 * `dominio/topologia/obterTopologiaProjeto.js` no backend). Todos os readers de
 * topologia devem consumir DAQUI, nunca de `agregarArranjosFV` diretamente.
 *
 * Esconde o formato legado: hoje delega 100% ao agregador de Arranjo
 * (`agregarTotaisArranjos`/`resumoTecnicoArranjo`) — saída BYTE-IDÊNTICA. Quando o
 * estado passar a carregar Instalação (S4C), a decisão de origem acontece AQUI,
 * sem tocar nos readers.
 *
 * PURO. Não altera estado, não persiste, não muda algoritmo elétrico.
 */

import { agregarTotaisArranjos, resumoTecnicoArranjo, validarAlocacao } from './agregarArranjosFV'

/**
 * Totais físicos da topologia a partir do estado do wizard.
 * @returns {{ modulos, inversores, kwp, porArranjo, fonte }}
 */
export function obterTopologiaState(state) {
  // S4C: se `state.instalacao` existir → nova topologia. Hoje: 100% Arranjo.
  return agregarTotaisArranjos(state)
}

/** Resumo técnico de UM bloco de geração (arranjo) — leitura derivada. */
export function resumoTopologiaArranjo(arranjo, catalogo = {}) {
  return resumoTecnicoArranjo(arranjo, catalogo)
}

export { validarAlocacao }
export default { obterTopologiaState, resumoTopologiaArranjo, validarAlocacao }
