/**
 * 🔐 Integrations API Routes
 * Secure API key storage, retrieval, and management
 * Falls back to memory storage when MongoDB is unavailable
 */

import express from 'express'
import mongoose from 'mongoose'
import { integrationsMemoryStore } from '../config/integrationsMemoryStore.js'
import { authenticateToken } from '../security/auth-middleware.js'
import { ApiKey } from '../models/ApiKey.js'

const router = express.Router()

// Check if MongoDB is available
const usarMemoryStorage = () => mongoose.connection.readyState !== 1

// Lazy-load security modules to avoid crashing on startup if env vars are missing
let _securityModules = null
async function loadSecurityModules() {
  if (_securityModules) return _securityModules
  try {
    const mod = await import('../security/index.js')
    _securityModules = {
      EncryptionService: mod.EncryptionService,
      AuditLogger: mod.AuditLogger
    }
  } catch (err) {
    console.warn('⚠️ Security modules not available:', err.message)
    _securityModules = { EncryptionService: null, AuditLogger: null }
  }
  return _securityModules
}

/**
 * POST /api/integrations/add-key
 * Store an encrypted API key
 *
 * Body:
 * {
 *   "integrationName": "GeminiVision|OpenAI|Claude|GoogleMaps",
 *   "apiKey": "actual-api-key-here",
 *   "description": "Optional description"
 * }
 */
router.post('/add-key', authenticateToken, async (req, res, next) => {
  try {
    const { integrationName, apiKey, description } = req.body
    const userId = req.user?.sub || 'user-anonymous'

    // ✅ Validate inputs
    if (!integrationName?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'integrationName é obrigatório',
        code: 'MISSING_INTEGRATION_NAME',
      })
    }

    if (!apiKey?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'API key não pode estar vazio',
        code: 'EMPTY_API_KEY',
      })
    }

    // ✅ Validate API key format
    const validIntegrations = ['GeminiVision', 'OpenAI', 'Claude', 'GoogleMaps', 'GitHub', 'Anthropic']
    if (!validIntegrations.includes(integrationName)) {
      return res.status(400).json({
        success: false,
        error: `Integração não reconhecida. Válidas: ${validIntegrations.join(', ')}`,
        code: 'INVALID_INTEGRATION',
      })
    }

    // 💾 Store API key
    if (usarMemoryStorage()) {
      console.log('⚠️ MongoDB offline - Armazenando chave em memória')
      const storedKey = integrationsMemoryStore.addKey(userId, integrationName, apiKey, description)

      res.json({
        success: true,
        message: 'API key armazenada com segurança (memory store)',
        keyId: storedKey.keyId,
        integrationName,
        maskedKey: apiKey.slice(-4).padStart(Math.min(12, apiKey.length), '*'),
        expiresAt: storedKey.rotationDueAt,
      })
    } else {
      // MongoDB storage (original implementation)
      const { EncryptionService, AuditLogger } = await loadSecurityModules()

      if (!EncryptionService || !AuditLogger) {
        console.error('❌ Módulos de segurança não disponíveis - usando memory storage como fallback')
        const storedKey = integrationsMemoryStore.addKey(userId, integrationName, apiKey, description)
        return res.json({
          success: true,
          message: 'API key armazenada com segurança (memory store)',
          keyId: storedKey.keyId,
          integrationName,
          maskedKey: apiKey.slice(-4).padStart(Math.min(12, apiKey.length), '*'),
          expiresAt: storedKey.rotationDueAt,
        })
      }

      let encryptionService = null
      let auditLogger = null

      try {
        encryptionService = new EncryptionService()
        auditLogger = new AuditLogger()
      } catch (err) {
        console.error('❌ Erro ao instanciar serviços de segurança, usando memory storage:', err.message)
        const storedKey = integrationsMemoryStore.addKey(userId, integrationName, apiKey, description)
        return res.json({
          success: true,
          message: 'API key armazenada com segurança (memory store)',
          keyId: storedKey.keyId,
          integrationName,
          maskedKey: apiKey.slice(-4).padStart(Math.min(12, apiKey.length), '*'),
          expiresAt: storedKey.rotationDueAt,
        })
      }

      const encryptedData = encryptionService.encrypt(apiKey, userId)
      const keyId = `${integrationName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const storedKey = new ApiKey({
        keyId,
        userId,
        integrationName,
        description: description || `API key for ${integrationName}`,
        encrypted: encryptedData,
        isActive: true,
        rotationDueAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      })

      await storedKey.save()

      auditLogger.logApiKeyOperation({
        operation: 'CREATE',
        userId,
        keyId,
        integrationName,
        maskedKey: apiKey.slice(-4).padStart(apiKey.length, '*'),
        ip: req.ip,
        userAgent: req.get('user-agent'),
      })

      res.json({
        success: true,
        message: 'API key armazenada com segurança',
        keyId,
        integrationName,
        maskedKey: apiKey.slice(-4).padStart(Math.min(12, apiKey.length), '*'),
        expiresAt: storedKey.rotationDueAt.toISOString(),
      })
    }
  } catch (error) {
    console.error('[INTEGRATIONS] Error adding key:', error.message)
    res.status(500).json({
      success: false,
      error: 'Erro ao adicionar chave',
      code: 'ADD_KEY_ERROR',
    })
  }
})

/**
 * GET /api/integrations/keys
 * Retrieve all stored API keys for the current user (without exposing actual keys)
 */
router.get('/keys', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.sub || 'user-anonymous'

    // Get keys from appropriate storage
    if (usarMemoryStorage()) {
      console.log('⚠️ MongoDB offline - Buscando chaves em memória')
      const userKeys = integrationsMemoryStore.getKeysByUserId(userId)

      const maskedKeys = userKeys.map(key => ({
        keyId: key.keyId,
        integrationName: key.integrationName,
        description: key.description,
        maskedKey: `****${key.encrypted.encryptedValue.slice(-4)}`,
        createdAt: key.createdAt,
        lastUsed: key.lastUsed,
        isActive: key.isActive,
        rotationDueAt: key.rotationDueAt,
        daysUntilRotation: Math.ceil(
          (new Date(key.rotationDueAt) - new Date()) / (1000 * 60 * 60 * 24)
        ),
      }))

      res.json({
        success: true,
        count: maskedKeys.length,
        keys: maskedKeys,
      })
    } else {
      // MongoDB storage (original)
      const userKeys = await ApiKey.find({
        userId,
        isActive: true,
      }).sort({ createdAt: -1 })

      const maskedKeys = userKeys.map(key => ({
        keyId: key.keyId,
        integrationName: key.integrationName,
        description: key.description,
        maskedKey: `****${key.encrypted.encryptedData.slice(-4)}`,
        createdAt: key.createdAt.toISOString(),
        lastUsed: key.lastUsed?.toISOString() || null,
        isActive: key.isActive,
        rotationDueAt: key.rotationDueAt.toISOString(),
        daysUntilRotation: Math.ceil(
          (key.rotationDueAt - new Date()) / (1000 * 60 * 60 * 24)
        ),
      }))

      res.json({
        success: true,
        count: maskedKeys.length,
        keys: maskedKeys,
      })
    }
  } catch (error) {
    console.error('[INTEGRATIONS] Error getting keys:', error.message)
    res.status(500).json({
      success: false,
      error: 'Erro ao recuperar chaves',
      code: 'FETCH_KEYS_ERROR',
    })
  }
})

/**
 * DELETE /api/integrations/keys/:keyId
 * Revoke (deactivate) an API key
 * Does not delete it - maintains 90-day retention for audit
 */
router.delete('/keys/:keyId', authenticateToken, async (req, res) => {
  try {
    const { keyId } = req.params
    const userId = req.user?.sub || 'user-anonymous'

    if (usarMemoryStorage()) {
      console.log('⚠️ MongoDB offline - Revogando chave em memória')
      const success = integrationsMemoryStore.revokeKey(keyId, userId)

      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Chave não encontrada',
          code: 'KEY_NOT_FOUND',
        })
      }

      res.json({
        success: true,
        message: 'API key revogada com sucesso',
        keyId,
      })
    } else {
      // MongoDB storage (original)
      const storedKey = await ApiKey.findOne({ keyId, userId })

      if (!storedKey) {
        return res.status(404).json({
          success: false,
          error: 'Chave não encontrada',
          code: 'KEY_NOT_FOUND',
        })
      }

      storedKey.isActive = false
      storedKey.deactivatedAt = new Date()
      await storedKey.save()

      res.json({
        success: true,
        message: 'API key revogada com sucesso',
        keyId,
      })
    }
  } catch (error) {
    console.error('[INTEGRATIONS] Error revoking key:', error.message)
    res.status(500).json({
      success: false,
      error: 'Erro ao revogar chave',
      code: 'REVOKE_KEY_ERROR',
    })
  }
})

/**
 * GET /api/integrations/keys/:keyId/decrypt
 * Internal endpoint to decrypt an API key (only for backend use)
 * NOT exposed in frontend - used by other backend services
 */
router.get('/keys/:keyId/decrypt', authenticateToken, async (req, res) => {
  try {
    const { keyId } = req.params
    const userId = req.user.sub

    // Get key from appropriate storage
    if (usarMemoryStorage()) {
      console.log('⚠️ MongoDB offline - Descriptografando chave de memória')
      const decryptedKey = integrationsMemoryStore.decryptKey(keyId, userId)

      if (!decryptedKey) {
        return res.status(404).json({
          success: false,
          error: 'Chave não encontrada ou revogada',
        })
      }

      res.json({
        success: true,
        keyId,
        apiKey: decryptedKey,
      })
    } else {
      // MongoDB storage (original)
      const storedKey = await ApiKey.findOne({ keyId, userId })

      // ✅ Verify ownership
      if (!storedKey) {
        return res.status(404).json({
          success: false,
          error: 'Chave não encontrada',
        })
      }

      if (!storedKey.isActive) {
        return res.status(410).json({
          success: false,
          error: 'Chave foi revogada',
        })
      }

      // 🔓 Decrypt the key
      const encryptionService = new EncryptionService()
      const decryptedKey = encryptionService.decrypt(storedKey.encrypted, userId)

      // Update last used timestamp and access count
      storedKey.lastUsed = new Date()
      storedKey.accessCount = (storedKey.accessCount || 0) + 1
      storedKey.lastAccessIp = req.ip
      await storedKey.save()

      // 📋 Log access
      auditLogger.logApiKeyOperation({
        operation: 'ACCESS',
        userId,
        keyId,
        integrationName: storedKey.integrationName,
        maskedKey: decryptedKey.slice(-4).padStart(8, '*'),
        ip: req.ip,
      })

      // Return decrypted key (only to authenticated user)
      res.json({
        success: true,
        keyId,
        integrationName: storedKey.integrationName,
        apiKey: decryptedKey,
      })
    }
  } catch (error) {
    console.error('[INTEGRATIONS] Error decrypting key:', error.message)
    res.status(500).json({
      success: false,
      error: 'Erro ao descriptografar chave',
    })
  }
})

/**
 * PUT /api/integrations/keys/:keyId/rotate
 * Rotate an API key (generates new encryption with new IV/salt)
 */
router.put('/keys/:keyId/rotate', authenticateToken, async (req, res) => {
  try {
    const { keyId } = req.params
    const { newApiKey } = req.body
    const userId = req.user?.sub || 'user-anonymous'

    if (!newApiKey?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Nova chave de API é obrigatória',
      })
    }

    if (usarMemoryStorage()) {
      console.log('⚠️ MongoDB offline - Rotacionando chave em memória')
      const success = integrationsMemoryStore.rotateKey(keyId, userId, newApiKey)

      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Chave não encontrada',
          code: 'KEY_NOT_FOUND',
        })
      }

      const key = integrationsMemoryStore.getKeyById(keyId, userId)
      res.json({
        success: true,
        message: 'API key rotacionada com sucesso',
        keyId,
        rotationDueAt: key.rotationDueAt,
      })
    } else {
      // MongoDB storage (original)
      const storedKey = await ApiKey.findOne({ keyId, userId })

      if (!storedKey) {
        return res.status(404).json({
          success: false,
          error: 'Chave não encontrada',
          code: 'KEY_NOT_FOUND',
        })
      }

      const encryptionService = new EncryptionService()
      const newEncryptedData = encryptionService.encrypt(newApiKey, userId)

      storedKey.encrypted = newEncryptedData
      storedKey.rotatedAt = new Date()
      storedKey.rotationDueAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      await storedKey.save()

      res.json({
        success: true,
        message: 'API key rotacionada com sucesso',
        keyId,
        rotationDueAt: storedKey.rotationDueAt.toISOString(),
      })
    }
  } catch (error) {
    console.error('[INTEGRATIONS] Error rotating key:', error.message)
    res.status(500).json({
      success: false,
      error: 'Erro ao rotacionar chave',
    })
  }
})

/**
 * GET /api/integrations/status
 * Check integration status and key rotation requirements
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.sub || 'user-anonymous'

    let userKeys

    // Get keys from appropriate storage
    if (usarMemoryStorage()) {
      console.log('⚠️ MongoDB offline - Verificando status em memória')
      userKeys = integrationsMemoryStore.getKeysByUserId(userId)
    } else {
      // MongoDB storage (original)
      userKeys = await ApiKey.find({ userId })
    }

    const now = new Date()
    const nowDate = usarMemoryStorage() ? now : now

    const status = {
      totalKeys: userKeys.length,
      activeKeys: userKeys.filter(k => k.isActive).length,
      keysNeedingRotation: userKeys.filter(k => {
        const rotationDue = usarMemoryStorage()
          ? new Date(k.rotationDueAt)
          : k.rotationDueAt
        return k.isActive && rotationDue < nowDate
      }).length,
      integrations: userKeys
        .filter(k => k.isActive)
        .map(k => {
          const rotationDue = usarMemoryStorage()
            ? new Date(k.rotationDueAt)
            : k.rotationDueAt
          return {
            integrationName: k.integrationName,
            daysUntilRotation: Math.ceil(
              (rotationDue - nowDate) / (1000 * 60 * 60 * 24)
            ),
            needsRotation: rotationDue < nowDate,
          }
        }),
    }

    res.json({
      success: true,
      ...status,
    })
  } catch (error) {
    console.error('[INTEGRATIONS] Error getting status:', error.message)
    res.status(500).json({
      success: false,
      error: 'Erro ao obter status',
    })
  }
})

export default router
