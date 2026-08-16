/**
 * congelarOrcamento.js — construção do conteúdo congelado do Baseline.
 *
 * FV-DOM-001. Domínio PURO: sem I/O, sem Mongoose, sem Express. Recebe os planos
 * (objetos simples) do Orçamento e da Cotação e devolve o snapshot autocontido
 * que será gravado em `Baseline.conteudo`.
 *
 * Princípio: o snapshot deve bastar-se. Nada aqui remete a uma leitura futura
 * de Catálogo, Projeto ou Cotação — se um preço mudar amanhã, o que foi
 * contratado continua recuperável exatamente como estava (M-2).
 */

import { createHash } from 'node:crypto'

/** Soma segura: ignora parcelas não numéricas em vez de propagar NaN. */
function somar(valores) {
  return valores.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0)
}

/**
 * Totais do orçamento no instante do congelamento.
 *
 * Estes são valores DERIVADOS (INV-58) — e é justamente por isso que precisam
 * ser congelados aqui: recalculá-los depois usaria dados que podem ter mudado.
 */
export function calcularTotais(itens) {
  const lista = Array.isArray(itens) ? itens : []
  const valorDe = (i) => {
    const q = Number(i?.quantidade)
    const v = Number(i?.valor_unitario_r)
    if (!Number.isFinite(q) || !Number.isFinite(v)) return 0
    return q * v
  }
  const materiais = lista.filter((i) => i?.tipo !== 'servico')
  const servicos  = lista.filter((i) => i?.tipo === 'servico')

  const total_material_r = somar(materiais.map(valorDe))
  const total_servicos_r = somar(servicos.map(valorDe))

  return {
    total_material_r,
    total_servicos_r,
    total_r: total_material_r + total_servicos_r,
    quantidade_itens: lista.length,
  }
}

/**
 * Serializa de forma DETERMINÍSTICA: chaves ordenadas em qualquer profundidade.
 * Sem isso, dois snapshots idênticos produziriam hashes diferentes só pela ordem
 * em que o driver devolveu as chaves.
 */
export function serializarDeterministico(valor) {
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor ?? null)
  if (valor instanceof Date) return JSON.stringify(valor.toISOString())
  if (Array.isArray(valor)) return '[' + valor.map(serializarDeterministico).join(',') + ']'
  const chaves = Object.keys(valor).sort()
  return '{' + chaves.map((k) => JSON.stringify(k) + ':' + serializarDeterministico(valor[k])).join(',') + '}'
}

/** Hash de integridade do conteúdo congelado. */
export function calcularHash(conteudo) {
  return createHash('sha256').update(serializarDeterministico(conteudo)).digest('hex')
}

/**
 * Monta o conteúdo autocontido do Baseline.
 *
 * @param {object} entrada
 * @param {object} entrada.orcamento  plano do Orçamento (lean/toObject)
 * @param {object} entrada.cotacao    plano da Cotação (lean/toObject)
 * @param {Date}   [entrada.em]       instante do congelamento
 * @returns {{ conteudo: object, hash: string }}
 */
export function montarConteudoBaseline({ orcamento, cotacao, em = new Date() }) {
  if (!orcamento) throw new Error('montarConteudoBaseline: orcamento é obrigatório')
  if (!cotacao)   throw new Error('montarConteudoBaseline: cotacao é obrigatória')

  const conteudo = {
    congelado_em: em instanceof Date ? em.toISOString() : String(em),

    orcamento: {
      _id:       String(orcamento._id ?? ''),
      numero:    orcamento.numero ?? null,
      versao:    orcamento.versao ?? 1,
      estado:    'APROVADO',
      // Cópia integral dos itens — não uma referência a eles.
      itens: (orcamento.itens || []).map((i) => ({
        descricao:        i.descricao ?? null,
        tipo:             i.tipo ?? 'material',
        quantidade:       Number(i.quantidade) || 0,
        valor_unitario_r: Number(i.valor_unitario_r) || 0,
        // Proveniência do item (M-3) — informativa, não caminho de leitura.
        equipamento_ref:  i.equipamento_ref ? String(i.equipamento_ref) : null,
        material_ref:     i.material_ref ? String(i.material_ref) : null,
      })),
      condicoes: {
        validade_dias:       orcamento.condicoes?.validade_dias ?? null,
        prazo_execucao_dias: orcamento.condicoes?.prazo_execucao_dias ?? null,
        forma_pagamento:     orcamento.condicoes?.forma_pagamento ?? null,
        observacoes:         orcamento.condicoes?.observacoes ?? null,
      },
      // Derivados congelados — deliberado (ver cabeçalho do model Baseline).
      totais: calcularTotais(orcamento.itens),
    },

    cotacao: {
      _id:        String(cotacao._id ?? ''),
      rotulo:     cotacao.rotulo ?? null,
      tecnologia: cotacao.tecnologia ?? null,
      premissas: {
        consumo_kwh_mes:    cotacao.premissas?.consumo_kwh_mes ?? null,
        tarifa_kwh:         cotacao.premissas?.tarifa_kwh ?? null,
        hsp_kwh_m2_dia:     cotacao.premissas?.hsp_kwh_m2_dia ?? null,
        performance_ratio:  cotacao.premissas?.performance_ratio ?? null,
        area_disponivel_m2: cotacao.premissas?.area_disponivel_m2 ?? null,
      },
      composicao: (cotacao.composicao || []).map((c) => ({
        equipamento_ref: c.equipamento_ref ? String(c.equipamento_ref) : null,
        quantidade:      Number(c.quantidade) || 0,
        papel:           c.papel ?? null,
      })),
      local_ref:      cotacao.local_ref ? String(cotacao.local_ref) : null,
      instalacao_ref: cotacao.instalacao_ref ? String(cotacao.instalacao_ref) : null,
    },
  }

  return { conteudo, hash: calcularHash(conteudo) }
}

/** Confere a integridade de um Baseline já persistido. */
export function verificarIntegridade(baseline) {
  if (!baseline?.conteudo || !baseline?.hash) return false
  return calcularHash(baseline.conteudo) === baseline.hash
}
