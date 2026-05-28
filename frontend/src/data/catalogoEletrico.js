/**
 * catalogoEletrico.js — Sprint 2 (completo)
 *
 * Parâmetros elétricos de todos os módulos e inversores do catálogo.
 * Valores baseados em datasheets reais (STC: 25°C, 1000 W/m²).
 * coef_temp_voc em 1/°C (fração absoluta — ex: −0.0028 = −0.28 %/°C).
 * impp calculado como Pmpp / Vmpp quando não declarado no datasheet.
 */

// ─── Módulos fotovoltaicos ────────────────────────────────────────────────────

export const DADOS_ELETRICOS_PAINEIS = {

  // ── Canadian Solar ──────────────────────────────────────────────────────────
  // CS6L-400MS  (P-type PERC monofacial)
  cs400: {
    voc: 41.4, vmpp: 34.2, isc: 12.28, impp: 11.70,
    potencia_w: 400, coef_temp_voc: -0.0028, temp_noct: 43,
  },
  // CS6W-550MS  (P-type PERC monofacial)
  cs550: {
    voc: 49.5, vmpp: 41.2, isc: 13.90, impp: 13.35,
    potencia_w: 550, coef_temp_voc: -0.0028, temp_noct: 43,
  },
  // CS7N-665MS  (N-type HiKu7 bifacial)
  cs665: {
    voc: 51.8, vmpp: 43.1, isc: 16.23, impp: 15.43,
    potencia_w: 665, coef_temp_voc: -0.0024, temp_noct: 42,
  },

  // ── Risen ───────────────────────────────────────────────────────────────────
  // RSM144-7-550M  (P-type PERC monofacial)
  rs550: {
    voc: 49.8, vmpp: 41.65, isc: 13.85, impp: 13.21,
    potencia_w: 550, coef_temp_voc: -0.0029, temp_noct: 44,
  },
  // RSM130-8-600BMDG  (P-type PERC bifacial)
  rs600: {
    voc: 51.2, vmpp: 43.10, isc: 14.71, impp: 13.92,
    potencia_w: 600, coef_temp_voc: -0.0028, temp_noct: 44,
  },

  // ── JA Solar ────────────────────────────────────────────────────────────────
  // JAM72S30-550MR  (P-type PERC monofacial)
  ja550: {
    voc: 49.2, vmpp: 41.10, isc: 13.87, impp: 13.38,
    potencia_w: 550, coef_temp_voc: -0.0028, temp_noct: 44,
  },
  // JAM72D42-605/LB  (N-type bifacial DeepBlue 4.0)
  ja605: {
    voc: 43.3, vmpp: 36.20, isc: 17.57, impp: 16.71,
    potencia_w: 605, coef_temp_voc: -0.0025, temp_noct: 43,
  },

  // ── Trina Solar ─────────────────────────────────────────────────────────────
  // TSM-610DE21  (P-type bifacial)
  tr610: {
    voc: 53.2, vmpp: 44.20, isc: 14.60, impp: 13.80,
    potencia_w: 610, coef_temp_voc: -0.0028, temp_noct: 43,
  },
  // TSM-670NEG21C.20  (N-type NEG bifacial)
  tr670: {
    voc: 45.2, vmpp: 38.20, isc: 18.50, impp: 17.54,
    potencia_w: 670, coef_temp_voc: -0.0024, temp_noct: 42,
  },

  // ── BYD ─────────────────────────────────────────────────────────────────────
  // BYD415H5-54E  (P-type PERC monofacial)
  byd415: {
    voc: 40.2, vmpp: 33.5, isc: 13.20, impp: 12.39,
    potencia_w: 415, coef_temp_voc: -0.0028, temp_noct: 44,
  },

  // ── LONGi ───────────────────────────────────────────────────────────────────
  // LR5-72HPH-450M  (P-type Hi-MO 5 monofacial)
  lon450: {
    voc: 44.5, vmpp: 37.10, isc: 13.80, impp: 12.13,
    potencia_w: 450, coef_temp_voc: -0.0027, temp_noct: 42,
  },
  // LR5-72HIH-580M  (P-type Hi-MO 5 monofacial)
  lon580: {
    voc: 50.6, vmpp: 42.00, isc: 14.59, impp: 13.81,
    potencia_w: 580, coef_temp_voc: -0.0027, temp_noct: 42,
  },

  // ── Jinko Solar ─────────────────────────────────────────────────────────────
  // JKM545N-72HL4  (N-type Tiger Neo monofacial)
  jk545: {
    voc: 50.4, vmpp: 42.16, isc: 13.77, impp: 12.93,
    potencia_w: 545, coef_temp_voc: -0.0025, temp_noct: 43,
  },
  // JKM620N-78HL4  (N-type Tiger Pro monofacial)
  jk620: {
    voc: 53.0, vmpp: 44.20, isc: 14.78, impp: 14.03,
    potencia_w: 620, coef_temp_voc: -0.0025, temp_noct: 43,
  },
}

// ─── Inversores ───────────────────────────────────────────────────────────────
//
// tensao_max_entrada  = Vmáx CC de entrada (V)
// mppt_min            = Vmpp mínima da faixa MPPT (V)
// mppt_max            = Vmpp máxima da faixa MPPT (V)
// corrente_max_mppt   = Imáx CC por entrada MPPT (A)
// potencia_ca_kw      = Potência nominal CA (kW)
// entradas_por_mppt   = Entradas string por MPPT (tipicamente 1 ou 2)
// oversizing_max      = Fator máximo CC/CA permitido pelo fabricante

export const DADOS_ELETRICOS_INVERSORES = {

  // ── Fronius (String) ────────────────────────────────────────────────────────
  fr5:  { tensao_max_entrada: 1000, mppt_min:  80, mppt_max: 800, corrente_max_mppt: 18.0, potencia_ca_kw:  5.0, entradas_por_mppt: 1, oversizing_max: 1.30 },
  fr8:  { tensao_max_entrada: 1000, mppt_min:  80, mppt_max: 800, corrente_max_mppt: 18.0, potencia_ca_kw:  8.2, entradas_por_mppt: 1, oversizing_max: 1.30 },
  fr20: { tensao_max_entrada: 1000, mppt_min: 200, mppt_max: 800, corrente_max_mppt: 27.0, potencia_ca_kw: 20.0, entradas_por_mppt: 2, oversizing_max: 1.30 },
  fr25: { tensao_max_entrada: 1000, mppt_min: 200, mppt_max: 800, corrente_max_mppt: 33.0, potencia_ca_kw: 25.0, entradas_por_mppt: 2, oversizing_max: 1.30 },

  // ── Sungrow String ──────────────────────────────────────────────────────────
  sg5:   { tensao_max_entrada: 1000, mppt_min:  80, mppt_max: 560, corrente_max_mppt: 25.0, potencia_ca_kw:  5.0, entradas_por_mppt: 2, oversizing_max: 1.30 },
  sg8:   { tensao_max_entrada: 1000, mppt_min:  80, mppt_max: 560, corrente_max_mppt: 25.0, potencia_ca_kw:  8.0, entradas_por_mppt: 2, oversizing_max: 1.30 },
  sg10:  { tensao_max_entrada: 1000, mppt_min:  80, mppt_max: 560, corrente_max_mppt: 25.0, potencia_ca_kw: 10.0, entradas_por_mppt: 2, oversizing_max: 1.30 },
  sg15t: { tensao_max_entrada: 1000, mppt_min: 200, mppt_max: 850, corrente_max_mppt: 25.0, potencia_ca_kw: 15.0, entradas_por_mppt: 2, oversizing_max: 1.30 },
  sg25t: { tensao_max_entrada: 1000, mppt_min: 200, mppt_max: 850, corrente_max_mppt: 25.0, potencia_ca_kw: 25.0, entradas_por_mppt: 2, oversizing_max: 1.30 },

  // ── Growatt String ──────────────────────────────────────────────────────────
  gw5s:  { tensao_max_entrada: 1000, mppt_min: 100, mppt_max: 800, corrente_max_mppt: 25.0, potencia_ca_kw:  5.0, entradas_por_mppt: 2, oversizing_max: 1.30 },
  gw5t:  { tensao_max_entrada: 1000, mppt_min: 100, mppt_max: 800, corrente_max_mppt: 25.0, potencia_ca_kw:  5.0, entradas_por_mppt: 2, oversizing_max: 1.30 },
  gw10t: { tensao_max_entrada: 1000, mppt_min: 100, mppt_max: 800, corrente_max_mppt: 25.0, potencia_ca_kw: 10.0, entradas_por_mppt: 2, oversizing_max: 1.30 },

  // ── Deye String ─────────────────────────────────────────────────────────────
  dy8:   { tensao_max_entrada:  500, mppt_min: 100, mppt_max: 450, corrente_max_mppt: 25.0, potencia_ca_kw:  8.0, entradas_por_mppt: 2, oversizing_max: 1.30 },
  dy12t: { tensao_max_entrada: 1000, mppt_min: 200, mppt_max: 850, corrente_max_mppt: 25.0, potencia_ca_kw: 12.0, entradas_por_mppt: 2, oversizing_max: 1.30 },

  // ── ABB / FIMER ─────────────────────────────────────────────────────────────
  abb4:  { tensao_max_entrada:  600, mppt_min:  70, mppt_max: 480, corrente_max_mppt: 15.0, potencia_ca_kw:  4.6, entradas_por_mppt: 1, oversizing_max: 1.25 },

  // ── WEG ─────────────────────────────────────────────────────────────────────
  weg6:  { tensao_max_entrada: 1000, mppt_min: 200, mppt_max: 800, corrente_max_mppt: 20.0, potencia_ca_kw:  6.0, entradas_por_mppt: 2, oversizing_max: 1.30 },
  weg12: { tensao_max_entrada: 1000, mppt_min: 200, mppt_max: 800, corrente_max_mppt: 20.0, potencia_ca_kw: 12.0, entradas_por_mppt: 2, oversizing_max: 1.30 },

  // ── Sungrow Híbrido ─────────────────────────────────────────────────────────
  sh5:   { tensao_max_entrada:  600, mppt_min:  40, mppt_max: 560, corrente_max_mppt: 25.0, potencia_ca_kw:  5.0, entradas_por_mppt: 2, oversizing_max: 1.30 },
  sh8:   { tensao_max_entrada:  600, mppt_min:  40, mppt_max: 560, corrente_max_mppt: 25.0, potencia_ca_kw:  8.0, entradas_por_mppt: 2, oversizing_max: 1.30 },
  sh10:  { tensao_max_entrada:  600, mppt_min:  40, mppt_max: 560, corrente_max_mppt: 25.0, potencia_ca_kw: 10.0, entradas_por_mppt: 2, oversizing_max: 1.30 },
  sh15t: { tensao_max_entrada:  800, mppt_min: 200, mppt_max: 680, corrente_max_mppt: 25.0, potencia_ca_kw: 15.0, entradas_por_mppt: 2, oversizing_max: 1.30 },

  // ── Growatt Híbrido ─────────────────────────────────────────────────────────
  sph5:  { tensao_max_entrada:  600, mppt_min:  80, mppt_max: 550, corrente_max_mppt: 20.0, potencia_ca_kw:  5.0, entradas_por_mppt: 2, oversizing_max: 1.30 },
  sph8:  { tensao_max_entrada:  600, mppt_min:  80, mppt_max: 550, corrente_max_mppt: 20.0, potencia_ca_kw:  8.0, entradas_por_mppt: 2, oversizing_max: 1.30 },

  // ── Deye Híbrido ────────────────────────────────────────────────────────────
  dh5:   { tensao_max_entrada:  500, mppt_min: 100, mppt_max: 450, corrente_max_mppt: 25.0, potencia_ca_kw:  5.0, entradas_por_mppt: 2, oversizing_max: 1.30 },
  dh8:   { tensao_max_entrada:  500, mppt_min: 100, mppt_max: 450, corrente_max_mppt: 25.0, potencia_ca_kw:  8.0, entradas_por_mppt: 2, oversizing_max: 1.30 },
  dh12t: { tensao_max_entrada:  800, mppt_min: 200, mppt_max: 700, corrente_max_mppt: 25.0, potencia_ca_kw: 12.0, entradas_por_mppt: 2, oversizing_max: 1.30 },

  // ── Goodwe Híbrido ──────────────────────────────────────────────────────────
  gw5h:  { tensao_max_entrada:  600, mppt_min: 100, mppt_max: 550, corrente_max_mppt: 25.0, potencia_ca_kw:  5.0, entradas_por_mppt: 2, oversizing_max: 1.30 },
  gw10h: { tensao_max_entrada:  600, mppt_min: 100, mppt_max: 550, corrente_max_mppt: 25.0, potencia_ca_kw: 10.0, entradas_por_mppt: 2, oversizing_max: 1.30 },

  // ── Sofar Híbrido ───────────────────────────────────────────────────────────
  sf6h:  { tensao_max_entrada:  600, mppt_min:  80, mppt_max: 550, corrente_max_mppt: 20.0, potencia_ca_kw:  6.0, entradas_por_mppt: 2, oversizing_max: 1.30 },

  // ── Microinversores ─────────────────────────────────────────────────────────
  aps400:  { tensao_max_entrada:  60, mppt_min: 16, mppt_max: 60, corrente_max_mppt: 12.0, potencia_ca_kw: 0.400, entradas_por_mppt: 1, oversizing_max: 1.25 },
  aps800:  { tensao_max_entrada:  60, mppt_min: 16, mppt_max: 60, corrente_max_mppt: 14.0, potencia_ca_kw: 0.800, entradas_por_mppt: 2, oversizing_max: 1.25 },
  enph:    { tensao_max_entrada:  53, mppt_min: 22, mppt_max: 45, corrente_max_mppt: 12.0, potencia_ca_kw: 0.366, entradas_por_mppt: 1, oversizing_max: 1.25 },
  enph8a:  { tensao_max_entrada:  53, mppt_min: 22, mppt_max: 45, corrente_max_mppt: 14.0, potencia_ca_kw: 0.384, entradas_por_mppt: 1, oversizing_max: 1.25 },

  // ── SolarEdge (Otimizador) ──────────────────────────────────────────────────
  se5k:   { tensao_max_entrada:  900, mppt_min:  12, mppt_max: 800, corrente_max_mppt: 17.0, potencia_ca_kw:  5.0, entradas_por_mppt: 1, oversizing_max: 1.55 },
  se7k:   { tensao_max_entrada:  900, mppt_min:  12, mppt_max: 800, corrente_max_mppt: 17.0, potencia_ca_kw:  7.6, entradas_por_mppt: 1, oversizing_max: 1.55 },
  se20k:  { tensao_max_entrada: 1000, mppt_min:  12, mppt_max: 900, corrente_max_mppt: 30.0, potencia_ca_kw: 20.0, entradas_por_mppt: 1, oversizing_max: 1.55 },

  // ── Off-Grid / Victron ──────────────────────────────────────────────────────
  vic24_3: { tensao_max_entrada: 150, mppt_min: 25, mppt_max: 150, corrente_max_mppt: 30.0, potencia_ca_kw: 3.0, entradas_por_mppt: 1, oversizing_max: 1.25 },
  vic48_5: { tensao_max_entrada: 150, mppt_min: 48, mppt_max: 150, corrente_max_mppt: 30.0, potencia_ca_kw: 5.0, entradas_por_mppt: 1, oversizing_max: 1.25 },

  // ── Off-Grid / Growatt ──────────────────────────────────────────────────────
  ofg3:  { tensao_max_entrada: 500, mppt_min: 60, mppt_max: 450, corrente_max_mppt: 20.0, potencia_ca_kw: 3.0, entradas_por_mppt: 1, oversizing_max: 1.25 },
  ofg5:  { tensao_max_entrada: 500, mppt_min: 60, mppt_max: 450, corrente_max_mppt: 20.0, potencia_ca_kw: 5.0, entradas_por_mppt: 1, oversizing_max: 1.25 },

  // ── Off-Grid / Deye ─────────────────────────────────────────────────────────
  dof5:  { tensao_max_entrada: 500, mppt_min: 60, mppt_max: 450, corrente_max_mppt: 25.0, potencia_ca_kw: 5.0, entradas_por_mppt: 1, oversizing_max: 1.25 },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function dadosEletricosPainel(painel) {
  if (!painel?.id) return null
  return DADOS_ELETRICOS_PAINEIS[painel.id] ?? null
}

export function dadosEletricosInversor(inversor) {
  if (!inversor?.id) return null
  return DADOS_ELETRICOS_INVERSORES[inversor.id] ?? null
}

// ─── Clima padrão por UF ──────────────────────────────────────────────────────
// Valores conservadores. Fonte: INMET normais climatológicas 1991-2020.

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
