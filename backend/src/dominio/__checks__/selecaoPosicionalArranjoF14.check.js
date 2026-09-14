/**
 * selecaoPosicionalArranjoF14.check.js — F14.
 *
 * Detecta SELEÇÃO POSICIONAL de arranjo: escolher "o arranjo" pegando o
 * primeiro da lista. Num projeto de um arranjo só isso funciona; num projeto de
 * dois, descarta o segundo sem dizer nada — e é assim que o documento enviado à
 * distribuidora declara metade da usina.
 *
 * ── Por que este guard substitui o da F13 ───────────────────────────────────
 * O guard da F13 usava um regex único, `arranjos\[\s*0\s*\]`, e varria só
 * `backend/src`. Reportei "2 consumidores, com teto no guard". Eram SEIS. O
 * regex não via:
 *
 *   (o.arranjos ?? [])[0]        parênteses entre o nome e o índice
 *   projeto.arranjos?.[0]        acesso opcional
 *   frontend/fv/composicao.js    fora do diretório varrido
 *
 * O teto de 2 passava por acaso, não por estar correto. Um guard que
 * subdetecta é pior que nenhum: dá por resolvido o que não está.
 *
 * ── Como este funciona ──────────────────────────────────────────────────────
 * AST (`@babel/parser`, com JSX), não texto. Procura um nó `MemberExpression`
 * cujo objeto termine em `arranjos` e cuja propriedade seja o literal `0` —
 * qualquer que seja a pontuação em volta. Comentários e strings não existem
 * para o parser, então não há falso positivo por menção.
 *
 * O que NÃO reprova, de propósito:
 *   `.map` / `.filter` / `.forEach` / `.reduce`  — iteração legítima
 *   `.find(a => a.id === arranjoId)`             — seleção por IDENTIDADE
 *   `paineis[0]`, `inversores[0]`                — índice de outra coleção
 *   `arranjos.length`, `arranjos[i]` em laço     — não é escolha semântica
 *
 * O alvo é estreito: índice literal ZERO sobre a lista de arranjos, que é
 * sempre "pegue o primeiro e siga".
 *
 *   node backend/src/dominio/__checks__/selecaoPosicionalArranjoF14.check.js
 */
import path from 'node:path'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
const require_ = createRequire(path.join(RAIZ, 'frontend/package.json'))
const { parse } = require_('@babel/parser')

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const nota = (m) => console.log('  · ' + m)
const secao = (t) => console.log(`\n── ${t}`)

/** Último identificador de uma cadeia `a.b.c` — `c`. */
function nomeFinal(no) {
  if (!no) return null
  if (no.type === 'Identifier') return no.name
  if (no.type === 'MemberExpression' && !no.computed) return nomeFinal(no.property)
  if (no.type === 'TSNonNullExpression' || no.type === 'ParenthesizedExpression') return nomeFinal(no.expression)
  // `(o.arranjos ?? [])` — o nome vem do lado ESQUERDO do `??`.
  if (no.type === 'LogicalExpression') return nomeFinal(no.left)
  return null
}

/** Percorre a AST chamando `visita` em cada nó. */
function andar(no, visita) {
  if (!no || typeof no !== 'object') return
  if (Array.isArray(no)) { for (const x of no) andar(x, visita); return }
  if (typeof no.type === 'string') visita(no)
  for (const k of Object.keys(no)) {
    if (k === 'loc' || k === 'leadingComments' || k === 'trailingComments') continue
    andar(no[k], visita)
  }
}

/**
 * Seleções posicionais de arranjo no código-fonte.
 * @returns {Array<{linha:number, trecho:string}>}
 */
export function selecoesPosicionais(codigo) {
  let ast
  try {
    ast = parse(codigo, {
      sourceType: 'module', errorRecovery: true,
      plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
    })
  } catch { return [] }
  const achados = []
  andar(ast.program, (no) => {
    if (no.type !== 'MemberExpression' && no.type !== 'OptionalMemberExpression') return
    if (!no.computed) return
    const prop = no.property
    const ehZero = prop?.type === 'NumericLiteral' && prop.value === 0
    if (!ehZero) return
    if (nomeFinal(no.object) !== 'arranjos') return
    const inicio = no.loc?.start
    achados.push({
      linha: inicio?.line ?? 0,
      trecho: codigo.split('\n')[(inicio?.line ?? 1) - 1]?.trim().slice(0, 96) ?? '',
    })
  })
  return achados
}

// ─── Varredura ───────────────────────────────────────────────────────────────

const ALVOS = ['backend/src', 'frontend/src']
const arquivos = []
const anda = (d) => {
  for (const n of readdirSync(d)) {
    const p = path.join(d, n)
    if (statSync(p).isDirectory()) {
      if (n === '__checks__' || n === '__tests__' || n === 'node_modules') continue
      anda(p)
    } else if (/\.jsx?$/.test(n)) arquivos.push(p)
  }
}
for (const a of ALVOS) anda(path.resolve(RAIZ, a))

secao('1 · O detector reconhece TODAS as formas — inclusive as que escaparam da F13')
const CASOS = [
  ['arranjos[0]',                     'const a = arranjos[0]'],
  ['arranjos?.[0]',                   'const a = projeto.arranjos?.[0]?.inversores?.[0]'],
  ['(o.arranjos ?? [])[0]',           'const a = (o.arranjos ?? [])[0] ?? null'],
  ['find(principal) ?? arranjos[0]',  "const a = arranjos.find((x) => x?.tipo === 'principal') ?? arranjos[0] ?? null"],
  ['(arranjos ?? [])[0] em cadeia',   "const a = (arranjos ?? []).find((x) => x.tipo === 'principal') ?? (arranjos ?? [])[0] ?? null"],
  ['this.arranjos[0]',                'const a = this.arranjos[0]'],
]
for (const [rotulo, src] of CASOS) {
  ok(selecoesPosicionais(src).length > 0, `detecta \`${rotulo}\``)
}

secao('2 · E NÃO reprova o que é legítimo')
const LEGITIMOS = [
  ['map',                 'arranjos.map((a, i) => a.id)'],
  ['filter',              "arranjos.filter((a) => a.tipo === 'principal')"],
  ['forEach com índice',  'arranjos.forEach((a, i) => console.log(i))'],
  ['find por IDENTIDADE', 'arranjos.find((a) => a.id === arranjoId)'],
  ['índice de outra lista', 'const p = arranjo.paineis[0]'],
  ['inversores[0]',       'const i = a.inversores[0]'],
  ['length',              'if (arranjos.length > 1) return null'],
  ['índice variável',     'const a = arranjos[i]'],
  ['menção em string',    "const msg = 'use arranjos[0] com cuidado'"],
  ['menção em comentário', '// nunca use arranjos[0]\nconst a = null'],
]
for (const [rotulo, src] of LEGITIMOS) {
  const r = selecoesPosicionais(src)
  ok(r.length === 0, `não reprova ${rotulo}${r.length ? ` (achou: ${r[0].trecho})` : ''}`)
}

secao('3 · Inventário real — os 6 casos conhecidos da F14')
const encontrados = []
for (const f of arquivos) {
  for (const s of selecoesPosicionais(readFileSync(f, 'utf8'))) {
    encontrados.push({ arquivo: path.relative(RAIZ, f).replace(/\\/g, '/'), ...s })
  }
}
encontrados.forEach((e) => nota(`${e.arquivo}:${e.linha}  ${e.trecho}`))
ok(encontrados.length === 6,
  `${encontrados.length} seleção(ões) posicional(is) — a F14 mapeou 6; nenhuma nova, nenhuma sumiu`)

// A lista é FECHADA: nomear os arquivos impede que uma seja trocada por outra
// sem que ninguém perceba, mantendo a contagem igual.
const ESPERADOS = [
  'backend/src/controllers/homologacaoController.js',
  'backend/src/controllers/projetosFVController.js',
  'backend/src/dominio/unifilar/adaptarProjeto.js',
  'backend/src/services/EnvioPropostaService.js',
  'frontend/src/fv/composicao.js',
]
const arquivosAchados = [...new Set(encontrados.map((e) => e.arquivo))].sort()
ok(JSON.stringify(arquivosAchados) === JSON.stringify(ESPERADOS.sort()),
  'e são exatamente os arquivos que a auditoria registrou')

secao('4 · A varredura cobre backend E frontend do Core')
// O guard da F13 varria só `backend/src` — foi por isso que `composicao.js`
// não apareceu no inventário.
ok(arquivos.some((f) => f.includes(`frontend${path.sep}src`)), 'frontend está na varredura')
ok(arquivos.some((f) => f.includes(`backend${path.sep}src`)), 'backend está na varredura')
ok(arquivos.length > 500, `sanidade — ${arquivos.length} arquivos varridos`)

secao('5 · Limitações declaradas')
nota('só índice literal 0 sobre uma cadeia terminada em `arranjos`')
nota('não cobre: alias (`const l = p.arranjos; l[0]`), índice calculado, acesso via destructuring')
nota('esses casos existiriam como seleção implícita e passariam — a lista fechada acima é a rede')

console.log(falhas === 0
  ? '\nOK — 6 seleções posicionais mapeadas; detector cobre as formas conhecidas sem falso positivo.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
