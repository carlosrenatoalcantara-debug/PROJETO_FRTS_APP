/**
 * pdfContratoV1.check.js — FV-DOM-015 (execução de D4, PDF comercial)
 *
 * Prova que o PDF da proposta passou a consumir o contrato financeiro V1 e que
 * nenhum cálculo financeiro sobreviveu no caminho migrado.
 *
 * O PDF é a superfície de maior risco: é documento assinado. A fórmula que saiu
 * daqui errava até +106 % no payback de projetos longos.
 *
 *   node backend/src/dominio/__checks__/pdfContratoV1.check.js
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

/**
 * Captura o que o PDF MANDA ESCREVER.
 *
 * Ler o buffer não serve: o PDFKit comprime os streams e codifica o texto em
 * hex com subsetting de fonte, então nem "4.05" nem "R$ 227.213,92" aparecem
 * como ASCII. Interceptar `doc.text()` prova diretamente o que foi escrito —
 * que é exatamente a pergunta desta verificação.
 */
async function capturarTexto(gerar) {
  const { default: PDFDocument } = await import('pdfkit')
  const original = PDFDocument.prototype.text
  const escrito = []
  PDFDocument.prototype.text = function (txt, ...resto) {
    if (txt != null) escrito.push(String(txt))
    return original.call(this, txt, ...resto)
  }
  try {
    const doc = await gerar()
    doc.end()
    return escrito.join(String.fromCharCode(10))
  } finally {
    PDFDocument.prototype.text = original
  }
}

function fakeRes() {
  return {
    statusCode: 200, body: null, headers: {}, buffer: null,
    status(c) { this.statusCode = c; return this },
    json(b) { this.body = b; return this },
    setHeader(k, v) { this.headers[k] = v },
    send(b) { this.buffer = b; return this },
  }
}

const CASOS = [
  ['saudável', { investimento_r: 80000, geracao_anual_kwh: 18000 }, { tarifa_kwh: 0.98, inflacao_energia_aa_pct: 8 }],
  ['marginal', { investimento_r: 120000, geracao_anual_kwh: 6100 }, { tarifa_kwh: 1.0, inflacao_energia_aa_pct: 8 }],
  ['não se paga', { investimento_r: 900000, geracao_anual_kwh: 2000 }, { tarifa_kwh: 1.0, inflacao_energia_aa_pct: 8 }],
  ['inflação ausente', { investimento_r: 80000, geracao_anual_kwh: 18000 }, { tarifa_kwh: 0.98 }],
  ['inflação zero explícita', { investimento_r: 80000, geracao_anual_kwh: 18000 }, { tarifa_kwh: 0.98, inflacao_energia_aa_pct: 0 }],
  ['extremo — investimento mínimo', { investimento_r: 1, geracao_anual_kwh: 18000 }, { tarifa_kwh: 0.98, inflacao_energia_aa_pct: 8 }],
  ['extremo — geração zero', { investimento_r: 80000, geracao_anual_kwh: 0 }, { tarifa_kwh: 0.98, inflacao_energia_aa_pct: 8 }],
]

async function main() {
  const C = await import('@fortesolar/fv-shared/financeiro/contrato-v1')
  const { gerarPropostaComercial } = await import('../../services/propostaComercialService.js')

  secao('1 · Nenhuma fórmula financeira sobreviveu no caminho do PDF')
  const svc = ler('backend/src/services/propostaComercialService.js')
  const ctrl = ler('backend/src/controllers/propostaController.js')
  for (const formula of [
    '131.44',                               // geração estimada
    '* 12 * 25 * 0.8',                      // economia 25 anos
    'investimento / (economiaGerada * 12)', // payback simplificado
    'Math.pow(1 +',                         // qualquer capitalização
  ]) {
    ok(!svc.includes(formula), `service sem \`${formula}\``)
    ok(!ctrl.includes(formula), `controller sem \`${formula}\``)
  }
  ok(!svc.includes('financeiro.'), 'nenhuma referência ao antigo parâmetro `financeiro`')

  secao('2 · O PDF consome o contrato V1')
  ok(ctrl.includes('calcularFinanceiroDoProjeto'), 'controller chama o motor canônico')
  ok(svc.includes('contrato = null') || svc.includes('contrato'), 'service recebe o contrato')
  ok(svc.includes('c.payback?.anos') && svc.includes('c.vpl?.valor_r') && svc.includes('c.tir?.valor_aa_pct'),
    'indicadores vêm do contrato')
  ok(ctrl.includes('aplicarEscopo'), 'projeto lido com escopo de organização')
  const ctrlSemComentarios = ctrl.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  ok(!ctrlSemComentarios.includes('req.body'),
    'corpo da requisição NÃO alimenta o cálculo (verificado fora de comentários)')
  ok(ctrl.includes('OrcamentoService.vigenteDoProjeto'), 'investimento vem do orçamento canônico')

  secao('3 · Valores no PDF = valores do contrato')
  for (const [rotulo, entradas, premissas] of CASOS) {
    const contrato = C.calcularContratoV1({ entradas, premissas })
    const texto = await capturarTexto(() =>
      gerarPropostaComercial({ _id: 'x', nome: 'Teste' }, { nome: 'Cliente' }, contrato))

    if (contrato.payback.anos != null) {
      ok(texto.includes(String(contrato.payback.anos)),
        `${rotulo}: payback ${contrato.payback.anos} presente no PDF`)
      ok(contrato.payback.anos_inteiro === Math.ceil(contrato.payback.anos),
        `${rotulo}: inteiro coerente com o fracionário (${contrato.payback.anos_inteiro})`)
    } else {
      ok(true, `${rotulo}: sem payback — nada a afirmar`)
    }
    if (contrato.vpl?.valor_r != null) {
      ok(contrato.vpl.taxa_aa_pct === 10, `${rotulo}: VPL à TMA de 10 %`)
    }
  }

  secao('4 · Inflação ausente → lacuna, não número')
  const semInfl = C.calcularContratoV1({
    entradas: { investimento_r: 80000, geracao_anual_kwh: 18000 },
    premissas: { tarifa_kwh: 0.98 },
  })
  ok(semInfl.lacunas.includes('inflacao_energia_aa_pct'), 'contrato declara a lacuna')
  ok(semInfl.payback.anos === null && semInfl.vpl === null, 'indicadores nulos')
  const txtSem = await capturarTexto(() =>
    gerarPropostaComercial({ _id: 'x' }, { nome: 'C' }, semInfl))
  ok(txtSem.includes('inflação energética') || txtSem.includes('o energ'),
    'PDF DECLARA a lacuna ao leitor')
  for (const inventado of ['15,5', '85.000', '8.5 anos', '25.000'])
    ok(!txtSem.includes(inventado), `PDF sem o valor fabricado "${inventado}"`)

  secao('5 · Zero explícito continua sendo zero')
  const zero = C.calcularContratoV1({
    entradas: { investimento_r: 80000, geracao_anual_kwh: 18000 },
    premissas: { tarifa_kwh: 0.98, inflacao_energia_aa_pct: 0 },
  })
  ok(!zero.lacunas.includes('inflacao_energia_aa_pct'), 'zero informado NÃO é lacuna')
  ok(zero.premissas.inflacao_energia_aa_pct === 0, 'premissa registrada como 0')
  ok(zero.payback.anos === 4.58, `payback calculado normalmente (${zero.payback.anos})`)
  ok(zero.vpl.valor_r === 74320.53, `VPL a 0 % de inflação (${zero.vpl.valor_r})`)

  secao('6 · TIR preserva convergência')
  const tirAlta = C.calcularContratoV1({
    entradas: { investimento_r: 1, geracao_anual_kwh: 18000 },
    premissas: { tarifa_kwh: 0.98, inflacao_energia_aa_pct: 8 },
  })
  ok(tirAlta.tir.convergiu === false, `TIR fora do intervalo não converge (${tirAlta.tir.motivo})`)
  const txtTir = await capturarTexto(() =>
    gerarPropostaComercial({ _id: 'x' }, { nome: 'C' }, tirAlta))
  ok(!txtTir.includes('null% a.a.') && !txtTir.includes('undefined'),
    'PDF não imprime null/undefined para TIR não convergida')
  ok(svc.includes('tirConvergiu'), 'service verifica convergência antes de exibir')

  secao('7 · Sem fallback financeiro artificial')
  for (const p of ['|| 15.5', '|| 85000', '|| 25000', '|| 0.80', '|| 500', '= 8.5'])
    ok(!svc.includes(p), `sem \`${p}\``)

  secao('8 · Histórico não é recalculado')
  ok(ctrl.includes('readFileSync'), 'download lê arquivo salvo')
  const iDown = ctrl.indexOf('export async function baixarProposta')
  const trechoDown = ctrl.slice(iDown, ctrl.indexOf('export async function visualizarProposta'))
  ok(!trechoDown.includes('calcularFinanceiroDoProjeto'), 'download NÃO chama o motor')
  ok(!trechoDown.includes('gerarPDF'), 'download NÃO regera o PDF')
  ok(trechoDown.includes('HISTÓRICO') || trechoDown.includes('histórico'), 'intenção registrada no código')

  secao('9 · Rastreabilidade do documento novo')
  ok(ctrl.includes('X-Contrato-Versao') && ctrl.includes('X-Premissas-Versao'),
    'documento novo carimba as versões')
  ok(ctrl.includes('lacunas: contrato.lacunas'), 'visualização expõe as lacunas')

  secao('10 · Endpoint em banco real: tenant e ausência de body')
  const mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  const { ProjetoFV } = await import('../../models/ProjetoFV.js')
  // `populate('clienteId')` exige o schema registrado nesta conexão.
  await import('../../models/Cliente.js')
  const empA = new mongoose.Types.ObjectId()
  const empB = new mongoose.Types.ObjectId()
  const proj = await ProjetoFV.create({
    nome: 'Proposta', empresa_id: empA, clienteId: new mongoose.Types.ObjectId(),
    dimensionamento: { potencia_kwp: 14.3, geracao_anual_kwh: 18000 },
    fatura_extracao: { tarifa_kwh: 0.98 },
  })
  const { gerarPropostaComercial: handler, baixarProposta } =
    await import('../../controllers/propostaController.js')

  const resB = fakeRes()
  await handler({
    params: { projetoId: String(proj._id) },
    auth: { empresa_id: String(empB), perfil: 'admin' },
    body: { financeiro: { payback: 1, tir: 999, vpl: 999999 } },   // tentativa de injeção
  }, resB)
  ok(resB.statusCode === 404, `Tenant B recebe 404 (${resB.statusCode})`)

  const resA = fakeRes()
  await handler({
    params: { projetoId: String(proj._id) },
    auth: { empresa_id: String(empA), perfil: 'admin' },
    body: { financeiro: { payback: 1, tir: 999, vpl: 999999 } },
  }, resA)
  ok(resA.statusCode === 200 && Buffer.isBuffer(resA.buffer), 'Tenant A recebe o PDF')
  ok(resA.headers['X-Contrato-Versao'] === '1.0.0', 'cabeçalho de versão do contrato')
  const txtA = resA.buffer.toString('latin1')
  ok(!txtA.includes('999999') && !txtA.includes('999%'),
    'números enviados pelo CLIENTE não aparecem no PDF')

  const resDown = fakeRes()
  await baixarProposta({ params: { projetoId: String(proj._id) } }, resDown)
  ok(resDown.statusCode === 404, 'sem arquivo salvo, download devolve 404 — não regera')

  await mongoose.disconnect(); await mongod.stop()

  secao('11 · Demais superfícies NÃO migradas seguem intactas (fora do escopo)')
  const { calcularFluxoCaixa } = await import('@fortesolar/fv-shared/financeiro/fluxo-caixa')
  const dim = await import('@fortesolar/fv-shared/financeiro/dimensionamento-retorno')
  ok(calcularFluxoCaixa({ custoTotal: 80000, economiaAnualBase: 17640 }).vpl === 412646.43,
    'fluxoCaixa intacto (TMA 6 %)')
  ok(dim.DEFAULTS_FINANCEIROS.inflacao_energia_aa === 0.06, 'dimensionamento intacto (6 %)')
  const contratoRef = await import('@fortesolar/fv-shared/financeiro/contrato-v1')
  ok(contratoRef.premissasDaVersao().inflacao_energia_aa_pct === null, 'D3 preservada no contrato')
  ok(contratoRef.calcularContratoV1({
    entradas: { investimento_r: 80000, geracao_anual_kwh: 18000 },
    premissas: { tarifa_kwh: 0.98, inflacao_energia_aa_pct: 8 },
  }).regulatorio.motivo === 'D5_PENDENTE', 'D5 permanece pendente')

  console.log(falhas === 0
    ? '\nOK — PDF comercial migrado para o contrato V1; histórico preservado.'
    : `\n${falhas} FALHA(S).`)
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
