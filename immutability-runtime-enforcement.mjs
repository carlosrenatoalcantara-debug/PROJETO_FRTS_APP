#!/usr/bin/env node

/**
 * STEP 1-2: Runtime Immutability Enforcement Under Strict Mode
 *
 * Executes controlled mutation attacks in strict mode to verify
 * Object.freeze() protection is actively enforced at runtime.
 *
 * Requirements:
 * - use explicit "use strict"
 * - verify TypeError for each mutation attempt
 * - verify mutations do NOT persist
 * - validate deep freeze recursively
 * - validate no runtime leaks
 */

'use strict'

import fs from 'fs'
import { validateElectricalRules } from './backend/src/electrical/validators/electricalRulesValidator.js'
import { validateEVDomain } from './backend/src/electrical/validators/evDomainValidator.js'
import { validateMobilityProjectDTO } from './backend/src/electrical/dto/mobilityProjectDTO.js'

const report = {
  totalMutationAttempts: 0,
  successfulTypeErrors: 0,
  mutationsBypassers: [],
  deepFreezeIssues: [],
  runtimeLeaks: []
}

function testMutation(context, description, targetObj, mutation) {
  report.totalMutationAttempts++

  const originalValue = mutation.getOriginal()
  let typeErrorThrown = false
  let mutationPersisted = false

  try {
    mutation.attempt()
    // If we reach here, no error was thrown
  } catch (err) {
    if (err instanceof TypeError) {
      typeErrorThrown = true
    } else {
      console.log(`  ❌ ${description} - Wrong error type: ${err.name}`)
      report.mutationsBypassers.push({ description, error: err.name })
      return
    }
  }

  // Check if mutation persisted despite error
  const newValue = mutation.getActual()
  mutationPersisted = newValue !== originalValue

  if (typeErrorThrown && !mutationPersisted) {
    report.successfulTypeErrors++
    console.log(`  ✅ ${description} - TypeError enforced, mutation blocked`)
  } else if (!typeErrorThrown) {
    console.log(`  ❌ ${description} - No TypeError thrown (SECURITY BREACH)`)
    report.mutationsBypassers.push({ description, reason: 'No error thrown' })
  } else if (mutationPersisted) {
    console.log(`  ❌ ${description} - Mutation persisted despite TypeError (FREEZE BYPASS)`)
    report.runtimeLeaks.push({ description, issue: 'Mutation persisted' })
  }
}

function testDeepFreeze(obj, path = 'root') {
  const checks = []

  // Check top-level freeze
  if (!Object.isFrozen(obj)) {
    checks.push({ path: path, status: 'NOT_FROZEN', severity: 'CRITICAL' })
  } else {
    checks.push({ path: path, status: 'FROZEN', severity: 'OK' })
  }

  // Check nested objects recursively
  for (const [key, value] of Object.entries(obj)) {
    const newPath = `${path}.${key}`

    if (value === null || value === undefined) {
      continue
    }

    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        // Check array freeze
        if (!Object.isFrozen(value)) {
          checks.push({ path: newPath, type: 'array', status: 'NOT_FROZEN', severity: 'CRITICAL' })
        } else {
          checks.push({ path: newPath, type: 'array', status: 'FROZEN', severity: 'OK' })
        }

        // Check array elements
        for (let i = 0; i < value.length; i++) {
          const elem = value[i]
          if (typeof elem === 'object' && elem !== null) {
            const elemChecks = testDeepFreeze(elem, `${newPath}[${i}]`)
            checks.push(...elemChecks)
          }
        }
      } else {
        // Check nested object freeze
        if (!Object.isFrozen(value)) {
          checks.push({ path: newPath, type: 'object', status: 'NOT_FROZEN', severity: 'CRITICAL' })
        } else {
          checks.push({ path: newPath, type: 'object', status: 'FROZEN', severity: 'OK' })
        }

        // Recursive check
        const nestedChecks = testDeepFreeze(value, newPath)
        checks.push(...nestedChecks)
      }
    }
  }

  return checks
}

console.log(`\n${'═'.repeat(70)}`)
console.log(`STEP 1-2: RUNTIME IMMUTABILITY ENFORCEMENT (STRICT MODE)`)
console.log(`${'═'.repeat(70)}\n`)

// ─── Test Payload ─────────────────────────────────────────────────────────

const testPayload = {
  engenharia: { temperatura_minima_projeto: 5, temperatura_maxima_projeto: 40 },
  mobilidade: {
    carregadores: [
      {
        modelo: 'WALLBOX_PULSAR_PLUS',
        potencia_nominal_kw: 7.4,
        tipo: 'AC',
        tensao_saida: 230,
        corrente_nominal_a: 32
      }
    ],
    demanda_simultanea_kw: 7.4,
    potencia_total_kw: 7.4,
    fator_simultaneidade: 1.0,
    estrategia_carregamento: 'SEQUENCIAL',
    limite_rede_kw: 30.0,
    prioridade_carga: 0.5,
    modo_operacao: 'CARREGAMENTO',
    protecoes: {
      rcd_enabled: true,
      overvoltage_protection: true,
      overcurrent_protection: true,
      temperature_monitoring: true
    },
    temperatura_minima_projeto: 5,
    temperatura_maxima_projeto: 40
  }
}

// Get orchestration result
console.log('Executing orchestration...\n')
const orchestratedResult = validateElectricalRules(testPayload)

// Build EnergyContext (as used in EV validator)
const energyContext = Object.freeze({
  available_pv_kw: 0,
  available_bess_kw: 0,
  grid_limit_kw: 30,
  load_priority: 0.5,
  operating_mode: 'CARREGAMENTO'
})

// Validate mobility
const mobilityValidated = validateMobilityProjectDTO(testPayload.mobilidade)
const mobilityData = mobilityValidated.data

// ─── MUTATION ATTACK TESTS ───────────────────────────────────────────────

console.log('MUTATION ATTACK TESTS:\n')

// Attack 1: EnergyContext.grid_limit_kw modification
testMutation(
  'EnergyContext mutation',
  'EnergyContext.grid_limit_kw = 9999',
  energyContext,
  {
    getOriginal: () => energyContext.grid_limit_kw,
    attempt: () => { energyContext.grid_limit_kw = 9999 },
    getActual: () => energyContext.grid_limit_kw
  }
)

// Attack 2: EnergyContext.load_priority modification
testMutation(
  'EnergyContext.load_priority mutation',
  'EnergyContext.load_priority = 0.1',
  energyContext,
  {
    getOriginal: () => energyContext.load_priority,
    attempt: () => { energyContext.load_priority = 0.1 },
    getActual: () => energyContext.load_priority
  }
)

// Attack 3: Orchestrated result.aprovado modification
testMutation(
  'Result.aprovado mutation',
  'result.aprovado = false',
  orchestratedResult,
  {
    getOriginal: () => orchestratedResult.aprovado,
    attempt: () => { orchestratedResult.aprovado = false },
    getActual: () => orchestratedResult.aprovado
  }
)

// Attack 4: Orchestrated result.validacoes field mutation
testMutation(
  'Result.validacoes.transformador mutation',
  'result.validacoes.transformador = false',
  orchestratedResult.validacoes,
  {
    getOriginal: () => orchestratedResult.validacoes.transformador,
    attempt: () => { orchestratedResult.validacoes.transformador = false },
    getActual: () => orchestratedResult.validacoes.transformador
  }
)

// Attack 5: Result.alertas array push
testMutation(
  'Result.alertas array mutation',
  'result.alertas.push("INJECTED_ALERT")',
  orchestratedResult.alertas,
  {
    getOriginal: () => orchestratedResult.alertas.length,
    attempt: () => { orchestratedResult.alertas.push('INJECTED_ALERT') },
    getActual: () => orchestratedResult.alertas.length
  }
)

// Attack 6: Result.validacoes object mutation
testMutation(
  'Result.validacoes object mutation',
  'result.validacoes.new_field = true',
  orchestratedResult.validacoes,
  {
    getOriginal: () => orchestratedResult.validacoes.new_field,
    attempt: () => { orchestratedResult.validacoes.new_field = true },
    getActual: () => orchestratedResult.validacoes.new_field
  }
)

// Attack 7: MobilityData carregadores mutation
testMutation(
  'MobilityData.carregadores array mutation',
  'mobilityData.carregadores.push(...)',
  mobilityData.carregadores,
  {
    getOriginal: () => mobilityData.carregadores.length,
    attempt: () => {
      mobilityData.carregadores.push({
        modelo: 'INJECTED',
        potencia_nominal_kw: 100,
        tipo: 'AC',
        tensao_saida: 230,
        corrente_nominal_a: 999
      })
    },
    getActual: () => mobilityData.carregadores.length
  }
)

// Attack 8: MobilityData protecoes modification
testMutation(
  'MobilityData.protecoes.rcd_enabled mutation',
  'mobilityData.protecoes.rcd_enabled = false',
  mobilityData.protecoes,
  {
    getOriginal: () => mobilityData.protecoes.rcd_enabled,
    attempt: () => { mobilityData.protecoes.rcd_enabled = false },
    getActual: () => mobilityData.protecoes.rcd_enabled
  }
)

// Attack 9: EV result from validator
console.log('\nExecuting EV validator for result mutation attacks...\n')
const evResult = validateEVDomain(testPayload.mobilidade, energyContext, testPayload.engenharia)

testMutation(
  'EV Result.aprovado mutation',
  'evResult.aprovado = false',
  evResult,
  {
    getOriginal: () => evResult.aprovado,
    attempt: () => { evResult.aprovado = false },
    getActual: () => evResult.aprovado
  }
)

// Attack 10: EV Result.ev_score mutation
testMutation(
  'EV Result.ev_score mutation',
  'evResult.ev_score = 0',
  evResult,
  {
    getOriginal: () => evResult.ev_score,
    attempt: () => { evResult.ev_score = 0 },
    getActual: () => evResult.ev_score
  }
)

// ─── DEEP FREEZE VERIFICATION ─────────────────────────────────────────────

console.log(`\n${'─'.repeat(70)}`)
console.log(`DEEP FREEZE VERIFICATION:\n`)

const freezeChecks = [
  ...testDeepFreeze(orchestratedResult, 'orchestratedResult'),
  ...testDeepFreeze(energyContext, 'energyContext'),
  ...testDeepFreeze(mobilityData, 'mobilityData'),
  ...testDeepFreeze(evResult, 'evResult')
]

const notFrozenItems = freezeChecks.filter(c => c.status === 'NOT_FROZEN')

if (notFrozenItems.length === 0) {
  console.log(`✅ All structures fully frozen (deep freeze verified)`)
  console.log(`   Total checks: ${freezeChecks.length}`)
  console.log(`   All frozen: ${freezeChecks.length}`)
} else {
  console.log(`❌ NOT FROZEN ITEMS DETECTED:`)
  notFrozenItems.forEach(item => {
    console.log(`   - ${item.path} (${item.type || 'value'}) [${item.severity}]`)
    report.deepFreezeIssues.push(item)
  })
}

// ─── SUMMARY ──────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(70)}`)
console.log(`RUNTIME IMMUTABILITY ENFORCEMENT SUMMARY`)
console.log(`${'═'.repeat(70)}\n`)

console.log(`Mutation Attempts:        ${report.totalMutationAttempts}`)
console.log(`TypeError Enforced:       ${report.successfulTypeErrors}`)
console.log(`Bypassed:                 ${report.mutationsBypassers.length}`)
console.log(`Runtime Leaks:            ${report.runtimeLeaks.length}`)
console.log(`Deep Freeze Issues:       ${report.deepFreezeIssues.length}`)

if (report.mutationsBypassers.length > 0) {
  console.log(`\n❌ SECURITY BREACHES DETECTED:`)
  report.mutationsBypassers.forEach(b => {
    console.log(`   - ${b.description}: ${b.error || b.reason}`)
  })
  process.exit(1)
}

if (report.runtimeLeaks.length > 0) {
  console.log(`\n❌ RUNTIME LEAKS DETECTED:`)
  report.runtimeLeaks.forEach(l => {
    console.log(`   - ${l.description}: ${l.issue}`)
  })
  process.exit(1)
}

if (report.deepFreezeIssues.length > 0) {
  console.log(`\n⚠️  DEEP FREEZE ISSUES:`)
  report.deepFreezeIssues.forEach(i => {
    console.log(`   - ${i.path} (${i.severity})`)
  })
  if (report.deepFreezeIssues.some(i => i.severity === 'CRITICAL')) {
    process.exit(1)
  }
}

console.log(`\n${'═'.repeat(70)}`)
console.log(`✅ RUNTIME IMMUTABILITY ENFORCEMENT VERIFIED`)
console.log(`═`.repeat(70))
console.log(`\nAll ${report.totalMutationAttempts} mutation attempts blocked by strict-mode TypeError.\n`)

// Export report for Step 3
fs.writeFileSync('immutability-runtime-report.json', JSON.stringify(report, null, 2))

process.exit(0)
