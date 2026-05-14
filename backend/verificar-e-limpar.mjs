#!/usr/bin/env node
/**
 * Script Mestre: Verifica status e executa limpeza conforme necessário
 *
 * Uso:
 *   node verificar-e-limpar.mjs       # Apenas verifica
 *   node verificar-e-limpar.mjs auto  # Verifica e limpa se MongoDB online
 */

import mongoose from 'mongoose'
import fs from 'fs'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MEMORY_STORAGE = path.join(__dirname, 'data/memory-storage.json')
const MONGODB_URI = process.env.MONGODB_URI

console.log('═'.repeat(70))
console.log('🔍 VERIFICAÇÃO E LIMPEZA DE EQUIPAMENTOS "DESCONHECIDO"')
console.log('═'.repeat(70) + '\n')

// ═══════════════════════════════════════════════════════════════════════════
// PARTE 1: Verificar Memory Storage
// ═══════════════════════════════════════════════════════════════════════════

console.log('📋 VERIFICANDO MEMORY STORAGE (Fallback)...\n')

try {
  const memoryData = JSON.parse(fs.readFileSync(MEMORY_STORAGE, 'utf8'))
  const equips = memoryData.collections.equipamentos || []

  console.log(`  Arquivo: ${MEMORY_STORAGE}`)
  console.log(`  Total de equipamentos: ${equips.length}`)

  const desconhecidos = equips.filter(e => e.fabricante === 'Desconhecido')
  console.log(`  Com "Desconhecido": ${desconhecidos.length}`)

  if (desconhecidos.length === 0) {
    console.log('  ✅ Memory Storage está LIMPO\n')
  } else {
    console.log(`  ⚠️  Memory Storage tem ${desconhecidos.length} itens a limpar`)
    console.log('  Execute: node limpar-desconhecidos-memory.mjs\n')
  }
} catch (err) {
  console.error('  ❌ Erro ao ler memory storage:', err.message + '\n')
}

// ═══════════════════════════════════════════════════════════════════════════
// PARTE 2: Tentar Conectar ao MongoDB
// ═══════════════════════════════════════════════════════════════════════════

console.log('🔌 VERIFICANDO MONGODB...\n')

let mongoDbOnline = false
let desconhecidosEmMongo = 0

try {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  })

  mongoDbOnline = true
  console.log('  ✅ MongoDB está ONLINE')

  const schema = new mongoose.Schema({
    tipo: String,
    fabricante: String,
    modelo: String,
  }, { collection: 'equipamentos' })

  const Equipamento = mongoose.model('Equipamento', schema)

  const total = await Equipamento.countDocuments()
  desconhecidosEmMongo = await Equipamento.countDocuments({
    fabricante: 'Desconhecido'
  })

  console.log(`  Total de equipamentos: ${total}`)
  console.log(`  Com "Desconhecido": ${desconhecidosEmMongo}`)

  if (desconhecidosEmMongo === 0) {
    console.log('  ✅ MongoDB está LIMPO\n')
  } else {
    console.log(`  ⚠️  MongoDB tem ${desconhecidosEmMongo} itens a limpar\n`)
  }

  await mongoose.connection.close()
} catch (err) {
  console.log('  ❌ MongoDB está OFFLINE')
  console.log(`  Erro: ${err.message.split('\n')[0]}\n`)
}

// ═══════════════════════════════════════════════════════════════════════════
// PARTE 3: Status Final e Recomendações
// ═══════════════════════════════════════════════════════════════════════════

console.log('═'.repeat(70))
console.log('📊 RESUMO\n')

if (!mongoDbOnline) {
  console.log('🔴 MongoDB está OFFLINE')
  console.log('   → Sistema usará Memory Storage (que está limpo)')
  console.log('   → Quando MongoDB voltar, execute:')
  console.log('     node limpar-desconhecidos-automatico.mjs\n')
} else if (desconhecidosEmMongo === 0) {
  console.log('✅ TUDO LIMPO!')
  console.log('   → MongoDB online e sem "Desconhecido"')
  console.log('   → Memory Storage também está limpo')
  console.log('   → Sistema pronto para uso\n')
} else {
  console.log('⚠️  AÇÃO NECESSÁRIA')
  console.log(`   → MongoDB tem ${desconhecidosEmMongo} equipamentos a limpar`)
  console.log('   → Execute:')
  console.log('     node limpar-desconhecidos-automatico.mjs\n')

  // Se foi passado 'auto', ejecutar limpeza
  if (process.argv[2] === 'auto') {
    console.log('🤖 Executando limpeza automática...\n')

    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      })

      const schema = new mongoose.Schema({
        tipo: String,
        fabricante: String,
        modelo: String,
      }, { collection: 'equipamentos' })

      const Equipamento = mongoose.model('Equipamento', schema)
      const resultado = await Equipamento.deleteMany({
        fabricante: 'Desconhecido'
      })

      console.log(`✅ ${resultado.deletedCount} equipamentos removidos`)

      const verificacao = await Equipamento.countDocuments({
        fabricante: 'Desconhecido'
      })

      console.log(`✅ Desconhecidos restantes: ${verificacao}`)

      if (verificacao === 0) {
        console.log('✅ MongoDB está 100% limpo!')
      }

      await mongoose.connection.close()
    } catch (err) {
      console.error('❌ Erro na limpeza:', err.message)
    }
  }
}

console.log('═'.repeat(70) + '\n')
