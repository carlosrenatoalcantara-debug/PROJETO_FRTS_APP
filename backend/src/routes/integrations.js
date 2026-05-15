/**
 * 🔐 Integrations API Routes
 * Secure API key storage, retrieval, and management
 * All keys are encrypted with AES-256-GCM and stored in MongoDB
 */

import express from 'express'
import { EncryptionService, AuditLogger, ValidationService } from '../security/index.js'
import { authenticateToken, authorize, requirePermission } from '../security/auth-middleware.js'
import { ApiKey } from '../models/ApiKey.js'

const router = express.Router()
const encryptionService = new EncryptionService()
const auditLogger = new AuditLogger()

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
    const userId = req.user.sub

    // ✅ Validate inputs
    if (!integrationName?.trim()) {
      auditLogger.logSecurityThreat({
        type: 'INVALID_INTEGRATION_REQUEST',
        userId,
        details: 'Missing integrationName',
        ip: req.ip,
      })
      return res.status(400).json({
        success: false,
        error: 'integrationName é obrigatório',
        code: 'MISSING_INTEGRATION_NAME',
      })
    }

    if (!apiKey?.trim()) {
      auditLogger.logSecurityThreat({
        type: 'INVALID_API_KEY',
        userId,
        details: 'Missing or empty API key',
        ip: req.ip,
      })
      return res.status(400).json({
        success: false,
        error: 'API key não pode estar vazio',
        code: 'EMPTY_API_KEY',
      })
    }

    // ✅ Validate API key format (basic checks)
    const validIntegrations = ['GeminiVision', 'OpenAI', 'Claude', 'GoogleMaps', 'GitHub', 'Anthropic']
    if (!validIntegrations.includes(integrationName)) {
      return res.status(400).json({
        success: false,
        error: `Integração não reconhecida. Válidas: ${validIntegrations.join(', ')}`,
        code: 'INVALID_INTEGRATION',
      })
    }

    // 🔐 Encrypt the API key
    const encryptedData = encryptionService.encrypt(apiKey, userId)

    // 🔑 Generate unique key ID
    const keyId = `${integrationName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // 💾 Store encrypted key in MongoDB
    const storedKey = new ApiKey({
      keyId,
      userId,
      integrationName,
      description: description || `API key for ${integrationName}`,
      encrypted: encryptedData,
      isActive: true,
      rotationDueAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    })

    await storedKey.save()

    // 📋 Audit log
    auditLogger.logApiKeyOperation({
      operation: 'CREATE',
      userId,
      keyId,
      integrationName,
      maskedKey: apiKey.slice(-4).padStart(apiKey.length, '*'),
      ip: req.ip,
      userAgent: req.get('user-agent'),
    })

    // ✅ Return success (without exposing the actual key)
    res.json({
      success: true,
      message: 'API key armazenada com segurança',
      keyId,
      integrationName,
      maskedKey: apiKey.slice(-4).padStart(Math.min(12, apiKey.length), '*'),
      expiresAt: storedKey.rotationDueAt.toISOString(),
    })
  } catch (error) {
    auditLogger.logError(error, {
      endpoint: '/integrations/add-key',
      userId: req.user.sub,
      ip: req.ip,
    })
    next(error)
  }
})

/**
 * GET /api/integrations/keys
 * Retrieve all stored API keys for the current user (without exposing actual keys)
 */
router.get('/keys', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.sub

    // Get all keys for this user from MongoDB
    const userKeys = await ApiKey.find({
      userId,
      isActive: true,
    }).sort({ createdAt: -1 })

    // Return masked keys (last 4 chars visible)
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
    const userId = req.user.sub

    const storedKey = await ApiKey.findOne({ keyId, userId })

    // ✅ Verify ownership
    if (!storedKey) {
      auditLogger.logUnauthorizedAccess({
        userId,
        endpoint: `/integrations/keys/${keyId}`,
        reason: 'UNAUTHORIZED_KEY_ACCESS',
        ip: req.ip,
      })
      return res.status(404).json({
        success: false,
        error: 'Chave não encontrada',
        code: 'KEY_NOT_FOUND',
      })
    }

    // 🔐 Deactivate instead of delete (retention)
    storedKey.isActive = false
    storedKey.deactivatedAt = new Date()
    await storedKey.save()

    // 📋 Audit log
    auditLogger.logApiKeyOperation({
      operation: 'REVOKE',
      userId,
      keyId,
      integrationName: storedKey.integrationName,
      maskedKey: storedKey.encrypted.encryptedData.slice(-4).padStart(8, '*'),
      ip: req.ip,
    })

    res.json({
      success: true,
      message: 'API key revogada com sucesso',
      keyId,
    })
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
    const userId = req.user.sub

    const storedKey = await ApiKey.findOne({ keyId, userId })

    // ✅ Verify ownership
    if (!storedKey) {
      return res.status(404).json({
        success: false,
        error: 'Chave não encontrada',
      })
    }

    if (!newApiKey?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Nova chave de API é obrigatória',
      })
    }

    // 🔐 Encrypt new key with fresh IV and salt
    const newEncryptedData = encryptionService.encrypt(newApiKey, userId)

    // Update stored key
    storedKey.encrypted = newEncryptedData
    storedKey.rotatedAt = new Date()
    storedKey.rotationDueAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    await storedKey.save()

    // 📋 Audit log
    auditLogger.logApiKeyOperation({
      operation: 'ROTATE',
      userId,
      keyId,
      integrationName: storedKey.integrationName,
      maskedKey: newApiKey.slice(-4).padStart(8, '*'),
      ip: req.ip,
    })

    res.json({
      success: true,
      message: 'API key rotacionada com sucesso',
      keyId,
      rotationDueAt: storedKey.rotationDueAt.toISOString(),
    })
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
    const userId = req.user.sub

    const userKeys = await ApiKey.find({ userId })

    const now = new Date()
    const status = {
      totalKeys: userKeys.length,
      activeKeys: userKeys.filter(k => k.isActive).length,
      keysNeedingRotation: userKeys.filter(
        k => k.isActive && k.rotationDueAt < now
      ).length,
      integrations: userKeys
        .filter(k => k.isActive)
        .map(k => ({
          integrationName: k.integrationName,
          daysUntilRotation: Math.ceil(
            (k.rotationDueAt - now) / (1000 * 60 * 60 * 24)
          ),
          needsRotation: k.rotationDueAt < now,
        })),
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
