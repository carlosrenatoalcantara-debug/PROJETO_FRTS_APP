/**
 * agregadosFv.check.js — FV-API-001
 *
 * Exercita os 6 endpoints canônicos contra agregados reais e comprova:
 *   • respondem direto pelos agregados (sem adapter, sem subdoc legado)
 *   • M-4: outra organização recebe 404
 *   • GET /:id permanece inalterado (compatibilidade)
 *
 *   node backend/src/controllers/__checks__/agregadosFv.check.js
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
import {
  listarCotacoes, listarOrcamentos, obterOrcamentoVigente,
  obterBaseline, obterGate, listarFases,
} from '../agregadosFvController.js'
import { buscarProjetoFV } from '../projetosFVController.js'
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

async function chamar(handler, id, empresa_id) {
  const res = fakeRes()
  await handler({ auth: { empresa_id, email: 'check@fv' }, params: { id }, body: {}, headers: {}, socket: {} }, res)
  return res
}

async function main() {
  const mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await Promise.all([Cotacao.init(), Orcamento.init(), Baseline.init()])

  const empresa_id = new mongoose.Types.ObjectId()
  const outraEmpresa = new mongoose.Types.ObjectId()

  const projeto = await ProjetoFV.create({
    nome: 'FV-API-001', clienteId: new mongoose.Types.ObjectId(), empresa_id,
  })
  const pid = String(projeto._id)

  // 3 cotações + 3 orçamentos, um aprovado.
  const cots = []
  for (const t of ['string', 'micro', 'bess']) {
    cots.push(await CotacaoService.criar({
      empresa_id, projeto_ref: projeto._id, tecnologia: t, rotulo: `Cenário ${t}`,
      premissas: { consumo_kwh_mes: 800 },
    }))
  }
  const orcs = []
  for (let i = 0; i < 3; i++) {
    orcs.push(await OrcamentoService.criar({
      empresa_id, projeto_ref: projeto._id, cotacao_ref: cots[i]._id, numero: `ORC-00${i + 1}`,
      itens: [
        { descricao: 'Kit', tipo: 'material', quantidade: 1, valor_unitario_r: 20000 },
        { descricao: 'Mão de obra', tipo: 'servico', quantidade: 1, valor_unitario_r: 5000 },
      ],
    }))
  }

  // ═══ 1. Antes da aprovação ════════════════════════════════════════════════
  secao('1 · Cotações e orçamentos — listas COMPLETAS')

  const rc = await chamar(listarCotacoes, pid, empresa_id)
  ok(rc.statusCode === 200 && rc.body.total === 3, `GET /cotacoes → ${rc.body?.total} cotações (N por projeto)`)
  ok(rc.body.cotacoes.every((c) => c.tecnologia && c._id), 'cotações vêm na forma própria do agregado')
  ok(!('itens_adicionais' in (rc.body.cotacoes[0] || {})), 'nenhum vestígio da forma legada')

  const ro = await chamar(listarOrcamentos, pid, empresa_id)
  ok(ro.body.total === 3, `GET /orcamentos → ${ro.body.total} orçamentos`)
  ok(ro.body.aprovado_ref === null, 'nenhum aprovado ainda')
  ok(ro.body.orcamentos[0].totais.total_venda_r === 25000,
     `totais DERIVADOS na resposta (R$ ${ro.body.orcamentos[0].totais.total_venda_r})`)
  ok(!('kit' in ro.body.orcamentos[0]) && !('modo' in ro.body.orcamentos[0]),
     'resposta NÃO tem `kit`/`modo` — não passou por adapter')

  const rv = await chamar(obterOrcamentoVigente, pid, empresa_id)
  ok(rv.body.orcamento?.estado === 'RASCUNHO', 'vigente = mais recente em elaboração')

  const rb = await chamar(obterBaseline, pid, empresa_id)
  ok(rb.body.baseline === null && rb.body.integra === null, 'GET /baseline → null antes da aprovação')

  const rg = await chamar(obterGate, pid, empresa_id)
  ok(rg.body.autoritativo === true, 'GET /gate declara-se AUTORITATIVO')
  ok(!rg.body.fases.engenharia.liberado && !rg.body.fases.homologacao.liberado, 'ambas as fases bloqueadas')
  ok(rg.body.fases.engenharia.motivo === 'SEM_BASELINE', 'motivo do bloqueio é SEM_BASELINE')

  const rf = await chamar(listarFases, pid, empresa_id)
  ok(rf.body.total === 2 && rf.body.fases.every((f) => f.paralela), 'GET /fases → 2 fases PARALELAS')
  ok(rf.body.fases.every((f) => f.concluida === null), '`concluida` é null — sem agregado que registre (não é `false`)')
  ok(rf.body.ambas_concluidas === null, '`ambas_concluidas` null — indeterminável, não presumido')

  // ═══ 2. Depois da aprovação ═══════════════════════════════════════════════
  secao('2 · Aprovação → Baseline → Gate liberado')

  await OrcamentoService.transicionar(orcs[0]._id, 'EMITIDO', { por: 'check' })
  const { baseline } = await OrcamentoService.aprovar(orcs[0]._id, { por: 'check' })
  await OrcamentoService.transicionar(orcs[1]._id, 'EMITIDO', { por: 'check' })
  await OrcamentoService.transicionar(orcs[1]._id, 'REJEITADO', { por: 'check', motivo: 'Cliente preferiu outro' })

  const ro2 = await chamar(listarOrcamentos, pid, empresa_id)
  ok(ro2.body.total === 3, 'histórico preservado: rejeitado continua na lista')
  ok(String(ro2.body.aprovado_ref) === String(orcs[0]._id), 'aprovado_ref aponta o orçamento correto')
  ok(ro2.body.orcamentos.find((o) => o.estado === 'REJEITADO')?.motivo_encerramento?.length > 0,
     'motivo do encerramento exposto')

  const rv2 = await chamar(obterOrcamentoVigente, pid, empresa_id)
  ok(rv2.body.orcamento?.estado === 'APROVADO', 'vigente passou a ser o APROVADO')

  const rb2 = await chamar(obterBaseline, pid, empresa_id)
  ok(String(rb2.body.baseline?._id) === String(baseline._id), 'GET /baseline devolve a baseline gerada')
  ok(rb2.body.integra === true, 'integridade VERIFICADA no servidor (o cliente não calcula hash)')
  ok(rb2.body.baseline.conteudo?.orcamento?.totais?.total_r === 25000, 'conteúdo congelado autocontido')

  const rg2 = await chamar(obterGate, pid, empresa_id)
  ok(rg2.body.fases.engenharia.liberado && rg2.body.fases.homologacao.liberado, 'Gate LIBEROU as duas fases')

  const rf2 = await chamar(listarFases, pid, empresa_id)
  ok(rf2.body.fases.every((f) => f.liberada), 'fases refletem a liberação')
  ok(rf2.body.fases.every((f) => f.concluida === null), 'conclusão segue indeterminável')

  // Baseline adulterada → integridade falha e o gate fecha.
  await Baseline.collection.updateOne({ _id: baseline._id }, { $set: { hash: 'adulterado' } })
  const rb3 = await chamar(obterBaseline, pid, empresa_id)
  ok(rb3.body.integra === false, 'baseline adulterada → integra: false')
  const rg3 = await chamar(obterGate, pid, empresa_id)
  ok(!rg3.body.fases.engenharia.liberado, 'gate FECHA com baseline adulterada')
  ok(rg3.body.fases.engenharia.motivo === 'BASELINE_CORROMPIDA', 'motivo específico é reportado')
  await Baseline.collection.updateOne({ _id: baseline._id }, { $set: { hash: baseline.hash } })

  // ═══ 3. M-4 e erros ═══════════════════════════════════════════════════════
  secao('3 · Isolamento organizacional e erros')

  for (const [nome, h] of [['cotacoes', listarCotacoes], ['orcamentos', listarOrcamentos],
                           ['vigente', obterOrcamentoVigente], ['baseline', obterBaseline],
                           ['gate', obterGate], ['fases', listarFases]]) {
    const r = await chamar(h, pid, outraEmpresa)
    ok(r.statusCode === 404, `M-4: /${nome} de outra organização → 404`)
  }
  const rInv = await chamar(listarCotacoes, 'nao-e-objectid', empresa_id)
  ok(rInv.statusCode === 400, 'ID inválido → 400')

  // ═══ 4. Compatibilidade: GET /:id inalterado ══════════════════════════════
  secao('4 · GET /api/projetos-fv/:id permanece inalterado')

  const rGet = await chamar(buscarProjetoFV, pid, empresa_id)
  for (const campo of ['orcamento', 'orcamento_vigente', 'local_resolvido', 'arranjos_normalizados', 'totais']) {
    ok(campo in rGet.body, `campo \`${campo}\` continua na resposta`)
  }
  ok(rGet.body.orcamento_vigente?.estado === 'APROVADO', 'nenhum consumidor legado quebrou')

  await mongoose.disconnect()
  await mongod.stop()

  console.log(falhas === 0
    ? '\nOK — API canônica alinhada ao domínio; GET /:id preservado'
    : `\n${falhas} FALHA(S)`)
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
