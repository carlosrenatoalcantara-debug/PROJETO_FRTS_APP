/**
 * contratoV1.js — FinancialCalculationContract v1 — FV-DOM-012.
 *
 * Motor canônico do contrato financeiro. Não reimplementa nada: COMPÕE as
 * funções já consolidadas em `financeiroEngine`, que continuam sendo a única
 * fórmula de retorno do sistema.
 *
 * ── Decisões incorporadas ────────────────────────────────────────────────────
 *   D1  payback acumulado FRACIONÁRIO oficial, inteiro como secundário
 *   D2  VPL obrigatório · TMA nominal 10 % a.a., versionada
 *
 * ── Decisões AINDA PENDENTES ────────────────────────────────────────────────
 *   D3  inflação energética — NENHUM valor é assumido aqui. É premissa de
 *       entrada obrigatória; ausente, os indicadores que dependem dela saem
 *       `null` e o campo entra em `lacunas`. Isso NÃO escolhe D3: quando o
 *       Negócio definir um valor padrão, ele será injetado por quem chama, não
 *       embutido no motor.
 *   D4  autoridade dos PDFs — o contrato é preparado para ser a fonte única,
 *       mas nenhum PDF foi migrado.
 *   D5  cenário regulatório oficial — `regulatorio` fica declarado como
 *       pendente, sem escolher otimista ou realista.
 *
 * Puro: sem I/O, sem Express, sem Mongoose, sem Date implícito.
 */
import { calcularRetorno, calcularTIRDetalhado, calcularMargem, calcularFinanciamento } from './financeiroEngine.js'

/** Versão do CONTRATO — muda quando a estrutura da resposta muda. */
export const CONTRATO_VERSAO = '1.0.0'

/**
 * Conjunto de premissas vigente. Versionado: qualquer alteração de valor exige
 * uma versão nova e explícita — a TMA não pode ser trocada em silêncio.
 *
 * D2: TMA NOMINAL de 10 % a.a. Nominal porque o fluxo também é nominal (a
 * economia é corrigida pela inflação antes de ser descontada); misturar taxa
 * real com fluxo nominal subestimaria o VPL.
 */
export const PREMISSAS_VERSOES = Object.freeze({
  'v1-2026-08': Object.freeze({
    versao: 'v1-2026-08',
    vigencia_inicio: '2026-08-15',
    horizonte_anos: 25,
    degradacao_aa_pct: 0.5,
    taxa_desconto_aa_pct: 10,          // D2 — nominal
    natureza_taxa: 'nominal',
    convencao_desconto: 'fim_de_periodo',
    convencao_payback: 'fracionario',  // D1 — oficial
    // D3: sem valor. Deliberadamente ausente.
    inflacao_energia_aa_pct: null,
    reajuste_tarifa_aa_pct: null,
    composicao_reajuste: 'composta',   // (1+r)(1+i)−1, como o motor já faz
  }),
})

export const PREMISSAS_VIGENTE = 'v1-2026-08'

/** Premissas de uma versão. Versão desconhecida é erro de programação. */
export function premissasDaVersao(versao = PREMISSAS_VIGENTE) {
  const p = PREMISSAS_VERSOES[versao]
  if (!p) throw new Error(`contratoV1: versão de premissas desconhecida: ${versao}`)
  return p
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const round2 = (v) => (v == null ? null : +Number(v).toFixed(2))

/**
 * VPL de uma série nominal, descontada pela TMA — implementação CANÔNICA (D2).
 *
 * `fluxos[0]` é o investimento (negativo); `fluxos[t]` é a economia do ano t,
 * descontada por `(1+i)^t` — fim de período, convenção unânime nos motores.
 *
 * As somas equivalentes embutidas em `fluxoCaixa` e `dimensionamentoRetorno`
 * seguem existindo com as premissas DELES até que D2 seja propagada
 * (FV-DOM-013). Esta é a que vale para o contrato.
 */
export function calcularVPL(fluxos, taxaAaPct) {
  const i = num(taxaAaPct)
  if (i == null || !Array.isArray(fluxos) || fluxos.length === 0) return null
  const taxa = i / 100
  return round2(fluxos.reduce((acc, f, t) => acc + f / Math.pow(1 + taxa, t), 0))
}

/**
 * Payback DESCONTADO: primeiro momento em que o acumulado em valor presente
 * cobre o investimento. Fracionário, como o simples (D1) — mesma convenção.
 */
export function calcularPaybackDescontado(fluxos, taxaAaPct) {
  const i = num(taxaAaPct)
  if (i == null || !Array.isArray(fluxos) || fluxos.length < 2) return null
  const taxa = i / 100
  let acumulado = fluxos[0]            // investimento (negativo)
  for (let t = 1; t < fluxos.length; t++) {
    const vp = fluxos[t] / Math.pow(1 + taxa, t)
    const antes = acumulado
    acumulado += vp
    if (acumulado >= 0) {
      if (vp === 0) return t
      return +((t - 1) + (-antes) / vp).toFixed(2)
    }
  }
  return null                          // não se paga no horizonte
}

/**
 * Payback inteiro (D1 — campo SECUNDÁRIO).
 *
 * É o primeiro ano fechado em que o acumulado ficou positivo — ou seja, o teto
 * do fracionário. Derivado, não recalculado: uma fórmula só.
 */
export function paybackInteiroDe(paybackFracionario) {
  return paybackFracionario == null ? null : Math.ceil(paybackFracionario)
}

/**
 * Executa o contrato financeiro V1.
 *
 * @param {object} p
 * @param {object} p.entradas    { investimento_r, geracao_anual_kwh, consumo_anual_kwh, potencia_wp }
 * @param {object} p.premissas   sobreposições sobre a versão (ex.: inflação, tarifa)
 * @param {string} [p.premissas_versao]
 * @param {object} [p.proveniencia] de onde veio cada entrada/premissa
 * @param {object} [p.custos]     composição, quando houver
 * @param {object} [p.financiamento]
 * @param {Date}   [p.agora]      carimbo INJETÁVEL — metadado, fora do cálculo (E3)
 */
export function calcularContratoV1({
  entradas = {},
  premissas = {},
  premissas_versao = PREMISSAS_VIGENTE,
  proveniencia = {},
  custos = null,
  financiamento = null,
  agora = null,
} = {}) {
  const base = premissasDaVersao(premissas_versao)

  // Premissas efetivas: a versão manda no que é decidido (TMA, horizonte,
  // degradação, convenções); o chamador fornece o que ainda não foi decidido.
  const prem = {
    ...base,
    tarifa_kwh: num(premissas.tarifa_kwh),
    inflacao_energia_aa_pct: num(premissas.inflacao_energia_aa_pct),
    reajuste_tarifa_aa_pct: num(premissas.reajuste_tarifa_aa_pct),
  }

  const investimento = num(entradas.investimento_r)
  const geracao = num(entradas.geracao_anual_kwh)
  const potenciaWp = num(entradas.potencia_wp)

  // ── Lacunas: o que falta para cada indicador ────────────────────────────────
  const lacunas = []
  if (investimento == null) lacunas.push('investimento_r')
  if (geracao == null) lacunas.push('geracao_anual_kwh')
  if (prem.tarifa_kwh == null) lacunas.push('tarifa_kwh')
  // D3 pendente: sem valor decidido, a inflação PRECISA vir de fora.
  if (prem.inflacao_energia_aa_pct == null) lacunas.push('inflacao_energia_aa_pct')

  const podeCalcular = lacunas.length === 0

  const retorno = podeCalcular
    ? calcularRetorno({
        geracaoAnualKwh: geracao,
        tarifaKwh: prem.tarifa_kwh,
        precoVenda: investimento,
        reajusteAnualPct: prem.reajuste_tarifa_aa_pct ?? 0,
        inflacaoEnergiaPct: prem.inflacao_energia_aa_pct,
        degradacaoAnualPct: prem.degradacao_aa_pct,
        anos: prem.horizonte_anos,
      })
    : null

  const serie = retorno?.calc_possivel
    ? [-investimento, ...retorno.fluxos_anuais]
    : null

  const paybackFrac = retorno?.calc_possivel ? retorno.payback_anos : null
  const tir = serie
    ? calcularTIRDetalhado(serie)
    : { valor_aa_pct: null, convergiu: false, motivo: 'entradas_ausentes', intervalo_busca: null }

  const margem = (custos && investimento != null)
    ? calcularMargem({ precoVenda: investimento, composicao: custos, potenciaWp })
    : null

  return {
    contrato_versao: CONTRATO_VERSAO,
    premissas_versao: prem.versao,
    // E3: metadado. Injetável, e nunca lido por nenhum cálculo acima.
    calculado_em: (agora instanceof Date ? agora : new Date()).toISOString(),

    premissas: prem,
    entradas: {
      investimento_r: investimento,
      geracao_anual_kwh: geracao,
      consumo_anual_kwh: num(entradas.consumo_anual_kwh),
      potencia_wp: potenciaWp,
    },

    fluxo_caixa: serie
      ? retorno.fluxos_anuais.map((economia, idx) => {
          const ano = idx + 1
          const vp = economia / Math.pow(1 + prem.taxa_desconto_aa_pct / 100, ano)
          return { ano, economia_r: economia, valor_presente_r: round2(vp) }
        })
      : [],

    // D1 — fracionário oficial, inteiro secundário
    payback: {
      anos: paybackFrac,
      convencao: prem.convencao_payback,
      dentro_horizonte: paybackFrac != null,
      anos_inteiro: paybackInteiroDe(paybackFrac),
    },

    // D2 — obrigatório, TMA da versão
    payback_descontado: serie
      ? {
          anos: calcularPaybackDescontado(serie, prem.taxa_desconto_aa_pct),
          dentro_horizonte: calcularPaybackDescontado(serie, prem.taxa_desconto_aa_pct) != null,
        }
      : null,
    vpl: serie
      ? { valor_r: calcularVPL(serie, prem.taxa_desconto_aa_pct), taxa_aa_pct: prem.taxa_desconto_aa_pct }
      : null,

    // E7 — estado de convergência explícito
    tir,

    economia: retorno?.calc_possivel
      ? {
          anual_1ano_r: retorno.economia_anual_1ano,
          horizonte_r: retorno.economia_total,
          roi_pct: retorno.roi_pct,
        }
      : null,

    margem,
    financiamento: (financiamento && investimento != null)
      ? calcularFinanciamento({ valor: investimento, ...financiamento })
      : null,

    // D5 pendente — nenhum cenário escolhido.
    regulatorio: { aplicavel: false, motivo: 'D5_PENDENTE', cenario_oficial: null },

    proveniencia,
    lacunas,
    arredondamento: { moeda: 2, percentual: 2, anos: 2, coeficiente: 6 },
  }
}
