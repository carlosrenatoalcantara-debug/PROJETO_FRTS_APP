import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI

console.log('🔍 Verificando conexão com MongoDB...')
console.log('📍 URI:', MONGODB_URI.replace(/:[^:]*@/, ':***@'))

try {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 5000,
  })

  console.log('✅ Conectado ao MongoDB!')

  // Definir o esquema básico para Equipamento
  const equipamentoSchema = new mongoose.Schema({
    tipo: String,
    fabricante: String,
    modelo: String,
  }, { collection: 'equipamentos' })

  const Equipamento = mongoose.model('Equipamento', equipamentoSchema)

  // Buscar equipamentos com "Desconhecido"
  const desconhecidos = await Equipamento.find({
    fabricante: 'Desconhecido'
  })

  console.log(`\n📊 Equipamentos com "Desconhecido": ${desconhecidos.length}`)

  if (desconhecidos.length > 0) {
    console.log('\nAmostra dos primeiros 5:')
    desconhecidos.slice(0, 5).forEach(eq => {
      console.log(`  - ${eq.tipo}: ${eq.fabricante} ${eq.modelo}`)
    })
  }

  // Contar por tipo
  const inversores = await Equipamento.countDocuments({ tipo: 'inversor', fabricante: 'Desconhecido' })
  const modulos = await Equipamento.countDocuments({ tipo: 'modulo', fabricante: 'Desconhecido' })

  console.log(`\n📈 Breakdown:`)
  console.log(`  - Inversores Desconhecido: ${inversores}`)
  console.log(`  - Módulos Desconhecido: ${modulos}`)

  await mongoose.connection.close()
  console.log('\n✅ Verificação concluída')

} catch (error) {
  console.error('❌ Erro:', error.message)
  process.exit(1)
}
