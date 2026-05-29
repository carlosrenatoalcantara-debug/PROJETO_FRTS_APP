/**
 * rbac.js (frontend) — Sprint 7.2
 * Espelho da matriz central do backend (services/rbac.js). Usar pode() na UI
 * para esconder/desabilitar ações conforme o perfil.
 */
export const PERFIS = ['administrador', 'diretor', 'engenheiro', 'tecnico', 'comercial', 'financeiro', 'visualizador']
export const MODULOS = ['fv', 'ev', 'financeiro', 'crm', 'governanca', 'catalogo', 'configuracoes']
export const ACOES = ['visualizar', 'editar', 'aprovar', 'administrar']
const NIVEL = { nenhum: 0, visualizar: 1, editar: 2, aprovar: 3, administrar: 4 }

export const LABEL_PERFIL = {
  administrador: 'Administrador', diretor: 'Diretor', engenheiro: 'Engenheiro',
  tecnico: 'Técnico', comercial: 'Comercial', financeiro: 'Financeiro', visualizador: 'Visualizador',
}
const PERFIL_LEGADO = { admin: 'administrador', user: 'comercial' }

export const MATRIZ_RBAC = {
  administrador: { fv: 'administrar', ev: 'administrar', financeiro: 'administrar', crm: 'administrar', governanca: 'administrar', catalogo: 'administrar', configuracoes: 'administrar' },
  diretor:       { fv: 'aprovar', ev: 'aprovar', financeiro: 'aprovar', crm: 'aprovar', governanca: 'aprovar', catalogo: 'editar', configuracoes: 'visualizar' },
  engenheiro:    { fv: 'editar', ev: 'editar', financeiro: 'visualizar', crm: 'visualizar', governanca: 'editar', catalogo: 'editar', configuracoes: 'visualizar' },
  tecnico:       { fv: 'editar', ev: 'editar', financeiro: 'visualizar', crm: 'visualizar', governanca: 'visualizar', catalogo: 'visualizar', configuracoes: 'visualizar' },
  comercial:     { fv: 'editar', ev: 'visualizar', financeiro: 'visualizar', crm: 'administrar', governanca: 'visualizar', catalogo: 'visualizar', configuracoes: 'visualizar' },
  financeiro:    { fv: 'visualizar', ev: 'visualizar', financeiro: 'aprovar', crm: 'visualizar', governanca: 'visualizar', catalogo: 'visualizar', configuracoes: 'visualizar' },
  visualizador:  { fv: 'visualizar', ev: 'visualizar', financeiro: 'visualizar', crm: 'visualizar', governanca: 'visualizar', catalogo: 'visualizar', configuracoes: 'nenhum' },
}

export function normalizarPerfil(p) {
  if (!p) return 'visualizador'
  if (PERFIS.includes(p)) return p
  return PERFIL_LEGADO[p] || 'visualizador'
}
export function pode(perfil, modulo, acao) {
  const concedido = MATRIZ_RBAC[normalizarPerfil(perfil)]?.[modulo] || 'nenhum'
  return (NIVEL[concedido] || 0) >= (NIVEL[acao] || 99)
}
