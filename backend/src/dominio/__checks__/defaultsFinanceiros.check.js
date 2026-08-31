/**
 * defaultsFinanceiros.check.js — FV-DOM-011B
 *
 * Prova que nenhum número financeiro é FABRICADO quando o projeto não tem dado.
 *
 * A auditoria FV-DOM-010 (D4) encontrou sete superfícies que substituíam
 * ausência por um valor plausível — `vpl || 85000`, `tir || 15.5`,
 * `payback = 8.5`, `economiaAnual = 15000` — e o apresentavam como resultado do
 * projeto. Um PDF assinado podia afirmar um VPL que ninguém calculou.
 *
 * Este check garante três coisas ao mesmo tempo:
 *   1. ausência → `null` / "—", nunca número;
 *   2. **zero é preservado** — é valor legítimo, não ausência;
 *   3. cálculo válido continua aparecendo.
 *
 *   node backend/src/dominio/__checks__/defaultsFinanceiros.check.js
 */
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

const ler = (p) => readFileSync(path.resolve(RAIZ, p), 'utf8')

function fakeRes() {
  return {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this },
    json(b) { this.body = b; return this },
  }
}

/** Coleta o texto que o PDFKit recebeu, sem gerar arquivo. */
function capturarTextoPDF() {
  const textos = []
  return { textos, capturar: (t) => { if (typeof t === 'string') textos.push(t) } }
}

async function main() {
  secao('1 · Os defaults fabricados não existem mais no código')
  const PROIBIDOS = [
    ['backend/src/services/propostaComercialService.js', ['|| 85000', '|| 15.5', '|| 25000', '|| 500', '|| 0.80', '|| 5\n']],
    ['frontend/src/utils/gerarPropostaPDF.js', ['= 15000', '= 8.5', '= 150000', '= 68', '= 15,', '= 10,']],
    ['frontend/src/pages/SimulacaoFV.jsx', [`valor_proposta: financeiro?.vpl || 15${'000'}`]],
    ['backend/src/controllers/decisaoController.js',
      ['payback || 8', 'tir || 12', `investimentoTotal || 45${'000'}`, 'paybackComBateria || 12']],
  ]
  for (const [arquivo, padroes] of PROIBIDOS) {
    const src = ler(arquivo)
    for (const p of padroes) {
      ok(!src.includes(p), `${path.basename(arquivo)} — sem \`${p.replace('\n', '')}\``)
    }
  }

  secao('2 · propostaComercialService — projeto SEM dados não inventa número')
  const { gerarPropostaComercial } = await import('../../services/propostaComercialService.js')
  const cap = capturarTextoPDF()
  // PDFKit escreve num stream; aqui só interessa o que foi pedido para escrever.
  const doc = await gerarPropostaComercial({ _id: 'x' }, { nome: 'Cliente' }, {})
  const buf = await new Promise((resolve, reject) => {
    const pedacos = []
    doc.on('data', (d) => pedacos.push(d))
    doc.on('end', () => resolve(Buffer.concat(pedacos)))
    doc.on('error', reject)
    doc.end()
  })
  const texto = buf.toString('latin1')
  for (const fabricado of ['85.000', '15,5', '25.000', '5 kWp']) {
    ok(!texto.includes(fabricado), `PDF sem o valor fabricado "${fabricado}"`)
  }
  ok(texto.includes('—') || texto.includes('—') || buf.length > 1000,
    'PDF foi gerado mesmo sem dados (não quebrou)')

  secao('3 · propostaComercialService — projeto COM dados continua exibindo')
  const doc2 = await gerarPropostaComercial(
    { _id: 'y', potencia_kwp: 14.3 },
    { nome: 'Cliente' },
    { tarifa_media: 0.98, conta_media: 850, investimento_total: 80000, tir: 21.4, vpl: 173320 },
  )
  const buf2 = await new Promise((resolve, reject) => {
    const p = []
    doc2.on('data', (d) => p.push(d))
    doc2.on('end', () => resolve(Buffer.concat(p)))
    doc2.on('error', reject)
    doc2.end()
  })
  ok(buf2.length > buf.length * 0.8, 'PDF com dados gerado normalmente')

  secao('4 · decisaoController — sem financeiro, não afirma retorno')
  const { recomendarSistema } = await import('../../controllers/decisaoController.js')

  const reqSem = {
    body: {
      consumo: { consumoMensal: 600 },
      strings: { totalStrings: 2, potenciaKwp: 8, potenciaPainelW: 550, potenciaInversorKW: 8 },
      validacao: { valido: true },
      // A rota exige a CHAVE `financeiro` (senão devolve 400). O caso real é ela
      // existir sem os indicadores — que era exatamente quando os fabricados entravam.
      financeiro: {},
    },
  }
  const resSem = fakeRes()
  await recomendarSistema(reqSem, resSem)
  const bSem = resSem.body
  ok(bSem?.payback === null, `payback ausente → null (recebido: ${JSON.stringify(bSem?.payback)})`)
  ok(bSem?.tir === null, `tir ausente → null (recebido: ${JSON.stringify(bSem?.tir)})`)
  ok(Array.isArray(bSem?.lacunas) && bSem.lacunas.includes('payback') && bSem.lacunas.includes('tir'),
    `lacunas declaradas: ${JSON.stringify(bSem?.lacunas)}`)
  ok(!bSem?.justificativa?.includes('excelente retorno financeiro'),
    'não afirma "excelente retorno" sem TIR')
  ok(bSem?.justificativa?.includes('Payback não calculado'),
    'justificativa declara que o payback não foi calculado')

  secao('5 · decisaoController — com financeiro, comportamento preservado')
  const resCom = fakeRes()
  await recomendarSistema({
    body: { ...reqSem.body, financeiro: { payback: 4.6, tir: 21.4, vpl: 173320 } },
  }, resCom)
  ok(resCom.body?.payback === 4.6, 'payback real preservado')
  ok(resCom.body?.tir === 21.4, 'TIR real preservada')
  ok(resCom.body?.lacunas.length === 0, 'sem lacunas quando há dado')
  ok(resCom.body?.justificativa?.includes('excelente retorno financeiro'),
    'afirma retorno quando a TIR realmente é > 10')

  secao('6 · ZERO é valor legítimo — não vira ausência')
  const resZero = fakeRes()
  await recomendarSistema({
    body: { ...reqSem.body, financeiro: { payback: 0, tir: 0, vpl: 0 } },
  }, resZero)
  ok(resZero.body?.payback === 0, 'payback 0 preservado (não virou null)')
  ok(resZero.body?.tir === 0, 'tir 0 preservada')
  ok(resZero.body?.vpl === 0, 'vpl 0 preservado')
  ok(resZero.body?.lacunas.length === 0, 'zero não é lacuna')
  ok(!resZero.body?.justificativa?.includes('excelente retorno'),
    'TIR 0 não afirma excelente retorno')

  secao('7 · Fórmulas do PDF — migradas para o contrato V1 (FV-DOM-015)')
  // Este bloco protegia as fórmulas próprias do PDF enquanto D4 estava pendente.
  // Com D4 aprovada e executada, elas SAÍRAM de propósito: o payback simplificado
  // (que errava até +106 %), o fator de geração 131,44 e a economia de 25 anos
  // com fator 0,8. O check inverteu de sentido — agora exige que não voltem.
  const svc = ler('backend/src/services/propostaComercialService.js')
  ok(!svc.includes('investimento / (economiaGerada * 12)'), 'payback simplificado REMOVIDO')
  ok(!svc.includes('potenciaKWp * 131.44'), 'fator de geração REMOVIDO')
  ok(!svc.includes('economiaGerada * 12 * 25 * 0.8'), 'economia 25 anos própria REMOVIDA')
  ok(svc.includes('c.payback?.anos') && svc.includes('c.vpl?.valor_r'),
    'indicadores vêm do contrato V1')
  ok(svc.includes('* 0.45') && svc.includes('* 0.15') && svc.includes('* 0.25'),
    'percentuais da composição do investimento intactos (apresentação, não indicador)')

  secao('8 · Nenhuma decisão D1–D5 incorporada')
  const { calcularRetorno } = await import('@fortesolar/fv-shared/financeiro/engine')
  const { calcularFluxoCaixa } = await import('@fortesolar/fv-shared/financeiro/fluxo-caixa')
  const dim = await import('@fortesolar/fv-shared/financeiro/dimensionamento-retorno')
  ok(calcularRetorno({ geracaoAnualKwh: 7000, tarifaKwh: 1, precoVenda: 80000, inflacaoEnergiaPct: 8 }).payback_anos === 8.56,
    'payback fracionário intacto (D1)')
  ok(calcularFluxoCaixa({ custoTotal: 80000, economiaAnualBase: 7000 }).paybackSimples === 9,
    'payback inteiro intacto (D1)')
  ok(calcularFluxoCaixa({ custoTotal: 80000, economiaAnualBase: 17640 }).vpl === 412646.43, 'VPL a 6 % intacto (D2)')
  ok(dim.DEFAULTS_FINANCEIROS.inflacao_energia_aa === 0.06, 'inflação 6 % intacta (D3)')
  ok(dim.DEFAULTS_FINANCEIROS.taxa_desconto_aa === 0.10, 'taxa 10 % intacta (D2)')
  ok(dim.calcularPayback({ custo_total: 120000, geracao_anual_y1: 6100, tarifa_kwh: 1, inflacao_aa: 0.06 }) === 9.7,
    'payback por economia média intacto (D1/R12)')

  console.log(falhas === 0
    ? '\nOK — zero valores financeiros fabricados; zero preservado; fórmulas e D1–D5 intactas.'
    : `\n${falhas} FALHA(S).`)
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
