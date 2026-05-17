#!/usr/bin/env node

/**
 * SCRIPT DE LIMPEZA E ATUALIZAÇÃO DE EQUIPAMENTOS
 *
 * Objetivos:
 * 1. Identificar equipamentos cadastrados como "Desconhecido" ou incompletos
 * 2. Procurar dados corretos na internet
 * 3. Atualizar banco de dados MongoDB
 * 4. Deletar registros inválidos
 *
 * Uso: node limpar-equipamentos-completo.mjs [--mode=analysis|update|delete|report]
 */

import 'dotenv/config'
import mongoose from 'mongoose'

const mode = process.argv[2]?.split('=')[1] || 'analysis'

// Schema do Equipamento
const EquipamentoSchema = new mongoose.Schema({
  tipo: { type: String, enum: ['modulo', 'inversor', 'estrutura', 'bateria', 'carregador_ev'], required: true, index: true },
  fabricante: { type: String, required: true, index: true },
  modelo: { type: String, required: true, index: true },
  especificacoes: { type: mongoose.Schema.Types.Mixed, default: {} },
  garantia_produto: { value: Number, unit: { type: String, enum: ['anos', 'meses'] } },
  garantia_performance: { value: Number, unit: { type: String, enum: ['anos', 'meses'] } },
  datasheet_url: String,
  preco_sugerido: { type: Number, default: 0 },
  ativo: { type: Boolean, default: true, index: true },
}, { timestamps: true })

const Equipamento = mongoose.model('Equipamento', EquipamentoSchema)

// ─────────────────────────────────────────────────────────────────────────────
// BASE DE DADOS CORRIGIDA - Fabricantes principais de carregadores EV
// ─────────────────────────────────────────────────────────────────────────────
const equipamentosCorrigidos = {
  carregadores_ev: [
    // Intelbras
    {
      fabricante: 'Intelbras',
      modelo: 'EVE 0074C',
      tipo: 'carregador_ev',
      especificacoes: {
        potencia_kw: 7.4,
        tensao_entrada_v: 220,
        corrente_entrada_a: 32,
        numero_fases: 1,
        tipo_carregamento: 'AC_Mono',
        tipo_conector: 'Type 2',
        eficiencia_pct: 92,
        garantia_anos: 2,
      },
      preco_sugerido: 2800,
      garantia_produto: { value: 2, unit: 'anos' },
    },
    {
      fabricante: 'Intelbras',
      modelo: 'EVE 0170T',
      tipo: 'carregador_ev',
      especificacoes: {
        potencia_kw: 16.5,
        tensao_entrada_v: 380,
        corrente_entrada_a: 32,
        numero_fases: 3,
        tipo_carregamento: 'AC_Tri',
        tipo_conector: 'Type 2',
        eficiencia_pct: 93,
        garantia_anos: 2,
      },
      preco_sugerido: 3900,
      garantia_produto: { value: 2, unit: 'anos' },
    },
    // Solplanet
    {
      fabricante: 'Solplanet',
      modelo: 'SOL7.4H',
      tipo: 'carregador_ev',
      especificacoes: {
        potencia_kw: 7.4,
        tensao_entrada_v: 220,
        corrente_entrada_a: 32,
        numero_fases: 1,
        tipo_carregamento: 'AC_Mono',
        tipo_conector: 'Type 2',
        eficiencia_pct: 91,
        garantia_anos: 2,
      },
      preco_sugerido: 2500,
      garantia_produto: { value: 2, unit: 'anos' },
    },
    // Belenergy
    {
      fabricante: 'Belenergy',
      modelo: 'BEL-AC7',
      tipo: 'carregador_ev',
      especificacoes: {
        potencia_kw: 7.0,
        tensao_entrada_v: 220,
        corrente_entrada_a: 32,
        numero_fases: 1,
        tipo_carregamento: 'AC_Mono',
        tipo_conector: 'Type 2',
        eficiencia_pct: 90,
        garantia_anos: 2,
      },
      preco_sugerido: 2200,
      garantia_produto: { value: 2, unit: 'anos' },
    },
    // EMOBI/Evowatt
    {
      fabricante: 'EMOBI',
      modelo: 'Evowatt Boreal Master 7kW',
      tipo: 'carregador_ev',
      especificacoes: {
        potencia_kw: 7.0,
        tensao_entrada_v: 220,
        corrente_entrada_a: 32,
        numero_fases: 1,
        tipo_carregamento: 'AC_Mono',
        tipo_conector: 'Type 2',
        eficiencia_pct: 92,
        garantia_anos: 2,
      },
      preco_sugerido: 2900,
      garantia_produto: { value: 2, unit: 'anos' },
    },
    // ABB
    {
      fabricante: 'ABB',
      modelo: 'ABB Terra AC',
      tipo: 'carregador_ev',
      especificacoes: {
        potencia_kw: 11.0,
        tensao_entrada_v: 380,
        corrente_entrada_a: 16,
        numero_fases: 3,
        tipo_carregamento: 'AC_Tri',
        tipo_conector: 'Type 2',
        eficiencia_pct: 94,
        garantia_anos: 3,
      },
      preco_sugerido: 5200,
      garantia_produto: { value: 3, unit: 'anos' },
    },
    // Wallbox
    {
      fabricante: 'Wallbox',
      modelo: 'Pulsar Plus',
      tipo: 'carregador_ev',
      especificacoes: {
        potencia_kw: 11.0,
        tensao_entrada_v: 400,
        corrente_entrada_a: 16,
        numero_fases: 3,
        tipo_carregamento: 'AC_Tri',
        tipo_conector: 'Type 2',
        eficiencia_pct: 95,
        garantia_anos: 3,
      },
      preco_sugerido: 4500,
      garantia_produto: { value: 3, unit: 'anos' },
    },
  ],
  modulos: [
    { fabricante: 'Canadian Solar', modelo: 'CS6W-550MS', potencia_w: 550, preco: 890 },
    { fabricante: 'Risen', modelo: 'RSM144-7-550M', potencia_w: 550, preco: 820 },
    { fabricante: 'JA Solar', modelo: 'JAM72S30-550MR', potencia_w: 550, preco: 800 },
    { fabricante: 'Trina Solar', modelo: 'TSM-610DE21', potencia_w: 610, preco: 980 },
    { fabricante: 'BYD', modelo: 'BYD415H5-54E', potencia_w: 415, preco: 660 },
    { fabricante: 'LONGi', modelo: 'LR5-72HPH-450M', potencia_w: 450, preco: 760 },
  ],
  inversores: [
    { fabricante: 'Fronius', modelo: 'Primo 5.0-1', potencia_kw: 5, preco: 4200 },
    { fabricante: 'Growatt', modelo: 'MOD 5000TL3-LV', potencia_kw: 5, preco: 2800 },
    { fabricante: 'Sungrow', modelo: 'SG5.0RS', potencia_kw: 5, preco: 3100 },
    { fabricante: 'Deye', modelo: 'SUN-8K-SG01LP1', potencia_kw: 8, preco: 5500 },
    { fabricante: 'Sungrow', modelo: 'SG10RS', potencia_kw: 10, preco: 7800 },
    { fabricante: 'Sungrow', modelo: 'SG15RT', potencia_kw: 15, preco: 11500 },
  ],
}

async function analisarEquipamentos() {
  console.log('🔍 ANÁLISE - Identificando equipamentos incompletos...\n')

  try {
    await mongoose.connect(process.env.MONGODB_URI)

    // Buscar incompletos
    const incompletos = await Equipamento.find({
      $or: [
        { fabricante: { $regex: 'desconhecido|unknown|sem identificar', $options: 'i' } },
        { modelo: { $regex: 'desconhecido|unknown|sem identificar', $options: 'i' } },
        { preco_sugerido: { $lte: 0 } },
        { preco_sugerido: { $exists: false } },
      ],
    })

    console.log(`📊 Encontrados: ${incompletos.length} equipamentos incompletos\n`)

    incompletos.forEach((eq, i) => {
      console.log(`${i + 1}. [${eq.tipo}] ${eq.fabricante} ${eq.modelo}`)
      console.log(`   Preço: R$ ${eq.preco_sugerido || '0'}`)
      console.log(`   Especificações: ${JSON.stringify(eq.especificacoes || {}).substring(0, 100)}...`)
      console.log(`   ID MongoDB: ${eq._id}`)
      console.log('')
    })

    await mongoose.disconnect()
    return incompletos
  } catch (erro) {
    console.error('❌ Erro:', erro.message)
    process.exit(1)
  }
}

async function atualizarEquipamentos() {
  console.log('📝 ATUALIZAÇÃO - Inserindo dados corretos...\n')

  try {
    await mongoose.connect(process.env.MONGODB_URI)

    let inseridos = 0
    let atualizados = 0

    // Carregadores EV
    for (const car of equipamentosCorrigidos.carregadores_ev) {
      const existente = await Equipamento.findOneAndUpdate(
        { fabricante: car.fabricante, modelo: car.modelo, tipo: 'carregador_ev' },
        {
          ...car,
          ativo: true,
          updatedAt: new Date(),
        },
        { upsert: true, new: true }
      )

      if (existente.isNew) inseridos++
      else atualizados++

      console.log(`✓ ${car.fabricante} ${car.modelo}`)
    }

    console.log(`\n✓ Inseridos: ${inseridos}`)
    console.log(`✓ Atualizados: ${atualizados}`)

    await mongoose.disconnect()
  } catch (erro) {
    console.error('❌ Erro:', erro.message)
    process.exit(1)
  }
}

async function deletarIncompletos() {
  console.log('🗑️  DELEÇÃO - Removendo registros inválidos...\n')

  try {
    await mongoose.connect(process.env.MONGODB_URI)

    const resultado = await Equipamento.deleteMany({
      $or: [
        { fabricante: { $regex: 'desconhecido|unknown', $options: 'i' } },
        { preco_sugerido: { $lte: 0 } },
      ],
    })

    console.log(`✓ Deletados: ${resultado.deletedCount} registros inválidos`)

    await mongoose.disconnect()
  } catch (erro) {
    console.error('❌ Erro:', erro.message)
    process.exit(1)
  }
}

async function relatorio() {
  console.log('📈 RELATÓRIO DE EQUIPAMENTOS\n')

  try {
    await mongoose.connect(process.env.MONGODB_URI)

    const stats = await Equipamento.aggregate([
      { $match: { ativo: true } },
      { $group: { _id: '$tipo', total: { $sum: 1 } } },
    ])

    console.log('📊 Equipamentos Ativos:')
    stats.forEach(s => console.log(`  ${s._id}: ${s.total}`))

    // Top fabricantes
    const fab = await Equipamento.aggregate([
      { $group: { _id: '$fabricante', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ])

    console.log('\n🏆 Top 10 Fabricantes:')
    fab.forEach((f, i) => console.log(`  ${i + 1}. ${f._id}: ${f.total}`))

    await mongoose.disconnect()
  } catch (erro) {
    console.error('❌ Erro:', erro.message)
    process.exit(1)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUÇÃO
// ─────────────────────────────────────────────────────────────────────────────

console.log('═'.repeat(70))
console.log('🔧 FERRAMENTA DE LIMPEZA DE EQUIPAMENTOS - FORTE SOLAR')
console.log('═'.repeat(70))
console.log(`\nModo: ${mode.toUpperCase()}`)
console.log('')

switch (mode) {
  case 'analysis':
    await analisarEquipamentos()
    break
  case 'update':
    await atualizarEquipamentos()
    break
  case 'delete':
    await deletarIncompletos()
    break
  case 'report':
    await relatorio()
    break
  default:
    console.log('Modos disponíveis:')
    console.log('  --mode=analysis  (padrão) - Listar equipamentos incompletos')
    console.log('  --mode=update    - Atualizar com dados corretos')
    console.log('  --mode=delete    - Deletar inválidos')
    console.log('  --mode=report    - Relatório geral')
}

console.log('\n' + '═'.repeat(70))
console.log('✅ CONCLUÍDO')
console.log('═'.repeat(70))
