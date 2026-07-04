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
 * @param {number} args.margem_pct    margem (%) — SOMENTE sobre materiais
 * @param {number} args.impostos_pct  impostos (%) — sobre (materiais c/ margem + serviços)
 * @param {number} args.desconto_pct  desconto (%) — sobre o total (compat)
 * @returns resumo financeiro profissional
 */
export function calcularOrcamento({
  equipamentos = [], materiais = [], servicos = [],
  margem_pct = 0, impostos_pct = 0, desconto_pct = 0,
} = {}) {
  const subtotal_equipamentos = somaLinhas(equipamentos)
  const subtotal_materiais     = somaLinhas(materiais)
  const subtotal_servicos      = somaLinhas(servicos)

  // ITEM 1 — margem apenas sobre materiais
  const margem_valor = r2(subtotal_materiais * num(margem_pct) / 100)
  const materiais_com_margem = r2(subtotal_materiais + margem_valor)   // "Subtotal Materiais"

  // ITEM 2 — impostos sobre (materiais com margem + serviços)
  const base_impostos = r2(materiais_com_margem + subtotal_servicos)
  const impostos_valor = r2(base_impostos * num(impostos_pct) / 100)

  // Custo direto (informativo — soma pura, sem margem/impostos)
  const custo = r2(subtotal_equipamentos + subtotal_materiais + subtotal_servicos)

  // Valor final = Equipamentos + Subtotal Materiais + Serviços + Impostos  (ITEM 6)
  const total = r2(subtotal_equipamentos + materiais_com_margem + subtotal_servicos + impostos_valor)

  // Desconto (compat) — aplicado ao final
  const desconto_valor = r2(total * num(desconto_pct) / 100)
  const preco_final = r2(total - desconto_valor)

  return {
    subtotal_equipamentos,
    subtotal_materiais,
    subtotal_servicos,
    margem_pct: num(margem_pct),
    margem_valor,
    materiais_com_margem,          // Subtotal Materiais (materiais + margem)
    impostos_pct: num(impostos_pct),
    impostos_valor,
    base_impostos,                 // materiais com margem + serviços
    custo,
    // "Valor sugerido" antes de impostos/desconto — mantido p/ compat de telas
    base_com_margem: r2(subtotal_equipamentos + materiais_com_margem + subtotal_servicos),
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
