#!/usr/bin/env node

/**
 * 🔐 Script de Configuração da Chave Anthropic
 * 
 * Este script configura a ANTHROPIC_API_KEY necessária para Claude Vision funcionar
 * nos uploads de datasheets EV e equipamentos.
 */

import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function pergunta(texto) {
  return new Promise((resolve) => {
    rl.question(texto, (resposta) => {
      resolve(resposta.trim())
    })
  })
}

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  🔐 CONFIGURAÇÃO - ANTHROPIC API KEY                          ║
║     Necessário para Claude Vision (Upload de Datasheets)      ║
╚════════════════════════════════════════════════════════════════╝
  `)

  console.log('📋 OPÇÕES:')
  console.log('1️⃣  Ja tenho a chave (sk-ant-...)')
  console.log('2️⃣  Preciso obter uma chave nova')
  console.log('3️⃣  Ver instruções de como obter')

  const opcao = await pergunta('\nEscolha (1-3): ')

  if (opcao === '2') {
    console.log(`
✅ Para obter uma chave nova:

1. Acesse: https://console.anthropic.com/api_keys
2. Faça login com sua conta (ou crie uma)
3. Clique em "Create Key"
4. Copie a chave (começa com sk-ant-)
5. Volte aqui e escolha opção 1
    `)
    return
  } else if (opcao === '3') {
    console.log(`
📚 COMO OBTER UMA CHAVE ANTHROPIC:

Passo 1: Acesse https://console.anthropic.com/
Passo 2: Clique em "Sign In" (ou "Sign Up" se novo)
Passo 3: Faça login com seu email/Google/GitHub
Passo 4: No menu lateral, clique em "API Keys"
Passo 5: Clique em "Create Key"
Passo 6: Copie a chave (exemplo: sk-ant-v0-abc123...)
Passo 7: Salve em um lugar seguro

Tipo de chave: Default
Permissões: Leitura (apenas)

Custo: ~$0.003 por 1K tokens de entrada
       ~$0.015 por 1K tokens de saída
    `)
    return
  }

  if (opcao !== '1') {
    console.error('❌ Opção inválida')
    process.exit(1)
  }

  const chave = await pergunta('\n🔑 Paste sua chave (sk-ant-...): ')

  if (!chave.startsWith('sk-ant-')) {
    console.error('\n❌ Chave inválida! Deve começar com "sk-ant-"')
    process.exit(1)
  }

  // Configurar em .env local
  const envLocal = path.join(__dirname, 'backend', '.env')
  let conteudoEnv = fs.readFileSync(envLocal, 'utf8')

  if (conteudoEnv.includes('ANTHROPIC_API_KEY=')) {
    conteudoEnv = conteudoEnv.replace(/ANTHROPIC_API_KEY=.*/, `ANTHROPIC_API_KEY=${chave}`)
  } else {
    conteudoEnv += `\n\n# ANTHROPIC - Claude Vision para datasheets\nANTHROPIC_API_KEY=${chave}`
  }

  fs.writeFileSync(envLocal, conteudoEnv)
  console.log(`✅ Chave configurada em .env local`)

  // Perguntar se quer configurar em Railway
  const configRailway = await pergunta('\n🚀 Configurar também no Railway (produção)? (s/n): ')

  if (configRailway.toLowerCase() === 's') {
    console.log(`
    ⏳ Configurando no Railway...
    `)

    try {
      execSync('railway login', { stdio: 'inherit' })
      execSync('railway link', { stdio: 'inherit' })
      execSync(`railway variables set ANTHROPIC_API_KEY=${chave}`, { stdio: 'inherit' })
      console.log(`
      ✅ Chave configurada no Railway!
      🚀 Railway fará redeploy automático em ~1 minuto
      `)
    } catch (err) {
      console.error(`
      ❌ Erro ao configurar Railway. Você pode fazer manualmente:
      
      1. Acesse: https://railway.app/dashboard
      2. Selecione seu projeto
      3. Vá para "Variables"
      4. Adicione: ANTHROPIC_API_KEY = ${chave}
      5. Clique em "Deploy"
      `)
    }
  }

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  ✅ CONFIGURAÇÃO CONCLUÍDA!                                   ║
╚════════════════════════════════════════════════════════════════╝

Próximos passos:
1. Reinicie o servidor local: npm run dev
2. Teste upload de datasheet em: Equipamentos → Carregadores EV
3. Faça upload de um PDF de carregador
4. Verifique se os dados foram extraídos e salvos

Docs: backend/SETUP_CLAUDE_VISION.md
  `)

  rl.close()
}

main()
