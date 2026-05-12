import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/forte_solar'

const OPCOES = {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
}

export async function conectarBD(tentativas = 5, intervaloMs = 5000) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      await mongoose.connect(MONGODB_URI, OPCOES)
      console.log('✅ MongoDB conectado com sucesso')
      return true
    } catch (erro) {
      console.error(`❌ Tentativa ${i}/${tentativas} falhou: ${erro.message}`)
      if (i < tentativas) {
        console.log(`⏳ Aguardando ${intervaloMs / 1000}s antes de tentar novamente...`)
        await new Promise(r => setTimeout(r, intervaloMs))
      }
    }
  }
  console.error('❌ Não foi possível conectar ao MongoDB após todas as tentativas')
  console.error('   URI:', MONGODB_URI.replace(/:[^:/@]+@/, ':***@'))
  return false
}

export function desconectarBD() {
  return mongoose.disconnect()
}

export default mongoose
