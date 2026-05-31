/**
 * catalogoFlags.js — Sprint CAT-P0-UNIFY (FASE 4)
 *
 * Feature flags do catálogo. Default = true (mantém comportamento atual de
 * contingência). Permite desligar fontes paralelas via env para validar a
 * limpeza (CAT-CLEAN-01) sem que fallbacks mascarem o estado real.
 *
 * Uso de env (string 'false' desliga; qualquer outra coisa = true):
 *   ENABLE_INVERSORES_DATA=false
 *   ENABLE_PAINEIS_DATA=false
 *   ENABLE_CARREGADOR_EV_FALLBACK=false
 */
function _flag(nome, padrao = true) {
  const v = process.env[nome]
  if (v === undefined || v === null || v === '') return padrao
  return String(v).toLowerCase() !== 'false'
}

export const catalogoFlags = {
  // Fallback do wizard FV para INVERSORES_DATA hardcoded (SeletorInversores.jsx)
  get ENABLE_INVERSORES_DATA() { return _flag('ENABLE_INVERSORES_DATA') },
  // Fallback do wizard FV para PAINEIS_DATA hardcoded (SeletorPaineis.jsx)
  get ENABLE_PAINEIS_DATA() { return _flag('ENABLE_PAINEIS_DATA') },
  // Fallback do controller para a coleção legada CarregadorEV
  get ENABLE_CARREGADOR_EV_FALLBACK() { return _flag('ENABLE_CARREGADOR_EV_FALLBACK') },
}

/** Snapshot de todas as flags (para o endpoint de diagnóstico). */
export function snapshotFlags() {
  return {
    ENABLE_INVERSORES_DATA: catalogoFlags.ENABLE_INVERSORES_DATA,
    ENABLE_PAINEIS_DATA: catalogoFlags.ENABLE_PAINEIS_DATA,
    ENABLE_CARREGADOR_EV_FALLBACK: catalogoFlags.ENABLE_CARREGADOR_EV_FALLBACK,
  }
}
