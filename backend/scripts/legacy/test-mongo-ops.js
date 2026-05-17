import mongoose from 'mongoose'

const MONGODB_URI = 'mongodb://localhost:27017/forte_solar'

async function testar() {
  try {
    console.log('🔍 Conectando...')
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Conectado ao MongoDB')

    // Testar ping
    console.log('🔍 Testando ping...')
    const result = await mongoose.connection.db.admin().ping()
    console.log('✅ Ping OK')

    // Listar collections
    console.log('🔍 Listando collections...')
    const collections = await mongoose.connection.db.listCollections().toArray()
    console.log('✅ Collections:', collections.map(c => c.name).join(', ') || 'nenhuma')

    // Tentar inserir documento direto
    console.log('🔍 Inserindo documento de teste...')
    const testCollection = mongoose.connection.db.collection('clientes_teste')
    const result2 = await testCollection.insertOne({ 
      nome: 'Carlos Teste', 
      email: 'carlos@test.com',
      timestamp: new Date() 
    })
    console.log('✅ Documento inserido')

    // Recuperar
    console.log('🔍 Recuperando documento...')
    const doc = await testCollection.findOne({})
    console.log('✅ Documento recuperado:', doc.nome)

    console.log('\n✨ Todas as operações funcionaram!')
    process.exit(0)
  } catch (err) {
    console.error('❌ Erro:', err.message)
    process.exit(1)
  }
}

testar()
