/**
 * catalogoFlags.js (frontend) — Sprint CAT-P0-UNIFY (FASE 4)
 *
 * Lê as feature flags do catálogo expostas pelo backend (/api/catalogo/flags).
 * Cacheia em memória por sessão. Default seguro = true (mantém contingência)
 * se o endpoint falhar — assim a UI nunca quebra por causa do flag.
 */
let _cache = null
let _pending = null

const PADRAO = {
  ENABLE_INVERSORES_DATA: true,
  ENABLE_PAINEIS_DATA: true,
  ENABLE_CARREGADOR_EV_FALLBACK: true,
}

export async function obterFlags() {
  if (_cache) return _cache
  if (_pending) return _pending
  _pending = fetch('/api/catalogo/flags')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      _cache = (d && d.flags) ? { ...PADRAO, ...d.flags } : { ...PADRAO }
      return _cache
    })
    .catch(() => {
      _cache = { ...PADRAO }
      return _cache
    })
    .finally(() => { _pending = null })
  return _pending
}

/** Limpa o cache (útil em testes ou após mudança de env). */
export function resetFlagsCache() { _cache = null; _pending = null }
