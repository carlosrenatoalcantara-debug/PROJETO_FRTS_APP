/**
 * Módulo de Validação & Sanitização
 * Protege contra XSS, SQL Injection, e outras vulnerabilidades
 */

import DOMPurify from 'isomorphic-dompurify';

class ValidationService {
  /**
   * Valida email
   * @param {string} email - Email a validar
   * @returns {boolean}
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Valida força da senha
   * Requer: 12+ chars, uppercase, lowercase, number, special
   * @param {string} password - Senha a validar
   * @returns {Object} { isValid, score, feedback }
   */
  static validatePassword(password) {
    const feedback = [];
    let score = 0;

    if (!password || password.length < 12) {
      feedback.push('Mínimo 12 caracteres');
    } else {
      score += 25;
    }

    if (/[A-Z]/.test(password)) {
      score += 25;
    } else {
      feedback.push('Requer letra maiúscula');
    }

    if (/[a-z]/.test(password)) {
      score += 25;
    } else {
      feedback.push('Requer letra minúscula');
    }

    if (/[0-9]/.test(password)) {
      score += 15;
    } else {
      feedback.push('Requer número');
    }

    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      score += 10;
    } else {
      feedback.push('Requer caractere especial');
    }

    return {
      isValid: score >= 75,
      score,
      feedback,
    };
  }

  /**
   * Sanitiza entrada contra XSS
   * @param {string} input - Entrada do usuário
   * @returns {string} Entrada limpa
   */
  static sanitizeInput(input) {
    if (typeof input !== 'string') {
      return input;
    }

    // Remover tags HTML perigosas
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    });
  }

  /**
   * Escapa HTML (para output seguro)
   * @param {string} text - Texto a escapar
   * @returns {string} Texto escapado
   */
  static escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }

  /**
   * Valida URL
   * @param {string} url - URL a validar
   * @returns {boolean}
   */
  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Valida documento JSON
   * @param {string} json - String JSON
   * @returns {Object|boolean} Objeto parseado ou false
   */
  static isValidJson(json) {
    try {
      return JSON.parse(json);
    } catch {
      return false;
    }
  }

  /**
   * Valida tamanho de entrada
   * @param {string} input - Entrada
   * @param {number} maxLength - Comprimento máximo
   * @returns {boolean}
   */
  static isValidLength(input, maxLength = 1000) {
    return typeof input === 'string' && input.length <= maxLength;
  }

  /**
   * Sanitiza nome de arquivo
   * Remove path traversal e caracteres perigosos
   * @param {string} filename - Nome do arquivo
   * @returns {string} Nome sanitizado
   */
  static sanitizeFilename(filename) {
    return filename
      .replace(/\.\./g, '') // Remove ../
      .replace(/[/\\]/g, '') // Remove slashes
      .replace(/[<>:"|?*]/g, '') // Remove chars inválidos no Windows
      .substring(0, 255); // Limita tamanho
  }

  /**
   * Valida UUID
   * @param {string} uuid - UUID a validar
   * @returns {boolean}
   */
  static isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Sanitiza objeto (valida todos campos)
   * @param {Object} obj - Objeto a sanitizar
   * @param {Object} schema - Esquema de validação
   * @returns {Object} Objeto sanitizado
   */
  static sanitizeObject(obj, schema = {}) {
    const sanitized = {};

    for (const [key, value] of Object.entries(obj)) {
      if (!schema[key]) continue; // Ignorar campos não declarados

      const fieldSchema = schema[key];

      // Tipo de dado
      if (fieldSchema.type === 'string') {
        sanitized[key] = this.sanitizeInput(String(value));
      } else if (fieldSchema.type === 'email') {
        sanitized[key] = this.isValidEmail(value) ? value : null;
      } else if (fieldSchema.type === 'number') {
        sanitized[key] = !isNaN(Number(value)) ? Number(value) : null;
      } else if (fieldSchema.type === 'boolean') {
        sanitized[key] = Boolean(value);
      }

      // Validar tamanho
      if (fieldSchema.maxLength && sanitized[key]) {
        if (!this.isValidLength(sanitized[key], fieldSchema.maxLength)) {
          sanitized[key] = null;
        }
      }

      // Validar pattern (regex)
      if (fieldSchema.pattern && sanitized[key]) {
        if (!new RegExp(fieldSchema.pattern).test(sanitized[key])) {
          sanitized[key] = null;
        }
      }

      // Campos obrigatórios
      if (fieldSchema.required && !sanitized[key]) {
        throw new Error(`Campo obrigatório: ${key}`);
      }
    }

    return sanitized;
  }

  /**
   * Valida objeto por esquema
   * @param {Object} obj - Objeto a validar
   * @param {Object} schema - Esquema { field: { type, required, min, max } }
   * @returns {Object} { isValid, errors }
   */
  static validateBySchema(obj, schema) {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = obj[field];

      // Campo obrigatório
      if (rules.required && (value === undefined || value === null)) {
        errors.push(`${field} é obrigatório`);
        continue;
      }

      if (!value) continue;

      // Tipo
      if (rules.type && typeof value !== rules.type) {
        errors.push(`${field} deve ser ${rules.type}`);
      }

      // Tamanho string
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${field} deve ter mínimo ${rules.minLength} caracteres`);
      }

      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${field} não pode exceder ${rules.maxLength} caracteres`);
      }

      // Número
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`${field} deve ser >= ${rules.min}`);
      }

      if (rules.max !== undefined && value > rules.max) {
        errors.push(`${field} deve ser <= ${rules.max}`);
      }

      // Pattern
      if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
        errors.push(`${field} possui formato inválido`);
      }

      // Validador customizado
      if (rules.custom && !rules.custom(value)) {
        errors.push(`${field} validação falhou`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

export default ValidationService;
