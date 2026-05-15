/**
 * Exemplo de Integração de Segurança com Express
 * Mostra como usar todos os módulos de segurança juntos
 */

import express from 'express';
import { configDotenv } from 'dotenv';

// Importar módulos de segurança
import { setupSecurityHeaders, secureErrorHandler } from './security-headers.js';
import {
  authenticateToken,
  authorize,
  createRateLimiter,
  auditLogger,
} from './auth-middleware.js';
import JWTService from './jwt.js';
import EncryptionService from './encryption.js';
import ApiKeyService from './api-key-service.js';
import ValidationService from './validation.js';
import AuditLogger from './audit-logger.js';

// Carregar variáveis de ambiente
configDotenv();

// Instâncias de serviços
const jwtService = new JWTService();
const encryptionService = new EncryptionService();
const apiKeyService = new ApiKeyService();
const auditLoggerService = new AuditLogger();

const app = express();

/**
 * ==================== CONFIGURAÇÃO DE SEGURANÇA ====================
 */

// 1. Middleware de headers de segurança
setupSecurityHeaders(app, {
  maxRequestSize: '5mb',
});

// 2. Parsing de JSON
app.use(express.json({ limit: '5mb' }));

// 3. Audit logging middleware
app.use(auditLogger);

// 4. Rate limiting global
app.use(createRateLimiter(100, 10 * 60 * 1000)); // 100 req/10min

/**
 * ==================== ROTAS PÚBLICAS ====================
 */

/**
 * Health check (sem autenticação)
 */
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Login
 * POST /auth/login
 * Body: { email, password }
 */
app.post('/auth/login', createRateLimiter(5, 15 * 60 * 1000), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validar entrada
    if (!ValidationService.isValidEmail(email)) {
      auditLoggerService.logAuthFailure({
        email,
        reason: 'INVALID_EMAIL',
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.status(400).json({
        success: false,
        error: 'Email inválido',
      });
    }

    // TODO: Buscar usuário no BD
    // const user = await User.findOne({ email });
    // if (!user) throw new Error('Usuário não encontrado');

    // TODO: Verificar senha
    // const isValidPassword = await encryptionService.verifyPassword(password, user.passwordHash);
    // if (!isValidPassword) throw new Error('Senha incorreta');

    // Simular usuário para exemplo
    const user = {
      id: 'user123',
      email: email,
      role: 'user',
      permissions: ['read:profile', 'write:data'],
    };

    // Gerar tokens
    const { accessToken, refreshToken } = jwtService.generateTokenPair(user);

    // Log sucesso
    auditLoggerService.logAuthSuccess({
      userId: user.id,
      email: user.email,
      method: 'password',
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Retornar tokens (usar httpOnly cookies em produção)
    res.json({
      success: true,
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    auditLoggerService.logError(error, {
      endpoint: '/auth/login',
      ip: req.ip,
    });

    next(error);
  }
});

/**
 * Refresh token
 * POST /auth/refresh
 * Body: { refreshToken }
 */
app.post('/auth/refresh', (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token não fornecido',
      });
    }

    const decoded = jwtService.verifyRefreshToken(refreshToken);

    // Gerar novo access token
    const newAccessToken = jwtService.generateAccessToken({
      sub: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions,
    });

    res.json({
      success: true,
      accessToken: newAccessToken,
      expiresIn: 900,
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Refresh token inválido',
    });
  }
});

/**
 * ==================== ROTAS PROTEGIDAS ====================
 */

/**
 * Obter perfil do usuário
 * GET /api/user/profile
 * Requer: Authorization: Bearer <token>
 */
app.get('/api/user/profile', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.sub,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

/**
 * Adicionar chave de API
 * POST /api/integrations/add-key
 * Requer: Authorization: Bearer <token>
 * Body: { integrationName, apiKey, apiSecret }
 */
app.post('/api/integrations/add-key', authenticateToken, async (req, res, next) => {
  try {
    const { integrationName, apiKey, apiSecret } = req.body;
    const userId = req.user.sub;

    // Validar entrada
    if (!integrationName || !apiKey) {
      return res.status(400).json({
        success: false,
        error: 'integrationName e apiKey são obrigatórios',
      });
    }

    if (!apiKeyService.isValidApiKeyFormat(apiKey)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de API key inválido',
      });
    }

    // Criptografar e armazenar
    const encrypted = apiKeyService.encryptApiKey({
      userId,
      integrationName,
      apiKey,
      apiSecret,
    });

    // TODO: Salvar no BD
    // await ApiKey.create(encrypted);

    // Log da operação
    auditLoggerService.logApiKeyOperation({
      userId,
      action: 'CREATE',
      integration: integrationName,
      maskedKey: apiKeyService.maskKey(apiKey),
    });

    res.json({
      success: true,
      message: 'Chave de API adicionada com sucesso',
      integration: integrationName,
    });
  } catch (error) {
    auditLoggerService.logError(error, {
      endpoint: '/api/integrations/add-key',
      userId: req.user.sub,
    });

    next(error);
  }
});

/**
 * Listar chaves de API do usuário
 * GET /api/integrations/keys
 * Requer: Authorization: Bearer <token>
 */
app.get('/api/integrations/keys', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.sub;

    // TODO: Buscar chaves do BD
    // const keys = await ApiKey.find({ userId, isActive: true });

    // Simular resposta
    const keys = [
      {
        integrationName: 'SolarAPI',
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        rotationDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        // NÃO incluir a chave real
      },
    ];

    res.json({
      success: true,
      keys,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Revogar chave de API
 * DELETE /api/integrations/keys/:keyId
 * Requer: Authorization: Bearer <token>
 */
app.delete('/api/integrations/keys/:keyId', authenticateToken, async (req, res, next) => {
  try {
    const { keyId } = req.params;
    const userId = req.user.sub;

    // TODO: Buscar e validar chave
    // const key = await ApiKey.findOne({ _id: keyId, userId });
    // if (!key) throw new Error('Chave não encontrada');

    // TODO: Revogar chave
    // await ApiKey.updateOne({ _id: keyId }, { isActive: false, revokedAt: new Date() });

    auditLoggerService.logApiKeyOperation({
      userId,
      action: 'REVOKE',
      integration: 'SolarAPI', // Em produção pegar da DB
      maskedKey: '****xxxx',
    });

    res.json({
      success: true,
      message: 'Chave de API revogada com sucesso',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Endpoint administrativo - Relatório de Segurança
 * GET /api/admin/security-report
 * Requer: Authorization: Bearer <token> + role='admin'
 */
app.get(
  '/api/admin/security-report',
  authenticateToken,
  authorize(['admin']),
  (req, res, next) => {
    try {
      const report = auditLoggerService.getSecurityReport(7);

      res.json({
        success: true,
        report,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * ==================== ERROR HANDLING ====================
 */

// 404 Not Found
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Rota não encontrada',
    path: req.path,
  });
});

// Error handler (deve ser o último)
app.use(secureErrorHandler);

/**
 * ==================== INICIALIZAR SERVIDOR ====================
 */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Servidor seguro rodando em http://localhost:${PORT}`);
  console.log('📋 Modules:');
  console.log('  - JWT Authentication');
  console.log('  - API Key Encryption (AES-256-GCM)');
  console.log('  - Rate Limiting & Brute Force Protection');
  console.log('  - Audit Logging');
  console.log('  - Security Headers (Helmet.js)');
  console.log('  - CORS Protection');
  console.log('  - Input Validation & Sanitization');
});

export default app;
