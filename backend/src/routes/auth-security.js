/**
 * 🔐 Secure Authentication Routes
 * JWT + bcrypt + Rate Limiting + Audit Logging
 */

import express from 'express'
import mongoose from 'mongoose'
import { JWTService, AuditLogger, ValidationService } from '../security/index.js'
import { createRateLimiter, authenticateToken } from '../security/auth-middleware.js'
import User from '../models/User.js'
import { hashToken } from '../services/mailService.js'

const router = express.Router()
const jwtService = new JWTService()
const auditLogger = new AuditLogger()

// Rate limiting for login (5 attempts per 15 minutes)
const loginLimiter = createRateLimiter(5, 15 * 60 * 1000)

/**
 * POST /auth/login
 * Login com email e senha
 */
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body

    // ✅ Validar entrada
    if (!ValidationService.isValidEmail(email) || !password) {
      auditLogger.logAuthFailure({
        email: email || 'invalid',
        reason: 'INVALID_INPUT',
        ip: req.ip,
        userAgent: req.get('user-agent'),
      })
      return res.status(400).json({
        success: false,
        error: 'Email e senha são obrigatórios',
        code: 'INVALID_INPUT',
      })
    }

    // ✅ Validar força da senha
    const passwordValidation = ValidationService.validatePassword(password)
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Senha fraca. Requer: 12+ chars, maiúscula, minúscula, número, caractere especial',
        feedback: passwordValidation.feedback,
        code: 'WEAK_PASSWORD',
      })
    }

    // 🔔 TODO: Buscar usuário no MongoDB
    // const user = await User.findOne({ email })
    // if (!user || !user.isActive) {
    //   auditLogger.logAuthFailure({ email, reason: 'USER_NOT_FOUND', ip: req.ip })
    //   return res.status(401).json({ error: 'Credenciais inválidas' })
    // }

    // Para demo: aceitar usuário de teste
    let user = null
    if (email === 'demo@fortesolar.com.br' && password === 'DemoPass123!') {
      user = {
        id: 'demo-user-001',
        email: 'demo@fortesolar.com.br',
        nome: 'Usuário Demo',
        role: 'operator',
        permissions: ['read:crm', 'write:proposal', 'read:equipment'],
        isActive: true,
      }
    } else if (email === 'admin@fortesolar.com.br' && password === 'AdminPass123!') {
      user = {
        id: 'admin-user-001',
        email: 'admin@fortesolar.com.br',
        nome: 'Administrador',
        role: 'admin',
        permissions: ['*'],
        isActive: true,
      }
    } else {
      auditLogger.logAuthFailure({
        email,
        reason: 'INVALID_CREDENTIALS',
        ip: req.ip,
        userAgent: req.get('user-agent'),
      })
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas',
        code: 'INVALID_CREDENTIALS',
      })
    }

    // ✅ Gerar tokens
    const { accessToken, refreshToken, expiresIn } = jwtService.generateTokenPair({
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    })

    // 📋 Log de sucesso
    auditLogger.logAuthSuccess({
      userId: user.id,
      email: user.email,
      method: 'password',
      ip: req.ip,
      userAgent: req.get('user-agent'),
    })

    // ✅ Retornar tokens
    res.json({
      success: true,
      accessToken,
      refreshToken,
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        role: user.role,
      },
    })
  } catch (error) {
    auditLogger.logError(error, {
      endpoint: '/auth/login',
      ip: req.ip,
    })
    next(error)
  }
})

/**
 * POST /auth/refresh
 * Renovar access token usando refresh token
 */
router.post('/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token não fornecido',
        code: 'NO_REFRESH_TOKEN',
      })
    }

    // ✅ Validar refresh token
    const decoded = jwtService.verifyRefreshToken(refreshToken)

    // ✅ Gerar novo access token
    const newAccessToken = jwtService.generateAccessToken({
      sub: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions,
    })

    res.json({
      success: true,
      accessToken: newAccessToken,
      expiresIn: 900, // 15 minutos
    })
  } catch (error) {
    console.error('[AUTH] Refresh token error:', error.message)
    res.status(401).json({
      success: false,
      error: 'Refresh token inválido ou expirado',
      code: 'INVALID_REFRESH_TOKEN',
    })
  }
})

/**
 * GET /auth/verify
 * Verificar se token é válido
 */
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Token válido',
    user: {
      id: req.user.sub,
      email: req.user.email,
      role: req.user.role,
    },
  })
})

/**
 * POST /auth/logout
 * Logout (invalidar token - implementação futura com blacklist)
 */
router.post('/logout', authenticateToken, (req, res) => {
  // TODO: Adicionar token a blacklist no Redis/MongoDB
  auditLogger.logAuthSuccess({
    userId: req.user.sub,
    email: req.user.email,
    method: 'logout',
    ip: req.ip,
  })

  res.json({
    success: true,
    message: 'Logout realizado com sucesso',
  })
})

/**
 * POST /auth/redefinir-senha — P0-AUTH-MAIL-01 (público)
 * Consome o token enviado por e-mail (convite/reset) e define a nova senha.
 * Token de uso único: validado por hash, expiração e flag `usado`.
 */
router.post('/redefinir-senha', async (req, res) => {
  try {
    const { token, novaSenha } = req.body || {}
    if (!token || !novaSenha) {
      return res.status(400).json({ success: false, error: 'token e novaSenha são obrigatórios', code: 'INVALID_INPUT' })
    }
    const pwd = ValidationService.validatePassword(novaSenha)
    if (!pwd.isValid) {
      return res.status(400).json({ success: false, error: 'Senha fraca. Requer: 12+ chars, maiúscula, minúscula, número, caractere especial', feedback: pwd.feedback, code: 'WEAK_PASSWORD' })
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, error: 'Banco indisponível', code: 'DB_OFFLINE' })
    }

    const user = await User.findOne({ reset_token_hash: hashToken(token) })
    if (!user || user.reset_token_usado || !user.reset_token_expira || user.reset_token_expira < new Date()) {
      return res.status(400).json({ success: false, error: 'Link inválido ou expirado. Solicite um novo.', code: 'INVALID_TOKEN' })
    }

    user.senha_hash = novaSenha      // pre('save') do User aplica o hash bcrypt
    user.reset_token_usado = true
    user.reset_token_hash = null
    user.reset_token_expira = null
    user.ativo = true                // ativa a conta no primeiro acesso (convite)
    await user.save()

    auditLogger.logAuthSuccess({ userId: user._id.toString(), email: user.email, method: 'password_reset_consume', ip: req.ip })
    res.json({ success: true, message: 'Senha redefinida com sucesso. Você já pode entrar.' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
