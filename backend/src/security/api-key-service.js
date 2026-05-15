/**
 * Serviço de Armazenamento Seguro de APIs do Usuário
 * Criptografa e gerencia chaves de API com rotação automática
 */

import EncryptionService from './encryption.js';

class ApiKeyService {
  constructor() {
    this.encryption = new EncryptionService();
  }

  /**
   * Armazena chave de API de forma segura
   * @param {Object} data - { userId, integrationName, apiKey, apiSecret }
   * @returns {Object} Registro criptografado para salvar no BD
   */
  encryptApiKey(data) {
    const { userId, integrationName, apiKey, apiSecret } = data;

    if (!userId || !integrationName || !apiKey) {
      throw new Error('userId, integrationName e apiKey são obrigatórios');
    }

    // Criptografar apenas os dados sensíveis
    const encryptedKey = this.encryption.encrypt(apiKey, userId);
    const encryptedSecret = apiSecret ? this.encryption.encrypt(apiSecret, userId) : null;

    return {
      userId,
      integrationName,
      encryptedKey: encryptedKey.encryptedData,
      keyIv: encryptedKey.iv,
      keySalt: encryptedKey.salt,
      keyAuthTag: encryptedKey.authTag,
      encryptedSecret: encryptedSecret ? encryptedSecret.encryptedData : null,
      secretIv: encryptedSecret ? encryptedSecret.iv : null,
      secretSalt: encryptedSecret ? encryptedSecret.salt : null,
      secretAuthTag: encryptedSecret ? encryptedSecret.authTag : null,
      algorithm: 'aes-256-gcm',
      createdAt: new Date(),
      lastUsedAt: null,
      rotationDue: this.getNextRotationDate(),
      isActive: true,
    };
  }

  /**
   * Descriptografa chave de API
   * @param {Object} stored - Registro do banco de dados
   * @param {string} userId - ID do usuário
   * @returns {Object} { apiKey, apiSecret }
   */
  decryptApiKey(stored, userId) {
    if (stored.userId !== userId) {
      throw new Error('Usuário não autorizado');
    }

    const encryptedKey = {
      encryptedData: stored.encryptedKey,
      iv: stored.keyIv,
      salt: stored.keySalt,
      authTag: stored.keyAuthTag,
    };

    const apiKey = this.encryption.decrypt(encryptedKey, userId);

    let apiSecret = null;
    if (stored.encryptedSecret) {
      const encryptedSecret = {
        encryptedData: stored.encryptedSecret,
        iv: stored.secretIv,
        salt: stored.secretSalt,
        authTag: stored.secretAuthTag,
      };
      apiSecret = this.encryption.decrypt(encryptedSecret, userId);
    }

    return { apiKey, apiSecret };
  }

  /**
   * Registra último uso da chave
   * @param {Object} stored - Registro do banco
   * @returns {Object} Registro atualizado
   */
  updateLastUsed(stored) {
    stored.lastUsedAt = new Date();
    return stored;
  }

  /**
   * Marca chave como inativa (revogação)
   * @param {Object} stored - Registro do banco
   * @returns {Object} Registro atualizado
   */
  revokeApiKey(stored) {
    stored.isActive = false;
    stored.revokedAt = new Date();
    return stored;
  }

  /**
   * Verifica se chave precisa rotação
   * @param {Object} stored - Registro do banco
   * @returns {boolean}
   */
  isRotationDue(stored) {
    if (!stored.rotationDue) return false;
    return new Date() >= new Date(stored.rotationDue);
  }

  /**
   * Calcula próxima data de rotação (90 dias)
   * @returns {Date}
   */
  getNextRotationDate() {
    const date = new Date();
    date.setDate(date.getDate() + 90);
    return date;
  }

  /**
   * Gera relatório de chaves próximas de vencer
   * @param {Array} apiKeys - Lista de chaves armazenadas
   * @param {number} daysWarning - Dias até alerta (padrão 30)
   * @returns {Array} Chaves próximas de vencer
   */
  getKeysNearingRotation(apiKeys, daysWarning = 30) {
    const now = new Date();
    const warningDate = new Date(now.getTime() + daysWarning * 24 * 60 * 60 * 1000);

    return apiKeys.filter((key) => {
      const rotationDate = new Date(key.rotationDue);
      return rotationDate <= warningDate && rotationDate > now && key.isActive;
    });
  }

  /**
   * Máscara chave para logging seguro
   * Mostra apenas últimos 4 caracteres
   * @param {string} key - Chave a mascarar
   * @returns {string} Chave mascarada
   */
  maskKey(key) {
    if (!key || key.length < 4) return '****';
    return '****' + key.substring(key.length - 4);
  }

  /**
   * Validar formato de chave de API
   * @param {string} apiKey - Chave a validar
   * @returns {boolean}
   */
  isValidApiKeyFormat(apiKey) {
    // Chave deve ter 20+ caracteres
    if (!apiKey || apiKey.length < 20) return false;

    // Não deve conter espaços
    if (apiKey.includes(' ')) return false;

    // Deve ser alfanumérico + - _ .
    const validChars = /^[a-zA-Z0-9\-_.]+$/;
    return validChars.test(apiKey);
  }

  /**
   * Gera estatísticas de segurança de chaves
   * @param {Array} apiKeys - Lista de chaves
   * @returns {Object} Estatísticas
   */
  getSecurityStats(apiKeys) {
    const stats = {
      totalKeys: apiKeys.length,
      activeKeys: apiKeys.filter((k) => k.isActive).length,
      revokedKeys: apiKeys.filter((k) => !k.isActive).length,
      keysNearingRotation: this.getKeysNearingRotation(apiKeys).length,
      averageAgeDays: 0,
      oldestKeyDays: 0,
    };

    if (apiKeys.length > 0) {
      const now = new Date();
      const ages = apiKeys.map((k) => (now - new Date(k.createdAt)) / (1000 * 60 * 60 * 24));
      stats.averageAgeDays = Math.round(ages.reduce((a, b) => a + b, 0) / ages.length);
      stats.oldestKeyDays = Math.round(Math.max(...ages));
    }

    return stats;
  }

  /**
   * Limpar chaves revogadas/expiradas (data retention policy)
   * Mantém 90 dias de histórico
   * @param {Array} apiKeys - Lista de chaves
   * @returns {Array} Chaves a manter
   */
  cleanupExpiredKeys(apiKeys, retentionDays = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    return apiKeys.filter((key) => {
      // Manter chaves ativas
      if (key.isActive) return true;

      // Manter revogadas dentro do período de retenção
      if (key.revokedAt) {
        return new Date(key.revokedAt) > cutoffDate;
      }

      return true;
    });
  }
}

export default ApiKeyService;
