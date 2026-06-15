#!/usr/bin/env node
/**
 * import-high-roi-wave2.mjs — P1-CATALOG-HIGH-ROI-IMPORT-01
 * Importa a IDENTIDADE dos equipamentos ausentes dos fabricantes-alvo (HELIUS, RONMA,
 * PULLING ENERGY, BELENERGY) para destravar o binding dos projetos SolarMarket.
 *
 * HONESTIDADE: grava fabricante/modelo/tipo + potência (derivada do PRÓPRIO nome do modelo).
 * NÃO inventa specs elétricas (voc/isc/vmpp/impp ficam vazios -> enriquecer em wave de datasheet).
 * Dedup por fabricante+modelo. Idempotente. origem rastreável.
 *
 * Uso: node scripts/import-high-roi-wave2.mjs [--apply]
 */
import dns from 'dns'; dns.setServers(['8.8.8.8','1.1.1.1'])
import 'dotenv/config'
import mongoose from 'mongoose'
const APPLY = process.argv.includes('--apply')
console.log(APPLY ? '⚡ APPLY' : '🔍 DRY-RUN (use --apply para gravar)')
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS:20000, socketTimeoutMS:40000 })
const { Equipamento } = await import('../src/models/Equipamento.js')

const FONTE = 'P1-CATALOG-HIGH-ROI-IMPORT-01 (identidade do projeto SolarMarket; specs elétricas pendentes de datasheet)'
// causa A/B dos fabricantes-alvo, modelos com nome limpo. SIRIUS omitido (marca corrompida -> data-cleaning).
const LOTE = [
  // PULLING ENERGY (causa A — ausente no Atlas) — módulos
  { fab:'Pulling Energy', modelo:'PU-585-SNM102', tipo:'modulo', potencia_w:585 },
  { fab:'Pulling Energy', modelo:'PU-625-DNM101', tipo:'modulo', potencia_w:625 },
  { fab:'Pulling Energy', modelo:'PU-620-SNM102', tipo:'modulo', potencia_w:620 },
  { fab:'Pulling Energy', modelo:'PU-600-DNM101', tipo:'modulo', potencia_w:600 },
  // BELENERGY (causa A — ausente) — módulos + inversores
  { fab:'Belenergy', modelo:'MFVHO-MO-120-460W', tipo:'modulo', potencia_w:460 },
  { fab:'Belenergy', modelo:'MFVHO-MO-144-550W', tipo:'modulo', potencia_w:550 },
  { fab:'Belenergy', modelo:'BEL-4K-G', tipo:'inversor', potencia_kw:4 },
  { fab:'Belenergy', modelo:'60K-4G', tipo:'inversor', potencia_kw:60 },
  // RONMA SOLAR (causa B — fabricante existe, modelo ausente) — módulo
  { fab:'Ronma Solar', modelo:'RM-620W-182M/156TB', tipo:'modulo', potencia_w:620 },
  // HELIUS (causa B — fabricante existe, modelo ausente) — módulo
  { fab:'Helius', modelo:'HMF144T10R-580HL', tipo:'modulo', potencia_w:580 },
]

const res = { criados:0, ja_existem:0, detalhe:[] }
for (const it of LOTE) {
  const existente = await Equipamento.findOne({ fabricante: it.fab, modelo: it.modelo }).lean()
  if (existente) { res.ja_existem++; res.detalhe.push({ ...it, status:'JA_EXISTE', _id:String(existente._id) }); continue }
  const especificacoes = it.tipo === 'inversor' ? { potencia_kw: it.potencia_kw } : { potencia_w: it.potencia_w }
  const campo = it.tipo === 'inversor' ? 'potencia_kw' : 'potencia_w'
  if (APPLY) {
    const doc = new Equipamento({
      fabricante: it.fab, modelo: it.modelo, tipo: it.tipo,
      especificacoes,
      origem: { tipo:'import_planilha', fonte: FONTE, em: new Date() },
      fonte_dados: { [campo]: { fonte:'modelo_sm', confianca:0.9, url:'derivado do nome do modelo SolarMarket' } },
    })
    await doc.save()  // pre-save hook calcula qualidade + hash_unico
    res.criados++; res.detalhe.push({ ...it, status:'CRIADO', _id:String(doc._id) })
  } else {
    res.criados++; res.detalhe.push({ ...it, status:'CRIARIA' })
  }
}
console.log(`criados/criaria: ${res.criados} | ja_existem: ${res.ja_existem}`)
for (const d of res.detalhe) console.log(`  [${d.status}] ${d.fab} ${d.modelo} (${d.tipo})`)
import { writeFileSync, mkdirSync } from 'fs'; import { dirname, join } from 'path'; import { fileURLToPath } from 'url'
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'reports', 'catalog-high-roi'); mkdirSync(dir,{recursive:true})
writeFileSync(join(dir, APPLY?'IMPORT_APPLY.json':'IMPORT_DRY.json'), JSON.stringify({ aplicado:APPLY, gerado_em:new Date().toISOString(), ...res }, null, 2))
await mongoose.disconnect()
process.exit(0)
