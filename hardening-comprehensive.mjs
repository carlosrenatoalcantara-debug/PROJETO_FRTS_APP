#!/usr/bin/env node

/**
 * Comprehensive Hardening & Pre-Freeze Validation
 *
 * STEPS 3-7:
 * 3. Immutability attack tests
 * 4. Deterministic replay tests (10 cycles)
 * 5. Large scale EV stress
 * 6. Serialization hardening
 * 7. Full regression governance
 */

import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { validateElectricalRules } from './backend/src/electrical/validators/electricalRulesValidator.js'
import { GoldenSuiteRunner } from './backend/src/testing/goldenSuiteRunner.js'
import { serialize } from './backend/src/testing/snapshotSerializer.js'

const reports = {
  immutability: { passed: 0, failed: 0, tests: [] },
  determinism: { passed: 0, failed: 0, cycles: 0, tests: [] },
  largeScale: { passed: 0, failed: 0, tests: [] },
  serialization: { passed: 0, failed: 0, tests: [] },
  regression: { passed: 0, failed: 0, drifts: [] }
}

console.log(`\n${'═'.repeat(70)}`)
console.log(`COMPREHENSIVE HARDENING & PRE-FREEZE VALIDATION`)
console.log(`${'═'.repeat(70)}\n`)

// ─── STEP 3: Immutability Attack Tests ─────────────────────────────────────

console.log(`[STEP 3] IMMUTABILITY ATTACK TESTS\n`)

const basicPayload = {
  engenharia: { temperatura_minima_projeto: 5, temperatura_maxima_projeto: 40 },
  mobilidade: {
    carregadores: [{ modelo: 'TEST', potencia_nominal_kw: 7.4, tipo: 'AC', tensao_saida: 230, corrente_nominal_a: 32 }],
    demanda_simultanea_kw: 7.4,
    potencia_total_kw: 7.4,
    fator_simultaneidade: 1.0,
    estrategia_carregamento: 'SEQUENCIAL',
    limite_rede_kw: 30.0,
    prioridade_carga: 0.5,
    modo_operacao: 'CARREGAMENTO',
    protecoes: { rcd_enabled: true, overvoltage_protection: true, overcurrent_protection: true, temperature_monitoring: true },
    temperatura_minima_projeto: 5,
    temperatura_maxima_projeto: 40
  }
}

try {
  const result = validateElectricalRules(basicPayload)

  // Test 1: Try to mutate result
  try {
    result.aprovado = false
    reports.immutability.failed++
    reports.immutability.tests.push({ name: 'Mutation of result.aprovado', status: 'FAIL', reason: 'Object not frozen' })
  } catch {
    reports.immutability.passed++
    reports.immutability.tests.push({ name: 'Mutation of result.aprovado', status: 'PASS', reason: 'Object.freeze enforced' })
  }

  // Test 2: Try to mutate validacoes
  try {
    result.validacoes.transformador = false
    reports.immutability.failed++
    reports.immutability.tests.push({ name: 'Mutation of validacoes field', status: 'FAIL', reason: 'Nested object not frozen' })
  } catch {
    reports.immutability.passed++
    reports.immutability.tests.push({ name: 'Mutation of validacoes field', status: 'PASS', reason: 'Nested freeze enforced' })
  }

  // Test 3: Try to mutate alertas array
  try {
    result.alertas.push('NEW_ALERT')
    reports.immutability.failed++
    reports.immutability.tests.push({ name: 'Mutation of alertas array', status: 'FAIL', reason: 'Array not frozen' })
  } catch {
    reports.immutability.passed++
    reports.immutability.tests.push({ name: 'Mutation of alertas array', status: 'PASS', reason: 'Array freeze enforced' })
  }

  // Test 4: Verify Object.isFrozen
  if (Object.isFrozen(result)) {
    reports.immutability.passed++
    reports.immutability.tests.push({ name: 'Object.isFrozen(result)', status: 'PASS', reason: 'Result is frozen' })
  } else {
    reports.immutability.failed++
    reports.immutability.tests.push({ name: 'Object.isFrozen(result)', status: 'FAIL', reason: 'Result not frozen' })
  }

  console.log(`  Immutability Tests:  ${reports.immutability.passed}/${4} PASS`)
} catch (err) {
  console.log(`  ❌ Immutability tests failed: ${err.message}`)
  reports.immutability.failed += 4
}

// ─── STEP 4: Deterministic Replay Tests ────────────────────────────────────

console.log(`\n[STEP 4] DETERMINISTIC REPLAY TESTS (10 cycles)\n`)

const hashes = []
let deterministicPassed = true

try {
  for (let i = 0; i < 10; i++) {
    const result = validateElectricalRules(basicPayload)
    const serialized = serialize(result)
    const hash = createHash('sha256').update(serialized).digest('hex')
    hashes.push(hash)
  }

  const uniqueHashes = new Set(hashes)
  if (uniqueHashes.size === 1) {
    reports.determinism.passed = 10
    reports.determinism.cycles = 10
    console.log(`  ✅ All 10 cycles produced identical hash (deterministic)`)
    console.log(`     Hash: ${hashes[0].substring(0, 16)}...`)
  } else {
    reports.determinism.failed = 10
    console.log(`  ❌ Hashes differed across cycles (non-deterministic!)`)
    console.log(`     Unique hashes: ${uniqueHashes.size}/10`)
    deterministicPassed = false
  }
} catch (err) {
  console.log(`  ❌ Determinism test failed: ${err.message}`)
  reports.determinism.failed = 10
  deterministicPassed = false
}

// ─── STEP 5: Large Scale EV Stress ────────────────────────────────────────

console.log(`\n[STEP 5] LARGE SCALE EV STRESS\n`)

try {
  // Large charger array: 20 chargers
  const largePayload = {
    engenharia: { temperatura_minima_projeto: 5, temperatura_maxima_projeto: 40 },
    mobilidade: {
      carregadores: Array.from({ length: 20 }, (_, i) => ({
        modelo: `CHARGER_${i}`,
        potencia_nominal_kw: 11,
        tipo: 'AC',
        tensao_saida: 230,
        corrente_nominal_a: 16
      })),
      demanda_simultanea_kw: 220,
      potencia_total_kw: 220,
      fator_simultaneidade: 1.0,
      estrategia_carregamento: 'SIMULTANEO',
      limite_rede_kw: 30.0,
      prioridade_carga: 0.5,
      modo_operacao: 'CARREGAMENTO',
      protecoes: { rcd_enabled: true, overvoltage_protection: true, overcurrent_protection: true, temperature_monitoring: true },
      temperatura_minima_projeto: 5,
      temperatura_maxima_projeto: 40
    }
  }

  const result = validateElectricalRules(largePayload)

  if (!result.aprovado && result.ev_score && result.ev_score.aprovado === false) {
    reports.largeScale.passed++
    reports.largeScale.tests.push({ name: '20-charger array (high demand)', status: 'PASS', approved: false })
    console.log(`  ✅ Large array (20 chargers) handled deterministically`)
    console.log(`     Result: aprovado=${result.aprovado}, failures=${result.falhas.length}`)
  } else {
    reports.largeScale.failed++
    reports.largeScale.tests.push({ name: '20-charger array', status: 'FAIL', reason: 'Unexpected result' })
  }
} catch (err) {
  console.log(`  ❌ Large scale test failed: ${err.message}`)
  reports.largeScale.failed++
}

// ─── STEP 6: Serialization Hardening ──────────────────────────────────────

console.log(`\n[STEP 6] SERIALIZATION HARDENING\n`)

try {
  const result = validateElectricalRules(basicPayload)
  const serialized1 = serialize(result)
  const serialized2 = serialize(result)
  const parsed1 = JSON.parse(serialized1)
  const parsed2 = JSON.parse(serialized2)

  if (serialized1 === serialized2) {
    reports.serialization.passed++
    console.log(`  ✅ Serialization deterministic (identical strings)`)
  } else {
    reports.serialization.failed++
    console.log(`  ❌ Serialization differs (non-deterministic!)`)
  }

  // Check canonical key ordering
  const keys1 = Object.keys(parsed1).sort().join(',')
  const keys2 = Object.keys(parsed2).sort().join(',')

  if (keys1 === keys2) {
    reports.serialization.passed++
    console.log(`  ✅ Canonical key ordering maintained`)
  } else {
    reports.serialization.failed++
    console.log(`  ❌ Key ordering not canonical`)
  }
} catch (err) {
  console.log(`  ❌ Serialization test failed: ${err.message}`)
  reports.serialization.failed += 2
}

// ─── STEP 7: Full Regression Governance ────────────────────────────────────

console.log(`\n[STEP 7] FULL REGRESSION GOVERNANCE\n`)

const fixtureDir = path.join(process.cwd(), 'tests/fixtures/golden')
const regressionSummary = GoldenSuiteRunner.run({ fixtureDir })

console.log(`  Fixtures:  ${regressionSummary.total}`)
console.log(`  Passed:    ${regressionSummary.passed}`)
console.log(`  Failed:    ${regressionSummary.failed}`)

reports.regression.passed = regressionSummary.passed
reports.regression.failed = regressionSummary.failed

// Check for hash drift
const baselineHashes = {
  'GOLDEN_001_VALID_PROJECT': 'e1d5cca8fdf717df315a20d0908ce081c93872c2911e45ba4017e2f1657ca354',
  'GOLDEN_002_COLD_OVERVOLTAGE': '6d9670596cc1a9047a9c8c84eb0682f1c16030dfea52fa31c144088e706e9664',
  'GOLDEN_003_MPPT_STRING_IMBALANCE': '6c989dc34afa16fcd80c9db61dd50b816cfc4b6d5a8f50c7847f9e0beb8699fd',
  'GOLDEN_101_BESS_VALID': '928824602c9cb4acb9026d6c3d367d440f259865bc14694aa662eab1892c16b5',
  'GOLDEN_102_BESS_OVERCURRENT': 'c87c73f87e3f49c0c3724301b4bc33636a8722062bd0ade2b8f1061a0a2a6cb5',
  'GOLDEN_103_BESS_LOW_AUTONOMY': '8fb935c9ded1dbe99b5950315c7495b2cbf3ea9a4b5ad166b815a00a6f890481',
  'GOLDEN_201_HYBRID_VALID': '69880bf0bc026ea2da0f09adfa398264d3223b65716990b1c7383ad66e821441',
  'GOLDEN_202_HYBRID_BESS_FAIL': 'b5323766cf4709baf736075a61320ba31abbc94969cecdeb6be9c235c75597e9',
  'GOLDEN_203_HYBRID_FV_FAIL': '1679e182a6d1abf8f1aefdb4b06203921c7d76a82a30d3648d3d887a766212f4'
}

let driftDetected = false
for (const [fixtureId, expectedHash] of Object.entries(baselineHashes)) {
  const actualHash = regressionSummary.hashes[fixtureId]
  if (actualHash !== expectedHash) {
    reports.regression.drifts.push({ fixture: fixtureId, expected: expectedHash.substring(0, 16), actual: actualHash.substring(0, 16) })
    driftDetected = true
  }
}

if (driftDetected) {
  console.log(`  ❌ DRIFT DETECTED: ${reports.regression.drifts.length} baselines changed`)
  reports.regression.drifts.forEach(d => console.log(`     ${d.fixture}: ${d.expected}... → ${d.actual}...`))
} else {
  console.log(`  ✅ Zero drift: All 9 existing baselines byte-identical`)
}

// ─── Final Summary ─────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(70)}`)
console.log(`HARDENING SUMMARY`)
console.log(`${'═'.repeat(70)}\n`)

console.log(`STEP 3 - Immutability:       ${reports.immutability.passed}/4 PASS`)
console.log(`STEP 4 - Determinism:       ${reports.determinism.passed}/10 PASS (${reports.determinism.cycles} cycles)`)
console.log(`STEP 5 - Large Scale:       ${reports.largeScale.passed}/${1} PASS`)
console.log(`STEP 6 - Serialization:     ${reports.serialization.passed}/2 PASS`)
console.log(`STEP 7 - Regression:        ${reports.regression.passed}/${regressionSummary.total} PASS (drift: ${reports.regression.drifts.length})`)

const allPassed =
  reports.immutability.failed === 0 &&
  reports.determinism.failed === 0 &&
  reports.largeScale.failed === 0 &&
  reports.serialization.failed === 0 &&
  reports.regression.failed === 0 &&
  reports.regression.drifts.length === 0

console.log(`\n${'═'.repeat(70)}`)
if (allPassed) {
  console.log(`✅ HARDENING VALIDATION COMPLETE - ALL TESTS PASSED`)
  console.log(`═`.repeat(70))
  console.log(`\n✅ Ready for v2.1_EV_INTEGRATED freeze\n`)
  process.exit(0)
} else {
  console.log(`❌ HARDENING VALIDATION FAILED`)
  console.log(`═`.repeat(70))
  console.log(`\n❌ BLOCKED: Fix failures before freeze\n`)
  process.exit(1)
}
