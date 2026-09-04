/**
 * estruturaEtapa.check.js — FV-UX-030
 *
 * A etapa de Estrutura tinha um jeito fácil e errado de ser feita: criar um
 * campo, um enum, um catálogo de estruturas e um preço por painel. Este check
 * prova que nada disso aconteceu.
 *
 * O que ele guarda:
 *   1. os campos usados JÁ EXISTIAM no schema, e o schema não foi tocado;
 *   2. nenhuma etapa nova foi aberta no `PUT /:id/etapa`;
 *   3. o vocabulário gravado é o mesmo do wizard legado — memorial e proposta
 *      imprimem `estrutura.tipo` cru;
 *   4. nenhum preço, material, quantidade de gancho ou catálogo entrou;
 *   5. ausência não vira tipo assumido;
 *   6. salvar estrutura não apaga a composição, e vice-versa;
 *   7. motor elétrico, financeiro, baseline e wizard legado intactos.
 *
 *   node backend/src/dominio/__checks__/estruturaEtapa.check.js
 */
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

const ler = (rel) => readFileSync(path.resolve(RAIZ, rel), 'utf8')
/** Código sem comentários — para que um comentário nunca satisfaça nem viole um guard. */
const semComentarios = (fonte) => fonte
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

/**
 * FV-DOM-039: a REGRA mudou de casa. Ela vive no SSOT compartilhado; o arquivo
 * do frontend virou reexportação mais `resumoDaOpcao`, que é de tela. As
 * asserções de regra passam a ler o SSOT — mesma garantia, agora no lugar onde
 * a regra realmente está — e a seção 10 guarda que ninguém a redefiniu.
 */
const SSOT       = 'packages/fv-shared/equipamentos/estrutura.js'
const MODELO     = 'frontend/src/fv/estrutura.js'
const TELA       = 'frontend/src/fv/paginas/etapas/EtapaEstrutura.jsx'
const RESUMO     = 'frontend/src/fv/componentes/ResumoOpcao.jsx'
const COMPOSICAO = 'frontend/src/fv/composicao.js'
const SCHEMA     = 'backend/src/models/ProjetoFV.js'
const CONTROLLER = 'backend/src/controllers/projetosFVController.js'
const FLUXO      = 'frontend/src/fv/fluxo.js'

const modelo = ler(MODELO)
const modeloCodigo = semComentarios(ler(SSOT))   // onde a REGRA vive
const telaCodigo = semComentarios(modelo)        // o que sobrou de tela
const tela = semComentarios(ler(TELA))

secao('1 · Os campos já existiam — nenhum schema novo')
const schema = ler(SCHEMA)
ok(/estrutura:\s*\{\s*tipo:\s*String,\s*descricao:\s*String,?\s*\}/.test(schema),
  '`equipamentos.estrutura.{tipo,descricao}` já declarado no ProjetoFV')
let git = null
try { git = execSync('git status --porcelain', { cwd: RAIZ, encoding: 'utf8' }) } catch { /* fora de repo */ }
if (git === null) ok(false, 'git indisponível — não foi possível verificar o schema')
else {
  for (const m of ['backend/src/models/Equipamento.js',
    'backend/src/models/Baseline.js', 'backend/src/models/Orcamento.js']) {
    ok(!git.includes(m), `intacto: ${m}`)
  }
  // A FV-UX-030 não tocou o schema. A FV-DOM-031 tocou, por autorização
  // (micro por modelo) — e não removeu nada: `equipamentos.estrutura` segue
  // declarado exatamente como estava, que é o que ESTA sprint precisa garantir.
  let diffSchema = ''
  try { diffSchema = execSync(`git diff -- ${SCHEMA}`, { cwd: RAIZ, encoding: 'utf8' }) } catch { /* fora de repo */ }
  ok(!/^-.*estrutura/m.test(diffSchema), '`equipamentos.estrutura` intacto no schema')
  ok(!/^[-+].*\bdescricao\b/m.test(diffSchema), 'nenhuma mudança em `estrutura.descricao`')
}

secao('2 · Nenhuma etapa nova no PUT /:id/etapa')
const controller = ler(CONTROLLER)
ok(!/'estrutura'/.test(controller),
  'a etapa `estrutura` NÃO foi acrescentada — a escrita usa `equipamentos`, que já existia')
ok(semComentarios(tela).includes("salvarEtapa('equipamentos'"),
  'a tela grava pela etapa `equipamentos`')
/**
 * O controller deixou de ser "intacto" na FV-DOM-031D, que acrescentou a leitura
 * do módulo do catálogo para o unifilar de micro — assunto alheio à estrutura.
 * A guarda que interessa a ESTA sprint é mais precisa: a lista de etapas
 * permitidas não mudou, e nenhuma linha que mencione `estrutura` foi tocada.
 */
if (git !== null) {
  let diff = ''
  try { diff = execSync(`git diff -- ${CONTROLLER}`, { cwd: RAIZ, encoding: 'utf8' }) } catch { /* fora de repo */ }
  ok(!/^[-+].*ETAPAS_PERMITIDAS/m.test(diff), 'a lista `ETAPAS_PERMITIDAS` não foi alterada')
  /**
   * O que esta sprint precisa garantir é que ninguém passou a ESCREVER
   * `equipamentos.estrutura` por outro caminho — a etapa `equipamentos` continua
   * sendo o único. LER é outra coisa: a FV-UX-033 exibe a estrutura de cada
   * opção na listagem da proposta, e a FV-DOM-032 cria opções cujo
   * `equipamentos` nasce vazio. Nem a leitura nem o inicializador de um
   * documento NOVO alteram a estrutura de projeto algum.
   *
   * Proibido, portanto: atribuição, `$set` e operador de update sobre o campo.
   */
  /**
   * `\s*` seguido de lookahead negativo NÃO funciona aqui: o motor recua o
   * `\s*` para zero caracteres e o lookahead passa a olhar o espaço, aprovando
   * qualquer linha. A leitura do valor que segue `estrutura:` é feita
   * explicitamente, com o texto capturado.
   */
  const depoisDeEstrutura = (l) => (l.match(/estrutura:\s*(.*)$/) ?? [])[1] ?? ''
  const LEITURA_OU_VAZIO = /^(\{\s*\}|o\.|p\.|projeto|base|orig|equipamentos\?)/

  const escritasDeEstrutura = diff.split('\n')
    .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    .filter((l) => !/^\+\s*(\/\/|\*)/.test(l))                       // comentários
    .filter((l) => /estrutura/i.test(l))
    // Projeção de `.select(...)` é leitura por definição.
    .filter((l) => !/'[^']*equipamentos\.estrutura[^']*'/.test(l))
    .filter((l) => /\$set|updateOne|updateMany|findOneAndUpdate/.test(l)
      || /\bequipamentos\.estrutura\s*=/.test(l)
      || (/estrutura:/.test(l) && !LEITURA_OU_VAZIO.test(depoisDeEstrutura(l))))
  ok(escritasDeEstrutura.length === 0,
    escritasDeEstrutura.length === 0
      ? 'nenhuma ESCRITA de `estrutura` foi acrescentada ao controller'
      : `escritas: ${escritasDeEstrutura.map((l) => l.trim()).join(' | ').slice(0, 140)}`)
  // E a etapa `estrutura` continua não existindo — a escrita usa `equipamentos`.
  ok(!/'estrutura'/.test(controller), 'nenhuma etapa `estrutura` foi aberta')
}

secao('3 · Vocabulário igual ao do wizard legado')
// `memorialDescritivoService` e `propostaComercialService` imprimem
// `estrutura.tipo` DIRETO no documento gerado. Um slug sairia cru.
const legado = ler('frontend/src/components/fv/SeletorEstrutura.jsx')
for (const v of ['Fibrocimento', 'Cerâmico', 'Metálico', 'Laje', 'Solo']) {
  ok(new RegExp(`valor: '${v}'`).test(modeloCodigo), `valor persistido: ${v}`)
  ok(legado.includes(`tipo: '${v}'`), `  ↳ mesmo termo do wizard legado`)
}
const MEMORIAL = ler('backend/src/services/memorialDescritivoService.js')
ok(MEMORIAL.includes('estrutura?.tipo'),
  'o memorial realmente imprime `estrutura.tipo` — daí a exigência acima')
/**
 * A FV-DOM-031C alterou este arquivo POR AUTORIZAÇÃO (seções 5 e 6 passaram a
 * ter variante de microinversor). Exigir "intacto" viraria guarda falsa; o que
 * esta sprint precisa garantir é que a SEÇÃO DA ESTRUTURA não mudou — e isso se
 * verifica pelo conteúdo, que é mais forte que pelo `git status`.
 */
ok(/7\. COMPONENTES - ESTRUTURA\s*\n─+\s*\nTipo: \$\{estrutura\?\.tipo \|\| 'Fibrocimento'\}/.test(MEMORIAL),
  'a seção 7 (estrutura) do memorial está palavra por palavra como estava')

/**
 * `propostaComercialService` saiu da lista de "intactos" da seção 9 pelo MESMO
 * motivo do memorial acima: a FV-UX-036 o alterou por autorização — o bloco de
 * equipamentos passou a ler a forma canônica em vez de inventar (`|| 10`
 * módulos, `|| 400`W, `|| 'Fibrocimento'`). Exigir "intacto" viraria guarda
 * falsa. O que ESTA sprint precisa garantir continua garantido, e por conteúdo:
 *
 *   • a estrutura é LIDA de `equipamentos.estrutura`, não recalculada;
 *   • o tipo é impresso como veio, sem tradução nem slug;
 *   • ninguém reintroduziu o default 'Fibrocimento';
 *   • "Outro" continua carregando a descrição livre.
 */
const PROPOSTA = ler('backend/src/services/propostaComercialService.js')
ok(/const estCanon = equip\.estrutura/.test(PROPOSTA),
  'a proposta lê `equipamentos.estrutura` (canônico)')
ok(/const estLegado = projeto\.estrutura/.test(PROPOSTA),
  'e mantém `projeto.estrutura` do wizard como fallback')
ok(/`Tipo: \$\{ou\(eq\.estrutura\.tipo\)\}`/.test(PROPOSTA),
  'imprime o tipo como veio, sem traduzir')
ok(!/\|\|\s*'Fibrocimento'/.test(semComentarios(PROPOSTA)),
  "o default 'Fibrocimento' não voltou")
ok(/est\.tipo === 'Outro' && est\.descricao/.test(PROPOSTA),
  '"Outro" continua carregando a descrição livre (FV-UX-030)')
let diffMemorial = ''
try {
  diffMemorial = execSync('git diff -- backend/src/services/memorialDescritivoService.js',
    { cwd: RAIZ, encoding: 'utf8' })
} catch { /* fora de repo */ }
ok(!/^[-+].*estrutura\?\./m.test(diffMemorial),
  'nenhuma linha que lê `estrutura` foi adicionada ou removida')

secao('4 · Nenhum preço, material ou catálogo entrou')
for (const proibido of ['preco', 'precoUnitario', 'custo', 'valor_r', 'garantia',
  'gancho', 'trilho', 'quantidade', 'listarCatalogo', 'fetch(']) {
  ok(!modeloCodigo.includes(proibido), `modelo sem \`${proibido}\``)
}
for (const proibido of ['preco', 'custo', 'listarCatalogo', 'garantia']) {
  ok(!tela.includes(proibido), `tela sem \`${proibido}\``)
}

secao('5 · Ausência não vira tipo assumido')
ok(/estruturaVazia\(\)\s*\{\s*return \{ tipo: '', descricao: '' \}/.test(modeloCodigo),
  'estrutura ausente é vazia, não "Fibrocimento"')
for (const v of ['Fibrocimento', 'Cerâmico', 'Metálico', 'Laje', 'Solo', 'Outro']) {
  ok(!new RegExp(`\\?\\?\\s*'${v}'`).test(modeloCodigo), `sem default \`?? '${v}'\``)
}
ok(modeloCodigo.includes("lacunas.push('estrutura não informada')"),
  'ausência é LACUNA declarada, não erro nem preenchimento')
ok(/exigeDescricao\(tipo\)[\s\S]{0,120}erros\.push/.test(modeloCodigo),
  '"Outro" sem descrição é erro explícito')

secao('6 · Nenhum lado apaga o outro')
// `$set.equipamentos = dados` SUBSTITUI o subdocumento inteiro no servidor.
ok(/\$set\[etapa\] = dados/.test(controller),
  'confirmado: a etapa `equipamentos` substitui o subdocumento inteiro')
ok(/paraEquipamentos\([\s\S]{0,220}\.\.\.\(equipamentosExistentes \?\? \{\}\)/.test(modeloCodigo),
  'paraEquipamentos preserva o que já estava em `equipamentos`')
ok(semComentarios(ler(COMPOSICAO)).includes('...(equipamentosExistentes ?? {})'),
  'projecaoLegado preserva `estrutura` ao salvar a composição')

secao('7 · Lugar no fluxo')
const fluxo = ler(FLUXO)
const ordem = [...fluxo.matchAll(/chave: '([a-z_]+)'/g)].map((m) => m[1])
const i = (c) => ordem.indexOf(c)
ok(i('estrutura') > i('equipamentos'), 'Estrutura vem depois de Equipamentos')
// Sprint A reordenou o grupo comercial: Equipamentos → Topologia → Estrutura →
// Cotações. A asserção anterior (`estrutura` ANTES de `mppt`) fixava a ordem
// que a sprint substitui — a Topologia descreve a composição, e a Estrutura
// descreve como essa composição se fixa. O que a FV-UX-030 garante continua
// verificado acima e abaixo: Estrutura depois de Equipamentos, antes do
// Orçamento, e gravada em `equipamentos.estrutura`.
ok(i('estrutura') > i('mppt'), 'Estrutura vem depois da Topologia')
ok(i('dimensionamento') < i('equipamentos'), 'Dimensionamento vem ANTES de Equipamentos (Sprint A)')
ok(i('estrutura') < i('orcamentos'), 'Estrutura vem antes do Orçamento')
ok(ler('frontend/src/fv/rotas.jsx').includes('path="estrutura"'), 'rota registrada')

secao('8 · O resumo da opção não deriva nada')
const resumo = semComentarios(ler(RESUMO))
for (const proibido of ['calcular', 'dimensionar', 'validar', 'preco', 'total']) {
  ok(!resumo.includes(proibido), `ResumoOpcao sem \`${proibido}\``)
}
ok(telaCodigo.includes('Object.fromEntries(TECNOLOGIAS_INVERSOR)'),
  'os rótulos de tecnologia vêm de `TECNOLOGIAS_INVERSOR` — não foram redigitados')

secao('9 · Motores, contrato e wizard legado intactos')
if (git !== null) {
  for (const arquivo of [
    'backend/src/services/compatibilidadeEletricaService.js',
    'packages/fv-shared/engenharia/engenhariaNormativa.js',
    'backend/src/dominio/baseline/',
    'backend/src/services/financeiro',
    'frontend/src/components/fv/',
    'frontend/src/components/fv/SeletorEstrutura.jsx',
    // `propostaComercialService.js` saiu daqui na FV-UX-036 — ver a asserção de
    // CONTEÚDO na seção 3, que substitui esta com garantia mais forte.
  ]) {
    ok(!git.includes(arquivo), `intacto: ${arquivo}`)
  }
  const alterados = git.split('\n').filter(Boolean).map((l) => l.slice(3).trim())
  const novos = alterados.filter((a) => /migrat|migracao|seed-prod/i.test(a))
  ok(novos.length === 0, novos.length === 0 ? 'nenhuma migração criada' : `migração: ${novos.join(', ')}`)
}

// ═══ 10 · FV-DOM-039 — uma definição só ══════════════════════════════════
secao('10 · A regra tem UMA definição')
{
  const backend = semComentarios(ler('backend/src/dominio/estrutura/index.js'))

  // Nenhum dos dois lados redefine: os dois reexportam.
  for (const [rot, codigo] of [['backend', backend], ['frontend', telaCodigo]]) {
    ok(/from '@fortesolar\/fv-shared\/estrutura'/.test(codigo),
      `${rot} importa o SSOT`)
    ok(!/function validarEstrutura/.test(codigo),
      `${rot} NÃO redefine validarEstrutura`)
    ok(!/function exigeDescricao/.test(codigo),
      `${rot} NÃO redefine exigeDescricao`)
    ok(!/const TIPOS_ESTRUTURA\s*=\s*Object\.freeze\(\[/.test(codigo),
      `${rot} NÃO redefine a lista de tipos`)
  }

  // E o SSOT é alcançável dos dois lados pelos caminhos declarados.
  const pkg = JSON.parse(ler('packages/fv-shared/package.json'))
  ok(pkg.exports['./estrutura'] === './equipamentos/estrutura.js',
    'o pacote exporta `./estrutura`')
  ok(/'@fortesolar\/fv-shared\/estrutura':/.test(ler('frontend/aliases.js')),
    'o alias do frontend resolve `@fortesolar/fv-shared/estrutura`')

  // O comportamento exigido pela FV-DOM-039, lido do SSOT.
  ok(/if \(tipo === ''\) lacunas\.push/.test(modeloCodigo),
    'ausente → lacuna, não erro')
  ok(!/erros\.push[\s\S]{0,80}(fora da lista|desconhecid)/i.test(modeloCodigo),
    'tipo fora da lista NÃO é erro — valor legado é preservado')
  const nErros = (modeloCodigo.match(/erros\.push/g) ?? []).length
  ok(nErros === 1, `um único erro possível na regra (encontrados ${nErros})`)
}

console.log(falhas === 0
  ? '\nOK — estrutura grava em campo existente, com vocabulário do legado, sem preço e sem apagar a composição.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
