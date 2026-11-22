/**
 * precificacaoOpcao.js — composição de preço de uma opção de kit — FV-ORC-000 Fase 1.
 *
 * ── Regra decidida (D2) ──────────────────────────────────────────────────────
 *   kit (cotação do distribuidor)
 * + extra de estrutura = R$/módulo do tipo de estrutura × módulos (só se > 0)
 * + pacote Forte Solar = pct × (kit + extra) + custos adicionais
 *   ───────────────────
 *   total instalado
 *
 * O % e os R$/módulo vêm de Configurações; cada proposta pode sobrescrever.
 * Uma opção também pode ter o pacote FIXO (valor em R$) — o modo fica gravado
 * na saída para que nunca se misture regra sem aviso (erro nº 4 do diagnóstico).
 * O cliente nunca vê o %: a saída separa `memoria` (interna) de `linhas`.
 *
 * ── Dinheiro ─────────────────────────────────────────────────────────────────
 * Toda conta é feita em CENTAVOS inteiros. Arredondamento comercial (meio para
 * cima) em cada linha; a soma das linhas é o total, sem reconciliação mágica.
 * Parcelas: as intermediárias arredondam meio para cima, a ÚLTIMA absorve a
 * diferença — a soma das parcelas é sempre exatamente o valor parcelado.
 *
 * ── O que NÃO faz ────────────────────────────────────────────────────────────
 * Não cria padrão: sem % configurado e sem valor fixo, o pacote é lacuna. Tipo
 * de estrutura sem valor configurado vale 0 (a regra do operador: só Solo e Laje
 * têm acréscimo) mas é registrado na memória.
 *
 * Puro: sem I/O, sem React, sem Mongoose.
 */

export const MODO_PACOTE = Object.freeze({ PERCENTUAL: 'percentual', FIXO: 'fixo' })
export const BASE_CUSTO = Object.freeze({ POR_MODULO: 'por_modulo', FIXO: 'fixo', PCT: 'pct' })
export const CATEGORIA = Object.freeze({
  KIT: 'kit',
  ESTRUTURA_EXTRA: 'estrutura_extra',
  PACOTE_FORTE_SOLAR: 'pacote_forte_solar',
})
export const PAGADOR = Object.freeze({ DISTRIBUIDORA: 'distribuidora', FORTE_SOLAR: 'forte_solar' })

function _num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Reais → centavos inteiros, meio para cima (sem erro binário em x,xx5). */
export function paraCentavos(reais) {
  const n = _num(reais)
  if (n === null) return null
  // toFixed(6) estabiliza 0,1+0,2 antes de escalar; Math.round com sinal simétrico.
  const escalado = Number((n * 100).toFixed(6))
  return Math.sign(escalado) * Math.round(Math.abs(escalado))
}
export const paraReais = (centavos) => (centavos === null ? null : centavos / 100)

/** Fração de um valor em centavos, arredondada meio para cima. */
const _fracaoCentavos = (centavos, fracao) =>
  Math.round(Number((centavos * fracao).toFixed(6)))

/**
 * Divide um valor em parcelas: entrada fixa + marcos percentuais do saldo.
 * A última parcela absorve o centavo.
 *
 * @param {Object} p
 * @param {number} p.valorR          valor a parcelar (R$)
 * @param {number} [p.entradaR]      entrada fixa (R$), 0 se ausente
 * @param {Array<{descricao:string, pct:number}>} p.marcos  % do SALDO; soma = 100
 */
export function parcelarPagamento({ valorR, entradaR = 0, marcos = [] } = {}) {
  const lacunas = []
  const total = paraCentavos(valorR)
  const entrada = paraCentavos(entradaR ?? 0)
  if (total === null || total < 0) {
    return { parcelas: [], lacunas: ['Valor a parcelar ausente ou inválido.'] }
  }
  if (entrada === null || entrada < 0 || entrada > total) {
    return { parcelas: [], lacunas: ['Entrada inválida ou maior que o valor.'] }
  }
  const lista = Array.isArray(marcos) ? marcos : []
  const pcts = lista.map((m) => _num(m?.pct))
  if (pcts.some((p) => p === null || p < 0)) {
    return { parcelas: [], lacunas: ['Marco de pagamento sem % válido.'] }
  }
  const somaPct = pcts.reduce((s, p) => s + p, 0)
  const saldo = total - entrada
  if (lista.length === 0 && saldo > 0) {
    return { parcelas: [], lacunas: ['Há saldo após a entrada, mas nenhum marco de pagamento.'] }
  }
  if (lista.length > 0 && Math.abs(somaPct - 100) > 1e-9) {
    return { parcelas: [], lacunas: [`Marcos somam ${somaPct}% do saldo; precisam somar 100%.`] }
  }

  const parcelas = []
  if (entrada > 0) parcelas.push({ descricao: 'Entrada', valor_r: paraReais(entrada) })
  let acumulado = 0
  lista.forEach((m, i) => {
    const ultima = i === lista.length - 1
    const c = ultima ? saldo - acumulado : _fracaoCentavos(saldo, pcts[i] / 100)
    acumulado += c
    parcelas.push({ descricao: m?.descricao ?? `Parcela ${i + 1}`, pct_saldo: pcts[i], valor_r: paraReais(c) })
  })
  return { parcelas, lacunas }
}

/**
 * Preço de uma opção.
 *
 * @param {Object} p
 * @param {number} p.valorKitR          valor do kit na cotação do distribuidor
 * @param {number} p.quantidadeModulos
 * @param {string} p.tipoEstrutura      `valor` de TIPOS_ESTRUTURA (ex.: 'Solo')
 * @param {Object} p.politica           Configurações (CFG-04)
 * @param {number}  [p.politica.pacote_pct]                        % sobre (kit + extra)
 * @param {Object}  [p.politica.extra_estrutura_r_por_modulo]      { Solo: 125, Laje: 25 }
 * @param {Array}   [p.politica.custos_adicionais]                 [{descricao, base, valor}]
 * @param {Object}  [p.politica.pagamento]                         { entrada_r, marcos[] }
 * @param {string}  [p.politica.pagador_extra_estrutura]           PAGADOR
 * @param {Object} [p.ajustes]  sobrescrita desta proposta: { pacote_pct?, pacote_valor_r?,
 *   extra_estrutura_r_por_modulo?, custos_adicionais?, pagamento? }. `pacote_valor_r`
 *   põe o pacote em modo FIXO.
 */
export function precificarOpcao({
  valorKitR, quantidadeModulos, tipoEstrutura = null, politica = {}, ajustes = {},
} = {}) {
  const lacunas = []
  const pol = { ...(politica ?? {}), ...(ajustes ?? {}) }

  const kit = paraCentavos(valorKitR)
  if (kit === null || kit < 0) lacunas.push('Valor do kit ausente ou inválido.')

  const qtdBruta = _num(quantidadeModulos)
  const qtd = qtdBruta !== null && Number.isInteger(qtdBruta) && qtdBruta > 0 ? qtdBruta : null
  if (qtd === null) lacunas.push('Quantidade de módulos ausente ou não inteira.')

  // ── Extra de estrutura ────────────────────────────────────────────────────
  const tabela = pol.extra_estrutura_r_por_modulo ?? {}
  let extraPorModulo = 0
  if (tipoEstrutura) {
    const v = _num(tabela[tipoEstrutura])
    if (tabela[tipoEstrutura] !== undefined && (v === null || v < 0)) {
      lacunas.push(`Extra de estrutura configurado para ${tipoEstrutura} é inválido.`)
    } else if (v !== null) extraPorModulo = v
  } else {
    lacunas.push('Tipo de estrutura não informado: extra de estrutura considerado 0.')
  }
  const extraPorModuloC = paraCentavos(extraPorModulo)
  const extra = qtd === null ? null : extraPorModuloC * qtd

  // ── Pacote Forte Solar ────────────────────────────────────────────────────
  const baseC = kit === null || extra === null ? null : kit + extra
  const fixo = _num(pol.pacote_valor_r)
  const pct = _num(pol.pacote_pct)
  let modo = null
  let pacoteBase = null
  if (pol.pacote_valor_r !== undefined && pol.pacote_valor_r !== null) {
    if (fixo === null || fixo < 0) lacunas.push('Valor fixo do pacote inválido.')
    else { modo = MODO_PACOTE.FIXO; pacoteBase = paraCentavos(fixo) }
  } else if (pct === null) {
    lacunas.push('% do pacote Forte Solar não configurado e sem valor fixo nesta proposta.')
  } else if (pct < 0) {
    lacunas.push('% do pacote Forte Solar negativo.')
  } else {
    modo = MODO_PACOTE.PERCENTUAL
    pacoteBase = baseC === null ? null : _fracaoCentavos(baseC, pct / 100)
  }

  // ── Custos adicionais (somam no pacote; cliente vê só o total) ───────────
  const custos = []
  for (const [i, c] of (Array.isArray(pol.custos_adicionais) ? pol.custos_adicionais : []).entries()) {
    const valor = _num(c?.valor)
    const desc = c?.descricao || `Custo adicional ${i + 1}`
    if (valor === null || valor < 0) { lacunas.push(`${desc}: valor inválido.`); continue }
    let centavos = null
    if (c?.base === BASE_CUSTO.FIXO) centavos = paraCentavos(valor)
    else if (c?.base === BASE_CUSTO.POR_MODULO) centavos = qtd === null ? null : paraCentavos(valor) * qtd
    else if (c?.base === BASE_CUSTO.PCT) centavos = baseC === null ? null : _fracaoCentavos(baseC, valor / 100)
    else { lacunas.push(`${desc}: base de cálculo desconhecida (${c?.base}).`); continue }
    custos.push({ descricao: desc, base: c.base, valor: valor, valor_r: paraReais(centavos) })
  }
  const custosC = custos.some((c) => c.valor_r === null) ? null
    : custos.reduce((s, c) => s + paraCentavos(c.valor_r), 0)

  const pacote = pacoteBase === null || custosC === null ? null : pacoteBase + custosC

  // ── Linhas que o cliente vê ───────────────────────────────────────────────
  const pagadorExtra = Object.values(PAGADOR).includes(pol.pagador_extra_estrutura)
    ? pol.pagador_extra_estrutura : null
  const linhas = [
    { categoria: CATEGORIA.KIT, descricao: 'Kit / equipamentos', pagador: PAGADOR.DISTRIBUIDORA, valor_r: paraReais(kit) },
  ]
  if (extra !== null && extra > 0) {
    if (pagadorExtra === null) lacunas.push('Pagador do extra de estrutura não definido.')
    linhas.push({
      categoria: CATEGORIA.ESTRUTURA_EXTRA,
      descricao: `Estrutura ${tipoEstrutura}`,
      pagador: pagadorExtra,
      valor_r: paraReais(extra),
    })
  }
  linhas.push({
    categoria: CATEGORIA.PACOTE_FORTE_SOLAR,
    descricao: 'Forte Solar (projeto, execução e material elétrico)',
    pagador: PAGADOR.FORTE_SOLAR,
    valor_r: paraReais(pacote),
  })

  const total = linhas.some((l) => l.valor_r === null) ? null
    : linhas.reduce((s, l) => s + paraCentavos(l.valor_r), 0)

  // ── Parcelas do pacote Forte Solar ────────────────────────────────────────
  let pagamento = null
  if (pacote !== null && pol.pagamento) {
    pagamento = parcelarPagamento({
      valorR: paraReais(pacote), entradaR: pol.pagamento.entrada_r ?? 0, marcos: pol.pagamento.marcos ?? [],
    })
    lacunas.push(...pagamento.lacunas)
  }

  return {
    linhas,
    total_r: paraReais(total),
    pagamento,
    memoria: {
      modo_pacote: modo,
      pacote_pct: modo === MODO_PACOTE.PERCENTUAL ? pct : null,
      base_pacote_r: paraReais(baseC),
      pacote_base_r: paraReais(pacoteBase),
      custos_adicionais: custos,
      extra_estrutura_r_por_modulo: extraPorModulo,
      tipo_estrutura: tipoEstrutura,
      quantidade_modulos: qtd,
    },
    lacunas,
  }
}

export default {
  MODO_PACOTE, BASE_CUSTO, CATEGORIA, PAGADOR,
  paraCentavos, paraReais, parcelarPagamento, precificarOpcao,
}
