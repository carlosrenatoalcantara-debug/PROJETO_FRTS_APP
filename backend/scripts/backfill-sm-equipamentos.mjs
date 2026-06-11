#!/usr/bin/env node
/**
 * backfill-sm-equipamentos.mjs
 * P0-SOLARMARKET-MIGRATION-INTEGRITY-01
 *
 * Popula equipamentos.paineis[] e equipamentos.inversor em todos os projetos
 * importados do SolarMarket que têm proposta_sm.equipamentos mas ainda não têm
 * esses campos preenchidos no schema Mongoose.
 *
 * Também sincroniza:
 *   consumo_kwh_mes  → fatura_extracao.consumo_mensal_kwh
 *   distribuidora    → fatura_extracao.concessionaria
 *   valor_kwh        → fatura_extracao.valor_kwh
 *
 * Uso:
 *   node scripts/backfill-sm-equipamentos.mjs           # dry-run
 *   node scripts/backfill-sm-equipamentos.mjs --apply   # aplica no banco
 *   node scripts/backfill-sm-equipamentos.mjs --apply --verbose
 */

import dns from 'dns'
dns.setServers(['8.8.8.8', '1.1.1.1'])

import 'dotenv/config'
import { MongoClient } from 'mongodb'

const ARGS    = process.argv.slice(2)
const DRY_RUN = !ARGS.includes('--apply')
const VERBOSE = ARGS.includes('--verbose') || ARGS.includes('-v')

if (DRY_RUN) {
  console.log('🔍 DRY-RUN — nenhuma escrita no banco. Use --apply para aplicar.')
} else {
  console.log('⚡ APPLY — os dados SERÃO escritos no banco!')
}

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI não configurada'); process.exit(1) }

// ── Extrai marca e modelo de um nome de item do SolarMarket ──────────────────
// Heurística: última palavra que contém dígito(s) é o modelo; o restante é a marca
// Exemplos:
//   "PULLING ENERGY PU-620-SNM102" → marca: "PULLING ENERGY", modelo: "PU-620-SNM102"
//   "TSUN TSOL-MS2000"             → marca: "TSUN",           modelo: "TSOL-MS2000"
//   "HELIUS HMF132T12R-600HL"      → marca: "HELIUS",         modelo: "HMF132T12R-600HL"
//   "Deye SUN-6K-G03"              → marca: "Deye",           modelo: "SUN-6K-G03"
function extrairMarcaModelo(nomeItem) {
  if (!nomeItem || typeof nomeItem !== 'string') return { marca: '', modelo: nomeItem || '' }
  const partes = nomeItem.trim().split(/\s+/)
  if (partes.length === 1) return { marca: partes[0], modelo: partes[0] }

  // Encontra o último token que contém pelo menos 1 dígito (padrão de código de modelo)
  let idxModelo = -1
  for (let i = partes.length - 1; i >= 0; i--) {
    if (/\d/.test(partes[i])) { idxModelo = i; break }
  }

  if (idxModelo <= 0) {
    // Sem padrão numérico claro: primeira palavra = marca, resto = modelo
    return { marca: partes[0], modelo: partes.slice(1).join(' ') || partes[0] }
  }

  const marca  = partes.slice(0, idxModelo).join(' ') || partes[0]
  const modelo = partes.slice(idxModelo).join(' ')
  return { marca, modelo }
}

// ── Processa proposta_sm.equipamentos e monta os arrays do schema ─────────────
function processarEquipamentos(equipamentosSM) {
  if (!Array.isArray(equipamentosSM) || equipamentosSM.length === 0) return null

  const paineis   = []
  let   inversor  = null

  for (const eq of equipamentosSM) {
    const cat = (eq.categoria || eq.category || '').trim()
    const item = (eq.item || '').trim()
    const qnt  = Number(eq.qnt || eq.quantidade || 0)

    if (!item) continue

    if (cat === 'Módulo') {
      const { marca, modelo } = extrairMarcaModelo(item)
      paineis.push({
        id:       `sm-${modelo.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        marca,
        modelo,
        potencia_w: null,   // não disponível no SM (apenas nome)
        quantidade: qnt || 1,
        equipamento_id: null,  // binding para o Atlas fica para sprint P1-BIND
      })
    } else if (cat === 'Inversor') {
      // Usa apenas o primeiro inversor; múltiplos inversores ficam em num_inversores
      if (!inversor) {
        const { marca, modelo } = extrairMarcaModelo(item)
        inversor = {
          id:          `sm-${modelo.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          marca,
          modelo,
          potencia_kw: null,
          tipo:        null,
          fases:       null,
          equipamento_id: null,
        }
      }
    }
    // KIT e Componente: ignorados para equipamentos.paineis[] (não são módulos/inversores)
  }

  return { paineis, inversor }
}

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000, socketTimeoutMS: 30000 })

try {
  await client.connect()
  const col = client.db().collection('projetofvs')

  // Busca todos os projetos SM com proposta_sm mas sem equipamentos.paineis preenchido
  const query = {
    'origem.tipo':   'import_solarmarket',
    proposta_sm:     { $exists: true, $ne: null },
    'proposta_sm.equipamentos': { $exists: true },
  }

  const projetos = await col.find(query).toArray()

  console.log(`\n📊 Projetos a processar: ${projetos.length}`)

  const rel = {
    total: projetos.length,
    comPaineis: 0,
    comInversor: 0,
    jaPopulados: 0,
    semEquipSM: 0,
    erros: 0,
    atualizados: 0,
  }

  for (const p of projetos) {
    const equip = p.proposta_sm?.equipamentos
    if (!equip || !Array.isArray(equip) || equip.length === 0) {
      rel.semEquipSM++
      continue
    }

    // Verifica se já está populado
    if (p.equipamentos?.paineis?.length > 0) {
      rel.jaPopulados++
      if (VERBOSE) console.log(`  [skip] ${p.nome} — paineis já preenchidos`)
      continue
    }

    const resultado = processarEquipamentos(equip)
    if (!resultado) { rel.semEquipSM++; continue }

    const { paineis, inversor } = resultado

    if (paineis.length > 0) rel.comPaineis++
    if (inversor)           rel.comInversor++

    // Monta o $set
    const $set = {}

    if (paineis.length > 0) {
      $set['equipamentos.paineis'] = paineis
    }
    if (inversor) {
      $set['equipamentos.inversor'] = inversor
    }

    // Sincroniza consumo/distribuidora/tarifa → fatura_extracao (se não existir)
    if (p.consumo_kwh_mes != null && !p.fatura_extracao?.consumo_mensal_kwh) {
      $set['fatura_extracao.consumo_mensal_kwh'] = p.consumo_kwh_mes
    }
    if (p.distribuidora && !p.fatura_extracao?.concessionaria) {
      $set['fatura_extracao.concessionaria'] = p.distribuidora
    }
    if (p.valor_kwh != null && !p.fatura_extracao?.valor_kwh) {
      $set['fatura_extracao.valor_kwh'] = p.valor_kwh
    }

    if (Object.keys($set).length === 0) continue

    if (VERBOSE) {
      console.log(`  [${DRY_RUN ? 'dry' : 'set'}] ${p.nome}`)
      if (paineis.length > 0) console.log(`    paineis: ${paineis.map(pp => `${pp.marca} ${pp.modelo} x${pp.quantidade}`).join(', ')}`)
      if (inversor) console.log(`    inversor: ${inversor.marca} ${inversor.modelo}`)
    }

    if (!DRY_RUN) {
      try {
        await col.updateOne({ _id: p._id }, { $set })
        rel.atualizados++
      } catch (err) {
        rel.erros++
        console.warn(`  ⚠ Erro ao atualizar ${p.nome}: ${err.message}`)
      }
    } else {
      rel.atualizados++ // conta como "atualizaria"
    }
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`RESULTADO DO BACKFILL${DRY_RUN ? ' (DRY-RUN)' : ''}`)
  console.log(`${'─'.repeat(60)}`)
  console.log(`  Total processados        : ${rel.total}`)
  console.log(`  Com módulos parseados    : ${rel.comPaineis}`)
  console.log(`  Com inversor parseado    : ${rel.comInversor}`)
  console.log(`  Já populados (skip)      : ${rel.jaPopulados}`)
  console.log(`  Sem equipamentos SM      : ${rel.semEquipSM}`)
  console.log(`  ${DRY_RUN ? 'Atualizaria' : 'Atualizados'} no banco    : ${rel.atualizados}`)
  console.log(`  Erros                    : ${rel.erros}`)

  if (DRY_RUN) {
    console.log(`\n💡 Para aplicar: node scripts/backfill-sm-equipamentos.mjs --apply`)
  } else {
    console.log(`\n✅ Backfill concluído.`)
  }

  // Verificação pós-apply: Paulo Carlos
  if (!DRY_RUN) {
    const paulo = await col.findOne({ nome: { $regex: /207 - Paulo Carlos/i } })
    if (paulo) {
      console.log(`\n📄 VERIFICAÇÃO — Paulo Carlos (207):`)
      console.log(`  equipamentos.paineis: ${paulo.equipamentos?.paineis?.length || 0} itens`)
      paulo.equipamentos?.paineis?.forEach((pp, i) => {
        console.log(`    [${i}] ${pp.marca} ${pp.modelo} x${pp.quantidade}`)
      })
      console.log(`  equipamentos.inversor: ${paulo.equipamentos?.inversor?.marca || 'N/A'} ${paulo.equipamentos?.inversor?.modelo || ''}`)
    }
  }

} catch (err) {
  console.error('❌ Erro no backfill:', err.message)
  if (err.stack) console.error(err.stack)
  process.exitCode = 1
} finally {
  await client.close()
}
