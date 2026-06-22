/**
 * calcularOrcamento.js — P0-EV-ORCAMENTO-MATERIAIS-01
 *
 * MOTOR ÚNICO de orçamento (pure, sem I/O). Soma itens de equipamentos +
 * materiais + serviços, aplica margem e desconto → preço final.
 *
 * Reuso: criado para o EV agora; é o ponto único para o qual o FV (E8) deve
 * convergir (hoje o FV calcula inline em E8/CentroFinanceiroFV). Evita um
 * segundo motor de orçamento.
 *
 * Item: { descricao, quantidade, unidade?, preco_unitario, observacao? }
 */

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

export function subtotalItem(item) {
  return +(num(item?.quantidade) * num(item?.preco_unitario)).toFixed(2)
}

function somaLinhas(itens = []) {
  return +(itens.reduce((s, it) => s + subtotalItem(it), 0)).toFixed(2)
}

/**
 * @param {object} args
 * @param {Array} args.equipamentos
 * @param {Array} args.materiais
 * @param {Array} args.servicos
 * @param {number} args.margem_pct    margem sobre o custo (%)
 * @param {number} args.desconto_pct  desconto sobre (custo+margem) (%)
 * @returns resumo financeiro completo
 */
export function calcularOrcamento({ equipamentos = [], materiais = [], servicos = [], margem_pct = 0, desconto_pct = 0 } = {}) {
  const subtotal_equipamentos = somaLinhas(equipamentos)
  const subtotal_materiais     = somaLinhas(materiais)
  const subtotal_servicos      = somaLinhas(servicos)
  const custo = +(subtotal_equipamentos + subtotal_materiais + subtotal_servicos).toFixed(2)

  const margem_valor = +(custo * num(margem_pct) / 100).toFixed(2)
  const base_com_margem = +(custo + margem_valor).toFixed(2)
  const desconto_valor = +(base_com_margem * num(desconto_pct) / 100).toFixed(2)
  const preco_final = +(base_com_margem - desconto_valor).toFixed(2)

  return {
    subtotal_equipamentos,
    subtotal_materiais,
    subtotal_servicos,
    custo,
    margem_pct: num(margem_pct),
    margem_valor,
    base_com_margem,
    desconto_pct: num(desconto_pct),
    desconto_valor,
    preco_final,
  }
}

// Workflow comercial — fonte única dos status (Fase 6)
export const STATUS_ORCAMENTO = ['rascunho', 'orcado', 'aguardando_aprovacao', 'aprovado', 'instalacao', 'concluido']
export const STATUS_ORCAMENTO_LABEL = {
  rascunho: 'Rascunho',
  orcado: 'Orçado',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovado: 'Aprovado',
  instalacao: 'Instalação',
  concluido: 'Concluído',
}

export default { calcularOrcamento, subtotalItem, STATUS_ORCAMENTO, STATUS_ORCAMENTO_LABEL }
