/**
 * 🌞 Motor de Dimensionamento Fotovoltaico — funções puras
 *
 * Sem dependências de banco, request ou estado externo.
 * Tudo determinístico e testável isoladamente.
 *
 * Referências normativas:
 *  - ANEEL REN 482/2012 (atualizada por Lei 14.300/2022) — GD I, II, III
 *  - INMET / CRESESB — irradiância (HSP — horas de sol pleno)
 *  - ABNT NBR 16690:2019 — instalações solares fotovoltaicas
 *
 * Convenções:
 *  - Potência em kWp
 *  - Energia em kWh
 *  - Irradiância em kWh/m²·dia (= HSP em h/dia para superfície inclinada otimizada)
 *  - Tarifa em R$/kWh
 *  - Perdas em fração (0.18 = 18%)
 */

import { obterIrradianciaCity, obterIrradianciaFallback } from '../data/irradianciaRN.js'

// ─── Constantes de referência ────────────────────────────────────────────────
const POT_MODULO_REF_W = 550          // potência típica em catálogos atuais (Wp)
const AREA_MODULO_REF_M2 = 2.4        // 2278 × 1134 mm aproximado
const DIAS_MES = 30
const ANOS_PROJETO = 25
const DEGRADACAO_ANUAL_PCT = 0.5      // 0.5%/ano (NBR + datasheet típico)
const FATOR_OCUPACAO_TELHADO = 1.4    // área total incluindo afastamentos

// Defaults sugeridos (podem ser sobrescritos pelo input)
export const DEFAULTS = {
  perdas_pct: 18,                // perdas totais: cabeamento + sujeira + temp + mismatch + inversor
  margem_pct: 10,                // sobre-dimensionamento de segurança
  fator_simultaneidade: 1.0,     // GD II: 1.0 (consumo = geração)
  tarifa_kwh: 0.95,              // tarifa média BR (R$) — fallback se não vier da fatura
  inflacao_energia_aa: 0.06,     // 6% a.a. inflação histórica COSERN
  custo_kwp_instalado_r: 4500,   // R$/kWp instalado (turn-key, ref. mercado nacional 2025-2026)
  taxa_desconto_aa: 0.10,        // 10% a.a. — custo de oportunidade (CDI ref)
}

// ─── Helpers internos ────────────────────────────────────────────────────────

function round(n, casas = 2) {
  return Number(n.toFixed(casas))
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

/**
 * Resolve irradiância (kWh/m²·dia) a partir de cidade/estado ou usa fallback.
 * Não falha — sempre retorna um valor sensato.
 */
export function resolverIrradiancia({ cidade, estado, irradiancia_override } = {}) {
  if (irradiancia_override && irradiancia_override > 0) return irradiancia_override
  const local = obterIrradianciaCity?.(cidade, estado) || null
  if (local && local > 0) return local
  return obterIrradianciaFallback?.(estado) || 5.0  // BR median ~5.0
}

// ─── 1. Cálculo da potência necessária ───────────────────────────────────────

/**
 * Calcula a potência fotovoltaica em kWp necessária para atender o consumo informado.
 *
 * Fórmula:  kWp = (consumo_mensal_kwh × (1 + margem)) / (HSP × dias_mes × (1 - perdas))
 *
 * @param {Object} input
 * @param {number} input.consumo_mensal_kwh
 * @param {number} input.irradiancia_kwh_m2_dia  (HSP)
 * @param {number} [input.perdas_pct=18]
 * @param {number} [input.margem_pct=10]
 * @returns {number} potência em kWp (2 casas)
 */
export function calcularPotenciaKwp({
  consumo_mensal_kwh,
  irradiancia_kwh_m2_dia,
  perdas_pct = DEFAULTS.perdas_pct,
  margem_pct = DEFAULTS.margem_pct,
}) {
  if (!consumo_mensal_kwh || consumo_mensal_kwh <= 0) return 0
  if (!irradiancia_kwh_m2_dia || irradiancia_kwh_m2_dia <= 0) return 0

  const perdas = clamp(perdas_pct, 0, 50) / 100
  const margem = clamp(margem_pct, 0, 50) / 100

  const consumo_com_margem = consumo_mensal_kwh * (1 + margem)
  const energia_disponivel_por_kwp = irradiancia_kwh_m2_dia * DIAS_MES * (1 - perdas)

  const kwp = consumo_com_margem / energia_disponivel_por_kwp
  return round(kwp)
}

// ─── 2. Geração estimada ─────────────────────────────────────────────────────

/**
 * Geração mensal estimada (kWh) dado kWp instalado.
 */
export function calcularGeracaoMensal({
  potencia_kwp,
  irradiancia_kwh_m2_dia,
  perdas_pct = DEFAULTS.perdas_pct,
}) {
  if (!potencia_kwp) return 0
  const perdas = clamp(perdas_pct, 0, 50) / 100
  return round(potencia_kwp * irradiancia_kwh_m2_dia * DIAS_MES * (1 - perdas))
}

/**
 * Geração anual (kWh) — 12 meses sem variação sazonal nesta fase.
 * (Iteração futura: incluir perfil mensal por região INMET.)
 */
export function calcularGeracaoAnual(args) {
  return round(calcularGeracaoMensal(args) * 12)
}

/**
 * Geração ao longo da vida útil (25 anos) considerando degradação anual.
 */
export function calcularGeracao25Anos(args) {
  const geracao_y1 = calcularGeracaoAnual(args)
  let total = 0
  for (let ano = 0; ano < ANOS_PROJETO; ano++) {
    total += geracao_y1 * Math.pow(1 - DEGRADACAO_ANUAL_PCT / 100, ano)
  }
  return round(total)
}

// ─── 3. Dimensionamento físico (módulos e área) ──────────────────────────────

/**
 * Quantidade estimada de módulos para atingir o kWp (com referência de potência).
 * @param {number} potencia_kwp
 * @param {number} [pot_modulo_w] potência do módulo escolhido (padrão 550W)
 */
export function calcularQtdModulos(potencia_kwp, pot_modulo_w = POT_MODULO_REF_W) {
  if (!potencia_kwp) return 0
  return Math.ceil((potencia_kwp * 1000) / pot_modulo_w)
}

/**
 * Área ocupada estimada (m²) — inclui fator de ocupação (afastamentos NBR).
 */
export function calcularAreaOcupacao(qtd_modulos, area_modulo_m2 = AREA_MODULO_REF_M2) {
  return round(qtd_modulos * area_modulo_m2 * FATOR_OCUPACAO_TELHADO)
}

// ─── 4. Financeiro ───────────────────────────────────────────────────────────

/**
 * Economia anual estimada (R$).
 *  - GD II/B: economia = geração × tarifa (compensação 1:1, descontando custo disponibilidade)
 *  - simplificado: ignora taxa fio B progressiva (Lei 14.300) nesta fase
 */
export function calcularEconomiaAnual({ geracao_anual_kwh, tarifa_kwh }) {
  const tarifa = tarifa_kwh || DEFAULTS.tarifa_kwh
  return round(geracao_anual_kwh * tarifa)
}

/**
 * Custo total estimado do sistema (R$).
 */
export function calcularCustoSistema(potencia_kwp, custo_kwp = DEFAULTS.custo_kwp_instalado_r) {
  return round(potencia_kwp * custo_kwp)
}

/**
 * Economia acumulada em 25 anos considerando degradação e inflação tarifária.
 */
export function calcularEconomia25Anos({
  geracao_anual_y1,
  tarifa_kwh = DEFAULTS.tarifa_kwh,
  inflacao_aa = DEFAULTS.inflacao_energia_aa,
}) {
  let total = 0
  for (let ano = 0; ano < ANOS_PROJETO; ano++) {
    const geracao_ano = geracao_anual_y1 * Math.pow(1 - DEGRADACAO_ANUAL_PCT / 100, ano)
    const tarifa_ano = tarifa_kwh * Math.pow(1 + inflacao_aa, ano)
    total += geracao_ano * tarifa_ano
  }
  return round(total)
}

/**
 * Payback simples (anos): custo / economia_anual_média_real
 * Usa economia média considerando inflação da tarifa no horizonte de 25 anos.
 */
export function calcularPayback({ custo_total, geracao_anual_y1, tarifa_kwh, inflacao_aa }) {
  if (!custo_total || custo_total <= 0) return 0
  const economia25 = calcularEconomia25Anos({ geracao_anual_y1, tarifa_kwh, inflacao_aa })
  const economia_media = economia25 / ANOS_PROJETO
  if (economia_media <= 0) return 0
  return round(custo_total / economia_media, 1)
}

/**
 * Valor Presente Líquido (VPL/NPV) — fluxo descontado.
 */
export function calcularVPL({
  custo_total,
  geracao_anual_y1,
  tarifa_kwh = DEFAULTS.tarifa_kwh,
  inflacao_aa = DEFAULTS.inflacao_energia_aa,
  taxa_desconto_aa = DEFAULTS.taxa_desconto_aa,
}) {
  let vpl = -custo_total
  for (let ano = 1; ano <= ANOS_PROJETO; ano++) {
    const geracao = geracao_anual_y1 * Math.pow(1 - DEGRADACAO_ANUAL_PCT / 100, ano - 1)
    const tarifa = tarifa_kwh * Math.pow(1 + inflacao_aa, ano - 1)
    const fluxo = geracao * tarifa
    vpl += fluxo / Math.pow(1 + taxa_desconto_aa, ano)
  }
  return round(vpl)
}

/**
 * TIR (Taxa Interna de Retorno) — aproximação por bisseção.
 * Retorna fração (0.15 = 15% a.a.) ou null se não convergir.
 */
export function calcularTIR({
  custo_total,
  geracao_anual_y1,
  tarifa_kwh = DEFAULTS.tarifa_kwh,
  inflacao_aa = DEFAULTS.inflacao_energia_aa,
}) {
  if (!custo_total || custo_total <= 0) return null

  const vplPara = (taxa) => {
    let v = -custo_total
    for (let ano = 1; ano <= ANOS_PROJETO; ano++) {
      const g = geracao_anual_y1 * Math.pow(1 - DEGRADACAO_ANUAL_PCT / 100, ano - 1)
      const t = tarifa_kwh * Math.pow(1 + inflacao_aa, ano - 1)
      v += (g * t) / Math.pow(1 + taxa, ano)
    }
    return v
  }

  let lo = 0.0001, hi = 1.5
  if (vplPara(lo) < 0) return null    // fluxo nunca positivo
  if (vplPara(hi) > 0) return null    // TIR > 150% improvável (sanity)

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    const v = vplPara(mid)
    if (Math.abs(v) < 1) return round(mid, 4)
    if (v > 0) lo = mid; else hi = mid
  }
  return round((lo + hi) / 2, 4)
}

// ─── 5. Orquestração — Dimensionamento completo ──────────────────────────────

/**
 * Roda o pipeline completo de dimensionamento.
 * Função idempotente, pura, sem efeitos colaterais.
 *
 * @param {Object} input
 * @param {number} input.consumo_mensal_kwh — obrigatório
 * @param {string} [input.cidade]
 * @param {string} [input.estado]
 * @param {number} [input.irradiancia_kwh_m2_dia] — override manual
 * @param {number} [input.perdas_pct]
 * @param {number} [input.margem_pct]
 * @param {number} [input.tarifa_kwh]
 * @param {number} [input.pot_modulo_w] — se já escolheu o módulo
 * @param {number} [input.custo_kwp_instalado_r]
 * @param {'microinversor'|'string'|'hibrido'|'offgrid'} [input.tipo_sistema='string']
 * @returns {Object} resultado completo
 */
export function dimensionarFV(input = {}) {
  const {
    consumo_mensal_kwh,
    cidade,
    estado,
    irradiancia_kwh_m2_dia: irrOverride,
    perdas_pct = DEFAULTS.perdas_pct,
    margem_pct = DEFAULTS.margem_pct,
    tarifa_kwh = DEFAULTS.tarifa_kwh,
    pot_modulo_w = POT_MODULO_REF_W,
    custo_kwp_instalado_r = DEFAULTS.custo_kwp_instalado_r,
    tipo_sistema = 'string',
    inflacao_energia_aa = DEFAULTS.inflacao_energia_aa,
    taxa_desconto_aa = DEFAULTS.taxa_desconto_aa,
  } = input

  // 0. Validação básica
  if (!consumo_mensal_kwh || consumo_mensal_kwh <= 0) {
    return {
      erro: 'consumo_mensal_kwh é obrigatório e deve ser > 0',
      codigo: 'INPUT_INVALIDO',
    }
  }

  // 1. Irradiância
  const irradiancia = resolverIrradiancia({
    cidade, estado, irradiancia_override: irrOverride,
  })

  // 2. Potência
  const potencia_kwp = calcularPotenciaKwp({
    consumo_mensal_kwh,
    irradiancia_kwh_m2_dia: irradiancia,
    perdas_pct,
    margem_pct,
  })

  // 3. Geração
  const geracao_mensal_kwh = calcularGeracaoMensal({
    potencia_kwp, irradiancia_kwh_m2_dia: irradiancia, perdas_pct,
  })
  const geracao_anual_kwh = round(geracao_mensal_kwh * 12)
  const geracao_25anos_kwh = calcularGeracao25Anos({
    potencia_kwp, irradiancia_kwh_m2_dia: irradiancia, perdas_pct,
  })

  // 4. Físico
  const qtd_modulos_estimada = calcularQtdModulos(potencia_kwp, pot_modulo_w)
  const area_ocupacao_m2 = calcularAreaOcupacao(qtd_modulos_estimada)

  // 5. Financeiro
  const custo_total_r = calcularCustoSistema(potencia_kwp, custo_kwp_instalado_r)
  const economia_anual_r = calcularEconomiaAnual({
    geracao_anual_kwh, tarifa_kwh,
  })
  const economia_25anos_r = calcularEconomia25Anos({
    geracao_anual_y1: geracao_anual_kwh, tarifa_kwh,
    inflacao_aa: inflacao_energia_aa,
  })
  const payback_anos = calcularPayback({
    custo_total: custo_total_r,
    geracao_anual_y1: geracao_anual_kwh,
    tarifa_kwh,
    inflacao_aa: inflacao_energia_aa,
  })
  const vpl_r = calcularVPL({
    custo_total: custo_total_r,
    geracao_anual_y1: geracao_anual_kwh,
    tarifa_kwh,
    inflacao_aa: inflacao_energia_aa,
    taxa_desconto_aa,
  })
  const tir_aa = calcularTIR({
    custo_total: custo_total_r,
    geracao_anual_y1: geracao_anual_kwh,
    tarifa_kwh,
    inflacao_aa: inflacao_energia_aa,
  })

  return {
    sucesso: true,
    input_normalizado: {
      consumo_mensal_kwh,
      cidade: cidade || null,
      estado: estado || null,
      irradiancia_kwh_m2_dia: irradiancia,
      perdas_pct,
      margem_pct,
      tarifa_kwh,
      pot_modulo_w,
      custo_kwp_instalado_r,
      tipo_sistema,
    },
    resultado: {
      potencia_kwp,
      geracao_mensal_kwh,
      geracao_anual_kwh,
      geracao_25anos_kwh,
      qtd_modulos_estimada,
      area_ocupacao_m2,
      custo_total_r,
      economia_anual_r,
      economia_25anos_r,
      payback_anos,
      vpl_r,
      tir_aa,           // fração — multiplique por 100 para %
      tipo_sistema,
    },
    metadados: {
      versao_motor: '1.0.0',
      calculado_em: new Date().toISOString(),
      anos_projeto: ANOS_PROJETO,
      degradacao_anual_pct: DEGRADACAO_ANUAL_PCT,
    },
  }
}

export default {
  dimensionarFV,
  calcularPotenciaKwp,
  calcularGeracaoMensal,
  calcularGeracaoAnual,
  calcularGeracao25Anos,
  calcularQtdModulos,
  calcularAreaOcupacao,
  calcularEconomiaAnual,
  calcularCustoSistema,
  calcularEconomia25Anos,
  calcularPayback,
  calcularVPL,
  calcularTIR,
  resolverIrradiancia,
  DEFAULTS,
}
