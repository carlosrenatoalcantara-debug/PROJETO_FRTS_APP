/**
 * financeiroEngine.js — Sprint 4
 *
 * Motor financeiro EPC client-side. Funções puras e determinísticas — sem I/O.
 *
 * Princípio de ENGINEERING LOCK (S3.5/S4):
 *   Os cálculos de retorno (ROI/payback/economia) consomem a GERAÇÃO e a
 *   POTÊNCIA vindas do snapshot técnico congelado — nunca do state vivo do
 *   wizard. Quem chama deve passar `geracaoAnualKwh` e `potenciaWp` extraídos
 *   de snapshot_tecnico (ou do snapshot construído no momento, antes do freeze).
 *
 * Separação live-finance × frozen-finance:
 *   Este engine apenas CALCULA. O congelamento é responsabilidade de
 *   engenhariaGovernanca.construirSnapshotFinanceiro, que chama este engine e
 *   guarda o resultado imutável. Projetos CONGELADOS não recalculam.
 */

// ─── Helpers ────────────────────────────────────────────────────────────────────

const n = (v, def = 0) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : def
}
const round2 = (v) => +(n(v)).toFixed(2)
const pct = (parte, total) => (total > 0 ? +((parte / total) * 100).toFixed(2) : null)

// ─── 1. Composição de custos internos ───────────────────────────────────────────

export const CAMPOS_CUSTO = [
  'custo_painel', 'custo_inversor', 'custo_estrutura', 'custo_cabos',
  'custo_protecao', 'custo_homologacao', 'custo_mao_obra', 'custo_deslocamento',
  'custo_comissao', 'custo_impostos', 'custo_bess',
]

/**
 * Soma os custos internos. Separa custo de venda (CMV) de despesas variáveis
 * (comissão, impostos), pois margem líquida desconta as despesas.
 */
export function composicaoCustos(custos = {}) {
  const c = {}
  for (const k of CAMPOS_CUSTO) c[k] = n(custos[k])

  // CMV = tudo que compõe o sistema entregue (sem comissão/impostos)
  const cmv = c.custo_painel + c.custo_inversor + c.custo_estrutura + c.custo_cabos +
              c.custo_protecao + c.custo_homologacao + c.custo_mao_obra +
              c.custo_deslocamento + c.custo_bess
  const despesas_variaveis = c.custo_comissao + c.custo_impostos
  const custo_total = round2(cmv + despesas_variaveis)

  return { itens: c, cmv: round2(cmv), despesas_variaveis: round2(despesas_variaveis), custo_total }
}

// ─── 2. Modos de orçamento ───────────────────────────────────────────────────────

/**
 * Modo A — KIT FECHADO.
 * O operador informa o valor total de venda; o sistema deriva margem e markup
 * a partir do custo total informado (ou estimado). Distribui o valor pelos itens
 * proporcionalmente ao custo, quando houver composição.
 */
export function calcularModoKitFechado({ valorVendaKit, custos = {} }) {
  const comp = composicaoCustos(custos)
  const preco_venda = round2(valorVendaKit)
  const custo_total = comp.custo_total
  const lucro_bruto = round2(preco_venda - comp.cmv)
  const lucro_liquido = round2(preco_venda - custo_total)
  const markup_percentual = comp.cmv > 0 ? pct(preco_venda - comp.cmv, comp.cmv) : null

  return {
    modo: 'kit_fechado',
    composicao: comp,
    preco_venda,
    custo_total,
    lucro_bruto,
    lucro_liquido,
    markup_percentual,
  }
}

/**
 * Modo B — COMPOSIÇÃO DETALHADA.
 * O sistema calcula custo item a item e aplica markup/lucro desejado para chegar
 * ao preço de venda. `markupPct` aplica sobre o CMV; `descontoPct` reduz o preço.
 */
export function calcularModoComposicao({ custos = {}, markupPct = 0, descontoPct = 0 }) {
  const comp = composicaoCustos(custos)
  const markup = n(markupPct)
  const desconto = n(descontoPct)

  const preco_sem_desconto = round2(comp.cmv * (1 + markup / 100) + comp.despesas_variaveis)
  const preco_venda = round2(preco_sem_desconto * (1 - desconto / 100))
  const lucro_bruto = round2(preco_venda - comp.cmv)
  const lucro_liquido = round2(preco_venda - comp.custo_total)

  return {
    modo: 'composicao',
    composicao: comp,
    markup_percentual: markup,
    desconto_percentual: desconto,
    preco_sem_desconto,
    preco_venda,
    lucro_bruto,
    lucro_liquido,
  }
}

// ─── 3. Margem e rentabilidade ────────────────────────────────────────────────────

export function calcularMargem({ precoVenda, composicao, potenciaWp }) {
  const preco = round2(precoVenda)
  const cmv = n(composicao?.cmv)
  const custo_total = n(composicao?.custo_total)
  const lucro_total = round2(preco - custo_total)

  return {
    preco_venda: preco,
    custo_total: round2(custo_total),
    margem_bruta_pct: pct(preco - cmv, preco),
    margem_liquida_pct: pct(lucro_total, preco),
    lucro_total,
    lucro_por_wp: potenciaWp > 0 ? round2(lucro_total / potenciaWp) : null,
    ticket_medio: preco,
  }
}

// ─── 4. Financiamento (Tabela Price) ──────────────────────────────────────────────

/**
 * Financiamento bancário. taxaJurosMesPct em % ao mês. carenciaMeses adia a 1ª
 * parcela (juros capitalizam na carência). Retorna parcela, total e CET aproximado.
 */
export function calcularFinanciamento({ valor, entrada = 0, parcelas, taxaJurosMesPct, carenciaMeses = 0 }) {
  const pv0 = round2(n(valor) - n(entrada))
  const nP = Math.max(1, Math.round(n(parcelas)))
  const i = n(taxaJurosMesPct) / 100
  const carencia = Math.max(0, Math.round(n(carenciaMeses)))

  if (pv0 <= 0) return null

  // Capitaliza juros durante a carência
  const pv = i > 0 ? round2(pv0 * Math.pow(1 + i, carencia)) : pv0

  let parcela, coeficiente
  if (i > 0) {
    coeficiente = i / (1 - Math.pow(1 + i, -nP))
    parcela = round2(pv * coeficiente)
  } else {
    coeficiente = 1 / nP
    parcela = round2(pv / nP)
  }

  const total_pago = round2(parcela * nP + n(entrada))
  const total_juros = round2(parcela * nP - pv0)
  const cet_aa_pct = i > 0 ? +(((Math.pow(1 + i, 12) - 1) * 100).toFixed(2)) : 0

  return {
    valor_financiado: pv0,
    entrada: round2(entrada),
    parcelas: nP,
    taxa_juros_mes_pct: n(taxaJurosMesPct),
    carencia_meses: carencia,
    coeficiente: +coeficiente.toFixed(6),
    parcela,
    total_pago,
    total_juros,
    cet_aa_pct,
  }
}

// ─── 5. Parcelamento (cartão / boleto / próprio) ──────────────────────────────────

export function calcularParcelamento({ valor, tipo = 'cartao', parcelas, taxaMesPct = 0 }) {
  const v = round2(valor)
  const nP = Math.max(1, Math.round(n(parcelas)))
  const i = n(taxaMesPct) / 100

  let parcela, total
  if (i > 0) {
    const coef = i / (1 - Math.pow(1 + i, -nP))
    parcela = round2(v * coef)
    total = round2(parcela * nP)
  } else {
    parcela = round2(v / nP)
    total = v
  }

  const juros = round2(total - v)
  const cet_aa_pct = i > 0 ? +(((Math.pow(1 + i, 12) - 1) * 100).toFixed(2)) : 0

  return { tipo, valor: v, parcelas: nP, taxa_mes_pct: n(taxaMesPct), parcela, total, juros, cet_aa_pct }
}

// ─── 6. ROI / Payback / Economia / TIR (usa snapshot técnico) ─────────────────────

/**
 * Calcula retorno do investimento. ENGINEERING LOCK: geracaoAnualKwh vem do
 * snapshot técnico congelado, não do wizard vivo.
 *
 * @param {object} p
 * @param {number} p.geracaoAnualKwh   — geração anual (snapshot técnico)
 * @param {number} p.tarifaKwh         — R$/kWh (concessionária congelada)
 * @param {number} p.precoVenda        — investimento do cliente
 * @param {number} p.reajusteAnualPct  — reajuste tarifário a.a.
 * @param {number} p.inflacaoEnergiaPct — inflação energética adicional a.a.
 * @param {number} p.degradacaoAnualPct — perda de geração a.a. (default 0.5%)
 * @param {number} p.anos              — horizonte (default 25)
 */
export function calcularRetorno({
  geracaoAnualKwh, tarifaKwh, precoVenda,
  reajusteAnualPct = 0, inflacaoEnergiaPct = 0, degradacaoAnualPct = 0.5, anos = 25,
}) {
  const ger = n(geracaoAnualKwh)
  const tarifa = n(tarifaKwh)
  const investimento = n(precoVenda)
  if (ger <= 0 || tarifa <= 0 || investimento <= 0) {
    return { calc_possivel: false }
  }

  const crescTarifa = (1 + n(reajusteAnualPct) / 100) * (1 + n(inflacaoEnergiaPct) / 100) - 1
  const degr = n(degradacaoAnualPct) / 100

  const fluxos = []          // economia nominal por ano (1..anos)
  let acumulado = 0
  let paybackAnos = null
  for (let ano = 1; ano <= anos; ano++) {
    const tarifaAno = tarifa * Math.pow(1 + crescTarifa, ano - 1)
    const geracaoAno = ger * Math.pow(1 - degr, ano - 1)
    const economiaAno = geracaoAno * tarifaAno
    fluxos.push(economiaAno)

    const antes = acumulado
    acumulado += economiaAno
    if (paybackAnos === null && acumulado >= investimento) {
      // interpola fração do ano
      const falta = investimento - antes
      paybackAnos = +((ano - 1) + falta / economiaAno).toFixed(2)
    }
  }

  const economia_total = round2(acumulado)
  const economia_anual_1 = round2(fluxos[0])
  const economia_25_anos = round2(acumulado)
  const lucro_liquido_periodo = round2(economia_total - investimento)
  const roi_pct = pct(economia_total - investimento, investimento)

  // TIR via bisseção sobre NPV dos fluxos (ano 0 = -investimento)
  const tir = calcularTIR([-investimento, ...fluxos])

  return {
    calc_possivel: true,
    horizonte_anos: anos,
    geracao_anual_kwh: round2(ger),
    tarifa_inicial_kwh: round2(tarifa),
    crescimento_tarifa_aa_pct: +(crescTarifa * 100).toFixed(2),
    economia_anual_1ano: economia_anual_1,
    economia_25_anos,
    economia_total,
    payback_anos: paybackAnos,           // null = não paga no horizonte
    roi_pct,
    lucro_liquido_periodo,
    tir_estimada_aa_pct: tir,
  }
}

/** TIR (IRR) anual por bisseção. Retorna % a.a. ou null se não convergir. */
export function calcularTIR(fluxos, { iteracoes = 200, lo = -0.95, hi = 2 } = {}) {
  const npv = (taxa) => fluxos.reduce((acc, f, t) => acc + f / Math.pow(1 + taxa, t), 0)
  let a = lo, b = hi
  let fa = npv(a), fb = npv(b)
  if (!Number.isFinite(fa) || !Number.isFinite(fb) || fa * fb > 0) return null
  for (let k = 0; k < iteracoes; k++) {
    const m = (a + b) / 2
    const fm = npv(m)
    if (Math.abs(fm) < 1e-6) return +(m * 100).toFixed(2)
    if (fa * fm < 0) { b = m; fb = fm } else { a = m; fa = fm }
  }
  return +(((a + b) / 2) * 100).toFixed(2)
}

// ─── 7. Agregador completo ─────────────────────────────────────────────────────────

/**
 * Calcula o pacote financeiro completo (interno + cliente).
 *
 * @param {object} p
 * @param {'kit_fechado'|'composicao'} p.modo
 * @param {object} p.custos
 * @param {number} p.valorVendaKit       — modo kit fechado
 * @param {number} p.markupPct           — modo composição
 * @param {number} p.descontoPct
 * @param {object} p.snapshotTecnico     — { sistema.potenciaCC, geracao_anual_kwh }
 * @param {object} p.tarifa              — { tarifaKwh, reajusteAnualPct, inflacaoEnergiaPct, bandeira }
 * @param {object} [p.financiamento]     — { entrada, parcelas, taxaJurosMesPct, carenciaMeses }
 * @param {object} [p.parcelamento]      — { tipo, parcelas, taxaMesPct }
 * @param {object} [p.regulatorio]       — S4.1: ativa o motor Lei 14.300.
 *        { ativo, consumoAnualKwh, premissas|params } — quando ativo, calcula
 *        `retorno_realista` e `comparacao` sem alterar o `retorno` otimista.
 */
export function calcularFinanceiroCompleto({
  modo = 'composicao', custos = {}, valorVendaKit = 0,
  markupPct = 0, descontoPct = 0,
  snapshotTecnico = null, tarifa = {}, financiamento = null, parcelamento = null,
  regulatorio = null,
}) {
  const orcamento = modo === 'kit_fechado'
    ? calcularModoKitFechado({ valorVendaKit, custos })
    : calcularModoComposicao({ custos, markupPct, descontoPct })

  const potenciaWp = n(snapshotTecnico?.sistema?.potenciaCC) * 1000
  const geracaoAnualKwh = n(snapshotTecnico?.geracao_anual_kwh)

  const margem = calcularMargem({
    precoVenda: orcamento.preco_venda,
    composicao: orcamento.composicao,
    potenciaWp,
  })

  const retorno = calcularRetorno({
    geracaoAnualKwh,
    tarifaKwh: n(tarifa.tarifaKwh),
    precoVenda: orcamento.preco_venda,
    reajusteAnualPct: n(tarifa.reajusteAnualPct),
    inflacaoEnergiaPct: n(tarifa.inflacaoEnergiaPct),
  })

  const fin = financiamento
    ? calcularFinanciamento({ valor: orcamento.preco_venda, ...financiamento })
    : null
  const parc = parcelamento
    ? calcularParcelamento({ valor: orcamento.preco_venda, ...parcelamento })
    : null

  // S4.1: retorno realista (Lei 14.300) — precomputado pelo chamador para evitar
  // dependência circular com o motor regulatório. Quando presente, vira a base
  // da visão do cliente (mais honesta) e gera a comparação otimista×realista.
  const retornoRealista = (regulatorio?.ativo && regulatorio?.retorno_realista?.calc_possivel)
    ? regulatorio.retorno_realista
    : null

  let comparacao = null
  if (retornoRealista && retorno.calc_possivel) {
    const dif = round2((retornoRealista.economia_25_anos || 0) - (retorno.economia_25_anos || 0))
    comparacao = {
      economia_25_otimista: retorno.economia_25_anos,
      economia_25_realista: retornoRealista.economia_25_anos,
      diferenca_25_anos: dif,
      diferenca_pct: pct(dif, retorno.economia_25_anos),
      payback_otimista: retorno.payback_anos,
      payback_realista: retornoRealista.payback_anos,
      roi_otimista: retorno.roi_pct,
      roi_realista: retornoRealista.roi_pct,
    }
  }

  // Base de exibição ao cliente: realista quando disponível, senão otimista
  const base = retornoRealista || (retorno.calc_possivel ? retorno : null)

  return {
    calculado_em: new Date().toISOString(),
    modo,
    orcamento,
    margem,
    retorno,                       // otimista (compat Sprint 4)
    retorno_realista: retornoRealista,   // S4.1
    regulatorio: retornoRealista ? regulatorio.retorno_realista.premissas : null,
    comparacao,
    cenario_exibicao: retornoRealista ? 'realista' : 'otimista',
    financiamento: fin,
    parcelamento: parc,
    tarifa: {
      tarifa_kwh: n(tarifa.tarifaKwh),
      bandeira: tarifa.bandeira ?? null,
      reajuste_anual_pct: n(tarifa.reajusteAnualPct),
      inflacao_energia_pct: n(tarifa.inflacaoEnergiaPct),
    },
    // Visão resumida para o cliente (sem custos/margem/markup/comissão)
    visao_cliente: {
      valor_final: orcamento.preco_venda,
      cenario: retornoRealista ? 'realista' : 'otimista',
      economia_anual: base ? base.economia_anual_1ano : null,
      economia_25_anos: base ? base.economia_25_anos : null,
      roi_pct: base ? base.roi_pct : null,
      payback_anos: base ? base.payback_anos : null,
      financiamento: fin ? { entrada: fin.entrada, parcelas: fin.parcelas, parcela: fin.parcela } : null,
      parcelamento: parc ? { tipo: parc.tipo, parcelas: parc.parcelas, parcela: parc.parcela } : null,
    },
  }
}

// ─── 8. Comparativo de revisões financeiras ──────────────────────────────────────

/**
 * Compara o snapshot_financeiro de duas revisões (ou de uma lista de revisões).
 * Retorna a diferença de proposta final, margem e ROI.
 */
export function compararRevisoesFinanceiras(revisoes = []) {
  const pontos = revisoes
    .map(r => {
      const f = r.snapshots?.financeiro
      const preco = f?.proposta_final ?? f?.orcamento?.preco_venda ?? f?.custo_total ?? null
      return preco != null ? {
        rev: r.rev,
        preco: +Number(preco).toFixed(2),
        margem_liquida_pct: f?.margem?.margem_liquida_pct ?? null,
        roi_pct: f?.retorno?.roi_pct ?? null,
        timestamp: r.timestamp,
        motivo: r.motivo,
      } : null
    })
    .filter(Boolean)

  const comparacoes = []
  for (let k = 1; k < pontos.length; k++) {
    const ant = pontos[k - 1], at = pontos[k]
    comparacoes.push({
      de: ant.rev, para: at.rev,
      preco_anterior: ant.preco, preco_atual: at.preco,
      diferenca: round2(at.preco - ant.preco),
      diferenca_pct: pct(at.preco - ant.preco, ant.preco),
      motivo: at.motivo,
    })
  }
  return { pontos, comparacoes }
}
