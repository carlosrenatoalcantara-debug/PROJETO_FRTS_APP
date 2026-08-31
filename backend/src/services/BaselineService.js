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
import { avaliarGate, exigirBaseline, verificarIntegridade, estadoDaOpcao, FASES_BIFURCACAO, MOTIVOS_GATE, ErroGate } from '../dominio/gate/index.js'
import { ProjetoFV } from '../models/ProjetoFV.js'

/**
 * FV-DOM-032 — estado da OPÇÃO, para o gate.
 *
 * Carrega o projeto e as irmãs do mesmo `proposta_grupo_id` e delega a decisão
 * a `estadoDaOpcao`, que é pura. Devolve `null` quando o projeto não participa
 * de proposta com opções — e aí o gate decide exatamente como decidia antes.
 *
 * O filtro recebido já vem com o escopo de organização aplicado (M-4); a busca
 * das irmãs herda `empresa_id` dele, sem ampliar alcance.
 */
async function _opcaoDoProjeto(filtroProjeto) {
  try {
    /**
     * ATENÇÃO ao formato: o filtro que este service recebe é o da BASELINE —
     * `{ projeto_ref, empresa_id }`, montado por `projetoNoEscopo`. O `ProjetoFV`
     * não tem campo `projeto_ref`; consultá-lo com esse filtro não casa com
     * documento algum e devolve `null` em silêncio, desligando a regra das
     * opções sem erro nenhum. O id do projeto é `filtro.projeto_ref`.
     */
    const idProjeto = filtroProjeto?.projeto_ref ?? filtroProjeto?._id
    if (!idProjeto) return null
    const escopoTenant = filtroProjeto?.empresa_id !== undefined
      ? { empresa_id: filtroProjeto.empresa_id } : {}
    const projeto = await ProjetoFV.findOne({ ...escopoTenant, _id: idProjeto })
      .select('proposta_grupo_id opcao_rotulo proposta_aceite').lean()
    if (!projeto?.proposta_grupo_id) return null
    const irmas = await ProjetoFV.find({
      ...escopoTenant,
      proposta_grupo_id: projeto.proposta_grupo_id,
      excluido: { $ne: true },
    }).select('proposta_grupo_id proposta_aceite').lean()
    return estadoDaOpcao(projeto, irmas)
  } catch {
    // Sem Mongo (memory storage) o conceito de grupo não existe — segue o
    // caminho de projeto único, que é o comportamento histórico.
    return null
  }
}

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
    const opcao = await _opcaoDoProjeto(filtroProjeto)
    return { ...avaliarGate({ fase, baseline, opcao }), baseline: baseline || null, opcao }
  },

  /**
   * Exige Baseline válida para a fase. Lança `ErroGate` quando bloqueada.
   *
   * É este o método que Engenharia e Homologação devem chamar quando forem
   * implementadas — a regra não vive na interface.
   */
  async exigirGate(fase, filtroProjeto) {
    const baseline = await BaselineRepository.acharPorProjeto(filtroProjeto)
    const opcao = await _opcaoDoProjeto(filtroProjeto)
    exigirBaseline({ fase, baseline, opcao })
    return baseline
  },

  /** Confere a integridade do snapshot congelado. */
  verificarIntegridade,
}

export { FASES_BIFURCACAO, MOTIVOS_GATE, ErroGate }
export default BaselineService
