#!/usr/bin/env node

/**
 * STEP 1: Multi-Domain Stress Validation
 *
 * Tests all domain combinations:
 * 1. FV + BESS + EV simultaneous
 * 2. FV-only
 * 3. BESS-only
 * 4. EV-only
 * 5. FV + EV hybrid
 * 6. BESS + EV hybrid
 * 7. Missing all domains (should fail gracefully)
 * 8. Partial DTO (missing required fields)
 */

import { validateElectricalRules } from './backend/src/electrical/validators/electricalRulesValidator.js'
import { createHash } from 'crypto'

const scenarios = []
let passCount = 0
let failCount = 0

function logScenario(name, status, details = {}) {
  const result = { name, status, ...details }
  scenarios.push(result)
  console.log(`[${status === 'PASS' ? '✅' : '❌'}] ${name}`)
  if (details.message) console.log(`    → ${details.message}`)
  if (status === 'PASS') passCount++
  else failCount++
}

// ─── SCENARIO 1: FV + BESS + EV (Full Multi-Domain) ────────────────────────

console.log('\n[SCENARIO 1] FV + BESS + EV Simultaneous Execution\n')

const payload1 = {
  engenharia: { temperatura_minima_projeto: 5, temperatura_maxima_projeto: 40 },
  geracao: {
    inversores: [
      {
        modelo: 'SMA_SB_6000TL',
        potencia_nominal_kw: 6.0,
        v_max_dc: 600,
        v_mppt_min: 125,
        v_mppt_max: 550,
        i_max_mppt: 18,
        mppts_disponiveis: 2
      }
    ],
    modulos: [
      {
        modelo: 'CANADIAN_CS3W_400',
        p_max: 400,
        v_oc: 49.2,
        i_sc: 10.5,
        v_mpp: 41.3,
        coef_temp_voc: -0.0028,
        coef_temp_pmax: -0.0037
      }
    ],
    strings: [
      {
        quantidade_modulos: 10,
        quantidade_strings_paralelo: 1,
        inversor_index: 0,
        modulo_index: 0,
        mppt_index: 0
      }
    ],
    potencia_kwp: 4.0
  },
  armazenamento: {
    banco_baterias_kwh: 100,
    profundidade_descarga: 0.8,
    autonomia_horas: 6,
    potencia_saida_kw: 10,
    tensao_banco: 600,
    eficiencia_sistema: 0.95,
    temperatura_minima_projeto: 5,
    temperatura_maxima_projeto: 40
  },
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

try {
  const result1 = validateElectricalRules(payload1)
  const hash1 = createHash('sha256').update(JSON.stringify(result1)).digest('hex')

  const hasAllDomains = result1.ev_score !== undefined && result1.bess_score !== undefined
  const allApproved = result1.aprovado && result1.ev_score?.aprovado && result1.bess_score?.aprovado

  if (hasAllDomains && allApproved && result1.score_eletrico > 0) {
    logScenario('FV + BESS + EV simultaneous', 'PASS', {
      message: `All domains validated: FV=${result1.score_eletrico.toFixed(2)}, BESS=${result1.bess_score.score.toFixed(2)}, EV=${result1.ev_score.score.toFixed(2)}`,
      hash: hash1.substring(0, 16)
    })
  } else {
    logScenario('FV + BESS + EV simultaneous', 'FAIL', {
      message: `Missing domain results: ev_score=${!!result1.ev_score}, bess_score=${!!result1.bess_score}`
    })
  }
} catch (err) {
  logScenario('FV + BESS + EV simultaneous', 'FAIL', { message: err.message })
}

// ─── SCENARIO 2: FV-only ────────────────────────────────────────────────────

console.log('\n[SCENARIO 2] FV-only Execution\n')

const payload2 = {
  engenharia: { temperatura_minima_projeto: 5, temperatura_maxima_projeto: 40 },
  geracao: {
    inversores: [
      {
        modelo: 'SMA_SB_6000TL',
        potencia_nominal_kw: 6.0,
        v_max_dc: 600,
        v_mppt_min: 125,
        v_mppt_max: 550,
        i_max_mppt: 18,
        mppts_disponiveis: 2
      }
    ],
    modulos: [
      {
        modelo: 'CANADIAN_CS3W_400',
        p_max: 400,
        v_oc: 49.2,
        i_sc: 10.5,
        v_mpp: 41.3,
        coef_temp_voc: -0.0028,
        coef_temp_pmax: -0.0037
      }
    ],
    strings: [
      {
        quantidade_modulos: 10,
        quantidade_strings_paralelo: 1,
        inversor_index: 0,
        modulo_index: 0,
        mppt_index: 0
      }
    ],
    potencia_kwp: 4.0
  }
}

try {
  const result2 = validateElectricalRules(payload2)
  const noBess = result2.bess_score === undefined
  const noEv = result2.ev_score === undefined

  if (noBess && noEv && result2.score_eletrico > 0) {
    logScenario('FV-only execution', 'PASS', {
      message: `FV validated, no BESS/EV: score=${result2.score_eletrico.toFixed(2)}`
    })
  } else {
    logScenario('FV-only execution', 'FAIL', {
      message: `Unexpected domain fields: bess_score=${!!result2.bess_score}, ev_score=${!!result2.ev_score}`
    })
  }
} catch (err) {
  logScenario('FV-only execution', 'FAIL', { message: err.message })
}

// ─── SCENARIO 3: BESS-only ──────────────────────────────────────────────────

console.log('\n[SCENARIO 3] BESS-only Execution\n')

const payload3 = {
  engenharia: { temperatura_minima_projeto: 5, temperatura_maxima_projeto: 40 },
  armazenamento: {
    banco_baterias_kwh: 100,
    profundidade_descarga: 0.8,
    autonomia_horas: 6,
    potencia_saida_kw: 10,
    tensao_banco: 600,
    eficiencia_sistema: 0.95,
    temperatura_minima_projeto: 5,
    temperatura_maxima_projeto: 40
  }
}

try {
  const result3 = validateElectricalRules(payload3)
  const hasBess = result3.bess_score !== undefined
  const noFv = result3.validacoes?.voc === undefined
  const noEv = result3.ev_score === undefined

  if (hasBess && noEv && result3.bess_score.aprovado) {
    logScenario('BESS-only execution', 'PASS', {
      message: `BESS validated: score=${result3.bess_score.score.toFixed(2)}`
    })
  } else {
    logScenario('BESS-only execution', 'FAIL', {
      message: `Unexpected results: bess_score=${!!result3.bess_score}, ev_score=${!!result3.ev_score}`
    })
  }
} catch (err) {
  logScenario('BESS-only execution', 'FAIL', { message: err.message })
}

// ─── SCENARIO 4: EV-only ────────────────────────────────────────────────────

console.log('\n[SCENARIO 4] EV-only Execution\n')

const payload4 = {
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

try {
  const result4 = validateElectricalRules(payload4)
  const hasEv = result4.ev_score !== undefined
  const noBess = result4.bess_score === undefined
  const noFv = result4.validacoes?.voc === undefined

  if (hasEv && noBess && result4.ev_score.aprovado !== undefined) {
    logScenario('EV-only execution', 'PASS', {
      message: `EV validated: score=${result4.ev_score.score.toFixed(2)}, aprovado=${result4.ev_score.aprovado}`
    })
  } else {
    logScenario('EV-only execution', 'FAIL', {
      message: `Unexpected results: ev_score=${!!result4.ev_score}, bess_score=${!!result4.bess_score}`
    })
  }
} catch (err) {
  logScenario('EV-only execution', 'FAIL', { message: err.message })
}

// ─── SCENARIO 5: FV + EV Hybrid ──────────────────────────────────────────────

console.log('\n[SCENARIO 5] FV + EV Hybrid Execution\n')

const payload5 = {
  engenharia: { temperatura_minima_projeto: 5, temperatura_maxima_projeto: 40 },
  geracao: {
    inversores: [
      {
        modelo: 'SMA_SB_6000TL',
        potencia_nominal_kw: 6.0,
        v_max_dc: 600,
        v_mppt_min: 125,
        v_mppt_max: 550,
        i_max_mppt: 18,
        mppts_disponiveis: 2
      }
    ],
    modulos: [
      {
        modelo: 'CANADIAN_CS3W_400',
        p_max: 400,
        v_oc: 49.2,
        i_sc: 10.5,
        v_mpp: 41.3,
        coef_temp_voc: -0.0028,
        coef_temp_pmax: -0.0037
      }
    ],
    strings: [
      {
        quantidade_modulos: 10,
        quantidade_strings_paralelo: 1,
        inversor_index: 0,
        modulo_index: 0,
        mppt_index: 0
      }
    ],
    potencia_kwp: 4.0
  },
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

try {
  const result5 = validateElectricalRules(payload5)
  const hasEv = result5.ev_score !== undefined
  const noBess = result5.bess_score === undefined
  const approvedAll = result5.aprovado && result5.ev_score?.aprovado

  if (hasEv && noBess && approvedAll) {
    logScenario('FV + EV hybrid execution', 'PASS', {
      message: `Both domains: FV=${result5.score_eletrico.toFixed(2)}, EV=${result5.ev_score.score.toFixed(2)}`
    })
  } else {
    logScenario('FV + EV hybrid execution', 'FAIL', {
      message: `Approval mismatch: overall=${result5.aprovado}, ev=${result5.ev_score?.aprovado}`
    })
  }
} catch (err) {
  logScenario('FV + EV hybrid execution', 'FAIL', { message: err.message })
}

// ─── SCENARIO 6: BESS + EV Hybrid ───────────────────────────────────────────

console.log('\n[SCENARIO 6] BESS + EV Hybrid Execution\n')

const payload6 = {
  engenharia: { temperatura_minima_projeto: 5, temperatura_maxima_projeto: 40 },
  armazenamento: {
    banco_baterias_kwh: 100,
    profundidade_descarga: 0.8,
    autonomia_horas: 6,
    potencia_saida_kw: 10,
    tensao_banco: 600,
    eficiencia_sistema: 0.95,
    temperatura_minima_projeto: 5,
    temperatura_maxima_projeto: 40
  },
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

try {
  const result6 = validateElectricalRules(payload6)
  const hasEv = result6.ev_score !== undefined
  const hasBess = result6.bess_score !== undefined
  const noFv = !result6.validacoes?.voc
  const approvedAll = result6.aprovado && result6.ev_score?.aprovado && result6.bess_score?.aprovado

  if (hasEv && hasBess && approvedAll) {
    logScenario('BESS + EV hybrid execution', 'PASS', {
      message: `Both domains: BESS=${result6.bess_score.score.toFixed(2)}, EV=${result6.ev_score.score.toFixed(2)}`
    })
  } else {
    logScenario('BESS + EV hybrid execution', 'FAIL', {
      message: `Missing domains or approval failed`
    })
  }
} catch (err) {
  logScenario('BESS + EV hybrid execution', 'FAIL', { message: err.message })
}

// ─── SCENARIO 7: Missing All Domains (Should Fail Gracefully) ───────────────

console.log('\n[SCENARIO 7] Missing All Domains (Graceful Failure)\n')

const payload7 = {
  engenharia: { temperatura_minima_projeto: 5, temperatura_maxima_projeto: 40 }
}

try {
  const result7 = validateElectricalRules(payload7)
  if (result7.aprovado === false) {
    logScenario('Missing all domains fails gracefully', 'PASS', {
      message: `Correctly rejected: ${result7.falhas.join(', ')}`
    })
  } else {
    logScenario('Missing all domains fails gracefully', 'FAIL', {
      message: `Should reject but approved=${result7.aprovado}`
    })
  }
} catch (err) {
  logScenario('Missing all domains fails gracefully', 'FAIL', {
    message: `Should not throw: ${err.code || err.message}`
  })
}

// ─── SCENARIO 8: Partial EV DTO (Missing Required Fields) ──────────────────

console.log('\n[SCENARIO 8] Partial EV DTO (Missing Required Fields)\n')

const payload8 = {
  engenharia: { temperatura_minima_projeto: 5, temperatura_maxima_projeto: 40 },
  mobilidade: {
    carregadores: [],
    // Missing: demanda_simultanea_kw, potencia_total_kw, etc.
  }
}

try {
  const result8 = validateElectricalRules(payload8)
  // Validation should fail gracefully (not throw)
  if (result8.aprovado === false && result8.falhas.length > 0) {
    logScenario('Partial EV DTO handling', 'PASS', {
      message: `Gracefully rejected: ${result8.falhas.join(', ')}`
    })
  } else {
    logScenario('Partial EV DTO handling', 'FAIL', {
      message: `Should reject but got aprovado=${result8.aprovado}`
    })
  }
} catch (err) {
  logScenario('Partial EV DTO handling', 'FAIL', {
    message: `Should not throw (graceful failure): ${err.code}`
  })
}

// ─── SUMMARY ─────────────────────────────────────────────────────────────────

console.log(`\n${'━'.repeat(60)}`)
console.log(`MULTI-DOMAIN STRESS TEST SUMMARY`)
console.log(`${'━'.repeat(60)}`)
console.log(`Total Scenarios:  ${scenarios.length}`)
console.log(`Passed:           ${passCount}`)
console.log(`Failed:           ${failCount}`)
console.log(`${'━'.repeat(60)}\n`)

if (failCount > 0) {
  console.log('FAILURES:')
  scenarios.filter(s => s.status === 'FAIL').forEach(s => {
    console.log(`  - ${s.name}: ${s.message}`)
  })
  process.exit(1)
} else {
  console.log('✅ All multi-domain scenarios passed\n')
  process.exit(0)
}
