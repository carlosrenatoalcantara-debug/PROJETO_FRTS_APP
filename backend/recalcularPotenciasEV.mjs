#!/usr/bin/env node

/**
 * Recalcular Potências e Quantidade de Pontos de Projetos EV
 *
 * Uso: node recalcularPotenciasEV.mjs
 *
 * Este script corrige projetos que têm carregadores selecionados
 * mas a potência total está zerada no banco de dados.
 */

import mongoose from 'mongoose'
import 'dotenv/config'

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/forte-solar'

const projetoEVSchema = new mongoose.Schema({
  clienteId: mongoose.Schema.Types.ObjectId,
  nome: String,
  carregadores: [{
    tipo: String,
    potencia_kw: Number,
    marca: String,
    modelo: String,
    quantidade: Number,
  }],
  quantidade_pontos: Number,
  potencia_total_kw: Number,
}, { collection: 'projetoevs' })

const ProjetoEV = mongoose.model('ProjetoEV', projetoEVSchema)

async function recalcularPotencias() {
  try {
    console.log('🔌 Conectando ao MongoDB...')
    await mongoose.connect(mongoUri)
    console.log('✅ Conectado ao MongoDB')

    console.log('\n📊 Buscando projetos EV com carregadores...')
    const projetos = await ProjetoEV.find({ carregadores: { $exists: true, $ne: [] } })
    console.log(`📍 Encontrados ${projetos.length} projetos`)

    let atualizados = 0
    let erros = 0

    console.log('\n🔄 Recalculando potências...\n')

    for (const projeto of projetos) {
      try {
        const quantidade_pontos = projeto.carregadores.length
        const potencia_total_kw = projeto.carregadores.reduce(
          (sum, c) => sum + ((c.potencia_kw || 0) * (c.quantidade || 1)),
          0
        )

        const foiAtualizado =
          projeto.quantidade_pontos !== quantidade_pontos ||
          projeto.potencia_total_kw !== potencia_total_kw

        if (foiAtualizado) {
          await ProjetoEV.findByIdAndUpdate(projeto._id, {
            quantidade_pontos,
            potencia_total_kw,
          })
          atualizados++
          console.log(`✅ ${projeto.nome}`)
          console.log(`   ${quantidade_pontos} pontos | ${potencia_total_kw}kW`)
        } else {
          console.log(`⏭️  ${projeto.nome} (já estava correto)`)
        }
      } catch (err) {
        erros++
        console.log(`❌ ${projeto.nome}: ${err.message}`)
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log(`📈 RESUMO:`)
    console.log(`   Total de projetos: ${projetos.length}`)
    console.log(`   Atualizados:       ${atualizados}`)
    console.log(`   Erros:             ${erros}`)
    console.log('='.repeat(50))

    await mongoose.disconnect()
    console.log('\n✅ Operação concluída com sucesso!')
  } catch (err) {
    console.error('❌ Erro:', err.message)
    process.exit(1)
  }
}

recalcularPotencias()
