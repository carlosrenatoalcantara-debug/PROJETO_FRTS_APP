// backend/src/testing/regressionManager.js
//
// Forensic regression engine. Executes a golden fixture against the live
// electrical rules validator, hashes the deterministic output, and diffs
// against the expected snapshot.

import { createHash }             from 'crypto'
import { deepFreezeSafe }         from '../utils/freeze.js'
import { validateElectricalRules } from '../electrical/validators/electricalRulesValidator.js'
import { serialize }               from './snapshotSerializer.js'
import { assertContractInvariants } from './contractInvariantGuard.js'

// ─── Forensic diff engine ─────────────────────────────────────────────────────

function _diff(actual, expected, path, records) {
  if (typeof actual !== typeof expected) {
    records.push({ path, actual, expected })
    return
  }

  if (actual === null || typeof actual !== 'object') {
    if (actual !== expected) records.push({ path, actual, expected })
    return
  }

  if (Array.isArray(actual) !== Array.isArray(expected)) {
    records.push({ path, actual, expected })
    return
  }

  if (Array.isArray(actual)) {
    if (actual.length !== expected.length) {
      records.push({ path, note: 'length_mismatch', actual_length: actual.length, expected_length: expected.length })
    }
    const len = Math.max(actual.length, expected.length)
    for (let i = 0; i < len; i++) {
      _diff(actual[i], expected[i], `${path}[${i}]`, records)
    }
    return
  }

  const allKeys = new Set([...Object.keys(actual), ...Object.keys(expected)])
  for (const key of [...allKeys].sort()) {
    const childPath = path ? `${path}.${key}` : key
    if (!(key in actual)) {
      records.push({ path: childPath, actual: undefined, expected: expected[key] })
    } else if (!(key in expected)) {
      records.push({ path: childPath, actual: actual[key], expected: undefined })
    } else {
      _diff(actual[key], expected[key], childPath, records)
    }
  }
}

function computeDiff(actual, expected) {
  const records = []
  _diff(actual, expected, '', records)
  return records.length > 0 ? records : null
}

// ─── RegressionManager ───────────────────────────────────────────────────────

export class RegressionManager {
  /**
   * Runs a golden fixture against the live engine.
   *
   * @param {object} fixture  { fixture_id, input_payload, expected_output_snapshot }
   * @returns {Readonly<{ passed: boolean, hash: string, diff: Array|null }>}
   * @throws  If the engine throws or invariants are violated
   */
  static run(fixture) {
    const actual = validateElectricalRules(fixture.input_payload)

    assertContractInvariants(actual)

    const serializedActual   = serialize(actual)
    const serializedExpected = serialize(fixture.expected_output_snapshot)

    const hash = createHash('sha256').update(serializedActual).digest('hex')

    if (serializedActual === serializedExpected) {
      return deepFreezeSafe({ passed: true, hash, diff: null })
    }

    const diff = computeDiff(JSON.parse(serializedActual), JSON.parse(serializedExpected))

    return deepFreezeSafe({ passed: false, hash, diff })
  }
}
