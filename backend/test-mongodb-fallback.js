import mongoose from 'mongoose'

// Versões de fallback da string de conexão
const URIS = [
  // Versão SRV (preferida, mas falha com DNS)
  'mongodb+srv://renato_db_user:BbWX3FtZEBv2g36F@cluster0.iva0pph.mongodb.net/forte_solar?retryWrites=true&w=majority',

  // Versão direta (bypassa SRV lookup)
  'mongodb://renato_db_user:BbWX3FtZEBv2g36F@cluster0-shard-00-00.iva0pph.mongodb.net:27017/forte_solar?retryWrites=true&w=majority&ssl=true',
  'mongodb://renato_db_user:BbWX3FtZEBv2g36F@cluster0-shard-00-01.iva0pph.mongodb.net:27017/forte_solar?retryWrites=true&w=majority&ssl=true',
  'mongodb://renato_db_user:BbWX3FtZEBv2g36F@cluster0-shard-00-02.iva0pph.mongodb.net:27017/forte_solar?retryWrites=true&w=majority&ssl=true',
]

console.log('🔍 Testando conexão MongoDB com fallback...\n')

async function testarComFallback() {
  for (let i = 0; i < URIS.length; i++) {
    const uri = URIS[i]
    const tipo = uri.includes('+srv') ? 'SRV' : 'DIRETO'

    console.log(`${i + 1}. Tentando ${tipo}...`)

    try {
      console.log('   ⏳ Conectando...')
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
      })

      console.log('   ✅ Conectado com sucesso!\n')

      // Tentar listar collections
      const collections = await mongoose.connection.db.listCollections().toArray()
      console.log(`📚 Collections encontradas: ${collections.length}`)
      collections.forEach(c => console.log(`   - ${c.name}`))

      console.log('\n✨ Tudo funcionando!')
      process.exit(0)
    } catch (erro) {
      console.log(`   ❌ Falhou: ${erro.message.substring(0, 60)}...\n`)
      await mongoose.disconnect().catch(() => {})
    }
  }

  console.error('❌ Todas as tentativas falharam.\n')
  console.error('💡 Possíveis soluções:')
  console.error('   1. Verificar conexão de rede/WiFi')
  console.error('   2. Desabilitar VPN ou proxy')
  console.error('   3. Verificar firewall corporativo')
  console.error('   4. Usar celular como hotspot para testar')
  console.error('   5. Configurar IP whitelist em MongoDB Atlas')

  process.exit(1)
}

testarComFallback()
