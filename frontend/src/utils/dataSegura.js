/**
 * dataSegura.js — Sprint 8.4
 * Helpers PUROS para nunca mostrar "Invalid Date" na UI.
 */

/** True se `d` produz uma Date com getTime() válido. */
export function isDataValida(d) {
  if (d == null) return false
  const t = new Date(d).getTime()
  return !Number.isNaN(t)
}

/**
 * Formata `d` em pt-BR (data ou data+hora). Devolve `fallback` quando inválida.
 * Uso comum substitui `new Date(x).toLocaleDateString('pt-BR')` que vazava "Invalid Date".
 */
export function formatarDataSegura(d, { fallback = '—', comHora = false } = {}) {
  if (!isDataValida(d)) return fallback
  const opts = comHora
    ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' }
  try {
    return new Date(d).toLocaleString('pt-BR', opts)
  } catch {
    return fallback
  }
}
