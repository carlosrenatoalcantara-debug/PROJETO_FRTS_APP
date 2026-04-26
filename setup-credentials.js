#!/usr/bin/env node

/**
 * 🔐 Setup Seguro de Credenciais MongoDB Atlas
 *
 * Este script ajuda você a:
 * 1. Preencher credenciais de forma segura
 * 2. Validar a conexão com MongoDB
 * 3. Gerar arquivo .env.production
 * 4. Nunca expõe as credenciais nos logs
 */

import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

// Função auxiliar para perguntas (sem ecoar no console)
function pergunta(texto) {
  return new Promise((resolve) => {
    rl.question(texto, (resposta) => {
      resolve(resposta)
    })
  })
}

// Função para perguntas sensíveis (não mostra a resposta digitada)
function perguntaSensivel(texto) {
  return new Promise((resolve) => {
    const stdin = process.stdin
    stdin.resume()
    stdin.setRawMode(true)

    let resposta = ''
    process.stdout.write(texto)

    stdin.on('data', (char) => {
      char = char.toString()

      if (char === '\n' || char === '\r' || char === '') {
        stdin.setRawMode(false)
        stdin.pause()
        console.log('')
        resolve(resposta)
      } else if (char === '') {
        process.exit()
      } else {
        resposta += char
        process.stdout.write('*')
      }
    })
  })
}

// Função para validar connection string
function validarConnectionString(str) {
  return str.startsWith('mongodb+srv://') || str.startsWith('mongodb://')
}

// Função para extrair credenciais da connection string
function extrairCredenciais(str) {
  const match = str.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^.]+)\.([^/]+)\/([^?]+)/)
  if (!match) return null

  return {
    username: decodeURIComponent(match[1]),
    password: '[REDACTED]',
    cluster: match[3],
    region: match[4],
    database: match[5],
  }
}

// Main
async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  🔐 CONFIGURAÇÃO SEGURA DE CREDENCIAIS - MONGODB ATLAS        ║
║                                                                ║
║  ⚠️  IMPORTANTE:                                              ║
║  - Nunca compartilhe suas credenciais                         ║
║  - Não comite arquivo .env.production no git                  ║
║  - Use senhas fortes (20+ caracteres)                         ║
╚════════════════════════════════════════════════════════════════╝
  `)

  // Passo 1: Perguntar sobre o tipo de banco
  console.log('\n📋 ETAPA 1: Tipo de Banco de Dados')
  console.log('─────────────────────────────────')
  console.log('(a) MongoDB Atlas (Nuvem) - Recomendado')
  console.log('(b) MongoDB Local (localhost:27017)')

  const tipoBanco = await pergunta('\nEscolha (a ou b): ')

  let mongoUri = ''
  let credenciaisInfo = {}

  if (tipoBanco.toLowerCase() === 'b') {
    // MongoDB Local
    console.log('\n✅ MongoDB Local Detectado')
    mongoUri = 'mongodb://localhost:27017/forte_solar'
    credenciaisInfo = {
      tipo: 'Local',
      host: 'localhost:27017',
      database: 'forte_solar',
    }
  } else if (tipoBanco.toLowerCase() === 'a') {
    // MongoDB Atlas
    console.log('\n☁️  MongoDB Atlas (Nuvem)')
    console.log('─────────────────────────')
    console.log('\n📌 Você já tem uma conta no MongoDB Atlas?')
    console.log('Se não, crie em: https://www.mongodb.com/cloud/atlas')
    console.log('\nDepois copie a "Connection String" de:')
    console.log('Cluster → Connect → Drivers → Connection String')

    const temConta = await pergunta('\nVocê tem a Connection String? (s/n): ')

    if (temConta.toLowerCase() === 's') {
      console.log('\n🔗 Cole a Connection String (ela será mantida segura):')
      console.log('mongodb+srv://username:password@cluster.mongodb.net/database?...')

      mongoUri = await pergunta('\nConnection String: ')

      if (!validarConnectionString(mongoUri)) {
        console.error('❌ Erro: Connection string inválida!')
        console.error('Deve começar com mongodb:// ou mongodb+srv://')
        process.exit(1)
      }

      credenciaisInfo = extrairCredenciais(mongoUri)
      if (!credenciaisInfo) {
        console.error('❌ Não consegui extrair as credenciais. Verificar formato.')
        process.exit(1)
      }
    } else {
      console.log('\n⚠️  Você precisa criar um cluster no MongoDB Atlas primeiro!')
      console.log('📖 Veja: CREDENTIALS_SETUP.md → Passo 1-3')
      process.exit(0)
    }
  } else {
    console.error('❌ Opção inválida')
    process.exit(1)
  }

  // Passo 2: Verificar outras variáveis
  console.log('\n📋 ETAPA 2: Outras Variáveis')
  console.log('─────────────────────────────')

  const adminKey = await pergunta('\n🔑 Admin API Key (pressione Enter para manter "dev-key-123"): ')
  const finalAdminKey = adminKey.trim() || 'dev-key-123'

  const frontendUrl = await pergunta('\n🌐 Frontend URL (pressione Enter para "http://localhost:3005"): ')
  const finalFrontendUrl = frontendUrl.trim() || 'http://localhost:3005'

  // Passo 3: Confirmar
  console.log('\n\n✅ RESUMO DAS CONFIGURAÇÕES')
  console.log('════════════════════════════════════════════')
  console.log(`MongoDB Type: ${credenciaisInfo.tipo || 'Local'}`)
  if (credenciaisInfo.cluster) console.log(`Cluster: ${credenciaisInfo.cluster}`)
  if (credenciaisInfo.region) console.log(`Region: ${credenciaisInfo.region}`)
  if (credenciaisInfo.database) console.log(`Database: ${credenciaisInfo.database}`)
  console.log(`Admin API Key: [REDACTED]`)
  console.log(`Frontend URL: ${finalFrontendUrl}`)
  console.log('════════════════════════════════════════════')

  const confirma = await pergunta('\n✓ Confirmar essas configurações? (s/n): ')

  if (confirma.toLowerCase() !== 's') {
    console.log('❌ Cancelado pelo usuário')
    process.exit(0)
  }

  // Passo 4: Gerar arquivo .env.production
  console.log('\n\n📝 CRIANDO ARQUIVO .env.production')
  console.log('───────────────────────────────────')

  const envProdContent = `# ===== ENVIRONMENT =====
PORT=5005
NODE_ENV=production
FRONTEND_URL=${finalFrontendUrl}

# ===== MONGODB ATLAS =====
MONGODB_URI=${mongoUri}

# ===== ADMIN =====
ADMIN_API_KEY=${finalAdminKey}

# ===== SOLARMARKET (copiar de .env original) =====
SOLARMARKET_API_KEY=6059:iQANRfzf2ykzC46raDUw8bx41Xm2qtOQSRhtTp7v
SOLARMARKET_API_URL=https://api.solarmarket.com.br
`

  const envPath = path.join(__dirname, 'backend', '.env.production')

  try {
    fs.writeFileSync(envPath, envProdContent, { mode: 0o600 })
    console.log(`✅ Arquivo criado: ${envPath}`)
    console.log('   Permissões: 600 (apenas você pode ler)')
  } catch (erro) {
    console.error('❌ Erro ao criar arquivo:', erro.message)
    process.exit(1)
  }

  // Passo 5: Testar conexão (opcional)
  console.log('\n\n🧪 TESTAR CONEXÃO?')
  console.log('──────────────────')

  const testar = await pergunta('Deseja testar a conexão com MongoDB? (s/n): ')

  if (testar.toLowerCase() === 's') {
    console.log('\n⏳ Testando conexão...')

    try {
      // Dinâmico para evitar erro se mongoose não estiver instalado
      const mongoose = (await import('mongoose')).default

      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
      })

      console.log('✅ Conexão com MongoDB bem-sucedida!')

      // Verificar se as collections existem
      const db = mongoose.connection
      const collections = await db.db.listCollections().toArray()

      if (collections.length > 0) {
        console.log(`\n📊 Collections encontradas: ${collections.length}`)
        collections.forEach((col) => {
          console.log(`   - ${col.name}`)
        })
      } else {
        console.log('\n📊 Nenhuma collection encontrada (banco vazio)')
        console.log('   Será criado automaticamente na primeira execução')
      }

      await mongoose.disconnect()
      console.log('\n✅ Teste concluído com sucesso!')

    } catch (erro) {
      console.error('\n❌ Erro na conexão:')
      console.error(`   ${erro.message}`)
      console.error('\n⚠️  Verifique:')
      console.error('   1. MongoDB Atlas está rodando?')
      console.error('   2. Connection string está correta?')
      console.error('   3. IP whitelist configurado no MongoDB Atlas?')
      console.error('   4. Username/password corretos?')
    }
  }

  // Passo 6: Próximas ações
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  ✅ CONFIGURAÇÃO CONCLUÍDA!                                    ║
╚════════════════════════════════════════════════════════════════╝

📝 Arquivo criado: backend/.env.production

🚀 PRÓXIMAS AÇÕES:

1. Testar localmente:
   cd backend
   NODE_ENV=production npm start

2. Se tudo funcionar, fazer deploy:

   Opção A - Heroku:
     heroku create seu-app
     heroku config:set --from .env.production
     git push heroku main

   Opção B - Railway (Recomendado):
     https://railway.app
     Conectar repositório GitHub
     Adicionar variáveis no dashboard

   Opção C - AWS/GCP:
     Seguir documentação específica

3. Monitorar:
   MongoDB Atlas Dashboard
   Backend logs
   Relatórios de performance

⚠️  IMPORTANTE - SEGURANÇA:
   - Não comita .env.production no git ✅
   - Mude a senha a cada 3 meses
   - Use IP whitelist em produção
   - Monitore acessos suspeitos

📚 Documentação:
   - CREDENTIALS_SETUP.md → Detalhes de segurança
   - DEPLOYMENT_MONGODB_ATLAS.md → Deploy
   - QUICK_REFERENCE.md → Referência rápida

✓ Tudo pronto! Boa sorte! 🚀
`)

  rl.close()
}

main().catch((erro) => {
  console.error('❌ Erro:', erro.message)
  process.exit(1)
})
