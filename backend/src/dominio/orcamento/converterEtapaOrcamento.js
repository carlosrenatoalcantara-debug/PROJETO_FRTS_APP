/**
 * converterEtapaOrcamento.js — adapter de ESCRITA do orçamento — FV-DOM-002.
 *
 * Traduz o payload que o wizard envia em `PUT /:id/etapa` (etapa `orcamento`,
 * forma legada: modo kit/detalhado + totais) para a forma do agregado
 * `Orcamento` (lista de itens tipados + condições).
 *
 * Domínio PURO: sem I/O, sem Mongoose. Espelha `montarInstalacao` (ADR-019),
 * que faz o mesmo papel para a topologia.
 *
 * ── O que a tradução deliberadamente descarta ────────────────────────────────
 * Os totais que vêm no payload (`total_material_r`, `total_venda_r`, …) NÃO são
 * copiados: no modelo novo eles são DERIVADOS dos itens (INV-58). Copiá-los
 * criaria duas verdades que podem divergir. Recalculá-los é barato e exato.
 *
 * Os indicadores financeiros (`irr_pct`, `npv_r`, `payback_anos`, economias) não
 * pertencem ao Orçamento em nenhuma forma — são saída do motor financeiro.
 */

/** Número finito ou null — nunca NaN, nunca string. */
function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Item de orçamento a partir de um valor único (linha do kit). */
function itemDeValor(descricao, valor, tipo) {
  const v = num(valor)
  if (v == null || v <= 0) return null
  return { descricao, tipo, quantidade: 1, valor_unitario_r: v }
}

/**
 * Converte o kit fechado (modo 'kit') em itens tipados.
 * Quatro linhas canônicas: kit, frete (material) · projeto, mão de obra (serviço).
 */
export function itensDoKit(kit) {
  if (!kit) return []
  return [
    itemDeValor(kit.fornecedor ? `Kit fotovoltaico — ${kit.fornecedor}` : 'Kit fotovoltaico', kit.valor_kit_r, 'material'),
    itemDeValor('Frete', kit.frete_r, 'material'),
    itemDeValor('Projeto elétrico / ART', kit.projeto_r, 'servico'),
    itemDeValor('Mão de obra', kit.mao_obra_r, 'servico'),
  ].filter(Boolean)
}

/** Converte `itens_adicionais` (forma legada) em itens do agregado. */
export function itensAdicionais(lista) {
  if (!Array.isArray(lista)) return []
  return lista
    .map((i) => {
      const q = num(i?.quantidade)
      const v = num(i?.valor)
      if (v == null) return null
      return {
        descricao:        i?.descricao || 'Item',
        tipo:             i?.tipo === 'servico' ? 'servico' : 'material',
        quantidade:       q == null || q < 0 ? 1 : q,
        valor_unitario_r: v < 0 ? 0 : v,
      }
    })
    .filter(Boolean)
}

/**
 * Traduz o payload da etapa `orcamento` para os campos do agregado.
 *
 * @param {object} dados  payload da etapa (forma legada)
 * @returns {{ itens: Array, condicoes: object }}
 */
export function converterEtapaOrcamento(dados) {
  const d = dados || {}
  const itens = d.modo === 'detalhado'
    ? itensAdicionais(d.itens_adicionais)
    : [...itensDoKit(d.kit), ...itensAdicionais(d.itens_adicionais)]

  return {
    itens,
    condicoes: {
      validade_dias:       num(d.validade_dias) ?? 30,
      prazo_execucao_dias: num(d.prazo_execucao_dias),
      forma_pagamento:     d.forma_pagamento ?? null,
      observacoes:         d.kit?.observacoes ?? d.observacoes ?? null,
    },
  }
}

/**
 * Premissas da Cotação derivadas do estado técnico do projeto.
 *
 * O wizard não cria Cotação explicitamente — ele salta direto para o orçamento.
 * Como o agregado `Orcamento` exige uma origem (M-1: Orçamento → Cotação), o
 * Core sintetiza a Cotação a partir do que o projeto já tem. Isso preserva a
 * regra de domínio sem exigir mudança de UX nesta sprint.
 */
export function cotacaoDoProjeto(projeto) {
  const p = projeto || {}
  const tecnologia = p.equipamentos?.tipo_sistema || p.dimensionamento?.tipo_sistema || 'string'
  return {
    tecnologia,
    rotulo: 'Cotação derivada do wizard',
    premissas: {
      consumo_kwh_mes:    num(p.consumo_kwh_mes) ?? num(p.dadosConsumo?.consumoMensal),
      tarifa_kwh:         num(p.valor_kwh),
      hsp_kwh_m2_dia:     num(p.irradiancia_local?.media_anual) ?? num(p.irradiancia_kwh_kwp_dia),
      performance_ratio:  num(p.dimensionamento?.performance_ratio),
      area_disponivel_m2: num(p.telhado?.area_util_m2) ?? num(p.area?.areaDisponivel),
      observacoes:        'Sintetizada por FV-DOM-002 — o wizard ainda não cria Cotação explícita.',
    },
    local_ref:      p.local_ref ?? null,
    instalacao_ref: p.instalacao_ref ?? null,
  }
}

export default converterEtapaOrcamento
