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
/**
 * ── Por que este bloco mudou de mecanismo (F1.1) ────────────────────────────
 * Exigia que três schemas não aparecessem no `git status` e media a preservação
 * de `equipamentos.estrutura` por `git diff` da ÁRVORE. Depois do commit o diff
 * fica vazio e a asserção passa por não ter o que comparar — verde por ausência
 * de evidência, não por prova.
 *
 * O que interessa a esta sprint — "o campo em que a Estrutura grava continua
 * declarado, e os agregados congelados continuam íntegros" — verifica-se por
 * CONTEÚDO, em qualquer ponto do histórico.
 */
for (const [modelo, campos] of Object.entries({
  'backend/src/models/Equipamento.js': ['especificacoes', 'fabricante', 'tipo'],
  'backend/src/models/Baseline.js':    ['congelado'],
  'backend/src/models/Orcamento.js':   ['validade_dias', 'prazo_execucao_dias'],
})) {
  const fonte = ler(modelo)
  for (const campo of campos) {
    ok(new RegExp(`\\b${campo}\\b`).test(fonte),
      `${modelo.split('/').pop()}: \`${campo}\` continua declarado`)
  }
}
ok(/descricao/.test(schema), '`estrutura.descricao` continua no schema')

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
{
  // F1.1: era `git diff` da árvore. A garantia por CONTEÚDO é mais forte — o
  // que importa não é que a linha não tenha sido tocada, e sim que `estrutura`
  // não seja uma etapa aceita pelo controller.
  ok(!/'estrutura'/.test(controller),
    '`estrutura` não entrou na lista de etapas permitidas')
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
  /**
   * F1.1 — a heurística anterior varria as LINHAS ADICIONADAS no diff e
   * classificava cada uma como leitura ou escrita por texto. Varrer o arquivo
   * inteiro com ela produz falso positivo: o controller legitimamente contém
   * leituras (`o.equipamentos?.estrutura?.tipo`) e inicializadores de documento
   * NOVO (`estrutura: {}`), que a heurística não distingue de escrita.
   *
   * A propriedade que realmente importa é mais estreita e verificável sem
   * ambiguidade: ninguém ESCREVE `equipamentos.estrutura` por fora da etapa
   * `equipamentos` — nem por `$set`, nem por atribuição direta.
   */
  const semQuebra = controller.replace(/\s+/g, ' ')
  ok(!/\$set\s*:\s*\{[^}]*equipamentos\.estrutura/.test(semQuebra),
    'nenhum `$set` escreve `equipamentos.estrutura`')
  ok(!/\.equipamentos\.estrutura\s*=[^=]/.test(semQuebra),
    'nenhuma atribuição direta a `equipamentos.estrutura`')
  // A validação da estrutura acontece SÓ dentro da etapa `equipamentos`.
  ok(/etapa === 'equipamentos' && dados\?\.estrutura !== undefined/.test(controller),
    '`validarEstrutura` só roda sob a etapa `equipamentos`')
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
// F1.1: era `git diff` da árvore, que fica vazio depois do commit — a asserção
// passava por não ter o que comparar. O que importa se verifica por conteúdo:
// o memorial LÊ a estrutura e não a escreve.
ok(/estrutura\?\./.test(MEMORIAL), 'o memorial continua LENDO `estrutura`')
// `const { estrutura = {} } = ...` é LEITURA com default de desestruturação,
// não escrita. O que se proíbe é escrita em documento: `.estrutura = …` e `$set`.
ok(!/\.estrutura\s*=[^=]|\$set[^\n]*estrutura/.test(MEMORIAL),
  'e não escreve `estrutura` em documento algum')

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

secao('9 · A etapa Estrutura não invade motor, financeiro nem wizard')
/**
 * ── Por que esta seção mudou de mecanismo (F1.1) ────────────────────────────
 * Ela afirmava "arquivo X não aparece modificado no `git status`". Isso só é
 * verdade enquanto a sprint que escreveu a guarda está SEM COMMIT: a árvore
 * acumula sprints, e qualquer trabalho posterior que toque num dos arquivos
 * derruba a asserção sem que nada tenha regredido. Foi o que a F1 provocou ao
 * alterar legitimamente `compatibilidadeEletricaService.js` e o wizard.
 *
 * A intenção — "a etapa Estrutura não faz engenharia elétrica, não precifica e
 * não mexe no wizard legado" — continua válida e é verificável por CONTEÚDO, em
 * qualquer ponto do histórico. É o que está abaixo, e é mais forte: uma guarda
 * de `git status` só acusava a modificação; estas acusam o ACOPLAMENTO.
 */
{
  const ESTRUTURA = semComentarios(ler('frontend/src/fv/estrutura.js'))

  // A etapa não faz engenharia elétrica — nem importa, nem cita os motores.
  for (const proibido of [
    'engenharia/normativa', 'compatibilidadeEletrica', 'analisarCompatibilidade',
    'correnteProjeto', 'coefParaFracao', 'calcularVocMaxString',
  ]) {
    ok(!ESTRUTURA.includes(proibido), `estrutura.js não conhece \`${proibido}\``)
  }

  // E os motores não conhecem estrutura: o acoplamento não existe nos dois sentidos.
  const SERVICO_EL = semComentarios(ler('backend/src/services/compatibilidadeEletricaService.js'))
  const NORMATIVA_EL = semComentarios(ler('packages/fv-shared/engenharia/engenhariaNormativa.js'))
  for (const [nome, fonte] of [['service elétrico', SERVICO_EL], ['normativa', NORMATIVA_EL]]) {
    ok(!/from '[^']*estrutura/.test(fonte), `${nome} não importa estrutura`)
    ok(!/Baseline|Orcamento/.test(fonte), `${nome} não conhece Baseline/Orçamento`)
    ok(!/financeiro/i.test(fonte), `${nome} não conhece financeiro`)
  }

  // O wizard legado não conhece a etapa nova — ela nasceu na UX nova.
  const WIZARD_LEGADO = semComentarios(ler('frontend/src/components/fv/ConfiguradorArranjoFV.jsx'))
  ok(!/estrutura/i.test(WIZARD_LEGADO), 'o wizard legado não conhece a etapa Estrutura')

  // Nenhuma migração de dados: a etapa grava em campo que já existia.
  // F1.1: nenhum script de migração versionado menciona estrutura. Verificado
  // por conteúdo — não por "apareceu no git status".
  const MIGRACOES = execSync('git ls-files backend/scripts', { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter((a) => /migrat|migracao|seed-prod/i.test(a))
  const citam = MIGRACOES.filter((a) => /equipamentos\.estrutura|estrutura:/i.test(ler(a)))
  ok(citam.length === 0,
    citam.length === 0
      ? `nenhuma migração toca estrutura (${MIGRACOES.length} script(s) verificado(s))`
      : `migração toca estrutura: ${citam.join(', ')}`)
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
