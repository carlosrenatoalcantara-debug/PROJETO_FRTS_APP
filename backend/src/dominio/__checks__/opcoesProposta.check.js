/**
 * opcoesProposta.check.js — FV-DOM-032
 *
 * As nove regras comerciais, no domínio PURO, mais as guardas de escopo:
 *
 *   • o gate das opções decide antes da Baseline (regra 7);
 *   • projeto sem opções decide exatamente como antes;
 *   • `projeto_origem_id` NÃO foi reusado para relacionar opções;
 *   • nada técnico é herdado por uma opção nova;
 *   • a unicidade do aceite tem índice no banco, não só no serviço.
 *
 *   node backend/src/dominio/__checks__/opcoesProposta.check.js
 */
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { avaliarGate, estadoDaOpcao, exigirBaseline, MOTIVOS_GATE, ErroGate } from '../gate/index.js'
import { calcularHash } from '../baseline/congelarOrcamento.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)
const ler = (rel) => readFileSync(path.resolve(RAIZ, rel), 'utf8')
const semComentarios = (f) => f.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const SCHEMA = 'backend/src/models/ProjetoFV.js'
const GATE = 'backend/src/dominio/gate/index.js'
const CONTROLLER = 'backend/src/controllers/projetosFVController.js'
const SERVICE = 'backend/src/services/BaselineService.js'
const TELA = 'frontend/src/fv/paginas/etapas/EtapaProposta.jsx'

// Baseline REALMENTE íntegra — hash calculado pela função canônica. Um objeto
// com hash inventado cairia em BASELINE_CORROMPIDA e mascararia a decisão das
// opções, que é o que este check quer isolar.
const CONTEUDO = { orcamento: { itens: [] }, condicoes: {} }
const BASELINE_OK = { conteudo: CONTEUDO, hash: calcularHash(CONTEUDO) }

// ═══ 1 · Schema aditivo ═════════════════════════════════════════════════════
secao('1 · Schema — aditivo, e sem reusar `projeto_origem_id`')
{
  const s = ler(SCHEMA)
  ok(/enum: \['novo', 'ampliacao', 'opcao'\]/.test(s), '`tipo_projeto` ganhou `opcao` (aditivo)')
  for (const campo of ['proposta_grupo_id', 'opcao_numero', 'opcao_rotulo', 'proposta_aceite']) {
    ok(s.includes(`${campo}:`), `campo \`${campo}\` declarado`)
  }
  ok(/unica_opcao_aceita_por_proposta/.test(s), 'índice único do aceite existe')
  ok(/partialFilterExpression: \{ 'proposta_aceite\.aceita': true \}/.test(s),
    'é PARCIAL — as não escolhidas convivem sem colidir')
  // `projeto_origem_id` continua existindo para ampliação, e SÓ para ela.
  ok(s.includes('projeto_origem_id'), '`projeto_origem_id` preservado (ampliação)')
  const controller = semComentarios(ler(CONTROLLER))
  const trecho = controller.slice(controller.indexOf('export const criarOpcaoFV'))
  ok(!trecho.slice(0, 3000).includes('projeto_origem_id'),
    '`criarOpcaoFV` NÃO usa `projeto_origem_id` — opções são pares')
}

// ═══ 2 · O gate puro ════════════════════════════════════════════════════════
secao('2 · Gate — regras 5, 7 e 9')
{
  // Projeto SEM opções: comportamento idêntico ao histórico.
  ok(avaliarGate({ fase: 'engenharia', baseline: null }).motivo === MOTIVOS_GATE.SEM_BASELINE,
    'sem opções e sem baseline: SEM_BASELINE, como sempre')
  ok(avaliarGate({ fase: 'engenharia', baseline: BASELINE_OK }).liberado === true,
    'sem opções e com baseline íntegra: LIBERADO, como sempre')
  ok(avaliarGate({ fase: 'engenharia', baseline: BASELINE_OK, opcao: null }).liberado === true,
    '`opcao: null` é o mesmo que não passar opção')

  // Grupo sem aceite: bloqueia mesmo com baseline.
  const semAceite = { aceita: false, grupo_tem_aceita: false, rotulo: 'Opção 01', total_opcoes: 2 }
  const r1 = avaliarGate({ fase: 'engenharia', baseline: BASELINE_OK, opcao: semAceite })
  ok(r1.liberado === false && r1.motivo === MOTIVOS_GATE.PROPOSTA_SEM_ACEITE,
    `proposta sem aceite bloqueia: ${r1.motivo}`)

  // Perdedora COM baseline íntegra: bloqueia — e é por isso que a checagem das
  // opções vem ANTES da baseline (regra 7).
  const perdedora = { aceita: false, grupo_tem_aceita: true, rotulo: 'Opção 01', total_opcoes: 2 }
  const r2 = avaliarGate({ fase: 'engenharia', baseline: BASELINE_OK, opcao: perdedora })
  ok(r2.liberado === false && r2.motivo === MOTIVOS_GATE.OPCAO_NAO_ESCOLHIDA,
    `não escolhida bloqueia mesmo com Baseline íntegra: ${r2.motivo}`)
  ok(/não foi a escolhida/.test(r2.mensagem) && /íntegra e imutável/.test(r2.mensagem),
    'a mensagem diz que a Baseline dela permanece íntegra')

  // Aceita: decide pela baseline, como qualquer projeto.
  const aceita = { aceita: true, grupo_tem_aceita: true, rotulo: 'Opção 02', total_opcoes: 2 }
  ok(avaliarGate({ fase: 'engenharia', baseline: BASELINE_OK, opcao: aceita }).liberado === true,
    'a aceita passa')
  ok(avaliarGate({ fase: 'engenharia', baseline: null, opcao: aceita }).motivo === MOTIVOS_GATE.SEM_BASELINE,
    'a aceita SEM baseline ainda esbarra na Baseline')

  // As duas fases protegidas.
  for (const fase of ['engenharia', 'homologacao']) {
    ok(avaliarGate({ fase, baseline: BASELINE_OK, opcao: perdedora }).liberado === false,
      `${fase} bloqueada para a não escolhida`)
  }

  // Forma imperativa.
  let lancou = null
  try { exigirBaseline({ fase: 'engenharia', baseline: BASELINE_OK, opcao: perdedora }) }
  catch (e) { lancou = e }
  ok(lancou instanceof ErroGate && lancou.codigo === MOTIVOS_GATE.OPCAO_NAO_ESCOLHIDA,
    `exigirBaseline lança ErroGate ${lancou?.codigo} (HTTP ${lancou?.status})`)
}

// ═══ 3 · `estadoDaOpcao` ════════════════════════════════════════════════════
secao('3 · `estadoDaOpcao` — puro, derivado das irmãs')
{
  const grupo = 'g1'
  const o1 = { proposta_grupo_id: grupo, opcao_rotulo: 'Opção 01', proposta_aceite: { aceita: false } }
  const o2 = { proposta_grupo_id: grupo, opcao_rotulo: 'Opção 02', proposta_aceite: { aceita: true } }

  ok(estadoDaOpcao({ proposta_grupo_id: null }, []) === null, 'projeto sem grupo: null')
  ok(estadoDaOpcao(o1, [o1]) === null, 'grupo de UMA opção não é escolha: null')
  const e1 = estadoDaOpcao(o1, [o1, o2])
  ok(e1.aceita === false && e1.grupo_tem_aceita === true && e1.total_opcoes === 2,
    `Opção 01: aceita=${e1.aceita} grupo_tem_aceita=${e1.grupo_tem_aceita}`)
  const e2 = estadoDaOpcao(o2, [o1, o2])
  ok(e2.aceita === true, 'Opção 02: aceita')
  // Irmãs de OUTRO grupo são ignoradas.
  const alheio = { proposta_grupo_id: 'g2', proposta_aceite: { aceita: true } }
  ok(estadoDaOpcao(o1, [o1, alheio]) === null,
    'projeto de outro grupo não conta como irmã')
}

// ═══ 4 · Criação — nada técnico é herdado ═══════════════════════════════════
secao('4 · `criarOpcaoFV` — a opção nova nasce vazia')
{
  const c = semComentarios(ler(CONTROLLER))
  ok(c.includes('export const criarOpcaoFV'), 'controller existe')
  ok(c.includes('export const listarOpcoesFV'), 'listagem existe')
  ok(c.includes('export const aceitarOpcaoDaProposta'), 'aceite existe')
  for (const campo of ['dimensionamento', 'engenharia_eletrica', 'unifilar', 'homologacao',
    'equipamentos', 'arranjos', 'financeiro', 'governanca', 'proposta']) {
    ok(new RegExp(`_NAO_HERDADOS_POR_OPCAO[\\s\\S]*?'${campo}'[\\s\\S]*?\\]`).test(c),
      `\`${campo}\` na lista do que NÃO é herdado`)
  }
  ok(/equipamentos: \{ paineis: \[\], inversor: \{\}, estrutura: \{\} \}/.test(c),
    'a opção nasce sem equipamentos')
  ok(/arranjos: \[\]/.test(c), 'e sem arranjos')

  // Regra 8 defendida em DOIS lugares: leitura e índice.
  ok(c.includes("codigo: 'PROPOSTA_JA_ACEITA'"), 'aceite recusa quando já há uma aceita')
  ok(c.includes('err?.code === 11000'), 'e trata a colisão do índice único (corrida)')
  // Ampliação não é opção.
  ok(c.includes('AMPLIACAO_NAO_TEM_OPCOES'), 'ampliação não recebe opções — relações diferentes')
}

// ═══ 5 · O service liga o gate ao grupo ═════════════════════════════════════
secao('5 · BaselineService — filtro correto')
{
  const s = semComentarios(ler(SERVICE))
  ok(s.includes('estadoDaOpcao'), 'usa a função pura do domínio')
  /**
   * O filtro que o service recebe é o da BASELINE (`projeto_ref`). Consultar o
   * ProjetoFV com ele não casa com nada e desliga a regra em silêncio — foi o
   * defeito da primeira versão desta sprint.
   */
  ok(/filtroProjeto\?\.projeto_ref \?\? filtroProjeto\?\._id/.test(s),
    'resolve o id do projeto por `projeto_ref`, não pelo filtro cru')
  ok(!/ProjetoFV\.findOne\(filtroProjeto\)/.test(s),
    'não consulta o ProjetoFV com o filtro da Baseline')
  ok(s.includes('empresa_id'), 'mantém o escopo de organização (M-4)')
}

// ═══ 6 · A tela não decide regra ════════════════════════════════════════════
secao('6 · A UX espelha, não decide')
{
  const t = semComentarios(ler(TELA))
  for (const proibido of ['proposta_grupo_id =', 'opcao_numero =', 'Math.', 'aceita = true']) {
    ok(!t.includes(proibido), `tela sem \`${proibido}\``)
  }
  ok(t.includes('listarOpcoes') && t.includes('criarOpcao') && t.includes('aceitarOpcao'),
    'consome os três endpoints')
  ok(/PROPOSTA_JA_ACEITA/.test(t) === false, 'não reimplementa a regra 8 — exibe o erro do servidor')
  const fluxo = ler('frontend/src/fv/fluxo.js')
  const ordem = [...fluxo.matchAll(/chave: '([a-z_]+)'/g)].map((m) => m[1])
  ok(ordem.indexOf('proposta') > ordem.indexOf('aprovacao'),
    'Proposta vem DEPOIS da Aprovação — aceitar é ato separado')
  ok(ler('frontend/src/fv/rotas.jsx').includes('path="proposta"'), 'rota registrada')
}

// ═══ 7 · Escopo ═════════════════════════════════════════════════════════════
secao('7 · Escopo')
{
  let git = null
  try { git = execSync('git status --porcelain', { cwd: RAIZ, encoding: 'utf8' }) } catch { /* fora de repo */ }
  if (git === null) ok(false, 'git indisponível')
  else {
    for (const intocado of [
      'backend/src/models/Baseline.js', 'backend/src/models/Orcamento.js',
      'backend/src/models/Cotacao.js', 'backend/src/dominio/baseline/',
      // `packages/fv-shared/` e o memorial NÃO entram nesta lista: foram
      // alterados pelas FV-DOM-031C/D, que ainda não foram commitadas. A árvore
      // acumula sprints, então "intacto no git status" só vale para arquivo que
      // nenhuma sprint anterior tocou.
    ]) {
      ok(!new RegExp(`^.M.${intocado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm').test(git),
        `intacto: ${intocado}`)
    }
    ok(!/migrat|migracao/i.test(git), 'nenhuma migração criada')
  }
  // A Baseline continua imutável: nada nesta sprint a apaga ou altera.
  const c = semComentarios(ler(CONTROLLER))
  const trecho = c.slice(c.indexOf('export const criarOpcaoFV'))
  for (const proibido of ['Baseline.delete', 'Baseline.update', 'baseline.remove']) {
    ok(!trecho.includes(proibido), `sem \`${proibido}\` (regra 7)`)
  }
}

console.log(falhas === 0
  ? '\nOK — opções isoladas, aceite único, perdedoras íntegras e bloqueadas só no Gate.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
