/**
 * catalogoEletrico.js — S2.11.1
 *
 * Parâmetros elétricos completos para os equipamentos do catálogo local.
 * Mapeia os IDs do SeletorPaineis / SeletorInversores para os dados
 * necessários pelo compatibilidadeEletricaService.
 *
 * Valores baseados em datasheets reais (STC, 25°C, 1000 W/m²).
 * coef_temp_voc em 1/°C (fração absoluta, não %/°C).
 *
 * Fórmulas de estimativa quando o datasheet não informa impp:
 *   impp ≈ Pmpp / Vmpp  (em ampères)
 */

// ─── Painéis fotovoltaicos ─────────────────────────────────────────────────────

export const DADOS_ELETRICOS_PAINEIS = {
  // Canadian Solar CS6L-400MS
  cs400: {
    voc:          41.4,
    vmpp:         34.2,
    isc:          12.28,
    impp:         11.70,   // 400 / 34.2 = 11.70
    potencia_w:   400,
    coef_temp_voc: -0.0028, // −0.28 %/°C → típico mono-PERC
    temp_noct:    43,
  },
  // Canadian Solar CS6W-550MS
  cs550: {
    voc:          49.5,
    vmpp:         41.2,
    isc:          13.90,
    impp:         13.35,   // 550 / 41.2 = 13.35
    potencia_w:   550,
    coef_temp_voc: -0.0028,
    temp_noct:    43,
  },
  // Risen RSM144-7-550M
  rs550: {
    voc:          49.8,
    vmpp:         41.65,
    isc:          13.85,
    impp:         13.21,   // 550 / 41.65 = 13.21
    potencia_w:   550,
    coef_temp_voc: -0.0029, // −0.29 %/°C — datasheet Risen 144-cell
    temp_noct:    44,
  },
  // JA Solar JAM72S30-550MR
  ja550: {
    voc:          49.2,
    vmpp:         41.1,
    isc:          13.87,
    impp:         13.38,   // 550 / 41.1 = 13.38
    potencia_w:   550,
    coef_temp_voc: -0.0028,
    temp_noct:    44,
  },
  // Trina Solar TSM-610DE21
  tr610: {
    voc:          53.2,
    vmpp:         44.2,
    isc:          14.60,
    impp:         13.80,   // 610 / 44.2 = 13.80
    potencia_w:   610,
    coef_temp_voc: -0.0028,
    temp_noct:    43,
  },
  // BYD 415H5-54E
  byd415: {
    voc:          40.2,
    vmpp:         33.5,
    isc:          13.20,
    impp:         12.39,   // 415 / 33.5 = 12.39
    potencia_w:   415,
    coef_temp_voc: -0.0028,
    temp_noct:    44,
  },
  // LONGi LR5-72HPH-450M
  lon450: {
    voc:          44.5,
    vmpp:         37.1,
    isc:          13.80,
    impp:         12.13,   // 450 / 37.1 = 12.13
    potencia_w:   450,
    coef_temp_voc: -0.0027, // −0.27 %/°C — datasheet LONGi Hi-MO 5
    temp_noct:    42,
  },
}

// ─── Inversores ───────────────────────────────────────────────────────────────

export const DADOS_ELETRICOS_INVERSORES = {
  // Fronius Primo 5.0-1 (string monofásico)
  fr5: {
    tensao_max_entrada:  1000,
    mppt_min:            80,
    mppt_max:            800,
    corrente_max_mppt:   18.0,
    potencia_ca_kw:      5.0,
  },
  // Fronius Symo 20.0-3-M (string trifásico)
  fr20: {
    tensao_max_entrada:  1000,
    mppt_min:            200,
    mppt_max:            800,
    corrente_max_mppt:   27.0,
    potencia_ca_kw:      20.0,
  },
  // Sungrow SG5.0RS (string mono)
  sg5: {
    tensao_max_entrada:  1000,
    mppt_min:            80,
    mppt_max:            560,
    corrente_max_mppt:   25.0,
    potencia_ca_kw:      5.0,
  },
  // Sungrow SG10RS (string mono)
  sg10: {
    tensao_max_entrada:  1000,
    mppt_min:            80,
    mppt_max:            560,
    corrente_max_mppt:   25.0,
    potencia_ca_kw:      10.0,
  },
  // Sungrow SG15RT (string tri)
  sg15: {
    tensao_max_entrada:  1000,
    mppt_min:            200,
    mppt_max:            800,
    corrente_max_mppt:   25.0,
    potencia_ca_kw:      15.0,
  },
  // Growatt MOD 5000TL3-LV (string tri)
  gw5: {
    tensao_max_entrada:  1000,
    mppt_min:            100,
    mppt_max:            800,
    corrente_max_mppt:   25.0,
    potencia_ca_kw:      5.0,
  },
  // Deye SUN-8K-SG01LP1 (baixa tensão, híbrido LP1)
  dy8: {
    tensao_max_entrada:  500,  // inversor low-voltage híbrido
    mppt_min:            100,
    mppt_max:            450,
    corrente_max_mppt:   25.0,
    potencia_ca_kw:      8.0,
  },
  // APsystems EZ1-M 400W (microinversor)
  aps400: {
    tensao_max_entrada:  60,
    mppt_min:            16,
    mppt_max:            60,
    corrente_max_mppt:   12.0,
    potencia_ca_kw:      0.4,
  },
  // Enphase IQ8M (microinversor)
  enph: {
    tensao_max_entrada:  53,
    mppt_min:            22,
    mppt_max:            45,
    corrente_max_mppt:   12.0,
    potencia_ca_kw:      0.366,
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve os dados elétricos completos de um painel do catálogo.
 * Retorna null se o ID não for reconhecido.
 * @param {object} painel Objeto do catálogo (precisa ter .id)
 * @returns {object|null}
 */
export function dadosEletricosPainel(painel) {
  if (!painel?.id) return null
  return DADOS_ELETRICOS_PAINEIS[painel.id] ?? null
}

/**
 * Resolve os dados elétricos completos de um inversor do catálogo.
 * Retorna null se o ID não for reconhecido.
 * @param {object} inversor Objeto do catálogo (precisa ter .id)
 * @returns {object|null}
 */
export function dadosEletricosInversor(inversor) {
  if (!inversor?.id) return null
  return DADOS_ELETRICOS_INVERSORES[inversor.id] ?? null
}

// ─── Clima padrão por UF (fallback regional mínimo) ──────────────────────────
//
// Valores conservadores para a maioria das capitais/regiões.
// Fonte: normais climatológicas INMET (1991-2020).
// Para cidades extremas (São Joaquim-SC, Campos do Jordão-SP), o usuário
// deve informar manualmente via inputs de Tmin/Tmax.

export const CLIMA_PADRAO_UF = {
  // Norte
  AM: { tmin: 20, tmax: 36 }, PA: { tmin: 20, tmax: 36 }, RR: { tmin: 20, tmax: 38 },
  AP: { tmin: 21, tmax: 35 }, TO: { tmin: 16, tmax: 38 }, RO: { tmin: 18, tmax: 38 },
  AC: { tmin: 18, tmax: 36 },
  // Nordeste
  MA: { tmin: 20, tmax: 38 }, PI: { tmin: 18, tmax: 40 }, CE: { tmin: 18, tmax: 38 },
  RN: { tmin: 18, tmax: 38 }, PB: { tmin: 18, tmax: 38 }, PE: { tmin: 18, tmax: 38 },
  AL: { tmin: 20, tmax: 36 }, SE: { tmin: 18, tmax: 36 }, BA: { tmin: 14, tmax: 38 },
  // Centro-Oeste
  MT: { tmin: 14, tmax: 38 }, MS: { tmin: 10, tmax: 38 }, GO: { tmin: 10, tmax: 38 },
  DF: { tmin:  8, tmax: 35 },
  // Sudeste
  MG: { tmin:  6, tmax: 38 }, ES: { tmin: 14, tmax: 36 }, RJ: { tmin: 14, tmax: 38 },
  SP: { tmin:  4, tmax: 36 },
  // Sul
  PR: { tmin:  0, tmax: 36 }, SC: { tmin: -4, tmax: 36 }, RS: { tmin: -4, tmax: 36 },
}
