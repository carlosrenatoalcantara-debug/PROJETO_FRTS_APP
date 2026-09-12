/**
 * fontesDerivadasF10.check.js — F10.
 *
 * Fecha as dívidas residuais de fontes DERIVADAS depois de F1–F9. Trava três
 * coisas que, isoladas, pareciam inofensivas e juntas produziriam a mesma
 * classe de defeito que os sprints anteriores removeram:
 *
 *   1. `specs_canonicas` voltar a ser lida como fonte de engenharia
 *   2. a topologia LEGACY por arranjo ser adotada pelo Core sem migração
 *   3. o gate de elegibilidade persistido divergir da regra viva (F-06)
 *
 *   node backend/src/dominio/__checks__/fontesDerivadasF10.check.js
 */
import path from 'node:path'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { processarEquipamento } from '../../services/catalogoQualidade.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const ler = (rel) => semComentarios(readFileSync(path.resolve(RAIZ, rel), 'utf8'))

const arquivos = []
const anda = (d) => { for (const n of readdirSync(d)) { const p = path.join(d, n)
  if (statSync(p).isDirectory()) { if (n === '__checks__' || n === '__tests__' || n === 'node_modules') continue; anda(p) }
  else if (n.endsWith('.js')) arquivos.push(p) } }
anda(path.resolve(RAIZ, 'backend/src'))

secao('1 · `specs_canonicas` é escrita e relatada, nunca lida pela engenharia')
// O Core inteiro, não uma lista escolhida a dedo: qualquer módulo de engenharia
// que passe a LER a projeção reprova aqui.
const CORE = arquivos.filter((a) => /[\\/](dominio|services)[\\/]/.test(a))
  .filter((a) => !/catalogoQualidade\.js$|catalogoDatasheetEnriquecimento\.js$|bulkOperationsService\.js$/.test(a))
const leitores = CORE.filter((a) => /specs_canonicas/.test(semComentarios(readFileSync(a, 'utf8'))))
ok(leitores.length === 0,
  `nenhum módulo de engenharia lê \`specs_canonicas\`${leitores.length ? ': ' + leitores.map((p) => path.basename(p)).join(', ') : ''}`)
ok(CORE.length > 0, 'sanidade — a varredura do Core encontrou arquivos')

secao('2 · A projeção não fabrica: ausência sai ausente')
const cq = ler('backend/src/services/catalogoQualidade.js')
const normInv = cq.slice(cq.indexOf('function normalizarSpecsInversor'))
const corpo = normInv.slice(0, normInv.indexOf('\n}'))
ok(corpo.length > 0, 'sanidade — `normalizarSpecsInversor` foi localizada')
// Nenhum `??` entre dois campos e nenhum literal numérico como fallback.
ok(!/\?\?\s*(c\.|esp\.|\d)/.test(corpo),
  'nenhum campo é suprido por outro nem por número na projeção do inversor')
ok(/lerInversor/.test(cq), 'e a origem continua sendo o SSOT (`lerInversor`)')

secao('3 · Elegibilidade persistida é derivada, não opinião gravada')
// O gate recalculado NÃO pode depender do flag que já está no documento: se
// dependesse, um `true` velho se perpetuaria. Prova: mesmo doc, flags opostos,
// mesmo veredito.
const semEnvelope = { tipo: 'inversor', fabricante: 'X', modelo: 'SemTensao',
  especificacoes: { potencia_kw: 15, n_mppts: 2, corrente_max_por_mppt: 32 } }
const a = processarEquipamento({ ...semEnvelope, utilizavel_em_projeto: true }, { tipoEvento: 't' })
const b = processarEquipamento({ ...semEnvelope, utilizavel_em_projeto: false }, { tipoEvento: 't' })
ok(a.utilizavel_em_projeto === false && b.utilizavel_em_projeto === false,
  'inversor sem envelope de tensão é bloqueado, venha de `true` ou de `false`')
ok(JSON.stringify(a.bloqueio_engenharia) === JSON.stringify(b.bloqueio_engenharia),
  'e o motivo do bloqueio é o mesmo nos dois casos')
ok((a.bloqueio_engenharia || []).includes('tensao_max_entrada'),
  'o motivo nomeia o campo que falta, não um rótulo genérico')

// F-06: ausência de dado ≠ incompatibilidade. O bloqueio é por LACUNA, e o
// vocabulário tem de dizer isso — nada aqui pode virar `incompativel`.
ok(!/incompativel/i.test(JSON.stringify(a.bloqueio_engenharia || [])),
  'lacuna não é reportada como incompatibilidade (F-06)')

secao('4 · Equipamento completo continua liberado — o gate não é um "bloqueia tudo"')
const completo = processarEquipamento({ tipo: 'inversor', fabricante: 'Y', modelo: 'Completo',
  especificacoes: { potencia_kw: 15, n_mppts: 2, tensao_max_entrada: 1000,
    tensao_mppt_min: 200, tensao_mppt_max: 850, corrente_max_por_mppt: 32 } }, { tipoEvento: 't' })
ok(completo.utilizavel_em_projeto === true, 'inversor com envelope completo é liberado')
// F8: `corrente_isc_max` ausente NÃO bloqueia a elegibilidade — bloqueia o
// dimensionamento de string, que é outro portão. Não confundir os dois.
ok((completo.bloqueio_engenharia || []).length === 0,
  'e a falta do limite de curto não entra no gate de elegibilidade (F8 × F-06)')

secao('5 · A topologia LEGACY por arranjo continua fora do Core')
// Proíbe o ACESSO a `configuracao_eletrica…mppts` — a topologia STRING LEGACY.
//
// `configuracao_eletrica.micros` é OUTRA COISA e continua permitido: é a fonte
// CANÔNICA da topologia de microinversor (FV-DOM-031), consumida de propósito
// por `dominio/potencia` e `dominio/unifilar`. Os dois blocos moram no mesmo
// subdocumento, e um guard que não os separasse reprovaria código correto —
// foi o que este aqui fez na primeira versão.
const LEGACY = /configuracao_eletrica\s*\??\s*\.\s*mppts|configuracao_eletrica\s*\??\s*\[\s*['"]mppts/
const invasores = arquivos.filter((f) => /[\\/]dominio[\\/]/.test(f))
  .filter((f) => LEGACY.test(semComentarios(readFileSync(f, 'utf8'))))
ok(invasores.length === 0,
  `nenhum módulo de \`dominio/\` lê a topologia LEGACY por arranjo${invasores.length ? ': ' + invasores.map((p) => path.basename(p)).join(', ') : ''}`)
// Sanidade: o guard precisa reprovar de verdade quando o acesso existe.
ok(LEGACY.test('const m = a?.configuracao_eletrica?.mppts'),
  'sanidade — o padrão reconhece o acesso que pretende proibir')
ok(!LEGACY.test('const m = a?.configuracao_eletrica?.micros'),
  'sanidade — e não confunde `micros`, que é fonte canônica')

secao('6 · O portão de multiarranjo não foi removido por descuido')
const integridade = ler('backend/src/dominio/unifilar/integridade.js')
ok(/MULTIPLOS_INVERSORES/.test(integridade), '`MULTIPLOS_INVERSORES` continua existindo')
ok(/n_inversores_total[\s\S]{0,120}>\s*1/.test(integridade),
  'e continua ARMADO — a comparação que o dispara segue no código')

secao('7 · `corrente_max_entrada` chega ao contrato sem ser derivada')
const { lerInversor, paraDimensionamento } = await import('@fortesolar/fv-shared/inversores')
const soMppt = { tensao_max_entrada: 1000, tensao_mppt_min: 200, tensao_mppt_max: 850,
  corrente_max_por_mppt: 30, corrente_isc_max: 40, n_mppts: 2 }
ok(lerInversor(soMppt).corrente_max_entrada === null,
  'sem o campo declarado, o SSOT devolve null')
const dSem = paraDimensionamento(soMppt)
ok(dSem.corrente_max_entrada === null, 'e a projeção também')
ok(dSem.corrente_max_entrada !== 30 && dSem.corrente_max_entrada !== 60,
  'nunca é o limite por MPPT, nem ele × n_mppts')
ok(paraDimensionamento({ ...soMppt, corrente_max_entrada: 40 }).corrente_max_entrada === 40,
  'quando declarada, viaja pelo próprio nome')
// Ausência não pode virar lacuna bloqueante: seriam 52 de 52 inversores.
ok(!dSem.lacunas.includes('corrente_max_entrada'),
  'e sua ausência NÃO entra em `lacunas` — não impede montar string')
// Os DOIS chamadores do motor precisam enviar o parâmetro, senão o critério
// volta a depender de quem montou o contrato.
for (const f of ['backend/src/services/inversoresCompativeisService.js',
  'frontend/src/fv/catalogo.js']) {
  ok(/corrente_max_entrada/.test(ler(f)),
    `${path.basename(f)} envia \`corrente_max_entrada\` ao motor`)
}
// E nenhum deles pode derivá-la das outras duas correntes.
const DERIVA = /corrente_max_entrada\s*[:=][^,;\n]*(corrente_max_por_mppt|corrente_isc_max|n_mppts|\*)/
for (const f of ['packages/fv-shared/equipamentos/inversores/index.js',
  'backend/src/services/inversoresCompativeisService.js',
  'frontend/src/fv/catalogo.js']) {
  ok(!DERIVA.test(ler(f)), `${path.basename(f)} não deriva o limite total das outras correntes`)
}
ok(DERIVA.test('corrente_max_entrada: num(c.corrente_max_por_mppt) * n_mppts'),
  'sanidade — o padrão reconhece a derivação que pretende proibir')

secao('8 · A evidência do requisito multiarranjo ficou registrada')
// Medida na F10 e escrita onde o marcador LEGACY já vive. Sem isso, o próximo
// sprint recomeça a auditoria do zero.
const modelo = readFileSync(path.resolve(RAIZ, 'backend/src/models/ProjetoFV.js'), 'utf8')
ok(/F10 · Evidência do requisito/.test(modelo) && /mais de um arranjo/.test(modelo),
  '`ProjetoFV.js` registra os projetos multiarranjo medidos')

console.log(falhas === 0
  ? '\nOK — projeções derivadas sem autoridade; elegibilidade recalculada; LEGACY isolado.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
