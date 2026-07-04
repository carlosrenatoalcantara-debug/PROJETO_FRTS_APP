/**
 * calcularOrcamento.js — Motor ÚNICO de orçamento (pure, sem I/O).
 *
 * FEATURE-002 (Orçamento Profissional EV):
 *  • ITEM 1 — Margem (%) incide SOMENTE sobre os MATERIAIS. Nunca sobre serviços
 *    (mão de obra, projeto, ART, deslocamento, comissionamento) nem equipamentos.
 *  • ITEM 2 — Impostos (%) incidem sobre (Materiais com margem + Serviços). Nunca
 *    embutidos na margem — sempre separados no resumo.
 *  • ITEM 6 — Composição clara: Equipamentos · Materiais · Margem Materiais ·
 *    Subtotal Materiais · Serviços · Impostos · Valor Final.
 *
 * Desconto (%) é mantido por compatibilidade (edição/clone); aplica-se ao final e
 * só aparece no resumo quando > 0.
 *
 * Item: { descricao, quantidade, unidade?, preco_unitario, observacao? }
 */

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const r2 = (v) => +Number(v || 0).toFixed(2)

export function subtotalItem(item) {
  return r2(num(item?.quantidade) * num(item?.preco_unitario))
}

function somaLinhas(itens = []) {
  return r2(itens.reduce((s, it) => s + subtotalItem(it), 0))
}

/**
 * @param {object} args
 * @param {Array}  args.equipamentos
 * @param {Array}  args.materiais
 * @param {Array}  args.servicos
 * @param {number} args.margem_pct    margem (%) — SOMENTE materiais (compat FEATURE-002)
 * @param {object} [args.margem]      FEATURE-004: margem por categoria (Política Comercial):
 *   { aplicar_materiais, materiais_pct, aplicar_equipamentos, equipamentos_pct, aplicar_servicos, servicos_pct }
 * @param {number} args.impostos_pct  impostos (%) — sobre (materiais c/ margem + serviços c/ margem)
 * @param {number} args.desconto_pct  desconto (%) — sobre o total (compat)
 * @returns resumo financeiro profissional
 */
export function calcularOrcamento({
  equipamentos = [], materiais = [], servicos = [],
  margem_pct = 0, margem = null, impostos_pct = 0, desconto_pct = 0,
} = {}) {
  const subtotal_equipamentos = somaLinhas(equipamentos)
  const subtotal_materiais     = somaLinhas(materiais)
  const subtotal_servicos      = somaLinhas(servicos)

  // FEATURE-004 — margem por categoria (Política Comercial). Sem `margem` → comportamento
  // FEATURE-002: margem SOMENTE sobre materiais com `margem_pct`. 100% retrocompatível.
  const pol = margem || { aplicar_materiais: true, materiais_pct: num(margem_pct), aplicar_equipamentos: false, equipamentos_pct: 0, aplicar_servicos: false, servicos_pct: 0 }
  const margem_valor            = pol.aplicar_materiais    ? r2(subtotal_materiais    * num(pol.materiais_pct)    / 100) : 0  // margem de MATERIAIS (compat)
  const margem_equipamentos_valor = pol.aplicar_equipamentos ? r2(subtotal_equipamentos * num(pol.equipamentos_pct) / 100) : 0
  const margem_servicos_valor   = pol.aplicar_servicos    ? r2(subtotal_servicos     * num(pol.servicos_pct)     / 100) : 0

  const materiais_com_margem     = r2(subtotal_materiais + margem_valor)              // "Subtotal Materiais"
  const equipamentos_com_margem  = r2(subtotal_equipamentos + margem_equipamentos_valor)
  const servicos_com_margem      = r2(subtotal_servicos + margem_servicos_valor)
  const margem_total             = r2(margem_valor + margem_equipamentos_valor + margem_servicos_valor)

  // Impostos sobre (materiais com margem + serviços com margem). Sem margem de serviços
  // (default), serviços_com_margem = serviços → idêntico à FEATURE-002.
  const base_impostos = r2(materiais_com_margem + servicos_com_margem)
  const impostos_valor = r2(base_impostos * num(impostos_pct) / 100)

  // Custo direto (informativo — soma pura, sem margem/impostos)
  const custo = r2(subtotal_equipamentos + subtotal_materiais + subtotal_servicos)

  // Valor final = Equip(c/ margem) + Subtotal Materiais + Serviços(c/ margem) + Impostos
  const total = r2(equipamentos_com_margem + materiais_com_margem + servicos_com_margem + impostos_valor)

  // Desconto (compat) — aplicado ao final
  const desconto_valor = r2(total * num(desconto_pct) / 100)
  const preco_final = r2(total - desconto_valor)

  return {
    subtotal_equipamentos,
    subtotal_materiais,
    subtotal_servicos,
    margem_pct: num(pol.materiais_pct ?? margem_pct),
    margem_valor,                  // margem de MATERIAIS (compat FEATURE-002)
    materiais_com_margem,          // Subtotal Materiais (materiais + margem)
    margem_equipamentos_valor,
    equipamentos_com_margem,
    margem_servicos_valor,
    servicos_com_margem,
    margem_total,
    impostos_pct: num(impostos_pct),
    impostos_valor,
    base_impostos,                 // materiais com margem + serviços com margem
    custo,
    // "Valor sugerido" antes de impostos/desconto — mantido p/ compat de telas
    base_com_margem: r2(equipamentos_com_margem + materiais_com_margem + servicos_com_margem),
    total,
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
