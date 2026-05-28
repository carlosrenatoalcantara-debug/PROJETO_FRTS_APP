/**
 * financeiroRegulatorioBR.js — Sprint 4.1
 *
 * Motor regulatório brasileiro de geração distribuída (GD).
 * Modela a Lei 14.300/2022 (Marco Legal da GD): cobrança gradual do Fio B
 * sobre energia compensada, TUSD, compensação parcial, simultaneidade
 * (autoconsumo instantâneo), custo de disponibilidade por tipo de ligação,
 * degradação modular, reajuste tarifário e modalidades GD I/II/III.
 *
 * SEPARAÇÃO DE RESPONSABILIDADES:
 *   financeiroEngine.js     → motor financeiro PURO (custos, markup, Price, TIR)
 *   financeiroRegulatorioBR → motor REGULATÓRIO (Lei 14.300, Fio B, compensação)
 *
 * ENGINEERING LOCK: geração e potência vêm do snapshot técnico congelado.
 * Funções puras e determinísticas — sem I/O. Tudo auditável e parametrizável.
 */

import { calcularTIR } from './financeiroEngine'

const n = (v, def = 0) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : def
}
const round2 = (v) => +(n(v)).toFixed(2)
const pct = (parte, total) => (total > 0 ? +((parte / total) * 100).toFixed(2) : null)

// ─── Custo de disponibilidade (consumo mínimo faturável) ────────────────────────
// kWh/mês cobrados independentemente da geração (Resolução ANEEL 1.000/2021).
export const CUSTO_DISPONIBILIDADE_KWH = {
  monofasico: 30,
  bifasico:   50,
  trifasico:  100,
}

export function custoDisponibilidadeKwh(tipoLigacao) {
  const t = String(tipoLigacao || 'monofasico').toLowerCase()
  if (t.includes('tri')) return CUSTO_DISPONIBILIDADE_KWH.trifasico
  if (t.includes('bi'))  return CUSTO_DISPONIBILIDADE_KWH.bifasico
  return CUSTO_DISPONIBILIDADE_KWH.monofasico
}

// ─── Cronograma do Fio B — Lei 14.300/2022 ──────────────────────────────────────
// Percentual da TUSD Fio B cobrado sobre a energia COMPENSADA (injetada que
// abate consumo em outro posto/UC). Sistemas com protocolo até 06/01/2023 têm
// direito adquirido (Fio B = 0) até 31/12/2045.
export const CRONOGRAMA_FIO_B = {
  2023: 0.15,
  2024: 0.30,
  2025: 0.45,
  2026: 0.60,
  2027: 0.75,
  2028: 0.90,
  // 2029+ → definido pela ANEEL; usamos 100% como cenário conservador.
}
export const ANO_DIREITO_ADQUIRIDO_FIM = 2045
export const ANO_CORTE_GRANDFATHER = 2023  // instalações até 2022 = grandfathered

/**
 * Retorna o percentual de Fio B aplicável em um ano-calendário.
 * @param {number} anoCalendario
 * @param {object} opts
 * @param {number} opts.anoInstalacao
 * @param {boolean} [opts.grandfathered] — força direito adquirido
 * @param {boolean} [opts.fioBAplicavel=true] — modalidade isenta (ex.: GD sem injeção)
 */
export function percentualFioB(anoCalendario, { anoInstalacao, grandfathered, fioBAplicavel = true } = {}) {
  if (!fioBAplicavel) return 0
  const isGrand = grandfathered ?? (n(anoInstalacao, anoCalendario) < ANO_CORTE_GRANDFATHER)
  if (isGrand && anoCalendario <= ANO_DIREITO_ADQUIRIDO_FIM) return 0

  if (anoCalendario < 2023) return 0
  if (CRONOGRAMA_FIO_B[anoCalendario] != null) return CRONOGRAMA_FIO_B[anoCalendario]
  return 1.0 // 2029 em diante
}

// ─── Modalidades de GD ───────────────────────────────────────────────────────────
export const GD_MODALIDADES = {
  GD_I: {
    label: 'GD I',
    descricao: 'Até 500 kW — micro/minigeração no local de consumo.',
    fioBAplicavel: true,
    fatorCompensacaoPadrao: 1.0,
  },
  GD_II: {
    label: 'GD II',
    descricao: 'De 500 kW a 1 MW — Fio B aplicável conforme cronograma.',
    fioBAplicavel: true,
    fatorCompensacaoPadrao: 1.0,
  },
  GD_III: {
    label: 'GD III',
    descricao: 'Acima de 1 MW — regras específicas e maior incidência de encargos.',
    fioBAplicavel: true,
    fatorCompensacaoPadrao: 0.9,
  },
}

export function getModalidadeGD(id) {
  return GD_MODALIDADES[id] || GD_MODALIDADES.GD_I
}

// ─── Premissas regulatórias normalizadas (congeláveis) ──────────────────────────
export function construirPremissasRegulatorias(p = {}) {
  const modalidade = p.modalidade || 'GD_I'
  const cfgMod = getModalidadeGD(modalidade)
  const anoInstalacao = n(p.anoInstalacao, new Date().getFullYear())
  return {
    lei: '14.300/2022',
    modalidade,
    modalidade_descricao: cfgMod.descricao,
    ano_instalacao: anoInstalacao,
    grandfathered: p.grandfathered ?? (anoInstalacao < ANO_CORTE_GRANDFATHER),
    fio_b_aplicavel: p.fioBAplicavel ?? cfgMod.fioBAplicavel,
    fator_compensacao: p.fatorCompensacao ?? cfgMod.fatorCompensacaoPadrao,   // 0..1
    simultaneidade: p.simultaneidade ?? 0.30,                                  // fração autoconsumida instantânea
    tipo_ligacao: p.tipoLigacao || 'monofasico',
    custo_disponibilidade_kwh_mes: custoDisponibilidadeKwh(p.tipoLigacao),
    tarifa_cheia_kwh: n(p.tarifaKwh, 0.95),
    // Fio B em R$/kWh: explícito OU fração da tarifa cheia (TUSD-Fio B ~28%)
    tarifa_fio_b_kwh: p.tarifaFioBKwh != null
      ? n(p.tarifaFioBKwh)
      : round2(n(p.tarifaKwh, 0.95) * n(p.fioBFracaoTarifa, 0.28)),
    reajuste_anual_pct: n(p.reajusteAnualPct, 5),
    inflacao_energia_pct: n(p.inflacaoEnergiaPct, 2),
    degradacao_anual_pct: n(p.degradacaoAnualPct, 0.5),
    horizonte_anos: n(p.anos, 25),
  }
}

// ─── Cálculo de retorno regulatório ──────────────────────────────────────────────

/**
 * Calcula o retorno financeiro REALISTA sob a Lei 14.300.
 *
 * @param {object} p
 * @param {number} p.geracaoAnualKwh   — snapshot técnico (engineering lock)
 * @param {number} p.consumoAnualKwh   — consumo da(s) UC
 * @param {number} p.precoVenda        — investimento
 * @param {object} p.premissas         — de construirPremissasRegulatorias (opcional; senão monta de p)
 * @param {Array<number>} [p.geracaoMensalKwh] — sazonalidade (12 meses); opcional
 * @param {Array<number>} [p.consumoMensalKwh] — sazonalidade (12 meses); opcional
 */
export function calcularRetornoRegulatorio(p = {}) {
  const prem = p.premissas || construirPremissasRegulatorias(p)
  const ger0 = n(p.geracaoAnualKwh)
  const consumoAnual = n(p.consumoAnualKwh, ger0) // se não informado, assume = geração
  const investimento = n(p.precoVenda)

  if (ger0 <= 0 || prem.tarifa_cheia_kwh <= 0 || investimento <= 0) {
    return { calc_possivel: false, premissas: prem }
  }

  const anos = prem.horizonte_anos
  const degr = prem.degradacao_anual_pct / 100
  const cresc = (1 + prem.reajuste_anual_pct / 100) * (1 + prem.inflacao_energia_pct / 100) - 1
  const simult = Math.min(Math.max(prem.simultaneidade, 0), 1)
  const fc = Math.min(Math.max(prem.fator_compensacao, 0), 1)

  // Sazonalidade: pesos normalizados (12) ou uniforme
  const pesosGer = normalizarPesos(p.geracaoMensalKwh)
  const fluxos = []
  const detalhe_ano1 = {}
  let acumulado = 0
  let paybackAnos = null

  // Energia autoconsumida/exportada/compensada do ano 1 (informativo)
  for (let ano = 1; ano <= anos; ano++) {
    const fatorDegr = Math.pow(1 - degr, ano - 1)
    const geracaoAno = ger0 * fatorDegr
    const tarifaAno = prem.tarifa_cheia_kwh * Math.pow(1 + cresc, ano - 1)
    const fioBAno = prem.tarifa_fio_b_kwh * Math.pow(1 + cresc, ano - 1)
    const anoCal = prem.ano_instalacao + ano - 1
    const pFioB = percentualFioB(anoCal, {
      anoInstalacao: prem.ano_instalacao,
      grandfathered: prem.grandfathered,
      fioBAplicavel: prem.fio_b_aplicavel,
    })

    // Autoconsumo instantâneo (simultaneidade), limitado ao consumo
    const autoconsumida = Math.min(geracaoAno * simult, consumoAnual)
    const excedente = Math.max(0, geracaoAno - autoconsumida)
    const consumoRestante = Math.max(0, consumoAnual - autoconsumida)
    // Energia compensável (injetada que abate consumo), sujeita a fator de compensação
    const compensada = Math.min(excedente, consumoRestante) * fc
    const credito_nao_utilizado = Math.max(0, excedente - Math.min(excedente, consumoRestante))

    const economia_autoconsumo = autoconsumida * tarifaAno
    const economia_compensacao = compensada * tarifaAno
    const custo_fio_b = compensada * fioBAno * pFioB
    const economia_liquida = economia_autoconsumo + economia_compensacao - custo_fio_b

    fluxos.push(economia_liquida)

    const antes = acumulado
    acumulado += economia_liquida
    if (paybackAnos === null && acumulado >= investimento && economia_liquida > 0) {
      paybackAnos = +((ano - 1) + (investimento - antes) / economia_liquida).toFixed(2)
    }

    if (ano === 1) {
      Object.assign(detalhe_ano1, {
        geracao_kwh: round2(geracaoAno),
        energia_autoconsumida_kwh: round2(autoconsumida),
        energia_exportada_kwh: round2(excedente),
        energia_compensada_kwh: round2(compensada),
        credito_nao_utilizado_kwh: round2(credito_nao_utilizado),
        tarifa_kwh: round2(tarifaAno),
        fio_b_kwh: round2(fioBAno),
        percentual_fio_b: pFioB,
        economia_autoconsumo: round2(economia_autoconsumo),
        economia_compensacao: round2(economia_compensacao),
        custo_fio_b: round2(custo_fio_b),
        economia_liquida: round2(economia_liquida),
      })
    }
  }

  const economia_total = round2(acumulado)
  const tir = calcularTIR([-investimento, ...fluxos])
  const custo_disponibilidade_anual = round2(prem.custo_disponibilidade_kwh_mes * 12 * prem.tarifa_cheia_kwh)

  // Perda regulatória vs cenário de compensação integral (otimista) no ano 1
  const economiaOtimistaAno1 = round2(Math.min(ger0, consumoAnual) * prem.tarifa_cheia_kwh)
  const perda_regulatoria_ano1 = round2(economiaOtimistaAno1 - detalhe_ano1.economia_liquida)

  return {
    calc_possivel: true,
    premissas: prem,
    horizonte_anos: anos,
    geracao_anual_kwh: round2(ger0),
    consumo_anual_kwh: round2(consumoAnual),
    economia_anual_1ano: detalhe_ano1.economia_liquida,
    economia_25_anos: economia_total,
    economia_total,
    payback_anos: paybackAnos,
    roi_pct: pct(economia_total - investimento, investimento),
    tir_estimada_aa_pct: tir,
    custo_disponibilidade_anual,
    detalhe_ano1,
    perda_regulatoria_ano1,
    fluxos_anuais: fluxos.map(round2),
  }
}

function normalizarPesos(arr) {
  if (!Array.isArray(arr) || arr.length !== 12) return null
  const soma = arr.reduce((s, x) => s + n(x), 0)
  if (soma <= 0) return null
  return arr.map((x) => n(x) / soma)
}

/**
 * Compara o cenário OTIMISTA (compensação integral, Sprint 4) com o REALISTA
 * (Lei 14.300). Usado na UI para mostrar a diferença ao operador/cliente.
 */
export function compararCenarios({ otimista, realista }) {
  if (!otimista?.calc_possivel || !realista?.calc_possivel) return null
  const dEcon = round2((realista.economia_25_anos || 0) - (otimista.economia_25_anos || 0))
  return {
    economia_25_otimista: otimista.economia_25_anos,
    economia_25_realista: realista.economia_25_anos,
    diferenca_25_anos: dEcon,
    diferenca_pct: pct(dEcon, otimista.economia_25_anos),
    payback_otimista: otimista.payback_anos,
    payback_realista: realista.payback_anos,
    roi_otimista: otimista.roi_pct,
    roi_realista: realista.roi_pct,
  }
}
