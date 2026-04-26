#!/usr/bin/env node

/**
 * 🚀 Deploy Automático para a Nuvem
 *
 * Este script automatiza o deployment para:
 * - Railway (Recomendado - mais fácil)
 * - Heroku (Tradicional)
 * - AWS/GCP (Avançado)
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import readline from 'readline'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function pergunta(texto) {
  return new Promise((resolve) => {
    rl.question(texto, (resposta) => {
      resolve(resposta)
    })
  })
}

function executar(comando, descricao) {
  console.log(`\n⏳ ${descricao}...`)
  try {
    const resultado = execSync(comando, { encoding: 'utf-8' })
    console.log(`✅ ${descricao} concluído`)
    return resultado
  } catch (erro) {
    console.error(`❌ Erro: ${erro.message}`)
    throw erro
  }
}

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  🚀 DEPLOY AUTOMÁTICO - FORTE SOLAR PARA NUVEM               ║
╚════════════════════════════════════════════════════════════════╝
  `)

  // Verificar se .env.production existe
  const envPath = path.join(__dirname, 'backend', '.env.production')
  if (!fs.existsSync(envPath)) {
    console.error('\n❌ Erro: Arquivo .env.production não encontrado!')
    console.error(`   Execute primeiro: node setup-credentials.js`)
    process.exit(1)
  }

  console.log('✅ Arquivo .env.production detectado')

  // Escolher plataforma
  console.log('\n📋 ESCOLHA A PLATAFORMA DE DEPLOY')
  console.log('─────────────────────────────────')
  console.log('1️⃣  Railway.app (Recomendado - fácil e grátis primeiros $5/mês)')
  console.log('2️⃣  Heroku (Fácil, novo model pago)')
  console.log('3️⃣  AWS EC2 (Avançado, controle total)')
  console.log('4️⃣  Google Cloud (Avançado, grátis $300/ano)')
  console.log('5️⃣  DigitalOcean (Simples, $5/mês)')

  const plataforma = await pergunta('\nEscolha (1-5): ')

  switch (plataforma) {
    case '1':
      await deployRailway()
      break
    case '2':
      await deployHeroku()
      break
    case '3':
      await deployAWS()
      break
    case '4':
      await deployGCP()
      break
    case '5':
      await deployDigitalOcean()
      break
    default:
      console.error('❌ Opção inválida')
      process.exit(1)
  }

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  ✅ DEPLOYMENT CONFIGURADO!                                   ║
╚════════════════════════════════════════════════════════════════╝
  `)

  rl.close()
}

async function deployRailway() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  🚂 RAILWAY.APP DEPLOYMENT                                    ║
║  Recomendado: Fácil, automático, grátis primeiros $5/mês       ║
╚════════════════════════════════════════════════════════════════╝
  `)

  console.log('\n📝 INSTRUÇÕES DE SETUP:')
  console.log('─────────────────────')
  console.log(`
1. 📱 Acesse: https://railway.app
2. 🔑 Faça login com GitHub (ou crie conta)
3. ➕ Clique "Create New Project"
4. 🔗 Escolha "Deploy from GitHub repo"
5. 📦 Conecte seu repositório do Forte Solar
6. ⚙️  No Dashboard, configure variáveis:
   - NODE_ENV = production
   - MONGODB_URI = [cole de .env.production]
   - ADMIN_API_KEY = [cole de .env.production]
7. 🚀 Railway faz deploy automático!

✨ Benefícios:
   ✅ Deploy automático a cada push no GitHub
   ✅ SSL/HTTPS automático
   ✅ Logs em tempo real
   ✅ Rollback fácil
   ✅ Integração com MongoDB Atlas perfeita
   ✅ Pricing transparente ($0 primeiros $5/mês)
  `)

  const entendi = await pergunta('\n✓ Entendido? (s/n): ')

  if (entendi.toLowerCase() === 's') {
    console.log(`
    🎯 PRÓXIMOS PASSOS:

    1. Ir para https://railway.app
    2. Conectar GitHub
    3. Selecionar repositório Forte Solar
    4. Adicionar variáveis de .env.production
    5. Fazer um push para GitHub
       git add .
       git commit -m "Configure production environment"
       git push origin main
    6. Railway faz deploy automaticamente! 🚀

    📊 Depois de deployado:
       - Verificar logs: Railway Dashboard → Logs
       - Testar API: https://seu-app.railway.app/api/health
       - Monitorar performance: Railway Dashboard
    `)
  }
}

async function deployHeroku() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  🟣 HEROKU DEPLOYMENT                                         ║
║  Clássico, fácil, novo model com custo                         ║
╚════════════════════════════════════════════════════════════════╝
  `)

  console.log('\n📝 PRÉ-REQUISITOS:')
  console.log('─────────────────')
  console.log('1. Instalar Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli')
  console.log('2. Conta Heroku criada: https://signup.heroku.com')

  const temHeroku = await pergunta('\n✓ Tem Heroku CLI instalado? (s/n): ')

  if (temHeroku.toLowerCase() !== 's') {
    console.log('Instale primeiro: https://devcenter.heroku.com/articles/heroku-cli')
    return
  }

  try {
    console.log('\n⏳ Verificando Heroku CLI...')
    execSync('heroku --version', { stdio: 'ignore' })
    console.log('✅ Heroku CLI detectado')

    const appName = await pergunta('\n📝 Nome da aplicação no Heroku: ')

    console.log(`
    🚀 Executando deployment para Heroku...
    `)

    // Fazer login no Heroku
    console.log('🔑 Fazendo login no Heroku...')
    console.log('   (Uma página será aberta no navegador)')
    try {
      execSync('heroku login', { stdio: 'inherit' })
    } catch (e) {
      // Heroku login pode falhar em ambiente headless, continuar mesmo assim
    }

    // Criar app
    executar(`heroku create ${appName}`, `Criando app Heroku: ${appName}`)

    // Adicionar variáveis de ambiente
    console.log('\n⏳ Adicionando variáveis de ambiente...')
    const envContent = fs.readFileSync(path.join(__dirname, 'backend', '.env.production'), 'utf-8')
    const envVars = envContent
      .split('\n')
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => `"${line}"`)
      .join(' ')

    try {
      execSync(`heroku config:set --app ${appName} ${envVars}`)
      console.log('✅ Variáveis adicionadas')
    } catch (e) {
      console.warn('⚠️  Pode ser necessário adicionar variáveis manualmente via dashboard')
    }

    // Fazer deploy
    executar(`git push heroku main`, 'Fazendo deploy para Heroku')

    console.log(`
    ✅ DEPLOYMENT CONCLUÍDO!

    🌐 Seu app está em: https://${appName}.herokuapp.com
    📊 Dashboard: https://dashboard.heroku.com/apps/${appName}
    📝 Logs: heroku logs --tail --app ${appName}

    🧪 Testar:
       curl https://${appName}.herokuapp.com/api/health

    ⚠️  Heroku Dyno:
       - Grátis foi descontinuado
       - Usar Eco ($5/mês) ou Professional ($50+)
    `)
  } catch (erro) {
    console.error('❌ Erro no setup Heroku:', erro.message)
  }
}

async function deployAWS() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  🟠 AWS EC2 DEPLOYMENT                                        ║
║  Avançado, controle total, ~$10-30/mês                         ║
╚════════════════════════════════════════════════════════════════╝
  `)

  console.log(`
  📖 GUIA DE DEPLOYMENT AWS:

  1️⃣  Criar Instância EC2:
      - Amazon Linux 2 ou Ubuntu 22.04
      - t2.micro (eligible free tier)
      - Configurar security group (SSH 22, HTTP 80, HTTPS 443)

  2️⃣  Conectar via SSH:
      ssh -i seu-chave.pem ec2-user@sua-ip

  3️⃣  Instalar dependências:
      sudo yum update -y  # Amazon Linux
      sudo apt update -y  # Ubuntu

      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
      sudo apt install -y nodejs

      sudo apt install -y mongodb-org  # Se rodar MongoDB localmente

  4️⃣  Clonar repositório:
      git clone https://github.com/seu-user/projeto-frts.git
      cd projeto-frts

  5️⃣  Setup:
      cd backend
      npm install
      cp .env.production .env

  6️⃣  Iniciar:
      npm start  # Para teste
      npm install -g pm2
      pm2 start npm --name "forte-solar" -- start
      pm2 startup
      pm2 save

  7️⃣  Configurar Nginx (reverse proxy):
      sudo apt install -y nginx
      # Copiar config para /etc/nginx/sites-available/default
      sudo systemctl start nginx

  8️⃣  SSL/HTTPS (Let's Encrypt):
      sudo apt install -y certbot python3-certbot-nginx
      sudo certbot --nginx -d seu-dominio.com

  📚 Documentação completa:
     AWS docs: https://docs.aws.amazon.com/ec2/
     Railway é mais fácil se não quer administração!
  `)
}

async function deployGCP() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  🔵 GOOGLE CLOUD DEPLOYMENT                                   ║
║  Generoso, crédito grátis $300/ano, escalável                  ║
╚════════════════════════════════════════════════════════════════╝
  `)

  console.log(`
  📖 OPÇÕES NO GOOGLE CLOUD:

  🟢 Cloud Run (Recomendado - Serverless):
     - Sem servidor (manage-free)
     - Escalável automaticamente
     - Paga por requisição (primeiros $2.5M grátis)
     - Melhor para Forte Solar!

  📝 Setup Cloud Run:

  1️⃣  Criar conta: https://console.cloud.google.com
  2️⃣  Ativar APIs: Cloud Run, Cloud Build
  3️⃣  Criar Dockerfile:
      FROM node:20
      WORKDIR /app
      COPY package*.json ./
      RUN npm install --production
      COPY . .
      EXPOSE 5005
      CMD ["npm", "start"]

  4️⃣  Deploy:
      gcloud run deploy forte-solar \\
        --source . \\
        --platform managed \\
        --region us-central1 \\
        --allow-unauthenticated \\
        --set-env-vars MONGODB_URI=mongodb+srv://...

  5️⃣  Seu app estará em:
      https://forte-solar-[random].run.app

  ✨ Vantagens:
     - Grátis primeiros $2.5M requests/mês
     - Escalável infinitamente
     - Sem gerenciar servidor
     - Integração Google perfeita

  📚 Docs: https://cloud.google.com/run/docs
  `)
}

async function deployDigitalOcean() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  🌊 DIGITALOCEAN DEPLOYMENT                                   ║
║  Simples, acessível, $5-12/mês                                 ║
╚════════════════════════════════════════════════════════════════╝
  `)

  console.log(`
  📖 OPÇÕES NO DIGITALOCEAN:

  1️⃣  App Platform (Recomendado):
      - Deploy automático do GitHub
      - Gerenciado (sem servidor)
      - $5-12/mês para apps pequenos

  2️⃣  Droplet (VPS):
      - Máquina virtual gerenciada
      - Full controle
      - $4-6/mês

  Setup App Platform:

  1. Criar conta: https://www.digitalocean.com
  2. App Platform → Create App
  3. Conectar repositório GitHub
  4. Deploy automático!
  5. Adicionar variáveis via dashboard

  Alternativa Droplet:

  1. Criar Droplet (Ubuntu 22.04)
  2. SSH para máquina
  3. Instalar Node.js, MongoDB
  4. Git clone repositório
  5. npm start ou PM2

  📚 Docs: https://docs.digitalocean.com
  `)
}

main().catch((erro) => {
  console.error('❌ Erro:', erro.message)
  process.exit(1)
})
