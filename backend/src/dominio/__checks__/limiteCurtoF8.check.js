/**
 * limiteCurtoF8.check.js — F8.
 *
 * Trava a separação entre DUAS grandezas que o sistema tratava como uma:
 *
 *   corrente_isc_max       limite de CURTO-CIRCUITO da entrada (IEC 62109-1)
 *   corrente_max_por_mppt  limite de corrente de TRABALHO
 *
 * Havia dois pontos substituindo a primeira pela segunda — `paraDimensionamento`
 * (leitura) e `catalogoQualidade` (escrita em `specs_canonicas`). O segundo
 * materializou o valor falso em 24 dos 52 inversores do catálogo real.
 *
 * O que este check impede é a volta do `??` entre os dois campos, em qualquer
 * um dos dois pontos — e a introdução de um terceiro.
 *
 *   node backend/src/dominio/__checks__/limiteCurtoF8.check.js
 */
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { paraDimensionamento } from '@fortesolar/fv-shared/inversores'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const ler = (rel) => semComentarios(readFileSync(path.resolve(RAIZ, rel), 'utf8'))

const TENSAO = { tensao_max_entrada: 1000, tensao_mppt_min: 200, tensao_mppt_max: 850, n_mppts: 2 }

secao('1 · Comportamento: a leitura não converte trabalho em curto')
ok(paraDimensionamento({ ...TENSAO, corrente_max_por_mppt: 30 }).isc_max_mppt === null,
  'só trabalho declarado → `isc_max_mppt` é null')
ok(paraDimensionamento({ ...TENSAO, corrente_isc_max: 45, corrente_max_por_mppt: 36 }).isc_max_mppt === 45,
  'curto declarado → usa o curto')
ok(paraDimensionamento({ ...TENSAO, corrente_max_por_mppt: 30 }).lacunas.includes('corrente_isc_max'),
  'a ausência do curto é declarada em `lacunas`')
// Sanidade: se o cenário parasse de exercitar o caminho, o guard passaria vazio.
ok(paraDimensionamento({ ...TENSAO, corrente_max_por_mppt: 30 }).corrente_max_por_mppt === 30,
  'sanidade — o campo de trabalho está de fato presente no cenário acima')

secao('2 · Código: a substituição não volta em nenhum dos dois pontos')
const FONTES = [
  'packages/fv-shared/equipamentos/inversores/index.js',
  'backend/src/services/catalogoQualidade.js',
]
// Qualquer `??` / `||` ligando um nome de curto a um nome de trabalho, em
// qualquer ordem. Proíbe o USO, não a menção — os comentários já saíram acima.
const CURTO = 'corrente_isc_max|isc_max_mppt|isc_max_por_mppt_a'
const TRAB = 'corrente_max_por_mppt|corrente_max_mppt|ipv_max'
const MISTURA = new RegExp(`(${CURTO})[^\\n;]{0,40}(\\?\\?|\\|\\|)[^\\n;]{0,40}(${TRAB})|(${TRAB})[^\\n;]{0,40}(\\?\\?|\\|\\|)[^\\n;]{0,40}(${CURTO})`)
for (const f of FONTES) {
  const src = ler(f)
  ok(!MISTURA.test(src), `${path.basename(f)} não mistura curto com trabalho`)
  ok(new RegExp(CURTO).test(src), `sanidade — ${path.basename(f)} realmente trata o campo de curto`)
}

secao('3 · Nenhum default numérico tomou o lugar do `??`')
const idx = ler('packages/fv-shared/equipamentos/inversores/index.js')
const linhaIsc = idx.split('\n').find((l) => /const isc_max_mppt\s*=/.test(l)) || ''
ok(linhaIsc.length > 0, 'sanidade — a linha do limite de curto foi localizada')
ok(!/\?\?|\|\|/.test(linhaIsc), 'a atribuição não tem fallback algum')
ok(!/\d/.test(linhaIsc.replace(/_num|corrente_isc_max|isc_max_mppt/g, '')),
  'e nenhum literal numérico foi introduzido nela')

secao('4 · O limite de trabalho continua exposto, separado')
const d = paraDimensionamento({ ...TENSAO, corrente_isc_max: 45, corrente_max_por_mppt: 36 })
ok(d.isc_max_mppt === 45 && d.corrente_max_por_mppt === 36,
  'os dois saem da projeção com nomes próprios e valores próprios')

secao('5 · `specs_canonicas` segue reportado, nunca promovido a fonte')
// A F8 saneou a projeção; saneá-la não pode virar pretexto para lê-la.
for (const f of ['backend/src/services/compatibilidadeFV.js',
  'packages/fv-shared/equipamentos/inversores/index.js']) {
  ok(!/specs_canonicas/.test(ler(f)), `${path.basename(f)} não lê \`specs_canonicas\``)
}

console.log(falhas === 0
  ? '\nOK — curto e trabalho são grandezas separadas; ausência de curto é ausência.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
