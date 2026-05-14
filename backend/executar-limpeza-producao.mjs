#!/usr/bin/env node
/**
 * Script para executar limpeza em produção via API
 *
 * Uso:
 *   node executar-limpeza-producao.mjs          (produção)
 *   node executar-limpeza-producao.mjs local    (local)
 */

import fetch from 'node-fetch'
import dotenv from 'dotenv'

dotenv.config()

const ambiente = process.argv[2] || 'producao'

const CONFIG = {
  producao: {
    url: 'https://projetofrtsapp-production.up.railway.app',
    descricao: 'Backend de PRODUÇÃO (Railway)',
  },
  local: {
    url: 'http://localhost:5005',
    descricao: 'Backend LOCAL',
  },
}

const config = CONFIG[ambiente]

if (!config) {
  console.error('Ambiente inválido. Use: producao (padrão) ou local')
  process.exit(1)
}

const ADMIN_API_KEY = process.env.ADMIN_API_KEY

if (!ADMIN_API_KEY) {
  console.error('❌ ADMIN_API_KEY não encontrada em .env')
  process.exit(1)
}

console.log('\n═════════════════════════════════════════════════════════════')
console.log('🧹 LIMPEZA DE EQUIPAMENTOS "DESCONHECIDO"')
console.log('═════════════════════════════════════════════════════════════\n')
console.log(`🎯 Alvo: ${config.descricao}`)
console.log(`📍 URL: ${config.url}\n`)

// PASSO 1: Verificar status ANTES
console.log('📊 VERIFICANDO STATUS ANTES...\n')

try {
  const statusRes = await fetch(`${config.url}/api/admin/status-limpeza`)
  const statusAntes = await statusRes.json()

  if (statusAntes.erro) {
    console.error('❌ Erro ao verificar status:', statusAntes.erro)
    console.log('\n⚠️  Possível causa: Backend não está acessível')
    process.exit(1)
  }

  console.log(`Status: ${statusAntes.status}`)
  console.log(`Total: ${statusAntes.resumo.total}`)
  console.log(`Desconhecido: ${statusAntes.resumo.desconhecido}`)
  console.log(`Percentual: ${statusAntes.resumo.percentual_desconhecido}\n`)

  if (statusAntes.resumo.desconhecido === 0) {
    console.log('✅ Nenhum "Desconhecido" encontrado')
    console.log('   Sistema já está limpo!\n')
    process.exit(0)
  }
} catch (err) {
  console.error('❌ Erro ao conectar:', err.message)
  console.log('\n💡 Dica: Verifique se o backend está rodando')
  if (ambiente === 'local') {
    console.log('   Execute: npm start')
  } else {
    console.log('   Verifique status em railway.app')
  }
  process.exit(1)
}

// PASSO 2: Executar limpeza
console.log('═════════════════════════════════════════════════════════════')
console.log('🗑️  EXECUTANDO LIMPEZA...\n')

try {
  const limpezaRes = await fetch(`${config.url}/api/admin/limpar-desconhecidos`, {
    method: 'POST',
    headers: {
      'x-admin-key': ADMIN_API_KEY,
      'Content-Type': 'application/json',
    },
  })

  if (!limpezaRes.ok) {
    const erro = await limpezaRes.json()
    console.error(`❌ Erro ${limpezaRes.status}:`, erro.erro || erro.mensagem)
    process.exit(1)
  }

  const resultado = await limpezaRes.json()

  if (!resultado.sucesso) {
    console.error('❌ Limpeza falhou:', resultado.erro)
    process.exit(1)
  }

  console.log(`✅ ${resultado.removidos} equipamentos removidos!\n`)
  console.log(`📊 RESULTADO FINAL:`)
  console.log(`   Total antes: ${resultado.antes.total}`)
  console.log(`   Total depois: ${resultado.depois.total}`)
  console.log(`   Removidos: ${resultado.removidos}`)
  console.log(`   Desconhecido restante: ${resultado.depois.desconhecido}\n`)

  if (resultado.depois.desconhecido === 0) {
    console.log('🎉 LIMPEZA CONCLUÍDA COM SUCESSO!\n')
    console.log('⏳ Aguardando cache do Vercel expirar...')
    console.log('   (Frontend será atualizado em ~5-10 minutos)\n')
  }
} catch (err) {
  console.error('❌ Erro ao executar limpeza:', err.message)
  process.exit(1)
}

console.log('═════════════════════════════════════════════════════════════\n')
