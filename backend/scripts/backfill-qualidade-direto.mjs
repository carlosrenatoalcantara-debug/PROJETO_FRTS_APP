#!/usr/bin/env node
/**
 * Backfill direto S2.6.1 — usa raw MongoDB driver (sem Mongoose middleware)
 *
 * Mesmo resultado que backfill-qualidade.mjs mas bypassa o pre-save hook
 * (incompatível com Mongoose 9.x em scripts ESM locais).
 *
 * Usa Model.collection.updateOne → sem hooks, sem validação de schema,
 * sem double-processing. Idempotente e não-destrutivo.
 */

// ── DNS fix (roteador local bloqueia DNS SRV) ───────────────────────────────
import dns from 'dns'
dns.setServers(['8.8.8.8', '1.1.1.1'])

import 'dotenv/config'
import mongoose from 'mongoose'
import { Equipamento } from '../src/models/Equipamento.js'
import { processarEquipamento, aplicarResultadoNoDoc } from '../src/services/catalogoQualidade.js'

// ─── Args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const flag = (name) => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1] || null
const has  = (name) => args.includes(`--${name}`)

const tipoFiltro = flag('tipo')
const limit      = flag('limit') ? Number(flag('limit')) : null
const dryRun     = has('dry-run')
const verbose    = has('verbose')

// ─── Conexão ─────────────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/forte_solar'

async function conectar() {
  if (mongoose.connection.readyState === 1) return
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
  })
}

// ─── Contadores ───────────────────────────────────────────────────────────────
const c = { total: 0, processados: 0, com_mudanca: 0, sem_mudanca: 0, erros: 0, por_nivel: {}, por_tipo: {} }

function contar(equipamento, resultado, mudou) {
  c.processados += 1
  if (mudou) c.com_mudanca += 1; else c.sem_mudanca += 1
  const nivel = resultado.qualidade?.nivel || '(sem)'
  const tipo  = equipamento.tipo || '(sem)'
  c.por_nivel[nivel] = (c.por_nivel[nivel] || 0) + 1
  c.por_tipo[tipo] = c.por_tipo[tipo] || {}
  c.por_tipo[tipo][nivel] = (c.por_tipo[tipo][nivel] || 0) + 1
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('🧪 BACKFILL DIRETO DE QUALIDADE — S2.6.1 (raw driver)')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  URI: ${MONGODB_URI.replace(/\/\/[^@]+@/, '//***@')}`)
  console.log(`Modo: ${dryRun ? 'DRY-RUN (sem persistir)' : 'WRITE (persistirá mudanças)'}`)
  if (tipoFiltro) console.log(`Filtro: tipo='${tipoFiltro}'`)
  if (limit) console.log(`Limit: ${limit}`)
  console.log('───────────────────────────────────────────────────────────────')

  try {
    await conectar()
    console.log('✅ MongoDB conectado.')
  } catch (err) {
    console.error('❌ Falha ao conectar:', err.message)
    process.exit(2)
  }

  const filtro = tipoFiltro ? { tipo: tipoFiltro } : {}
  c.total = await Equipamento.countDocuments(filtro)
  console.log(`📊 Total de equipamentos: ${c.total}`)
  if (c.total === 0) {
    console.log('Nada a processar. Saindo.')
    await mongoose.disconnect()
    return
  }

  const cursor = Equipamento.find(filtro).lean().cursor()
  let lidos = 0
  const inicio = Date.now()

  for await (const equipamento of cursor) {
    if (limit && lidos >= limit) break
    lidos += 1

    try {
      // Processa (puro, sem I/O)
      const resultado = processarEquipamento(equipamento, {
        tipoEvento: 'validacao_automatica',
        por: 'backfill_s2.6.1_direto',
        observacao: dryRun ? 'dry-run' : null,
      })

      const mudou = Boolean(resultado.evento_historico)

      if (!dryRun) {
        // Persiste APENAS os campos de qualidade via raw MongoDB driver
        // → sem Mongoose middleware, sem pre-save hook, sem validação de schema
        // → preserva 100% os campos originais (especificacoes, fabricante, etc.)
        const $set = {
          specs_canonicas:    resultado.specs_canonicas,
          identificacao:      resultado.identificacao,
          qualidade:          resultado.qualidade,
          status_operacional: resultado.status_operacional,
          _schema_versao:     '2.0',
        }

        // Garantir origem se ausente
        if (!equipamento.origem || !equipamento.origem.tipo) {
          $set['origem.tipo'] = 'desconhecido'
          $set['origem.em']   = new Date()
        }

        const update = { $set }

        // Append histórico (se houve mudança)
        if (mudou && resultado.evento_historico) {
          update.$push = {
            'validacao.historico': {
              $each: [resultado.evento_historico],
              $slice: -50,  // mantém últimos 50 eventos
            }
          }
        }

        await Equipamento.collection.updateOne(
          { _id: equipamento._id },
          update
        )
      }

      contar(equipamento, resultado, mudou)

      if (verbose || (mudou && lidos <= 20)) {
        console.log(
          `  ${lidos}/${c.total} [${equipamento.tipo || '?'}] ` +
          `${equipamento.fabricante || '?'} — ${equipamento.modelo || '?'} ` +
          `→ nivel=${resultado.qualidade?.nivel || '?'} ` +
          `score=${resultado.qualidade?.score_global ?? '?'} ` +
          `alertas=${(resultado.qualidade?.alertas || []).length}` +
          (mudou ? ' [mudou]' : '')
        )
      } else if (lidos % 25 === 0) {
        console.log(`  ${lidos}/${c.total} processados...`)
      }
    } catch (err) {
      c.erros += 1
      console.warn(`  ⚠️  Erro no equipamento ${equipamento._id}: ${err.message}`)
    }
  }

  const dur = ((Date.now() - inicio) / 1000).toFixed(1)

  console.log('───────────────────────────────────────────────────────────────')
  console.log('📋 RELATÓRIO FINAL')
  console.log('───────────────────────────────────────────────────────────────')
  console.log(`Duração: ${dur}s`)
  console.log(`Total processados:  ${c.processados}`)
  console.log(`Com mudança:        ${c.com_mudanca}`)
  console.log(`Sem mudança:        ${c.sem_mudanca}`)
  console.log(`Erros:              ${c.erros}`)
  console.log('')
  console.log('Distribuição por nível:')
  for (const [nivel, n] of Object.entries(c.por_nivel).sort((a, b) => b[1] - a[1])) {
    const pct = ((n / c.processados) * 100).toFixed(1)
    console.log(`  ${nivel.padEnd(22)} ${String(n).padStart(4)}  (${pct}%)`)
  }
  console.log('')
  console.log('Distribuição por tipo × nível:')
  for (const [tipo, niveis] of Object.entries(c.por_tipo)) {
    const linha = Object.entries(niveis).map(([n, cnt]) => `${n}=${cnt}`).join('  ')
    console.log(`  ${tipo.padEnd(18)} ${linha}`)
  }
  console.log('═══════════════════════════════════════════════════════════════')

  if (dryRun) console.log('⚠️  DRY-RUN — nada foi persistido.')
  if (c.erros > 0) console.log(`⚠️  ${c.erros} equipamento(s) com erro — verifique acima.`)

  await mongoose.disconnect()
}

main().catch(err => {
  console.error('❌ Falha fatal:', err)
  process.exit(1)
})
