// backend/src/testing/contractInvariantGuard.js
//
// Forensic-grade invariant validator for the electrical rules engine output.
// Enforces structural and semantic contracts before any snapshot or hash operation.

/**
 * Validates a structured alert object from calculateStringSizing output.
 *
 * @param {object} alert
 * @param {number} index
 */
function _assertStructuredAlert(alert, index) {
  if (!alert || typeof alert !== 'object' || Array.isArray(alert)) {
    throw new Error(
      `CONTRACT_INVARIANT_VIOLATION: alertas[${index}] must be a plain object, got ${Array.isArray(alert) ? 'array' : typeof alert}`
    )
  }
  if (typeof alert.code !== 'string' || alert.code.trim().length === 0) {
    throw new Error(
      `CONTRACT_INVARIANT_VIOLATION: alertas[${index}].code must be a non-empty string`
    )
  }
  if (alert.nivel !== 'CRITICO' && alert.nivel !== 'ADVERTENCIA') {
    throw new Error(
      `CONTRACT_INVARIANT_VIOLATION: alertas[${index}].nivel must be "CRITICO" or "ADVERTENCIA", got "${alert.nivel}"`
    )
  }
  if (typeof alert.mensagem !== 'string') {
    throw new Error(
      `CONTRACT_INVARIANT_VIOLATION: alertas[${index}].mensagem must be a string`
    )
  }
}

/**
 * Asserts invariants on the output of validateElectricalRules.
 *
 * Validates:
 *   - aprovado is a strict boolean
 *   - score_eletrico is a finite number in [0, 1]
 *   - falhas is an array of non-empty strings
 *   - alertas is an array of non-empty strings
 *   - validacoes is a plain object of strict booleans
 *
 * @param {object} result  Output of validateElectricalRules
 * @throws {Error}         CONTRACT_INVARIANT_VIOLATION on any failure
 */
export function assertContractInvariants(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error(
      'CONTRACT_INVARIANT_VIOLATION: result must be a plain object'
    )
  }

  // aprovado: strict boolean
  if (result.aprovado !== true && result.aprovado !== false) {
    throw new Error(
      `CONTRACT_INVARIANT_VIOLATION: aprovado must be a strict boolean, got ${typeof result.aprovado}`
    )
  }

  // score_eletrico: finite number in [0, 1]
  if (!Number.isFinite(result.score_eletrico)) {
    throw new Error(
      `CONTRACT_INVARIANT_VIOLATION: score_eletrico must be finite, got ${result.score_eletrico}`
    )
  }
  if (result.score_eletrico < 0 || result.score_eletrico > 1) {
    throw new Error(
      `CONTRACT_INVARIANT_VIOLATION: score_eletrico out of range [0,1]: ${result.score_eletrico}`
    )
  }

  // falhas: array of non-empty strings
  if (!Array.isArray(result.falhas)) {
    throw new Error(
      'CONTRACT_INVARIANT_VIOLATION: falhas must be an array'
    )
  }
  for (let i = 0; i < result.falhas.length; i++) {
    const f = result.falhas[i]
    if (typeof f !== 'string' || f.trim().length === 0) {
      throw new Error(
        `CONTRACT_INVARIANT_VIOLATION: falhas[${i}] must be a non-empty string, got ${JSON.stringify(f)}`
      )
    }
  }

  // alertas: array of non-empty strings
  if (!Array.isArray(result.alertas)) {
    throw new Error(
      'CONTRACT_INVARIANT_VIOLATION: alertas must be an array'
    )
  }
  for (let i = 0; i < result.alertas.length; i++) {
    const a = result.alertas[i]
    if (typeof a !== 'string' || a.trim().length === 0) {
      throw new Error(
        `CONTRACT_INVARIANT_VIOLATION: alertas[${i}] must be a non-empty string, got ${JSON.stringify(a)}`
      )
    }
  }

  // validacoes: plain object of strict booleans
  if (!result.validacoes || typeof result.validacoes !== 'object' || Array.isArray(result.validacoes)) {
    throw new Error(
      'CONTRACT_INVARIANT_VIOLATION: validacoes must be a plain object'
    )
  }
  for (const [key, val] of Object.entries(result.validacoes)) {
    if (val !== true && val !== false) {
      throw new Error(
        `CONTRACT_INVARIANT_VIOLATION: validacoes.${key} must be a strict boolean, got ${typeof val}`
      )
    }
  }

  return true
}

export { _assertStructuredAlert as assertStructuredAlert }
