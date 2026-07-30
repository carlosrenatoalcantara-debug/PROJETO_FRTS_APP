/**
 * instalacaoRefEtapa.check.js — S4C-0
 *
 * Verifica a etapa 'instalacao_ref' de salvarEtapaProjetoFV via handler direto
 * (req/res falsos) sobre MongoDB em memória. Sem HTTP, sem alterar contrato.
 *
 *   node backend/src/controllers/__checks__/instalacaoRefEtapa.check.js
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { ProjetoFV } from '../../models/ProjetoFV.js'
import { Cliente } from '../../models/Cliente.js'   // registra schema (resposta popula clienteId)
import { salvarEtapaProjetoFV } from '../projetosFVController.js'
void Cliente

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }

function fakeRes() {
  return { statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this }, json(b) { this.body = b; return this } }
}
const call = async (id, etapa, dados) => {
  const res = fakeRes()
  await salvarEtapaProjetoFV({ params: { id }, body: { etapa, dados } }, res)
  return res
}

async function main() {
  const mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())

  const proj = await ProjetoFV.create({ nome: 'S4C0', clienteId: new mongoose.Types.ObjectId() })
  const instId = new mongoose.Types.ObjectId()
  const pid = String(proj._id)

  // baseline: arranjos intactos
  const arranjosAntes = JSON.stringify((await ProjetoFV.findById(pid).lean()).arranjos || [])

  // 1) vincula
  let r = await call(pid, 'instalacao_ref', { id: String(instId) })
  ok(r.statusCode === 200, 'vincula: 200')
  let p = await ProjetoFV.findById(pid).lean()
  ok(String(p.instalacao_ref) === String(instId), 'vincula: instalacao_ref persistido')

  // 2) idempotência
  await call(pid, 'instalacao_ref', { id: String(instId) })
  p = await ProjetoFV.findById(pid).lean()
  ok(String(p.instalacao_ref) === String(instId), 'idempotente: mesmo valor não altera estado')

  // 3) reversibilidade (null remove)
  r = await call(pid, 'instalacao_ref', { id: null })
  p = await ProjetoFV.findById(pid).lean()
  ok(r.statusCode === 200 && p.instalacao_ref === null, 'reversível: null remove o vínculo')

  // 4) isolamento — arranjos inalterados
  ok(JSON.stringify((await ProjetoFV.findById(pid).lean()).arranjos || []) === arranjosAntes, 'isolamento: Arranjo intacto')

  // 5) rejeita id inválido
  r = await call(pid, 'instalacao_ref', { id: 'nao-e-objectid' })
  ok(r.statusCode === 400, 'valida: id inválido → 400')

  // 6) freeze guard aplica (CONGELADO bloqueia)
  await ProjetoFV.updateOne({ _id: pid }, { $set: { governanca: { freeze_status: 'CONGELADO' } } })
  r = await call(pid, 'instalacao_ref', { id: String(instId) })
  ok(r.statusCode === 409 && r.body?.codigo === 'PROJETO_CONGELADO', 'freeze guard: CONGELADO bloqueia (409)')

  await mongoose.disconnect(); await mongod.stop()
  console.log(falhas === 0 ? '\nOK — vínculo instalacao_ref íntegro e isolado.' : `\n${falhas} FALHA(S).`)
  process.exit(falhas === 0 ? 0 : 1)
}
main().catch(async (e) => { console.error('✖', e); process.exit(1) })
