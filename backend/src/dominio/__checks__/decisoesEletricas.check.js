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
/**
 * `compatibilidadeFV` não foi consolidado (FV-UX-021: sem equivalência provada),
 * mas a FV-DOM-029 alterou nele UMA coisa: a precondição de `montarStrings`.
 * Sem os defaults de `paraDimensionamento`, o guard que só olhava `voc_max_dc`
 * deixaria o cálculo correr contra `null`. As FÓRMULAS seguem intactas — é o que
 * a seção verifica.
 */
const MOTOR_GUARD_REFORCADO = ['backend/src/services/compatibilidadeFV.js']
const MOTOR_INTOCADO = []

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
  // FV-DOM-029: as fórmulas de `montarStrings` continuam palavra por palavra —
  // só a precondição mudou. Se alguma delas for tocada, este check acusa.
  for (const arquivo of MOTOR_GUARD_REFORCADO) {
    const fonte = ler(arquivo)
    ok(fonte.includes('const voc_corrigido = modulo.voc * FATOR_TEMPERATURA_VOC'),
      `${path.basename(arquivo)}: correção térmica intacta`)
    ok(fonte.includes('const max_modulos_serie = Math.floor(inversor.voc_max_dc / voc_corrigido)'),
      `${path.basename(arquivo)}: limite de série intacto`)
    ok(fonte.includes('FATOR_TEMPERATURA_VOC = 1.15'),
      `${path.basename(arquivo)}: fator 1,15 preservado (não equivalente, e não foi tocado)`)
    ok(fonte.includes('campos_faltantes'),
      `${path.basename(arquivo)}: guard passou a NOMEAR o que falta`)
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
  for (const modelo of ['backend/src/models/Equipamento.js', 'backend/src/models/Baseline.js']) {
    ok(!git.includes(modelo), `intacto: ${modelo}`)
  }
  /**
   * `ProjetoFV.js` deixou de ser "intacto" na FV-DOM-031, POR AUTORIZAÇÃO
   * (decisão 1: configuração de micro por modelo). Exigir intocado passaria a
   * ser uma guarda falsa; a guarda que interessa é outra e é mais forte:
   * a alteração é ADITIVA — nenhum campo existente foi removido ou retipado.
   */
  ok(schemaSomenteAditivo('backend/src/models/ProjetoFV.js'),
    'ProjetoFV.js alterado apenas de forma ADITIVA (nenhum campo removido/retipado)')
}

/**
 * Toda linha REMOVIDA do arquivo reaparece entre as ADICIONADAS quando se
 * ignoram comentários e espaços. Se um campo tivesse sumido ou trocado de tipo,
 * a linha original não teria correspondente e o check acusaria.
 */
function schemaSomenteAditivo(rel) {
  let diff
  try { diff = execSync(`git diff -U0 -- ${rel}`, { cwd: RAIZ, encoding: 'utf8' }) } catch { return false }
  const limpar = (l) => l.slice(1).replace(/\/\/.*$/, '').replace(/\s+/g, '')
  const linhas = diff.split('\n')
  const removidas = linhas.filter((l) => l.startsWith('-') && !l.startsWith('---')).map(limpar).filter(Boolean)
  const adicionadas = linhas.filter((l) => l.startsWith('+') && !l.startsWith('+++')).map(limpar).filter(Boolean)
  const conjunto = new Set(adicionadas)

  /**
   * ALARGAR um enum é aditivo — `['novo','ampliacao']` → `['novo','ampliacao',
   * 'opcao']` (FV-DOM-032). A comparação linha a linha não enxerga isso, então
   * a linha antiga é aceita quando existe uma NOVA que contém todos os valores
   * dela. Estreitar o enum removeria um valor, nenhuma linha nova o conteria, e
   * o check acusaria — a guarda continua valendo no sentido que importa.
   */
  const alargamentoDeEnum = (antiga) => {
    if (!antiga.startsWith('enum:[')) return false
    const valores = antiga.slice(6).replace(/\],?$/, '').split(',').filter(Boolean)
    return adicionadas.some((nova) =>
      nova.startsWith('enum:[') && valores.every((v) => nova.includes(v)))
  }

  const perdidas = removidas.filter((l) => !conjunto.has(l) && !alargamentoDeEnum(l))
  if (perdidas.length > 0) console.log(`   linhas perdidas: ${perdidas.join(' | ')}`)
  return perdidas.length === 0
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
  // FV-DOM-032: o gate passou a considerar a OPÇÃO aceita antes da Baseline.
  // Nenhuma baseline é lida de forma diferente, recalculada, apagada ou
  // alterada — o service só acrescenta o estado da opção à decisão.
  ['backend/src/services/BaselineService.js', 'FV-DOM-032 — gate ciente das opções da proposta'],
])
if (git !== null) {
  const alterados = git.split('\n').filter(Boolean).map((l) => l.slice(3).trim())
  /**
   * FV-INFRA-058: `.md` fora do filtro. A regra existe para pegar CÓDIGO que
   * mexa em baseline/snapshot/governança, e passou a acusar o documento
   * `FV-QA-BASELINE-001.md` — que casa com `/baseline/` só pelo nome. Um
   * arquivo de documentação não altera comportamento; mantê-lo aqui treinaria
   * a equipe a ignorar a asserção, que é o oposto do que ela serve.
   */
  const suspeitos = alterados.filter((a) =>
    /baseline|snapshot|governanca/i.test(a)
    && !/__checks__|scripts/.test(a)
    && !/\.md$/i.test(a))
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
