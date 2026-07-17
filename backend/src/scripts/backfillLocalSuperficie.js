/**
 * backfillLocalSuperficie.js — S1-FV-DOMAIN-MIGRATION-01
 *
 * Cria os agregados Local [AR-2] + Superfície [E-01] a partir dos dados
 * DETERMINÍSTICOS já existentes em cada ProjetoFV (localizacao / telhado / area).
 * NÃO migra topologia. NÃO cria Gerador/MPPT/String. NÃO toca Engenharia,
 * Unifilar nem OCR. Preenche `ProjetoFV.local_ref` (aditivo).
 *
 * POLÍTICA DE LEGADO (S1):
 *   - Congelado / homologado / com ART / em execução / concluído / proposta aceita
 *     → PERMANECE no modelo legado. Não cria Local. local_ref continua null.
 *   - Em edição (rascunho / em_simulacao / em_analise / dimensionado / proposta)
 *     → migra apenas dados determinísticos (coordenadas, clima, geometria de
 *       superfície). Topologia permanece "não informada".
 *   - Idempotente: projeto com local_ref já preenchido é ignorado; Local já criado
 *     para um projeto (origem.projeto_id) é reaproveitado.
 *
 * USO:
 *   node backend/src/scripts/backfillLocalSuperficie.js            # DRY-RUN (não grava)
 *   node backend/src/scripts/backfillLocalSuperficie.js --commit   # grava
 *   node backend/src/scripts/backfillLocalSuperficie.js --limit=50 # amostra
 */

import mongoose from 'mongoose'
import { conectarBD, desconectarBD } from '../config/database.js'
import { ProjetoFV } from '../models/ProjetoFV.js'
import { Local } from '../models/Local.js'

const COMMIT = process.argv.includes('--commit')
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='))
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split('=')[1]) : 0

// ── Orientação textual → azimute (graus). Determinístico. ────────────────────
const ORIENTACAO_AZIMUTE = {
  norte: 0, n: 0,
  nordeste: 45, ne: 45,
  leste: 90, l: 90, este: 90, e: 90,
  sudeste: 135, se: 135,
  sul: 180, s: 180,
  sudoeste: 225, so: 225, sw: 225,
  oeste: 270, o: 270, w: 270,
  noroeste: 315, no: 315, nw: 315,
}
function azimuteDeOrientacao(orientacao) {
  if (orientacao == null) return null
  const k = String(orientacao).trim().toLowerCase()
  return k in ORIENTACAO_AZIMUTE ? ORIENTACAO_AZIMUTE[k] : null
}
const num = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v); return Number.isFinite(n) ? n : null
}

const TIPO_TELHADO_VALIDO = new Set(['ceramico','metalico','fibrocimento','laje','madeira','solo','carport','outro'])
function tipoCoberturaDe(v) {
  if (!v) return null
  const k = String(v).trim().toLowerCase()
  return TIPO_TELHADO_VALIDO.has(k) ? k : 'outro'
}

/** Um projeto é legado (não migrar) se estiver congelado/homologado/executado. */
export function ehLegado(p) {
  const gov = p.governanca || {}
  if (['CONGELADO', 'HOMOLOGADO'].includes(gov.freeze_status)) return { legado: true, motivo: `freeze:${gov.freeze_status}` }
  if (gov.snapshot_engenharia || gov.snapshot_responsavel_tecnico) return { legado: true, motivo: 'snapshot_congelado' }
  if (p.homologacao?.status === 'homologado') return { legado: true, motivo: 'homologado' }
  if (['em_execucao', 'concluido'].includes(p.status)) return { legado: true, motivo: `status:${p.status}` }
  if (p.proposta?.status === 'aceita') return { legado: true, motivo: 'proposta_aceita' }
  return { legado: false, motivo: null }
}

/** Extrai coordenadas/clima determinísticos (localizacao v3 → flat v2). */
export function montarLocalPayload(p) {
  const loc = p.localizacao || {}
  const latitude = num(loc.latitude) ?? num(p.latitude)
  const longitude = num(loc.longitude) ?? num(p.longitude)

  return {
    coordenadas: { latitude, longitude },
    endereco: {
      endereco_completo: loc.endereco_completo ?? p.endereco_completo ?? null,
      cep: loc.cep ?? null,
      cidade: loc.cidade ?? null,
      estado: loc.estado ?? null,
    },
    // irradiância DIÁRIA (kWh/m²/dia). Só migra o campo v3 explícito — NÃO usa o
    // flat `irradiancia_local` (unidade mensal, default 131.44) para não inventar dado.
    hsp0_kwh_m2_dia: num(loc.irradiancia_kwh_kwp_dia),
    fonte_irradiancia: loc.fonte_irradiancia ?? null,
    data_coleta_climatica: loc.atualizado_clima_em ?? null,
    temperatura_min_c: num(loc.temperatura_min_historica_c),
    temperatura_max_c: num(loc.temperatura_max_historica_c),
    temperatura_media_c: num(loc.temperatura_media_c),
    fonte_climatica: loc.fonte_climatica ?? 'manual',
    origem: { projeto_id: p._id, fonte: 'backfill_projetoFV', migrado_em: new Date() },
  }
}

/** Extrai UMA Superfície determinística (layoutSolar v3 → area → telhado flat). */
export function montarSuperficies(p) {
  const ls = p.layoutSolar || {}
  const area = p.area || {}
  const telhado = p.telhado || {}

  const area_m2 = num(ls.area_util_m2) ?? num(area.area_m2) ?? num(area.area_util_m2) ?? num(telhado.area_m2)
  const orientacao = ls.orientacao ?? area.orientacao ?? telhado.orientacao ?? null
  const inclinacao = num(ls.inclinacao_graus) ?? num(area.inclinacao) ?? num(telhado.inclinacao)
  const tipo = tipoCoberturaDe(ls.tipo_telhado)
  const sombra = num(ls.sombreamento_pct)

  // Sem nenhum dado geométrico → nenhuma Superfície (permanece "não informada").
  if (area_m2 == null && orientacao == null && inclinacao == null) return []

  return [{
    nome: orientacao ? `Telhado ${orientacao}` : 'Telhado',
    area_disponivel_m2: area_m2,
    azimute_graus: azimuteDeOrientacao(orientacao),
    inclinacao_graus: inclinacao,
    tipo_cobertura: tipo,
    sombreamento_parcial: sombra != null ? sombra > 0 : false,
    estado: 'ativa',
    origem: { projeto_id: p._id, fonte: 'backfill_geometria', migrado_em: new Date() },
  }]
}

async function run() {
  await conectarBD()
  if (mongoose.connection.readyState !== 1) {
    console.error('✖ Sem conexão real com MongoDB (readyState != 1). Abortando — backfill exige Mongo.')
    await desconectarBD()
    process.exit(1)
  }

  const filtro = { excluido: { $ne: true } }
  let q = ProjetoFV.find(filtro).select(
    '_id nome status local_ref localizacao latitude longitude endereco_completo ' +
    'layoutSolar area telhado governanca homologacao proposta'
  )
  if (LIMIT > 0) q = q.limit(LIMIT)
  const projetos = await q.lean()

  const stats = {
    total: projetos.length,
    ja_migrado: 0, legado: 0, sem_dados: 0, migravel: 0, criados: 0,
    com_superficie: 0, sem_superficie: 0,
  }
  const legadoMotivos = {}
  const amostra = []

  for (const p of projetos) {
    if (p.local_ref) { stats.ja_migrado++; continue }

    const { legado, motivo } = ehLegado(p)
    if (legado) {
      stats.legado++
      legadoMotivos[motivo] = (legadoMotivos[motivo] || 0) + 1
      continue
    }

    const payload = montarLocalPayload(p)
    const superficies = montarSuperficies(p)
    payload.superficies = superficies
    stats.migravel++
    superficies.length ? stats.com_superficie++ : stats.sem_superficie++

    if (amostra.length < 8) {
      amostra.push({
        projeto: p.nome, status: p.status,
        coord: payload.coordenadas,
        hsp0: payload.hsp0_kwh_m2_dia, tmin: payload.temperatura_min_c,
        superficies: superficies.map(s => ({ nome: s.nome, area: s.area_disponivel_m2, azimute: s.azimute_graus, incl: s.inclinacao_graus })),
      })
    }

    if (COMMIT) {
      // Idempotência forte: reusa Local já criado para este projeto, se existir.
      let local = await Local.findOne({ 'origem.projeto_id': p._id })
      if (!local) { local = await Local.create(payload); stats.criados++ }
      await ProjetoFV.updateOne({ _id: p._id }, { $set: { local_ref: local._id } })
    }
  }

  console.log('\n══════════════════════════════════════════════════════════')
  console.log(`  BACKFILL Local/Superfície — ${COMMIT ? 'COMMIT (gravando)' : 'DRY-RUN (nada gravado)'}`)
  console.log('══════════════════════════════════════════════════════════')
  console.table(stats)
  console.log('Legado por motivo:', legadoMotivos)
  console.log('\nAmostra de migráveis (até 8):')
  console.dir(amostra, { depth: null })
  if (!COMMIT) console.log('\nℹ  Rode novamente com --commit para gravar.')

  await desconectarBD()
  process.exit(0)
}

// Auto-executa apenas quando invocado diretamente (permite importar os
// helpers puros — ehLegado/montarLocalPayload/montarSuperficies — em testes).
const invocadoDireto = (process.argv[1] || '').replace(/\\/g, '/').endsWith('backfillLocalSuperficie.js')
if (invocadoDireto) {
  run().catch(async (e) => {
    console.error('✖ Backfill falhou:', e)
    try { await desconectarBD() } catch { /* noop */ }
    process.exit(1)
  })
}
