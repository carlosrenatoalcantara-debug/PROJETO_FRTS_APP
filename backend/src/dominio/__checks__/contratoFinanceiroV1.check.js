/**
 * contratoFinanceiroV1.check.js — FV-DOM-012
 *
 * Prova que o contrato financeiro V1 implementa D1 e D2 sem decidir D3.
 *
 *   D1  payback acumulado FRACIONÁRIO oficial + inteiro secundário
 *   D2  VPL obrigatório · TMA nominal 10 % a.a. versionada
 *   D3  PENDENTE — nenhum valor de inflação é assumido em lugar nenhum
 *
 *   node backend/src/dominio/__checks__/contratoFinanceiroV1.check.js
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
  nome: 'Projeto Contrato',
  dimensionamento: { potencia_kwp: 14.3, geracao_anual_kwh: 18000 },
  fatura_extracao: { tarifa_kwh: 0.98, media_anual_kwh: 16000 },
}
// FV-UX-017: o agregado `Orcamento` NÃO persiste `total_r` (INV-58) — o total é
// DERIVADO dos itens. O fixture antigo usava um campo que nunca existe, o que
// mascarava a lacuna permanente de investimento em todo projeto.
const ORCAMENTO = {
  reajuste_anual_pct: 0,
  itens: [
    { descricao: 'Kit', tipo: 'material', quantidade: 1, valor_unitario_r: 62000 },
    { descricao: 'Instalação', tipo: 'servico', quantidade: 1, valor_unitario_r: 18000 },
  ],
}

async function main() {
  const C = await import('@fortesolar/fv-shared/financeiro/contrato-v1')
  const { calcularRetorno } = await import('@fortesolar/fv-shared/financeiro/engine')
  const dominio = await import('../financeiro/index.js')

  secao('1 · D2 — TMA nominal de 10 % a.a., versionada')
  const prem = C.premissasDaVersao()
  ok(prem.taxa_desconto_aa_pct === 10, `TMA = 10 % (${prem.taxa_desconto_aa_pct})`)
  ok(prem.natureza_taxa === 'nominal', 'taxa declarada como NOMINAL (fluxo também é nominal)')
  ok(prem.versao === 'v1-2026-08' && !!prem.vigencia_inicio, 'premissas versionadas com vigência')
  ok(Object.isFrozen(C.PREMISSAS_VERSOES['v1-2026-08']), 'conjunto congelado — não muda em runtime')
  let erro = null
  try { C.premissasDaVersao('v9-inexistente') } catch (e) { erro = e }
  ok(erro !== null, 'versão desconhecida é erro, não fallback silencioso')

  secao('2 · D2 — VPL obrigatório, com a TMA da versão')
  const base = {
    entradas: { investimento_r: 80000, geracao_anual_kwh: 18000, potencia_wp: 14300 },
    premissas: { tarifa_kwh: 0.98, inflacao_energia_aa_pct: 8 },
  }
  const r = C.calcularContratoV1(base)
  ok(r.vpl != null && typeof r.vpl.valor_r === 'number', `VPL calculado (${r.vpl?.valor_r})`)
  ok(r.vpl.taxa_aa_pct === 10, 'VPL carimba a taxa usada')
  const fluxos = [-80000, ...calcularRetorno({
    geracaoAnualKwh: 18000, tarifaKwh: 0.98, precoVenda: 80000, inflacaoEnergiaPct: 8,
  }).fluxos_anuais]
  const manual = fluxos.reduce((a, f, t) => a + f / Math.pow(1.10, t), 0)
  ok(Math.abs(r.vpl.valor_r - manual) < 0.01, 'VPL confere com o desconto manual a 10 %')
  ok(r.payback_descontado?.anos != null, `payback descontado presente (${r.payback_descontado?.anos})`)

  secao('3 · D1 — fracionário oficial, inteiro secundário')
  ok(r.payback.convencao === 'fracionario', 'convenção declarada')
  const esperado = calcularRetorno({
    geracaoAnualKwh: 18000, tarifaKwh: 0.98, precoVenda: 80000, inflacaoEnergiaPct: 8,
  }).payback_anos
  ok(r.payback.anos === esperado, `fracionário = motor existente (${r.payback.anos})`)
  ok(r.payback.anos_inteiro === Math.ceil(esperado), `inteiro = teto do fracionário (${r.payback.anos_inteiro})`)
  ok(r.payback.dentro_horizonte === true, 'dentro do horizonte declarado')

  // O inteiro derivado tem de bater com o motor que já calculava inteiro.
  const { calcularFluxoCaixa } = await import('@fortesolar/fv-shared/financeiro/fluxo-caixa')
  for (const [inv, eco] of [[80000, 7000], [120000, 6100], [200000, 5000], [60000, 9000]]) {
    const frac = calcularRetorno({ geracaoAnualKwh: eco, tarifaKwh: 1, precoVenda: inv, inflacaoEnergiaPct: 8 }).payback_anos
    const inteiroMotor = calcularFluxoCaixa({ custoTotal: inv, economiaAnualBase: eco }).paybackSimples
    ok(C.paybackInteiroDe(frac) === inteiroMotor,
      `inteiro derivado = inteiro do fluxoCaixa (${inv}/${eco}: ${C.paybackInteiroDe(frac)})`)
  }

  secao('4 · D3 PENDENTE — nenhuma inflação assumida')
  ok(prem.inflacao_energia_aa_pct === null, 'premissa de inflação é null na versão vigente')
  const semInfl = C.calcularContratoV1({ entradas: base.entradas, premissas: { tarifa_kwh: 0.98 } })
  ok(semInfl.lacunas.includes('inflacao_energia_aa_pct'), 'sem inflação → lacuna declarada')
  ok(semInfl.vpl === null && semInfl.payback.anos === null && semInfl.economia === null,
    'indicadores dependentes vêm null — nenhum número inventado')
  ok(semInfl.tir.valor_aa_pct === null && semInfl.tir.convergiu === false,
    `TIR também null, com motivo (${semInfl.tir.motivo})`)
  const fonte = ler('packages/fv-shared/financeiro/contratoV1.js')
  for (const proibido of ['inflacao_energia_aa_pct: 6', 'inflacao_energia_aa_pct: 8', 'inflacao_energia_aa_pct = 6', '?? 8', '|| 8', '|| 6'])
    ok(!fonte.includes(proibido), `contrato sem default de inflação \`${proibido}\``)
  const adapterSrc = ler('backend/src/dominio/financeiro/index.js')
  ok(!/inflacao[^\n]*(\|\||\?\?)\s*[0-9]/.test(adapterSrc), 'adapter também não injeta default de inflação')

  secao('5 · D5 pendente — nenhum cenário regulatório escolhido')
  ok(r.regulatorio.aplicavel === false && r.regulatorio.cenario_oficial === null,
    `regulatório declarado pendente (${r.regulatorio.motivo})`)

  secao('6 · E3 — determinismo: carimbo fora do cálculo')
  const t1 = new Date('2020-01-01T00:00:00.000Z')
  const t2 = new Date('2030-12-31T23:59:59.000Z')
  const a = C.calcularContratoV1({ ...base, agora: t1 })
  const b = C.calcularContratoV1({ ...base, agora: t2 })
  ok(a.calculado_em === t1.toISOString(), 'instante injetável')
  const sem = (o) => { const { calculado_em, ...x } = o; return JSON.stringify(x) }
  ok(sem(a) === sem(b), 'dez anos de diferença não mudam um único número')
  ok(sem(C.calcularContratoV1(base)) === sem(a), 'duas execuções → mesmo resultado')

  secao('7 · E7 — TIR detalhada')
  ok(r.tir.convergiu === true && r.tir.motivo === 'ok', 'caso normal converge')
  ok(Array.isArray(r.tir.intervalo_busca), 'intervalo de busca declarado')
  const tirAlta = C.calcularContratoV1({
    entradas: { investimento_r: 1000, geracao_anual_kwh: 18000 },
    premissas: { tarifa_kwh: 0.98, inflacao_energia_aa_pct: 8 },
  })
  ok(tirAlta.tir.valor_aa_pct === null && tirAlta.tir.convergiu === false,
    `TIR fora do intervalo é explícita (${tirAlta.tir.motivo})`)

  secao('8 · Lacunas por entrada ausente')
  for (const [campo, entradas] of [
    ['investimento_r', { geracao_anual_kwh: 18000 }],
    ['geracao_anual_kwh', { investimento_r: 80000 }],
  ]) {
    const x = C.calcularContratoV1({ entradas, premissas: { tarifa_kwh: 1, inflacao_energia_aa_pct: 8 } })
    ok(x.lacunas.includes(campo), `${campo} ausente → lacuna`)
    ok(x.vpl === null, `${campo} ausente → VPL null`)
  }
  const semTarifa = C.calcularContratoV1({ entradas: base.entradas, premissas: { inflacao_energia_aa_pct: 8 } })
  ok(semTarifa.lacunas.includes('tarifa_kwh'), 'tarifa ausente → lacuna')

  secao('9 · Adapter de domínio — proveniência e engineering lock')
  const { entradas, premissas, proveniencia } = dominio.adaptarProjetoParaFinanceiro(PROJETO, { orcamento: ORCAMENTO })
  ok(entradas.investimento_r === 80000, 'investimento vem do orçamento canônico')
  ok(proveniencia.investimento_r === 'orcamento.itens (derivado)',
    `proveniência declara a derivação (${proveniencia.investimento_r})`)
  ok(entradas.potencia_wp === 14300, 'kWp convertido para Wp')
  ok(premissas.inflacao_energia_aa_pct === null, 'sem inflação no projeto → null, não default')
  ok(proveniencia.inflacao_energia_aa_pct === null, 'proveniência de inflação = ausente')
  ok(proveniencia.engineering_lock === 'dados_atuais', 'origem da geração declarada')

  const comSnapshot = dominio.adaptarProjetoParaFinanceiro({
    ...PROJETO,
    governanca: { snapshot_tecnico: { geracao_anual_kwh: 17000, sistema: { potenciaCC: 13.9 } } },
  }, { orcamento: ORCAMENTO })
  ok(comSnapshot.entradas.geracao_anual_kwh === 17000, 'snapshot técnico TEM precedência (engineering lock)')
  ok(comSnapshot.proveniencia.engineering_lock === 'snapshot_tecnico', 'lock declarado')

  secao('10 · Nenhuma persistência, nenhuma segunda fórmula')
  const domSrc = ler('backend/src/dominio/financeiro/index.js')
  for (const p of ['save(', 'updateOne', 'findOneAndUpdate', 'insertMany'])
    ok(!domSrc.includes(p), `domínio não persiste (\`${p}\`)`)
  ok(!domSrc.includes("from 'mongoose'"), 'adapter não importa mongoose')
  ok(!/Math\.pow\(1 \+/.test(domSrc), 'adapter não contém fórmula financeira')
  ok(fonte.includes("from './financeiroEngine.js'"), 'contrato COMPÕE o motor existente')
  ok(!/for \(let ano = 1; ano <= anos/.test(fonte), 'contrato não reimplementa o laço de fluxo')

  secao('11 · Endpoint — tenant, sem input do cliente, sem persistir')
  const ctrl = ler('backend/src/controllers/agregadosFvController.js')
  const i = ctrl.indexOf('export const calcularFinanceiro')
  const trecho = ctrl.slice(i, i + 1600)
  ok(trecho.includes('projetoNoEscopo'), 'valida tenant/posse via projetoNoEscopo')
  ok(trecho.includes('aplicarEscopo'), 'releitura também com escopo')
  ok(trecho.includes('OrcamentoService.vigenteDoProjeto'), 'investimento do orçamento canônico')
  ok(!trecho.includes('req.body'), 'IGNORA o corpo — cliente não fornece totais')
  for (const p of ['save(', 'updateOne', 'findOneAndUpdate'])
    ok(!trecho.includes(p), `endpoint não persiste (\`${p}\`)`)
  const rotas = ler('backend/src/routes/projetosFV.js')
  ok(rotas.includes("router.post('/:id/financeiro/calcular'"), 'rota registrada')

  secao('12 · Isolamento de tenant — em banco real')
  const mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  const { ProjetoFV } = await import('../../models/ProjetoFV.js')
  const empA = new mongoose.Types.ObjectId()
  const empB = new mongoose.Types.ObjectId()
  const pA = await ProjetoFV.create({ nome: 'A', empresa_id: empA, clienteId: new mongoose.Types.ObjectId() })

  const { aplicarEscopo } = await import('../tenancy/index.js')
  const reqB = { auth: { empresa_id: String(empB), perfil: 'admin' }, params: { id: String(pA._id) } }
  const achado = await ProjetoFV.findOne(aplicarEscopo({ _id: pA._id }, reqB, { contexto: 'check' })).lean()
  ok(achado === null, 'Tenant B NÃO enxerga projeto do Tenant A (→ 404 no endpoint)')

  const reqA = { auth: { empresa_id: String(empA), perfil: 'admin' }, params: { id: String(pA._id) } }
  const seuA = await ProjetoFV.findOne(aplicarEscopo({ _id: pA._id }, reqA, { contexto: 'check' })).lean()
  ok(seuA !== null, 'Tenant A enxerga o próprio projeto')
  const semAuth = { params: { id: String(pA._id) } }
  let bloqueou = false
  try {
    await ProjetoFV.findOne(aplicarEscopo({ _id: pA._id }, semAuth, { contexto: 'check' })).lean()
  } catch { bloqueou = true }
  ok(bloqueou, 'sem autenticação → fail-closed')
  await mongoose.disconnect(); await mongod.stop()

  secao('13 · Superfícies não migradas continuam intactas')
  const dim = await import('@fortesolar/fv-shared/financeiro/dimensionamento-retorno')
  ok(calcularFluxoCaixa({ custoTotal: 80000, economiaAnualBase: 17640 }).vpl === 412646.43,
    'fluxoCaixa segue com VPL a 6 % (migração é FV-DOM-013)')
  ok(dim.DEFAULTS_FINANCEIROS.taxa_desconto_aa === 0.10, 'dimensionamento segue com 10 %')
  ok(dim.DEFAULTS_FINANCEIROS.inflacao_energia_aa === 0.06, 'inflação 6 % do dimensionamento intacta (D3)')
  ok(dim.calcularPayback({ custo_total: 120000, geracao_anual_y1: 6100, tarifa_kwh: 1, inflacao_aa: 0.06 }) === 9.7,
    'payback por economia média intacto (D1/R12 — FV-DOM-013)')
  ok(calcularRetorno({ geracaoAnualKwh: 18000, tarifaKwh: 0.98, precoVenda: 80000 }).economia_25_anos === 415526.98,
    'financeiroEngine sem inflação continua idêntico (aditivo não mudou números)')

  secao('14 · Sem cópia do contrato no frontend')
  let copias = ''
  try {
    const { execFileSync } = await import('node:child_process')
    copias = execFileSync('git', ['grep', '-l', 'calcularContratoV1', '--', 'frontend/src'],
      { cwd: RAIZ, encoding: 'utf8' }).trim()
  } catch (e) { if (e.status !== 1) throw e }
  ok(copias === '', 'nenhum consumidor do contrato no frontend (a UX consome a API)')

  console.log(falhas === 0
    ? '\nOK — contrato V1 com D1 e D2; D3 e D5 pendentes e não assumidas.'
    : `\n${falhas} FALHA(S).`)
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
