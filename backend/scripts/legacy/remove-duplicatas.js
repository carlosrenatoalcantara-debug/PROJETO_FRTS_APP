#!/usr/bin/env node

/**
 * Script para remover duplicatas de Carregadores EV
 * Mantém apenas o registro mais antigo (primeiro criado) de cada marca+modelo
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { CarregadorEV } from './src/models/CarregadorEV.js'

// Carregar variáveis de ambiente
dotenv.config()

async function removerDuplicatas() {
  try {
    const mongoUri = process.env.MONGODB_URI
    if (!mongoUri) {
      console.error('❌ MONGODB_URI não está configurada')
      process.exit(1)
    }

    console.log('🔗 Conectando ao MongoDB...')
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    })

    console.log('✅ Conectado ao MongoDB\n')

    // Buscar todos os carregadores
    const todos = await CarregadorEV.find({}).sort({ createdAt: 1 })
    console.log(`📊 Total de registros encontrados: ${todos.length}\n`)

    // Agrupar por marca+modelo
    const grupos = {}
    todos.forEach(cg => {
      const chave = `${cg.marca}|${cg.modelo}`
      if (!grupos[chave]) {
        grupos[chave] = []
      }
      grupos[chave].push(cg)
    })

    // Identificar duplicatas
    const duplicatas = []
    const aKeeper = [] // registros a manter

    for (const [chave, registros] of Object.entries(grupos)) {
      if (registros.length > 1) {
        const [keeper, ...duplicados] = registros
        aKeeper.push(keeper._id)
        duplicatas.push(...duplicados.map(d => d._id))

        console.log(`⚠️  DUPLICATA ENCONTRADA: ${chave}`)
        console.log(`   • Mantendo: ${keeper._id} (${keeper.createdAt.toISOString()})`)
        console.log(`   • Deletando ${duplicados.length} registros:`)
        duplicados.forEach(d => {
          console.log(`     - ${d._id} (${d.createdAt.toISOString()})`)
        })
      }
    }

    if (duplicatas.length === 0) {
      console.log('\n✅ Nenhuma duplicata encontrada!')
      await mongoose.disconnect()
      process.exit(0)
    }

    console.log(`\n📋 RESUMO:`)
    console.log(`   • Total de registros: ${todos.length}`)
    console.log(`   • Duplicatas encontradas: ${duplicatas.length}`)
    console.log(`   • Após limpeza: ${todos.length - duplicatas.length}\n`)

    // Confirmar exclusão
    console.log('⚠️  ATENÇÃO: Você está prestes a deletar registros do banco de dados!')
    console.log(`   IDs a deletar: ${duplicatas.length} registros`)

    // Para ambiente de desenvolvimento/teste, deletar automaticamente
    // Para produção, pedir confirmação
    const shouldDelete = process.env.NODE_ENV === 'development'

    if (!shouldDelete) {
      console.log('\n⏭️  Para deletar em produção, configure NODE_ENV=development ou edite este script')
      await mongoose.disconnect()
      process.exit(0)
    }

    console.log('\n🗑️  Deletando duplicatas...')
    const resultado = await CarregadorEV.deleteMany({ _id: { $in: duplicatas } })

    console.log(`\n✅ SUCESSO!`)
    console.log(`   • Deletados: ${resultado.deletedCount} registros`)
    console.log(`   • Mantidos: ${aKeeper.length} registros únicos`)
    console.log(`   • Total restante: ${await CarregadorEV.countDocuments()}\n`)

    console.log('📊 Nova distribuição:')
    const novoTotal = await CarregadorEV.countDocuments()
    const porFabricante = await CarregadorEV.aggregate([
      { $group: { _id: '$marca', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])

    porFabricante.forEach(fab => {
      console.log(`   • ${fab._id}: ${fab.count}`)
    })

    console.log(`\nTotal final: ${novoTotal} carregadores únicos`)

    await mongoose.disconnect()
    process.exit(0)
  } catch (err) {
    console.error('❌ Erro:', err.message)
    if (err.message.includes('timeout')) {
      console.log('\n⚠️  MongoDB Atlas pode estar inacessível.')
      console.log('   Se está em produção, você pode:')
      console.log('   1. Usar Railway dashboard para executar manualmente')
      console.log('   2. Copiar os IDs a deletar e usar um gerenciador MongoDB')
      console.log('   3. Contactar suporte MongoDB Atlas')
    }
    process.exit(1)
  }
}

// Executar
removerDuplicatas()
