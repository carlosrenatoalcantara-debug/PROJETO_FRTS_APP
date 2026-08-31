/**
 * fluxoCanonico.check.js — FV-DOM-001 (Fase 1 do fluxo canônico)
 *
 * Comprova o domínio exigido pela sprint:
 *
 *   Projeto FV → N Cotações → N Orçamentos → 1 Aprovado → 1 Baseline → Gate
 *
 * Serviços chamados direto sobre MongoDB em memória. Sem HTTP, sem UX.
 *
 *   node backend/src/dominio/__checks__/fluxoCanonico.check.js
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

import { ProjetoFV } from '../../models/ProjetoFV.js'
import { Equipamento } from '../../models/Equipamento.js'
import { Cotacao } from '../../models/Cotacao.js'
import { Orcamento } from '../../models/Orcamento.js'
import { Baseline } from '../../models/Baseline.js'
import { Cliente } from '../../models/Cliente.js'
import { CotacaoService } from '../../services/CotacaoService.js'
import { OrcamentoService, ErroDominioOrcamento } from '../../services/OrcamentoService.js'
import { BaselineService } from '../../services/BaselineService.js'
import { avaliarGate, exigirBaseline, ErroGate, MOTIVOS_GATE } from '../gate/index.js'
import { calcularTotais, calcularHash, montarConteudoBaseline } from '../baseline/congelarOrcamento.js'
import { TENANCY } from '../tenancy/index.js'
void Cliente

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

/** Executa e devolve o erro lançado (ou null). */
async function capturar(fn) {
  try { await fn(); return null } catch (e) { return e }
}

async function main() {
  const mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await Promise.all([Cotacao.init(), Orcamento.init(), Baseline.init()])   // garante os índices únicos

  const empresa_id = new mongoose.Types.ObjectId()
  const outraEmpresa = new mongoose.Types.ObjectId()

  const projeto = await ProjetoFV.create({ nome: 'FV-DOM-001', clienteId: new mongoose.Types.ObjectId(), empresa_id })
  const projeto2 = await ProjetoFV.create({ nome: 'Outro', clienteId: new mongoose.Types.ObjectId(), empresa_id })
  const modulo = await Equipamento.create({ tipo: 'modulo', fabricante: 'DAH', modelo: 'DHN-550' })
  const inversor = await Equipamento.create({ tipo: 'inversor', fabricante: 'Deye', modelo: 'SUN-5K' })

  const pid = projeto._id

  // ═══ 1. Cotação — N por projeto, nunca é venda ═════════════════════════════
  secao('1 · Cotação — simulação técnica, N por projeto')

  const tecnologias = ['string', 'micro', 'hibrido', 'bess']
  const cotacoes = []
  for (const t of tecnologias) {
    const c = await CotacaoService.criar({
      empresa_id, projeto_ref: pid, tecnologia: t, rotulo: `Cenário ${t}`,
      premissas: { consumo_kwh_mes: 800, tarifa_kwh: 0.92, hsp_kwh_m2_dia: 5.2 },
      composicao: [
        { equipamento_ref: modulo._id, quantidade: 12, papel: 'modulo' },
        { equipamento_ref: inversor._id, quantidade: 1, papel: 'inversor' },
      ],
      criado_por: 'check',
    })
    cotacoes.push(c)
  }
  ok(cotacoes.length === 4, `4 cotações criadas no mesmo projeto (${tecnologias.join(', ')})`)
  const totalCot = await Cotacao.countDocuments({ projeto_ref: pid })
  ok(totalCot === 4, `MÚLTIPLAS COTAÇÕES POR PROJETO: ${totalCot} coexistem, nenhuma substituída`)

  // A impossibilidade de gerar engenharia/homologação é estrutural.
  const camposCotacao = Object.keys(Cotacao.schema.paths)
  const vazamento = camposCotacao.filter((k) => /engenharia|homologacao|parecer|art|executivo/i.test(k))
  ok(vazamento.length === 0, `Cotação não tem NENHUM campo de engenharia/homologação (${camposCotacao.length} campos auditados)`)
  const camposVenda = camposCotacao.filter((k) => /valor|preco|desconto|margem|aprovad|contrato/i.test(k))
  ok(camposVenda.length === 0, 'Cotação não tem NENHUM campo comercial — não representa venda')

  // M-4: projeto de outra organização é rejeitado.
  const errOrg = await capturar(() => CotacaoService.criar({
    empresa_id: outraEmpresa, projeto_ref: pid, tecnologia: 'string',
  }))
  ok(errOrg?.codigo === 'COTACAO_INVALIDA', 'M-4: cotação em projeto de outra organização é rejeitada')

  // ═══ 2. Orçamento — N por projeto, histórico preservado ════════════════════
  secao('2 · Orçamento — N por projeto, nunca sobrescrito')

  const orcs = []
  for (let i = 0; i < 3; i++) {
    const o = await OrcamentoService.criar({
      empresa_id, projeto_ref: pid, cotacao_ref: cotacoes[i]._id,
      numero: `ORC-00${i + 1}`, criado_por: 'check',
      itens: [
        { descricao: 'Kit FV', tipo: 'material', quantidade: 1, valor_unitario_r: 20000 + i * 1000 },
        { descricao: 'Mão de obra', tipo: 'servico', quantidade: 1, valor_unitario_r: 5000 },
      ],
      condicoes: { validade_dias: 30 },
    })
    orcs.push(o)
  }
  ok(orcs.length === 3, '3 orçamentos criados no mesmo projeto')
  ok(orcs.every((o) => o.estado === 'RASCUNHO'), 'todos nascem em RASCUNHO')
  const totalOrc = await Orcamento.countDocuments({ projeto_ref: pid })
  ok(totalOrc === 3, `MÚLTIPLOS ORÇAMENTOS POR PROJETO: ${totalOrc} coexistem`)

  // Estados mínimos exigidos pela sprint.
  const enumOrc = Orcamento.schema.path('estado').enumValues
  ok(['RASCUNHO', 'EMITIDO', 'APROVADO', 'REJEITADO', 'CANCELADO'].every((e) => enumOrc.includes(e)),
     `estados mínimos presentes: ${enumOrc.join(', ')}`)

  // Cotação de outro projeto não pode originar orçamento.
  const cotOutro = await CotacaoService.criar({ empresa_id, projeto_ref: projeto2._id, tecnologia: 'string' })
  const errCruz = await capturar(() => OrcamentoService.criar({
    empresa_id, projeto_ref: pid, cotacao_ref: cotOutro._id, itens: [],
  }))
  ok(errCruz?.codigo === 'ORCAMENTO_INVALIDO', 'orçamento não pode derivar de cotação de OUTRO projeto')

  // Conteúdo editável em RASCUNHO; travado a partir de EMITIDO.
  await OrcamentoService.atualizarConteudo(orcs[0]._id, { itens: [{ descricao: 'Kit revisado', tipo: 'material', quantidade: 1, valor_unitario_r: 21000 }] })
  const o0 = await Orcamento.findById(orcs[0]._id).lean()
  ok(o0.itens[0].descricao === 'Kit revisado', 'conteúdo editável em RASCUNHO')

  await OrcamentoService.transicionar(orcs[0]._id, 'EMITIDO', { por: 'check' })
  const errTravado = await capturar(() => OrcamentoService.atualizarConteudo(orcs[0]._id, { itens: [] }))
  ok(errTravado?.codigo === 'ORCAMENTO_TRAVADO', 'conteúdo TRAVADO a partir de EMITIDO — histórico não é sobrescrito')

  const errTrans = await capturar(() => OrcamentoService.transicionar(orcs[1]._id, 'APROVADO', { por: 'check' }))
  ok(errTrans?.codigo === 'TRANSICAO_INVALIDA', 'RASCUNHO → APROVADO bloqueado (precisa passar por EMITIDO)')

  // ═══ 3. Gate ANTES da aprovação ═══════════════════════════════════════════
  secao('3 · Gate — bloqueado enquanto não há Baseline')

  const gEng = await BaselineService.avaliarGate('engenharia', { projeto_ref: pid, empresa_id })
  const gHom = await BaselineService.avaliarGate('homologacao', { projeto_ref: pid, empresa_id })
  ok(!gEng.liberado && gEng.motivo === MOTIVOS_GATE.SEM_BASELINE, 'ENGENHARIA BLOQUEADA sem Baseline')
  ok(!gHom.liberado && gHom.motivo === MOTIVOS_GATE.SEM_BASELINE, 'HOMOLOGAÇÃO BLOQUEADA sem Baseline')

  const errGate = await capturar(() => BaselineService.exigirGate('engenharia', { projeto_ref: pid, empresa_id }))
  ok(errGate instanceof ErroGate && errGate.status === 409, 'exigirGate lança ErroGate (409) — regra de domínio, não de interface')

  // ═══ 4. Aprovação — congela e gera Baseline ═══════════════════════════════
  secao('4 · Aprovação — congela o orçamento e origina a Baseline')

  const { orcamento: aprovado, baseline } = await OrcamentoService.aprovar(orcs[0]._id, { por: 'check' })
  ok(aprovado.estado === 'APROVADO', 'orçamento passou a APROVADO')
  ok(!!baseline?._id, 'Baseline criada na aprovação')
  ok(String(aprovado.baseline_ref) === String(baseline._id), 'orçamento aponta para a Baseline gerada')
  ok(aprovado.historico.length >= 2, `histórico preservado com ${aprovado.historico.length} eventos`)

  // ═══ 5. Apenas UM orçamento aprovado ══════════════════════════════════════
  secao('5 · Apenas um orçamento aprovado por projeto (INV-ORC-3)')

  await OrcamentoService.transicionar(orcs[1]._id, 'EMITIDO', { por: 'check' })
  const errDuplo = await capturar(() => OrcamentoService.aprovar(orcs[1]._id, { por: 'check' }))
  ok(errDuplo?.codigo === 'ORCAMENTO_APROVADO_EXISTENTE', 'segundo orçamento NÃO pode ser aprovado — erro de domínio')

  const qtdAprovados = await Orcamento.countDocuments({ projeto_ref: pid, estado: 'APROVADO' })
  ok(qtdAprovados === 1, `APENAS 1 ORÇAMENTO APROVADO (encontrados: ${qtdAprovados})`)

  // Garantia de última instância: o índice parcial único barra a escrita crua.
  const errIdx = await capturar(() => Orcamento.collection.insertOne({
    projeto_ref: pid, cotacao_ref: cotacoes[2]._id, estado: 'APROVADO', empresa_id,
  }))
  ok(errIdx?.code === 11000, 'índice parcial único barra um segundo APROVADO mesmo por escrita direta')

  // O rejeitado/cancelado convivem sem conflito.
  await OrcamentoService.transicionar(orcs[1]._id, 'REJEITADO', { por: 'check', motivo: 'Cliente preferiu outro cenário' })
  await OrcamentoService.transicionar(orcs[2]._id, 'CANCELADO', { por: 'check', motivo: 'Escopo mudou' })
  const convivem = await Orcamento.countDocuments({ projeto_ref: pid })
  ok(convivem === 3, `os 3 orçamentos continuam existindo (1 aprovado, 1 rejeitado, 1 cancelado) — nada foi apagado`)

  // ═══ 6. Baseline imutável ═════════════════════════════════════════════════
  secao('6 · Baseline imutável e autocontida (M-2)')

  const bl = await Baseline.findById(baseline._id).lean()
  ok(bl.hash === calcularHash(bl.conteudo), 'hash confere com o conteúdo congelado')
  ok(BaselineService.verificarIntegridade(bl), 'verificação de integridade passa')

  // Autocontida: os totais estão congelados, não recalculados por referência.
  const esperado = calcularTotais([{ descricao: 'Kit revisado', tipo: 'material', quantidade: 1, valor_unitario_r: 21000 }])
  ok(bl.conteudo.orcamento.totais.total_r === esperado.total_r,
     `totais congelados no snapshot (R$ ${bl.conteudo.orcamento.totais.total_r})`)
  ok(bl.conteudo.cotacao.tecnologia === 'string' && Array.isArray(bl.conteudo.cotacao.composicao),
     'cotação copiada integralmente para dentro da Baseline')

  // Alterar a origem NÃO altera a Baseline — prova de que não há leitura dinâmica.
  await Cotacao.updateOne({ _id: cotacoes[0]._id }, { $set: { tecnologia: 'micro', rotulo: 'ALTERADO' } })
  const blDepois = await Baseline.findById(baseline._id).lean()
  ok(blDepois.conteudo.cotacao.tecnologia === 'string',
     'alterar a Cotação de origem NÃO muda a Baseline — nenhum dado depende de leitura dinâmica')
  ok(blDepois.hash === bl.hash, 'hash inalterado após mutação da origem')

  // Todas as vias de atualização são negadas.
  const errUpd = await capturar(() => Baseline.updateOne({ _id: baseline._id }, { $set: { hash: 'forjado' } }))
  ok(errUpd?.codigo === 'BASELINE_IMUTAVEL', 'updateOne na Baseline → erro BASELINE_IMUTAVEL')
  const errFou = await capturar(() => Baseline.findOneAndUpdate({ _id: baseline._id }, { $set: { hash: 'x' } }))
  ok(errFou?.codigo === 'BASELINE_IMUTAVEL', 'findOneAndUpdate na Baseline → erro BASELINE_IMUTAVEL')

  // save() sobre documento já persistido: campos immutable são descartados.
  const docBl = await Baseline.findById(baseline._id)
  docBl.hash = 'tentativa'
  docBl.congelado_por = 'invasor'
  await docBl.save()
  const blFinal = await Baseline.findById(baseline._id).lean()
  ok(blFinal.hash === bl.hash && blFinal.congelado_por === 'check', 'save() não altera campos immutable da Baseline')

  const errDel = await capturar(() => Baseline.deleteOne({ _id: baseline._id }))
  ok(errDel?.codigo === 'BASELINE_IMUTAVEL', 'deleteOne na Baseline → erro BASELINE_IMUTAVEL')

  ok(typeof BaselineService.criar === 'undefined', 'BaselineService NÃO expõe criação avulsa (só nasce da aprovação)')

  // ═══ 7. Gate DEPOIS da aprovação ══════════════════════════════════════════
  secao('7 · Gate — liberado com Baseline válida')

  const gEng2 = await BaselineService.avaliarGate('engenharia', { projeto_ref: pid, empresa_id })
  const gHom2 = await BaselineService.avaliarGate('homologacao', { projeto_ref: pid, empresa_id })
  ok(gEng2.liberado, 'ENGENHARIA LIBERADA com Baseline')
  ok(gHom2.liberado, 'HOMOLOGAÇÃO LIBERADA com Baseline')
  ok(await BaselineService.exigirGate('engenharia', { projeto_ref: pid, empresa_id }) !== null, 'exigirGate devolve a Baseline')

  // Baseline adulterada não abre o gate.
  const corrompida = { ...bl, conteudo: { ...bl.conteudo, orcamento: { ...bl.conteudo.orcamento, totais: { total_r: 999999 } } } }
  const gCorr = avaliarGate({ fase: 'engenharia', baseline: corrompida })
  ok(!gCorr.liberado && gCorr.motivo === MOTIVOS_GATE.BASELINE_CORROMPIDA, 'Baseline adulterada NÃO abre o gate')

  // M-4: outra organização não enxerga a Baseline — gate fechado.
  const gOutra = await BaselineService.avaliarGate('engenharia', { projeto_ref: pid, empresa_id: outraEmpresa })
  ok(!gOutra.liberado, 'M-4: outra organização não destrava o gate deste projeto')

  // Projeto sem orçamento aprovado continua bloqueado.
  const gP2 = await BaselineService.avaliarGate('engenharia', { projeto_ref: projeto2._id, empresa_id })
  ok(!gP2.liberado, 'projeto sem aprovação permanece bloqueado')

  const errFase = await capturar(() => exigirBaseline({ fase: 'instalacao', baseline: bl }))
  ok(errFase?.codigo === MOTIVOS_GATE.FASE_DESCONHECIDA, 'gate cobre apenas engenharia e homologação nesta fase')

  // ═══ 8. Determinismo e tenancy ════════════════════════════════════════════
  secao('8 · Determinismo do congelamento e classificação de tenancy')

  const a = montarConteudoBaseline({ orcamento: { _id: '1', itens: [{ descricao: 'x', quantidade: 2, valor_unitario_r: 10 }] }, cotacao: { _id: '2' }, em: new Date('2026-01-01') })
  const b = montarConteudoBaseline({ orcamento: { itens: [{ valor_unitario_r: 10, quantidade: 2, descricao: 'x' }], _id: '1' }, cotacao: { _id: '2' }, em: new Date('2026-01-01') })
  ok(a.hash === b.hash, 'hash é determinístico — independe da ordem das chaves')
  ok(calcularTotais([{ quantidade: 'x', valor_unitario_r: null }]).total_r === 0, 'totais não propagam NaN com entrada inválida')
  ok(calcularTotais([]).total_r === 0, 'orçamento sem itens totaliza 0')

  for (const m of ['Cotacao', 'Orcamento', 'Baseline']) {
    ok(TENANCY.ESCOPO_TENANT.includes(m), `${m} classificado como ESCOPO_TENANT (M-4)`)
  }

  await mongoose.disconnect()
  await mongod.stop()

  console.log(falhas === 0
    ? '\nOK — Projeto FV → N Cotações → N Orçamentos → 1 Aprovado → 1 Baseline imutável → Gate'
    : `\n${falhas} FALHA(S)`)
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
