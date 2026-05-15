/**
 * Sistema de Logging & Auditoria
 * Registra todas as ações de segurança e eventos críticos
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class AuditLogger {
  constructor(options = {}) {
    this.logDir = options.logDir || path.join(__dirname, '../logs');
    this.logFile = path.join(this.logDir, 'audit.log');
    this.errorFile = path.join(this.logDir, 'errors.log');
    this.maxLogSize = options.maxLogSize || 10 * 1024 * 1024; // 10MB
    this.retentionDays = options.retentionDays || 90;

    this.ensureLogDirectory();
  }

  /**
   * Cria diretório de logs se não existir
   */
  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Log de evento genérico
   * @param {string} level - 'INFO', 'WARN', 'ERROR'
   * @param {string} message - Mensagem
   * @param {Object} metadata - Dados adicionais
   */
  log(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...metadata,
    };

    const logLine = JSON.stringify(logEntry);
    console.log(`[${level}]`, message, metadata);

    this.writeLog(this.logFile, logLine);
  }

  /**
   * Log de autenticação bem-sucedida
   * @param {Object} data - { userId, email, method, ip, userAgent }
   */
  logAuthSuccess(data) {
    this.log('INFO', 'AUTH_SUCCESS', {
      userId: data.userId,
      email: data.email,
      authMethod: data.method || 'password',
      ip: data.ip,
      userAgent: data.userAgent,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log de falha de autenticação
   * @param {Object} data - { email, reason, ip, userAgent, attempts }
   */
  logAuthFailure(data) {
    this.log('WARN', 'AUTH_FAILURE', {
      email: data.email || 'unknown',
      reason: data.reason,
      ip: data.ip,
      userAgent: data.userAgent,
      attempts: data.attempts,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log de tentativa de acesso não autorizado
   * @param {Object} data - { userId, resource, action, reason, ip }
   */
  logUnauthorizedAccess(data) {
    this.log('WARN', 'UNAUTHORIZED_ACCESS', {
      userId: data.userId || 'anonymous',
      resource: data.resource,
      action: data.action,
      reason: data.reason,
      ip: data.ip,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log de operação sensível
   * @param {Object} data - { userId, action, resource, changes }
   */
  logSensitiveOperation(data) {
    this.log('INFO', 'SENSITIVE_OPERATION', {
      userId: data.userId,
      action: data.action,
      resource: data.resource,
      changes: data.changes,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log de manipulação de chaves de API
   * @param {Object} data - { userId, action, integration, maskedKey }
   */
  logApiKeyOperation(data) {
    this.log('INFO', 'API_KEY_OPERATION', {
      userId: data.userId,
      action: data.action, // 'CREATE', 'ROTATE', 'REVOKE'
      integration: data.integration,
      maskedKey: data.maskedKey,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log de detecção de ataque
   * @param {Object} data - { type, ip, details }
   */
  logSecurityThreat(data) {
    this.log('WARN', 'SECURITY_THREAT', {
      threatType: data.type, // 'BRUTE_FORCE', 'SQL_INJECTION', etc
      ip: data.ip,
      details: data.details,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log de erro crítico
   * @param {Error} error - Objeto de erro
   * @param {Object} context - Contexto adicional
   */
  logError(error, context = {}) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      code: error.code,
      ...context,
    };

    const logLine = JSON.stringify(errorEntry);
    console.error('[ERROR]', error.message);

    this.writeLog(this.errorFile, logLine);
  }

  /**
   * Escreve log em arquivo
   * @param {string} filePath - Caminho do arquivo
   * @param {string} logLine - Linha de log
   */
  writeLog(filePath, logLine) {
    try {
      // Verificar tamanho do arquivo
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.size > this.maxLogSize) {
          this.rotateLog(filePath);
        }
      }

      // Adicionar linha com quebra
      fs.appendFileSync(filePath, logLine + '\n');
    } catch (err) {
      console.error('[LOG ERROR]', err.message);
    }
  }

  /**
   * Rotaciona arquivo de log (rename + novo)
   * @param {string} filePath - Caminho do arquivo
   */
  rotateLog(filePath) {
    const timestamp = new Date().toISOString().split('T')[0];
    const backup = `${filePath}.${timestamp}`;

    try {
      if (fs.existsSync(filePath)) {
        fs.renameSync(filePath, backup);
        console.log(`[LOG] Arquivo rotacionado: ${backup}`);
      }
    } catch (err) {
      console.error('[LOG ROTATION ERROR]', err.message);
    }
  }

  /**
   * Limpa logs antigos (política de retenção)
   */
  cleanupOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      files.forEach((file) => {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          console.log(`[LOG] Arquivo deletado: ${file}`);
        }
      });
    } catch (err) {
      console.error('[CLEANUP ERROR]', err.message);
    }
  }

  /**
   * Lê logs e filtra por período/tipo
   * @param {Object} options - { type, startDate, endDate, limit }
   * @returns {Array} Linhas de log
   */
  readLogs(options = {}) {
    try {
      if (!fs.existsSync(this.logFile)) {
        return [];
      }

      const content = fs.readFileSync(this.logFile, 'utf-8');
      let lines = content.split('\n').filter(Boolean);

      // Filtrar por tipo
      if (options.type) {
        lines = lines.filter((line) => {
          try {
            const entry = JSON.parse(line);
            return entry.level === options.type;
          } catch {
            return false;
          }
        });
      }

      // Limitar quantidade
      if (options.limit) {
        lines = lines.slice(-options.limit);
      }

      return lines.map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { raw: line };
        }
      });
    } catch (err) {
      console.error('[READ LOG ERROR]', err.message);
      return [];
    }
  }

  /**
   * Gera relatório de segurança
   * @param {number} daysBack - Dias para analisar
   * @returns {Object} Estatísticas
   */
  getSecurityReport(daysBack = 7) {
    const logs = this.readLogs();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const report = {
      period: `${daysBack} dias`,
      generatedAt: new Date().toISOString(),
      stats: {
        totalAuthAttempts: 0,
        successfulAuths: 0,
        failedAuths: 0,
        unauthorizedAccesses: 0,
        securityThreats: 0,
        errors: 0,
      },
      topThreats: {},
      topAttackers: {},
    };

    logs.forEach((entry) => {
      const entryDate = new Date(entry.timestamp);
      if (entryDate < startDate) return;

      if (entry.message === 'AUTH_SUCCESS') {
        report.stats.successfulAuths++;
      } else if (entry.message === 'AUTH_FAILURE') {
        report.stats.failedAuths++;
      } else if (entry.message === 'UNAUTHORIZED_ACCESS') {
        report.stats.unauthorizedAccesses++;
      } else if (entry.message === 'SECURITY_THREAT') {
        report.stats.securityThreats++;
        const threatType = entry.threatType || 'unknown';
        report.topThreats[threatType] = (report.topThreats[threatType] || 0) + 1;

        if (entry.ip) {
          report.topAttackers[entry.ip] = (report.topAttackers[entry.ip] || 0) + 1;
        }
      }

      report.stats.totalAuthAttempts++;
    });

    report.stats.successRate = Math.round(
      (report.stats.successfulAuths / Math.max(report.stats.totalAuthAttempts, 1)) * 100
    );

    return report;
  }
}

export default AuditLogger;
