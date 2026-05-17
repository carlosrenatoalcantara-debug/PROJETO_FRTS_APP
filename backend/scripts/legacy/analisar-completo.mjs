import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Carregar dados de exemplo
import { equipamentosExemplo } from './src/seeds/equipamentosMemory.js'
import { INVERSORES } from './src/data/catalogoInversores.js'
import { PAINEIS } from './src/data/catalogoPaineis.js'

console.log('=' .repeat(70))
console.log('🔍 ANÁLISE COMPLETA DE EQUIPAMENTOS - FORTE SOLAR')
console.log('='.repeat(70))
console.log()

// SEÇÃO 1: Dados em Memória
console.log('📦 EQUIPAMENTOS EM MEMÓRIA (equipamentosMemory.js)')
console.log('-'.repeat(70))

const modulos = equipamentosExemplo.filter(e => e.tipo === 'modulo')
const inversores = equipamentosExemplo.filter(e => e.tipo === 'inversor')
const carregadores = equipamentosExemplo.filter(e => e.tipo === 'carregador_ev')

console.log(`✓ Módulos: ${modulos.length}`)
modulos.forEach(m => {
  const completo = m.especificacoes?.potencia && m.preco_sugerido > 0
  console.log(`  - ${m.fabricante} ${m.modelo} (${m.potencia_w}W) ${completo ? '✓' : '❌ INCOMPLETO'}`)
})

console.log(`\n✓ Inversores: ${inversores.length}`)
inversores.forEach(inv => {
  const completo = inv.especificacoes?.potencia_kw && inv.preco_sugerido > 0
  console.log(`  - ${inv.fabricante} ${inv.modelo} (${inv.potencia_kw}kW) ${completo ? '✓' : '❌ INCOMPLETO'}`)
})

console.log(`\n✓ Carregadores EV: ${carregadores.length}`)
carregadores.forEach(car => {
  const completo = car.especificacoes?.potencia_kw && car.preco_sugerido > 0
  console.log(`  - ${car.fabricante} ${car.modelo} (${car.especificacoes?.potencia_kw}kW) ${completo ? '✓' : '❌ INCOMPLETO'}`)
})

// SEÇÃO 2: Catálogos
console.log('\n' + '='.repeat(70))
console.log('📚 CATÁLOGOS DISPONÍVEIS')
console.log('-'.repeat(70))

console.log(`✓ Inversores no catálogo: ${INVERSORES.length}`)
INVERSORES.forEach(inv => {
  console.log(`  - ${inv.marca} ${inv.modelo} (${inv.potenciaKW}kW) - Garantia: ${inv.garantia}a - R$${inv.precoUnitario}`)
})

console.log(`\n✓ Painéis no catálogo: ${PAINEIS.length}`)
PAINEIS.forEach(p => {
  console.log(`  - ${p.marca} ${p.modelo} (${p.pmpp}W) - ${p.garantiaProduto}a produto/${p.garantiaPerformance}a perf - R$${p.precoUnitario}`)
})

// SEÇÃO 3: Análise de Desconhecidos
console.log('\n' + '='.repeat(70))
console.log('🔴 EQUIPAMENTOS COM PROBLEMAS')
console.log('-'.repeat(70))

const problematicos = equipamentosExemplo.filter(e => {
  const temDesconhecido =
    (e.fabricante && e.fabricante.toLowerCase().includes('desconhecido')) ||
    (e.modelo && e.modelo.toLowerCase().includes('desconhecido'))
  const incompleto = !e.preco_sugerido || e.preco_sugerido === 0 ||
    (e.tipo === 'modulo' && (!e.especificacoes?.potencia)) ||
    (e.tipo === 'inversor' && (!e.especificacoes?.potencia_kw))

  return temDesconhecido || incompleto
})

console.log(`Encontrados: ${problematicos.length} equipamentos\n`)

problematicos.forEach((eq, i) => {
  console.log(`${i + 1}. [${eq.tipo.toUpperCase()}]`)
  console.log(`   Fabricante: ${eq.fabricante || 'N/A'} ${eq.fabricante?.includes('desconhecido') ? '❌' : ''}`)
  console.log(`   Modelo: ${eq.modelo || 'N/A'} ${eq.modelo?.includes('desconhecido') ? '❌' : ''}`)
  console.log(`   Potência: ${eq.potencia_w || eq.potencia_kw || 'N/A'}`)
  console.log(`   Preço: R$ ${eq.preco_sugerido || '0'} ${!eq.preco_sugerido ? '❌' : ''}`)
  console.log(`   ID: ${eq._id}`)
  console.log('')
})

// SEÇÃO 4: Recomendações
console.log('='.repeat(70))
console.log('📋 RECOMENDAÇÕES')
console.log('-'.repeat(70))

if (problematicos.length > 0) {
  console.log(`\n✓ ${problematicos.length} equipamentos precisam ser corrigidos:`)
  problematicos.forEach((eq, i) => {
    console.log(`  ${i + 1}. Procurar: ${eq.fabricante} ${eq.modelo} na internet`)
    console.log(`     Atualizar: especificações técnicas e preço`)
    console.log(`     Ou DELETAR se não encontrar dados completos`)
  })
}

console.log('\n✓ Usar catálogos já disponíveis como referência')
console.log('✓ Validar cada equipamento antes de salvar no banco')

console.log('\n' + '='.repeat(70))
console.log('FIM DA ANÁLISE')
console.log('='.repeat(70))
