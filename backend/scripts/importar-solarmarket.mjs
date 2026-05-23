#!/usr/bin/env node
/**
 * importar-solarmarket.mjs — S2.9
 *
 * Script CLI para executar o ETL de importação do SolarMarket.
 *
 * Uso:
 *   node scripts/importar-solarmarket.mjs                  # dry-run (padrão)
 *   node scripts/importar-solarmarket.mjs --apply          # escreve no banco
 *   node scripts/importar-solarmarket.mjs --limite=10      # limita propostas
 *   node scripts/importar-solarmarket.mjs --verbose        # relatório detalhado
 *   node scripts/importar-solarmarket.mjs --apply --limite=5 --verbose
 *
 * Via Railway:
 *   railway run node scripts/importar-solarmarket.mjs
 *   railway run node scripts/importar-solarmarket.mjs --apply
 *
 * Variáveis de ambiente necessárias:
 *   MONGODB_URI           — conexão com o banco
 *   SOLARMARKET_EMAIL     — email de acesso à API SM
 *   SOLARMARKET_PASSWORD  — senha de acesso à API SM
 *   SOLARMARKET_API_URL   — (opcional) base URL, default: https://business.solarmarket.com.br/api/v2
 *
 * IMPORTANTE:
 *   - Dry-run por padrão — NUNCA escreve sem --apply explícito
 *   - Nunca sobrescreve dados enriquecidos pelo Gemini
 *   - Nunca sincroniza clientes, projetos ou CRM
 */

import dns from 'dns'
dns.setServers(['8.8.8.8', '1.1.1.1'])  // garante resolução SRV do Atlas em rede local

import 'dotenv/config'
import mongoose from 'mongoose'

// ─── Args ─────────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2)
const DRY_RUN = !args.includes('--apply')
const VERBOSE = args.includes('--verbose') || args.includes('-v')
const LIMITE  = args.find(a => a.startsWith('--limite='))?.split('=')[1]
  ? Number(args.find(a => a.startsWith('--limite=')).split('=')[1])
  : 0

if (DRY_RUN) {
  console.log('🔍 MODO DRY-RUN — nenhuma alteração será feita no banco.')
  console.log('   Para aplicar, use: node scripts/importar-solarmarket.mjs --apply\n')
} else {
  console.log('⚡ MODO APPLY — os dados SERÃO escritos no banco!\n')
}

// ─── Validação de credenciais ──────────────────────────────────────────────────
if (!process.env.SOLARMARKET_EMAIL || !process.env.SOLARMARKET_PASSWORD) {
  console.error('❌ SOLARMARKET_EMAIL e SOLARMARKET_PASSWORD são obrigatórios.')
  console.error('   Configure no .env ou via Railway environment variables.')
  process.exit(1)
}

// ─── Conexão MongoDB ───────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/forte_solar'

async function conectar() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 30000,
    })
    console.log('✅ MongoDB conectado\n')
  } catch (err) {
    console.error('❌ Falha na conexão MongoDB:', err.message)
    process.exit(1)
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────
await conectar()

try {
  // Import dinâmico para garantir que mongoose está conectado antes de carregar os models
  const { executarImport, imprimirRelatorio } = await import('../src/integracoes/solarmarket/importer.js')

  const relatorio = await executarImport({
    dryRun:          DRY_RUN,
    limitePropostas: LIMITE,
    incluirProdutos: true,
    verbose:         VERBOSE,
  })

  if (!VERBOSE) console.log('')  // nova linha após os dots

  imprimirRelatorio(relatorio)

  // Exit code não-zero se houver erros de persistência
  if (relatorio.persistencia.erros > 0 || relatorio.erros_gerais.length > 0) {
    process.exitCode = 1
  }

} catch (err) {
  console.error('\n❌ Falha no pipeline de importação:', err.message)
  if (err.stack) console.error(err.stack)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
  console.log('🔌 Desconectado do MongoDB.')
}
