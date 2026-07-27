/**
 * test_ae_provider.mjs — F1 da integração AE ⇄ Forte Solar
 *
 * Valida a PORTA (IAEProvider), o comparador de KnowledgeVersion e o
 * adaptador de diretório local. Sem banco, sem rede, sem dependências.
 *
 * Execução:
 *   node tests/ae/test_ae_provider.mjs
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertProvider, resolverFamilia, FAMILIAS_AE } from '../../src/integracoes/ae/IAEProvider.js'
import {
  compararVersao, mesmaVersao, avaliarAtualizacao, NAO_COMPARAVEL,
} from '../../src/integracoes/ae/knowledgeVersion.js'
import {
  criarAeLocalFolderProvider, lerFrontmatter,
} from '../../src/integracoes/ae/aeLocalFolderProvider.js'

// ─── Utilidades de teste ─────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(descricao, condicao, detalhes = '') {
  if (condicao) {
    console.log(`  ✅ ${descricao}`)
    passed++
  } else {
    console.error(`  ❌ ${descricao}${detalhes ? `\n     ${detalhes}` : ''}`)
    failed++
  }
}

function secao(titulo) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${titulo}`)
  console.log('─'.repeat(60))
}

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'ae')

// ─── 1. Contrato ─────────────────────────────────────────────────────────────

secao('1. Contrato IAEProvider')

const providerValido = { listarIndice() {}, obterDatasheet() {}, descrever() {} }
assert('aceita provider que cumpre o contrato', assertProvider(providerValido) === providerValido)

for (const ausente of ['listarIndice', 'obterDatasheet', 'descrever']) {
  const incompleto = { ...providerValido }
  delete incompleto[ausente]
  let erro = null
  try { assertProvider(incompleto) } catch (e) { erro = e }
  assert(`rejeita provider sem "${ausente}"`, erro !== null && erro.message.includes(ausente))
}

let erroNulo = null
try { assertProvider(null) } catch (e) { erroNulo = e }
assert('rejeita provider nulo', erroNulo !== null)

// ─── 2. Resolução de família ─────────────────────────────────────────────────

secao('2. Famílias do AE')

assert('4 famílias no escopo', FAMILIAS_AE.length === 4)
assert('Módulos → modulo', resolverFamilia('Módulos') === 'modulo')
assert('microinversores → inversor (família Inversores)', resolverFamilia('microinversores') === 'inversor')
assert('carregadores-ev → carregador_ev', resolverFamilia('carregadores-ev') === 'carregador_ev')
assert('Baterias → bateria', resolverFamilia('Baterias') === 'bateria')
assert('cabos fora do escopo', resolverFamilia('cabos') === null)
assert('DPS fora do escopo', resolverFamilia('DPS') === null)
assert('estruturas fora do escopo', resolverFamilia('estruturas') === null)

// ─── 3. KnowledgeVersion ─────────────────────────────────────────────────────

secao('3. KnowledgeVersion — única autoridade de prioridade')

assert('1.2.0 === 1.2', mesmaVersao('1.2.0', '1.2'))
assert('v1.2.0 === 1.2.0 (prefixo v)', mesmaVersao('v1.2.0', '1.2.0'))
assert('1.3 !== 1.2', !mesmaVersao('1.3', '1.2'))
assert('1.3 > 1.2', compararVersao('1.3', '1.2') > 0)
assert('1.2 < 1.10 (numérico, não lexicográfico)', compararVersao('1.2', '1.10') < 0)
assert('2026.07.2 > 2026.07.1', compararVersao('2026.07.2', '2026.07.1') > 0)
assert('sufixos arbitrários não são ordenáveis', compararVersao('1.0-beta', '1.0-rc') === NAO_COMPARAVEL)
assert('formato livre não é ordenável', compararVersao('rev-A', 'rev-B') === NAO_COMPARAVEL)

// Autorização de escrita
const cenarios = [
  ['AE superior autoriza sobrescrita', '2.0', '1.0', true, 'superior'],
  ['AE igual não autoriza', '1.0', '1.0.0', false, 'atualizado'],
  ['AE inferior não autoriza (protege contra regressão)', '1.0', '2.0', false, 'inferior'],
  ['sem versão no catálogo → nunca auditado', '1.0', null, false, 'nunca_auditado'],
  ['sem versão no AE → não autoriza', null, '1.0', false, 'sem_versao_ae'],
  ['não comparável → não autoriza', '1.0-beta', '1.0-rc', false, 'nao_comparavel'],
]
for (const [desc, ae, cat, autoriza, situacao] of cenarios) {
  const r = avaliarAtualizacao(ae, cat)
  assert(desc, r.autoriza === autoriza && r.situacao === situacao,
    `esperado {autoriza:${autoriza}, situacao:${situacao}} — obtido {autoriza:${r.autoriza}, situacao:${r.situacao}}`)
}

// A origem anterior NÃO participa da decisão: a mesma comparação vale para
// manual, Gemini, SolarMarket ou AE. Não há parâmetro de origem nesta API.
assert('avaliarAtualizacao não recebe origem (prioridade só por versão)',
  avaliarAtualizacao.length === 2)

// ─── 4. Frontmatter ──────────────────────────────────────────────────────────

secao('4. Frontmatter do product.md')

const fm = lerFrontmatter([
  '---',
  'Origin: AE',
  'DocumentType: Technical Datasheet',
  'Manufacturer: Trina',
  'KnowledgeVersion: 1.2.0',
  'Confidence: 0.96',
  '---',
  '',
  '# Corpo ignorado',
  'Chave: nao deve entrar',
].join('\n'))

assert('lê Origin', fm.Origin === 'AE')
assert('lê DocumentType', fm.DocumentType === 'Technical Datasheet')
assert('lê KnowledgeVersion', fm.KnowledgeVersion === '1.2.0')
assert('para no fechamento do frontmatter', fm.Chave === undefined)

// ─── 5. Adaptador de diretório local ─────────────────────────────────────────

secao('5. aeLocalFolderProvider')

const provider = criarAeLocalFolderProvider({ raiz: RAIZ })
assert('cumpre o contrato IAEProvider', assertProvider(provider) === provider)
assert('descreve a origem', provider.descrever().tipo === 'local-folder')

const indice = await provider.listarIndice()

assert('indexa exatamente as 4 famílias do escopo', indice.length === 4,
  `obtido ${indice.length}: ${indice.map(e => e.ref).join(', ')}`)
assert('ignora família fora do escopo (cabos)', !indice.some(e => /cabos/i.test(e.ref)))

const modulo = indice.find(e => e.familia === 'modulo')
assert('módulo indexado com fabricante e modelo', modulo?.fabricante === 'Trina' && modulo?.modelo === 'TSM-610-NEG9R.28')
assert('módulo traz KnowledgeVersion', modulo?.knowledgeVersion === '1.2.0')

const inversor = indice.find(e => e.familia === 'inversor')
assert('inversor indexado sem product.md (metadados do JSON)', inversor?.modelo === 'MAX 100KTL3')
assert('inversor traz KnowledgeVersion 2.0.1', inversor?.knowledgeVersion === '2.0.1')

const carregador = indice.find(e => e.familia === 'carregador_ev')
assert('carregador usa frontmatter quando o JSON não traz metadados',
  carregador?.fabricante === 'Intelbras' && carregador?.modelo === 'EVC 7000')
assert('carregador traz KnowledgeVersion do frontmatter', carregador?.knowledgeVersion === '1.0')

const bateria = indice.find(e => e.familia === 'bateria')
assert('bateria sem KnowledgeVersion é indexada com null', bateria?.knowledgeVersion === null)

// Índice não abre conhecimento técnico — só metadados.
assert('índice não carrega os dados técnicos', indice.every(e => e.dados === undefined))

// obterDatasheet
const dsModulo = await provider.obterDatasheet(modulo.ref)
assert('datasheet traz Origin AE', dsModulo.origin === 'AE')
assert('datasheet traz DocumentType', dsModulo.documentType === 'Technical Datasheet')
assert('datasheet traz confidence numérico', dsModulo.confidence === 0.96)
assert('datasheet traz dados técnicos', dsModulo.dados.potencia_w === 610)
assert('dados não contêm metadados', dsModulo.dados.knowledgeVersion === undefined && dsModulo.dados.origin === undefined)

const dsCarregador = await provider.obterDatasheet(carregador.ref)
assert('JSON plano vira dados técnicos', dsCarregador.dados.potencia_kw === 7.4)
assert('metadados do frontmatter chegam ao datasheet', dsCarregador.confidence === 0.9)

// Erros
let erroAusente = null
try { await provider.obterDatasheet(path.join('modulos', 'Inexistente', 'X')) } catch (e) { erroAusente = e }
assert('datasheet ausente falha com código próprio', erroAusente?.code === 'AE_DATASHEET_AUSENTE')

let erroBiblioteca = null
try { await criarAeLocalFolderProvider({ raiz: path.join(RAIZ, '__nao_existe__') }).listarIndice() } catch (e) { erroBiblioteca = e }
assert('biblioteca ausente falha com código próprio', erroBiblioteca?.code === 'AE_BIBLIOTECA_AUSENTE')

let erroRaiz = null
try { criarAeLocalFolderProvider({}) } catch (e) { erroRaiz = e }
assert('exige raiz', erroRaiz !== null)

// ─── Resultado ───────────────────────────────────────────────────────────────

const sep = '═'.repeat(60)
console.log(`\n${sep}`)
console.log(`  RESULTADO: ${passed} ✅  |  ${failed} ❌  |  Total: ${passed + failed}`)
console.log(sep)

if (failed > 0) {
  console.error(`\n  ${failed} teste(s) falharam. Ver detalhes acima.`)
  process.exit(1)
} else {
  console.log('\n  F1 validada — porta, versionamento e adaptador local. ✅')
}
