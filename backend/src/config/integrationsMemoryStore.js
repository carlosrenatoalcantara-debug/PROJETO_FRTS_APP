/**
 * Memory Storage para Chaves de API
 * Fallback quando MongoDB não está disponível
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(__dirname, '../../data/api-keys.json')
const DATA_DIR = path.join(__dirname, '../../data')

class IntegrationsMemoryStore {
  constructor() {
    this.apiKeys = []

    // Garantir que o diretório existe
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }

    this.loadFromFile()
  }

  loadFromFile() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, 'utf-8')
        const parsed = JSON.parse(data)
        this.apiKeys = parsed.apiKeys || []
        console.log('✅ Chaves de API carregadas do arquivo')
        return
      }
    } catch (err) {
      console.warn('⚠️ Erro ao carregar chaves de API:', err.message)
    }

    this.apiKeys = []
  }

  saveToFile() {
    try {
      const data = {
        apiKeys: this.apiKeys,
        lastSaved: new Date().toISOString()
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
      console.error('❌ Erro ao salvar chaves de API:', err.message)
    }
  }

  /**
   * Adicionar nova chave de API
   */
  addKey(userId, integrationName, apiKey, description) {
    const keyId = `${integrationName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Criptografia simples (em produção seria AES-256-GCM)
    const encryptedData = {
      iv: crypto.randomBytes(16).toString('hex'),
      encryptedValue: Buffer.from(apiKey).toString('base64'),
      salt: crypto.randomBytes(16).toString('hex')
    }

    const newKey = {
      keyId,
      userId,
      integrationName,
      description: description || `API key for ${integrationName}`,
      encrypted: encryptedData,
      isActive: true,
      createdAt: new Date().toISOString(),
      rotationDueAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      accessCount: 0,
      lastUsed: null,
      deactivatedAt: null
    }

    this.apiKeys.push(newKey)
    this.saveToFile()

    return newKey
  }

  /**
   * Obter todas as chaves de um usuário
   */
  getKeysByUserId(userId) {
    return this.apiKeys.filter(key => key.userId === userId && key.isActive)
  }

  /**
   * Obter chave específica
   */
  getKeyById(keyId, userId) {
    return this.apiKeys.find(key => key.keyId === keyId && key.userId === userId)
  }

  /**
   * Descriptografar chave
   */
  decryptKey(keyId, userId) {
    const key = this.getKeyById(keyId, userId)
    if (!key) return null

    try {
      // Descriptografia simples (reverso da encriptação)
      const decrypted = Buffer.from(key.encrypted.encryptedValue, 'base64').toString('utf-8')

      // Atualizar last used
      key.lastUsed = new Date().toISOString()
      key.accessCount = (key.accessCount || 0) + 1
      this.saveToFile()

      return decrypted
    } catch (err) {
      console.error('Erro ao descriptografar:', err)
      return null
    }
  }

  /**
   * Revogar chave
   */
  revokeKey(keyId, userId) {
    const key = this.getKeyById(keyId, userId)
    if (!key) return false

    key.isActive = false
    key.deactivatedAt = new Date().toISOString()
    this.saveToFile()

    return true
  }

  /**
   * Rotacionar chave
   */
  rotateKey(keyId, userId, newApiKey) {
    const key = this.getKeyById(keyId, userId)
    if (!key) return false

    // Atualizar com nova encriptação
    key.encrypted = {
      iv: crypto.randomBytes(16).toString('hex'),
      encryptedValue: Buffer.from(newApiKey).toString('base64'),
      salt: crypto.randomBytes(16).toString('hex')
    }
    key.rotatedAt = new Date().toISOString()
    key.rotationDueAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

    this.saveToFile()
    return true
  }
}

export const integrationsMemoryStore = new IntegrationsMemoryStore()
