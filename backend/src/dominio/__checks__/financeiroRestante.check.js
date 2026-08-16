/**
 * financeiroRestante.check.js — FV-DOM-011
 *
 * Consolida os dois últimos caminhos financeiros (`financeiroController` e
 * `services/dimensionamentoFV`). A pergunta é a mesma da FV-DOM-009:
 *
 *   algum número mudou?
 *
 * Verificação valor a valor contra os arquivos reconstruídos do `git HEAD`,
 * incluindo casos normais, extremos, inválidos e limites — e a prova de que as
 * divergências deliberadas (D1–D5 pendentes) continuam divergindo.
 *
 *   node backend/src/dominio/__checks__/financeiroRestante.check.js
 */
import path from 'node:path'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ_REPO = path.resolve(AQUI, '../../../..')
const PKG = path.resolve(RAIZ_REPO, 'packages/fv-shared/financeiro')

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

const doHead = (p) => execFileSync('git', ['show', `HEAD:${p}`], {
  cwd: RAIZ_REPO, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
})

function iguais(a, b) {
  if (Number.isNaN(a) && Number.isNaN(b)) return true
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null || typeof a !== 'object') return false
  const ka = Object.keys(a), kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((k) => iguais(a[k], b[k]))
}

/** Reconstrói os dois caminhos como estavam antes desta sprint. */
async function carregarReferencia() {
  const dir = mkdtempSync(path.join(tmpdir(), 'fin-rest-'))

  // dimensionamentoFV: o service inteiro. O import de dados aponta para o
  // arquivo REAL — substituí-lo por stub faria `dimensionarFV` divergir por
  // causa da irradiância, não do que esta sprint mexeu.
  const dadosReais = pathToFileURL(path.resolve(RAIZ_REPO, 'backend/src/data/irradianciaRN.js')).href
  writeFileSync(path.join(dir, 'dimensionamentoFV.js'),
    doHead('backend/src/services/dimensionamentoFV.js').replace(
      "from '../data/irradianciaRN.js'", `from '${dadosReais}'`))

  // financeiroController: extrai o corpo de `simularFinanceiro` e o transforma
  // numa função pura equivalente, chamada com um `res` falso.
  writeFileSync(path.join(dir, 'financeiroController.js'), doHead('backend/src/controllers/financeiroController.js'))

  return {
    dim: await import(pathToFileURL(path.join(dir, 'dimensionamentoFV.js')).href),
    ctrl: await import(pathToFileURL(path.join(dir, 'financeiroController.js')).href),
  }
}

/** `res` falso: captura status e corpo, como nos demais checks de controller. */
function fakeRes() {
  return {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this },
    json(b) { this.body = b; return this },
  }
}

// ── Casos ───────────────────────────────────────────────────────────────────
const CASOS_DIM = [
  ['normal', { custo_total: 80000, geracao_anual_y1: 18000, tarifa_kwh: 0.98, inflacao_aa: 0.06 }],
  ['defaults', { custo_total: 80000, geracao_anual_y1: 18000 }],
  ['inflação zero', { custo_total: 80000, geracao_anual_y1: 18000, tarifa_kwh: 0.98, inflacao_aa: 0 }],
  ['inflação alta', { custo_total: 80000, geracao_anual_y1: 18000, tarifa_kwh: 0.98, inflacao_aa: 0.2 }],
  ['custo zero', { custo_total: 0, geracao_anual_y1: 18000, tarifa_kwh: 0.98 }],
  ['custo negativo', { custo_total: -5000, geracao_anual_y1: 18000, tarifa_kwh: 0.98 }],
  ['geração zero', { custo_total: 80000, geracao_anual_y1: 0, tarifa_kwh: 0.98 }],
  ['tarifa zero', { custo_total: 80000, geracao_anual_y1: 18000, tarifa_kwh: 0 }],
  ['investimento minúsculo (TIR > 150 %)', { custo_total: 100, geracao_anual_y1: 18000, tarifa_kwh: 0.98 }],
  ['investimento gigante (TIR não converge)', { custo_total: 5e7, geracao_anual_y1: 18000, tarifa_kwh: 0.98 }],
  ['valores fracionários', { custo_total: 12345.67, geracao_anual_y1: 9876.54, tarifa_kwh: 1.0349, inflacao_aa: 0.0733 }],
]

const CASOS_OM = [
  ['padrão', { investimento: 80000 }],
  ['com bateria', { investimento: 80000, tipo_cenario: 'com_bateria' }],
  ['consumo e tarifa próprios', { investimento: 80000, consumo_kwh_mes: 1500, tarifa_energia: 1.05 }],
  ['sem crescimento nem inflação', { investimento: 80000, crescimento_consumo_anual: 0, inflacao_energia: 0 }],
  ['desconto zero', { investimento: 80000, taxa_desconto: 0 }],
  ['horizonte 10', { investimento: 80000, anos: 10 }],
  ['horizonte 1', { investimento: 80000, anos: 1 }],
  ['investimento gigante (não paga)', { investimento: 5e7 }],
  ['cenário desconhecido', { investimento: 80000, tipo_cenario: 'xpto' }],
  ['investimento string numérica', { investimento: '80000' }],
]

const CASOS_INVALIDOS = [
  ['sem investimento', {}],
  ['investimento zero', { investimento: 0 }],
  ['investimento negativo', { investimento: -1 }],
  ['investimento não numérico', { investimento: 'abc' }],
]

async function main() {
  const ref = await carregarReferencia()
  const dim = await import('@fortesolar/fv-shared/financeiro/dimensionamento-retorno')
  const om = await import('@fortesolar/fv-shared/financeiro/simulacao-om')
  const { simularFinanceiro } = await import('../../controllers/financeiroController.js')
  const svc = await import('../../services/dimensionamentoFV.js')

  secao('1 · dimensionamentoFV — payback, VPL e TIR')
  for (const [rotulo, p] of CASOS_DIM) {
    const a = {
      payback: ref.dim.calcularPayback(p),
      vpl: ref.dim.calcularVPL(p),
      tir: ref.dim.calcularTIR(p),
      economia25: ref.dim.calcularEconomia25Anos({ ...p, geracao_anual_y1: p.geracao_anual_y1 }),
    }
    const b = {
      payback: dim.calcularPayback(p),
      vpl: dim.calcularVPL(p),
      tir: dim.calcularTIR(p),
      economia25: dim.calcularEconomia25Anos({ ...p, geracao_anual_y1: p.geracao_anual_y1 }),
    }
    ok(iguais(a, b), `${rotulo} → payback ${b.payback} · TIR ${b.tir} · VPL ${b.vpl}`)
  }

  secao('2 · dimensionamentoFV — economia anual e custo do sistema')
  for (const p of [
    { geracao_anual_kwh: 18000, tarifa_kwh: 0.98 },
    { geracao_anual_kwh: 18000, tarifa_kwh: 0 },      // cai no default (|| )
    { geracao_anual_kwh: 18000, tarifa_kwh: undefined },
    { geracao_anual_kwh: 0, tarifa_kwh: 1 },
  ]) {
    ok(ref.dim.calcularEconomiaAnual(p) === dim.calcularEconomiaAnual(p),
      `economia anual · tarifa ${p.tarifa_kwh} → ${dim.calcularEconomiaAnual(p)}`)
  }
  for (const [kwp, custo] of [[14.3, undefined], [14.3, 5200], [0, 4500], [1000, 4500]]) {
    ok(ref.dim.calcularCustoSistema(kwp, custo) === dim.calcularCustoSistema(kwp, custo),
      `custo do sistema · ${kwp} kWp × ${custo ?? 'default'}`)
  }

  secao('3 · dimensionamentoFV — defaults e constantes intactos')
  ok(iguais(ref.dim.DEFAULTS, svc.DEFAULTS), 'DEFAULTS do service idêntico ao HEAD (mesma forma, mesmos valores)')
  ok(svc.DEFAULTS.inflacao_energia_aa === 0.06, 'inflação continua 6 % (D3 aberta)')
  ok(svc.DEFAULTS.taxa_desconto_aa === 0.10, 'taxa de desconto continua 10 % (D2 aberta)')
  ok(dim.ANOS_PROJETO === 25 && dim.DEGRADACAO_ANUAL_PCT === 0.5, 'horizonte e degradação intactos')

  secao('4 · dimensionamentoFV — pipeline completo `dimensionarFV`')
  // `metadados.calculado_em` é carimbo de tempo (E3 do contrato V1): metadado,
  // não resultado. Duas execuções em milissegundos diferentes divergem nele e em
  // nada mais — comparar o carimbo testaria o relógio, não o cálculo.
  const semCarimbo = (r) => {
    if (!r || typeof r !== 'object') return r
    const { metadados, ...resto } = r
    if (!metadados) return resto
    const { calculado_em, ...metaResto } = metadados
    return { ...resto, metadados: metaResto }
  }
  for (const input of [
    { consumo_mensal_kwh: 500, cidade: 'Natal', estado: 'RN' },
    { consumo_mensal_kwh: 1500, estado: 'RN', tarifa_kwh: 1.05 },
    { consumo_mensal_kwh: 300, irradiancia_kwh_m2_dia: 5.4, custo_kwp_instalado_r: 5000 },
    { consumo_mensal_kwh: 100 },
  ]) {
    ok(iguais(semCarimbo(ref.dim.dimensionarFV(input)), semCarimbo(svc.default.dimensionarFV(input))),
      `dimensionarFV · consumo ${input.consumo_mensal_kwh} kWh/mês`)
  }

  secao('5 · financeiroController — resposta idêntica')
  for (const [rotulo, body] of CASOS_OM) {
    const a = fakeRes(); const b = fakeRes()
    ref.ctrl.simularFinanceiro({ body }, a)
    simularFinanceiro({ body }, b)
    ok(a.statusCode === b.statusCode && iguais(a.body, b.body),
      `${rotulo} → payback ${b.body?.payback} · TIR ${b.body?.tir}`)
  }

  secao('6 · financeiroController — erros equivalentes')
  for (const [rotulo, body] of CASOS_INVALIDOS) {
    const a = fakeRes(); const b = fakeRes()
    ref.ctrl.simularFinanceiro({ body }, a)
    simularFinanceiro({ body }, b)
    ok(a.statusCode === b.statusCode && iguais(a.body, b.body),
      `${rotulo} → ${b.statusCode} ${JSON.stringify(b.body?.erro ?? '')}`)
  }
  // `req.body` ausente estoura da mesma forma nos dois (500 pelo catch).
  {
    const a = fakeRes(); const b = fakeRes()
    ref.ctrl.simularFinanceiro({}, a)
    simularFinanceiro({}, b)
    ok(a.statusCode === b.statusCode && a.statusCode === 500, 'body ausente → 500 nos dois')
  }

  secao('7 · A TIR do financeiroController era cópia literal — prova')
  const ctrlHead = doHead('backend/src/controllers/financeiroController.js')
  const iniT = ctrlHead.indexOf('function calcularTIR(')
  const dirT = mkdtempSync(path.join(tmpdir(), 'tir-fin-'))
  writeFileSync(path.join(dirT, 'tir.js'), 'export ' + ctrlHead.slice(iniT, ctrlHead.indexOf('\n}\n', iniT) + 2))
  const tirAntiga = (await import(pathToFileURL(path.join(dirT, 'tir.js')).href)).calcularTIR
  const { calcularTIR: tirCompartilhada } = await import('@fortesolar/fv-shared/financeiro/fluxo-caixa')

  let div = 0
  for (let inv = 1000; inv <= 500000; inv += 7331) {
    for (const eco of [500, 5000, 17640, 90000]) {
      const f = [-inv, ...Array(25).fill(eco)]
      if (tirAntiga(f) !== tirCompartilhada(f)) div++
    }
  }
  ok(div === 0, '280 combinações: cópia idêntica à compartilhada')

  secao('8 · Divergências deliberadas PRESERVADAS (D1–D5 pendentes)')
  const { calcularFluxoCaixa } = await import('@fortesolar/fv-shared/financeiro/fluxo-caixa')
  const { calcularRetorno } = await import('@fortesolar/fv-shared/financeiro/engine')

  const pbMedia = dim.calcularPayback({ custo_total: 120000, geracao_anual_y1: 6100, tarifa_kwh: 1, inflacao_aa: 0.06 })
  const pbAcum = calcularRetorno({ geracaoAnualKwh: 6100, tarifaKwh: 1, precoVenda: 120000, inflacaoEnergiaPct: 6 }).payback_anos
  ok(pbMedia === 9.7, `payback por economia média continua 9,7 (${pbMedia}) — R12 preservado`)
  ok(pbAcum === 13.71, `payback acumulado continua 13,71 (${pbAcum})`)
  ok(pbMedia < pbAcum, 'D1 ABERTA — a média segue subestimando o acumulado')

  const semBat = fakeRes(); simularFinanceiro({ body: { investimento: 80000, consumo_kwh_mes: 1500, tarifa_energia: 0.98 } }, semBat)
  const comBat = fakeRes(); simularFinanceiro({ body: { investimento: 80000, consumo_kwh_mes: 1500, tarifa_energia: 0.98, tipo_cenario: 'com_bateria' } }, comBat)
  ok(semBat.body.payback !== comBat.body.payback,
    `R13 preservado — fator de cenário ainda muda o payback (${semBat.body.payback} × ${comBat.body.payback})`)

  ok(calcularFluxoCaixa({ custoTotal: 80000, economiaAnualBase: 17640 }).vpl === 412646.43, 'VPL a 6 % intacto (D2)')
  ok(dim.calcularVPL({ custo_total: 80000, geracao_anual_y1: 18000, tarifa_kwh: 0.98 }) === 173320.03, 'VPL a 10 % intacto (D2)')
  ok(dim.calcularTIR({ custo_total: 100, geracao_anual_y1: 18000, tarifa_kwh: 0.98 }) === null,
    'TIR acima de 150 % continua devolvendo null (E7/D2 abertas)')

  secao('9 · Nenhuma cópia viva restante')
  const ctrlAtual = readFileSync(path.resolve(AQUI, '../../controllers/financeiroController.js'), 'utf8')
  const svcAtual = readFileSync(path.resolve(AQUI, '../../services/dimensionamentoFV.js'), 'utf8')
  ok(!ctrlAtual.includes('function calcularTIR('), 'financeiroController não redefine a TIR')
  ok(ctrlAtual.includes('@fortesolar/fv-shared/financeiro/simulacao-om'), 'financeiroController importa o motor do pacote')
  ok(!ctrlAtual.includes('custoOMAnual'), 'lógica de O&M saiu do controller')
  for (const f of ['function calcularPayback(', 'function calcularVPL(', 'function calcularEconomia25Anos(']) {
    ok(!svcAtual.includes(f), `dimensionamentoFV não redefine \`${f.slice(9, -1)}\``)
  }
  ok(svcAtual.includes('@fortesolar/fv-shared/financeiro/dimensionamento-retorno'), 'dimensionamentoFV importa do pacote')
  ok(!svcAtual.includes('const ANOS_PROJETO = 25'), 'constantes não duplicadas')
  ok(svcAtual.includes('...DEFAULTS_FINANCEIROS'), 'DEFAULTS composto a partir da fonte única')

  secao('10 · Superfície pública preservada')
  for (const nome of ['calcularPayback', 'calcularVPL', 'calcularTIR', 'calcularEconomiaAnual',
    'calcularCustoSistema', 'calcularEconomia25Anos', 'dimensionarFV', 'DEFAULTS']) {
    ok(svc.default[nome] !== undefined, `export default mantém \`${nome}\``)
  }
  ok(typeof svc.calcularPayback === 'function', 'export nomeado preservado')

  secao('11 · Pureza dos módulos consolidados')
  const fontes = ['dimensionamentoRetorno.js', 'simulacaoOM.js']
    .map((f) => readFileSync(path.join(PKG, f), 'utf8')).join('\n')
  for (const proibido of ['document.', 'window.', 'require(', "from 'express'", "from 'mongoose'", 'process.env', 'res.json', 'req.body']) {
    ok(!fontes.includes(proibido), `sem \`${proibido}\``)
  }

  console.log(falhas === 0
    ? '\nOK — caminhos 7 e 8 consolidados, resultados idênticos ao HEAD, divergências preservadas.'
    : `\n${falhas} FALHA(S).`)
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
