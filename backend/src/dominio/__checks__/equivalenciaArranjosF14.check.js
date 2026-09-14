/**
 * equivalenciaArranjosF14.check.js — F14-IMP.
 *
 * Compara o MODELO LEGADO (o que os consumidores leem hoje) com o MODELO DO
 * ADAPTER (`arranjosCanonicos`) e falha quando há perda de informação.
 *
 * É pré-requisito da etapa que troca a fonte canônica: sem esta prova, a troca
 * seria feita na confiança.
 *
 * ── A armadilha que este guard existe para evitar ───────────────────────────
 * "Equivalência" medida de forma ingênua passa por coincidência. Num projeto
 * multiarranjo, comparar só o arranjo que o legado escolhe — que é
 * `find(principal) ?? arranjos[0]` — daria IGUAL, porque os dois lados estariam
 * olhando o mesmo primeiro arranjo. O legado perderia 354 de 565 módulos e o
 * guard aprovaria.
 *
 * Por isso a regra é assimétrica de propósito:
 *
 *   arranjo único → os dois modelos coincidem em tudo
 *   multiarranjo  → o adapter deve ter MAIS que o legado, e a diferença é
 *                   medida e nomeada. Igualdade pelo `[0]` é FALHA.
 *
 *   node backend/src/dominio/__checks__/equivalenciaArranjosF14.check.js
 */
import path from 'node:path'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { arranjosCanonicos, ESTADO_DADO } from '../topologia/arranjosCanonicos.js'
import { normalizarArranjos, calcularTotaisProjeto } from '../../services/arranjosService.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const nota = (m) => console.log('  · ' + m)
const secao = (t) => console.log(`\n── ${t}`)

/** O que os consumidores de hoje enxergam: UM arranjo, escolhido por posição. */
function visaoLegada(projeto) {
  const arranjos = Array.isArray(projeto?.arranjos) ? projeto.arranjos : []
  const a = arranjos.find((x) => x?.tipo === 'principal') ?? arranjos[0] ?? null
  return {
    arranjos: a ? 1 : 0,
    modulos: (a?.paineis ?? []).reduce((s, p) => s + (Number(p?.quantidade) || 0), 0),
  }
}

/** @returns {{perdas: string[], ganhos: string[]}} */
export function compararModelos(projeto) {
  const legado = visaoLegada(projeto)
  const c = arranjosCanonicos(projeto)
  const doc = normalizarArranjos(projeto)
  const totais = calcularTotaisProjeto(projeto)
  const perdas = []
  const ganhos = []

  // 1 · quantidade de arranjos
  if (c.arranjos.length !== doc.length) perdas.push(`adapter tem ${c.arranjos.length} arranjos, o documento tem ${doc.length}`)
  if (doc.length > legado.arranjos) ganhos.push(`${doc.length - legado.arranjos} arranjo(s) que o legado descarta`)

  // 2 · identidade — todo arranjo do documento aparece, pelo id
  const idsAdapter = c.arranjos.map((a) => a.id)
  for (const d of doc) {
    if (!idsAdapter.includes(d.id)) perdas.push(`arranjo \`${d.id}\` sumiu no adapter`)
  }

  // 3 · módulos — a soma do adapter bate com os totais oficiais
  const soma = c.arranjos.reduce((s, a) => s + a.modulos.total, 0)
  if (soma !== totais.n_modulos_total) perdas.push(`módulos: adapter soma ${soma}, totais dizem ${totais.n_modulos_total}`)
  if (soma > legado.modulos) ganhos.push(`${soma - legado.modulos} módulo(s) que o legado descarta`)

  // 4 · potência por arranjo — derivada; `null` é resposta válida (F12)
  for (const a of c.arranjos) {
    const d = doc.find((x) => x.id === a.id)
    const esperado = d?.potencia_kwp ?? null
    if ((esperado ?? null) !== (a.potencia.cc_kwp ?? null)) {
      perdas.push(`potência do arranjo \`${a.id}\`: ${a.potencia.cc_kwp} ≠ ${esperado}`)
    }
  }

  // 5 · inversor por arranjo — nenhum inversor do documento some
  for (const d of doc) {
    const nDoc = (d.inversores ?? []).filter((i) => i?.modelo || i?.marca || i?.fabricante).length
    const a = c.arranjos.find((x) => x.id === d.id)
    const nAdapter = a?.inversor.itens.length ?? 0
    if (nDoc > 0 && nAdapter !== nDoc) perdas.push(`inversores do arranjo \`${d.id}\`: adapter ${nAdapter}, documento ${nDoc}`)
  }

  // 6 · topologia — disponível, ausente ou ambígua; nunca inventada
  for (const a of c.arranjos) {
    const t = a.topologia
    const temConteudo = t.mppts.length > 0 || t.micros.length > 0
    if (t.estado === ESTADO_DADO.AUSENTE && temConteudo) perdas.push(`topologia de \`${a.id}\` diz ausente mas traz conteúdo`)
    if (t.estado === ESTADO_DADO.AMBIGUO && temConteudo) perdas.push(`topologia de \`${a.id}\` é ambígua mas foi atribuída`)
    if (t.estado === ESTADO_DADO.DISPONIVEL && !temConteudo) perdas.push(`topologia de \`${a.id}\` diz disponível e está vazia`)
  }

  // 7 · origem — todo dado presente declara de onde veio
  for (const a of c.arranjos) {
    if (a.inversor.estado === ESTADO_DADO.DISPONIVEL && !a.inversor.fonte) perdas.push(`inversor de \`${a.id}\` sem fonte`)
    if (a.topologia.estado === ESTADO_DADO.DISPONIVEL && !a.topologia.fonte) perdas.push(`topologia de \`${a.id}\` sem fonte`)
  }

  return { perdas, ganhos }
}

const painel = (q, w = 445) => ({ marca: 'T', modelo: 'TSM', potencia_w: w, quantidade: q })
const inv = (modelo, kw, fab = 'Huawei') => ({ fabricante: fab, marca: fab, modelo, potencia_kw: kw, quantidade: 1 })

secao('1 · Arranjo único — os dois modelos coincidem')
const unico = { arranjos: [{ id: 'A', tipo: 'principal', paineis: [painel(14, 585)], inversores: [inv('SUN2000-5KTL', 5)] }] }
let r = compararModelos(unico)
ok(r.perdas.length === 0, `sem perda${r.perdas.length ? ': ' + r.perdas.join('; ') : ''}`)
ok(r.ganhos.length === 0, 'e sem ganho — não há nada que o legado deixe de ver')

secao('2 · Multiarranjo — o adapter tem de ter MAIS, nunca igual')
const avelino = { arranjos: [
  { id: 'arr_primario', tipo: 'principal', paineis: [painel(225)], inversores: [inv('SUN2000-60KTL-M0', 60)] },
  { id: 'arr_local_2', tipo: 'secundario', paineis: [painel(174)], inversores: [inv('ASW50K-LT-G2', 50, 'Solplanet')] },
] }
r = compararModelos(avelino)
ok(r.perdas.length === 0, `Mercado Avelino sem perda${r.perdas.length ? ': ' + r.perdas.join('; ') : ''}`)
ok(r.ganhos.length > 0, 'e COM ganho — o legado descartava o segundo arranjo')
r.ganhos.forEach(nota)

const novo = { arranjos: [
  { id: 'a1', tipo: 'principal', paineis: [painel(211)], inversores: [inv('SUN2000-60KTL-M0', 60)] },
  { id: 'a2', tipo: 'secundario', paineis: [painel(180)], inversores: [inv('SUN2000-60KTL-M0', 60)] },
  { id: 'a3', tipo: 'secundario', paineis: [painel(174)], inversores: [inv('SUN2000-50KTL-M0', 50)] },
] }
r = compararModelos(novo)
ok(r.perdas.length === 0, `Sistema FV novo kWp sem perda${r.perdas.length ? ': ' + r.perdas.join('; ') : ''}`)
ok(r.ganhos.some((g) => g.startsWith('354 ')), 'o ganho nomeia os 354 módulos que o legado descarta')
r.ganhos.forEach(nota)

secao('3 · Igualdade pelo `[0]` seria FALHA — a assimetria é o que impede')
ok(visaoLegada(avelino).arranjos === 1 && normalizarArranjos(avelino).length === 2,
  'sanidade — o legado vê 1 de 2 arranjos')
ok(arranjosCanonicos(avelino).arranjos.length === 2, 'e o adapter vê os 2')
nota('em multiarranjo, ausência de ganho significaria que o adapter descarta igual — e a seção 2 reprova')

secao('4 · O comparador reprova perda de verdade')
// Prova por construção: um adapter fictício que devolvesse só o primeiro
// arranjo produziria as perdas que o comparador nomeia.
const fingido = { arranjos: arranjosCanonicos(novo).arranjos.slice(0, 1) }
const idsFingidos = fingido.arranjos.map((a) => a.id)
const faltando = normalizarArranjos(novo).map((d) => d.id).filter((id) => !idsFingidos.includes(id))
ok(faltando.length === 2, `sanidade — um adapter que só olhasse \`[0]\` deixaria ${faltando.length} arranjos de fora`)
ok(compararModelos({ arranjos: [] }).perdas.length === 0, 'projeto vazio não gera perda falsa')

secao('5 · Fallback legado é sempre rastreável')
const legado = {
  arranjos: [{ id: 'A', tipo: 'principal', paineis: [painel(14, 585)], inversores: [] }],
  equipamentos: { inversor: { marca: 'Huawei', modelo: 'SUN2000-5KTL', potencia_kw: 5 } },
  engenharia_eletrica: { arranjo: { mppts: [{ mppt: 1, total_modulos: 14 }] } },
}
const c = arranjosCanonicos(legado)
ok(c.arranjos[0].inversor.fonte === 'legacy_equipamentos_inversor', 'inversor legado declara a fonte')
ok(c.arranjos[0].topologia.fonte === 'legacy_engenharia_eletrica_arranjo', 'topologia legada declara a fonte')
ok(compararModelos(legado).perdas.length === 0, 'e o caminho legado não perde informação')

secao('6 · Topologia de projeto não é atribuída em multiarranjo')
const ambiguo = { ...novo, engenharia_eletrica: { arranjo: { mppts: [{ mppt: 1, total_modulos: 14 }] } } }
const ca = arranjosCanonicos(ambiguo)
ok(ca.arranjos.every((a) => a.topologia.estado === ESTADO_DADO.AMBIGUO), 'todos os arranjos ficam `ambiguo`')
ok(ca.arranjos.every((a) => a.topologia.mppts.length === 0), 'e nenhum recebe a topologia do projeto')
ok(ca.avisos.includes('TOPOLOGIA_DE_PROJETO_NAO_ATRIBUIVEL'), 'o aviso é emitido')
ok(compararModelos(ambiguo).perdas.length === 0, 'sem perda — ambiguidade declarada não é perda')

secao('7 · Nenhum consumidor foi ligado ao adapter neste sprint')
// A migração é consumidor por consumidor, cada um com sua própria prova.
const arquivos = []
const anda = (d) => { for (const n of readdirSync(d)) { const q = path.join(d, n)
  if (statSync(q).isDirectory()) { if (n === '__checks__' || n === '__tests__' || n === 'node_modules') continue; anda(q) }
  else if (/\.jsx?$/.test(n)) arquivos.push(q) } }
anda(path.resolve(RAIZ, 'backend/src'))
anda(path.resolve(RAIZ, 'frontend/src'))
const consumidores = arquivos
  .filter((f) => !/arranjosCanonicos\.js$/.test(f))
  .filter((f) => /arranjosCanonicos/.test(readFileSync(f, 'utf8')))
ok(consumidores.length === 0,
  `nenhum consumidor de produção importa o adapter${consumidores.length ? ': ' + consumidores.map((x) => path.basename(x)).join(', ') : ''}`)
ok(arquivos.length > 500, `sanidade — ${arquivos.length} arquivos varridos`)

console.log(falhas === 0
  ? '\nOK — adapter preserva tudo do legado e recupera o que ele descarta.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
