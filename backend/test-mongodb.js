import 'dotenv/config'
import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI

console.log('🔍 Testando conexão MongoDB...')
console.log('📍 URI:', MONGODB_URI.replace(/:[^:/@]+@/, ':***@'))

async function testarConexao() {
  try {
    console.log('⏳ Conectando...')
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    })
    console.log('✅ Conectado com sucesso!')

    // Tentar listar collections
    const collections = await mongoose.connection.db.listCollections().toArray()
    console.log(`📚 Collections encontradas: ${collections.length}`)
    collections.forEach(c => console.log(`   - ${c.name}`))

    // Tentar contar documentos em clientes se existir
    if (collections.some(c => c.name === 'clientes')) {
      const count = await mongoose.connection.db.collection('clientes').countDocuments()
      console.log(`👥 Clientes no banco: ${count}`)
    }

    console.log('\n✨ Tudo funcionando!')
    process.exit(0)
  } catch (erro) {
    console.error('❌ Erro ao conectar:')
    console.error('   Mensagem:', erro.message)
    if (erro.code) console.error('   Código:', erro.code)
    console.error('\n💡 Possíveis soluções:')
    console.error('   1. Verificar string de conexão em .env')
    console.error('   2. Configurar IP whitelist em MongoDB Atlas')
    console.error('   3. Verificar conectividade de rede')
    process.exit(1)
  }
}

testarConexao()
