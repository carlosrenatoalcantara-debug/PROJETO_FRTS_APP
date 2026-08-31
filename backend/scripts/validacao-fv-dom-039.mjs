/**
 * validacao-fv-dom-039.mjs — FV-DOM-039
 *
 * Prova que a regra da estrutura tem UMA definição e que ela decide igual dos
 * dois lados:
 *
 *   1. o SSOT decide a tabela da sprint, caso a caso;
 *   2. backend e frontend importam a MESMA função — identidade de referência,
 *      não "mesmo resultado por coincidência";
 *   3. a API se comporta conforme a tabela;
 *   4. o vocabulário do wizard legado foi preservado;
 *   5. nenhum default foi criado e nenhum valor legado é reclassificado.
 *
 * Ambiente isolado (37017), backend com SMTP_USER="" SMTP_PASS="".
 *
 *   node backend/scripts/validacao-fv-dom-039.mjs
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP = path.resolve(RAIZ, '..')
const cred = JSON.parse(readFileSync(path.join(RAIZ, '.ambiente-validacao.json'), 'utf8'))
const TOKEN = readFileSync(path.join(RAIZ, '.token-validacao'), 'utf8').trim()
const API = 'http://127.0.0.1:5001'
if (!cred.uri.includes('37017')) { console.error('❌ só no isolado'); process.exit(1) }

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n══ ${t}`)
const api = async (metodo, caminho, corpo) => {
  const r = await fetch(`${API}${caminho}`, { method: metodo,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo) })
  return { status: r.status, json: await r.json().catch(() => null) }
}
const salvar = (id, etapa, dados) => api('PUT', `/api/projetos-fv/${id}/etapa`, { etapa, dados })

console.log('═══ FV-DOM-039 — regra da estrutura unificada no SSOT ═══')

// ═══ 1 · A tabela da sprint, decidida pelo SSOT ════════════════════════════
secao('1 · O SSOT decide a tabela da sprint')
const ssot = await import('@fortesolar/fv-shared/estrutura')
{
  const casos = [
    ['Outro + descrição', { tipo: 'Outro', descricao: 'Trapezoidal' }, true, 0],
    ['Outro sem descrição', { tipo: 'Outro', descricao: '' }, false, 0],
    ['Fibrocimento', { tipo: 'Fibrocimento', descricao: '' }, true, 0],
    ['Mini Trilho (histórico)', { tipo: 'Mini Trilho', descricao: '' }, true, 0],
    ['estrutura ausente', { tipo: '', descricao: '' }, true, 1],
  ]
  for (const [rot, entrada, valida, nLacunas] of casos) {
    const r = ssot.validarEstrutura(entrada)
    ok(r.valida === valida && r.lacunas.length === nLacunas,
      `${rot.padEnd(24)} → valida=${r.valida} lacunas=${r.lacunas.length}`
      + `${r.erros.length ? ` erro="${r.erros[0]}"` : ''}`)
  }
  ok(ssot.validarEstrutura({ tipo: 'Outro', descricao: '  ' }).valida === false,
    'descrição só com espaços não conta como descrição')
  ok(ssot.tipoForaDaLista('Mini Trilho') === true
    && ssot.rotuloDaEstrutura('Mini Trilho') === 'Mini Trilho',
    'valor legado é reconhecido como fora da lista e exibido COMO VEIO')
  ok(ssot.estruturaVazia().tipo === '',
    'ausente é vazio — nunca "Fibrocimento" por omissão')
}

// ═══ 2 · Uma definição, não duas iguais ════════════════════════════════════
secao('2 · Backend e frontend usam a MESMA função')
{
  const back = await import('../src/dominio/estrutura/index.js')
  ok(back.validarEstrutura === ssot.validarEstrutura,
    'backend reexporta a função do SSOT (identidade, não cópia)')
  ok(back.TIPOS_ESTRUTURA === ssot.TIPOS_ESTRUTURA,
    'e a MESMA lista de tipos')
  ok(back.exigeDescricao === ssot.exigeDescricao, 'e a mesma `exigeDescricao`')

  // O frontend não é importável aqui (alias do Vite), então a garantia é de
  // fonte: ele reexporta e não redefine. A suíte /fv exercita o comportamento.
  const front = readFileSync(path.resolve(APP, 'frontend/src/fv/estrutura.js'), 'utf8')
  ok(/from '@fortesolar\/fv-shared\/estrutura'/.test(front),
    'frontend importa o SSOT')
  ok(!/function validarEstrutura|function exigeDescricao/.test(front),
    'e não redefine a regra')
  ok(!/const TIPOS_ESTRUTURA\s*=\s*Object\.freeze\(\[/.test(front),
    'nem a lista de tipos')
}

// ═══ 3 · A API se comporta conforme a tabela ═══════════════════════════════
secao('3 · A API decide igual ao SSOT')
{
  const P = (await api('POST', '/api/projetos-fv',
    { nome: `FV-DOM-039 ${Date.now()}`, clienteId: cred.cliente_id })).json?._id
  const painel = { id: 'm', marca: 'Znshine', modelo: 'ZXM7', potencia_w: 650, quantidade: 10 }
  const salvarEstrutura = (estrutura) => salvar(P, 'equipamentos', { paineis: [painel], estrutura })

  const casos = [
    ['Outro + descrição', { tipo: 'Outro', descricao: 'Trapezoidal' }, 200],
    ['Outro sem descrição', { tipo: 'Outro', descricao: '' }, 400],
    ['Fibrocimento', { tipo: 'Fibrocimento', descricao: '' }, 200],
    ['Mini Trilho (histórico)', { tipo: 'Mini Trilho', descricao: '' }, 200],
    ['estrutura ausente', { tipo: '', descricao: '' }, 200],
  ]
  for (const [rot, estrutura, esperado] of casos) {
    const r = await salvarEstrutura(estrutura)
    ok(r.status === esperado, `${rot.padEnd(24)} → HTTP ${r.status} (esperado ${esperado})`)
  }

  // O legado volta intacto — garantia da FV-UX-030 §5.
  await salvarEstrutura({ tipo: 'Mini Trilho', descricao: '' })
  const p = (await api('GET', `/api/projetos-fv/${P}`)).json
  ok((p?.projeto ?? p)?.equipamentos?.estrutura?.tipo === 'Mini Trilho',
    'e "Mini Trilho" volta sem reclassificação')

  const err = await salvarEstrutura({ tipo: 'Outro', descricao: '' })
  ok(err.json?.erro === 'Tipo "Outro" exige descrição da estrutura.',
    `a mensagem é a MESMA do SSOT: "${err.json?.erro}"`)
  ok(err.json?.codigo === 'ESTRUTURA_INVALIDA', `código: ${err.json?.codigo}`)
}

// ═══ 4 · Vocabulário do wizard legado ══════════════════════════════════════
secao('4 · Vocabulário preservado')
{
  const legado = readFileSync(
    path.resolve(APP, 'frontend/src/components/fv/SeletorEstrutura.jsx'), 'utf8')
  for (const v of ['Fibrocimento', 'Cerâmico', 'Metálico', 'Laje', 'Solo']) {
    ok(ssot.TIPOS_ESTRUTURA.some((x) => x.valor === v) && legado.includes(`tipo: '${v}'`),
      `${v}: no SSOT e no wizard legado, mesmo termo`)
  }
  ok(ssot.TIPOS_ESTRUTURA.length === 6,
    `6 tipos, como antes: ${ssot.TIPOS_ESTRUTURA.map((x) => x.valor).join(', ')}`)
}

// ═══ 5 · Nenhum default ════════════════════════════════════════════════════
secao('5 · Nenhum default foi criado')
{
  const fonte = readFileSync(
    path.resolve(APP, 'packages/fv-shared/equipamentos/estrutura.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const v of ['Fibrocimento', 'Cerâmico', 'Metálico', 'Laje', 'Solo', 'Outro']) {
    ok(!new RegExp(`\\?\\?\\s*'${v}'|\\|\\|\\s*'${v}'`).test(fonte),
      `sem default para '${v}'`)
  }
  ok(ssot.daEquipamentos(null).tipo === '', 'projeto sem equipamentos → vazio, não assumido')
  ok(ssot.daEquipamentos({ estrutura: { tipo: 'Mini Trilho' } }).tipo === 'Mini Trilho',
    'e o legado atravessa `daEquipamentos` intacto')
}

console.log(falhas === 0
  ? '\nOK — uma definição, mesma decisão dos dois lados, comportamento inalterado.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
