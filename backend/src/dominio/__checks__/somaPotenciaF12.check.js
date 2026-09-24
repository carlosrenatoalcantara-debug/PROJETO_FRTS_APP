/**
 * somaPotenciaF12.check.js — F12.
 *
 * Trava a regra que este sprint restaurou na agregação de potência:
 *
 *   ausência ≠ zero · inválido ≠ zero · parcial ≠ total
 *
 * O defeito era `Number(x) || 0` dentro de um `reduce`. Sozinho parece
 * inofensivo; num somatório ele converte lacuna em número e o total sai
 * plausível. Medido no acervo: 12 de 13 projetos com `arranjos[]` exibiam
 * potência parcial como se fosse completa.
 *
 * Há uma armadilha específica que este guard também cobre, porque eu caí nela
 * ao escrever a correção: `Number(null)` é `0` e `Number.isFinite(0)` é `true`.
 * Testar presença com `Number.isFinite(Number(x))` reintroduz exatamente o bug.
 *
 *   node backend/src/dominio/__checks__/somaPotenciaF12.check.js
 */
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  potenciaPaineisKwp, potenciaInversoresKw, calcularTotaisProjeto, potenciaTotalKwp,
} from '../../services/arranjosService.js'
import { totaisTopologia } from '../topologia/derivadosTopologia.js'
import { compradaDoProjeto, MOTIVOS_POTENCIA } from '../potencia/index.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const ler = (rel) => semComentarios(readFileSync(path.resolve(RAIZ, rel), 'utf8'))

const p = (q, w) => ({ potencia_w: w, quantidade: q })
const arranjo = (id, paineis, inversores = []) => ({ id, paineis, inversores })

secao('1 · Ausência de potência NÃO vira zero')
ok(potenciaPaineisKwp([p(14, null)]) === null, '14 módulos sem potência → null, não 0')
ok(potenciaPaineisKwp([p(14, undefined)]) === null, 'undefined idem')
ok(potenciaPaineisKwp([p(14, '')]) === null, 'string vazia idem')
ok(potenciaInversoresKw([{ potencia_kw: null, quantidade: 1 }]) === null, 'e no lado CA também')

secao('2 · Agregação parcial NÃO é apresentada como total')
ok(potenciaPaineisKwp([p(6, 585), p(4, null)]) === null,
  '6 conhecidos + 4 ausentes → null (a soma dos 6 seria 3,51)')
const doisArranjos = { arranjos: [arranjo('A', [p(14, 585)]), arranjo('B', [p(10, null)])] }
const t = calcularTotaisProjeto(doisArranjos)
ok(t.potencia_total_kwp === null, 'dois arranjos, um incompleto → total null')
ok(t.potencia_total_kwp !== 8.19, 'e NUNCA o valor só do arranjo completo')
// Sanidade: o cenário precisa de fato exercitar a soma, senão o guard passa vazio.
ok(t.n_modulos_total === 24, 'sanidade — a contagem soma os 24 módulos (F-01 intacta)')

secao('3 · Potência inválida não é somada')
for (const [rotulo, v] of [['texto', 'abc'], ['negativa', -585], ['objeto', {}], ['NaN', NaN]]) {
  ok(potenciaPaineisKwp([p(10, v)]) === null, `potência ${rotulo} → null`)
}
ok(potenciaPaineisKwp([p(-3, 585)]) === null, 'quantidade negativa → null')
ok(potenciaPaineisKwp([p(null, 585)]) === null, 'quantidade ausente → null')

secao('4 · Completo continua completo — a correção não quebrou o caminho feliz')
ok(potenciaPaineisKwp([p(14, 585)]) === 8.19, '14 × 585 W = 8,19 kWp')
ok(calcularTotaisProjeto({ arranjos: [arranjo('A', [p(14, 585)]), arranjo('B', [p(10, 585)])] })
  .potencia_total_kwp === 14.04, 'dois arranjos completos → 14,04 kWp')
ok(potenciaInversoresKw([{ potencia_kw: 60, quantidade: 1 }, { potencia_kw: 50, quantidade: 1 }]) === 110,
  'e o lado CA soma 60 + 50 = 110 kW')
// Arranjo sem painéis é ausência de composição, não lacuna de dado.
ok(calcularTotaisProjeto({ arranjos: [arranjo('A', [p(14, 585)]), arranjo('B', [])] })
  .potencia_total_kwp === 8.19, 'arranjo vazio não contamina o total')

secao('5 · A ausência diz POR QUÊ — e distingue vazio de incompleto')
ok(compradaDoProjeto(doisArranjos).motivo === MOTIVOS_POTENCIA.SEM_POTENCIA_MODULO,
  'composição incompleta → `MODULO_SEM_POTENCIA`')
ok(compradaDoProjeto({ arranjos: [arranjo('A', [])] }).motivo === MOTIVOS_POTENCIA.SEM_COMPOSICAO,
  'composição vazia → `COMPOSICAO_VAZIA` (são coisas diferentes)')

secao('6 · Os DOIS caminhos de topologia seguem a mesma regra')
// `arranjos[]` e `instalacao` têm agregadores distintos. Corrigir só um deixaria
// o outro mentindo — foi o que já aconteceu com `potenciaTotalKwp`.
const geradores = [
  { id: 'g1', paineis: [p(14, 585)], inversores: [], potencia_kwp: 8.19, dimensionamento: {} },
  { id: 'g2', paineis: [p(10, null)], inversores: [], potencia_kwp: null, dimensionamento: {} },
]
ok(totaisTopologia(geradores).potencia_total_kwp === null,
  '`totaisTopologia` (caminho instalacao) também devolve null')
ok(totaisTopologia([geradores[0]]).potencia_total_kwp === 8.19,
  'e soma normalmente quando está completo')
ok(potenciaTotalKwp(doisArranjos) === calcularTotaisProjeto(doisArranjos).potencia_total_kwp,
  '`potenciaTotalKwp` e `calcularTotaisProjeto` não divergem — é uma soma só')

secao('7 · O padrão perigoso não voltou aos agregadores')
const AGREGADORES = [
  'backend/src/services/arranjosService.js',
  'backend/src/dominio/topologia/derivadosTopologia.js',
  'backend/src/dominio/parecer/index.js',
]
// Proíbe `potencia... || 0` e `potencia... ?? 0` — o fallback que colapsa os
// três estados. Comentários já foram removidos, então é uso, não menção.
const PERIGOSO = /potencia[a-z_]*\s*\)?\s*(\?\?|\|\|)\s*0(?![.\d])/i
for (const f of AGREGADORES) {
  const src = ler(f)
  ok(!PERIGOSO.test(src), `${path.basename(f)} sem fallback numérico em potência`)
  ok(/potencia/i.test(src), `sanidade — ${path.basename(f)} realmente trata potência`)
}
ok(PERIGOSO.test('const w = Number(p.potencia_w) || 0'),
  'sanidade — o padrão reconhece o fallback que pretende proibir')

secao('8 · A armadilha do `Number(null) === 0` está coberta')
// Testar presença com `Number.isFinite(Number(x))` aceita `null` como 0 — eu
// caí nisso ao escrever a correção, e o total voltou a sair parcial.
ok(Number.isFinite(Number(null)), 'contexto: `Number(null)` é 0 e passa em `isFinite`')
// `potencia_kwp: null` no documento NÃO é lacuna: `enriquecerArranjo` deriva o
// valor dos painéis, que estão completos. Derivar do dado real é o certo —
// lacuna é não ter de onde derivar.
ok(calcularTotaisProjeto({ arranjos: [arranjo('A', [p(14, 585)]),
  { id: 'B', paineis: [p(10, 585)], inversores: [], potencia_kwp: null }] }).potencia_total_kwp === 14.04,
  '`potencia_kwp: null` com painéis completos é DERIVADO, não vira lacuna')
// Já com os painéis incompletos, não há de onde derivar — aí sim contamina.
ok(calcularTotaisProjeto({ arranjos: [arranjo('A', [p(14, 585)]),
  { id: 'B', paineis: [p(10, null)], inversores: [], potencia_kwp: null }] }).potencia_total_kwp === null,
  'sem painéis completos nem valor gravado, o total é não avaliável')

secao('9 · Nenhuma tabela comercial entrou como fallback de potência')
// Escopo: os AGREGADORES auditados nesta sprint, não `services/` inteiro. A
// primeira versão deste guard varria tudo e reprovava `equipamentoMatcherService`,
// que referencia os caminhos das tabelas comerciais para importação assistida de
// catálogo — não para somar potência de projeto. Guard largo demais reprova
// código correto e vira ruído.
const comerciais = AGREGADORES
  .filter((f) => /data\/catalogo(Inversores|Paineis|Eletrico)/.test(ler(f)))
ok(comerciais.length === 0,
  `nenhum agregador de potência recorre a tabela comercial${comerciais.length ? ': ' + comerciais.map((x) => path.basename(x)).join(', ') : ''}`)
ok(AGREGADORES.length === 3, 'sanidade — os três agregadores estão sob vigilância')

console.log(falhas === 0
  ? '\nOK — agregação completa ou explicitamente incompleta; lacuna nunca vira zero.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
