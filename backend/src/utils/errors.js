// backend/src/utils/errors.js

import { createHash, randomUUID } from 'crypto'
import { deepFreezeSafe }         from './freeze.js'

// ─── Immutable Enums ──────────────────────────────────────────────────────────

export const ErrorSeverity = Object.freeze({
  CRITICAL: 'CRITICAL',
  WARNING:  'WARNING',
  INFO:     'INFO'
})

export const ErrorCategory = Object.freeze({
  DTO_VALIDATION:     'DTO_VALIDATION',
  ELECTRICAL_PHYSICS: 'ELECTRICAL_PHYSICS',
  SPATIAL_GRAPH:      'SPATIAL_GRAPH',
  FUSION_ENGINE:      'FUSION_ENGINE',
  RUNTIME_GUARD:      'RUNTIME_GUARD'
})

// Aliases de compatibilidade reversa — consumidores que usam SEVERITY / CATEGORY
// continuam funcionando sem alteração.
export { ErrorSeverity as SEVERITY, ErrorCategory as CATEGORY }

// ─── Helpers internos ─────────────────────────────────────────────────────────

/**
 * Gera um traceId determinístico ou aleatório.
 * Se `deterministicSeed` for fornecido, retorna os primeiros 12 caracteres
 * do digest SHA-1 — estável entre execuções de CI/CD e snapshots de regressão.
 * Caso contrário, usa `crypto.randomUUID()`.
 */
function _generateTraceId(deterministicSeed) {
  if (deterministicSeed != null && deterministicSeed !== '') {
    return createHash('sha1')
      .update(String(deterministicSeed))
      .digest('hex')
      .substring(0, 12)
  }
  return randomUUID()
}

/**
 * Valida que `value` é uma chave válida de `enumObj`.
 * Lança RangeError com mensagem sem acentuação em caso de falha.
 */
function _validateEnum(value, enumObj, fieldName) {
  if (!Object.prototype.hasOwnProperty.call(enumObj, value)) {
    const valid = Object.keys(enumObj).join(', ')
    throw new RangeError(
      `${fieldName} invalido: "${value}". Valores aceitos: ${valid}.`
    )
  }
}

// ─── CONTRACT A: StructuredEngineError ───────────────────────────────────────

/**
 * Erro estruturado para exceções de runtime do motor de engenharia.
 *
 * Mensagem nativa formatada como: [CATEGORY][SEVERITY][CODE] sua_mensagem
 *
 * O objeto `context` retornado na instância é imutável e contém:
 *   traceId   — SHA-1[:12] de deterministicSeed, ou randomUUID()
 *   timestamp — ISO 8601, fallback para now() se não fornecido
 *   + todos os demais campos passados em context
 *
 * @param {object} payload
 * @param {string} payload.code       Codigo de erro sem acentuacao (ex: FALHA_DTO_ELETRICO)
 * @param {string} payload.severity   Um de: CRITICAL | WARNING | INFO
 * @param {string} payload.category   Um de: DTO_VALIDATION | ELECTRICAL_PHYSICS |
 *                                    SPATIAL_GRAPH | FUSION_ENGINE | RUNTIME_GUARD
 * @param {string} payload.message    Mensagem descritiva sem acentuacao
 * @param {object} [payload.context]  Metadados adicionais de rastreabilidade
 */
export class StructuredEngineError extends Error {
  constructor({ code, severity, category, message, context = {} }) {

    const formattedMessage = `[${category}][${severity}][${code}] ${message}`
    super(formattedMessage)

    this.name = 'StructuredEngineError'

    // Preserva o grafo de debugging correto do engine V8/SpiderMonkey
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, StructuredEngineError)
    }

    // Validação de enums — lança RangeError se inválido
    _validateEnum(severity, ErrorSeverity, 'severity')
    _validateEnum(category, ErrorCategory, 'category')

    this.code     = String(code)
    this.severity = severity
    this.category = category

    const {
      deterministicSeed,
      timestamp: providedTimestamp,
      ...restContext
    } = context

    const traceId   = _generateTraceId(deterministicSeed)
    const timestamp = typeof providedTimestamp === 'string'
      ? providedTimestamp
      : new Date().toISOString()

    // context imutável — não pode ser mutado por consumidores downstream
    this.context = deepFreezeSafe({
      ...restContext,
      deterministicSeed: deterministicSeed ?? null,
      traceId,
      timestamp
    })
  }
}

// ─── CONTRACT B: createErrorRecord ───────────────────────────────────────────

/**
 * Factory pura e não-lançadora para registros de telemetria, relatórios e
 * acumulações em arrays de pipeline.
 *
 * Retorna um POJO completamente congelado via deepFreezeSafe — seguro para
 * uso assíncrono, buffers de log e snapshots de regressão.
 *
 * @param {string} code
 * @param {string} severity   Um de: CRITICAL | WARNING | INFO
 * @param {string} category   Um de: DTO_VALIDATION | ELECTRICAL_PHYSICS |
 *                            SPATIAL_GRAPH | FUSION_ENGINE | RUNTIME_GUARD
 * @param {string} message
 * @param {object} [context]
 * @returns {Readonly<object>}
 */
export function createErrorRecord(code, severity, category, message, context = {}) {

  _validateEnum(severity, ErrorSeverity, 'severity')
  _validateEnum(category, ErrorCategory, 'category')

  const {
    deterministicSeed,
    timestamp: providedTimestamp,
    ...restContext
  } = context

  const traceId   = _generateTraceId(deterministicSeed)
  const timestamp = typeof providedTimestamp === 'string'
    ? providedTimestamp
    : new Date().toISOString()

  const formattedMessage = `[${category}][${severity}][${code}] ${message}`

  return deepFreezeSafe({
    code:     String(code),
    severity,
    category,
    message:  formattedMessage,
    context: {
      ...restContext,
      deterministicSeed: deterministicSeed ?? null,
      traceId,
      timestamp
    }
  })
}

// ─── Wrapper de compatibilidade reversa: createPlatformError ─────────────────

/**
 * Mantém o contrato de consumidores legados que usam a assinatura posicional:
 *   createPlatformError(code, message, { severity, category, ...rest })
 *
 * Internamente constrói um StructuredEngineError com o novo contrato de objeto.
 * NÃO lança — retorna a instância de Error para que o chamador decida se lança.
 *
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {StructuredEngineError}
 */
export function createPlatformError(code, message, context = {}) {
  const {
    severity = ErrorSeverity.CRITICAL,
    category = ErrorCategory.RUNTIME_GUARD,
    ...rest
  } = context

  return new StructuredEngineError({
    code,
    severity,
    category,
    message,
    context: rest
  })
}
