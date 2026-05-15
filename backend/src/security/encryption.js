/**
 * Módulo de Criptografia AES-256-GCM
 * Protege APIs e dados sensíveis em repouso
 */

import crypto from 'crypto';

class EncryptionService {
  constructor(masterKey = process.env.ENCRYPTION_KEY) {
    if (!masterKey) {
      throw new Error('ENCRYPTION_KEY não configurada em variáveis de ambiente');
    }
    this.masterKey = Buffer.from(masterKey, 'hex');
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.saltLength = 16;
    this.ivLength = 12;
    this.authTagLength = 16;
  }

  /**
   * Deriva chave usando PBKDF2 (padrão NIST)
   * @param {string} password - Senha base
   * @param {Buffer} salt - Salt único
   * @returns {Buffer} Chave derivada de 32 bytes
   */
  deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, this.keyLength, 'sha256');
  }

  /**
   * Criptografa dados sensíveis
   * @param {string} plaintext - Dados a criptografar
   * @param {string} userId - ID do usuário (para derivação de chave)
   * @returns {Object} { encryptedData, salt, iv, authTag }
   */
  encrypt(plaintext, userId) {
    // Gerar salt único para este registro
    const salt = crypto.randomBytes(this.saltLength);

    // Derivar chave específica do usuário + salt
    const derivedKey = this.deriveKey(userId + this.masterKey.toString('hex'), salt);

    // Gerar IV único
    const iv = crypto.randomBytes(this.ivLength);

    // Criptografar
    const cipher = crypto.createCipheriv(this.algorithm, derivedKey, iv);
    let encryptedData = cipher.update(plaintext, 'utf8', 'hex');
    encryptedData += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encryptedData,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm: this.algorithm,
    };
  }

  /**
   * Descriptografa dados
   * @param {Object} encrypted - Objeto com dados criptografados
   * @param {string} userId - ID do usuário
   * @returns {string} Dados descriptografados
   */
  decrypt(encrypted, userId) {
    const { encryptedData, salt, iv, authTag } = encrypted;

    // Reconstituir salt e IV
    const saltBuffer = Buffer.from(salt, 'hex');
    const ivBuffer = Buffer.from(iv, 'hex');
    const authTagBuffer = Buffer.from(authTag, 'hex');

    // Derivar mesma chave
    const derivedKey = this.deriveKey(userId + this.masterKey.toString('hex'), saltBuffer);

    // Descriptografar
    const decipher = crypto.createDecipheriv(this.algorithm, derivedKey, ivBuffer);
    decipher.setAuthTag(authTagBuffer);

    let plaintext = decipher.update(encryptedData, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  }

  /**
   * Hash de senha com bcrypt
   * @param {string} password - Senha em texto plano
   * @returns {Promise<string>} Hash bcrypt
   */
  async hashPassword(password) {
    const bcrypt = (await import('bcryptjs')).default;
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  }

  /**
   * Verifica senha contra hash
   * @param {string} password - Senha em texto plano
   * @param {string} hash - Hash bcrypt
   * @returns {Promise<boolean>}
   */
  async verifyPassword(password, hash) {
    const bcrypt = (await import('bcryptjs')).default;
    return bcrypt.compare(password, hash);
  }

  /**
   * Gera token aleatório (para API keys, refresh tokens, etc)
   * @param {number} length - Tamanho em bytes
   * @returns {string} Token hexadecimal
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash com salt (para tokens, etc)
   * @param {string} data - Dados a hashar
   * @returns {string} SHA-256 hash
   */
  hashToken(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

export default EncryptionService;
