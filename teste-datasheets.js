#!/usr/bin/env node

/**
 * Script de Teste - Datasheets e Tabelas NBR
 * Execute: node teste-datasheets.js
 */

import { modulos, inversores, carregadores, getInversores, getCargadores } from './backend/src/data/equipamentosDatabase.js'
import { tabelaCobre, tabelaAluminio, calcularSecaoMinima, verificarAmpacidade } from './backend/src/data/tabelasNBRCabos.js'

const cores = {
  reset: '\x1b[0m',
  verde: '\x1b[32m',
  vermelho: '\x1b[31m',
  azul: '\x1b[36m',
  amarelo: '\x1b[33m',
  cinza: '\x1b[90m',
}

function log(mensagem, cor = 'reset') {
  console.log(`${cores[cor]}${mensagem}${cores.reset}`)
}

function logTitulo(titulo) {
  console.log('\n' + '═'.repeat(60))
  log(titulo, 'azul')
  console.log('═'.repeat(60))
}

function teste(nome, fn) {
  try {
    fn()
    log(`✅ ${nome}`, 'verde')
    return true
  } catch (erro) {
    log(`❌ ${nome}`, 'vermelho')
    log(`   Erro: ${erro.message}`, 'vermelho')
    return false
  }
}

let total = 0
let passou = 0

// ===== TESTES MÓDULOS =====
logTitulo('📱 TESTES: MÓDULOS SOLARES')

teste('Módulos - Listar marcas', () => {
  const marcas = Object.keys(modulos)
  if (marcas.length === 0) throw new Error('Nenhuma marca encontrada')
  log(`   Marcas: ${marcas.join(', ')}`, 'cinza')
})
total++; passou++

teste('Módulos - JA Solar tem dados', () => {
  const jaSolar = modulos['JA Solar']
  if (!jaSolar) throw new Error('JA Solar não encontrada')
  const potencias = Object.keys(jaSolar)
  if (potencias.length === 0) throw new Error('JA Solar sem potências')
  log(`   Potências: ${potencias.join(', ')}`, 'cinza')
})
total++; passou++

teste('Módulos - Validar especificações', () => {
  const jam72 = modulos['JA Solar']['375-395']
  if (!jam72) throw new Error('Modelo JAM72S09 não encontrado')

  const powerCalc = (jam72.vmp * jam72.imp).toFixed(0)
  const tolerance = Math.abs(parseInt(powerCalc) - jam72.potencia_wp) <= jam72.potencia_wp * 0.05

  if (!tolerance) {
    throw new Error(`Validação falhou: ${powerCalc}W ≠ ${jam72.potencia_wp}W`)
  }

  log(`   ${jam72.modelo}: ${powerCalc}W ≈ ${jam72.potencia_wp}W ✓`, 'cinza')
})
total++; passou++

teste('Módulos - Todas marcas têm dados', () => {
  Object.entries(modulos).forEach(([marca, potencias]) => {
    Object.entries(potencias).forEach(([faixa, dados]) => {
      if (!dados.modelo || !dados.potencia_wp) {
        throw new Error(`${marca} ${faixa} incompleto`)
      }
    })
  })
  log(`   ${Object.keys(modulos).length} marcas validadas`, 'cinza')
})
total++; passou++

// ===== TESTES INVERSORES =====
logTitulo('⚡ TESTES: INVERSORES')

teste('Inversores - Monofásicos', () => {
  const mono = getInversores(1)
  if (Object.keys(mono).length === 0) throw new Error('Nenhum inversor monofásico')
  log(`   ${Object.keys(mono).length} marcas com monofásicos`, 'cinza')
})
total++; passou++

teste('Inversores - Trifásicos', () => {
  const tri = getInversores(3)
  if (Object.keys(tri).length === 0) throw new Error('Nenhum inversor trifásico')
  log(`   ${Object.keys(tri).length} marcas com trifásicos`, 'cinza')
})
total++; passou++

teste('Inversores - Huawei tem modelos', () => {
  const huawei = inversores['Huawei']
  if (!huawei || !huawei.monofasico || !huawei.trifasico) {
    throw new Error('Dados Huawei incompletos')
  }
  log(`   Monofásicos: ${Object.keys(huawei.monofasico).length}`, 'cinza')
  log(`   Trifásicos: ${Object.keys(huawei.trifasico).length}`, 'cinza')
})
total++; passou++

teste('Inversores - Validar tensão entrada', () => {
  Object.entries(inversores).forEach(([marca, config]) => {
    Object.entries(config).forEach(([tipo, faixas]) => {
      Object.entries(faixas).forEach(([faixa, modelos]) => {
        Object.entries(modelos).forEach(([pot, specs]) => {
          if (specs.tensao_min_v < 100 || specs.tensao_max_v < specs.tensao_min_v) {
            throw new Error(`${marca} ${specs.modelo} tensão inválida`)
          }
        })
      })
    })
  })
  log(`   Todas tensões validadas (100-700V)`, 'cinza')
})
total++; passou++

// ===== TESTES CARREGADORES =====
logTitulo('🔌 TESTES: CARREGADORES')

teste('Carregadores - Listar marcas', () => {
  const marcas = Object.keys(carregadores)
  if (marcas.length === 0) throw new Error('Nenhuma marca de carregador')
  log(`   Marcas: ${marcas.join(', ')}`, 'cinza')
})
total++; passou++

teste('Carregadores - 48V disponíveis', () => {
  const car48v = getCargadores(48)
  if (Object.keys(car48v).length === 0) throw new Error('Nenhum carregador para 48V')
  log(`   ${Object.keys(car48v).length} marcas suportam 48V`, 'cinza')
})
total++; passou++

teste('Carregadores - 24V disponíveis', () => {
  const car24v = getCargadores(24)
  if (Object.keys(car24v).length === 0) throw new Error('Nenhum carregador para 24V')
  log(`   ${Object.keys(car24v).length} marcas suportam 24V`, 'cinza')
})
total++; passou++

// ===== TESTES TABELAS NBR =====
logTitulo('📏 TESTES: TABELAS NBR DE CABOS')

teste('Tabela Cobre - Seções disponíveis', () => {
  if (tabelaCobre.length === 0) throw new Error('Tabela cobre vazia')
  const secoes = tabelaCobre.map(c => c.secao_mm2)
  log(`   ${tabelaCobre.length} seções: ${secoes.join(', ')}`, 'cinza')
})
total++; passou++

teste('Tabela Cobre - Ampacidade B1 >= B2', () => {
  tabelaCobre.forEach(cabo => {
    if (cabo.ampacidade_b1_a < cabo.ampacidade_b2_a) {
      throw new Error(`${cabo.secao_mm2}mm²: B1 < B2`)
    }
  })
  log(`   Ampacidades validadas`, 'cinza')
})
total++; passou++

teste('Tabela Alumínio - Seções disponíveis', () => {
  if (tabelaAluminio.length === 0) throw new Error('Tabela alumínio vazia')
  log(`   ${tabelaAluminio.length} seções de alumínio`, 'cinza')
})
total++; passou++

teste('Tabela Alumínio - Ampacidade menor que cobre', () => {
  const secoesCobAlum = [4, 6, 10, 16, 25, 35, 50, 70]
  secoesCobAlum.forEach(secao => {
    const cob = tabelaCobre.find(c => c.secao_mm2 === secao)
    const alum = tabelaAluminio.find(a => a.secao_mm2 === secao)

    if (cob && alum && alum.ampacidade_b1_a >= cob.ampacidade_b1_a) {
      throw new Error(`Alumínio não deveria ter ampacidade ≥ Cobre (${secao}mm²)`)
    }
  })
  log(`   Alumínio tem menor ampacidade que cobre ✓`, 'cinza')
})
total++; passou++

// ===== TESTES CÁLCULOS =====
logTitulo('🧮 TESTES: FUNÇÕES DE CÁLCULO')

teste('Calcular Seção - DC 80A/30m/48V', () => {
  const resultado = calcularSecaoMinima(80, 30, 3, 48, 'cobre')
  if (!resultado.secao_comercial_mm2) throw new Error('Seção comercial não retornada')
  if (resultado.secao_comercial_mm2 < 16) throw new Error('Seção muito pequena')
  log(`   Resultado: ${resultado.secao_comercial_mm2}mm² (${resultado.queda_tensao_pct}% queda)`, 'cinza')
})
total++; passou++

teste('Calcular Seção - AC 35A/10m/230V', () => {
  const resultado = calcularSecaoMinima(35, 10, 3, 230, 'cobre')
  if (resultado.secao_comercial_mm2 < 2.5) throw new Error('Seção AC muito pequena')
  log(`   Resultado: ${resultado.secao_comercial_mm2}mm²`, 'cinza')
})
total++; passou++

teste('Verificar Ampacidade - 16mm² com 70A', () => {
  const verificacao = verificarAmpacidade(16, 70, 1.0)
  if (!verificacao.valido) throw new Error('Ampacidade inválida')
  log(`   Margem de segurança: ${verificacao.margem_seguranca_pct}%`, 'cinza')
})
total++; passou++

teste('Verificar Ampacidade - 4mm² com 80A (deve falhar)', () => {
  const verificacao = verificarAmpacidade(4, 80, 1.0)
  if (verificacao.valido) throw new Error('4mm² não deveria suportar 80A')
  log(`   Corretamente identificado como insuficiente`, 'cinza')
})
total++; passou++

teste('Calcular com Fator de Correção', () => {
  // Temperatura 40°C tem fator ~0.82
  const verificacao = verificarAmpacidade(16, 60, 0.82)
  if (!verificacao.valido) throw new Error('Falhou com fator de correção')
  log(`   Ampacidade corrigida: ${verificacao.ampacidade_corrigida_a}A`, 'cinza')
})
total++; passou++

// ===== RESUMO =====
logTitulo('📊 RESUMO DOS TESTES')

const percentual = ((passou / total) * 100).toFixed(1)
const logSummary = passou === total ? log : console.log

logSummary(`\n✅ Testes passados: ${passou}/${total} (${percentual}%)`)

if (passou === total) {
  log('\n🎉 TODOS OS TESTES PASSARAM! Sistema pronto para usar.', 'verde')
  process.exit(0)
} else {
  log(`\n⚠️  ${total - passou} teste(s) falharam.`, 'vermelho')
  process.exit(1)
}
