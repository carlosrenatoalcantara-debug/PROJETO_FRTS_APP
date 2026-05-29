/**
 * rbacMiddleware.js — Sprint 7.2.1
 *
 * Enforcement de RBAC NÃO-DESTRUTIVO:
 *   - decodificarUsuario: lê o JWT (se presente) e popula req.auth. NUNCA rejeita.
 *   - protegerModulo / verificarPermissao / verificarPerfil: só BLOQUEIAM quando
 *     há usuário autenticado. Requisições anônimas (fase legada sem login)
 *     continuam passando — preserva compatibilidade total.
 *
 * Quando o login estiver ativo em todas as telas, o enforcement passa a valer
 * automaticamente sem novas mudanças.
 */
import JWTService from '../security/jwt.js'
import { pode, normalizarPerfil } from '../services/rbac.js'

const jwt = new JWTService()

export function decodificarUsuario(req, _res, next) {
  try {
    const token = jwt.extractTokenFromHeader(req.headers['authorization'])
    if (token) {
      const d = jwt.verifyAccessToken(token)
      req.auth = {
        id: d.sub || d.id || null,
        perfil: normalizarPerfil(d.perfil || d.role),
        empresa_id: d.empresa_id || null,
        email: d.email || null,
      }
    }
  } catch {
    // token ausente/inválido → segue como anônimo (sem bloquear)
  }
  next()
}

const ACAO_POR_METODO = { GET: 'visualizar', HEAD: 'visualizar', POST: 'editar', PUT: 'editar', PATCH: 'editar', DELETE: 'administrar' }

/**
 * Protege um router inteiro por módulo, mapeando o método HTTP para a ação.
 * Anônimo passa; autenticado é checado na matriz central.
 */
export function protegerModulo(modulo) {
  return (req, res, next) => {
    if (!req.auth) return next()  // compat legada
    const acao = ACAO_POR_METODO[req.method] || 'editar'
    if (pode(req.auth.perfil, modulo, acao)) return next()
    return res.status(403).json({
      erro: `Acesso negado: perfil "${req.auth.perfil}" não pode ${acao} em ${modulo}.`,
      codigo: 'RBAC_NEGADO', modulo, acao, perfil: req.auth.perfil,
    })
  }
}

/** Exige uma permissão específica (modulo, acao). */
export function verificarPermissao(modulo, acao) {
  return (req, res, next) => {
    if (!req.auth) return next()
    if (pode(req.auth.perfil, modulo, acao)) return next()
    return res.status(403).json({ erro: `Sem permissão (${acao} em ${modulo}).`, codigo: 'RBAC_NEGADO', perfil: req.auth.perfil })
  }
}

/** Exige um dos perfis informados. */
export function verificarPerfil(...perfis) {
  return (req, res, next) => {
    if (!req.auth) return next()
    if (perfis.includes(req.auth.perfil)) return next()
    return res.status(403).json({ erro: 'Perfil não autorizado.', codigo: 'RBAC_PERFIL', perfil: req.auth.perfil })
  }
}
