#!/usr/bin/env node
/**
 * import-roi-closure.mjs — P1-CATALOG-ROI-CLOSURE-01
 * Importa a IDENTIDADE dos modelos ausentes (causa-B) dos fabricantes expostos pela limpeza
 * (TSUN, Znshine, Trina Solar, Dah, Helius). Potência derivada do nome; SEM specs elétricas inventadas.
 * Dedup por fabricante+modelo. Idempotente. origem rastreável. Uso: [--apply]
 */
import dns from 'dns'; dns.setServers(['8.8.8.8','1.1.1.1'])
import 'dotenv/config'
import mongoose from 'mongoose'
const APPLY = process.argv.includes('--apply')
console.log(APPLY ? '⚡ APPLY' : '🔍 DRY-RUN (use --apply para gravar)')
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS:20000, socketTimeoutMS:40000 })
const { Equipamento } = await import('../src/models/Equipamento.js')

const FONTE = 'P1-CATALOG-ROI-CLOSURE-01 (identidade do projeto SolarMarket pós-limpeza; specs elétricas pendentes de datasheet)'
const LOTE = [
  { fab:'Tsun',        modelo:'TS-S8B-144-560W',   tipo:'modulo',   potencia_w:560 },
  { fab:'Trina Solar', modelo:'TALLMAX TSM-DE18',  tipo:'modulo',   potencia_w:550 },
  { fab:'Znshine',     modelo:'ZXMR-UPLDD144-600W',tipo:'modulo',   potencia_w:600 },
  { fab:'Znshine',     modelo:'ZXMR-UPLDD144',     tipo:'modulo' }, // sem wattage no nome -> identidade só
  { fab:'Znshine',     modelo:'ZXM7-SHLD144-550/M',tipo:'modulo',   potencia_w:550 },
  { fab:'Znshine',     modelo:'ZXM7-UPLDD144-595', tipo:'modulo',   potencia_w:595 },
  { fab:'Znshine',     modelo:'ZXMR-UPLDD144-600/N',tipo:'modulo',  potencia_w:600 },
  { fab:'Helius',      modelo:'HMB132T12R',        tipo:'modulo',   potencia_w:630 },
  { fab:'Dah',         modelo:'DHN-SU1K5T-G0',     tipo:'inversor', potencia_kw:1.5 }, // "SU1K5"=1.5kW
]
// Diferidos (degenerados/não-modelo): "Solar Unit" (Dah), "650w" (Znshine), causa-D restantes -> revisão manual.

const res = { criados:0, ja_existem:0, detalhe:[] }
for (const it of LOTE) {
  const ex = await Equipamento.findOne({ fabricante: it.fab, modelo: it.modelo }).lean()
  if (ex) { res.ja_existem++; res.detalhe.push({ ...it, status:'JA_EXISTE', _id:String(ex._id) }); continue }
  const esp = it.tipo==='inversor' ? (it.potencia_kw?{potencia_kw:it.potencia_kw}:{}) : (it.potencia_w?{potencia_w:it.potencia_w}:{})
  const campo = it.tipo==='inversor' ? 'potencia_kw' : 'potencia_w'
  if (APPLY) {
    const doc = new Equipamento({
      fabricante: it.fab, modelo: it.modelo, tipo: it.tipo, especificacoes: esp,
      origem: { tipo:'import_planilha', fonte: FONTE, em: new Date() },
      fonte_dados: esp[campo]!==undefined ? { [campo]: { fonte:'modelo_sm', confianca:0.9, url:'derivado do nome do modelo SolarMarket' } } : {},
    })
    await doc.save()
    res.criados++; res.detalhe.push({ ...it, status:'CRIADO', _id:String(doc._id) })
  } else { res.criados++; res.detalhe.push({ ...it, status:'CRIARIA' }) }
}
console.log(`criados/criaria: ${res.criados} | ja_existem: ${res.ja_existem}`)
for (const d of res.detalhe) console.log(`  [${d.status}] ${d.fab} ${d.modelo} (${d.tipo})`)
import { writeFileSync, mkdirSync } from 'fs'; import { dirname, join } from 'path'; import { fileURLToPath } from 'url'
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'reports', 'catalog-roi-closure'); mkdirSync(dir,{recursive:true})
writeFileSync(join(dir, APPLY?'IMPORT_APPLY.json':'IMPORT_DRY.json'), JSON.stringify({ aplicado:APPLY, gerado_em:new Date().toISOString(), ...res }, null, 2))
await mongoose.disconnect(); process.exit(0)
