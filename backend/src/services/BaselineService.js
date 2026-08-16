/**
 * BaselineService.js — FV-DOM-001
 *
 * Leitura da Baseline e aplicação do GATE de bifurcação.
 *
 * NÃO expõe criação: a Baseline nasce exclusivamente da aprovação de um
 * orçamento (`OrcamentoService.aprovar`). Ter um `criar` aqui abriria caminho
 * para uma baseline sem orçamento aprovado — exatamente o que o gate existe
 * para impedir.
 *
 * NÃO expõe atualização nem exclusão: M-2 (imutabilidade). O model bloqueia por
 * hook e o repositório não tem os métodos — três barreiras independentes.
 */

import { BaselineRepository } from '../repositories/BaselineRepository.js'
import { avaliarGate, exigirBaseline, verificarIntegridade, FASES_BIFURCACAO, MOTIVOS_GATE, ErroGate } from '../dominio/gate/index.js'

export const BaselineService = {
  /**
   * Baseline do projeto (≤ 1 por INV-BAS-3).
   * @param {object} filtro  já com o escopo de organização aplicado (M-4)
   */
  async doProjeto(filtro) {
    return BaselineRepository.acharPorProjeto(filtro)
  },

  /**
   * Avalia o gate para uma fase. Não lança — devolve a decisão.
   * @returns {{ liberado: boolean, motivo?: string, mensagem?: string, baseline?: object|null }}
   */
  async avaliarGate(fase, filtroProjeto) {
    const baseline = await BaselineRepository.acharPorProjeto(filtroProjeto)
    return { ...avaliarGate({ fase, baseline }), baseline: baseline || null }
  },

  /**
   * Exige Baseline válida para a fase. Lança `ErroGate` quando bloqueada.
   *
   * É este o método que Engenharia e Homologação devem chamar quando forem
   * implementadas — a regra não vive na interface.
   */
  async exigirGate(fase, filtroProjeto) {
    const baseline = await BaselineRepository.acharPorProjeto(filtroProjeto)
    exigirBaseline({ fase, baseline })
    return baseline
  },

  /** Confere a integridade do snapshot congelado. */
  verificarIntegridade,
}

export { FASES_BIFURCACAO, MOTIVOS_GATE, ErroGate }
export default BaselineService
