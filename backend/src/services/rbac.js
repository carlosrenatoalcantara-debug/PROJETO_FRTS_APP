/**
 * rbac.js — Sprint 7.2
 *
 * Matriz CENTRALIZADA de permissões (RBAC). Não espalhar permissões pelo código:
 * toda checagem deve usar `pode(perfil, modulo, acao)` ou consultar MATRIZ_RBAC.
 *
 * Níveis de ação são ordenados: visualizar < editar < aprovar < administrar.
 * Conceder um nível concede todos os inferiores.
 */

export const PERFIS = ['administrador', 'diretor', 'engenheiro', 'tecnico', 'comercial', 'financeiro', 'visualizador']

export const MODULOS = ['fv', 'ev', 'financeiro', 'crm', 'governanca', 'catalogo', 'configuracoes']

export const ACOES = ['visualizar', 'editar', 'aprovar', 'administrar']
const NIVEL = { nenhum: 0, visualizar: 1, editar: 2, aprovar: 3, administrar: 4 }

// Mapa de compatibilidade com o User legado (perfil 'admin'|'user')
export const PERFIL_LEGADO = { admin: 'administrador', user: 'comercial' }

// Matriz: perfil → { modulo: nivelMáximo }
export const MATRIZ_RBAC = {
  administrador: { fv: 'administrar', ev: 'administrar', financeiro: 'administrar', crm: 'administrar', governanca: 'administrar', catalogo: 'administrar', configuracoes: 'administrar' },
  diretor:       { fv: 'aprovar', ev: 'aprovar', financeiro: 'aprovar', crm: 'aprovar', governanca: 'aprovar', catalogo: 'editar', configuracoes: 'visualizar' },
  engenheiro:    { fv: 'editar', ev: 'editar', financeiro: 'visualizar', crm: 'visualizar', governanca: 'editar', catalogo: 'editar', configuracoes: 'visualizar' },
  tecnico:       { fv: 'editar', ev: 'editar', financeiro: 'visualizar', crm: 'visualizar', governanca: 'visualizar', catalogo: 'visualizar', configuracoes: 'visualizar' },
  comercial:     { fv: 'editar', ev: 'visualizar', financeiro: 'visualizar', crm: 'administrar', governanca: 'visualizar', catalogo: 'visualizar', configuracoes: 'visualizar' },
  financeiro:    { fv: 'visualizar', ev: 'visualizar', financeiro: 'aprovar', crm: 'visualizar', governanca: 'visualizar', catalogo: 'visualizar', configuracoes: 'visualizar' },
  visualizador:  { fv: 'visualizar', ev: 'visualizar', financeiro: 'visualizar', crm: 'visualizar', governanca: 'visualizar', catalogo: 'visualizar', configuracoes: 'nenhum' },
}

export function normalizarPerfil(perfil) {
  if (!perfil) return 'visualizador'
  if (PERFIS.includes(perfil)) return perfil
  return PERFIL_LEGADO[perfil] || 'visualizador'
}

/**
 * @returns {boolean} se o perfil pode executar `acao` no `modulo`.
 */
export function pode(perfil, modulo, acao) {
  const p = normalizarPerfil(perfil)
  const concedido = MATRIZ_RBAC[p]?.[modulo] || 'nenhum'
  return (NIVEL[concedido] || 0) >= (NIVEL[acao] || 99)
}

export const LABEL_PERFIL = {
  administrador: 'Administrador', diretor: 'Diretor', engenheiro: 'Engenheiro',
  tecnico: 'Técnico', comercial: 'Comercial', financeiro: 'Financeiro', visualizador: 'Visualizador',
}
