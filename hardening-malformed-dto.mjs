#!/usr/bin/env node

/**
 * STEP 2: Malformed DTO Hardening
 *
 * Tests resilience against malformed input structures:
 * - Missing required fields
 * - Invalid field types
 * - Out-of-range values
 * - Corrupted nested structures
 * - Null/undefined values
 *
 * Requirements:
 * - Deterministic rejection
 * - Stable error handling
 * - No runtime crashes
 * - No state corruption
 * - No hidden mutations
 */

import { validateElectricalRules } from './backend/src/electrical/validators/electricalRulesValidator.js'

const tests = []
let passCount = 0
let failCount = 0
let crashCount = 0

function testMalformed(name, payload, expectCode = null) {
  const result = { name, status: 'UNKNOWN', details: {} }

  try {
    const output = validateElectricalRules(payload)

    if (output.aprovado === false) {
      result.status = 'PASS'
      result.details.reason = `Gracefully rejected: ${output.falhas[0] || 'validation failed'}`
      passCount++
    } else {
      result.status = 'FAIL'
      result.details.reason = `Should reject but approved=${output.aprovado}`
      failCount++
    }
  } catch (err) {
    if (expectCode && err.code === expectCode) {
      result.status = 'PASS'
      result.details.reason = `Correctly threw: ${err.code}`
      passCount++
    } else if (expectCode) {
      result.status = 'FAIL'
      result.details.reason = `Wrong error: expected ${expectCode}, got ${err.code}`
      failCount++
    } else {
      result.status = 'FAIL'
      result.details.reason = `Unexpected throw: ${err.code}`
      failCount++
    }
  }

  tests.push(result)
  console.log(`[${result.status === 'PASS' ? '✅' : '❌'}] ${name} → ${result.details.reason}`)
}

console.log(`\n${'═'.repeat(60)}`)
console.log(`STEP 2: MALFORMED DTO HARDENING`)
console.log(`${'═'.repeat(60)}\n`)

// ─── EV DTO Malformations ─────────────────────────────────────────────────

console.log('EV DTO Malformations:\n')

testMalformed(
  'EV: missing carregadores',
  {
    engenharia: { temperatura_minima_projeto: 5, temperatura_maxima_projeto: 40 },
    mobilidade: {
      demanda_simultanea_kw: 7.4,
      potencia_total_kw: 7.4,
      fator_simultaneidade: 1.0,
      estrategia_carregamento: 'SEQUENCIAL',
      limite_rede_kw: 30.0,
      prioridade_carga: 0.5,
      modo_operacao: 'CARREGAMENTO',
      protecoes: { rcd_enabled: true },
      temperatura_minima_projeto: 5,
      temperatura_maxima_projeto: 40
    }
  }
)

testMalformed(
  'EV: carregadores is not array',
  {
    engenharia: { temperatura_minima_projeto: 5, temperatura_maxima_projeto: 40 },
    mobilidade: {
      carregadores: 'not-an-array',
      demanda_simultanea_kw: 7.4,
      potencia_total_kw: 7.4,
      fator_simultaneidade: 1.0,
      estrategia_carregamento: 'SEQUENCIAL',
      limite_rede_kw: 30.0,
      prioridade_carga: 0.5,
      modo_operacao: 'CARREGAMENTO',
      protecoes: { rcd_enabled: true },
      temperatura_minima_projeto: 5,
      temperatura_maxima_projeto: 40
    }
  }
)

testMalformed(
  'EV: demanda_simultanea_kw negative',
  {
    engenharia: { temperatura_minima_projeto: 5, temperatura_maxima_projeto: 40 },
    mobilidade: {
      carregadores: [],
      demanda_simultanea_kw: -7.4,
      potencia_total_kw: 7.4,
      fator_simultaneidade: 1.0,
      estrategia_carregamento: 'SEQUENCIAL',
      limite_rede_kw: 30.0,
      prioridade_carga: 0.5,
      modo_operacao: 'CARREGAMENTO',
      protecoes: { rcd_enabled: true },
      temperatura_minima_projeto: 5,
      temperatura_maxima_projeto: 40
    }
  }
)

testMalformed(
  'EV: fator_simultaneidade > 1.0',
  {
    engenharia: { temperatura_minima_projeto: 5, temperatura_maxima_projeto: 40 },
    mobilidade: {
      carregadores: [],
      demanda_simultanea_kw: 7.4,
      potencia_total_kw: 7.4,
      fator_simultaneidade: 1.5,
      estrategia_carregamento: 'SEQUENCIAL',
      limite_rede_kw: 30.0,
      prioridade_carga: 0.5,
      modo_operacao: 'CARREGAMENTO',
      protecoes: { rcd_enabled: true },
      temperatura_minima_projeto: 5,
      temperatura_maxima_projeto: 40
    }
  }
)

testMalformed(
  'EV: estrategia_carregamento invalid',
  {
    engenharia: { temperatura_minima_projeto: 5, temperatura_maxima_projeto: 40 },
    mobilidade: {
      carregadores: [],
      demanda_simultanea_kw: 7.4,
      potencia_total_kw: 7.4,
      fator_simultaneidade: 1.0,
      estrategia_carregamento: 'INVALID_STRATEGY',
      limite_rede_kw: 30.0,
      prioridade_carga: 0.5,
      modo_operacao: 'CARREGAMENTO',
      protecoes: { rcd_enabled: true },
      temperatura_minima_projeto: 5,
      temperatura_maxima_projeto: 40
    }
  }
)

testMalformed(
  'EV: modo_operacao invalid',
  {
    engenharia: { temperatura_minima_projeto: 5, temperatura_maxima_projeto: 40 },
    mobilidade: {
      carregadores: [],
      demanda_simultanea_kw: 7.4,
      potencia_total_kw: 7.4,
      fator_simultaneidade: 1.0,
      estrategia_carregamento: 'SEQUENCIAL',
      limite_rede_kw: 30.0,
      prioridade_carga: 0.5,
      modo_operacao: 'INVALID_MODE',
      protecoes: { rcd_enabled: true },
      temperatura_minima_projeto: 5,
      temperatura_maxima_projeto: 40
    }
  }
)

testMalformed(
  'EV: protecoes is null',
  {
    engenharia: { temperatura_minima_projeto: 5, temperatura_maxima_projeto: 40 },
    mobilidade: {
      carregadores: [],
      demanda_simultanea_kw: 7.4,
      potencia_total_kw: 7.4,
      fator_simultaneidade: 1.0,
      estrategia_carregamento: 'SEQUENCIAL',
      limite_rede_kw: 30.0,
      prioridade_carga: 0.5,
      modo_operacao: 'CARREGAMENTO',
      protecoes: null,
      temperatura_minima_projeto: 5,
      temperatura_maxima_projeto: 40
    }
  }
)

testMalformed(
  'EV: mobilidade is null',
  {
    engenharia: { temperatura_minima_projeto: 5, temperatura_maxima_projeto: 40 },
    mobilidade: null
  }
)

testMalformed(
  'EV: mobilidade is array',
  {
    engenharia: { temperatura_minima_projeto: 5, temperatura_maxima_projeto: 40 },
    mobilidade: []
  }
)

// ─── BESS DTO Malformations ───────────────────────────────────────────────

console.log('\nBESS DTO Malformations:\n')

testMalformed(
  'BESS: tensao_banco < 400V',
  {
    engenharia: { temperatura_minima_projeto: 5, temperatura_maxima_projeto: 40 },
    armazenamento: {
      banco_baterias_kwh: 100,
      profundidade_descarga: 0.8,
      autonomia_horas: 6,
      potencia_saida_kw: 10,
      tensao_banco: 300,
      eficiencia_sistema: 0.95,
      temperatura_minima_projeto: 5,
      temperatura_maxima_projeto: 40
    }
  }
)

testMalformed(
  'BESS: tensao_banco > 960V',
  {
    engenharia: { temperatura_minima_projeto: 5, temperatura_maxima_projeto: 40 },
    armazenamento: {
      banco_baterias_kwh: 100,
      profundidade_descarga: 0.8,
      autonomia_horas: 6,
      potencia_saida_kw: 10,
      tensao_banco: 1000,
      eficiencia_sistema: 0.95,
      temperatura_minima_projeto: 5,
      temperatura_maxima_projeto: 40
    }
  }
)

testMalformed(
  'BESS: profundidade_descarga > 1.0',
  {
    engenharia: { temperatura_minima_projeto: 5, temperatura_maxima_projeto: 40 },
    armazenamento: {
      banco_baterias_kwh: 100,
      profundidade_descarga: 1.5,
      autonomia_horas: 6,
      potencia_saida_kw: 10,
      tensao_banco: 600,
      eficiencia_sistema: 0.95,
      temperatura_minima_projeto: 5,
      temperatura_maxima_projeto: 40
    }
  }
)

// ─── Project Structure Malformations ───────────────────────────────────────

console.log('\nProject Structure Malformations:\n')

testMalformed(
  'Project: projectData is null',
  null,
  'ERR_ESTRUTURA_PROJETO_INVALIDA'
)

testMalformed(
  'Project: projectData is array',
  [],
  'ERR_ESTRUTURA_PROJETO_INVALIDA'
)

testMalformed(
  'Project: engenharia missing',
  {
    geracao: {
      inversores: [],
      modulos: [],
      strings: []
    }
  },
  'ERR_ENGENHARIA_INVALIDA'
)

testMalformed(
  'Project: engenharia is not object',
  {
    engenharia: 'not-an-object',
    geracao: {
      inversores: [],
      modulos: [],
      strings: []
    }
  },
  'ERR_ENGENHARIA_INVALIDA'
)

// ─── Summary ──────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`)
console.log(`MALFORMED DTO HARDENING SUMMARY`)
console.log(`${'═'.repeat(60)}`)
console.log(`Total Tests:       ${tests.length}`)
console.log(`Passed:            ${passCount}`)
console.log(`Failed:            ${failCount}`)
console.log(`Crashed:           ${crashCount}`)
console.log(`${'═'.repeat(60)}\n`)

if (crashCount > 0) {
  console.log('🚨 CRASHES DETECTED:')
  tests.filter(t => t.status === 'CRASH').forEach(t => {
    console.log(`  - ${t.name}: ${t.details.error}`)
  })
  process.exit(1)
} else if (failCount > 0) {
  console.log('❌ FAILURES:')
  tests.filter(t => t.status === 'FAIL').forEach(t => {
    console.log(`  - ${t.name}: ${t.details.reason}`)
  })
  process.exit(1)
} else {
  console.log('✅ All malformed DTO tests passed\n')
  process.exit(0)
}
