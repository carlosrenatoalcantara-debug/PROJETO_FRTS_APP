import 'dotenv/config'
import mongoose from 'mongoose'

const EquipamentoSchema = new mongoose.Schema({
  tipo: String,
  fabricante: String,
  modelo: String,
  especificacoes: mongoose.Schema.Types.Mixed,
  garantia_produto: {
    value: Number,
    unit: String,
  },
  garantia_performance: {
    value: Number,
    unit: String,
  },
  datasheet_url: String,
  preco_sugerido: Number,
  ativo: Boolean,
}, { timestamps: true })

const Equipamento = mongoose.model('Equipamento', EquipamentoSchema)

async function verificarEquipamentos() {
  try {
    console.log('🔍 Conectando ao MongoDB...')
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('✓ Conectado!')
    
    // Buscar equipamentos incompletos ou desconhecidos
    const incompletos = await Equipamento.find({
      $or: [
        { fabricante: { $regex: 'desconhecido', $options: 'i' } },
        { modelo: { $regex: 'desconhecido', $options: 'i' } },
        { 'especificacoes.potencia': { $exists: false } },
        { preco_sugerido: { $exists: false } },
        { preco_sugerido: 0 },
        { fabricante: null },
        { modelo: null },
      ]
    })
    
    console.log(`\n📊 EQUIPAMENTOS INCOMPLETOS: ${incompletos.length}\n`)
    incompletos.forEach((eq, i) => {
      console.log(`${i + 1}. [${eq.tipo}] ${eq.fabricante || 'N/A'} ${eq.modelo || 'N/A'}`)
      console.log(`   ID: ${eq._id}`)
      console.log(`   Especificações: ${JSON.stringify(eq.especificacoes || {})}`)
      console.log(`   Preço: ${eq.preco_sugerido || 'N/A'}`)
      console.log('')
    })
    
    // Total de equipamentos por tipo
    const porTipo = await Equipamento.aggregate([
      { $group: { _id: '$tipo', total: { $sum: 1 } } }
    ])
    
    console.log('\n📈 TOTAL POR TIPO:')
    porTipo.forEach(t => console.log(`  ${t._id}: ${t.total}`))
    
    await mongoose.disconnect()
  } catch (error) {
    console.error('❌ Erro:', error.message)
    process.exit(1)
  }
}

verificarEquipamentos()
