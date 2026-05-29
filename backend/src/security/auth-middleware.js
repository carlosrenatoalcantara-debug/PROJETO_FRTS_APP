/**
 * Middleware de Autenticação & Autorização
 * Valida JWT e gerencia acesso baseado em roles
 */

import JWTService from './jwt.js';

const jwtService = new JWTService();

/**
 * Middleware: Valida JWT token
 * Requer: Authorization: Bearer <token>
 */
export const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = jwtService.extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token não fornecido',
        code: 'NO_TOKEN',
      });
    }

    const decoded = jwtService.verifyAccessToken(token);
    req.user = decoded;

    // Log de sucesso em auditoria (opcional)
    console.log(`[AUTH] Usuário ${decoded.sub} autenticado`);

    next();
  } catch (error) {
    console.error('[AUTH ERROR]', error.message);

    if (error.message.includes('expirado')) {
      return res.status(401).json({
        success: false,
        error: 'Token expirado',
        code: 'TOKEN_EXPIRED',
      });
    }

    return res.status(403).json({
      success: false,
      error: 'Token inválido',
      code: 'INVALID_TOKEN',
    });
  }
};

/**
 * Middleware: Valida permissões do usuário (RBAC)
 * @param {string[]} allowedRoles - Roles permitidas
 * @returns {Function} Middleware
 */
export const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado',
      });
    }

    const userRole = req.user.role || 'user';

    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      console.warn(`[AUTHZ] Usuário ${req.user.sub} tentou acessar recurso com role ${userRole}`);

      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        code: 'FORBIDDEN',
        requiredRoles: allowedRoles,
        userRole: userRole,
      });
    }

    next();
  };
};

/**
 * Middleware: Valida permissões específicas
 * @param {string[]} requiredPermissions - Permissões necessárias
 * @returns {Function} Middleware
 */
export const requirePermission = (requiredPermissions = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado',
      });
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = requiredPermissions.every((perm) => userPermissions.includes(perm));

    if (!hasPermission) {
      console.warn(
        `[AUTHZ] Usuário ${req.user.sub} sem permissão ${requiredPermissions.join(', ')}`
      );

      return res.status(403).json({
        success: false,
        error: 'Permissão insuficiente',
        code: 'INSUFFICIENT_PERMISSION',
        requiredPermissions,
      });
    }

    next();
  };
};

/**
 * Middleware: Valida propriedade do recurso
 * Garante que usuário só acessa seus próprios recursos
 * @param {string} userIdField - Campo que contém ID do usuário no recurso
 * @returns {Function} Middleware
 */
export const verifyResourceOwnership = (userIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    // Verificar se o recurso pertence ao usuário
    const resourceUserId = req.body[userIdField] || req.params[userIdField];

    if (resourceUserId && resourceUserId !== req.user.sub) {
      console.warn(
        `[AUTHZ] Usuário ${req.user.sub} tentou acessar recurso de ${resourceUserId}`
      );

      return res.status(403).json({
        success: false,
        error: 'Acesso negado - recurso não pertence ao usuário',
      });
    }

    next();
  };
};

/**
 * Middleware: Rate limiting por IP
 * Protege contra brute force
 */
export const createRateLimiter = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!attempts.has(ip)) {
      attempts.set(ip, []);
    }

    // Limpar tentativas antigas
    const ips = attempts.get(ip).filter((time) => now - time < windowMs);
    attempts.set(ip, ips);

    if (ips.length >= maxAttempts) {
      console.warn(`[RATE_LIMIT] IP ${ip} excedeu limite de tentativas`);

      return res.status(429).json({
        success: false,
        error: 'Muitas tentativas. Tente novamente em 15 minutos.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((ips[0] + windowMs - now) / 1000),
      });
    }

    ips.push(now);
    attempts.set(ip, ips);

    next();
  };
};

/**
 * Middleware: CSRF Protection (tokens)
 * Previne ataques Cross-Site Request Forgery
 */
export const csrfProtection = (req, res, next) => {
  const csrfToken = req.body._csrf || req.headers['x-csrf-token'];

  if (!csrfToken) {
    return res.status(403).json({
      success: false,
      error: 'CSRF token inválido',
      code: 'INVALID_CSRF_TOKEN',
    });
  }

  // Verificar CSRF token na sessão/armazenamento
  // Implementar com store de sessão (Redis, memória, etc)

  next();
};

/**
 * Middleware: Logging de auditoria
 * Registra todas as ações críticas
 */
// S7.3: deriva o módulo a partir do path (para filtros de auditoria)
function _moduloDoPath(p = '') {
  if (p.includes('/projetos-fv')) return 'fv'
  if (p.includes('/projetos-ev')) return 'ev'
  if (p.includes('/financeiro')) return 'financeiro'
  if (p.includes('/crm')) return 'crm'
  if (p.includes('/governanca')) return 'governanca'
  if (p.includes('/catalogo') || p.includes('/equipamentos')) return 'catalogo'
  if (p.includes('/gestao') || p.includes('/empresa') || p.includes('/configuracoes')) return 'configuracoes'
  return 'outro'
}

// S7.3: grava a entrada de auditoria (lazy import p/ evitar ciclos; só se Mongo on)
async function persistirAuditoria(entry, req) {
  try {
    const mongoose = (await import('mongoose')).default
    if (mongoose.connection.readyState !== 1) return
    const { AuditLog } = await import('../models/AuditLog.js')
    await AuditLog.create({
      timestamp: entry.timestamp, usuario: entry.userId, perfil: entry.perfil,
      empresa: entry.empresa, modulo: _moduloDoPath(req.path), acao: req.method,
      metodo: req.method, path: req.path, status: entry.statusCode, ip: entry.ip,
    })
  } catch { /* silencioso */ }
}

export const auditLogger = (req, res, next) => {
  const startTime = Date.now();

  // Interceptar resposta
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - startTime;

    const auditEntry = {
      timestamp: new Date().toISOString(),
      userId: req.auth?.id || req.user?.sub || 'anonymous',
      // S7.2.1: trilha enriquecida com perfil e empresa
      perfil: req.auth?.perfil || req.user?.role || null,
      empresa: req.auth?.empresa_id || null,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      statusCode: res.statusCode,
      duration: duration,
    };

    // Logar eventos críticos
    if (res.statusCode >= 400 || ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      console.log('[AUDIT]', JSON.stringify(auditEntry));
      // S7.3: persiste a trilha (consultável). Não-bloqueante e tolerante a falha.
      persistirAuditoria(auditEntry, req).catch(() => {});
    }

    res.send = originalSend;
    return res.send(data);
  };

  next();
};

export default {
  authenticateToken,
  authorize,
  requirePermission,
  verifyResourceOwnership,
  createRateLimiter,
  csrfProtection,
  auditLogger,
};
