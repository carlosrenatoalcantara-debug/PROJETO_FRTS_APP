/**
 * decisoesEletricas.check.js — FV-DOM-024
 *
 * Duas responsabilidades:
 *
 *  1. As decisões Q1–Q6 e o Modelo A estão registradas no estado canônico, com
 *     a norma que as fundamenta.
 *  2. A sprint NÃO tocou em nada: nenhum motor, nenhum schema, nenhum snapshot,
 *     nenhuma Baseline, nenhum diagnóstico histórico.
 *
 * O segundo ponto é o que importa. Uma sprint de decisão que altera código em
 * silêncio é pior que uma sprint sem decisão.
 *
 *   node backend/src/dominio/__checks__/decisoesEletricas.check.js
 */
import path from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

const ler = (rel) => readFileSync(path.resolve(RAIZ, rel), 'utf8')
const ESTADO = ler('FV-ESTADO-COMPACTADO.md')

secao('1 · As seis decisões estão registradas')
for (const [q, marca] of [
  ['Q1', 'Isc_stc × strings × 1,25'],
  ['Q2', 'coef_temp_voc_pct_c'],
  ['Q3', 'QUENTE'],
  ['Q4', '%/°C'],
  ['Q5', '44 °C'],
  ['Q6', 'congelado'],
]) {
  ok(ESTADO.includes(`**${q}**`), `${q} registrada`)
  ok(ESTADO.includes(marca), `${q} — decisão explícita ("${marca}")`)
}
ok(ESTADO.includes('Modelo A'), 'Modelo A registrado')
ok(ESTADO.includes('topologia autorada pelo projetista'),
  '`mppts[]` declarado como entrada do projetista, não saída de motor')

secao('2 · Cada decisão cita a norma que a fundamenta')
for (const norma of ['NBR 16690 §5.2', 'NBR 16690 §5.1', 'COEF_TEMP_VOC_FORA_FAIXA']) {
  ok(ESTADO.includes(norma), `fonte citada: ${norma}`)
}
ok(ESTADO.includes('sem fonte para o `×0,75`'),
  'Q2 declara que o ×0,75 do wizard não tem fonte — provisória, não canônica')

secao('3 · O impacto não determinável está declarado, não estimado')
ok(ESTADO.includes('NÃO DETERMINADA'), 'contagem de projetos declarada como não determinada')
ok(ESTADO.includes('somente-leitura'), 'motivo declarado: ausência de credencial somente-leitura')
// Nenhum número inventado sobre produção.
const trecho = ESTADO.slice(ESTADO.indexOf('## 1B'), ESTADO.indexOf('## 2 ·'))
ok(!/\d+\s*projetos? (afetad|impactad)/i.test(trecho),
  'nenhuma quantidade de projetos de produção foi afirmada')

secao('4 · Os motores elétricos e quem pode tocá-los')
// A FV-DOM-024 (decisão) não podia alterar motor algum, e não alterou.
// A FV-DOM-025 (consolidação) alterou três deles POR AUTORIZAÇÃO — é o objetivo
// declarado daquela sprint. Este check deixou de exigir "intacto" e passou a
// exigir que a mudança venha ACOMPANHADA da prova de equivalência.
const MOTOR_CONSOLIDADO = [
  'backend/src/services/compatibilidadeEletricaService.js',
  'packages/fv-shared/engenharia/engenhariaNormativa.js',
  'frontend/src/components/fv/ConfiguradorArranjoFV.jsx',
]
/** Este continua fora: sem equivalência provada, não se mexe (FV-UX-021). */
const MOTOR_INTOCADO = ['backend/src/services/compatibilidadeFV.js']

let git = null
try {
  git = execSync('git status --porcelain', { cwd: RAIZ, encoding: 'utf8' })
} catch { /* fora de repositório */ }
if (git === null) {
  ok(false, 'git indisponível — não foi possível inspecionar o estado dos motores')
} else {
  for (const arquivo of MOTOR_INTOCADO) {
    ok(!git.includes(arquivo), `intacto (sem equivalência provada): ${arquivo}`)
  }
  const alterados = MOTOR_CONSOLIDADO.filter((a) => git.includes(a))
  if (alterados.length > 0) {
    ok(existsSync(path.resolve(RAIZ, 'backend/scripts/equivalencia-fv-dom-025.mjs')),
      `${alterados.length} motor(es) consolidado(s) — prova de equivalência presente`)
    ok(existsSync(path.resolve(RAIZ, 'backend/src/dominio/__checks__/regrasEletricasCanonicas.check.js')),
      'check de fonte única presente')
    for (const a of alterados) console.log(`   (FV-DOM-025) ${a}`)
  } else {
    ok(true, 'nenhum motor alterado — estado da FV-DOM-024')
  }
}

secao('5 · Nenhum schema alterado')
if (git !== null) {
  for (const modelo of ['backend/src/models/ProjetoFV.js', 'backend/src/models/Equipamento.js',
    'backend/src/models/Baseline.js']) {
    ok(!git.includes(modelo), `intacto: ${modelo}`)
  }
}

secao('6 · A sprint não escreve em banco algum')
const SCRIPTS = ['backend/scripts/impacto-isc-fv-dom-024.mjs']
for (const s of SCRIPTS) {
  ok(existsSync(path.resolve(RAIZ, s)), `${s} existe`)
  const fonte = ler(s)
  for (const escrita of ['save(', 'updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne',
    'deleteMany', 'insertOne', 'insertMany', 'bulkWrite', 'startSession']) {
    ok(!fonte.includes(escrita), `${path.basename(s)}: sem \`${escrita}\``)
  }
  ok(!fonte.includes('mongoose'), `${path.basename(s)}: não abre conexão de banco`)
  ok(!fonte.includes('mongodb+srv'), `${path.basename(s)}: não referencia produção`)
}

secao('7 · Nenhum snapshot, diagnóstico ou Baseline recalculado')
// Nada foi commitado em TODA a série, então `git status` mostra o acumulado de
// muitas sprints. O que importa aqui é que ESTA sprint não acrescentou nada ao
// conjunto — daí a lista explícita do que já vinha alterado e de qual sprint.
const TOCADOS_POR_SPRINTS_ANTERIORES = new Map([
  ['backend/src/dominio/baseline/congelarOrcamento.js', 'FV-DOM-016A — congela inflacao_energia_aa_pct'],
])
if (git !== null) {
  const alterados = git.split('\n').filter(Boolean).map((l) => l.slice(3).trim())
  const suspeitos = alterados.filter((a) =>
    /baseline|snapshot|governanca/i.test(a) && !/__checks__|scripts/.test(a))
  const novos = suspeitos.filter((a) => !TOCADOS_POR_SPRINTS_ANTERIORES.has(a))
  ok(novos.length === 0,
    novos.length === 0 ? 'esta sprint não tocou baseline/snapshot'
      : `tocou: ${novos.join(', ')}`)
  for (const a of suspeitos.filter((x) => TOCADOS_POR_SPRINTS_ANTERIORES.has(x))) {
    console.log(`   (pré-existente) ${a} — ${TOCADOS_POR_SPRINTS_ANTERIORES.get(a)}`)
  }
}
// O entregável da FV-DOM-024 é o registro das decisões no estado canônico. Isso
// se verifica pelo CONTEÚDO do documento (§1–§3), não pelo `git status`: depois
// do commit a árvore fica limpa e uma asserção baseada em "arquivo modificado"
// passaria a falhar sem que nada tivesse regredido.
ok(ESTADO.includes('## 1B · Decisões de engenharia elétrica'),
  'a seção das decisões existe no estado canônico')

secao('8 · Autorização para a FV-DOM-025')
// A quebra de linha do markdown separa as palavras — normaliza antes de buscar.
const preRequisito = /Pré-requisito\s+declarado da FV-DOM-025/.test(ESTADO)
ok(preRequisito, 'a FV-DOM-025 tem pré-requisito explícito registrado')
console.log('   → consolidar em fv-shared SOMENTE após contar os projetos na faixa')
console.log('     de virada da Isc, em produção somente-leitura.')

console.log(falhas === 0
  ? '\nOK — decisões registradas com fonte; schemas e histórico intactos; consolidação com prova.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
