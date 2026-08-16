/**
 * checkpoint-fv-001.mjs — teste integrado do fluxo canônico FV.
 *
 * Roda EXCLUSIVAMENTE contra o ambiente isolado (porta 37017) e recusa qualquer
 * outra URI. Percorre o fluxo pela API canônica, como a nova UX faz, e valida
 * cada invariante direto no banco.
 *
 *   node backend/scripts/checkpoint-fv-001.mjs
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cred = JSON.parse(readFileSync(path.join(RAIZ, '.ambiente-validacao.json'), 'utf8'))

if (!cred.uri.includes('37017')) {
  console.error('❌ RECUSADO: este teste só roda no ambiente isolado (porta 37017).')
  process.exit(1)
}

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

await mongoose.connect(cred.uri)
const { ProjetoFV } = await import('../src/models/ProjetoFV.js')
const { Cotacao } = await import('../src/models/Cotacao.js')
const { Orcamento } = await import('../src/models/Orcamento.js')
const { Baseline } = await import('../src/models/Baseline.js')
const { UnidadeBeneficiaria } = await import('../src/models/UnidadeBeneficiaria.js')
const { CotacaoService } = await import('../src/services/CotacaoService.js')
const { OrcamentoService } = await import('../src/services/OrcamentoService.js')
const { BaselineService } = await import('../src/services/BaselineService.js')
const { avaliarGate } = await import('../src/dominio/gate/index.js')
const { verificarIntegridade } = await import('../src/dominio/baseline/congelarOrcamento.js')
const { gerarUnifilarDoProjeto } = await import('../src/dominio/unifilar/index.js')

const EMPRESA = new mongoose.Types.ObjectId(cred.empresa_id)
const OUTRA = new mongoose.Types.ObjectId()
const esc = { empresa_id: EMPRESA }

// Projeto PRÓPRIO desta execução: o teste precisa ser idempotente. Reusar o
// projeto do seed faria a segunda rodada esbarrar no orçamento aprovado da
// primeira — que é o invariante funcionando, não uma falha.
const projetoDoTeste = await ProjetoFV.create({
  nome: `Checkpoint ${Date.now()}`,
  clienteId: new mongoose.Types.ObjectId(cred.cliente_id),
  empresa_id: EMPRESA,
  status: 'rascunho',
})
const PROJETO = projetoDoTeste._id
console.log(`projeto do teste: ${PROJETO}`)

// ═══ 1 · Cotação ═════════════════════════════════════════════════════════════
secao('1 · Cotação')
// Contagem RELATIVA: o ambiente efêmero pode ser reaproveitado entre execuções,
// então o que importa é o delta, não o absoluto.
const orcAntes = await Orcamento.countDocuments({ projeto_ref: PROJETO })
const cot = await CotacaoService.criar({
  projeto_ref: PROJETO, empresa_id: EMPRESA,
  tecnologia: 'string', rotulo: 'Cenário A',
  premissas: { consumo_kwh_mes: 1500, tarifa_kwh: 0.98, hsp_kwh_m2_dia: 5.2 },
})
ok(!!cot?._id, `cotação criada (${cot._id})`)
ok(String(cot.empresa_id) === String(EMPRESA), 'tenant carimbado na cotação')
ok(await Orcamento.countDocuments({ projeto_ref: PROJETO }) === orcAntes,
  'criar Cotação NÃO cria Orçamento')

// ═══ 2 · Orçamento ═══════════════════════════════════════════════════════════
secao('2 · Orçamento')
const orc = await OrcamentoService.criar({
  projeto_ref: PROJETO, empresa_id: EMPRESA, cotacao_ref: cot._id,
  itens: [
    { descricao: 'Kit FV 14,3 kWp', tipo: 'material', quantidade: 1, valor_unitario_r: 62000 },
    { descricao: 'Instalação', tipo: 'servico', quantidade: 1, valor_unitario_r: 18000 },
  ],
  condicoes: { validade_dias: 15, prazo_execucao_dias: 45 },
})
ok(String(orc.cotacao_ref) === String(cot._id), 'orçamento referencia a Cotação correta (M-1)')
ok(orc.estado === 'RASCUNHO', `nasce em RASCUNHO (${orc.estado})`)

await OrcamentoService.transicionar(orc._id, 'EMITIDO', { por: 'checkpoint' })
const emitido = await Orcamento.findById(orc._id).lean()
ok(emitido.estado === 'EMITIDO', 'emitido')

// `aprovar` é o ato que também CONGELA a Baseline (M-2) — não há passo separado.
await OrcamentoService.aprovar(orc._id, { por: 'checkpoint' })
const aprovado = await Orcamento.findById(orc._id).lean()
ok(aprovado.estado === 'APROVADO', 'aprovado')

// ═══ 3 · Aprovação única ═════════════════════════════════════════════════════
secao('3 · Aprovação única (INV-ORC-3)')
const orc2 = await OrcamentoService.criar({
  projeto_ref: PROJETO, empresa_id: EMPRESA, cotacao_ref: cot._id,
  itens: [{ descricao: 'Alternativa', tipo: 'material', quantidade: 1, valor_unitario_r: 70000 }],
})
await OrcamentoService.transicionar(orc2._id, 'EMITIDO', { por: 'checkpoint' })
let barrou = false
try { await OrcamentoService.aprovar(orc2._id, { por: 'checkpoint' }) } catch { barrou = true }
ok(barrou, 'segundo orçamento NÃO pode ser aprovado')
ok(await Orcamento.countDocuments({ projeto_ref: PROJETO, estado: 'APROVADO' }) === 1,
  'exatamente 1 aprovado no projeto (INV-ORC-3)')

// ═══ 4 · Gate antes da Baseline ══════════════════════════════════════════════
secao('4 · Gate sem Baseline')
const engAntes = avaliarGate({ fase: 'engenharia', baseline: null })
const homAntes = avaliarGate({ fase: 'homologacao', baseline: null })
ok(engAntes.liberado === false, `engenharia BLOQUEADA sem Baseline (${engAntes.motivo})`)
ok(homAntes.liberado === false, `homologação bloqueada (${homAntes.motivo})`)

// ═══ 5 · Baseline ════════════════════════════════════════════════════════════
secao('5 · Baseline')
// A Baseline foi congelada pela APROVAÇÃO acima — não é um passo à parte.
const bl = await Baseline.findOne({ projeto_ref: PROJETO, empresa_id: EMPRESA }).lean()
ok(!!bl?._id, `baseline criada pela aprovação (${bl?._id})`)
ok(!!bl.hash, 'hash presente')
ok(verificarIntegridade(bl), 'integridade verificada')

let imutavel = false
try {
  await Baseline.updateOne({ _id: bl._id }, { $set: { hash: 'adulterado' } })
} catch { imutavel = true }
ok(imutavel, 'Baseline recusa updateOne (imutável)')

// Alterar a ORIGEM não altera a Baseline
const hashAntes = bl.hash
await Cotacao.updateOne({ _id: cot._id }, { $set: { rotulo: 'Cenário A — alterado' } })
const blDepois = await Baseline.findById(bl._id).lean()
ok(blDepois.hash === hashAntes, 'alterar a Cotação NÃO altera a Baseline (M-2)')
ok(verificarIntegridade(blDepois), 'Baseline segue íntegra')

// ═══ 6 · Gate com Baseline ═══════════════════════════════════════════════════
secao('6 · Gate com Baseline válida')
const engDepois = avaliarGate({ fase: 'engenharia', baseline: blDepois })
const homDepois = avaliarGate({ fase: 'homologacao', baseline: blDepois })
ok(engDepois.liberado === true, 'engenharia LIBERADA')
ok(homDepois.liberado === true, 'homologação liberada')

const adulterada = { ...blDepois, hash: 'x'.repeat(64) }
const engAdulterado = avaliarGate({ fase: 'engenharia', baseline: adulterada })
ok(engAdulterado.liberado === false, `Baseline adulterada FECHA o Gate (${engAdulterado.motivo})`)

// ═══ 7 · Isolamento entre organizações ═══════════════════════════════════════
secao('7 · Isolamento entre organizações (M-4)')
for (const [nome, Model] of [['Cotacao', Cotacao], ['Orcamento', Orcamento], ['Baseline', Baseline]]) {
  const alheio = await Model.findOne({ projeto_ref: PROJETO, empresa_id: OUTRA }).lean()
  ok(alheio === null, `${nome}: outra organização não enxerga`)
  const proprio = await Model.findOne({ projeto_ref: PROJETO, empresa_id: EMPRESA }).lean()
  ok(proprio !== null, `${nome}: a própria organização enxerga`)
}

// ═══ 8 · Legado fora do fluxo ════════════════════════════════════════════════
secao('8 · Subdocumento legado')
const proj = await ProjetoFV.findById(PROJETO).lean()
ok(proj.orcamento == null, 'ProjetoFV.orcamento permanece null — fora do fluxo (FV-DOM-003)')

// ═══ 9 · Unifilar ════════════════════════════════════════════════════════════
secao('9 · Unifilar com dados reais')
await ProjetoFV.updateOne({ _id: PROJETO }, {
  $set: {
    localizacao: { cidade: 'Natal', estado: 'RN' },
    distribuidora: 'Neoenergia Cosern',
    'fatura_extracao.tipo_ligacao': 'Trifásico',
    'fatura_extracao.tensao_v': 380,
    equipamentos: {
      paineis: [{ id: 'dah_550', marca: 'DAH', modelo: 'DHN-550', potencia_w: 550, quantidade: 26 }],
      inversor: { marca: 'Deye', modelo: 'SUN-8K-G03', potencia_kw: 8, tipo: 'string', fases: 3 },
    },
    dimensionamento: { potencia_kwp: 14.3, num_paineis: 26, num_strings: 3, num_inversores: 1 },
    engenharia_eletrica: { arranjo: { num_mppts_usados: 2, mppts: [
      { mppt: 1, strings_paralelo: 2, modulos_por_string: 9 },
      { mppt: 2, strings_paralelo: 1, modulos_por_string: 8 },
    ] } },
  },
})
const projUni = await ProjetoFV.findById(PROJETO).lean()
const uni = gerarUnifilarDoProjeto(projUni, { nomeCliente: 'Cliente de Validação' })
ok(uni.svg.includes('Deye') && uni.svg.includes('SUN-8K-G03'), 'inversor REAL no desenho')
ok(uni.svg.includes('MPPT 1') && uni.svg.includes('MPPT 2'), 'dois MPPTs desenhados')
ok(!uni.svg.includes('Fronius SYMO'), 'default antigo (Fronius SYMO) NÃO aparece')
ok(uni.especificacoes.num_paineis === 26 && uni.especificacoes.potencia_cc_kwp === 14.3,
  '26 módulos · 14,3 kWp — dados do projeto')
ok(uni.lacunas.length === 0, `sem lacunas (${JSON.stringify(uni.lacunas)})`)
ok(uni.origem === 'dados_atuais', 'origem declarada como dados atuais')

// Snapshot NÃO se mistura com dados atuais
await ProjetoFV.updateOne({ _id: PROJETO }, {
  $set: { governanca: { snapshot_unifilar: { svg: '<svg><text>CONGELADO</text></svg>', criado_em: new Date(), versao: 'A' } } },
})
const projSnap = await ProjetoFV.findById(PROJETO).lean()
const uni2 = gerarUnifilarDoProjeto(projSnap, {})
ok(!uni2.svg.includes('CONGELADO'), 'geração atual NÃO devolve o snapshot')
ok(projSnap.governanca.snapshot_unifilar.svg.includes('CONGELADO'), 'snapshot preservado, separado')

// ═══ 10 · Beneficiárias ══════════════════════════════════════════════════════
secao('10 · Beneficiárias')
await UnidadeBeneficiaria.create([
  { projetoId: PROJETO, empresa_id: EMPRESA, contaContrato: 'UC-001', tipoRateio: 'percentual', valor: 60, titular: 'Alfa' },
  { projetoId: PROJETO, empresa_id: EMPRESA, contaContrato: 'UC-002', tipoRateio: 'percentual', valor: 40, titular: 'Beta' },
])
const { validarRateio } = await import('@fortesolar/fv-shared/beneficiarias/rateio')
const benef = await UnidadeBeneficiaria.find({ projetoId: PROJETO, empresa_id: EMPRESA, ativa: true }).lean()
const rateio = validarRateio(benef)
ok(benef.length === 2, '2 beneficiárias')
ok(rateio.ok && rateio.soma === 100, `rateio fecha em 100 % (${rateio.soma})`)
const benefAlheia = await UnidadeBeneficiaria.findOne({ projetoId: PROJETO, empresa_id: OUTRA }).lean()
ok(benefAlheia === null, 'beneficiárias isoladas por organização')

// ═══ 11 · Contrato financeiro ════════════════════════════════════════════════
secao('11 · Contrato financeiro V1 — íntegro, D4 não executada')
const C = await import('@fortesolar/fv-shared/financeiro/contrato-v1')
const prem = C.premissasDaVersao()
ok(prem.convencao_payback === 'fracionario', 'D1: fracionário oficial')
ok(prem.taxa_desconto_aa_pct === 10 && prem.natureza_taxa === 'nominal', 'D2: TMA nominal 10 %')
ok(prem.inflacao_energia_aa_pct === null, 'D3: sem default de inflação')
const semInfl = C.calcularContratoV1({
  entradas: { investimento_r: 80000, geracao_anual_kwh: 18000 },
  premissas: { tarifa_kwh: 0.98 },
})
ok(semInfl.lacunas.includes('inflacao_energia_aa_pct') && semInfl.vpl === null,
  'D3: ausência gera lacuna, não valor implícito')
const comInfl = C.calcularContratoV1({
  entradas: { investimento_r: 80000, geracao_anual_kwh: 18000 },
  premissas: { tarifa_kwh: 0.98, inflacao_energia_aa_pct: 8 },
})
ok(comInfl.payback.anos === 4.05 && comInfl.payback.anos_inteiro === 5, 'payback fracionário + inteiro')
ok(comInfl.vpl.valor_r === 227213.92 && comInfl.vpl.taxa_aa_pct === 10, 'VPL a 10 %')
ok(comInfl.regulatorio.motivo === 'D5_PENDENTE', 'D5 declarada pendente')
const { calcularFluxoCaixa } = await import('@fortesolar/fv-shared/financeiro/fluxo-caixa')
ok(calcularFluxoCaixa({ custoTotal: 80000, economiaAnualBase: 17640 }).vpl === 412646.43,
  'D4 NÃO executada — fluxoCaixa segue com TMA 6 %')

// ═══ 12 · Produção intocada ══════════════════════════════════════════════════
secao('12 · Produção')
ok(cred.uri.includes('127.0.0.1:37017'), 'toda a execução no ambiente efêmero local')
ok(!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('37017'),
  'nenhuma variável apontando para produção')

console.log(falhas === 0
  ? '\nOK — fluxo canônico FV íntegro ponta a ponta.'
  : `\n${falhas} FALHA(S).`)

await mongoose.disconnect()
process.exit(falhas === 0 ? 0 : 1)
