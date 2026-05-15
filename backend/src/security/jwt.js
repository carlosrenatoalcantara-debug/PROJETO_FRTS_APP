/**
 * Módulo de JWT (JSON Web Tokens)
 * Gerencia autenticação e sessões
 */

import jwt from 'jsonwebtoken';

class JWTService {
  constructor() {
    this.accessTokenSecret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
    this.accessTokenExpiry = '15m';
    this.refreshTokenExpiry = '7d';
  }

  /**
   * Gera JWT access token
   * @param {Object} payload - Dados do usuário
   * @returns {string} Token JWT
   */
  generateAccessToken(payload) {
    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry,
      algorithm: 'HS256',
    });
  }

  /**
   * Gera refresh token
   * @param {Object} payload - Dados do usuário
   * @returns {string} Refresh token
   */
  generateRefreshToken(payload) {
    return jwt.sign(payload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiry,
      algorithm: 'HS256',
    });
  }

  /**
   * Verifica e descriptografa access token
   * @param {string} token - JWT token
   * @returns {Object} Payload decodificado
   * @throws {Error} Se token inválido/expirado
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.accessTokenSecret, {
        algorithms: ['HS256'],
      });
    } catch (error) {
      throw new Error(`Token inválido: ${error.message}`);
    }
  }

  /**
   * Verifica refresh token
   * @param {string} token - Refresh token
   * @returns {Object} Payload decodificado
   */
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, this.refreshTokenSecret, {
        algorithms: ['HS256'],
      });
    } catch (error) {
      throw new Error(`Refresh token inválido: ${error.message}`);
    }
  }

  /**
   * Descriptografa token SEM verificar expiração
   * @param {string} token - JWT token
   * @returns {Object} Payload decodificado
   */
  decodeToken(token) {
    return jwt.decode(token);
  }

  /**
   * Gera par de tokens (access + refresh)
   * @param {Object} userPayload - { id, email, role, permissions }
   * @returns {Object} { accessToken, refreshToken }
   */
  generateTokenPair(userPayload) {
    const payload = {
      sub: userPayload.id,
      email: userPayload.email,
      role: userPayload.role || 'user',
      permissions: userPayload.permissions || [],
      iat: Math.floor(Date.now() / 1000),
    };

    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
      expiresIn: 900, // 15 minutos em segundos
    };
  }

  /**
   * Valida estrutura de um token
   * @param {string} token - Token a validar
   * @returns {boolean}
   */
  isValidToken(token) {
    if (!token || typeof token !== 'string') return false;
    if (!token.includes('.')) return false;

    const parts = token.split('.');
    return parts.length === 3;
  }

  /**
   * Extrai Bearer token do header
   * @param {string} authHeader - Authorization header
   * @returns {string|null} Token ou null
   */
  extractTokenFromHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
}

export default JWTService;
