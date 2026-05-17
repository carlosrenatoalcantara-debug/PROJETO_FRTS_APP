#!/usr/bin/env node
/**
 * LIMPEZA URGENTE DE PRODUÇÃO
 * Remove "Desconhecido" do MongoDB de produção AGORA
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI

console.log('\n🚨 LIMPEZA URGENTE DE PRODUÇÃO\n')
console.log('Conectando ao MongoDB de produção...\n')

try {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
  })

  console.log('✅ Conectado ao MongoDB!\n')

  const equipamentoSchema = new mongoose.Schema({
    tipo: String,
    fabricante: String,
    modelo: String,
  }, { collection: 'equipamentos' })

  const Equipamento = mongoose.model('Equipamento', equipamentoSchema)

  // Contar antes
  const totalAntes = await Equipamento.countDocuments()
  const desconhecidosAntes = await Equipamento.countDocuments({
    fabricante: 'Desconhecido'
  })

  console.log(`📊 ANTES DA LIMPEZA:`)
  console.log(`   Total: ${totalAntes}`)
  console.log(`   Desconhecido: ${desconhecidosAntes}\n`)

  if (desconhecidosAntes === 0) {
    console.log('✅ Nenhum "Desconhecido" encontrado!')
    await mongoose.connection.close()
    process.exit(0)
  }

  // Breakdown por tipo
  const inversoresDesc = await Equipamento.countDocuments({
    tipo: 'inversor',
    fabricante: 'Desconhecido'
  })

  const modulosDesc = await Equipamento.countDocuments({
    tipo: 'modulo',
    fabricante: 'Desconhecido'
  })

  console.log(`Breakdown:`)
  console.log(`   - Inversores: ${inversoresDesc}`)
  console.log(`   - Módulos: ${modulosDesc}\n`)

  // Deletar
  console.log('🗑️  Deletando equipamentos "Desconhecido"...\n')
  const resultado = await Equipamento.deleteMany({
    fabricante: 'Desconhecido'
  })

  // Contar depois
  const totalDepois = await Equipamento.countDocuments()
  const desconhecidosDepois = await Equipamento.countDocuments({
    fabricante: 'Desconhecido'
  })

  console.log(`✅ ${resultado.deletedCount} equipamentos REMOVIDOS!\n`)
  console.log(`📊 DEPOIS DA LIMPEZA:`)
  console.log(`   Total: ${totalDepois}`)
  console.log(`   Desconhecido: ${desconhecidosDepois}\n`)

  if (desconhecidosDepois === 0) {
    console.log('🎉 PRODUÇÃO ESTÁ 100% LIMPA!')
    console.log('\n⏳ Aguardando cache do Vercel expirar...')
    console.log('   (A página será atualizada automaticamente em ~5 minutos)\n')
  }

  await mongoose.connection.close()
  console.log('✅ Conexão fechada')

} catch (error) {
  console.error('❌ Erro:', error.message)
  process.exit(1)
}
