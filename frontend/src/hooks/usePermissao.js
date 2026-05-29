import { useAuth } from '../context/AuthContext'
import { pode as podeRbac } from '../utils/rbac'

/**
 * usePermissao — Sprint 7.2.1
 *
 * Gating de UI por RBAC. COMPATIBILIDADE: enquanto não há usuário autenticado
 * (fase legada sem login), libera tudo (perfil 'administrador'). Quando houver
 * usuário com perfil, aplica a matriz central.
 */
export function usePermissao() {
  const { user } = useAuth()
  const perfil = user?.perfil || user?.role || null
  // Sem usuário logado → acesso total (legado). Com usuário → respeita a matriz.
  const anonimo = !user
  return {
    perfil,
    anonimo,
    pode: (modulo, acao = 'visualizar') => (anonimo ? true : podeRbac(perfil, modulo, acao)),
  }
}
