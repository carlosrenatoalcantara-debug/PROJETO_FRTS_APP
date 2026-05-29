/**
 * utilizavelProjeto.js (frontend) — Sprint 8.0.1
 * Espelho das regras de liberação para engenharia (backend service).
 * Usado para exibir "Liberado ✓ / Bloqueado — Falta: …" na lista do catálogo.
 */
const num = (v) => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null }
const pick = (e, ks) => { for (const k of ks) { const v = num(e?.[k]); if (v !== null) return v } return null }

const REGRAS = {
  modulo: [
    ['Potência', (e) => pick(e, ['potencia', 'potencia_w', 'potenciaW'])],
    ['Voc', (e) => pick(e, ['voc', 'voc_v'])],
    ['Isc', (e) => pick(e, ['isc', 'isc_a'])],
    ['Coef. temperatura', (e) => pick(e, ['coef_temp_voc', 'coef_temp_pmax', 'coef_temp'])],
  ],
  inversor: [
    ['Potência', (e) => pick(e, ['potencia', 'potencia_kw', 'potencia_ca'])],
    ['MPPT', (e) => pick(e, ['mppts', 'n_mppts', 'numero_mppt'])],
    ['Corrente MPPT', (e) => pick(e, ['corrente_max_mppt', 'isc_max_mppt', 'ipv_max'])],
    ['Tensão máx CC', (e) => pick(e, ['voc_max', 'voc_max_dc', 'tensao_max_dc'])],
  ],
  carregador_ev: [
    ['Potência', (e) => pick(e, ['potencia', 'potencia_kw'])],
    ['Tensão', (e) => pick(e, ['tensao', 'tensao_v'])],
    ['Corrente', (e) => pick(e, ['corrente', 'corrente_a'])],
  ],
}

export function avaliarUtilizavel(tipo, especificacoes) {
  const regras = REGRAS[tipo] || REGRAS.modulo
  const faltando = regras.filter(([, fn]) => fn(especificacoes || {}) === null).map(([r]) => r)
  return { utilizavel: faltando.length === 0, faltando }
}
