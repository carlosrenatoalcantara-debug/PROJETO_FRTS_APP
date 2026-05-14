#!/usr/bin/env node
/**
 * Script para REMOVER todos os equipamentos com "Desconhecido" do MongoDB
 * Apenas executa quando MongoDB está online
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI

console.log('🧹 Inicializando limpeza de equipamentos "Desconhecido"...\n')

try {
  // Conectar ao MongoDB
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  })

  console.log('✅ Conectado ao MongoDB!\n')

  // Esquema do Equipamento
  const equipamentoSchema = new mongoose.Schema({
    tipo: String,
    fabricante: String,
    modelo: String,
  }, { collection: 'equipamentos' })

  const Equipamento = mongoose.model('Equipamento', equipamentoSchema)

  // Verificar quantos "Desconhecido" existem
  const totalDesconhecidos = await Equipamento.countDocuments({
    fabricante: 'Desconhecido'
  })

  console.log(`📊 Total de equipamentos com "Desconhecido": ${totalDesconhecidos}`)

  if (totalDesconhecidos === 0) {
    console.log('✅ Nenhum equipamento com "Desconhecido" encontrado. Banco está limpo!')
    await mongoose.connection.close()
    process.exit(0)
  }

  // Breakdown por tipo
  const inversoresDesconhecidos = await Equipamento.countDocuments({
    tipo: 'inversor',
    fabricante: 'Desconhecido'
  })

  const modulosDesconhecidos = await Equipamento.countDocuments({
    tipo: 'modulo',
    fabricante: 'Desconhecido'
  })

  const carregadoresDesconhecidos = await Equipamento.countDocuments({
    tipo: 'carregador_ev',
    fabricante: 'Desconhecido'
  })

  console.log(`\n📋 Breakdown:`)
  console.log(`  - Inversores: ${inversoresDesconhecidos}`)
  console.log(`  - Módulos: ${modulosDesconhecidos}`)
  console.log(`  - Carregadores EV: ${carregadoresDesconhecidos}`)

  // Amostra do que será deletado
  const amostra = await Equipamento.find({
    fabricante: 'Desconhecido'
  }).limit(5)

  if (amostra.length > 0) {
    console.log(`\n📌 Amostra do que será deletado:`)
    amostra.forEach((eq, i) => {
      console.log(`  ${i + 1}. ${eq.tipo}: "${eq.modelo || 'sem modelo'}"`)
    })
    if (totalDesconhecidos > 5) {
      console.log(`  ... e ${totalDesconhecidos - 5} mais`)
    }
  }

  // Confirmar deleção
  console.log(`\n⚠️  AÇÃO DESTRUTIVA: Isto vai deletar ${totalDesconhecidos} equipamentos`)
  console.log('Digite "SIM" para confirmar ou "CANCELAR" para interromper')

  // Ler resposta do stdin
  const readline = await import('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question('\n👉 Confirmação: ', async (answer) => {
      rl.close()

      if (answer.toUpperCase() === 'SIM') {
        console.log('\n🗑️  Deletando equipamentos...\n')

        const resultado = await Equipamento.deleteMany({
          fabricante: 'Desconhecido'
        })

        console.log(`✅ ${resultado.deletedCount} equipamentos deletados com sucesso!\n`)
        console.log(`📊 Validação final:`)

        const verificacao = await Equipamento.countDocuments({
          fabricante: 'Desconhecido'
        })

        console.log(`  - Equipamentos "Desconhecido" restantes: ${verificacao}`)

        if (verificacao === 0) {
          console.log('\n✅ Limpeza concluída com sucesso! Banco está 100% limpo.\n')
        }
      } else {
        console.log('\n❌ Operação cancelada')
      }

      await mongoose.connection.close()
      resolve()
    })
  })
} catch (error) {
  console.error('\n❌ Erro:', error.message)
  if (error.message.includes('ECONNREFUSED')) {
    console.log('\n⚠️  MongoDB está OFFLINE. Tente novamente quando o banco ficar disponível.')
  }
  process.exit(1)
}
