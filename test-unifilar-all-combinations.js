#!/usr/bin/env node

/**
 * Script de teste autônomo do gerador de unifilar
 * Testa TODAS as combinações possíveis de módulo + inversor
 */

import fetch from 'node-fetch'
import fs from 'fs'

const API_URL = 'https://projetofrtsapp-production.up.railway.app'

// Simular dados de módulos e inversores do banco
const MODULOS = [
  { id: 1, modelo: 'DAH 440W', potencia_wp: 440, voc: 48.5, vmp: 40.2, isc: 11.8, imp: 10.95 },
  { id: 2, modelo: 'DAH 585W', potencia_wp: 585, voc: 49.2, vmp: 41.8, isc: 14.1, imp: 13.4 },
  { id: 3, modelo: 'ZN Shine 570W', potencia_wp: 570, voc: 48.8, vmp: 40.5, isc: 13.8, imp: 12.1 },
  { id: 4, modelo: 'Risen 540W', potencia_wp: 540, voc: 48.3, vmp: 40.1, isc: 12.9, imp: 11.8 },
]

const INVERSORES = [
  { id: 1, modelo: 'SAJ M2-2.25K', potenciaKW: 2.25, tipo: 'microinversor' },
  { id: 2, modelo: 'Growatt Mid 25KTL3-X', potenciaKW: 25, tipo: 'string' },
  { id: 3, modelo: 'Goodwe 20KT', potenciaKW: 20, tipo: 'string' },
  { id: 4, modelo: 'Solis 30K', potenciaKW: 30, tipo: 'string' },
]

const CARREGADORES_EV = [
  { id: 1, modelo: 'Placeholder EV Charger', potenciaKW: 7, tipo: 'ev' },
]

/**
 * Gera unifilar FV para combinação módulo+inversor
 */
async function testarUnifilarFV(modulo, inversor, testNum) {
  try {
    const payload = {
      paineis: modulo.potencia_wp,
      strings: [{ id: 1, paineis: 10 }],
      inversor: {
        potenciaKW: inversor.potenciaKW,
        modelo: inversor.modelo,
        tipo: inversor.tipo,
      },
      tensao_rede: 220,
    }

    const response = await fetch(`${API_URL}/api/unifilar/gerar-fv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 10000,
    })

    if (!response.ok) {
      console.log(`  ❌ [${testNum}] ${modulo.modelo} + ${inversor.modelo}: ${response.status}`)
      return false
    }

    const svg = await response.text()
    if (svg && svg.includes('<svg')) {
      console.log(`  ✅ [${testNum}] ${modulo.modelo} + ${inversor.modelo}: SVG gerado (${svg.length} bytes)`)
      return true
    } else {
      console.log(`  ❌ [${testNum}] ${modulo.modelo} + ${inversor.modelo}: Resposta inválida`)
      return false
    }
  } catch (err) {
    console.log(`  ❌ [${testNum}] ${modulo.modelo} + ${inversor.modelo}: ${err.message}`)
    return false
  }
}

/**
 * Gera unifilar EV para combinação carregador+inversor
 */
async function testarUnifilarEV(carregador, inversor, testNum) {
  try {
    const payload = {
      carregador: {
        modelo: carregador.modelo,
        potenciaKW: carregador.potenciaKW,
      },
      inversor: {
        modelo: inversor.modelo,
        potenciaKW: inversor.potenciaKW,
      },
      tensao_rede: 220,
    }

    const response = await fetch(`${API_URL}/api/unifilar/gerar-ev`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 10000,
    })

    if (!response.ok) {
      console.log(`  ❌ [${testNum}] ${carregador.modelo} + ${inversor.modelo}: ${response.status}`)
      return false
    }

    const svg = await response.text()
    if (svg && svg.includes('<svg')) {
      console.log(`  ✅ [${testNum}] ${carregador.modelo} + ${inversor.modelo}: SVG gerado (${svg.length} bytes)`)
      return true
    } else {
      console.log(`  ❌ [${testNum}] ${carregador.modelo} + ${inversor.modelo}: Resposta inválida`)
      return false
    }
  } catch (err) {
    console.log(`  ❌ [${testNum}] ${carregador.modelo} + ${inversor.modelo}: ${err.message}`)
    return false
  }
}

/**
 * Executa testes
 */
async function executarTestes() {
  console.log('🚀 TESTE AUTÔNOMO - GERADOR DE UNIFILAR')
  console.log('======================================')
  console.log('')

  let testesPassaram = 0
  let testesFalharam = 0
  let testNum = 1

  // Testar FV
  console.log('📊 TESTES FV (Módulo + Inversor)')
  console.log('================================')
  for (const modulo of MODULOS) {
    for (const inversor of INVERSORES) {
      const passou = await testarUnifilarFV(modulo, inversor, testNum)
      if (passou) testesPassaram++
      else testesFalharam++
      testNum++
    }
  }

  console.log('')
  console.log('⚡ TESTES EV (Carregador + Inversor)')
  console.log('===================================')
  for (const carregador of CARREGADORES_EV) {
    for (const inversor of INVERSORES) {
      const passou = await testarUnifilarEV(carregador, inversor, testNum)
      if (passou) testesPassaram++
      else testesFalharam++
      testNum++
    }
  }

  // Resumo
  console.log('')
  console.log('📋 RESUMO')
  console.log('=========')
  console.log(`Total de testes: ${testesPassaram + testesFalharam}`)
  console.log(`✅ Passaram: ${testesPassaram}`)
  console.log(`❌ Falharam: ${testesFalharam}`)
  console.log(`📈 Taxa de sucesso: ${((testesPassaram / (testesPassaram + testesFalharam)) * 100).toFixed(1)}%`)

  const totalCombinacoesFV = MODULOS.length * INVERSORES.length
  const totalCombinacoes = totalCombinacoesFV + CARREGADORES_EV.length * INVERSORES.length

  console.log('')
  console.log('🎯 COBERTURA')
  console.log('============')
  console.log(`Combinações FV testadas: ${totalCombinacoesFV}`)
  console.log(`Combinações EV testadas: ${CARREGADORES_EV.length * INVERSORES.length}`)
  console.log(`Total de cenários cobertos: ${totalCombinacoes}`)

  process.exit(testesFalharam > 0 ? 1 : 0)
}

// Executar
console.log('Aguardando API...')
setTimeout(executarTestes, 2000)
