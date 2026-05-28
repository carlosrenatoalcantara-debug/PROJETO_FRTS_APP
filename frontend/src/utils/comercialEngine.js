/**
 * comercialEngine.js — Sprint 4.2
 *
 * Motor comercial enterprise: comparação multi-cenário, comparação tecnológica
 * (micro/string/híbrido/otimizado), cenário FV+BESS (scaffolding), cenários
 * tarifários e regras de aprovação (desconto/margem/exceção).
 *
 * SEPARAÇÃO:
 *   financeiroEngine.js      → custos, markup, Price, TIR (puro)
 *   financeiroRegulatorioBR  → Lei 14.300, Fio B, compensação
 *   comercialEngine.js       → inteligência comercial multi-cenário (este)
 *
 * ENGINEERING LOCK: todos os cenários consomem geração/potência do
 * snapshot técnico congelado — nunca o state vivo do wizard.
 * Funções puras e determinísticas.
 */

import { calcularRetornoRegulatorio, construirPremissasRegulatorias } from './financeiroRegulatorioBR'

const n = (v, def = 0) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : def
}
const round2 = (v) => +(n(v)).toFixed(2)

// ─── 1. Presets de cenário financeiro ───────────────────────────────────────────
// Cada preset altera compensação, simultaneidade, Fio B, reajuste, inflação e
// degradação. CUSTOM usa exatamente o que o operador informar.
export const CENARIOS_PRESET = {
  CONSERVADOR: {
    label: 'Conservador',
    cor: 'laranja',
    params: { fatorCompensacao: 0.70, simultaneidade: 0.20, fioBFracaoTarifa: 0.32, reajusteAnualPct: 4, inflacaoEnergiaPct: 1, degradacaoAnualPct: 0.7 },
  },
  REALISTA: {
    label: 'Realista',
    cor: 'azul',
    params: { fatorCompensacao: 0.85, simultaneidade: 0.30, fioBFracaoTarifa: 0.28, reajusteAnualPct: 5, inflacaoEnergiaPct: 2, degradacaoAnualPct: 0.5 },
  },
  OTIMISTA: {
    label: 'Otimista',
    cor: 'verde',
    params: { fatorCompensacao: 1.00, simultaneidade: 0.40, fioBFracaoTarifa: 0.24, reajusteAnualPct: 7, inflacaoEnergiaPct: 3, degradacaoAnualPct: 0.4 },
  },
  CUSTOM: {
    label: 'Personalizado',
    cor: 'cinza',
    params: {},
  },
}

export function getCenarioPreset(id) {
  return CENARIOS_PRESET[id] || CENARIOS_PRESET.REALISTA
}

// ─── 2. Comparação de cenários financeiros ──────────────────────────────────────

/**
 * Roda o motor regulatório para cada cenário e devolve os indicadores lado a lado.
 *
 * @param {object} p
 * @param {object} p.snapshotTecnico   — { sistema.potenciaCC, geracao_anual_kwh }
 * @param {number} p.precoVenda
 * @param {number} p.consumoAnualKwh
 * @param {string} p.tipoLigacao
 * @param {object} p.base              — premissas-base (tarifa, ano, modalidade, custom)
 * @param {string[]} [p.cenarios]      — ids a comparar
 */
export function compararCenariosFinanceiros({
  snapshotTecnico, precoVenda, consumoAnualKwh, tipoLigacao,
  base = {}, cenarios = ['CONSERVADOR', 'REALISTA', 'OTIMISTA'],
}) {
  const geracao = n(snapshotTecnico?.geracao_anual_kwh)
  const consumo = n(consumoAnualKwh, geracao)

  const resultados = cenarios.map((id) => {
    const preset = getCenarioPreset(id)
    const params = id === 'CUSTOM' ? (base.custom || {}) : preset.params
    const premissas = construirPremissasRegulatorias({
      anoInstalacao: base.anoInstalacao,
      modalidade: base.modalidade || 'GD_I',
      tipoLigacao,
      tarifaKwh: base.tarifaKwh,
      ...params,
    })
    const retorno = calcularRetornoRegulatorio({
      geracaoAnualKwh: geracao, consumoAnualKwh: consumo, precoVenda, premissas,
    })
    return {
      id,
      label: preset.label,
      cor: preset.cor,
      premissas,
      economia_anual: retorno.calc_possivel ? retorno.economia_anual_1ano : null,
      economia_25_anos: retorno.calc_possivel ? retorno.economia_25_anos : null,
      payback_anos: retorno.calc_possivel ? retorno.payback_anos : null,
      roi_pct: retorno.calc_possivel ? retorno.roi_pct : null,
      tir_pct: retorno.calc_possivel ? retorno.tir_estimada_aa_pct : null,
      lucro_25_anos: retorno.calc_possivel ? round2(retorno.economia_25_anos - precoVenda) : null,
    }
  })

  return { gerado_em: new Date().toISOString(), preco_venda: round2(precoVenda), cenarios: resultados }
}

// ─── 3. Comparação tecnológica ──────────────────────────────────────────────────
// Fatores relativos típicos (parametrizáveis). Aplicados sobre custo e geração
// para comparar arquiteturas de inversor sem exigir engenharia completa de cada.
export const TECNOLOGIAS = {
  string: {
    label: 'String',
    fator_custo: 1.00, ganho_geracao_pct: 0, manutencao: 'Baixa', redundancia: 'Baixa',
    nota: 'Padrão de mercado; melhor custo-benefício em telhados uniformes.',
  },
  micro: {
    label: 'Microinversor',
    fator_custo: 1.28, ganho_geracao_pct: 6, manutencao: 'Muito baixa', redundancia: 'Alta',
    nota: 'Otimização por módulo; ideal para sombreamento e múltiplas águas.',
  },
  hibrido: {
    label: 'Híbrido',
    fator_custo: 1.18, ganho_geracao_pct: 2, manutencao: 'Média', redundancia: 'Média',
    nota: 'Permite acoplar baterias (BESS) com backup.',
  },
  otimizado: {
    label: 'String + Otimizador',
    fator_custo: 1.15, ganho_geracao_pct: 4, manutencao: 'Baixa', redundancia: 'Média-alta',
    nota: 'Mitiga sombreamento mantendo arquitetura string.',
  },
}

/**
 * Compara arquiteturas de inversor a partir de um custo-base e geração-base.
 */
export function compararTecnologias({ custoBase, geracaoAnualBase, tarifaKwh = 0.95, tecnologias = ['string', 'micro', 'hibrido', 'otimizado'] }) {
  return tecnologias.map((id) => {
    const t = TECNOLOGIAS[id] || TECNOLOGIAS.string
    const custo = round2(n(custoBase) * t.fator_custo)
    const geracao = round2(n(geracaoAnualBase) * (1 + t.ganho_geracao_pct / 100))
    const economiaAno = round2(geracao * n(tarifaKwh))
    const payback = economiaAno > 0 ? +(custo / economiaAno).toFixed(2) : null
    return {
      id, label: t.label,
      custo, geracao_anual_kwh: geracao,
      ganho_geracao_pct: t.ganho_geracao_pct,
      economia_anual: economiaAno,
      payback_anos: payback,
      manutencao: t.manutencao, redundancia: t.redundancia, nota: t.nota,
    }
  })
}

// ─── 4. Cenário FV vs FV+BESS (scaffolding) ─────────────────────────────────────

/**
 * Estima o impacto de adicionar BESS. Engenharia de baterias completa virá depois;
 * aqui modelamos custo adicional, autonomia de backup e economia por peak shaving.
 */
export function cenarioBESS({
  precoBaseFV, geracaoAnualKwh, tarifaKwh = 0.95,
  capacidadeKwh = 0, custoPorKwh = 3500, consumoMedioDiarioKwh = 0,
  economiaPeakShavingPct = 0,
}) {
  const custoBateria = round2(n(capacidadeKwh) * n(custoPorKwh))
  const precoComBess = round2(n(precoBaseFV) + custoBateria)
  const autonomiaHoras = consumoMedioDiarioKwh > 0
    ? +((n(capacidadeKwh) / (n(consumoMedioDiarioKwh) / 24)).toFixed(1))
    : null
  const economiaAnualFV = round2(n(geracaoAnualKwh) * n(tarifaKwh))
  const economiaPeakShaving = round2(economiaAnualFV * (n(economiaPeakShavingPct) / 100))

  return {
    fv: { preco: round2(n(precoBaseFV)), backup: false, economia_anual: economiaAnualFV },
    fv_bess: {
      preco: precoComBess,
      custo_bateria: custoBateria,
      capacidade_kwh: round2(capacidadeKwh),
      backup: capacidadeKwh > 0,
      autonomia_horas: autonomiaHoras,
      economia_anual: round2(economiaAnualFV + economiaPeakShaving),
      economia_peak_shaving: economiaPeakShaving,
    },
    observacao: 'Estimativa comercial — engenharia de baterias detalhada em sprint futura.',
  }
}

// ─── 5. Cenários tarifários ──────────────────────────────────────────────────────
export const CENARIOS_TARIFARIOS = {
  inflacao_baixa:    { label: 'Inflação baixa',     reajusteAnualPct: 3, inflacaoEnergiaPct: 1 },
  inflacao_alta:     { label: 'Inflação alta',      reajusteAnualPct: 8, inflacaoEnergiaPct: 4 },
  aneel_conservadora:{ label: 'ANEEL conservadora', reajusteAnualPct: 4, inflacaoEnergiaPct: 1.5, fioBFracaoTarifa: 0.32 },
  aneel_agressiva:   { label: 'ANEEL agressiva',    reajusteAnualPct: 6, inflacaoEnergiaPct: 3, fioBFracaoTarifa: 0.24 },
}

export function compararCenariosTarifarios({ snapshotTecnico, precoVenda, consumoAnualKwh, tipoLigacao, base = {}, cenarios = Object.keys(CENARIOS_TARIFARIOS) }) {
  const geracao = n(snapshotTecnico?.geracao_anual_kwh)
  return cenarios.map((id) => {
    const cfg = CENARIOS_TARIFARIOS[id] || CENARIOS_TARIFARIOS.inflacao_baixa
    const premissas = construirPremissasRegulatorias({
      anoInstalacao: base.anoInstalacao, modalidade: base.modalidade || 'GD_I',
      tipoLigacao, tarifaKwh: base.tarifaKwh,
      fatorCompensacao: base.fatorCompensacao ?? 0.85,
      simultaneidade: base.simultaneidade ?? 0.30,
      ...cfg,
    })
    const r = calcularRetornoRegulatorio({ geracaoAnualKwh: geracao, consumoAnualKwh: n(consumoAnualKwh, geracao), precoVenda, premissas })
    return {
      id, label: cfg.label,
      economia_25_anos: r.calc_possivel ? r.economia_25_anos : null,
      payback_anos: r.calc_possivel ? r.payback_anos : null,
      roi_pct: r.calc_possivel ? r.roi_pct : null,
    }
  })
}

// ─── 6. Regras de aprovação comercial ────────────────────────────────────────────

/**
 * Avalia se a proposta precisa de aprovação gerencial.
 * @param {object} p
 * @param {number} p.descontoPct
 * @param {number} p.descontoLimitePct
 * @param {number} p.margemLiquidaPct
 * @param {number} p.margemMinimaPct
 */
export function avaliarAprovacao({ descontoPct = 0, descontoLimitePct = 10, margemLiquidaPct = null, margemMinimaPct = 8 }) {
  const exigencias = []
  if (n(descontoPct) > n(descontoLimitePct)) {
    exigencias.push({
      tipo: 'aprovacao_desconto',
      motivo: `Desconto de ${descontoPct}% acima do limite de ${descontoLimitePct}%.`,
      severidade: 'alto',
    })
  }
  if (margemLiquidaPct != null && n(margemLiquidaPct) < n(margemMinimaPct)) {
    exigencias.push({
      tipo: 'aprovacao_margem',
      motivo: `Margem líquida de ${margemLiquidaPct}% abaixo do mínimo de ${margemMinimaPct}%.`,
      severidade: 'critico',
    })
  }
  return {
    requer_aprovacao: exigencias.length > 0,
    exigencias,
    // exceção: desconto >> limite (mais de 1.5×)
    requer_excecao: n(descontoPct) > n(descontoLimitePct) * 1.5,
  }
}
