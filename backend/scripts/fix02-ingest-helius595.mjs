#!/usr/bin/env node
/**
 * fix02-ingest-helius595.mjs
 * P0-CATALOG-MATCHER-FIX-02 — FASE 1
 *
 * Cria o equipamento canônico HELIUS HMF132T12R-595HL a partir do datasheet
 * oficial de fábrica fornecido pelo usuário (revisão Dez/2024, range 595-620W).
 * Na sprint FIX-01 o 595HL fora rejeitado por ausência no datasheet então disponível;
 * o datasheet oficial agora confirma a coluna 595HL.
 *
 * Dedup por fabricante+modelo raw (hook pre('save') recalcula hash_unico). Idempotente.
 *
 * Uso:
 *   node scripts/fix02-ingest-helius595.mjs           # dry-run
 *   node scripts/fix02-ingest-helius595.mjs --apply    # grava
 */
import dns from 'dns'
dns.setServers(['8.8.8.8', '1.1.1.1'])
import 'dotenv/config'
import mongoose from 'mongoose'

const APPLY = process.argv.includes('--apply')
console.log(APPLY ? '⚡ APPLY' : '🔍 DRY-RUN (use --apply para gravar)')

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000, socketTimeoutMS: 40000 })
const { Equipamento } = await import('../src/models/Equipamento.js')

// Datasheet oficial Helius (Dez/2024), coluna 595HL — STC validado por Pmax≈Vmp×Imp (39.28×15.15=595.1)
const DS = {
  fabricante: 'Helius', modelo: 'HMF132T12R-595HL', tipo: 'modulo',
  fonte: 'https://he-solar.com/solar-panels/ (datasheet oficial HMF132T12R 595-620HL, rev. Dez/2024)',
  specs: {
    potencia_wp: 595, voc: 47.50, vmp: 39.28, isc: 15.90, imp: 15.15, eficiencia: 22.00,
    celulas: 132, tipo_celula: 'N-Type Monocristalina MBB Half-Cell',
    dimensoes: '2382x1134x30 mm', peso_kg: 28.2, grau_protecao_ip: 'IP68',
    tensao_max_sistema: 1500, fusivel_serie_max: 35,
    coef_temp_pmax: -0.30, coef_temp_voc: -0.26, coef_temp_isc: 0.046,
  },
  garantia_produto: { value: 15, unit: 'anos' },
  garantia_performance: { value: 30, unit: 'anos' },
}

const existente = await Equipamento.findOne({ fabricante: DS.fabricante, modelo: DS.modelo }).lean()
if (existente) {
  console.log(`⏭  JÁ EXISTE: ${DS.fabricante} ${DS.modelo} (_id ${existente._id})`)
  await mongoose.disconnect(); process.exit(0)
}

const fonteDados = {}
for (const c of Object.keys(DS.specs)) fonteDados[c] = { fonte: 'datasheet_fabricante', confianca: 1.0, url: DS.fonte }

const doc = {
  tipo: DS.tipo, fabricante: DS.fabricante, modelo: DS.modelo,
  especificacoes: DS.specs,
  garantia_produto: DS.garantia_produto, garantia_performance: DS.garantia_performance,
  datasheet_url: DS.fonte, ativo: true, _schema_versao: '2.0',
  origem: { tipo: 'datasheet_pdfparse', fonte: DS.fonte, arquivo_original_url: DS.fonte, em: new Date() },
  fonte_dados: fonteDados,
  aprovacao_tecnica: { status: 'aprovado', aprovado_em: new Date(),
    aprovado_por: 'P0-CATALOG-MATCHER-FIX-02', motivo: 'Datasheet oficial Helius (rev. Dez/2024) — coluna 595HL validada' },
}

if (APPLY) {
  const created = await Equipamento.create(doc)
  console.log(`✅ CRIADO: ${DS.fabricante} ${DS.modelo} (_id ${created._id}) qualidade=${created.qualidade?.nivel}/${created.qualidade?.score_global}`)
} else {
  console.log(`+ CRIARIA: ${DS.fabricante} ${DS.modelo} — ${Object.keys(DS.specs).length} specs`)
}

await mongoose.disconnect(); process.exit(0)
