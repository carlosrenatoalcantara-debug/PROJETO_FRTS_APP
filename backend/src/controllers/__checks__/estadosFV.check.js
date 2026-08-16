/**
 * estadosFV.check.js — FV-UX-005 (F3.2 / F3.3)
 *
 * Cobre os dois defeitos corrigidos:
 *   I-1  alterarStatusCiclo aceitava qualquer valor e degradava para 'rascunho'.
 *   I-2  cenarios_governanca gravava 'EDITAVEL', fora do enum de freeze_status.
 *
 * Handlers chamados direto (req/res falsos) sobre MongoDB em memória. Sem HTTP.
 *
 *   node backend/src/controllers/__checks__/estadosFV.check.js
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { ProjetoFV, FREEZE_STATUS, ehFreezeStatusValido } from '../../models/ProjetoFV.js'
import { Cliente } from '../../models/Cliente.js'   // registra schema (resposta popula clienteId)
import { STATUS, paraModel, ehStatusValido } from '../../utils/statusLifecycle.js'
import {
  alterarStatusCiclo, alterarStatusGovernanca,
  congelarCenarioComercial, revisaoCenarioComercial,
} from '../projetosFVController.js'
void Cliente

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }

function fakeRes() {
  return {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this },
    json(b) { this.body = b; return this },
  }
}
// O escopo de tenant é fail-closed: o req precisa de auth.empresa_id.
const reqBase = (empresa_id) => ({ auth: { empresa_id }, headers: {}, ip: '127.0.0.1', socket: {} })

async function main() {
  const mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())

  const empresa_id = new mongoose.Types.ObjectId()
  const novoProjeto = () => ProjetoFV.create({
    nome: 'FV-UX-005', clienteId: new mongoose.Types.ObjectId(), empresa_id,
  })

  const chamar = async (handler, id, body) => {
    const res = fakeRes()
    await handler({ ...reqBase(empresa_id), params: { id }, body }, res)
    return res
  }

  // ── F3.2 — ciclo de vida ────────────────────────────────────────────────────
  console.log('\n── F3.2 · alterarStatusCiclo (defeito I-1)')

  // 1) mapeador puro não degrada mais
  ok(paraModel('LIXO') === null, "paraModel('LIXO') devolve null (antes: 'rascunho')")
  ok(paraModel('APROVADO') === 'aprovado', "paraModel('APROVADO') preserva o mapeamento válido")
  ok(!ehStatusValido('LIXO') && ehStatusValido('CONCLUIDO'), 'ehStatusValido discrimina corretamente')

  // 2) todos os estados válidos continuam funcionando
  for (const s of STATUS) {
    const p = await novoProjeto()
    const res = await chamar(alterarStatusCiclo, String(p._id), { status: s })
    const gravado = (await ProjetoFV.findById(p._id).lean()).status
    ok(res.statusCode === 200 && gravado === paraModel(s), `status válido "${s}" → 200 e grava "${gravado}"`)
  }

  // 3) estado inexistente é REJEITADO e nada é gravado
  const pInv = await novoProjeto()
  await chamar(alterarStatusCiclo, String(pInv._id), { status: 'concluido' })
  const resInv = await chamar(alterarStatusCiclo, String(pInv._id), { status: 'ESTADO_QUE_NAO_EXISTE' })
  const depoisInv = (await ProjetoFV.findById(pInv._id).lean()).status
  ok(resInv.statusCode === 422, 'estado inexistente → 422 (antes: 200)')
  ok(resInv.body?.codigo === 'STATUS_INVALIDO', 'resposta traz codigo STATUS_INVALIDO')
  ok(depoisInv === 'concluido', `nenhuma gravação silenciosa — permaneceu "${depoisInv}" (antes: virava 'rascunho')`)

  // 4) o caso exato do defeito: regressão de concluido → rascunho por entrada inválida
  const resVazio = await chamar(alterarStatusCiclo, String(pInv._id), { status: '   ' })
  ok(resVazio.statusCode === 422, 'string em branco → 422, não vira rascunho')

  // ── F3.3 — vocabulário de freeze_status ─────────────────────────────────────
  console.log('\n── F3.3 · freeze_status (defeito I-2)')

  ok(!ehFreezeStatusValido('EDITAVEL'), "'EDITAVEL' não pertence ao vocabulário canônico")
  ok(FREEZE_STATUS.length === 5, `vocabulário canônico tem 5 valores: ${FREEZE_STATUS.join(', ')}`)

  // 5) documento: transições existentes preservadas
  const pGov = await novoProjeto()
  const gid = String(pGov._id)
  const t1 = await chamar(alterarStatusGovernanca, gid, { status: 'APROVADO' })
  ok(t1.statusCode === 200, 'transição RASCUNHO → APROVADO continua válida')
  const t2 = await chamar(alterarStatusGovernanca, gid, { status: 'HOMOLOGADO' })
  ok(t2.statusCode === 422, 'transição APROVADO → HOMOLOGADO continua bloqueada (pula CONGELADO)')
  const t3 = await chamar(alterarStatusGovernanca, gid, { status: 'EDITAVEL' })
  ok(t3.statusCode === 400, "gravar 'EDITAVEL' no documento → 400")

  // 6) cenário (Mixed, sem enum do schema): nenhuma gravação de 'EDITAVEL'
  const pCen = await novoProjeto()
  const cid = String(pCen._id)
  const c1 = await chamar(congelarCenarioComercial, cid, { scenario_id: 'cen-1', usuario: 'check' })
  ok(c1.statusCode === 200 && c1.body?.cenario?.freeze_status === 'CONGELADO', 'cenário congela com CONGELADO')

  const c2 = await chamar(revisaoCenarioComercial, cid, { scenario_id: 'cen-1', usuario: 'check' })
  const fsRev = c2.body?.cenario?.freeze_status
  ok(c2.statusCode === 200 && fsRev === 'EM_REVISAO', `revisão reabre como EM_REVISAO (antes: 'EDITAVEL') — obtido "${fsRev}"`)

  const persistido = await ProjetoFV.findById(cid).lean()
  const todosCenarios = Object.values(persistido.governanca?.comercial?.cenarios_governanca || {})
  ok(todosCenarios.length > 0, `${todosCenarios.length} cenário(s) persistido(s)`)
  ok(
    todosCenarios.every((c) => ehFreezeStatusValido(c.freeze_status)),
    'todo freeze_status persistido pertence ao vocabulário canônico',
  )
  ok(
    !JSON.stringify(persistido.governanca?.comercial?.cenarios_governanca || {}).includes('EDITAVEL'),
    "nenhum 'EDITAVEL' no documento gravado",
  )

  // 7) leitura tolerante: documento legado com 'EDITAVEL' é normalizado, não quebra
  await ProjetoFV.updateOne(
    { _id: cid },
    { $set: { 'governanca.comercial.cenarios_governanca.cen-legado': { scenario_id: 'cen-legado', freeze_status: 'EDITAVEL' } } },
  )
  const c3 = await chamar(congelarCenarioComercial, cid, { scenario_id: 'cen-legado', usuario: 'check' })
  ok(c3.statusCode === 200, "cenário legado com 'EDITAVEL' continua operável (leitura tolerante)")
  const final = await ProjetoFV.findById(cid).lean()
  ok(
    final.governanca.comercial.cenarios_governanca['cen-legado'].freeze_status === 'CONGELADO',
    "'EDITAVEL' legado foi substituído por valor canônico ao ser gravado",
  )

  await mongoose.disconnect()
  await mongod.stop()

  console.log(falhas === 0 ? '\nOK — I-1 e I-2 corrigidos' : `\n${falhas} FALHA(S)`)
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
