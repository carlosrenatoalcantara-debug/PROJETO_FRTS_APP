/**
 * fabricanteQuery.js — P1-CATALOG-NORMALIZE-FABRICANTES-01
 *
 * Busca de equipamento por fabricante que casa o nome bruto, o `fabricante_canonico` E os
 * `aliases` — assim "OSDA" e "OSDA Solar" retornam os mesmos equipamentos. Não destrutivo.
 */

const esc = s => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Monta o filtro Mongo para buscar por fabricante (bruto | canônico | alias).
 * @param {string} termo  termo digitado (ex.: "OSDA" ou "OSDA Solar")
 * @param {boolean} [exato=false]  match exato (^termo$) em vez de "contém"
 * @returns {object} filtro Mongo (`$or`)
 */
export function queryFabricante(termo, exato = false) {
  const t = (termo || '').trim()
  if (!t) return {}
  const rx = { $regex: exato ? `^${esc(t)}$` : esc(t), $options: 'i' }
  return { $or: [{ fabricante: rx }, { fabricante_canonico: rx }, { aliases: rx }] }
}

/** True se o equipamento pertence ao fabricante (bruto/canônico/alias). Útil em memória. */
export function ehDoFabricante(eq, termo) {
  const t = (termo || '').trim().toUpperCase()
  if (!t) return false
  const campos = [eq?.fabricante, eq?.fabricante_canonico, ...(eq?.aliases || [])]
  return campos.some(c => (c || '').toUpperCase().includes(t))
}
