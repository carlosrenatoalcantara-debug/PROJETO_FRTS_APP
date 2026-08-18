/**
 * premissasCotacao.check.js — FV-DOM-016A
 *
 * As premissas financeiras do CENÁRIO passaram a viver em `Cotacao.premissas`.
 *
 * O defeito que isso corrige: o adapter lia `projeto.premissas_financeiras` e
 * `fatura_extracao.tarifa_kwh` — dois caminhos que NÃO EXISTEM no schema. O
 * strict-mode do Mongoose descartava qualquer escrita em silêncio, e a inflação
 * (D3) virava lacuna permanente em todo projeto do sistema.
 *
 *   node backend/src/dominio/__checks__/premissasCotacao.check.js
 */
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)
const ler = (p) => readFileSync(path.resolve(RAIZ, p), 'utf8')

const PROJETO = {
  _id: '000000000000000000000001',
  dimensionamento: { potencia_kwp: 14.3, geracao_anual_kwh: 18000 },
}
const ORCAMENTO = {
  itens: [
    { quantidade: 1, valor_unitario_r: 62000 },
    { quantidade: 1, valor_unitario_r: 18000 },
  ],
}
const cotacaoCom = (premissas) => ({ _id: 'c1', premissas })

async function main() {
  const dominio = await import('../financeiro/index.js')

  secao('1 · Caminhos fantasmas eliminados')
  const adapter = ler('backend/src/dominio/financeiro/index.js')
  const semComentarios = adapter.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  ok(!semComentarios.includes('premissas_financeiras'),
    'adapter não lê `projeto.premissas_financeiras` (campo inexistente)')
  ok(!semComentarios.includes('fatura_extracao'),
    'adapter não lê `fatura_extracao.tarifa_kwh` (campo inexistente)')
  ok(adapter.includes('cotacao?.premissas'), 'adapter lê as premissas da Cotação')

  secao('2 · Inflação ausente → lacuna, nunca default')
  const sem = dominio.calcularFinanceiroDoProjeto(PROJETO, {
    orcamento: ORCAMENTO, cotacao: cotacaoCom({ tarifa_kwh: 0.98 }),
  })
  ok(sem.lacunas.includes('inflacao_energia_aa_pct'), 'lacuna declarada')
  ok(sem.premissas.inflacao_energia_aa_pct === null, 'premissa permanece null')
  ok(sem.payback.anos === null && sem.vpl === null, 'indicadores dependentes nulos')

  secao('3 · Inflação 0 % explícita é VÁLIDA — não vira lacuna')
  const zero = dominio.calcularFinanceiroDoProjeto(PROJETO, {
    orcamento: ORCAMENTO, cotacao: cotacaoCom({ tarifa_kwh: 0.98, inflacao_energia_aa_pct: 0 }),
  })
  ok(!zero.lacunas.includes('inflacao_energia_aa_pct'), 'zero NÃO é lacuna')
  ok(zero.premissas.inflacao_energia_aa_pct === 0, 'premissa registrada como 0')
  ok(zero.payback.anos != null && zero.vpl != null, `indicadores calculados (payback ${zero.payback.anos})`)
  ok(zero.proveniencia.inflacao_energia_aa_pct === 'cotacao.premissas.inflacao_energia_aa_pct',
    'proveniência aponta a Cotação')

  secao('4 · Inflação 6 % é preservada e usada')
  const seis = dominio.calcularFinanceiroDoProjeto(PROJETO, {
    orcamento: ORCAMENTO, cotacao: cotacaoCom({ tarifa_kwh: 0.98, inflacao_energia_aa_pct: 6 }),
  })
  ok(seis.premissas.inflacao_energia_aa_pct === 6, 'premissa = 6')
  ok(seis.payback.anos !== zero.payback.anos,
    `6 % produz payback diferente de 0 % (${seis.payback.anos} × ${zero.payback.anos})`)
  ok(seis.vpl.valor_r > zero.vpl.valor_r, 'VPL a 6 % é maior que a 0 % — a premissa é usada de fato')

  secao('5 · Tarifa vem da Cotação')
  ok(seis.proveniencia.tarifa_kwh === 'cotacao.premissas.tarifa_kwh', 'proveniência da tarifa')
  ok(seis.premissas.tarifa_kwh === 0.98, 'valor da Cotação usado')
  // Compatibilidade: projeto anterior ao fluxo canônico ainda lê `valor_kwh`.
  const legado = dominio.adaptarProjetoParaFinanceiro({ ...PROJETO, valor_kwh: 0.85 },
    { orcamento: ORCAMENTO, cotacao: cotacaoCom({}) })
  ok(legado.premissas.tarifa_kwh === 0.85 && legado.proveniencia.tarifa_kwh === 'projeto.valor_kwh',
    'sem tarifa na Cotação, cai na leitura de compatibilidade — declarada')

  secao('6 · TMA de 10 % permanece no contrato, não na Cotação')
  ok(seis.premissas.taxa_desconto_aa_pct === 10, 'TMA 10 % (D2)')
  ok(seis.vpl.taxa_aa_pct === 10, 'VPL carimba a TMA')
  const schemaCot = ler('backend/src/models/Cotacao.js')
  ok(!schemaCot.includes('taxa_desconto'), 'Cotação NÃO guarda TMA — premissa do método, não do cenário')
  ok(!schemaCot.includes('reajuste_tarifa_aa_pct'), 'reajuste NÃO foi adicionado nesta sprint')

  secao('7 · Nenhum default financeiro no caminho')
  ok(/inflacao_energia_aa_pct: \{ type: Number, default: null/.test(schemaCot),
    'schema declara default null')
  for (const p of ['?? 6', '?? 8', '|| 6', '|| 8', '?? 0.95'])
    ok(!semComentarios.includes(p), `adapter sem \`${p}\``)

  secao('8 · Contrato V1 sem alteração de fórmula')
  const { calcularContratoV1, premissasDaVersao } = await import('@fortesolar/fv-shared/financeiro/contrato-v1')
  ok(premissasDaVersao().taxa_desconto_aa_pct === 10, 'TMA intacta')
  ok(premissasDaVersao().inflacao_energia_aa_pct === null, 'contrato segue sem default de inflação')
  const direto = calcularContratoV1({
    entradas: { investimento_r: 80000, geracao_anual_kwh: 18000 },
    premissas: { tarifa_kwh: 0.98, inflacao_energia_aa_pct: 6 },
  })
  ok(direto.payback.anos === seis.payback.anos && direto.vpl.valor_r === seis.vpl.valor_r,
    'mesmas premissas → mesmo resultado, pelo adapter ou direto')

  secao('9 · Baseline congela tarifa e inflação')
  const congelar = ler('backend/src/dominio/baseline/congelarOrcamento.js')
  ok(congelar.includes('inflacao_energia_aa_pct: cotacao.premissas?.inflacao_energia_aa_pct'),
    'inflação entra no conteúdo congelado')
  ok(congelar.includes('tarifa_kwh:         cotacao.premissas?.tarifa_kwh'), 'tarifa já era congelada')

  const { montarConteudoBaseline, verificarIntegridade } = await import('../baseline/congelarOrcamento.js')
  const cot = { _id: 'c1', rotulo: 'A', tecnologia: 'string',
    premissas: { consumo_kwh_mes: 1500, tarifa_kwh: 0.98, inflacao_energia_aa_pct: 6 } }
  const orc = { _id: 'o1', numero: 1, versao: 1, itens: ORCAMENTO.itens, condicoes: {} }
  const bl = montarConteudoBaseline({ orcamento: orc, cotacao: cot, em: new Date('2026-08-16') })
  ok(bl.conteudo.cotacao.premissas.inflacao_energia_aa_pct === 6, 'inflação congelada')
  ok(bl.conteudo.cotacao.premissas.tarifa_kwh === 0.98, 'tarifa congelada')
  ok(verificarIntegridade(bl), 'hash íntegro')

  secao('10 · Alterar a Cotação depois NÃO altera a Baseline')
  const hashAntes = bl.hash
  cot.premissas.inflacao_energia_aa_pct = 99          // alteração posterior
  ok(bl.conteudo.cotacao.premissas.inflacao_energia_aa_pct === 6,
    'conteúdo congelado permanece 6 (M-2)')
  ok(bl.hash === hashAntes, 'hash inalterado')
  const blNova = montarConteudoBaseline({ orcamento: orc, cotacao: cot, em: new Date('2026-08-16') })
  ok(blNova.hash !== hashAntes, 'uma NOVA baseline com a premissa alterada teria outro hash')

  secao('11 · Cotações antigas (sem o campo) continuam funcionando')
  const antiga = dominio.calcularFinanceiroDoProjeto(PROJETO, {
    orcamento: ORCAMENTO,
    cotacao: { _id: 'velha', premissas: { consumo_kwh_mes: 1500, tarifa_kwh: 0.9 } },
  })
  ok(antiga.lacunas.includes('inflacao_energia_aa_pct'), 'campo ausente → lacuna, sem quebrar')
  ok(antiga.premissas.tarifa_kwh === 0.9, 'demais premissas seguem funcionando')
  const semCotacao = dominio.calcularFinanceiroDoProjeto(PROJETO, { orcamento: ORCAMENTO })
  ok(semCotacao.lacunas.includes('inflacao_energia_aa_pct') && semCotacao.lacunas.includes('tarifa_kwh'),
    'sem cotação nenhuma → lacunas, sem exceção')

  secao('12 · Persistência real, isolamento e não contaminação')
  const mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  const { Cotacao } = await import('../../models/Cotacao.js')
  const { aplicarEscopo } = await import('../tenancy/index.js')
  const empA = new mongoose.Types.ObjectId()
  const empB = new mongoose.Types.ObjectId()
  const proj = new mongoose.Types.ObjectId()

  const cotA = await Cotacao.create({
    empresa_id: empA, projeto_ref: proj, tecnologia: 'string',
    premissas: { tarifa_kwh: 0.98, inflacao_energia_aa_pct: 6 },
  })
  const cotB = await Cotacao.create({
    empresa_id: empA, projeto_ref: proj, tecnologia: 'micro',
    premissas: { tarifa_kwh: 1.05, inflacao_energia_aa_pct: 0 },
  })
  const lidaA = await Cotacao.findById(cotA._id).lean()
  const lidaB = await Cotacao.findById(cotB._id).lean()
  ok(lidaA.premissas.inflacao_energia_aa_pct === 6, 'inflação 6 PERSISTIU (não foi descartada)')
  ok(lidaB.premissas.inflacao_energia_aa_pct === 0, 'inflação 0 persistiu como zero')
  ok(lidaA.premissas.inflacao_energia_aa_pct !== lidaB.premissas.inflacao_energia_aa_pct,
    'Cotação A não contamina a B')

  const semCampo = await Cotacao.create({
    empresa_id: empA, projeto_ref: proj, tecnologia: 'string', premissas: { tarifa_kwh: 0.8 },
  })
  ok((await Cotacao.findById(semCampo._id).lean()).premissas.inflacao_energia_aa_pct === null,
    'cotação sem o campo lê null — retrocompatível, sem backfill')

  let recusou = false
  try {
    await Cotacao.create({ empresa_id: empA, projeto_ref: proj, tecnologia: 'string',
      premissas: { inflacao_energia_aa_pct: -5 } })
  } catch { recusou = true }
  ok(recusou, 'inflação negativa recusada (min: 0)')

  const reqB = { auth: { empresa_id: String(empB), perfil: 'admin' } }
  const alheia = await Cotacao.findOne(aplicarEscopo({ _id: cotA._id }, reqB, { contexto: 'chk' })).lean()
  ok(alheia === null, 'Tenant B NÃO acessa a Cotação de A')
  const reqA = { auth: { empresa_id: String(empA), perfil: 'admin' } }
  ok(await Cotacao.findOne(aplicarEscopo({ _id: cotA._id }, reqA, { contexto: 'chk' })).lean() !== null,
    'Tenant A acessa a própria')

  await mongoose.disconnect(); await mongod.stop()

  secao('13 · Nenhuma segunda fonte de premissas')
  const projSchema = ler('backend/src/models/ProjetoFV.js')
  ok(!projSchema.includes('premissas_financeiras'),
    'ProjetoFV NÃO ganhou campo concorrente')
  const ctrl = ler('backend/src/controllers/agregadosFvController.js')
  ok(ctrl.includes('orcamento?.cotacao_ref'), 'controller resolve a cotação pela cadeia do orçamento')
  ok(ctrl.includes("contexto: 'financeiro.cotacao'"), 'leitura da cotação com escopo de organização')

  console.log(falhas === 0
    ? '\nOK — premissas do cenário na Cotação; sem default, sem segunda fonte, Baseline íntegra.'
    : `\n${falhas} FALHA(S).`)
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
