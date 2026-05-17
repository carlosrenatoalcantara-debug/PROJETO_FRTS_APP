import 'dotenv/config'
import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI

console.log('🔍 Testando conexão MongoDB SRV...')
console.log('📍 URI:', MONGODB_URI.replace(/:[^:/@]+@/, ':***@'))

async function testarConexaoSRV() {
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

    console.log('\n✨ Tudo funcionando!')
    process.exit(0)
  } catch (erro) {
    console.error('❌ Erro ao conectar:')
    console.error('   Mensagem:', erro.message)
    console.error('\n💡 Verificar:')
    console.error('   1. IP whitelist no MongoDB Atlas')
    console.error('   2. String de conexão em .env')
    console.error('   3. Conectividade de rede')
    process.exit(1)
  }
}

testarConexaoSRV()
