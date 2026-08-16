/**
 * resolverCongelamento.js — resolvedor do contrato único de congelamento.
 *
 * FV-DOM-002A (Parte A). Carrega os FATOS (orçamento aprovado, baseline válida)
 * e delega a decisão ao contrato puro em
 * `@fortesolar/fv-shared/estados/congelamento`.
 *
 * Este é o ÚNICO lugar do backend que consulta o banco para responder "o projeto
 * está congelado?". Guards, alertas, homologação e ciclo de vida chamam daqui —
 * nenhum deles reimplementa a regra.
 *
 * Há duas formas de usar:
 *  • `resolverCongelamento(projeto)`  — faz I/O, resolve tudo
 *  • `avaliarCongelamento(fatos)`     — puro, quando os fatos já estão em mãos
 */

import { Orcamento } from '../../models/Orcamento.js'
import { Baseline } from '../../models/Baseline.js'
import { verificarIntegridade } from '../baseline/congelarOrcamento.js'
import { avaliarCongelamento, MOTIVO_CONGELAMENTO } from '@fortesolar/fv-shared/estados/congelamento'

/**
 * Levanta os fatos de congelamento de um projeto.
 *
 * @param {object} projeto  plano do ProjetoFV (lean/toObject) — precisa de _id,
 *                          empresa_id e governanca
 * @returns {Promise<object>} decisão de `avaliarCongelamento` + refs resolvidas
 */
export async function resolverCongelamento(projeto) {
  if (!projeto?._id) {
    return { ...avaliarCongelamento({}), orcamento_ref: null, baseline_ref: null }
  }

  const escopo = { projeto_ref: projeto._id, empresa_id: projeto.empresa_id ?? null }

  const [orcamentoAprovado, baseline] = await Promise.all([
    Orcamento.findOne({ ...escopo, estado: 'APROVADO' }).select('_id').lean(),
    Baseline.findOne(escopo).lean(),
  ])

  const decisao = avaliarCongelamento({
    orcamentoAprovado: !!orcamentoAprovado,
    // Baseline adulterada não vale como contrato — mesmo critério do Gate.
    baselineValida: !!baseline && verificarIntegridade(baseline),
    freeze_status: projeto.governanca?.freeze_status ?? null,
    workflow_status: projeto.governanca?.comercial?.workflow_status ?? null,
  })

  return {
    ...decisao,
    orcamento_ref: orcamentoAprovado?._id ?? null,
    baseline_ref: baseline?._id ?? null,
  }
}

/**
 * Versão para quem já carregou o projeto e só precisa do booleano.
 * Mantém a assinatura enxuta dos guards que existiam antes.
 */
export async function projetoCongelado(projeto) {
  const r = await resolverCongelamento(projeto)
  return r.congelado
}

export { avaliarCongelamento, MOTIVO_CONGELAMENTO }
export default resolverCongelamento
