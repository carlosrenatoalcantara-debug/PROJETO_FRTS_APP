/**
 * test_clima_schema.mjs — S2.10-prep
 *
 * Validação local do schema climático expandido em localizacaoV3Schema.
 *
 * O que valida:
 *  1. Persistência correta no MongoDB (campos chegam ao banco como Number/Date)
 *  2. Valores lidos de volta batem com os gravados
 *  3. Default de temperatura_referencia_c = 25 funciona sem input
 *  4. Campos climáticos nulos não quebram documentos sem clima
 *  5. Controllers antigos não são afetados (documento v2 lido sem erro)
 *
 * Execução:
 *   node tests/test_clima_schema.mjs
 *
 * Requer MONGODB_URI no ambiente (lê .env.local ou .env automaticamente).
 */

import dns from 'dns'
dns.setServers(['8.8.8.8', '1.1.1.1'])

import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ─── Carrega .env.local ou .env ────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

for (const envFile of ['.env.local', '.env']) {
  const envPath = path.join(projectRoot, envFile)
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
    console.log(`[env] Carregado: ${envFile}`)
    break
  }
}

import mongoose from 'mongoose'
import { ProjetoFV } from '../src/models/ProjetoFV.js'

// ─── Utilidades de assert ──────────────────────────────────────────────────────
let passed = 0
let failed = 0

function assert(descricao, condicao, detalhes = '') {
  if (condicao) {
    console.log(`  ✅ ${descricao}`)
    passed++
  } else {
    console.error(`  ❌ ${descricao}${detalhes ? `\n     ${detalhes}` : ''}`)
    failed++
  }
}

function secao(titulo) {
  console.log(`\n${'─'.repeat(64)}`)
  console.log(`  ${titulo}`)
  console.log('─'.repeat(64))
}

// ─── Conexão ──────────────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/forte_solar'

async function conectar() {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
  })
}

// ─── IDs de docs criados no teste (para limpeza) ──────────────────────────────
const idsParaLimpar = []

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('[S2.10-prep] Validação do schema climático ProjetoFV\n')

  await conectar()
  console.log('✅ MongoDB conectado\n')

  // ══════════════════════════════════════════════════════════════════════════
  secao('TESTE 1 — Persistência dados climáticos Nordeste/Natal')
  // ══════════════════════════════════════════════════════════════════════════

  // Cria um projeto fake com dados climáticos do Nordeste (Natal/RN)
  // Esses valores são representativos de Natal: min=18°C, max=40°C, média=29°C
  const projetoNatal = await ProjetoFV.create({
    clienteId: new mongoose.Types.ObjectId(),   // cliente fictício
    nome:      '[TEST S2.10-prep] Natal-RN Clima',
    status:    'rascunho',
    schema_version: 3,
    localizacao: {
      endereco_completo:    'Natal, Rio Grande do Norte, Brasil',
      latitude:             -5.7945,
      longitude:            -35.2110,
      cidade:               'Natal',
      estado:               'RN',
      irradiancia_kwh_kwp_dia: 5.8,
      fonte_irradiancia:    'manual',
      // ── Dados climáticos S2.10-prep ──
      temperatura_min_historica_c: 18,
      temperatura_max_historica_c: 40,
      temperatura_media_c:         29,
      // temperatura_referencia_c usa o default (25) — não passamos explicitamente
      fonte_climatica:             'manual',
      fonte_climatica_confianca:   null,
      atualizado_clima_em:         null,
    },
  })

  idsParaLimpar.push(projetoNatal._id)

  // Lê de volta do banco (garante que não é só in-memory)
  const lido = await ProjetoFV.findById(projetoNatal._id).lean()

  assert(
    'Documento criado e encontrado no banco',
    !!lido,
    `_id: ${projetoNatal._id}`
  )

  const loc = lido?.localizacao
  assert('localizacao existe no documento', !!loc)

  // Valores numéricos
  assert(
    'temperatura_min_historica_c === 18',
    loc?.temperatura_min_historica_c === 18,
    `Obtido: ${loc?.temperatura_min_historica_c}`
  )
  assert(
    'temperatura_max_historica_c === 40',
    loc?.temperatura_max_historica_c === 40,
    `Obtido: ${loc?.temperatura_max_historica_c}`
  )
  assert(
    'temperatura_media_c === 29',
    loc?.temperatura_media_c === 29,
    `Obtido: ${loc?.temperatura_media_c}`
  )

  // Default de temperatura_referencia_c = 25 (não foi passado explicitamente)
  assert(
    'temperatura_referencia_c === 25 (default STC)',
    loc?.temperatura_referencia_c === 25,
    `Obtido: ${loc?.temperatura_referencia_c}`
  )

  // Verificação de tipo Number (não string)
  assert(
    'temperatura_min é typeof number',
    typeof loc?.temperatura_min_historica_c === 'number',
    `Tipo: ${typeof loc?.temperatura_min_historica_c}`
  )
  assert(
    'temperatura_max é typeof number',
    typeof loc?.temperatura_max_historica_c === 'number',
    `Tipo: ${typeof loc?.temperatura_max_historica_c}`
  )
  assert(
    'temperatura_media é typeof number',
    typeof loc?.temperatura_media_c === 'number',
    `Tipo: ${typeof loc?.temperatura_media_c}`
  )

  // fonte_climatica padrão
  assert(
    'fonte_climatica === "manual"',
    loc?.fonte_climatica === 'manual',
    `Obtido: ${loc?.fonte_climatica}`
  )

  // Campos nulos são null (não undefined)
  assert(
    'fonte_climatica_confianca é null',
    loc?.fonte_climatica_confianca === null,
    `Obtido: ${loc?.fonte_climatica_confianca}`
  )
  assert(
    'atualizado_clima_em é null',
    loc?.atualizado_clima_em === null,
    `Obtido: ${loc?.atualizado_clima_em}`
  )

  // Campos legados não foram apagados
  assert('latitude preservada (-5.7945)', Math.abs((loc?.latitude ?? 0) - (-5.7945)) < 0.0001)
  assert('longitude preservada (-35.2110)', Math.abs((loc?.longitude ?? 0) - (-35.2110)) < 0.0001)
  assert('cidade preservada (Natal)', loc?.cidade === 'Natal')
  assert('estado preservado (RN)', loc?.estado === 'RN')
  assert('irradiancia_kwh_kwp_dia preservada (5.8)',
    Math.abs((loc?.irradiancia_kwh_kwp_dia ?? 0) - 5.8) < 0.001)

  // ══════════════════════════════════════════════════════════════════════════
  secao('TESTE 2 — Documento sem dados climáticos (campos nulos por padrão)')
  // ══════════════════════════════════════════════════════════════════════════

  // Simula documento salvo sem nenhum dado climático (compatibilidade legada)
  const projetoSemClima = await ProjetoFV.create({
    clienteId: new mongoose.Types.ObjectId(),
    nome:      '[TEST S2.10-prep] Sem clima',
    status:    'rascunho',
    schema_version: 3,
    localizacao: {
      endereco_completo: 'São Paulo, SP',
      latitude:          -23.5505,
      longitude:         -46.6333,
      cidade:            'São Paulo',
      estado:            'SP',
      // SEM campos climáticos — todos devem vir como null/default
    },
  })

  idsParaLimpar.push(projetoSemClima._id)

  const lidoSemClima = await ProjetoFV.findById(projetoSemClima._id).lean()
  const locSC = lidoSemClima?.localizacao

  assert('Documento sem clima criado corretamente', !!lidoSemClima)
  assert(
    'temperatura_min é null sem input',
    locSC?.temperatura_min_historica_c === null,
    `Obtido: ${locSC?.temperatura_min_historica_c}`
  )
  assert(
    'temperatura_max é null sem input',
    locSC?.temperatura_max_historica_c === null,
    `Obtido: ${locSC?.temperatura_max_historica_c}`
  )
  assert(
    'temperatura_media é null sem input',
    locSC?.temperatura_media_c === null,
    `Obtido: ${locSC?.temperatura_media_c}`
  )
  assert(
    'temperatura_referencia_c === 25 mesmo sem clima',
    locSC?.temperatura_referencia_c === 25,
    `Obtido: ${locSC?.temperatura_referencia_c}`
  )
  assert('latitude de SP preservada', Math.abs((locSC?.latitude ?? 0) - (-23.5505)) < 0.0001)

  // ══════════════════════════════════════════════════════════════════════════
  secao('TESTE 3 — Update posterior dos campos climáticos via $set')
  // ══════════════════════════════════════════════════════════════════════════

  // Simula o que o motor climático futuro (NASA POWER / INMET) fará:
  // preencher os campos climáticos em um doc que já existe
  await ProjetoFV.updateOne(
    { _id: projetoSemClima._id },
    {
      $set: {
        'localizacao.temperatura_min_historica_c': 10,
        'localizacao.temperatura_max_historica_c': 37,
        'localizacao.temperatura_media_c':         21,
        'localizacao.fonte_climatica':             'nasa_power',
        'localizacao.fonte_climatica_confianca':   0.9,
        'localizacao.atualizado_clima_em':         new Date(),
      },
    }
  )

  const lidoAtualizado = await ProjetoFV.findById(projetoSemClima._id).lean()
  const locA = lidoAtualizado?.localizacao

  assert('Temperatura mínima atualizada (10)', locA?.temperatura_min_historica_c === 10)
  assert('Temperatura máxima atualizada (37)', locA?.temperatura_max_historica_c === 37)
  assert('Temperatura média atualizada (21)', locA?.temperatura_media_c === 21)
  assert('fonte_climatica atualizada para nasa_power', locA?.fonte_climatica === 'nasa_power')
  assert(
    'fonte_climatica_confianca === 0.9',
    Math.abs((locA?.fonte_climatica_confianca ?? -1) - 0.9) < 0.001
  )
  assert('atualizado_clima_em é Date', locA?.atualizado_clima_em instanceof Date)
  // Garante que os outros campos não foram apagados no $set parcial
  assert('latitude SP preservada após update', Math.abs((locA?.latitude ?? 0) - (-23.5505)) < 0.0001)
  assert('cidade SP preservada após update', locA?.cidade === 'São Paulo')

  // ══════════════════════════════════════════════════════════════════════════
  secao('TESTE 4 — Documento v2 (sem localizacao) não quebra')
  // ══════════════════════════════════════════════════════════════════════════

  // Simula documento v2 legado: sem subdoc localizacao, campos flat
  const projetoV2 = await ProjetoFV.create({
    clienteId:         new mongoose.Types.ObjectId(),
    nome:              '[TEST S2.10-prep] Doc v2 legado',
    status:            'rascunho',
    schema_version:    2,
    latitude:          -15.7801,
    longitude:         -47.9292,
    endereco_completo: 'Brasília, DF',
    // Sem localizacao, sem clima — compatibilidade total
  })

  idsParaLimpar.push(projetoV2._id)

  const lidoV2 = await ProjetoFV.findById(projetoV2._id).lean()

  assert('Doc v2 criado sem erro', !!lidoV2)
  assert('schema_version === 2 preservado', lidoV2?.schema_version === 2)
  assert('latitude flat preservada (v2)', Math.abs((lidoV2?.latitude ?? 0) - (-15.7801)) < 0.0001)
  assert('localizacao é null em doc v2', lidoV2?.localizacao === null)

  // ══════════════════════════════════════════════════════════════════════════
  // RESULTADO
  // ══════════════════════════════════════════════════════════════════════════

  const sep = '═'.repeat(64)
  console.log(`\n${sep}`)
  console.log(`  RESULTADO: ${passed} ✅  |  ${failed} ❌  |  Total: ${passed + failed}`)
  console.log(sep)

  if (failed > 0) {
    console.error(`\n  ${failed} teste(s) falharam. Ver detalhes acima.`)
  } else {
    console.log('\n  Todos os testes passaram. Schema climático S2.10-prep validado. ✅')
  }
}

// ─── Execução com limpeza garantida ───────────────────────────────────────────
main()
  .catch(err => {
    console.error('\n❌ Erro fatal:', err.message)
    failed++
  })
  .finally(async () => {
    // Remove documentos de teste do banco (cleanup)
    if (idsParaLimpar.length > 0) {
      try {
        const r = await ProjetoFV.deleteMany({ _id: { $in: idsParaLimpar } })
        console.log(`\n[cleanup] ${r.deletedCount} documentos de teste removidos do banco.`)
      } catch (e) {
        console.warn('[cleanup] Falha ao limpar docs de teste:', e.message)
      }
    }
    await mongoose.disconnect()
    console.log('[cleanup] Desconectado. Processo encerrado.')
    process.exit(failed > 0 ? 1 : 0)
  })
