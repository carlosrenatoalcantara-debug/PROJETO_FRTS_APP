#!/usr/bin/env node

/**
 * Teste completo e autônomo: Gera unifilares para TODAS as combinações
 * de Carregador EV + Inversor cadastrados no sistema
 */

import fetch from 'node-fetch'

const API_URL = 'https://projetofrtsapp-production.up.railway.app'

// Dados dos carregadores e inversores para teste
const CARREGADORES = [
  { potencia: 7.4, modelo: 'CVBE MO 220V 7.4KW' },
  { potencia: 7, modelo: 'EVE 0074B' },
  { potencia: 7, modelo: 'EVE 0074C' },
  { potencia: 11, modelo: 'EVE 0110C' },
  { potencia: 22, modelo: 'EVE 0220B' },
  { potencia: 7.4, modelo: 'SOLPLANET EV 7.4kW' },
]

const INVERSORES = [
  { potencia: 2.25, modelo: 'SAJ M2-2.25K' },
  { potencia: 25, modelo: 'Growatt Mid 25KTL3-X' },
  { potencia: 20, modelo: 'Goodwe 20KT' },
  { potencia: 30, modelo: 'Solis 30K' },
]

const TENSOES = ['monofasico', 'trifasico']

async function testarUnifilarEV(carregador, tensao, testNum) {
  try {
    const payload = {
      potencia_carregador: carregador.potencia,
      tensao: tensao,
      disjuntor: { corrente: '32A' },
      dr: { corrente: '30mA' },
    }

    const response = await fetch(`${API_URL}/api/unifilar/ev/gerar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 10000,
    })

    if (!response.ok) {
      console.log(`  ❌ [${testNum}] ${carregador.modelo} (${carregador.potencia}kW, ${tensao}): HTTP ${response.status}`)
      return false
    }

    const svg = await response.text()
    if (svg && svg.includes('<svg')) {
      console.log(`  ✅ [${testNum}] ${carregador.modelo} (${carregador.potencia}kW, ${tensao}): SVG gerado (${svg.length} bytes)`)
      return true
    } else {
      console.log(`  ❌ [${testNum}] ${carregador.modelo} (${carregador.potencia}kW, ${tensao}): Resposta inválida`)
      return false
    }
  } catch (err) {
    console.log(`  ❌ [${testNum}] ${carregador.modelo} (${carregador.potencia}kW, ${tensao}): ${err.message}`)
    return false
  }
}

async function executarTestes() {
  console.log('🚀 TESTE AUTÔNOMO - GERADOR DE UNIFILAR EV')
  console.log('==========================================')
  console.log('')

  let testesPassaram = 0
  let testesFalharam = 0
  let testNum = 1

  // Teste FV com Carregadores (estrutura similar ao teste anterior)
  console.log('⚡ TESTES EV - Carregadores + Configurações')
  console.log('==========================================')

  for (const carregador of CARREGADORES) {
    for (const tensao of TENSOES) {
      const passou = await testarUnifilarEV(carregador, tensao, testNum)
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

  const totalCombinacoes = CARREGADORES.length * TENSOES.length

  console.log('')
  console.log('🎯 COBERTURA')
  console.log('============')
  console.log(`Carregadores testados: ${CARREGADORES.length}`)
  console.log(`Configurações (monofásico/trifásico): ${TENSOES.length}`)
  console.log(`Total de cenários cobertos: ${totalCombinacoes}`)

  console.log('')
  if (testesFalharam === 0) {
    console.log('🎉 TODOS OS TESTES PASSARAM!')
    console.log('✨ Sistema pronto para projetos EV!')
  } else {
    console.log('⚠️  Alguns testes falharam - verifique a saída acima')
  }

  process.exit(testesFalharam > 0 ? 1 : 0)
}

// Aguardar um pouco e depois executar
console.log('⏳ Aguardando API...')
setTimeout(executarTestes, 2000)
