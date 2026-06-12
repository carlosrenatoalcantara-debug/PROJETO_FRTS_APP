import mongoose from 'mongoose'
import dns from 'dns'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/forte_solar'
const USE_MEMORY_STORAGE = process.env.USE_MEMORY_STORAGE === 'true'
const SKIP_MONGODB_RETRIES = process.env.SKIP_MONGODB_RETRIES === 'true'

// Override opcional dos resolvers DNS. Necessário em ambientes (ex.: esta máquina de
// dev/homolog) onde o resolver do SO não consegue fazer a busca SRV de `mongodb+srv://`
// e retorna `querySrv ECONNREFUSED`, derrubando a conexão Atlas para o fallback local.
// No-op quando MONGODB_DNS_SERVERS não está definido → produção permanece intocada.
const DNS_SERVERS = (process.env.MONGODB_DNS_SERVERS || '')
  .split(',').map(s => s.trim()).filter(Boolean)
if (DNS_SERVERS.length) {
  try {
    dns.setServers(DNS_SERVERS)
    console.log(`🌐 Resolvers DNS sobrescritos para conexão Atlas: ${DNS_SERVERS.join(', ')}`)
  } catch (e) {
    console.warn('⚠️ Falha ao aplicar MONGODB_DNS_SERVERS:', e.message)
  }
}

const OPCOES = {
  serverSelectionTimeoutMS: 5000,  // Reduzido de 10s
  socketTimeoutMS: 30000,           // Reduzido de 45s
  connectTimeoutMS: 5000,           // Reduzido de 10s
  retryWrites: false,
  maxPoolSize: 1,                   // Reduzido de padrão para menor uso de recursos
}

/**
 * Conectar ao MongoDB com suporte a fallback para memory storage
 */
export async function conectarBD(tentativas = 1, intervaloMs = 2000) {
  // Se USE_MEMORY_STORAGE estiver ativado, pular MongoDB completamente
  if (USE_MEMORY_STORAGE) {
    console.log('🗄️ Modo Memory Storage ativado - Pulando MongoDB')
    return false
  }

  // Se SKIP_MONGODB_RETRIES estiver ativado, fazer apenas 1 tentativa rápida
  const numTentativas = SKIP_MONGODB_RETRIES ? 1 : tentativas

  for (let i = 1; i <= numTentativas; i++) {
    try {
      console.log(`🔄 Conectando ao MongoDB... (tentativa ${i}/${numTentativas})`)
      await mongoose.connect(MONGODB_URI, OPCOES)
      console.log('✅ MongoDB conectado com sucesso!')
      return true
    } catch (erro) {
      if (i === 1) {
        console.warn(`⚠️ MongoDB indisponível: ${erro.message.split('\n')[0]}`)
      } else {
        console.error(`❌ Tentativa ${i}/${numTentativas} falhou`)
      }

      if (i < numTentativas) {
        console.log(`   ⏳ Aguardando ${intervaloMs / 1000}s...`)
        await new Promise(r => setTimeout(r, intervaloMs))
      }
    }
  }

  console.error('❌ MongoDB não disponível - Usando Memory Storage como fallback')
  console.log('   💾 Todos os dados serão salvos em memory-storage.json')
  console.log('   ℹ️  Para usar MongoDB, configure MONGODB_URI e rode este comando:')
  console.log('      USE_MEMORY_STORAGE=false npm run dev')
  return false
}

export function desconectarBD() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.disconnect()
  }
  return Promise.resolve()
}

export default mongoose
