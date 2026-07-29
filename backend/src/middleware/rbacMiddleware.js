/**
 * rbacMiddleware.js — Fase 0.5 (Migração Arquitetural) · ADR-021 M-4
 *
 * Enforcement FAIL-CLOSED:
 *   - decodificarUsuario: lê o JWT e popula req.auth. Não rejeita (a rejeição é
 *     responsabilidade dos guards, que sabem o que a rota exige).
 *   - protegerModulo / verificarPermissao / verificarPerfil: exigem autenticação.
 *     Requisição anônima é REJEITADA (401).
 *   - exigirOrganizacao: exige tenant resolvido no token (403 sem ele).
 *
 * ── MUDANÇA DE COMPORTAMENTO (deliberada) ──────────────────────────────────
 * O comportamento anterior era fail-open ("compat legada"): requisição sem JWT
 * atravessava todos os guards. Isso violava M-4 — qualquer chamada anônima
 * acessava dados de qualquer organização.
 *
 * Tokens sem `empresa_id` passam a ser rejeitados. Compatibilidade com tokens
 * legados NÃO é implementada aqui — dados e credenciais legados são
 * responsabilidade do LME, nunca do Core.
 */
import JWTService from '../security/jwt.js'
import { pode, normalizarPerfil } from '../services/rbac.js'

const jwt = new JWTService()

/** Popula req.auth a partir do JWT. Não rejeita — quem rejeita são os guards. */
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
    // token ausente/inválido → segue sem req.auth; os guards rejeitam.
  }
  next()
}

const ACAO_POR_METODO = {
  GET: 'visualizar', HEAD: 'visualizar',
  POST: 'editar', PUT: 'editar', PATCH: 'editar',
  DELETE: 'administrar',
}

function negarAnonimo(res) {
  return res.status(401).json({
    erro: 'Autenticação obrigatória.',
    codigo: 'NAO_AUTENTICADO',
  })
}

/**
 * Protege um router por módulo, mapeando o método HTTP para a ação.
 * FAIL-CLOSED: anônimo → 401; sem permissão → 403.
 */
export function protegerModulo(modulo) {
  return (req, res, next) => {
    if (!req.auth) return negarAnonimo(res)
    const acao = ACAO_POR_METODO[req.method] || 'editar'
    if (pode(req.auth.perfil, modulo, acao)) return next()
    return res.status(403).json({
      erro: `Acesso negado: perfil "${req.auth.perfil}" não pode ${acao} em ${modulo}.`,
      codigo: 'RBAC_NEGADO', modulo, acao, perfil: req.auth.perfil,
    })
  }
}

/** Exige uma permissão específica (modulo, acao). FAIL-CLOSED. */
export function verificarPermissao(modulo, acao) {
  return (req, res, next) => {
    if (!req.auth) return negarAnonimo(res)
    if (pode(req.auth.perfil, modulo, acao)) return next()
    return res.status(403).json({
      erro: `Sem permissão (${acao} em ${modulo}).`,
      codigo: 'RBAC_NEGADO', perfil: req.auth.perfil,
    })
  }
}

/** Exige um dos perfis informados. FAIL-CLOSED. */
export function verificarPerfil(...perfis) {
  return (req, res, next) => {
    if (!req.auth) return negarAnonimo(res)
    if (perfis.includes(req.auth.perfil)) return next()
    return res.status(403).json({
      erro: 'Perfil não autorizado.',
      codigo: 'RBAC_PERFIL', perfil: req.auth.perfil,
    })
  }
}

/**
 * Exige organização (tenant) resolvida no token — M-4.
 * Aplicar em rotas que tocam Aggregate Roots do escopo TENANT.
 */
export function exigirOrganizacao(req, res, next) {
  if (!req.auth) return negarAnonimo(res)
  if (req.auth.empresa_id == null) {
    return res.status(403).json({
      erro: 'Token sem organização — acesso a dados de negócio bloqueado (M-4).',
      codigo: 'TENANT_AUSENTE',
    })
  }
  return next()
}
