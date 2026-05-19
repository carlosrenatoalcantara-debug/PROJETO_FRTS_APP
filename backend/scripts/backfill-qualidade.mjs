#!/usr/bin/env node
/**
 * 🧪 Backfill de qualidade do catálogo técnico — S2.6.1
 *
 * Roda sobre TODOS os equipamentos no MongoDB, recalcula:
 *   • specs_canonicas
 *   • identificacao normalizada
 *   • qualidade (scores + nivel + alertas)
 *   • status_operacional
 *
 * Características:
 *   ✓ idempotente — rodar 100 vezes produz o mesmo resultado se docs não mudarem
 *   ✓ não-destrutivo — NUNCA deleta, NUNCA modifica especificacoes original
 *   ✓ append-only — eventos de mudança vão para validacao.historico
 *   ✓ resiliente — equipamento com erro não para o lote
 *
 * Uso:
 *   node scripts/backfill-qualidade.mjs                 # roda em todos
 *   node scripts/backfill-qualidade.mjs --tipo=modulo   # filtra por tipo
 *   node scripts/backfill-qualidade.mjs --dry-run       # só lê, não escreve
 *   node scripts/backfill-qualidade.mjs --limit=50      # max 50 docs
 *
 * Requer:
 *   • MONGODB_URI no .env (ou em variável de ambiente)
 *   • Acesso ao banco em modo write (a menos que --dry-run)
 */

import 'dotenv/config'
import mongoose from 'mongoose'
import { Equipamento } from '../src/models/Equipamento.js'
import { processarEquipamento, aplicarResultadoNoDoc } from '../src/services/catalogoQualidade.js'

// ─── Parsing de args ────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const flag = (name) => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1] || null
const has = (name) => args.includes(`--${name}`)

const tipoFiltro = flag('tipo')
const limit = flag('limit') ? Number(flag('limit')) : null
const dryRun = has('dry-run')
const verbose = has('verbose')

// ─── Conexão ────────────────────────────────────────────────────────────────

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/forte_solar'

async function conectar() {
  if (mongoose.connection.readyState === 1) return
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  })
}

// ─── Sumarização ────────────────────────────────────────────────────────────

const contadores = {
  total: 0,
  processados: 0,
  com_mudanca: 0,
  sem_mudanca: 0,
  erros: 0,
  por_nivel: {},
  por_tipo: {},
}

function contar(equipamento, resultado, mudou) {
  contadores.processados += 1
  if (mudou) contadores.com_mudanca += 1
  else contadores.sem_mudanca += 1

  const nivel = resultado.qualidade?.nivel || '(sem)'
  const tipo  = equipamento.tipo || '(sem)'
  contadores.por_nivel[nivel] = (contadores.por_nivel[nivel] || 0) + 1
  contadores.por_tipo[tipo] = contadores.por_tipo[tipo] || {}
  contadores.por_tipo[tipo][nivel] = (contadores.por_tipo[tipo][nivel] || 0) + 1
}

// ─── Loop principal ─────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('🧪 BACKFILL DE QUALIDADE DO CATÁLOGO — S2.6.1')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`Conectando ao MongoDB...`)
  console.log(`  URI: ${MONGODB_URI.replace(/\/\/[^@]+@/, '//***@')}`)
  console.log(`Modo: ${dryRun ? 'DRY-RUN (sem persistir)' : 'WRITE (persistirá mudanças)'}`)
  if (tipoFiltro) console.log(`Filtro: tipo='${tipoFiltro}'`)
  if (limit) console.log(`Limit: ${limit}`)
  console.log('───────────────────────────────────────────────────────────────')

  try {
    await conectar()
  } catch (err) {
    console.error('❌ Falha ao conectar no MongoDB:', err.message)
    console.error('   Verifique MONGODB_URI no .env')
    process.exit(2)
  }

  const filtro = tipoFiltro ? { tipo: tipoFiltro } : {}
  contadores.total = await Equipamento.countDocuments(filtro)
  console.log(`📊 Total de equipamentos a processar: ${contadores.total}`)
  if (contadores.total === 0) {
    console.log('Nada a fazer. Saindo.')
    await mongoose.disconnect()
    return
  }

  const cursor = Equipamento.find(filtro).cursor()
  let lidos = 0
  const inicio = Date.now()

  for await (const doc of cursor) {
    if (limit && lidos >= limit) break
    lidos += 1

    try {
      const equipamento = doc.toObject({ depopulate: true, getters: false, virtuals: false })
      const resultado = processarEquipamento(equipamento, {
        tipoEvento: 'validacao_automatica',
        por: 'backfill_s2.6.1',
        observacao: dryRun ? 'dry-run' : null,
      })

      const houveMudanca = Boolean(resultado.evento_historico)

      if (!dryRun) {
        aplicarResultadoNoDoc(doc, resultado)
        // O pre-save hook irá recalcular novamente, mas idempotência garante mesmo resultado.
        // Salvamos diretamente os campos para evitar dupla chamada — usamos save().
        await doc.save()
      }

      contar(equipamento, resultado, houveMudanca)

      if (verbose || (houveMudanca && lidos <= 20)) {
        console.log(
          `  ${lidos}/${contadores.total} [${equipamento.tipo || '?'}] ` +
          `${equipamento.fabricante || '?'} — ${equipamento.modelo || '?'} ` +
          `→ nivel=${resultado.qualidade?.nivel || '?'} ` +
          `score=${resultado.qualidade?.score_global ?? '?'} ` +
          `alertas=${(resultado.qualidade?.alertas || []).length}` +
          (houveMudanca ? ' [mudou]' : '')
        )
      } else if (lidos % 25 === 0) {
        console.log(`  ${lidos}/${contadores.total} processados...`)
      }
    } catch (err) {
      contadores.erros += 1
      console.warn(`  ⚠️  Erro no equipamento ${doc._id}: ${err.message}`)
    }
  }

  const duracaoSeg = ((Date.now() - inicio) / 1000).toFixed(1)

  console.log('───────────────────────────────────────────────────────────────')
  console.log('📋 RELATÓRIO FINAL')
  console.log('───────────────────────────────────────────────────────────────')
  console.log(`Duração: ${duracaoSeg}s`)
  console.log(`Total processados:  ${contadores.processados}`)
  console.log(`Com mudança (histórico append): ${contadores.com_mudanca}`)
  console.log(`Sem mudança:        ${contadores.sem_mudanca}`)
  console.log(`Erros:              ${contadores.erros}`)
  console.log('')
  console.log('Distribuição por nível:')
  for (const [nivel, n] of Object.entries(contadores.por_nivel).sort((a,b) => b[1]-a[1])) {
    const pct = ((n / contadores.processados) * 100).toFixed(1)
    console.log(`  ${nivel.padEnd(22)} ${String(n).padStart(4)}  (${pct}%)`)
  }
  console.log('')
  console.log('Distribuição por tipo × nível:')
  for (const [tipo, niveis] of Object.entries(contadores.por_tipo)) {
    const linha = Object.entries(niveis).map(([n, c]) => `${n}=${c}`).join('  ')
    console.log(`  ${tipo.padEnd(18)} ${linha}`)
  }
  console.log('═══════════════════════════════════════════════════════════════')

  if (dryRun) console.log('⚠️  DRY-RUN — nada foi persistido.')

  await mongoose.disconnect()
}

main().catch(err => {
  console.error('❌ Falha fatal:', err)
  process.exit(1)
})
