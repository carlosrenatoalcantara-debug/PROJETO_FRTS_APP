// P0-FV-CATALOG-QUALITY-RECAL-01 — APLICAÇÃO no catálogo (Atlas).
// P1-UNKNOWN-POWER-APPLY-01 — gate de alta confiança adicionado.
//
// ⚠️ NÃO É EXECUTADO AUTOMATICAMENTE. Requer flag explícita --apply e MONGODB_URI.
//    Sem --apply roda em modo DRY (apenas relata, não grava). Idempotente:
//    só preenche `especificacoes.potencia_kw`/`tensao_ac` quando AUSENTES.
//
//    Uso:
//      node scripts/aplicar-derivacao-catalogo.mjs                      # dry (não grava)
//      node scripts/aplicar-derivacao-catalogo.mjs --apply              # grava apenas alta confiança
//      node scripts/aplicar-derivacao-catalogo.mjs --apply --incluir-media  # grava alta + média (revisar antes)
//
// Mantém origem.tipo='import_solarmarket' (identidade preservada) e adiciona a
// proveniência da derivação em `especificacoes._derivado` para auditoria.
import dns from 'dns'
import mongoose from 'mongoose'
import { Equipamento } from '../src/models/Equipamento.js'
import { derivarInversorPorModelo } from '../src/services/catalogoDerivacaoModelo.js'
import { processarEquipamento, aplicarResultadoNoDoc } from '../src/services/catalogoQualidade.js'

const APPLY = process.argv.includes('--apply')
const INCLUIR_MEDIA = process.argv.includes('--incluir-media')
const uri = process.env.MONGODB_URI || process.env.MONGO_URI

// Fix querySrv ECONNREFUSED em dev (igual a database.js)
const DNS_SERVERS = (process.env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1')
  .split(',').map(s => s.trim()).filter(Boolean)
try { dns.setServers(DNS_SERVERS) } catch (_) {}

async function main() {
  if (!uri) { console.error('MONGODB_URI ausente — abortando (nada foi tocado).'); process.exit(1) }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 })
  const filtro = { tipo: 'inversor', $or: [
    { especificacoes: { $exists: false } }, { especificacoes: null }, { especificacoes: {} },
    { 'especificacoes.potencia_kw': { $in: [null, undefined] } },
  ] }
  const docs = await Equipamento.find(filtro)
  let derivados = 0, gravados = 0, skipped_media = 0
  const matriz = { derivavel: [], parcial: [], nao_derivavel: [] }
  for (const doc of docs) {
    const temPot = doc.especificacoes && doc.especificacoes.potencia_kw != null
    if (temPot) continue
    const d = derivarInversorPorModelo({ fabricante: doc.fabricante, modelo: doc.modelo })
    const row = { _id: String(doc._id), fabricante: doc.fabricante, modelo: doc.modelo,
      potencia_kw: d.especificacoes.potencia_kw ?? null, confianca: d.confianca,
      metodo: d.metodo_potencia, tecnologia: d.tecnologia }
    matriz[d.categoria].push(row)
    if (!d.campos_derivados.length) continue
    derivados++
    if (!APPLY) continue
    // Gate: apenas alta confiança (categoria==='derivavel'), a menos que --incluir-media
    if (d.categoria !== 'derivavel' && !INCLUIR_MEDIA) { skipped_media++; continue }
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
  const out = {
    modo: APPLY ? (INCLUIR_MEDIA ? 'APPLY_TUDO' : 'APPLY_ALTA_CONFIANCA') : 'DRY',
    candidatos: docs.length,
    derivados_totais: derivados,
    gravados,
    skipped_media,
    contagem: {
      alta_confianca: matriz.derivavel.length,
      media_confianca: matriz.parcial.length,
      nao_derivavel: matriz.nao_derivavel.length,
    },
    matriz,
  }
  console.log(JSON.stringify(out, null, 2))
  await mongoose.disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
