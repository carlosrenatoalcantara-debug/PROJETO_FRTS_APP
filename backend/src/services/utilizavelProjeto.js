/**
 * utilizavelProjeto.js — Sprint 8.0.1
 *
 * Regras de LIBERAÇÃO PARA ENGENHARIA (uso seguro no orçamento).
 * Equipamento incompleto fica no catálogo, mas não deve ser selecionável.
 * Função pura; espelhada no frontend (utils/utilizavelProjeto.js).
 */

const num = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const pick = (esp, chaves) => {
  for (const k of chaves) { const v = num(esp?.[k]); if (v !== null) return v }
  return null
}

// Campos MÍNIMOS por tipo (rótulo amigável → presença em especificacoes).
// P0-CATALOG-QUALITY-HARDENING-01: a matriz mínima é a do sprint — barra
// identity-only (sem specs do núcleo) sem super-bloquear registros parciais.
// fabricante/modelo são exigidos pelo schema (required) → sempre presentes.
const REGRAS = {
  modulo: [
    ['potencia_wp', (e) => pick(e, ['potencia', 'potencia_w', 'potenciaW', 'potencia_wp'])],
    ['voc', (e) => pick(e, ['voc', 'voc_v'])],
    ['isc', (e) => pick(e, ['isc', 'isc_a'])],
  ],
  inversor: [
    ['potencia_kw', (e) => pick(e, ['potencia', 'potencia_kw', 'potencia_ca'])],
    ['numero_mppt', (e) => pick(e, ['mppts', 'n_mppts', 'numero_mppt'])],
  ],
  bateria: [
    ['capacidade_kwh', (e) => pick(e, ['capacidade_kwh', 'capacidade', 'capacidade_kWh'])],
  ],
  // Estrutura: fabricante + modelo (topo) bastam — sem especificacoes mínimas.
  estrutura: [],
  carregador_ev: [
    ['potencia', (e) => pick(e, ['potencia', 'potencia_kw'])],
    ['tensao', (e) => pick(e, ['tensao', 'tensao_v'])],
    ['corrente', (e) => pick(e, ['corrente', 'corrente_a'])],
  ],
}

/**
 * Avalia se o equipamento cumpre a matriz mínima para uso em projeto.
 * Tipos conhecidos sem regras (estrutura) → utilizável. Tipo desconhecido →
 * não cai mais em REGRAS.modulo (evita bloqueio falso por specs de módulo).
 * @returns {{ utilizavel:boolean, faltando:string[] }}
 */
export function avaliarUtilizavel(tipo, especificacoes) {
  const regras = REGRAS[tipo] ?? []
  const faltando = regras.filter(([, fn]) => fn(especificacoes || {}) === null).map(([rotulo]) => rotulo)
  return { utilizavel: faltando.length === 0, faltando }
}

export default { avaliarUtilizavel }
