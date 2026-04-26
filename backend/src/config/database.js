import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/forte_solar'

export async function conectarBD() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('✅ MongoDB conectado com sucesso')
    return true
  } catch (erro) {
    console.error('❌ Erro ao conectar MongoDB:', erro.message)
    console.error('   URI:', MONGODB_URI.replace(/:[^:/@]+@/, ':***@'))
    console.error('   Certifique-se de que a string de conexão está correta')
    console.error('   Verifique .env e credenciais no MongoDB Atlas')
    return false
  }
}

export function desconectarBD() {
  return mongoose.disconnect()
}

export default mongoose
