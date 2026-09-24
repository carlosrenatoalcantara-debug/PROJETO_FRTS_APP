/**
 * defaultsTecnicos.check.js — FV-DOM-029
 *
 * Cinco defaults de `paraDimensionamento` eram limites de SEGURANÇA fabricados.
 * Um inversor sem `tensao_max_entrada` no catálogo era validado contra 600 V
 * inventados — e passava. Ausência ficava indistinguível de dado real.
 *
 * Este check prova que sumiram, que ausência virou lacuna nomeada, e que
 * nenhum outro default entrou no lugar.
 *
 *   node backend/src/dominio/__checks__/defaultsTecnicos.check.js
 */
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { paraDimensionamento, lerInversor } from '@fortesolar/fv-shared/inversores'
import { extrairSpecsInversor, extrairSpecsModulo, montarStrings }
  from '../../services/compatibilidadeFV.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)
const ler = (rel) => readFileSync(path.resolve(RAIZ, rel), 'utf8')
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const FONTE = semComentarios(ler('packages/fv-shared/equipamentos/inversores/index.js'))

const COMPLETO = { fabricante: 'Sungrow', modelo: 'SG15RT', especificacoes: {
  potencia_kw: 15, fases: 3, tensao_max_entrada: 1000, tensao_mppt_min: 200,
  tensao_mppt_max: 850, corrente_isc_max: 25, n_mppts: 3 } }
const VAZIO = { fabricante: 'X', modelo: 'SEM-SPEC', especificacoes: { potencia_kw: 5 } }
const MODULO = { especificacoes: { potencia_w: 650, voc_v: 45.5, isc_a: 18.35, vmpp_v: 38.1, impp_a: 17.06 } }

secao('1 · Os cinco defaults sumiram do código')
for (const d of ['?? 600', '?? 100', '?? 550', '?? 13', '?? 2,', '?? 2\n']) {
  ok(!FONTE.includes(d), `sem \`${d.trim()}\``)
}
// E não voltaram disfarçados de `||`.
for (const d of ['|| 600', '|| 100', '|| 550', '|| 13', '|| 2']) {
  ok(!FONTE.includes(d), `sem \`${d}\``)
}

secao('2 · Especificação presente → valor do catálogo, intacto')
const d = paraDimensionamento(COMPLETO.especificacoes, COMPLETO)
ok(d.voc_max_dc === 1000, `voc_max_dc ${d.voc_max_dc}`)
ok(d.mppt_min_v === 200, `mppt_min_v ${d.mppt_min_v}`)
ok(d.mppt_max_v === 850, `mppt_max_v ${d.mppt_max_v}`)
ok(d.isc_max_mppt === 25, `isc_max_mppt ${d.isc_max_mppt}`)
ok(d.n_mppts === 3, `n_mppts ${d.n_mppts}`)
ok(Array.isArray(d.lacunas) && d.lacunas.length === 0, 'sem lacunas quando o catálogo declara tudo')

secao('3 · Especificação ausente → null e lacuna NOMEADA, nunca número')
const v = paraDimensionamento(VAZIO.especificacoes, VAZIO)
for (const [campo, valor] of [['voc_max_dc', v.voc_max_dc], ['mppt_min_v', v.mppt_min_v],
  ['mppt_max_v', v.mppt_max_v], ['isc_max_mppt', v.isc_max_mppt], ['n_mppts', v.n_mppts]]) {
  ok(valor === null, `${campo} = null (era ${{ voc_max_dc: 600, mppt_min_v: 100, mppt_max_v: 550, isc_max_mppt: 13, n_mppts: 2 }[campo]})`)
}
ok(JSON.stringify(v.lacunas) ===
  JSON.stringify(['tensao_max_entrada', 'tensao_mppt_min', 'tensao_mppt_max', 'corrente_isc_max', 'n_mppts']),
  `lacunas declaradas: ${JSON.stringify(v.lacunas)}`)
// Os valores antigos não podem aparecer em lugar nenhum da saída.
const bruto = JSON.stringify(v)
for (const n of [600, 100, 550, 13]) {
  ok(!new RegExp(`:\\s*${n}\\b`).test(bruto), `o número ${n} não aparece na saída`)
}

secao('4 · Campos REAIS diferentes não se substituem (F8)')
// Esta seção afirmava o contrário: que `corrente_max_por_mppt` "supria"
// `corrente_isc_max` por serem "dois campos reais". Ser real não basta — são
// grandezas DIFERENTES (trabalho × curto-circuito), e a substituição produzia
// um limite de curto mais baixo do que o real, afrouxando a verificação de
// string. A F8 removeu a substituição; este check agora trava a remoção.
const soTrabalho = paraDimensionamento({ potencia_kw: 8, corrente_max_por_mppt: 16,
  tensao_max_entrada: 600, tensao_mppt_min: 80, tensao_mppt_max: 550, n_mppts: 2 }, {})
ok(soTrabalho.isc_max_mppt === null, '`corrente_max_por_mppt` NÃO supre `corrente_isc_max`')
ok(soTrabalho.corrente_max_por_mppt === 16, 'o limite de trabalho sai com o próprio nome')
ok(soTrabalho.lacunas.length === 1 && soTrabalho.lacunas[0] === 'corrente_isc_max',
  'e a ausência do limite de curto é a única lacuna — nomeada')

secao('5 · Lacuna parcial é nomeada com precisão')
const parcial = paraDimensionamento({ potencia_kw: 15, tensao_max_entrada: 1000,
  tensao_mppt_min: 200, tensao_mppt_max: 850, corrente_isc_max: 25 }, {})
ok(JSON.stringify(parcial.lacunas) === JSON.stringify(['n_mppts']),
  `só o que falta: ${JSON.stringify(parcial.lacunas)}`)

secao('6 · A lacuna chega ao consumidor (`extrairSpecsInversor`)')
ok(JSON.stringify(extrairSpecsInversor(COMPLETO).lacunas) === '[]', 'completo: sem lacunas')
ok(extrairSpecsInversor(VAZIO).lacunas.length === 5, 'vazio: 5 lacunas propagadas')

secao('7 · `montarStrings` IMPEDE o cálculo em vez de usar limite inventado')
const mod = extrairSpecsModulo(MODULO)
const bom = montarStrings({ modulo: mod, inversor: extrairSpecsInversor(COMPLETO), qtd_modulos_total: 24 })
ok(bom.ok === true, 'inversor completo continua calculando')
ok(bom.configuracao !== null, 'e devolve configuração')

const ruim = montarStrings({ modulo: mod, inversor: extrairSpecsInversor(VAZIO), qtd_modulos_total: 24 })
ok(ruim.ok === false, 'inversor sem specs NÃO calcula')
ok(ruim.configuracao === null, 'nenhuma configuração é produzida')
ok(ruim.alertas[0].codigo === 'INVERSOR_SEM_SPECS', `código ${ruim.alertas[0].codigo}`)
ok(Array.isArray(ruim.alertas[0].campos_faltantes) && ruim.alertas[0].campos_faltantes.length === 5,
  'o alerta NOMEIA os campos que faltam')
ok(ruim.alertas[0].mensagem.includes('nenhum limite é assumido'),
  'a mensagem declara que nada foi assumido')

secao('8 · Lacuna PARCIAL também bloqueia — antes o default cobria')
// Sem `n_mppts`, o antigo `?? 2` deixava o cálculo seguir contra 2 MPPTs fictícios.
const semMppt = extrairSpecsInversor({ especificacoes: { potencia_kw: 15,
  tensao_max_entrada: 1000, tensao_mppt_min: 200, tensao_mppt_max: 850, corrente_isc_max: 25 } })
const r = montarStrings({ modulo: mod, inversor: semMppt, qtd_modulos_total: 24 })
ok(r.ok === false, 'falta só `n_mppts` e o cálculo já não corre')
ok(JSON.stringify(r.alertas[0].campos_faltantes) === '["n_mppts"]',
  `campo faltante identificado: ${JSON.stringify(r.alertas[0].campos_faltantes)}`)

secao('9 · Nenhuma regra elétrica canônica foi tocada (FV-DOM-025)')
const NORMATIVA = ler('packages/fv-shared/engenharia/engenhariaNormativa.js')
ok(NORMATIVA.includes('FATOR_ISC_NBR16690 = 1.25'), 'Isc × 1,25 intacto')
ok(NORMATIVA.includes('NOCT_PADRAO_C = 44'), 'NOCT 44 intacto')
ok(NORMATIVA.includes('export function coefParaFracao'), 'conversão de unidade intacta')
const SERVICO = ler('backend/src/services/compatibilidadeEletricaService.js')
/**
 * F1: a aplicação do fator desceu um nível. O validador deixou de chamar
 * `correnteProjeto` diretamente e passou a consumir `classificarCorrenteCC`,
 * que é quem o aplica — o wizard legado precisava do mesmo veredito no
 * navegador, e repetir a comparação lá era o que produzia divergência.
 *
 * A intenção da guarda é a mesma e continua verificada, agora na cadeia
 * inteira: validador → classificador → primitiva canônica.
 */
const CLASSIFICADOR = ler('packages/fv-shared/engenharia/classificacaoCorrenteCC.js')
ok(SERVICO.includes('classificarCorrenteCC({'), 'validador consome o classificador canônico')
ok(CLASSIFICADOR.includes('correnteProjeto(vIsc, n)'), 'e o classificador aplica Isc × 1,25')

secao('10 · `lerInversor` (SSOT) não ganhou alias nem default')
const DIC = semComentarios(ler('packages/fv-shared/equipamentos/inversores/dicionarioInversor.js'))
for (const d of ['?? 600', '?? 100', '?? 550', '?? 13', '?? 2']) {
  ok(!DIC.includes(d), `dicionário sem \`${d}\``)
}
ok(lerInversor({}, {}).tensao_max_entrada === null, 'SSOT devolve null para campo ausente')

secao('11 · Pendência declarada — os DOIS defaults fora do escopo')
ok(FONTE.includes('_num(c.potencia_kw) ?? _num(equipamento.potencia_kw) ?? 0'),
  '`potencia_kw ?? 0` PERMANECE — fora do escopo da FV-DOM-029')
ok(FONTE.includes("_num(c.tensao_ac) ?? (c.fases === 3 ? 380 : 220)"),
  '`tensao_nominal_v` derivada das fases PERMANECE — fora do escopo')
console.log('   → ambos reportados; removê-los é decisão sua.')

console.log(falhas === 0
  ? '\nOK — cinco defaults removidos; ausência vira lacuna nomeada e bloqueia o cálculo.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
