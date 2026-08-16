/**
 * convergenciaOrcamento.check.js — FV-DOM-002
 *
 * Comprova que o domínio comercial passou a operar sobre Cotacao/Orcamento/
 * Baseline, e que `ProjetoFV.orcamento` sobrou apenas como compatibilidade.
 *
 *   node backend/src/dominio/__checks__/convergenciaOrcamento.check.js
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

import { ProjetoFV } from '../../models/ProjetoFV.js'
import { Cotacao } from '../../models/Cotacao.js'
import { Orcamento } from '../../models/Orcamento.js'
import { Baseline } from '../../models/Baseline.js'
import { Cliente } from '../../models/Cliente.js'
import { Local } from '../../models/Local.js'   // buscarProjetoFV faz populate('local_ref')
import { OrcamentoService } from '../../services/OrcamentoService.js'
import { salvarEtapaProjetoFV, buscarProjetoFV } from '../../controllers/projetosFVController.js'
import { converterEtapaOrcamento, itensDoKit, cotacaoDoProjeto } from '../orcamento/converterEtapaOrcamento.js'
import { obterOrcamentoProjeto, totaisDeItens, projetarFormaLegada } from '../orcamento/obterOrcamentoProjeto.js'
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

  const projeto = await ProjetoFV.create({
    nome: 'FV-DOM-002', clienteId: new mongoose.Types.ObjectId(), empresa_id,
    consumo_kwh_mes: 800, valor_kwh: 0.92,
  })
  const pid = String(projeto._id)

  const PAYLOAD_KIT = {
    modo: 'kit',
    kit: { fornecedor: 'Aldo', valor_kit_r: 18000, frete_r: 1200, projeto_r: 900, mao_obra_r: 4000, observacoes: 'Entrega 15d' },
    itens_adicionais: [{ descricao: 'Estrutura extra', tipo: 'material', quantidade: 2, valor: 350 }],
    total_venda_r: 24450,
    preco_venda_r: 24450, irr_pct: 22.4, payback_anos: 4.1, npv_r: 31000,
  }

  // ═══ 1. Tradução pura ═════════════════════════════════════════════════════
  secao('1 · Tradutor legado → agregado')

  const conv = converterEtapaOrcamento(PAYLOAD_KIT)
  ok(conv.itens.length === 5, `kit + adicionais → ${conv.itens.length} itens tipados`)
  ok(conv.itens.filter((i) => i.tipo === 'servico').length === 2, 'projeto e mão de obra classificados como serviço')
  const t = totaisDeItens(conv.itens)
  ok(t.total_venda_r === 24800, `totais DERIVADOS dos itens (R$ ${t.total_venda_r}) — não copiados do payload`)
  ok(!('total_venda_r' in conv), 'tradutor NÃO copia totais do payload (INV-58)')
  ok(!('irr_pct' in conv) && !('payback_anos' in conv), 'tradutor NÃO copia indicadores financeiros')
  ok(itensDoKit({ valor_kit_r: 0, frete_r: null }).length === 0, 'linhas de kit zeradas/nulas são descartadas')
  ok(converterEtapaOrcamento({}).itens.length === 0, 'payload vazio não quebra')
  ok(converterEtapaOrcamento({ modo: 'detalhado', itens_adicionais: [{ descricao: 'X', valor: 'abc' }] }).itens.length === 0,
     'valor não numérico é descartado — nunca vira NaN')
  ok(cotacaoDoProjeto(projeto.toObject()).premissas.consumo_kwh_mes === 800, 'cotação sintetizada herda as premissas do projeto')

  // ═══ 2. Escrita — a etapa grava nos agregados ═════════════════════════════
  secao('2 · Escrita: PUT /:id/etapa → agregados novos')

  const r1 = fakeRes()
  await salvarEtapaProjetoFV(req(pid, { etapa: 'orcamento', dados: PAYLOAD_KIT }), r1)
  ok(r1.statusCode === 200, 'etapa orcamento salva (200)')
  ok(r1.body?.orcamento_agregado?.acao === 'criado', 'resposta informa que o AGREGADO foi criado')

  const cots = await Cotacao.find({ projeto_ref: projeto._id })
  const orcs = await Orcamento.find({ projeto_ref: projeto._id })
  ok(cots.length === 1, 'Cotação sintetizada automaticamente (o wizard não cria uma)')
  ok(orcs.length === 1, 'Orçamento criado no agregado')
  ok(String(orcs[0].cotacao_ref) === String(cots[0]._id), 'M-1: Orçamento aponta para a Cotação de origem')
  ok(orcs[0].itens.length === 5 && orcs[0].estado === 'RASCUNHO', 'itens traduzidos e estado inicial correto')
  ok(orcs[0].empresa_id && String(orcs[0].empresa_id) === String(empresa_id), 'M-4: agregado carimbado com a organização')

  // Idempotência: salvar de novo ATUALIZA, não duplica.
  const r2 = fakeRes()
  await salvarEtapaProjetoFV(req(pid, { etapa: 'orcamento', dados: { ...PAYLOAD_KIT, kit: { ...PAYLOAD_KIT.kit, valor_kit_r: 19000 } } }), r2)
  ok(r2.body?.orcamento_agregado?.acao === 'atualizado', 'reenviar a etapa ATUALIZA o orçamento em elaboração')
  ok(await Orcamento.countDocuments({ projeto_ref: projeto._id }) === 1, 'salvar não emite: continua 1 orçamento')
  ok(await Cotacao.countDocuments({ projeto_ref: projeto._id }) === 1, 'a Cotação é reaproveitada, não duplicada')

  // ═══ 3. Leitura — GET devolve o agregado na forma legada ══════════════════
  secao('3 · Leitura: GET /:id projeta o agregado na forma legada')

  const r3 = fakeRes()
  await buscarProjetoFV(req(pid, {}), r3)
  const orcLido = r3.body?.orcamento
  ok(r3.statusCode === 200 && !!orcLido, 'GET devolve `orcamento` — forma da UX preservada')
  ok(orcLido.origem === 'agregado', 'proveniência (M-3): veio do agregado, não do subdoc')
  ok(orcLido.total_venda_r === 25800, `totais recalculados do agregado (R$ ${orcLido.total_venda_r})`)
  ok(Array.isArray(orcLido.itens_adicionais) && orcLido.itens_adicionais.length === 5, 'itens projetados na forma legada')
  // FV-DOM-003: o subdocumento deixou de ser gravado, então não há mais de onde
  // repassar indicadores. Eles passaram a viver em `financeiro.*` do projeto.
  ok(orcLido.irr_pct === undefined,
     'sem subdoc gravado, o adapter não tem indicadores para repassar (FV-DOM-003)')
  const docFin = await ProjetoFV.findById(pid).lean()
  ok(docFin.financeiro?.irr_pct === 22.4 && docFin.financeiro?.payback_anos === 4.1,
     'indicadores financeiros vivem em `financeiro.*` — o agregado não os persiste (INV-58)')

  // ═══ 4. Projeto histórico — sem agregado, lê o legado ═════════════════════
  secao('4 · Projeto histórico continua legível (compatibilidade)')

  const antigo = await ProjetoFV.create({
    nome: 'Histórico', clienteId: new mongoose.Types.ObjectId(), empresa_id,
    orcamento: { modo: 'kit', total_venda_r: 15000, preco_venda_r: 15000 },
  })
  const r4 = fakeRes()
  await buscarProjetoFV(req(String(antigo._id), {}), r4)
  ok(r4.body?.orcamento?.total_venda_r === 15000, 'projeto sem agregado devolve o subdoc legado intacto')
  ok(r4.body?.orcamento?.origem === undefined, 'sem marca de agregado — sinaliza que ainda é legado')
  ok(obterOrcamentoProjeto({ orcamento: null }, null) === null, 'projeto sem nenhum orçamento devolve null')

  // ═══ 5. Fluxo comercial completo sobre os agregados ═══════════════════════
  secao('5 · Emissão → aprovação → Baseline, tudo no domínio novo')

  const orc = await Orcamento.findOne({ projeto_ref: projeto._id })
  await OrcamentoService.transicionar(orc._id, 'EMITIDO', { por: 'check' })
  const { baseline } = await OrcamentoService.aprovar(orc._id, { por: 'check' })
  ok(!!baseline?._id, 'aprovação gerou Baseline a partir do agregado')
  ok(baseline.conteudo.orcamento.totais.total_venda_r === undefined
     || baseline.conteudo.orcamento.totais.total_r === 25800, `Baseline congelou o total (R$ ${baseline.conteudo.orcamento.totais.total_r})`)

  // Com o vigente TRAVADO (aprovado), salvar a etapa cria um NOVO orçamento —
  // nunca sobrescreve o aprovado (INV-ORC-2).
  const itensAprovadosAntes = JSON.stringify((await Orcamento.findById(orc._id).lean()).itens)
  const r5 = fakeRes()
  await salvarEtapaProjetoFV(req(pid, { etapa: 'orcamento', dados: { ...PAYLOAD_KIT, kit: { ...PAYLOAD_KIT.kit, valor_kit_r: 30000 } } }), r5)
  // FV-DOM-002A: com o contrato fechado (aprovado + baseline), o guard bloqueia
  // a etapa. Antes desta sprint ele não enxergava o agregado e deixava passar —
  // era o achado A-2. Reabrir exige revisão, não sobrescrita.
  ok(r5.statusCode === 409 && r5.body?.codigo === 'PROJETO_CONGELADO',
     'contrato fechado → etapa BLOQUEADA (409), não mais silenciosamente aceita')
  ok(r5.body?.motivo === 'CONTRATO', 'bloqueio veio do contrato (orçamento aprovado + baseline)')
  ok(await Orcamento.countDocuments({ projeto_ref: projeto._id }) === 1, 'nenhum orçamento novo foi criado — o projeto está congelado')
  ok(await Orcamento.countDocuments({ projeto_ref: projeto._id, estado: 'APROVADO' }) === 1,
     'o aprovado permanece único')
  ok(JSON.stringify((await Orcamento.findById(orc._id).lean()).itens) === itensAprovadosAntes,
     'os itens do orçamento aprovado ficaram INTACTOS')
  const blDepois = await Baseline.findById(baseline._id).lean()
  ok(blDepois.hash === baseline.hash, 'a Baseline não foi afetada pela nova gravação')

  // ═══ 6. Estado do legado ═════════════════════════════════════════════════
  secao('6 · Subdocumento legado: compatibilidade, sem papel operacional')

  const doc = await ProjetoFV.findById(pid).lean()
  ok(doc.orcamento == null, 'FV-DOM-003: subdoc NÃO é mais gravado — a ponte de escrita foi removida')
  ok(ProjetoFV.schema.paths.orcamento != null, 'campo NÃO foi removido do schema, como exigido pela sprint')

  // A leitura NÃO depende do subdoc: zerá-lo não muda a resposta.
  await ProjetoFV.updateOne({ _id: pid }, { $set: { orcamento: null } })
  const r6 = fakeRes()
  await buscarProjetoFV(req(pid, {}), r6)
  ok(r6.body?.orcamento?.total_venda_r === 25800,
     'apagar o subdoc NÃO afeta a leitura — a dependência funcional foi eliminada')
  ok(r6.body?.orcamento?.origem === 'agregado', 'resposta continua vindo do agregado')

  // Projeção pura, sem depender de banco.
  ok(projetarFormaLegada(null) === null, 'projeção de agregado ausente é null')

  await mongoose.disconnect()
  await mongod.stop()

  console.log(falhas === 0
    ? '\nOK — domínio comercial opera sobre Cotacao/Orcamento/Baseline; legado é só compatibilidade'
    : `\n${falhas} FALHA(S)`)
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
