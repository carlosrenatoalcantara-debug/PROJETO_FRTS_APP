/**
 * migrar-topologia.mjs — P1-INV-TOPOLOGY-01
 *
 * Backfill ADITIVO (não destrutivo) do lado CC canônico nos inversores já
 * persistidos: deriva `entradas_por_mppt` (ex.: "3/3"→[3,3], "2/1"→[2,1]) e
 * `tipo_topologia` a partir do que já existe. NÃO remove `strings_por_mppt`
 * (mantido para compatibilidade). Idempotente. Mongo (se conectado) ou memória.
 *
 * Uso:  node scripts/migrar-topologia.mjs
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { derivarTopologia, normalizarEntradasPorMppt } from '../src/equipamentos/inversores/index.js'

function aplicar(eq) {
  const esp = eq.especificacoes || {}
  const ctx = { fabricante: eq.fabricante, modelo: eq.modelo, subtipo: esp.subtipo }
  const entradas = normalizarEntradasPorMppt(esp)
  const topo = derivarTopologia(esp, ctx)
  let mudou = false
  if (entradas && JSON.stringify(esp.entradas_por_mppt) !== JSON.stringify(entradas)) { esp.entradas_por_mppt = entradas; mudou = true }
  if (esp.tipo_topologia !== topo) { esp.tipo_topologia = topo; mudou = true }
  return { mudou, entradas, topo }
}

async function run() {
  let usouMongo = false
  try {
    if (process.env.MONGODB_URI) { await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 }); usouMongo = mongoose.connection.readyState === 1 }
  } catch { usouMongo = false }

  if (usouMongo) {
    const { Equipamento } = await import('../src/models/Equipamento.js')
    const invs = await Equipamento.find({ tipo: 'inversor' })
    console.log(`Mongo: ${invs.length} inversores`)
    for (const eq of invs) {
      const r = aplicar(eq)
      if (r.mudou) { eq.markModified('especificacoes'); await eq.save() }
      console.log(`  ${eq.fabricante} ${eq.modelo}: topo=${r.topo} entradas=${JSON.stringify(r.entradas)} ${r.mudou ? '(atualizado)' : '(ok)'}`)
    }
    await mongoose.disconnect()
  } else {
    const { memoryStore } = await import('../src/config/memoryStorage.js')
    const invs = memoryStore.findAllEquipamentos({}).filter(e => e.tipo === 'inversor')
    console.log(`memory-storage: ${invs.length} inversores`)
    for (const eq of invs) {
      const r = aplicar(eq)
      console.log(`  ${eq.fabricante} ${eq.modelo}: topo=${r.topo} entradas=${JSON.stringify(r.entradas)} ${r.mudou ? '(atualizado)' : '(ok)'}`)
    }
    memoryStore.saveToFile()
    console.log('  ✅ memory-storage persistido')
  }
}
await run()
console.log('\n✅ Concluído.')
