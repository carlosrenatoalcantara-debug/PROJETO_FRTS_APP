/**
 * fluxoComercialEscrita.check.js — FV-API-002
 *
 * Cobre os 14 casos obrigatórios da sprint, exercitando os handlers de escrita
 * como a UX os chama: Cotação → Orçamento → Emissão → Aprovação → Baseline → Gate.
 *
 *   node backend/src/controllers/__checks__/fluxoComercialEscrita.check.js
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

import { ProjetoFV } from '../../models/ProjetoFV.js'
import { Cotacao } from '../../models/Cotacao.js'
import { Orcamento } from '../../models/Orcamento.js'
import { Baseline } from '../../models/Baseline.js'
import { Cliente } from '../../models/Cliente.js'
import { Local } from '../../models/Local.js'
import {
  criarCotacao, obterCotacao, criarOrcamento, obterOrcamento, atualizarOrcamento,
  emitirOrcamento, aprovarOrcamento, rejeitarOrcamento, cancelarOrcamento,
} from '../agregadosFvController.js'
import { listarCotacoes, listarOrcamentos, obterOrcamentoVigente, obterBaseline, obterGate } from '../agregadosFvController.js'
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

/** Chama um handler como o Express chamaria. */
async function req(handler, { params = {}, body = {}, empresa_id }) {
  const res = fakeRes()
  await handler({ auth: { empresa_id, email: 'check@fv' }, params, body, headers: {}, socket: {} }, res)
  return res
}

async function main() {
  const mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await Promise.all([Cotacao.init(), Orcamento.init(), Baseline.init()])

  const empA = new mongoose.Types.ObjectId()
  const empB = new mongoose.Types.ObjectId()

  const projA = await ProjetoFV.create({ nome: 'Tenant A', clienteId: new mongoose.Types.ObjectId(), empresa_id: empA })
  const projB = await ProjetoFV.create({ nome: 'Tenant B', clienteId: new mongoose.Types.ObjectId(), empresa_id: empB })
  const idA = String(projA._id)

  const ITENS = [
    { descricao: 'Kit FV', tipo: 'material', quantidade: 1, valor_unitario_r: 20000 },
    { descricao: 'Mão de obra', tipo: 'servico', quantidade: 1, valor_unitario_r: 5000 },
  ]

  // ═══ 1 e 2 · Criar cotação · Criar múltiplas ══════════════════════════════
  secao('1-2 · Cotações')

  const cots = []
  for (const t of ['string', 'micro', 'bess']) {
    const r = await req(criarCotacao, {
      params: { id: idA }, empresa_id: empA,
      body: { tecnologia: t, rotulo: `Cenário ${t}`, premissas: { consumo_kwh_mes: 800 } },
    })
    if (r.statusCode === 201) cots.push(r.body.cotacao)
  }
  ok(cots.length === 3, `3 cotações criadas via API (201) — múltiplas por projeto`)
  ok(cots[0].criado_por === 'check@fv', 'proveniência (M-3) registrada a partir do req.auth')

  const rLista = await req(listarCotacoes, { params: { id: idA }, empresa_id: empA })
  ok(rLista.body.total === 3, 'listagem confirma as 3')

  const rCot = await req(obterCotacao, { params: { id: idA, cotacaoId: String(cots[0]._id) }, empresa_id: empA })
  ok(rCot.statusCode === 200 && String(rCot.body.cotacao._id) === String(cots[0]._id), 'consulta individual da cotação')

  // Nada foi para o subdocumento legado.
  const docA = await ProjetoFV.findById(idA).lean()
  ok(docA.orcamento == null, 'ProjetoFV.orcamento permanece NULL — nada persistido no legado')

  // ═══ 3 e 4 · Orçamentos vinculados · múltiplos ════════════════════════════
  secao('3-4 · Orçamentos')

  const orcs = []
  for (let i = 0; i < 3; i++) {
    const r = await req(criarOrcamento, {
      params: { id: idA }, empresa_id: empA,
      body: { cotacao_ref: cots[i]._id, numero: `ORC-00${i + 1}`, itens: ITENS, condicoes: { validade_dias: 30 } },
    })
    if (r.statusCode === 201) orcs.push(r.body.orcamento)
  }
  ok(orcs.length === 3, '3 orçamentos criados (201)')
  ok(orcs.every((o) => o.estado === 'RASCUNHO'), 'todos nascem em RASCUNHO')
  ok(String(orcs[0].cotacao_ref) === String(cots[0]._id), 'M-1: vinculado à cotação — a "seleção" se expressa aqui')

  // Cotação de OUTRO projeto é rejeitada pelo domínio.
  const rCotB = await req(criarCotacao, { params: { id: String(projB._id) }, empresa_id: empB, body: { tecnologia: 'string' } })
  const rCruz = await req(criarOrcamento, {
    params: { id: idA }, empresa_id: empA,
    body: { cotacao_ref: rCotB.body.cotacao._id, itens: ITENS },
  })
  ok(rCruz.statusCode === 400 && rCruz.body.codigo === 'ORCAMENTO_INVALIDO',
     'orçamento com cotação de outro projeto → 400 (regra do domínio)')

  // ═══ Edição enquanto permitido ════════════════════════════════════════════
  secao('Edição — permitida só em RASCUNHO')

  const rEdit = await req(atualizarOrcamento, {
    params: { id: idA, orcamentoId: String(orcs[0]._id) }, empresa_id: empA,
    body: { itens: [{ descricao: 'Kit revisado', tipo: 'material', quantidade: 1, valor_unitario_r: 21000 }] },
  })
  ok(rEdit.statusCode === 200 && rEdit.body.orcamento.itens.length === 1, 'edição em RASCUNHO → 200')

  // ═══ 5 · Emitir ══════════════════════════════════════════════════════════
  secao('5 · Emissão')

  const rEmitir = await req(emitirOrcamento, { params: { id: idA, orcamentoId: String(orcs[0]._id) }, empresa_id: empA })
  ok(rEmitir.statusCode === 200 && rEmitir.body.orcamento.estado === 'EMITIDO', 'emitir → EMITIDO')

  const rEditTravado = await req(atualizarOrcamento, {
    params: { id: idA, orcamentoId: String(orcs[0]._id) }, empresa_id: empA, body: { itens: [] },
  })
  ok(rEditTravado.statusCode === 409 && rEditTravado.body.codigo === 'ORCAMENTO_TRAVADO',
     'editar após EMITIDO → 409 ORCAMENTO_TRAVADO')

  // ═══ 9 · Gate FECHADO antes da aprovação ═════════════════════════════════
  secao('9 · Gate antes da aprovação')

  const rGate1 = await req(obterGate, { params: { id: idA }, empresa_id: empA })
  ok(!rGate1.body.fases.engenharia.liberado && !rGate1.body.fases.homologacao.liberado, 'Gate FECHADO')
  ok(rGate1.body.fases.engenharia.motivo === 'SEM_BASELINE', 'motivo SEM_BASELINE')

  // ═══ 6 e 7 · Aprovar somente um · Baseline ═══════════════════════════════
  secao('6-7 · Aprovação e Baseline')

  const rAprovar = await req(aprovarOrcamento, { params: { id: idA, orcamentoId: String(orcs[0]._id) }, empresa_id: empA })
  ok(rAprovar.statusCode === 200 && rAprovar.body.orcamento.estado === 'APROVADO', 'aprovar → APROVADO')
  ok(!!rAprovar.body.baseline?._id, 'Baseline gerada na mesma operação')
  ok(String(rAprovar.body.orcamento.baseline_ref) === String(rAprovar.body.baseline._id), 'orçamento aponta a Baseline')

  await req(emitirOrcamento, { params: { id: idA, orcamentoId: String(orcs[1]._id) }, empresa_id: empA })
  const rSegundo = await req(aprovarOrcamento, { params: { id: idA, orcamentoId: String(orcs[1]._id) }, empresa_id: empA })
  ok(rSegundo.statusCode === 409 && rSegundo.body.codigo === 'ORCAMENTO_APROVADO_EXISTENTE',
     'segundo aprovado → 409 (unicidade garantida pelo domínio)')
  ok(await Orcamento.countDocuments({ projeto_ref: projA._id, estado: 'APROVADO' }) === 1, 'exatamente 1 aprovado')

  // Transição inválida → 422 (não 500).
  const rInvalida = await req(emitirOrcamento, { params: { id: idA, orcamentoId: String(orcs[0]._id) }, empresa_id: empA })
  ok(rInvalida.statusCode === 422 && rInvalida.body.codigo === 'TRANSICAO_INVALIDA',
     'APROVADO → EMITIDO = 422 TRANSICAO_INVALIDA')

  // Rejeitar/cancelar preservam o histórico.
  await req(rejeitarOrcamento, { params: { id: idA, orcamentoId: String(orcs[1]._id) }, empresa_id: empA, body: { motivo: 'Cliente preferiu outro' } })
  await req(cancelarOrcamento, { params: { id: idA, orcamentoId: String(orcs[2]._id) }, empresa_id: empA, body: { motivo: 'Escopo mudou' } })
  const rTodos = await req(listarOrcamentos, { params: { id: idA }, empresa_id: empA })
  ok(rTodos.body.total === 3, 'os 3 orçamentos continuam existindo — nada apagado')

  const rVig = await req(obterOrcamentoVigente, { params: { id: idA }, empresa_id: empA })
  ok(rVig.body.orcamento?.estado === 'APROVADO', 'vigente = o aprovado (regra no OrcamentoService)')

  // ═══ 8 · Baseline imutável ═══════════════════════════════════════════════
  secao('8 · Baseline imutável')

  const blId = rAprovar.body.baseline._id
  let erroUpd = null
  try { await Baseline.updateOne({ _id: blId }, { $set: { hash: 'forjado' } }) } catch (e) { erroUpd = e }
  ok(erroUpd?.codigo === 'BASELINE_IMUTAVEL', 'updateOne na Baseline → BASELINE_IMUTAVEL')
  ok(!('criarBaseline' in await import('../agregadosFvController.js')),
     'NÃO existe endpoint de escrita de Baseline — nasce só da aprovação')

  // ═══ 10 · Gate ABERTO após aprovação ═════════════════════════════════════
  secao('10 · Gate após aprovação')

  const rGate2 = await req(obterGate, { params: { id: idA }, empresa_id: empA })
  ok(rGate2.body.fases.engenharia.liberado && rGate2.body.fases.homologacao.liberado, 'Gate ABERTO nas duas fases')

  const rBl = await req(obterBaseline, { params: { id: idA }, empresa_id: empA })
  ok(rBl.body.integra === true, 'Baseline íntegra (verificada no servidor)')

  // ═══ 11 · Baseline adulterada fecha o Gate ═══════════════════════════════
  secao('11 · Baseline adulterada')

  const hashBom = rBl.body.baseline.hash
  await Baseline.collection.updateOne({ _id: blId }, { $set: { hash: 'adulterado' } })
  const rGate3 = await req(obterGate, { params: { id: idA }, empresa_id: empA })
  ok(!rGate3.body.fases.engenharia.liberado, 'Gate FECHA com baseline adulterada')
  ok(rGate3.body.fases.engenharia.motivo === 'BASELINE_CORROMPIDA', 'motivo BASELINE_CORROMPIDA')
  await Baseline.collection.updateOne({ _id: blId }, { $set: { hash: hashBom } })

  // ═══ 12 · Isolamento entre tenants ═══════════════════════════════════════
  secao('12 · Tenant A × Tenant B')

  const escrita = [
    ['criarCotacao', criarCotacao, { id: idA }, { tecnologia: 'string' }],
    ['criarOrcamento', criarOrcamento, { id: idA }, { cotacao_ref: cots[0]._id, itens: ITENS }],
    ['obterCotacao', obterCotacao, { id: idA, cotacaoId: String(cots[0]._id) }, {}],
    ['obterOrcamento', obterOrcamento, { id: idA, orcamentoId: String(orcs[0]._id) }, {}],
    ['atualizarOrcamento', atualizarOrcamento, { id: idA, orcamentoId: String(orcs[0]._id) }, { itens: [] }],
    ['emitirOrcamento', emitirOrcamento, { id: idA, orcamentoId: String(orcs[0]._id) }, {}],
    ['aprovarOrcamento', aprovarOrcamento, { id: idA, orcamentoId: String(orcs[0]._id) }, {}],
    ['rejeitarOrcamento', rejeitarOrcamento, { id: idA, orcamentoId: String(orcs[0]._id) }, {}],
    ['cancelarOrcamento', cancelarOrcamento, { id: idA, orcamentoId: String(orcs[0]._id) }, {}],
  ]
  for (const [nome, h, params, body] of escrita) {
    const r = await req(h, { params, body, empresa_id: empB })
    ok(r.statusCode === 404, `B não acessa ${nome} de A → 404`)
  }
  ok(await Orcamento.countDocuments({ projeto_ref: projA._id }) === 3, 'nenhuma escrita de B vazou para A')

  // Recurso do PRÓPRIO tenant mas de OUTRO projeto também é barrado.
  const projA2 = await ProjetoFV.create({ nome: 'A — outro', clienteId: new mongoose.Types.ObjectId(), empresa_id: empA })
  const rOutroProj = await req(obterOrcamento, {
    params: { id: String(projA2._id), orcamentoId: String(orcs[0]._id) }, empresa_id: empA,
  })
  ok(rOutroProj.statusCode === 404, 'orçamento de outro projeto do MESMO tenant → 404')

  // ═══ 13 · Reexecução não duplica ═════════════════════════════════════════
  secao('13 · Reexecução')

  const antesCot = await Cotacao.countDocuments({ projeto_ref: projA._id })
  const antesOrc = await Orcamento.countDocuments({ projeto_ref: projA._id })
  await req(aprovarOrcamento, { params: { id: idA, orcamentoId: String(orcs[0]._id) }, empresa_id: empA })
  await req(rejeitarOrcamento, { params: { id: idA, orcamentoId: String(orcs[1]._id) }, empresa_id: empA })
  ok(await Cotacao.countDocuments({ projeto_ref: projA._id }) === antesCot, 'reaprovar não cria cotação')
  ok(await Orcamento.countDocuments({ projeto_ref: projA._id }) === antesOrc, 'reaprovar não cria orçamento')
  ok(await Baseline.countDocuments({ projeto_ref: projA._id }) === 1, 'continua exatamente 1 Baseline')

  // ═══ 14 · Erros de domínio → HTTP apropriado ═════════════════════════════
  secao('14 · Mapeamento de erros')

  const casos = [
    ['cotação sem tecnologia → 400', await req(criarCotacao, { params: { id: idA }, empresa_id: empA, body: {} }), 400],
    ['orçamento sem cotacao_ref → 400', await req(criarOrcamento, { params: { id: idA }, empresa_id: empA, body: { itens: ITENS } }), 400],
    ['projeto inexistente → 404', await req(criarCotacao, { params: { id: String(new mongoose.Types.ObjectId()) }, empresa_id: empA, body: { tecnologia: 'string' } }), 404],
    ['id malformado → 400', await req(criarCotacao, { params: { id: 'nao-e-id' }, empresa_id: empA, body: { tecnologia: 'string' } }), 400],
    ['orçamento inexistente → 404', await req(obterOrcamento, { params: { id: idA, orcamentoId: String(new mongoose.Types.ObjectId()) }, empresa_id: empA }), 404],
  ]
  for (const [nome, r, esperado] of casos) ok(r.statusCode === esperado, `${nome} (obtido ${r.statusCode})`)
  ok(casos.every(([, r]) => r.statusCode < 500), 'nenhum erro de domínio virou 500')

  // ═══ 15 · A UX chama exatamente as rotas registradas ═════════════════════
  secao('15 · Correspondência UX ↔ rotas do backend')

  const { readFileSync } = await import('node:fs')
  const path = (await import('node:path')).default
  const { fileURLToPath } = await import('node:url')
  const AQUI = path.dirname(fileURLToPath(import.meta.url))
  const rotasSrc = readFileSync(path.resolve(AQUI, '../../routes/projetosFV.js'), 'utf8')
  // Beneficiárias vivem em router próprio, montado em
  // `/api/projetos-fv/:id/beneficiarias` (server.js) — os caminhos declarados lá
  // são relativos a esse prefixo. FV-UX-015.
  const rotasBenefSrc = readFileSync(path.resolve(AQUI, '../../routes/beneficiarias.js'), 'utf8')
  // Homologação idem, montada em `/api/projetos-fv/:projetoId/homologacao`
  // (server.js). FV-UX-034 — antes desta sprint nenhuma rota dela era chamada
  // pela UX, e por isso este router nunca havia sido lido aqui.
  const rotasHomologSrc = readFileSync(path.resolve(AQUI, '../../routes/homologacao.js'), 'utf8')
  // O PDF da proposta vive em router próprio, montado em
  // `/api/projetos-fv/:projetoId/proposta` (server.js). FV-UX-036 — antes desta
  // sprint a UX nova não chamava nenhuma rota dele, e por isso ele nunca havia
  // sido lido aqui. Mesma lacuna que a homologação tinha na FV-UX-034.
  const rotasPropostaSrc = readFileSync(path.resolve(AQUI, '../../routes/proposta.js'), 'utf8')
  const apiSrc = readFileSync(path.resolve(AQUI, '../../../../frontend/src/fv/api/agregadosFvApi.js'), 'utf8')

  // Caminhos que o cliente do frontend monta, normalizados para o padrão do router.
  const doCliente = [...apiSrc.matchAll(/\$\{base\(projetoId\)\}([^`']*)/g)]
    .map((m) => '/:id' + m[1]
      .replace(/\$\{orcamentoId\}/g, ':orcamentoId')
      .replace(/\$\{cotacaoId\}/g, ':cotacaoId')
      .replace(/\$\{beneficiariaId\}/g, ':beneficiariaId')
      .replace(/\$\{nome\}/g, ''))
  // `gerarDocumentoHomologacao(id, tipo)` monta `/homologacao/${tipo}`; os três
  // tipos concretos são acrescentados abaixo, mesmo tratamento dado a `acao`.
  for (const t of ['memorial', 'carta', 'art']) {
    doCliente.push(`/:id/homologacao/${t}`)
  }
  // As ações compostas (`acao('emitir')`) não aparecem literalmente — acrescenta.
  for (const n of ['emitir', 'aprovar', 'rejeitar', 'cancelar']) {
    doCliente.push(`/:id/orcamentos/:orcamentoId/${n}`)
  }

  const registradas = new Set([
    ...[...rotasSrc.matchAll(/router\.(get|post|put|patch|delete)\('([^']+)'/g)].map((m) => m[2]),
    ...[...rotasHomologSrc.matchAll(/router\.(get|post|put|patch|delete)\('([^']+)'/g)]
      .map((m) => `/:id/homologacao${m[2] === '/' ? '' : m[2]}`),
    ...[...rotasPropostaSrc.matchAll(/router\.(get|post|put|patch|delete)\('([^']+)'/g)]
      .map((m) => `/:id/proposta${m[2] === '/' ? '' : m[2]}`),
    // Reprefixadas para o caminho absoluto que o cliente monta.
    ...[...rotasBenefSrc.matchAll(/router\.(get|post|put|patch|delete)\('([^']+)'/g)]
      .map((m) => `/:id/beneficiarias${m[2] === '/' ? '' : m[2]}`),
  ])
  // Descarta o template genérico de `acao(nome)` — as 4 ações concretas que ele
  // produz já foram acrescentadas acima.
  const orfas = [...new Set(doCliente)]
    .filter((c) => c && !c.endsWith('/'))
    .filter((c) => !c.includes('${'))
    .filter((c) => !registradas.has(c))
  ok(orfas.length === 0, `todo caminho chamado pela UX existe no router (${orfas.join(', ') || 'nenhum órfão'})`)

  // ═══ 16 · A UX opera o fluxo (FV-UX-012) ══════════════════════════════════
  secao('16 · UX integrada às operações de escrita')

  const FV = path.resolve(AQUI, '../../../../frontend/src/fv')
  const ler = (rel) => readFileSync(path.resolve(FV, rel), 'utf8')
  const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

  // As 7 operações de escrita da FV-API-002 estão no cliente.
  const OPS = ['criarCotacao', 'criarOrcamento', 'atualizarOrcamento',
               'emitirOrcamento', 'aprovarOrcamento', 'rejeitarOrcamento', 'cancelarOrcamento']
  const faltando = OPS.filter((o) => !apiSrc.includes(`export function ${o}`) && !apiSrc.includes(`export const ${o}`))
  ok(faltando.length === 0, `cliente cobre as ${OPS.length} operações de escrita (${faltando.join(', ') || 'nenhuma faltando'})`)

  // Os providers expõem as mutações; as telas as disparam.
  ok(/acoes:\s*\{\s*criar\s*\}/.test(ler('providers/CotacoesProvider.jsx')),
     'CotacoesProvider expõe a mutação de criação')
  const provOrc = ler('providers/OrcamentosProvider.jsx')
  ok(['criar', 'editar', 'emitir', 'aprovar', 'rejeitar', 'cancelar'].every((a) => provOrc.includes(`${a}:`)),
     'OrcamentosProvider expõe as 6 mutações de orçamento')

  const telasComAcao = ['componentes/FormNovaCotacao.jsx', 'componentes/FormNovoOrcamento.jsx',
                        'componentes/CartaoOrcamento.jsx', 'paginas/etapas/EtapaAprovacao.jsx']
  const semAcao = telasComAcao.filter((t) => !/acoes\.(criar|editar|emitir|aprovar|rejeitar|cancelar)\(/.test(ler(t)))
  ok(semAcao.length === 0, `${telasComAcao.length} telas disparam escrita (${semAcao.join(', ') || 'todas'})`)

  // NENHUMA regra de domínio foi copiada para o cliente.
  const ARQUIVOS_UX = [...telasComAcao, 'providers/CotacoesProvider.jsx', 'providers/OrcamentosProvider.jsx',
                       'providers/ContratoProvider.jsx', 'paginas/etapas/EtapaCotacao.jsx',
                       'paginas/etapas/EtapaOrcamentos.jsx', 'api/agregadosFvApi.js']
  const vazou = ARQUIVOS_UX.filter((a) =>
    /TRANSICOES_ORCAMENTO|validarTransicaoOrcamento|avaliarCongelamento|conteudoTravado|ORCAMENTO_CONTEUDO_TRAVADO/
      .test(semComentarios(ler(a))))
  ok(vazou.length === 0, `nenhuma regra de domínio copiada para o cliente (${vazou.join(', ') || 'nenhuma'})`)

  // INV-58: os formulários não enviam totais — o servidor os deriva dos itens.
  const formOrc = semComentarios(ler('componentes/FormNovoOrcamento.jsx'))
  ok(!/total_venda_r|total_material_r|total_servicos_r/.test(formOrc),
     'formulário de orçamento NÃO envia totais (INV-58 — derivados no servidor)')

  // A criação de orçamento exige cotação de origem (M-1).
  ok(/cotacao_ref/.test(formOrc), 'formulário de orçamento envia `cotacao_ref` — a escolha da cotação (M-1)')

  // `vigente` precisa vir ANTES de `:orcamentoId`, senão vira um id.
  const iVig = rotasSrc.indexOf("'/:id/orcamentos/vigente'")
  const iVar = rotasSrc.indexOf("'/:id/orcamentos/:orcamentoId'")
  ok(iVig > -1 && iVar > -1 && iVig < iVar, 'ordem correta: /orcamentos/vigente declarada antes de /orcamentos/:orcamentoId')

  await mongoose.disconnect()
  await mongod.stop()

  console.log(falhas === 0
    ? '\nOK — fluxo comercial operável pela API: Cotação → Orçamento → Aprovação → Baseline → Gate'
    : `\n${falhas} FALHA(S)`)
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
