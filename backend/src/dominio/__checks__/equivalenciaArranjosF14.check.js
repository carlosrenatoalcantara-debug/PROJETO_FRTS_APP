/**
 * equivalenciaArranjosF14.check.js — F14-IMP, endurecido na F14-2.
 *
 * Verifica PRESERVAÇÃO DE INFORMAÇÃO entre o documento persistido e o modelo
 * que o adapter (`arranjosCanonicos`) produz.
 *
 * ── Por que não se chama "igualdade" ────────────────────────────────────────
 * O arquivo diz "equivalência", mas o contrato NÃO é `legado === adapter`. Em
 * multiarranjo o objetivo é justamente o oposto: o adapter tem de conter MAIS
 * do que o legado enxerga. O que se verifica é:
 *
 *   PERDA  — o adapter deixou de representar algo que o documento tem   → FALHA
 *   GANHO  — o adapter representa algo que o legado descarta            → esperado
 *
 * Em arranjo único, ganho é zero e os dois modelos coincidem. Em multiarranjo,
 * ganho ZERO significaria que o adapter está descartando igual ao legado — e
 * isso reprova. O nome do arquivo ficou por continuidade com o commit que o
 * criou; a semântica correta está aqui e nos nomes das funções.
 *
 * ── Este arquivo é o EXECUTOR ───────────────────────────────────────────────
 * A lógica de comparação mora em `topologia/preservacaoArranjos.js` — separada
 * porque ela precisa ser importável por testes, e um arquivo com `process.exit`
 * no topo não é. O cabeçalho de lá detalha os quatro buracos que a F14-2
 * corrigiu; o principal: `compararModelos` chamava `arranjosCanonicos` por
 * dentro, então TODOS os cenários rodavam contra a implementação correta e o
 * comparador nunca foi provado FALHAR. Agora o adapter é injetável e os casos
 * adversariais abaixo alimentam adapters defeituosos de propósito.
 *
 *   node backend/src/dominio/__checks__/equivalenciaArranjosF14.check.js
 */
import path from 'node:path'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { arranjosCanonicos, ESTADO_DADO } from '../topologia/arranjosCanonicos.js'
import { compararModelos } from '../topologia/preservacaoArranjos.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const nota = (m) => console.log('  · ' + m)
const secao = (t) => console.log(`\n── ${t}`)

/** Adapter defeituoso: aplica `mutar` sobre a saída correta. */
const defeituoso = (mutar) => (projeto) => {
  const c = arranjosCanonicos(projeto)
  return { ...c, arranjos: mutar(c.arranjos.map((a) => ({ ...a }))) }
}

const painel = (q, w = 445) => ({ marca: 'T', modelo: 'TSM', potencia_w: w, quantidade: q })
const inv = (modelo, kw, fab = 'Huawei') => ({ fabricante: fab, marca: fab, modelo, potencia_kw: kw, quantidade: 1 })
const arr = (id, tipo, paineis, inversores, extra = {}) => ({ id, tipo, rotulo: id, paineis, inversores, ...extra })

const AVELINO = { arranjos: [
  arr('A', 'principal', [painel(225)], [inv('SUN2000-60KTL-M0', 60)]),
  arr('B', 'secundario', [painel(174)], [inv('ASW50K-LT-G2', 50, 'Solplanet')]),
] }
const NOVO = { arranjos: [
  arr('a1', 'principal', [painel(211)], [inv('SUN2000-60KTL-M0', 60)]),
  arr('a2', 'secundario', [painel(180)], [inv('SUN2000-60KTL-M0', 60)]),
  arr('a3', 'secundario', [painel(174)], [inv('SUN2000-50KTL-M0', 50)]),
] }

secao('1 · O comparador REPROVA perda — provado com adapters defeituosos')
const ADVERSARIOS = [
  ['1 · segundo arranjo perdido', AVELINO, defeituoso((as) => as.slice(0, 1))],
  ['2 · três arranjos, só o primeiro sobrevive', NOVO, defeituoso((as) => as.slice(0, 1))],
  ['3 · inversor do segundo arranjo sumiu', AVELINO,
    defeituoso((as) => as.map((a) => a.id === 'B' ? { ...a, inversor: { ...a.inversor, itens: [] } } : a))],
  ['4 · módulos do segundo zerados', AVELINO,
    defeituoso((as) => as.map((a) => a.id === 'B' ? { ...a, modulos: { ...a.modulos, total: 0 } } : a))],
  ['5 · potência do segundo perdida', AVELINO,
    defeituoso((as) => as.map((a) => a.id === 'B' ? { ...a, potencia: { ...a.potencia, cc_kwp: null } } : a))],
  ['6 · identidade trocada (B vira C)', AVELINO,
    defeituoso((as) => as.map((a) => a.id === 'B' ? { ...a, id: 'C' } : a))],
  ['7 · inversor trocado por outro modelo', AVELINO,
    defeituoso((as) => as.map((a) => a.id === 'B'
      ? { ...a, inversor: { ...a.inversor, itens: [{ fabricante: 'Huawei', modelo: 'SUN2000-60KTL-M0', potencia_kw: 60, quantidade: 1 }] } }
      : a))],
  ['8 · topologia inventada onde não há', AVELINO,
    defeituoso((as) => as.map((a) => a.id === 'B'
      ? { ...a, topologia: { estado: ESTADO_DADO.DISPONIVEL, fonte: 'arranjos', tipo: 'string', mppts: [{ mppt: 1 }], micros: [] } }
      : a))],
  ['· módulos TROCADOS entre arranjos (soma intacta)', AVELINO,
    defeituoso((as) => as.map((a) => a.id === 'A' ? { ...a, modulos: { ...a.modulos, total: 174 } }
      : { ...a, modulos: { ...a.modulos, total: 225 } }))],
]
for (const [rotulo, projeto, adapter] of ADVERSARIOS) {
  const r = compararModelos(projeto, { adapter })
  ok(r.perdas.length > 0, `Caso ${rotulo} → REPROVA${r.perdas.length ? ` (${r.perdas[0]})` : ''}`)
}

secao('2 · Um adapter que devolve tudo vazio também reprova')
const r0 = compararModelos(AVELINO, { adapter: () => ({ arranjos: [] }) })
ok(r0.perdas.length > 0, 'adapter vazio reprova')

secao('3 · E APROVA o adapter real — não reprova por reprovar')
for (const [rotulo, projeto] of [['Mercado Avelino', AVELINO], ['Sistema FV novo kWp', NOVO]]) {
  const r = compararModelos(projeto)
  ok(r.perdas.length === 0, `${rotulo} sem perda${r.perdas.length ? ': ' + r.perdas.join('; ') : ''}`)
  ok(r.ganhos.length > 0, `${rotulo} com ganho — o legado descartava arranjos`)
  r.ganhos.forEach(nota)
}

secao('4 · Caso 10 — legado de arranjo único: coincidem, sem ganho')
const unico = { arranjos: [arr('A', 'principal', [painel(14, 585)], [inv('SUN2000-5KTL', 5)])] }
let r = compararModelos(unico)
ok(r.perdas.length === 0, `sem perda${r.perdas.length ? ': ' + r.perdas.join('; ') : ''}`)
ok(r.ganhos.length === 0, 'e sem ganho — não há nada que o legado deixe de ver')

secao('5 · Caso 11 — ausência em ambos não vira equivalência positiva')
const semTopologia = { arranjos: [arr('A', 'principal', [painel(14, 585)], [inv('M', 5)])] }
const cSem = arranjosCanonicos(semTopologia)
ok(cSem.arranjos[0].topologia.estado === ESTADO_DADO.AUSENTE, 'topologia continua `ausente`')
ok(cSem.arranjos[0].topologia.fonte === null, 'sem fonte — ausência não tem procedência')
ok(compararModelos(semTopologia).perdas.length === 0, 'e ausência real não é contada como perda')
nota('ausente ≠ compatível: o estado é dito, não convertido em veredito')

secao('6 · Caso 9 — Ampliação: arranjo vazio não fabrica equivalência')
const ampliacao = { arranjos: [
  arr('exist_1', 'existente', [{ marca: 'Jinko', modelo: 'JKM530M', potencia_w: 530, quantidade: 8 }], [inv('1P7K-5G', 7, 'Solis')]),
  arr('ampl_2', 'ampliacao', [], []),
], equipamentos: { inversor: { marca: 'Huawei', modelo: 'SUN2000-60KTL-M0', potencia_kw: 60 } } }
const cA = arranjosCanonicos(ampliacao)
ok(cA.arranjos.length === 2, 'os dois arranjos aparecem')
ok(cA.arranjos[1].modulos.estado === ESTADO_DADO.AUSENTE, 'o vazio declara módulos ausentes')
ok(cA.arranjos[1].inversor.estado === ESTADO_DADO.AMBIGUO,
  'e o inversor da raiz NÃO é atribuído a ele — fica `ambiguo`')
ok(compararModelos(ampliacao).perdas.length === 0, 'sem perda — vazio declarado não é perda')

secao('7 · Caso 6 reforçado — quantidade igual com identidade errada reprova')
const idTrocado = compararModelos(AVELINO, {
  adapter: defeituoso((as) => as.map((a) => a.id === 'B' ? { ...a, id: 'C' } : a)),
})
ok(idTrocado.perdas.length >= 2, 'acusa o que sumiu E o que foi inventado')
ok(idTrocado.perdas.some((p) => p.includes('sumiu')), 'nomeia o arranjo que sumiu')
ok(idTrocado.perdas.some((p) => p.includes('inventou')), 'e o que apareceu do nada')

secao('8 · Fallback legado continua rastreável')
const legado = {
  arranjos: [arr('A', 'principal', [painel(14, 585)], [])],
  equipamentos: { inversor: { marca: 'Huawei', modelo: 'SUN2000-5KTL', potencia_kw: 5 } },
  engenharia_eletrica: { arranjo: { mppts: [{ mppt: 1, total_modulos: 14 }] } },
}
const cL = arranjosCanonicos(legado)
ok(cL.arranjos[0].inversor.fonte === 'legacy_equipamentos_inversor', 'inversor legado declara a fonte')
ok(cL.arranjos[0].topologia.fonte === 'legacy_engenharia_eletrica_arranjo', 'topologia legada declara a fonte')
ok(compararModelos(legado).perdas.length === 0, 'e o caminho legado não perde informação')

secao('9 · Ambiguidade declarada não é perda; atribuição silenciosa é')
const ambiguo = { ...NOVO, engenharia_eletrica: { arranjo: { mppts: [{ mppt: 1, total_modulos: 14 }] } } }
const cAmb = arranjosCanonicos(ambiguo)
ok(cAmb.arranjos.every((a) => a.topologia.estado === ESTADO_DADO.AMBIGUO), 'todos ficam `ambiguo`')
ok(compararModelos(ambiguo).perdas.length === 0, 'e isso não é perda')
const atribuiu = compararModelos(ambiguo, {
  adapter: defeituoso((as) => as.map((a, i) => i === 0
    ? { ...a, topologia: { ...a.topologia, estado: ESTADO_DADO.DISPONIVEL, mppts: [{ mppt: 1 }] } } : a)),
})
ok(atribuiu.perdas.length > 0, 'mas atribuir a topologia do projeto a um arranjo REPROVA')

secao('10 · O guard não usa seleção posicional dentro de si')
// `visaoLegada` usa `arranjos[0]` DE PROPÓSITO: ela simula o legado. Fora dela,
// toda comparação é por `id`.
const fonte = readFileSync(path.resolve(RAIZ, 'backend/src/dominio/topologia/preservacaoArranjos.js'), 'utf8')
const semComentarios = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const corpoComparador = semComentarios.slice(semComentarios.indexOf('export function compararModelos'))
  .slice(0, semComentarios.slice(semComentarios.indexOf('export function compararModelos')).indexOf('\n}'))
ok(!/\[\s*0\s*\]/.test(corpoComparador), '`compararModelos` não indexa posição em lugar nenhum')
ok(/find\(\(x\) => x\.id === /.test(corpoComparador) || /x\.id === d\.id/.test(corpoComparador),
  'e casa arranjos por `id`')
ok(/arranjos\[0\]/.test(semComentarios.slice(semComentarios.indexOf('function visaoLegada'))),
  'sanidade — `visaoLegada` usa `[0]` de propósito, para simular o legado')

secao('11 · Os consumidores ligados ao adapter são exatamente os MIGRADOS')
const arquivos = []
const anda = (d) => { for (const n of readdirSync(d)) { const q = path.join(d, n)
  if (statSync(q).isDirectory()) { if (n === '__checks__' || n === '__tests__' || n === 'node_modules') continue; anda(q) }
  else if (/\.jsx?$/.test(n)) arquivos.push(q) } }
anda(path.resolve(RAIZ, 'backend/src'))
anda(path.resolve(RAIZ, 'frontend/src'))
// O próprio adapter e o comparador que o verifica não contam: nenhum dos dois é
// consumidor de produção. O que este check vigia é o Core passar a depender do
// adapter antes da etapa de migração.
const NAO_CONSUMIDORES = /(?:arranjosCanonicos|preservacaoArranjos)\.js$/
const consumidores = arquivos
  .filter((f) => !NAO_CONSUMIDORES.test(f))
  .filter((f) => /arranjosCanonicos/.test(readFileSync(f, 'utf8')))
// Lista FECHADA, que cresce de UM em UM — cada entrada teve sua sprint e sua
// prova de equivalência. Um consumidor novo aqui, sem isso, reprova; e um que
// suma reprova também, porque significaria que a migração foi revertida sem
// atualizar o registro.
//
//   F14-3B · EnvioPropostaService — rótulo de topologia da proposta
const MIGRADOS = ['EnvioPropostaService.js']
const nomes = consumidores.map((x) => path.basename(x)).sort()
ok(JSON.stringify(nomes) === JSON.stringify([...MIGRADOS].sort()),
  `consumidores do adapter: [${nomes.join(', ') || '—'}] — esperado [${MIGRADOS.join(', ')}]`)
ok(arquivos.length > 500, `sanidade — ${arquivos.length} arquivos varridos`)

console.log(falhas === 0
  ? '\nOK — o comparador reprova perda real e aprova o adapter correto.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
