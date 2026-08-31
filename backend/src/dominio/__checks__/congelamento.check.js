/**
 * congelamento.check.js — FV-DOM-002A (Parte A)
 *
 * Comprova o CONTRATO ÚNICO de congelamento:
 *   congelado ⟺ Orçamento APROVADO ∧ Baseline VÁLIDA
 * mais a cláusula de compatibilidade para projetos legados sem agregados.
 *
 *   node backend/src/dominio/__checks__/congelamento.check.js
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

import { ProjetoFV } from '../../models/ProjetoFV.js'
import { Cotacao } from '../../models/Cotacao.js'
import { Orcamento } from '../../models/Orcamento.js'
import { Baseline } from '../../models/Baseline.js'
import { Cliente } from '../../models/Cliente.js'
import { Local } from '../../models/Local.js'
import { CotacaoService } from '../../services/CotacaoService.js'
import { OrcamentoService } from '../../services/OrcamentoService.js'
import { resolverCongelamento } from '../congelamento/resolverCongelamento.js'
import { salvarEtapaProjetoFV } from '../../controllers/projetosFVController.js'
import {
  avaliarCongelamento, estaCongelado, projetoEstaCongelado,
  freezeStatusDerivado, MOTIVO_CONGELAMENTO,
} from '@fortesolar/fv-shared/estados/congelamento'
import { derivarStatusSeguro, podeExcluirDefinitivo } from '../../utils/statusLifecycle.js'
void Cliente; void Local

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

function fakeRes() {
  return {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this },
    json(b) { this.body = b; return this },
  }
}

async function main() {
  const mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await Promise.all([Cotacao.init(), Orcamento.init(), Baseline.init()])

  const empresa_id = new mongoose.Types.ObjectId()
  const req = (id, body) => ({ auth: { empresa_id, email: 'check@fv' }, params: { id }, body, headers: {}, socket: {} })

  // ═══ 1. Contrato puro ═════════════════════════════════════════════════════
  secao('1 · Contrato puro — congelado ⟺ aprovado ∧ baseline')

  ok(avaliarCongelamento({ orcamentoAprovado: true, baselineValida: true }).congelado, 'aprovado + baseline → CONGELADO')
  ok(avaliarCongelamento({ orcamentoAprovado: true, baselineValida: true }).motivo === MOTIVO_CONGELAMENTO.CONTRATO, 'motivo é CONTRATO')
  ok(!avaliarCongelamento({ orcamentoAprovado: true, baselineValida: false }).congelado, 'aprovado SEM baseline → NÃO congela (falha segura)')
  ok(avaliarCongelamento({ orcamentoAprovado: true, baselineValida: false }).motivo === MOTIVO_CONGELAMENTO.APROVADO_SEM_BASELINE,
     'estado incompleto é detectável pelo motivo')
  ok(!avaliarCongelamento({ orcamentoAprovado: false, baselineValida: true }).congelado, 'baseline sem aprovação → NÃO congela')
  ok(!avaliarCongelamento({}).congelado, 'projeto vazio → aberto')

  // Precedência: o contrato manda sobre o legado.
  const contraLegado = avaliarCongelamento({ orcamentoAprovado: true, baselineValida: true, freeze_status: 'RASCUNHO' })
  ok(contraLegado.congelado && contraLegado.canonico, 'contrato tem precedência sobre freeze_status=RASCUNHO')

  // ═══ 2. Cláusula de compatibilidade ═══════════════════════════════════════
  secao('2 · Compatibilidade — projetos legados sem agregados')

  for (const fs of ['CONGELADO', 'HOMOLOGADO']) {
    const r = avaliarCongelamento({ freeze_status: fs })
    ok(r.congelado && r.motivo === MOTIVO_CONGELAMENTO.LEGADO_FREEZE, `legado freeze_status=${fs} continua congelado`)
    ok(r.precisaBackfill && !r.canonico, `${fs} marcado como precisaBackfill — rastreável para o LME`)
  }
  for (const ws of ['ASSINADO', 'IMPLANTACAO', 'CONCLUIDO']) {
    ok(avaliarCongelamento({ workflow_status: ws }).congelado, `legado workflow_status=${ws} continua congelado`)
  }
  ok(!avaliarCongelamento({ freeze_status: 'APROVADO' }).congelado, 'freeze_status=APROVADO NÃO congela (aprovação ≠ contrato)')
  ok(freezeStatusDerivado({ orcamentoAprovado: true, baselineValida: true }) === 'CONGELADO', 'freeze_status derivado do contrato')
  ok(freezeStatusDerivado({ orcamentoAprovado: true, baselineValida: true }, 'HOMOLOGADO') === 'HOMOLOGADO', 'HOMOLOGADO legado é preservado')

  // ═══ 3. Resolvedor com I/O ════════════════════════════════════════════════
  secao('3 · Resolvedor — levanta os fatos no banco')

  const projeto = await ProjetoFV.create({
    nome: 'FV-DOM-002A', clienteId: new mongoose.Types.ObjectId(), empresa_id,
    consumo_kwh_mes: 800, valor_kwh: 0.92,
  })
  const pid = String(projeto._id)

  let r = await resolverCongelamento(projeto.toObject())
  ok(!r.congelado && r.motivo === MOTIVO_CONGELAMENTO.ABERTO, 'projeto novo: aberto')

  const cot = await CotacaoService.criar({ empresa_id, projeto_ref: projeto._id, tecnologia: 'string' })
  const orc = await OrcamentoService.criar({
    empresa_id, projeto_ref: projeto._id, cotacao_ref: cot._id,
    itens: [{ descricao: 'Kit', tipo: 'material', quantidade: 1, valor_unitario_r: 20000 }],
  })
  r = await resolverCongelamento(projeto.toObject())
  ok(!r.congelado, 'orçamento em RASCUNHO não congela')

  await OrcamentoService.transicionar(orc._id, 'EMITIDO', { por: 'check' })
  r = await resolverCongelamento(projeto.toObject())
  ok(!r.congelado, 'orçamento EMITIDO não congela')

  const { baseline } = await OrcamentoService.aprovar(orc._id, { por: 'check' })
  r = await resolverCongelamento(projeto.toObject())
  ok(r.congelado && r.motivo === MOTIVO_CONGELAMENTO.CONTRATO, 'aprovação + baseline → CONGELADO pelo contrato')
  ok(String(r.orcamento_ref) === String(orc._id) && String(r.baseline_ref) === String(baseline._id),
     'resolvedor devolve as refs do contrato (proveniência M-3)')

  // Baseline adulterada deixa de valer como contrato.
  await Baseline.collection.updateOne({ _id: baseline._id }, { $set: { hash: 'adulterado' } })
  r = await resolverCongelamento(projeto.toObject())
  ok(!r.congelado && r.motivo === MOTIVO_CONGELAMENTO.APROVADO_SEM_BASELINE,
     'baseline adulterada NÃO congela — mesmo critério do Gate')
  await Baseline.collection.updateOne({ _id: baseline._id }, { $set: { hash: baseline.hash } })

  // ═══ 4. Guard único ═══════════════════════════════════════════════════════
  secao('4 · Guard do salvarEtapa usa o contrato')

  const rEtapa = fakeRes()
  await salvarEtapaProjetoFV(req(pid, { etapa: 'dimensionamento', dados: { potencia_kwp: 5 } }), rEtapa)
  ok(rEtapa.statusCode === 409, 'projeto congelado pelo CONTRATO bloqueia a etapa (409)')
  ok(rEtapa.body?.codigo === 'PROJETO_CONGELADO', 'código de erro preservado')
  ok(rEtapa.body?.motivo === MOTIVO_CONGELAMENTO.CONTRATO, 'resposta informa o MOTIVO do congelamento — novidade desta sprint')

  // Este era o buraco A-2 da FV-DOM-002: aprovar o agregado não travava a etapa.
  const semGovernanca = await ProjetoFV.findById(pid).lean()
  ok(!semGovernanca.governanca?.freeze_status || semGovernanca.governanca.freeze_status === 'RASCUNHO',
     'o bloqueio NÃO veio de freeze_status — veio do agregado (fecha o achado A-2)')

  // ═══ 5. Projeto legado continua congelado ═════════════════════════════════
  secao('5 · Projeto legado — nenhum contrato reaberto')

  const legado = await ProjetoFV.create({
    nome: 'Legado', clienteId: new mongoose.Types.ObjectId(), empresa_id,
    governanca: { freeze_status: 'HOMOLOGADO', snapshot_tecnico: { x: 1 } },
  })
  const rl = await resolverCongelamento(legado.toObject())
  ok(rl.congelado && rl.motivo === MOTIVO_CONGELAMENTO.LEGADO_FREEZE,
     'projeto legado HOMOLOGADO permanece congelado — nenhum contrato foi reaberto')
  ok(rl.precisaBackfill, 'marcado para backfill (LME)')

  const rLegadoEtapa = fakeRes()
  await salvarEtapaProjetoFV(req(String(legado._id), { etapa: 'dimensionamento', dados: { potencia_kwp: 9 } }), rLegadoEtapa)
  ok(rLegadoEtapa.statusCode === 409, 'guard continua bloqueando o legado (sem regressão)')

  // ═══ 6. Consumidores migrados usam a mesma decisão ════════════════════════
  secao('6 · Consumidores migrados — uma decisão só')

  const aberto = { governanca: {} }
  const planoLegado = legado.toObject()
  ok(projetoEstaCongelado(planoLegado), 'porta síncrona concorda com o resolvedor')
  // derivarStatusSeguro só chega ao congelamento quando `status` está ausente —
  // com status preenchido ele retorna antes (comportamento pré-existente).
  const semStatus = { ...planoLegado, status: null }
  ok(derivarStatusSeguro(semStatus) === 'PROPOSTA', 'statusLifecycle usa o contrato (projeto sem status)')
  ok(derivarStatusSeguro({ ...aberto, status: null }) === 'RASCUNHO', 'projeto aberto sem status → RASCUNHO')
  ok(podeExcluirDefinitivo(planoLegado) === false, 'exclusão definitiva bloqueada pelo contrato')

  ok(!projetoEstaCongelado(aberto) && !estaCongelado({}), 'projeto aberto: todas as portas concordam')

  // Decisão pré-resolvida é respeitada (evita I/O repetido).
  const comFatos = { governanca: {}, congelamento: await resolverCongelamento(projeto.toObject()) }
  ok(projetoEstaCongelado(comFatos), 'decisão anexada ao projeto é reaproveitada sem novo I/O')

  await mongoose.disconnect()
  await mongod.stop()

  console.log(falhas === 0
    ? '\nOK — um único contrato de congelamento em todo o domínio FV'
    : `\n${falhas} FALHA(S)`)
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
