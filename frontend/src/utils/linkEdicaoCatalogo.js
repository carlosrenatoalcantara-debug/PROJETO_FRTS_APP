/**
 * Link que abre a edição de um equipamento no catálogo.
 * Módulo → página de Módulos; inversor string ou micro → página de Inversores.
 * Sem id não há link (não se inventa destino).
 */
export function linkEdicaoCatalogo({ tipo, id } = {}) {
  if (!id) return null
  const t = String(tipo || '').toLowerCase()
  const pagina = (t === 'modulo' || t === 'painel') ? 'modulos'
    : (t === 'inversor' || t === 'microinversor' || t === 'micro') ? 'inversores'
      : null
  if (!pagina) return null
  return `/equipamentos/${pagina}?editar=${encodeURIComponent(String(id))}`
}
