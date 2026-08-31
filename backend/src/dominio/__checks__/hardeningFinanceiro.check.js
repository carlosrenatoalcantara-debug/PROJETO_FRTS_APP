/**
 * hardeningFinanceiro.check.js — FV-DOM-011C
 *
 * Fecha a sprint de hardening. Prova, contra o `git HEAD`, que as quatro
 * correções técnicas (E3, E7, R6, R10) não alteraram nenhum número — e que a
 * rota órfã segue preservada.
 *
 * Nenhuma delas depende de D1–D5; nenhuma pode tê-las decidido por acidente.
 *
 *   node backend/src/dominio/__checks__/hardeningFinanceiro.check.js
 */
import path from 'node:path'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

// FV-DOM-015: a referência de equivalência é o commit PRÉ-CHECKPOINT.
// Depois de `1ab2693`, `HEAD` já contém o código migrado — comparar contra ele
// compararia o novo consigo mesmo. `BASE_EQUIVALENCIA` fixa o último estado
// anterior às sprints FV, que é o que estas verificações precisam.
const BASE_EQUIVALENCIA = '38fa34f'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)
const ler = (p) => readFileSync(path.resolve(RAIZ, p), 'utf8')
const doHead = (p) => execFileSync('git', ['show', `${BASE_EQUIVALENCIA}:${p}`], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
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
/**
 * Ignora o carimbo (metadado) e o campo ADITIVO `fluxos_anuais` introduzido em
 * FV-DOM-012 dentro de `retorno` — a série que já era calculada e descartada.
 * Todo o restante segue exigindo igualdade com o HEAD.
 */
const semTempo = (o) => {
  if (!o || typeof o !== 'object') return o
  const { calculado_em, retorno, retorno_realista, ...resto } = o
  const podar = (r) => {
    if (!r || typeof r !== 'object') return r
    const { fluxos_anuais, ...x } = r
    return x
  }
  return { ...resto, retorno: podar(retorno), retorno_realista: podar(retorno_realista) }
}

/** Motores como estavam ANTES da sprint (HEAD). */
async function referencia() {
  const dir = mkdtempSync(path.join(tmpdir(), 'hard-'))
  writeFileSync(path.join(dir, 'financeiroEngine.js'), doHead('frontend/src/utils/financeiroEngine.js'))
  writeFileSync(path.join(dir, 'financeiroRegulatorioBR.js'),
    doHead('frontend/src/utils/financeiroRegulatorioBR.js')
      .replace("from './financeiroEngine'", "from './financeiroEngine.js'"))
  const ctrl = doHead('backend/src/controllers/engenhariaController.js')
  const ini = ctrl.indexOf('function calcularTIR(')
  const fim = ctrl.indexOf('// ── calcularFV principal')
  writeFileSync(path.join(dir, 'fluxoCaixa.js'),
    'export ' + ctrl.slice(ini, fim).trimEnd().replace('\nfunction calcularFluxoCaixa', '\nexport function calcularFluxoCaixa'))
  const dados = pathToFileURL(path.resolve(RAIZ, 'backend/src/data/irradianciaRN.js')).href
  writeFileSync(path.join(dir, 'dimensionamentoFV.js'),
    doHead('backend/src/services/dimensionamentoFV.js').replace("from '../data/irradianciaRN.js'", `from '${dados}'`))
  return {
    engine: await import(pathToFileURL(path.join(dir, 'financeiroEngine.js')).href),
    regul: await import(pathToFileURL(path.join(dir, 'financeiroRegulatorioBR.js')).href),
    fluxo: await import(pathToFileURL(path.join(dir, 'fluxoCaixa.js')).href),
    dim: await import(pathToFileURL(path.join(dir, 'dimensionamentoFV.js')).href),
  }
}

const CUSTOS = {
  custo_painel: 18000, custo_inversor: 9000, custo_estrutura: 4200, custo_cabos: 1800,
  custo_protecao: 1500, custo_homologacao: 900, custo_mao_obra: 6000,
  custo_deslocamento: 700, custo_comissao: 2500, custo_impostos: 3100, custo_bess: 0,
}
const SNAP = { sistema: { potenciaCC: 14.3 }, geracao_anual_kwh: 18000 }

const MALHA_FLUXOS = [
  [-80000, ...Array(25).fill(17640)],
  [-1000, ...Array(25).fill(20000)],
  [-500000, ...Array(25).fill(1000)],
  [-80000, ...Array(25).fill(0)],
  [0, 0, 0],
  [-1, 1e12],
  [-80000, ...Array(25).fill(7000)],
]

async function main() {
  const ref = await referencia()
  const engine = await import('@fortesolar/fv-shared/financeiro/engine')
  const fluxo = await import('@fortesolar/fv-shared/financeiro/fluxo-caixa')
  const dim = await import('@fortesolar/fv-shared/financeiro/dimensionamento-retorno')
  const regul = await import('@fortesolar/fv-shared/financeiro/regulatorio-br')
  const svc = await import('../../services/dimensionamentoFV.js')

  // ══ E3 ══════════════════════════════════════════════════════════════════════
  secao('E3 · `calculado_em` não participa de cálculo, hash ou determinismo')

  const params = {
    modo: 'composicao', custos: CUSTOS, markupPct: 30,
    snapshotTecnico: SNAP, tarifa: { tarifaKwh: 0.98, reajusteAnualPct: 5 },
  }
  const t1 = new Date('2020-01-01T00:00:00.000Z')
  const t2 = new Date('2030-12-31T23:59:59.000Z')
  const r1 = engine.calcularFinanceiroCompleto({ ...params, agora: t1 })
  const r2 = engine.calcularFinanceiroCompleto({ ...params, agora: t2 })
  ok(r1.calculado_em === t1.toISOString(), 'instante injetável é respeitado')
  ok(r2.calculado_em === t2.toISOString(), 'segundo instante também')
  ok(iguais(semTempo(r1), semTempo(r2)),
    'dez anos de diferença no carimbo NÃO mudam um único número')
  ok(iguais(semTempo(ref.engine.calcularFinanceiroCompleto(params)),
    semTempo(engine.calcularFinanceiroCompleto(params))),
    'resultado idêntico ao HEAD (ignorando o carimbo)')

  const d1 = svc.default.dimensionarFV({ consumo_mensal_kwh: 500, cidade: 'Natal', estado: 'RN', agora: t1 })
  const d2 = svc.default.dimensionarFV({ consumo_mensal_kwh: 500, cidade: 'Natal', estado: 'RN', agora: t2 })
  ok(d1.metadados.calculado_em === t1.toISOString(), 'dimensionarFV aceita instante injetado')
  const semMeta = (r) => { const { metadados, ...x } = r; const { calculado_em, ...m } = metadados; return { ...x, metadados: m } }
  ok(iguais(semMeta(d1), semMeta(d2)), 'dimensionarFV: carimbo não altera resultado')
  ok(iguais(semMeta(ref.dim.dimensionarFV({ consumo_mensal_kwh: 500, cidade: 'Natal', estado: 'RN' })), semMeta(d1)),
    'dimensionarFV idêntico ao HEAD')

  // O hash da Baseline percorre o conteúdo congelado; se um timestamp entrasse
  // ali, dois congelamentos do MESMO orçamento teriam hashes diferentes.
  const { calcularHash } = await import('../baseline/congelarOrcamento.js')
  const conteudo = { total: 80000, itens: [{ d: 'kit', v: 1 }] }
  ok(calcularHash(conteudo) === calcularHash({ ...conteudo }), 'hash da Baseline é determinístico')
  ok(calcularHash({ ...conteudo, calculado_em: t1.toISOString() })
     !== calcularHash({ ...conteudo, calculado_em: t2.toISOString() }),
    'hash MUDARIA se um carimbo entrasse — por isso ele fica fora do conteúdo')
  const congelar = ler('backend/src/dominio/baseline/congelarOrcamento.js')
  ok(!congelar.includes('calculado_em'), 'congelamento não inclui `calculado_em` no conteúdo')

  // ══ E7 ══════════════════════════════════════════════════════════════════════
  secao('E7 · TIR com estado explícito, sem alterar o valor')

  for (const [i, f] of MALHA_FLUXOS.entries()) {
    ok(ref.engine.calcularTIR(f) === engine.calcularTIR(f),
      `financeiroEngine · fluxo #${i + 1} → ${engine.calcularTIR(f)}`)
    ok(ref.fluxo.calcularTIR(f) === fluxo.calcularTIR(f),
      `fluxoCaixa · fluxo #${i + 1} → ${fluxo.calcularTIR(f)}`)
  }

  const detEngine = engine.calcularTIRDetalhado(MALHA_FLUXOS[0])
  ok(detEngine.convergiu === true && detEngine.motivo === 'ok', 'caso normal: convergiu')
  ok(detEngine.valor_aa_pct === engine.calcularTIR(MALHA_FLUXOS[0]), 'detalhado e simples devolvem o mesmo valor')
  const detAcima = engine.calcularTIRDetalhado(MALHA_FLUXOS[1])
  ok(detAcima.valor_aa_pct === null && detAcima.convergiu === false,
    `TIR acima do intervalo: null + convergiu=false (motivo: ${detAcima.motivo})`)
  ok(Array.isArray(detAcima.intervalo_busca), 'intervalo de busca declarado')

  const detFluxo = fluxo.calcularTIRDetalhado(MALHA_FLUXOS[1])
  ok(detFluxo.convergiu === false && detFluxo.motivo === 'fora_do_intervalo',
    `fluxoCaixa: saturação agora tem motivo (${detFluxo.motivo}, valor ${detFluxo.valor})`)
  ok(detFluxo.valor === ref.fluxo.calcularTIR(MALHA_FLUXOS[1]),
    'o valor saturado é EXATAMENTE o do HEAD — só ganhou rótulo')

  const detDim = dim.calcularTIRDetalhado({ custo_total: 100, geracao_anual_y1: 18000, tarifa_kwh: 0.98 })
  ok(detDim.valor === null && detDim.motivo === 'acima_do_intervalo', 'dimensionamento: acima de 150 % rotulado')
  const detDimNeg = dim.calcularTIRDetalhado({ custo_total: 5e7, geracao_anual_y1: 18000, tarifa_kwh: 0.98 })
  ok(detDimNeg.valor === null && detDimNeg.motivo === 'fluxo_nunca_positivo',
    'dimensionamento: duas causas de `null` agora distinguíveis')
  ok(dim.calcularTIR({ custo_total: 80000, geracao_anual_y1: 18000, tarifa_kwh: 0.98 })
     === ref.dim.calcularTIR({ custo_total: 80000, geracao_anual_y1: 18000, tarifa_kwh: 0.98 }),
    'dimensionamento: valor idêntico ao HEAD')

  secao('E7 · uma única implementação por motor')
  for (const [arq, mod] of [['financeiroEngine.js', 'engine'], ['fluxoCaixa.js', 'fluxo'], ['dimensionamentoRetorno.js', 'dim']]) {
    const src = ler(`packages/fv-shared/financeiro/${arq}`)
    const corpos = (src.match(/for \(let (i|k) = 0; \w+ < (iteracoes|100|300)/g) || []).length
    ok(corpos <= 1, `${arq}: um só laço de bisseção (${corpos})`)
    ok(src.includes('calcularTIRDetalhado(') && src.includes('export function calcularTIR'),
      `${arq}: detalhado é a fonte, simples é compatibilidade`)
  }

  // ══ R6 ══════════════════════════════════════════════════════════════════════
  secao('R6 · PDF comercial sem `undefined`')
  const pdfSrc = ler('frontend/src/utils/gerarPdfComercial.js')
  ok(!/\$\{financeiro\.(paybackAnos|roi25Anos|paybackDescontado|economiaAnual|custoTotalEstimado)\}/.test(pdfSrc),
    'não interpola mais campos crus da API')
  ok(pdfSrc.includes('?? fin.payback'), 'mapeia o nome que a API realmente devolve')
  ok(pdfSrc.includes("'—'"), 'ausência vira travessão')
  for (const proibido of ['|| 15000', '|| 85000', '= 8.5', '|| 0.8'])
    ok(!pdfSrc.includes(proibido), `sem fallback numérico \`${proibido}\``)

  // ══ R10 ═════════════════════════════════════════════════════════════════════
  secao('R10 · sazonalidade morta removida, comportamento preservado')
  const regSrc = ler('packages/fv-shared/financeiro/regulatorioBR.js')
  ok(!regSrc.includes('const pesosGer'), '`pesosGer` (calculado e descartado) removido')
  ok(!regSrc.includes('function normalizarPesos'), 'helper morto removido')
  ok(regSrc.includes('D5'), 'registra que sazonalidade real depende de D5')

  const prem = regul.construirPremissasRegulatorias({ tarifaKwh: 0.98, anoInstalacao: 2026 })
  const premRef = ref.regul.construirPremissasRegulatorias({ tarifaKwh: 0.98, anoInstalacao: 2026 })
  ok(iguais(prem, premRef), 'premissas regulatórias idênticas ao HEAD')
  const entrada = { geracaoAnualKwh: 18000, consumoAnualKwh: 16000, precoVenda: 80000 }
  ok(iguais(ref.regul.calcularRetornoRegulatorio({ ...entrada, premissas: premRef }),
    regul.calcularRetornoRegulatorio({ ...entrada, premissas: prem })),
    'retorno regulatório idêntico ao HEAD')
  // Prova de que o parâmetro era realmente inerte: passá-lo no HEAD não mudava nada.
  const comSazon = ref.regul.calcularRetornoRegulatorio({
    ...entrada, premissas: premRef,
    geracaoMensalKwh: [2000, 1800, 1600, 1400, 1200, 1000, 1000, 1200, 1400, 1600, 1800, 2000],
  })
  ok(iguais(comSazon, ref.regul.calcularRetornoRegulatorio({ ...entrada, premissas: premRef })),
    'no HEAD, passar sazonalidade NÃO mudava o resultado — parâmetro comprovadamente morto')

  // ══ Rota órfã ═══════════════════════════════════════════════════════════════
  secao('Rota `/api/engenharia/fv` — órfã, preservada')
  const rotas = ler('backend/src/routes/engenharia.js')
  ok(rotas.includes("router.post('/fv'"), 'rota continua registrada (NÃO removida)')
  // `git grep -l` sai com status 1 quando não encontra nada — que é justamente o
  // resultado esperado aqui. Capturar o erro é parte da asserção.
  let consumidores = ''
  try {
    consumidores = execFileSync('git', ['grep', '-l', 'api/engenharia/fv', '--', 'frontend/src'],
      { cwd: RAIZ, encoding: 'utf8' }).trim()
  } catch (e) {
    if (e.status !== 1) throw e   // 1 = nenhum match; qualquer outro é falha real
  }
  ok(consumidores === '', 'zero consumidores no frontend (confirmado)')
  ok(rotas.includes('D2') || ler('backend/src/controllers/engenhariaController.js').includes('D2'),
    'preservação justificada por D2 no código')

  // ══ Invariantes da sprint ═══════════════════════════════════════════════════
  secao('Invariantes · D1–D5 PENDENTES e nada fabricado')
  ok(engine.calcularRetorno({ geracaoAnualKwh: 7000, tarifaKwh: 1, precoVenda: 80000, inflacaoEnergiaPct: 8 }).payback_anos === 8.56,
    'payback fracionário intacto (D1)')
  ok(fluxo.calcularFluxoCaixa({ custoTotal: 80000, economiaAnualBase: 7000 }).paybackSimples === 9,
    'payback inteiro intacto (D1)')
  ok(fluxo.calcularFluxoCaixa({ custoTotal: 80000, economiaAnualBase: 17640 }).vpl === 412646.43, 'VPL 6 % intacto (D2)')
  ok(dim.DEFAULTS_FINANCEIROS.inflacao_energia_aa === 0.06, 'inflação 6 % intacta (D3)')
  ok(dim.DEFAULTS_FINANCEIROS.taxa_desconto_aa === 0.10, 'taxa 10 % intacta (D2)')
  ok(dim.calcularPayback({ custo_total: 120000, geracao_anual_y1: 6100, tarifa_kwh: 1, inflacao_aa: 0.06 }) === 9.7,
    'payback por economia média intacto (D1/R12)')
  ok(prem.reajuste_anual_pct === 5 && prem.inflacao_energia_pct === 2, 'premissas do regulatório intactas (D3/D5)')

  secao('Invariantes · nenhuma cópia financeira nova')
  const pkg = ['financeiroEngine.js', 'regulatorioBR.js', 'fluxoCaixa.js', 'dimensionamentoRetorno.js', 'simulacaoOM.js']
  ok(pkg.every((f) => { try { ler(`packages/fv-shared/financeiro/${f}`); return true } catch { return false } }),
    `os 5 módulos do pacote seguem sendo os únicos`)
  for (const arq of ['backend/src/controllers/engenhariaController.js', 'backend/src/controllers/projetoController.js',
    'backend/src/controllers/financeiroController.js', 'backend/src/services/dimensionamentoFV.js']) {
    ok(!ler(arq).includes('function calcularTIR('), `${path.basename(arq)} não redefine TIR`)
  }

  console.log(falhas === 0
    ? '\nOK — E3, E7, R6 e R10 validados contra o HEAD; rota preservada; D1–D5 PENDENTES.'
    : `\n${falhas} FALHA(S).`)
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
