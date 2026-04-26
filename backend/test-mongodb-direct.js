import 'dotenv/config'
import mongoose from 'mongoose'

// Versão direta (sem SRV)
const MONGODB_URI_DIRECT = 'mongodb://renato_db_user:BbWX3FtZEBv2g36F@cluster0.iva0pph.mongodb.net:27017/forte_solar?retryWrites=true&w=majority&ssl=true'

console.log('🔍 Testando conexão MongoDB (modo direto)...')
console.log('📍 URI:', MONGODB_URI_DIRECT.replace(/:[^:/@]+@/, ':***@'))

async function testarConexaoDireta() {
  try {
    console.log('⏳ Conectando...')
    await mongoose.connect(MONGODB_URI_DIRECT, {
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
    console.error('\n❗ Ambas as tentativas falharam. Possíveis causas:')
    console.error('   - Credenciais incorretas')
    console.error('   - IP não whitelist no MongoDB Atlas')
    console.error('   - Sem conectividade de rede')
    console.error('   - Hostname incorreto')
    process.exit(1)
  }
}

testarConexaoDireta()
