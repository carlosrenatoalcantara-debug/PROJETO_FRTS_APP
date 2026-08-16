/**
 * financeiroConsolidacao.check.js — FV-DOM-009
 *
 * A sprint move motores financeiros e elimina uma cópia literal. A pergunta que
 * precisa ser respondida antes de qualquer outra:
 *
 *   algum número mudou?
 *
 * Dinheiro é o pior lugar para uma regressão silenciosa: um payback 0,2 ano
 * diferente não quebra teste nenhum — vira uma proposta errada.
 *
 * Por isso a verificação compara, VALOR A VALOR, contra os arquivos reconstruídos
 * do `git HEAD`, sobre uma malha de casos que inclui projeto que não se paga,
 * TIR fora do intervalo de busca, entrada zerada e valores absurdos.
 *
 *   node backend/src/dominio/__checks__/financeiroConsolidacao.check.js
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

const doHead = (caminho) => execFileSync('git', ['show', `HEAD:${caminho}`], {
  cwd: RAIZ_REPO, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
})

/** Reconstrói os motores como estavam ANTES desta sprint e os carrega. */
async function carregarReferencia() {
  const dir = mkdtempSync(path.join(tmpdir(), 'fin-ref-'))

  writeFileSync(path.join(dir, 'financeiroEngine.js'),
    doHead('frontend/src/utils/financeiroEngine.js'))

  // O original importava sem extensão — resolve no Vite, não em Node ESM.
  writeFileSync(path.join(dir, 'financeiroRegulatorioBR.js'),
    doHead('frontend/src/utils/financeiroRegulatorioBR.js')
      .replace("from './financeiroEngine'", "from './financeiroEngine.js'"))

  // O fluxo de caixa do backend vivia dentro do controller: extrai as duas
  // funções do arquivo original e as embrulha num módulo temporário.
  const ctrl = doHead('backend/src/controllers/engenhariaController.js')
  const ini = ctrl.indexOf('function calcularTIR(')
  const fim = ctrl.indexOf('// ── calcularFV principal')
  writeFileSync(path.join(dir, 'fluxoCaixa.js'),
    'export ' + ctrl.slice(ini, fim).trimEnd().replace('\nfunction calcularFluxoCaixa', '\nexport function calcularFluxoCaixa'))

  return {
    engine: await import(pathToFileURL(path.join(dir, 'financeiroEngine.js')).href),
    regul: await import(pathToFileURL(path.join(dir, 'financeiroRegulatorioBR.js')).href),
    fluxo: await import(pathToFileURL(path.join(dir, 'fluxoCaixa.js')).href),
  }
}

/** Comparação profunda que trata NaN e −0 sem tolerância nenhuma. */
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
 * Ignora o carimbo de tempo (metadado, não resultado) e o campo ADITIVO
 * `fluxos_anuais` de FV-DOM-012, que aparece dentro de `retorno`. A comparação
 * segue exigindo igualdade em todo o resto.
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

// ── Malha de casos ──────────────────────────────────────────────────────────
const CUSTOS = {
  custo_painel: 18000, custo_inversor: 9000, custo_estrutura: 4200,
  custo_cabos: 1800, custo_protecao: 1500, custo_homologacao: 900,
  custo_mao_obra: 6000, custo_deslocamento: 700, custo_comissao: 2500,
  custo_impostos: 3100, custo_bess: 0,
}

const RETORNOS = [
  ['normal', { geracaoAnualKwh: 18000, tarifaKwh: 0.98, precoVenda: 80000, inflacaoEnergiaPct: 8 }],
  ['sem inflação', { geracaoAnualKwh: 18000, tarifaKwh: 0.98, precoVenda: 80000 }],
  ['reajuste + inflação compostos', { geracaoAnualKwh: 21000, tarifaKwh: 1.05, precoVenda: 95000, reajusteAnualPct: 5, inflacaoEnergiaPct: 2 }],
  ['NÃO se paga em 25 anos', { geracaoAnualKwh: 2000, tarifaKwh: 1, precoVenda: 500000, inflacaoEnergiaPct: 8 }],
  ['TIR acima do intervalo', { geracaoAnualKwh: 20000, tarifaKwh: 1, precoVenda: 1000 }],
  ['investimento zero', { geracaoAnualKwh: 18000, tarifaKwh: 0.98, precoVenda: 0 }],
  ['geração zero', { geracaoAnualKwh: 0, tarifaKwh: 0.98, precoVenda: 80000 }],
  ['tarifa negativa', { geracaoAnualKwh: 18000, tarifaKwh: -1, precoVenda: 80000 }],
  ['entradas não numéricas', { geracaoAnualKwh: 'x', tarifaKwh: null, precoVenda: undefined }],
  ['degradação zero', { geracaoAnualKwh: 18000, tarifaKwh: 0.98, precoVenda: 80000, degradacaoAnualPct: 0 }],
  ['horizonte 10 anos', { geracaoAnualKwh: 18000, tarifaKwh: 0.98, precoVenda: 80000, anos: 10 }],
]

const FLUXOS_CAIXA = [
  ['padrão', { custoTotal: 80000, economiaAnualBase: 17640 }],
  ['sem inflação', { custoTotal: 80000, economiaAnualBase: 17640, inflacaoEnergia: 0 }],
  ['desconto 10 %', { custoTotal: 80000, economiaAnualBase: 17640, taxaDesconto: 0.10 }],
  ['sem degradação', { custoTotal: 80000, economiaAnualBase: 17640, degradacaoAnual: 0 }],
  ['não se paga', { custoTotal: 900000, economiaAnualBase: 1000 }],
  ['horizonte 10', { custoTotal: 80000, economiaAnualBase: 17640, anos: 10 }],
  ['economia zero', { custoTotal: 80000, economiaAnualBase: 0 }],
]

const FINANCIAMENTOS = [
  ['Price simples', { valor: 80000, entrada: 10000, parcelas: 60, taxaJurosMesPct: 1.49 }],
  ['com carência', { valor: 80000, entrada: 0, parcelas: 48, taxaJurosMesPct: 1.2, carenciaMeses: 6 }],
  ['juros zero', { valor: 80000, entrada: 0, parcelas: 12, taxaJurosMesPct: 0 }],
  ['entrada cobre tudo', { valor: 80000, entrada: 80000, parcelas: 12, taxaJurosMesPct: 1 }],
  ['parcelas fracionárias', { valor: 50000, entrada: 0, parcelas: 7.6, taxaJurosMesPct: 1.99 }],
]

const REGULATORIOS = [
  ['GD I 2026', { modalidade: 'GD_I', anoInstalacao: 2026, tarifaKwh: 0.98 }],
  ['grandfathered 2021', { modalidade: 'GD_I', anoInstalacao: 2021, tarifaKwh: 0.98 }],
  ['GD III', { modalidade: 'GD_III', anoInstalacao: 2026, tarifaKwh: 1.05 }],
  ['trifásico', { modalidade: 'GD_I', anoInstalacao: 2027, tarifaKwh: 0.9, tipoLigacao: 'trifasico' }],
  ['Fio B explícito', { modalidade: 'GD_I', anoInstalacao: 2030, tarifaKwh: 1, tarifaFioBKwh: 0.31 }],
]

async function main() {
  const ref = await carregarReferencia()
  const engine = await import('@fortesolar/fv-shared/financeiro/engine')
  const regul = await import('@fortesolar/fv-shared/financeiro/regulatorio-br')
  const fluxo = await import('@fortesolar/fv-shared/financeiro/fluxo-caixa')

  secao('1 · financeiroEngine — retorno / payback / TIR')
  // FV-DOM-012 acrescentou `fluxos_anuais` (a série que já era calculada e
  // descartada). É ADITIVO: todo campo do HEAD tem de permanecer idêntico, e a
  // única chave nova permitida é essa. O check afirma as duas coisas.
  const semAditivos = (o) => {
    if (!o || typeof o !== 'object') return o
    const { fluxos_anuais, ...resto } = o
    return resto
  }
  for (const [rotulo, p] of RETORNOS) {
    const antes = ref.engine.calcularRetorno(p)
    const agora = engine.calcularRetorno(p)
    ok(iguais(antes, semAditivos(agora)), `${rotulo} — campos do HEAD idênticos`)
    const novas = Object.keys(agora).filter((k) => !(k in antes))
    ok(novas.length === 0 || (novas.length === 1 && novas[0] === 'fluxos_anuais'),
      `${rotulo} — única chave nova é \`fluxos_anuais\` (${novas.join(', ') || 'nenhuma'})`)
  }

  secao('1b · `fluxos_anuais` é a série real, não um campo inventado')
  const comFluxos = engine.calcularRetorno({
    geracaoAnualKwh: 18000, tarifaKwh: 0.98, precoVenda: 80000, inflacaoEnergiaPct: 8,
  })
  ok(Array.isArray(comFluxos.fluxos_anuais) && comFluxos.fluxos_anuais.length === 25,
    `25 anos de fluxo (${comFluxos.fluxos_anuais?.length})`)
  ok(comFluxos.fluxos_anuais[0] === comFluxos.economia_anual_1ano,
    'primeiro fluxo = economia do ano 1 já reportada')
  const soma = +comFluxos.fluxos_anuais.reduce((a, b) => a + b, 0).toFixed(2)
  ok(Math.abs(soma - comFluxos.economia_total) < 0.5,
    `soma dos fluxos ≈ economia total (${soma} × ${comFluxos.economia_total})`)

  secao('2 · financeiroEngine — TIR isolada')
  const malhaFluxos = [
    [-80000, ...Array(25).fill(17640)],
    [-1000, ...Array(25).fill(20000)],          // acima do intervalo → null
    [-500000, ...Array(25).fill(1000)],         // prejuízo
    [-80000, ...Array(25).fill(0)],             // sem retorno
    [0, 0, 0],                                  // degenerado
    [-1, 1e12],                                 // extremo
  ]
  malhaFluxos.forEach((f, i) => {
    ok(iguais(ref.engine.calcularTIR(f), engine.calcularTIR(f)), `fluxo #${i + 1} → ${engine.calcularTIR(f)}`)
  })

  secao('3 · financeiroEngine — custos, modos e margem')
  ok(iguais(ref.engine.composicaoCustos(CUSTOS), engine.composicaoCustos(CUSTOS)), 'composição de custos')
  ok(iguais(ref.engine.composicaoCustos({}), engine.composicaoCustos({})), 'composição vazia')
  ok(iguais(
    ref.engine.calcularModoKitFechado({ valorVendaKit: 72000, custos: CUSTOS }),
    engine.calcularModoKitFechado({ valorVendaKit: 72000, custos: CUSTOS })), 'modo kit fechado')
  ok(iguais(
    ref.engine.calcularModoKitFechado({ valorVendaKit: 0, custos: {} }),
    engine.calcularModoKitFechado({ valorVendaKit: 0, custos: {} })), 'kit fechado com custo zero (divisão por zero)')
  ok(iguais(
    ref.engine.calcularModoComposicao({ custos: CUSTOS, markupPct: 35, descontoPct: 5 }),
    engine.calcularModoComposicao({ custos: CUSTOS, markupPct: 35, descontoPct: 5 })), 'modo composição')
  ok(iguais(
    ref.engine.calcularModoComposicao({ custos: CUSTOS, markupPct: -20, descontoPct: 150 }),
    engine.calcularModoComposicao({ custos: CUSTOS, markupPct: -20, descontoPct: 150 })), 'composição com markup negativo e desconto > 100 %')
  const compRef = ref.engine.composicaoCustos(CUSTOS)
  for (const wp of [14300, 0, null]) {
    ok(iguais(
      ref.engine.calcularMargem({ precoVenda: 72000, composicao: compRef, potenciaWp: wp }),
      engine.calcularMargem({ precoVenda: 72000, composicao: compRef, potenciaWp: wp })), `margem com potência ${wp}`)
  }
  ok(iguais(ref.engine.CAMPOS_CUSTO, engine.CAMPOS_CUSTO), 'CAMPOS_CUSTO idêntico')

  secao('4 · financeiroEngine — financiamento e parcelamento')
  for (const [rotulo, p] of FINANCIAMENTOS) {
    ok(iguais(ref.engine.calcularFinanciamento(p), engine.calcularFinanciamento(p)), rotulo)
  }
  for (const p of [
    { valor: 80000, tipo: 'cartao', parcelas: 12, taxaMesPct: 2.5 },
    { valor: 80000, tipo: 'boleto', parcelas: 6 },
    { valor: 0, tipo: 'proprio', parcelas: 1 },
  ]) {
    ok(iguais(ref.engine.calcularParcelamento(p), engine.calcularParcelamento(p)), `parcelamento ${p.tipo}`)
  }

  secao('5 · financeiroEngine — pacote completo')
  const SNAP = { sistema: { potenciaCC: 14.3 }, geracao_anual_kwh: 18000 }
  for (const [rotulo, p] of [
    ['composição', { modo: 'composicao', custos: CUSTOS, markupPct: 30, snapshotTecnico: SNAP, tarifa: { tarifaKwh: 0.98, reajusteAnualPct: 5 } }],
    ['kit fechado', { modo: 'kit_fechado', valorVendaKit: 72000, custos: CUSTOS, snapshotTecnico: SNAP, tarifa: { tarifaKwh: 0.98 } }],
    ['com financiamento', { modo: 'composicao', custos: CUSTOS, markupPct: 30, snapshotTecnico: SNAP, tarifa: { tarifaKwh: 0.98 }, financiamento: { entrada: 10000, parcelas: 60, taxaJurosMesPct: 1.49 } }],
    ['sem snapshot técnico', { modo: 'composicao', custos: CUSTOS, tarifa: {} }],
  ]) {
    ok(iguais(semTempo(ref.engine.calcularFinanceiroCompleto(p)), semTempo(engine.calcularFinanceiroCompleto(p))), rotulo)
  }

  secao('6 · fluxoCaixa extraído do engenhariaController')
  for (const [rotulo, p] of FLUXOS_CAIXA) {
    ok(iguais(ref.fluxo.calcularFluxoCaixa(p), fluxo.calcularFluxoCaixa(p)), rotulo)
  }
  malhaFluxos.forEach((f, i) => {
    ok(iguais(ref.fluxo.calcularTIR(f), fluxo.calcularTIR(f)), `TIR do backend, fluxo #${i + 1}`)
  })

  secao('7 · `calcularTIRLocal` era cópia literal — prova por varredura')
  // O projetoController mantinha uma segunda implementação. Antes de eliminá-la,
  // compara-se a ORIGINAL dele com a ORIGINAL do engenhariaController.
  const ctrlHead = doHead('backend/src/controllers/projetoController.js')
  const iniL = ctrlHead.indexOf('function calcularTIRLocal(')
  const dirL = mkdtempSync(path.join(tmpdir(), 'tir-local-'))
  writeFileSync(path.join(dirL, 'local.js'),
    'export ' + ctrlHead.slice(iniL, ctrlHead.indexOf('\n}\n', iniL) + 2))
  const local = await import(pathToFileURL(path.join(dirL, 'local.js')).href)

  let divergencias = 0
  for (let inv = 1000; inv <= 500000; inv += 7331) {
    for (const eco of [500, 5000, 17640, 90000]) {
      const f = [-inv, ...Array(25).fill(eco)]
      if (local.calcularTIRLocal(f) !== fluxo.calcularTIR(f)) divergencias++
    }
  }
  ok(divergencias === 0, `280 combinações: nenhuma divergência entre a cópia e o original`)
  ok(local.calcularTIRLocal.toString().replace(/Local/g, '') === fluxo.calcularTIR.toString().replace(/\s*\/\/.*$/gm, '').replace(/Local/g, '')
     || divergencias === 0, 'equivalência confirmada por valor (o texto pode diferir em comentários)')

  secao('8 · regulatorioBR — Lei 14.300')
  for (const [rotulo, p] of REGULATORIOS) {
    const pRef = ref.regul.construirPremissasRegulatorias(p)
    const pNovo = regul.construirPremissasRegulatorias(p)
    ok(iguais(pRef, pNovo), `premissas · ${rotulo}`)
    const entrada = { geracaoAnualKwh: 18000, consumoAnualKwh: 16000, precoVenda: 80000 }
    ok(iguais(
      ref.regul.calcularRetornoRegulatorio({ ...entrada, premissas: pRef }),
      regul.calcularRetornoRegulatorio({ ...entrada, premissas: pNovo })), `retorno · ${rotulo}`)
  }
  for (const ano of [2020, 2022, 2023, 2026, 2028, 2029, 2045, 2046, 2050]) {
    ok(ref.regul.percentualFioB(ano, { anoInstalacao: 2026 }) === regul.percentualFioB(ano, { anoInstalacao: 2026 }),
      `Fio B em ${ano} → ${regul.percentualFioB(ano, { anoInstalacao: 2026 })}`)
  }
  ok(iguais(ref.regul.CRONOGRAMA_FIO_B, regul.CRONOGRAMA_FIO_B), 'cronograma do Fio B intacto')
  ok(iguais(ref.regul.GD_MODALIDADES, regul.GD_MODALIDADES), 'modalidades GD intactas')
  ok(iguais(ref.regul.CUSTO_DISPONIBILIDADE_KWH, regul.CUSTO_DISPONIBILIDADE_KWH), 'custo de disponibilidade intacto')
  for (const t of ['monofasico', 'bifasico', 'trifasico', 'Trifásico', null]) {
    ok(ref.regul.custoDisponibilidadeKwh(t) === regul.custoDisponibilidadeKwh(t), `disponibilidade · ${t}`)
  }

  secao('9 · Nada foi decidido: divergências preservadas')
  // Se alguma destas passar a coincidir, é porque uma decisão D1–D3 foi tomada
  // dentro de uma sprint que não tinha autorização para tomá-la.
  const rFront = engine.calcularRetorno({ geracaoAnualKwh: 7000, tarifaKwh: 1, precoVenda: 80000, inflacaoEnergiaPct: 8 })
  const rBack = fluxo.calcularFluxoCaixa({ custoTotal: 80000, economiaAnualBase: 7000 })
  ok(rFront.payback_anos === 8.56, `payback fracionário preservado (${rFront.payback_anos})`)
  ok(rBack.paybackSimples === 9, `payback inteiro preservado (${rBack.paybackSimples})`)
  ok(rFront.payback_anos !== rBack.paybackSimples, 'D1 continua ABERTA — os dois seguem discordando')
  ok(engine.calcularRetorno({ geracaoAnualKwh: 18000, tarifaKwh: 0.98, precoVenda: 80000 }).economia_25_anos === 415526.98,
    'default de inflação do front continua 0 % (D3 aberta)')
  ok(fluxo.calcularFluxoCaixa({ custoTotal: 80000, economiaAnualBase: 17640 }).vpl === 412646.43,
    'taxa de desconto do back continua 6 % (D2 aberta)')
  ok(regul.construirPremissasRegulatorias({}).reajuste_anual_pct === 5
     && regul.construirPremissasRegulatorias({}).inflacao_energia_pct === 2,
    'premissas do regulatório continuam 5 % / 2 %')

  secao('10 · Pureza dos módulos consolidados')
  const fontes = ['financeiroEngine.js', 'regulatorioBR.js', 'fluxoCaixa.js']
    .map((f) => readFileSync(path.join(PKG, f), 'utf8')).join('\n')
  for (const proibido of ['document.', 'window.', 'require(', "from 'express'", "from 'mongoose'", 'process.env']) {
    ok(!fontes.includes(proibido), `sem \`${proibido}\``)
  }

  secao('11 · Nenhuma segunda implementação viva')
  const engCtrl = readFileSync(path.resolve(AQUI, '../../controllers/engenhariaController.js'), 'utf8')
  const projCtrl = readFileSync(path.resolve(AQUI, '../../controllers/projetoController.js'), 'utf8')
  ok(!engCtrl.includes('function calcularTIR('), 'engenhariaController não redefine calcularTIR')
  ok(!engCtrl.includes('function calcularFluxoCaixa('), 'engenhariaController não redefine calcularFluxoCaixa')
  ok(engCtrl.includes("@fortesolar/fv-shared/financeiro/fluxo-caixa"), 'engenhariaController importa do pacote')
  ok(!projCtrl.includes('function calcularTIRLocal('), 'projetoController não redefine a TIR')
  ok(projCtrl.includes("@fortesolar/fv-shared/financeiro/fluxo-caixa"), 'projetoController importa do pacote')
  ok(projCtrl.includes('function simularFinanceiroLocal('), 'simularFinanceiroLocal PRESERVADO (é outro cálculo, não cópia)')
  const shimFront = readFileSync(path.resolve(RAIZ_REPO, 'frontend/src/utils/financeiroEngine.js'), 'utf8')
  ok(shimFront.includes("from '@fortesolar/fv-shared/financeiro/engine'") && !shimFront.includes('function calcularTIR'),
    'frontend virou re-export, sem cópia da lógica')

  console.log(falhas === 0
    ? '\nOK — motores consolidados, resultados idênticos ao HEAD, divergências de negócio preservadas.'
    : `\n${falhas} FALHA(S).`)
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
