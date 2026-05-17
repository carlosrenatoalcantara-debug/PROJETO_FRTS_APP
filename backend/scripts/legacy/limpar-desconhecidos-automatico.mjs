#!/usr/bin/env node
/**
 * Script AUTOMÁTICO para remover "Desconhecido" do MongoDB
 * Usa com: SKIP_CONFIRMATION=true node limpar-desconhecidos-automatico.mjs
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI

console.log('🧹 Limpeza automática de equipamentos "Desconhecido"\n')

try {
  console.log('🔌 Conectando ao MongoDB...')
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  })

  console.log('✅ Conectado!\n')

  const equipamentoSchema = new mongoose.Schema({
    tipo: String,
    fabricante: String,
    modelo: String,
    createdAt: Date,
    updatedAt: Date,
  }, { collection: 'equipamentos' })

  const Equipamento = mongoose.model('Equipamento', equipamentoSchema)

  // Contar antes
  const totalAntes = await Equipamento.countDocuments()
  const desconhecidosAntes = await Equipamento.countDocuments({
    fabricante: 'Desconhecido'
  })

  if (desconhecidosAntes === 0) {
    console.log('✅ Nenhum equipamento com "Desconhecido" encontrado')
    console.log(`   Total de equipamentos: ${totalAntes}`)
    await mongoose.connection.close()
    process.exit(0)
  }

  console.log(`📊 Situação ANTES da limpeza:`)
  console.log(`   Total de equipamentos: ${totalAntes}`)
  console.log(`   Com "Desconhecido": ${desconhecidosAntes}`)

  // Deletar
  const resultado = await Equipamento.deleteMany({
    fabricante: 'Desconhecido'
  })

  // Contar depois
  const totalDepois = await Equipamento.countDocuments()
  const desconhecidosDepois = await Equipamento.countDocuments({
    fabricante: 'Desconhecido'
  })

  console.log(`\n✅ ${resultado.deletedCount} equipamentos removidos\n`)
  console.log(`📊 Situação DEPOIS da limpeza:`)
  console.log(`   Total de equipamentos: ${totalDepois}`)
  console.log(`   Com "Desconhecido": ${desconhecidosDepois}`)

  if (desconhecidosDepois === 0) {
    console.log(`\n🎉 Banco está 100% limpo!`)
  }

  await mongoose.connection.close()
  console.log('\n✅ Processo concluído')

} catch (error) {
  console.error('❌ Erro:', error.message)
  if (error.message.includes('ECONNREFUSED')) {
    console.log('MongoDB está offline. Tente novamente quando ficar disponível.')
  }
  process.exit(1)
}
