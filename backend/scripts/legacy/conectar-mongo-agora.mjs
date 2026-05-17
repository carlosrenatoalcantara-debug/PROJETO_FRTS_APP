#!/usr/bin/env node
/**
 * Conecta ao MongoDB com timeout aumentado
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI

console.log('\n🔌 Conectando ao MongoDB (com timeout aumentado)...\n')
console.log('URI:', MONGODB_URI.replace(/:[^:]*@/, ':***@'))
console.log('')

try {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,  // 30 segundos
    socketTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  })

  console.log('✅ CONECTADO AO MONGODB!\n')

  const equipamentoSchema = new mongoose.Schema({
    tipo: String,
    fabricante: String,
    modelo: String,
  }, { collection: 'equipamentos' })

  const Equipamento = mongoose.model('Equipamento', equipamentoSchema)

  // Contar equipamentos
  const total = await Equipamento.countDocuments()
  const desconhecidos = await Equipamento.countDocuments({
    fabricante: 'Desconhecido'
  })

  console.log(`📊 STATUS DO MONGODB:\n`)
  console.log(`   Total de equipamentos: ${total}`)
  console.log(`   Com "Desconhecido": ${desconhecidos}\n`)

  if (desconhecidos === 0) {
    console.log('✅ Banco está LIMPO!\n')
    await mongoose.connection.close()
    process.exit(0)
  }

  // Breakdown
  const inversores = await Equipamento.countDocuments({
    tipo: 'inversor',
    fabricante: 'Desconhecido'
  })

  const modulos = await Equipamento.countDocuments({
    tipo: 'modulo',
    fabricante: 'Desconhecido'
  })

  const carregadores = await Equipamento.countDocuments({
    tipo: 'carregador_ev',
    fabricante: 'Desconhecido'
  })

  console.log(`Breakdown de "Desconhecido":`)
  console.log(`   - Inversores: ${inversores}`)
  console.log(`   - Módulos: ${modulos}`)
  console.log(`   - Carregadores EV: ${carregadores}\n`)

  console.log(`💾 MongoDB está ACESSÍVEL e tem dados sujos!`)
  console.log(`   Execute: node limpar-desconhecidos-automatico.mjs\n`)

  await mongoose.connection.close()

} catch (error) {
  console.error('❌ Erro:', error.message)
  console.log('\nSe ver "ECONNREFUSED" ou "ETIMEDOUT", MongoDB ainda não está acessível.')
  console.log('Aguarde alguns minutos e tente novamente.\n')
  process.exit(1)
}
