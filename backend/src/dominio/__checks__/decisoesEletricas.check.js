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
/** Comentário citando um identificador não é uso dele — F1.1. */
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
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

/**
 * ── Por que esta seção mudou de mecanismo (F1.1) ────────────────────────────
 * O bloco lia o `git status` para decidir QUAIS asserções rodar: se um motor
 * consolidado aparecesse modificado, exigia a prova de equivalência; senão,
 * afirmava "nenhum motor alterado". Isso torna o check NÃO DETERMINÍSTICO —
 * a mesma árvore commitada e não commitada roda conjuntos diferentes de
 * asserções — e `MOTOR_INTOCADO` era uma lista vazia, ou seja, não protegia nada.
 *
 * O que realmente importa não depende do `git status`: os motores consolidados
 * exigem prova de equivalência SEMPRE, e o motor não consolidado
 * (`compatibilidadeFV`) tem de manter as fórmulas palavra por palavra — porque
 * a FV-UX-021 mediu que ele NÃO é equivalente ao canônico. As duas coisas são
 * verificáveis por conteúdo, em qualquer ponto do histórico.
 */
{
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

  // Os motores consolidados exigem a prova — sempre, não só quando aparecem
  // modificados na árvore. É a condição que autoriza a consolidação a existir.
  ok(existsSync(path.resolve(RAIZ, 'backend/scripts/equivalencia-fv-dom-025.mjs')),
    'prova de equivalência da FV-DOM-025 presente')
  ok(existsSync(path.resolve(RAIZ, 'backend/src/dominio/__checks__/regrasEletricasCanonicas.check.js')),
    'check de fonte única presente')
  const CANONICO = 'packages/fv-shared/engenharia/engenhariaNormativa.js'
  for (const arquivo of MOTOR_CONSOLIDADO) {
    const fonte = semComentarios(ler(arquivo))
    const nome = path.basename(arquivo)
    if (arquivo === CANONICO) {
      // É a CASA da conversão, não um consumidor: aqui a heurística deve existir.
      ok(/Math\.abs\([^)]*\)\s*>\s*0\.1/.test(fonte), `${nome}: define a conversão de unidade`)
      ok(fonte.includes('export function coefParaFracao'), `${nome}: exporta a primitiva`)
      continue
    }
    ok(/coefParaFracao|classificarCorrenteCC/.test(fonte),
      `${nome}: consome as primitivas canônicas`)
    ok(!/Math\.abs\([^)]*\)\s*>\s*0\.1/.test(fonte),
      `${nome}: sem cópia da conversão de unidade`)
  }
}

secao('5 · Nenhum campo de schema foi removido')
/**
 * ── Por que esta seção mudou de mecanismo (F1.1) ────────────────────────────
 * Ela exigia que `Equipamento.js` e `Baseline.js` não aparecessem no
 * `git status`, e media a aditividade de `ProjetoFV.js` por `git diff` da
 * ÁRVORE. Depois do commit, o diff fica vazio: a guarda da aditividade passava
 * por não ter o que comparar — verde por ausência de evidência, não por prova.
 *
 * O comentário original já apontava o caminho certo ao tratar `ProjetoFV.js`:
 * o que importa não é "intocado", é "ADITIVO — nenhum campo existente foi
 * removido ou retipado". Isso se verifica por CONTEÚDO, e é o que está abaixo:
 * os campos que carregam o modelo continuam declarados. Retirar qualquer um
 * derruba a asserção em qualquer ponto do histórico, commitado ou não.
 */
{
  const CAMPOS_QUE_NAO_PODEM_SUMIR = {
    'backend/src/models/Equipamento.js': ['especificacoes', 'fabricante', 'modelo', 'tipo'],
    'backend/src/models/Baseline.js':    ['congelado'],
    'backend/src/models/ProjetoFV.js':   [
      'arranjos', 'configuracao_eletrica', 'n_mppts', 'mppts', 'micros',
      'potencia_kwp', 'congelado',
    ],
  }
  for (const [arquivo, campos] of Object.entries(CAMPOS_QUE_NAO_PODEM_SUMIR)) {
    const fonte = ler(arquivo)
    const nome = path.basename(arquivo)
    for (const campo of campos) {
      ok(new RegExp(`\\b${campo}\\b`).test(fonte), `${nome}: \`${campo}\` continua declarado`)
    }
  }
  // `micros[]` e `micros[].arranjos[]` nasceram ADITIVOS: `default: undefined`,
  // para que projeto legado leia ausência em vez de array vazio.
  const PROJETO = ler('backend/src/models/ProjetoFV.js')
  const blocoMicros = PROJETO.slice(PROJETO.indexOf('micros: {'),
    PROJETO.indexOf('num_mppts_usados', PROJETO.indexOf('micros: {')))
  ok(/default: undefined/.test(blocoMicros),
    'ProjetoFV.js: a adição de micro é aditiva (ausência ≠ vazio)')
}

/**
 * F1.1 — `schemaSomenteAditivo` foi REMOVIDA. Ela media a aditividade pelo
 * `git diff` da árvore de trabalho: depois do commit o diff fica vazio, as
 * listas de linhas removidas e adicionadas ficam vazias, e a função retornava
 * `true` por não ter o que comparar. Era verde por ausência de evidência.
 *
 * A garantia que ela pretendia dar está na seção 5, por conteúdo: os campos que
 * carregam cada schema continuam declarados, e a adição de micro é aditiva
 * (`default: undefined`). Isso vale commitado ou não.
 */

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
/**
 * ── Por que esta seção mudou de mecanismo (F1.1) ────────────────────────────
 * Ela listava, à mão, quais arquivos de baseline/snapshot já vinham alterados
 * por sprints anteriores, para conseguir afirmar "ESTA sprint não acrescentou
 * nada". A lista precisa crescer a cada sprint e a guarda se apaga sozinha.
 *
 * O que ela protege de verdade — "os motores de engenharia não recalculam nem
 * tocam Baseline/snapshot/governança" — é verificável por CONTEÚDO. Quem PODE
 * mexer em baseline continua sendo só o caminho autorizado, e está nomeado.
 */
{
  const MOTORES_QUE_NAO_TOCAM_BASELINE = [
    'backend/src/services/compatibilidadeEletricaService.js',
    'packages/fv-shared/engenharia/engenhariaNormativa.js',
    'packages/fv-shared/engenharia/classificacaoCorrenteCC.js',
    'packages/fv-shared/engenharia/microinversores.js',
    'packages/fv-shared/engenharia/arranjosMicro.js',
    'packages/fv-shared/engenharia/correnteMicro.js',
  ]
  for (const arquivo of MOTORES_QUE_NAO_TOCAM_BASELINE) {
    const fonte = semComentarios(ler(arquivo))
    const nome = path.basename(arquivo)
    ok(!/baseline|snapshot|governanca|governança/i.test(fonte),
      `${nome}: não conhece baseline/snapshot/governança`)
  }
  for (const [arquivo, motivo] of TOCADOS_POR_SPRINTS_ANTERIORES) {
    console.log(`   (autorizado) ${path.basename(arquivo)} — ${motivo}`)
  }
  // O congelamento continua existindo e continua sendo o único caminho.
  ok(ler('backend/src/dominio/baseline/congelarOrcamento.js').includes('congelar'),
    'o congelamento da Baseline continua no caminho autorizado')
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
