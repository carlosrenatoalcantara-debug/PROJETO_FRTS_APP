// P0-FV-CATALOG-QUALITY-RECAL-01 — APLICAÇÃO no catálogo (Atlas).
//
// ⚠️ NÃO É EXECUTADO AUTOMATICAMENTE. Requer flag explícita --apply e MONGODB_URI.
//    Sem --apply roda em modo DRY (apenas relata, não grava). Idempotente:
//    só preenche `especificacoes.potencia_kw`/`tensao_ac` quando AUSENTES.
//
//    Uso:
//      node scripts/aplicar-derivacao-catalogo.mjs            # dry (não grava)
//      node scripts/aplicar-derivacao-catalogo.mjs --apply    # grava no Atlas
//
// Mantém origem.tipo='import_solarmarket' (identidade preservada) e adiciona a
// proveniência da derivação em `especificacoes._derivado` para auditoria.
import mongoose from 'mongoose'
import { Equipamento } from '../src/models/Equipamento.js'
import { derivarInversorPorModelo } from '../src/services/catalogoDerivacaoModelo.js'
import { processarEquipamento, aplicarResultadoNoDoc } from '../src/services/catalogoQualidade.js'

const APPLY = process.argv.includes('--apply')
const uri = process.env.MONGODB_URI || process.env.MONGO_URI

async function main() {
  if (!uri) { console.error('MONGODB_URI ausente — abortando (nada foi tocado).'); process.exit(1) }
  await mongoose.connect(uri)
  const filtro = { tipo: 'inversor', $or: [
    { especificacoes: { $exists: false } }, { especificacoes: null }, { especificacoes: {} },
    { 'especificacoes.potencia_kw': { $in: [null, undefined] } },
  ] }
  const docs = await Equipamento.find(filtro)
  let derivados = 0, gravados = 0
  const matriz = { derivavel: 0, parcial: 0, nao_derivavel: 0 }
  for (const doc of docs) {
    const temPot = doc.especificacoes && doc.especificacoes.potencia_kw != null
    if (temPot) continue
    const d = derivarInversorPorModelo({ fabricante: doc.fabricante, modelo: doc.modelo })
    matriz[d.categoria]++
    if (!d.campos_derivados.length) continue
    derivados++
    if (!APPLY) continue
    doc.especificacoes = {
      ...(doc.especificacoes || {}),
      ...d.especificacoes,
      _derivado: { metodo: d.metodo_potencia, confianca: d.confianca, tecnologia: d.tecnologia, em: new Date() },
    }
    const resultado = processarEquipamento(doc)
    aplicarResultadoNoDoc(doc, resultado)
    await doc.save()
    gravados++
  }
  console.log(JSON.stringify({ modo: APPLY ? 'APPLY' : 'DRY', candidatos: docs.length, derivados, gravados, matriz }, null, 2))
  await mongoose.disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
