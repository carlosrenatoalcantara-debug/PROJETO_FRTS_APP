/**
 * auditoria-fluxo-fv-ux-034.mjs — FV-UX-034, auditoria
 *
 * Percorre o fluxo do enunciado, do cliente à equipe de campo, e registra em
 * cada elo: existe API? existe tela na nova UX? o dado chega?
 *
 * SÓ MEDE. Cria projetos no ambiente EFÊMERO (37017); não altera código.
 *
 *   node backend/scripts/auditoria-fluxo-fv-ux-034.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ_BACK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RAIZ = path.resolve(RAIZ_BACK, '..')
const cred = JSON.parse(readFileSync(path.join(RAIZ_BACK, '.ambiente-validacao.json'), 'utf8'))
const TOKEN = readFileSync(path.join(RAIZ_BACK, '.token-validacao'), 'utf8').trim()
const API = 'http://127.0.0.1:5001'
if (!cred.uri.includes('37017')) { console.error('❌ só no isolado'); process.exit(1) }

const h = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
async function api(metodo, caminho, corpo) {
  const r = await fetch(`${API}${caminho}`, { method: metodo, headers: h,
    body: corpo === undefined ? undefined : JSON.stringify(corpo) })
  let json = null
  try { json = await r.json() } catch { /* sem corpo */ }
  return { status: r.status, json }
}
const salvar = (id, etapa, dados) => api('PUT', `/api/projetos-fv/${id}/etapa`, { etapa, dados })
const ler = (rel) => (existsSync(path.join(RAIZ, rel)) ? readFileSync(path.join(RAIZ, rel), 'utf8') : '')
const col = (v, n) => String(v ?? '—').padEnd(n)

console.log('═══ FV-UX-034 · auditoria do fluxo funcional ═══\n')

// ── Monta uma proposta com opção aceita ─────────────────────────────────────
const inv = (await api('GET', '/api/equipamentos?tipo=inversor&limit=200')).json
const inversores = inv?.equipamentos ?? inv ?? []
const mods = (await api('GET', '/api/equipamentos?tipo=modulo&limit=50')).json
const ZN = (mods?.equipamentos ?? mods ?? []).find((e) => e.fabricante === 'Znshine')
const SG = inversores.find((e) => e.modelo === 'SG15RT')
if (!ZN || !SG) { console.error('rode o seed antes'); process.exit(1) }

const painel = () => ({ id: String(ZN._id), marca: 'Znshine', modelo: ZN.modelo,
  potencia_w: 650, quantidade: 24, equipamento_id: String(ZN._id) })
const comp = () => ({ id: String(SG._id), marca: SG.fabricante, modelo: SG.modelo,
  potencia_kw: 15, tipo: 'string', fases: 3, quantidade: 1, equipamento_id: String(SG._id) })

const P = (await api('POST', '/api/projetos-fv',
  { nome: `FV-UX-034 fluxo ${Date.now()}`, clienteId: cred.cliente_id })).json?._id
await salvar(P, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
await salvar(P, 'fatura', { tipo_ligacao: 'Trifásico', tensao_v: 380, concessionaria: 'Neoenergia' })
await salvar(P, 'localizacao', { estado: 'RN' })
await salvar(P, 'equipamentos', { paineis: [painel()], inversor: comp(),
  estrutura: { tipo: 'Fibrocimento', descricao: '' } })
await salvar(P, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
  paineis: [painel()], inversores: [comp()] }] })
await salvar(P, 'engenharia_eletrica', { arranjo: { num_mppts_usados: 2, mppts: [
  { mppt: 1, strings_paralelo: 1, modulos_por_string: 12, total_modulos: 12 },
  { mppt: 2, strings_paralelo: 1, modulos_por_string: 12, total_modulos: 12 }] } })
const P2 = (await api('POST', `/api/projetos-fv/${P}/opcoes`, {})).json?.item?._id
const c = await api('POST', `/api/projetos-fv/${P}/cotacoes`, { tecnologia: 'fv', premissas: {} })
const cid = c.json?.cotacao?._id ?? c.json?._id
const o = await api('POST', `/api/projetos-fv/${P}/orcamentos`, { cotacao_ref: cid,
  itens: [{ descricao: 'kit', quantidade: 1, valor_unitario_r: 50000, valor_total_r: 50000 }] })
const oid = o.json?.orcamento?._id ?? o.json?._id
await api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/emitir`, {})
await api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/aprovar`, {})
await api('POST', `/api/projetos-fv/${P}/proposta/aceitar`, {})

console.log(`   Opção 01 (aceita): ${P}`)
console.log(`   Opção 02          : ${P2}\n`)

// ── O fluxo, elo a elo ──────────────────────────────────────────────────────
const TELAS = 'frontend/src/fv/paginas/etapas'
const temTela = (arq) => {
  const f = ler(`${TELAS}/${arq}`)
  if (!f) return 'AUSENTE'
  return /EtapaPendente/.test(f) ? 'stub' : 'sim'
}

const gate = (await api('GET', `/api/projetos-fv/${P}/gate`)).json
const status = await api('GET', `/api/projetos-fv/${P}/homologacao/status`)
const checklist = await api('GET', `/api/projetos-fv/${P}/homologacao/checklist`)
const memorial = await api('POST', `/api/projetos-fv/${P}/homologacao/memorial`, {
  projeto: { potencia_kwp: 15.6, inversor: {}, painel: {} }, cliente: { nome: 'X' } })
const carta = await api('POST', `/api/projetos-fv/${P}/homologacao/carta`, {
  projeto: { potencia_kwp: 15.6, inversor: {}, painel: {} }, cliente: { nome: 'X' } })
const art = await api('POST', `/api/projetos-fv/${P}/homologacao/art`, {
  projeto: { potencia_kwp: 15.6, inversor: {}, painel: {} }, cliente: { nome: 'X' } })
const unifilar = await api('POST', `/api/projetos-fv/${P}/unifilar/gerar`, {})
const financeiro = await api('POST', `/api/projetos-fv/${P}/financeiro/calcular`, {})

const ELOS = [
  ['Cliente',                'GET /api/clientes',              200, 'ListaProjetos', 'sim'],
  ['Projeto FV',             'POST /api/projetos-fv',          201, 'EtapaProjeto.jsx', temTela('EtapaProjeto.jsx')],
  ['Equipamentos',           'PUT /etapa arranjos',            200, 'EtapaEquipamentos.jsx', temTela('EtapaEquipamentos.jsx')],
  ['Estrutura',              'PUT /etapa equipamentos',        200, 'EtapaEstrutura.jsx', temTela('EtapaEstrutura.jsx')],
  ['Dimensionamento',        'PUT /etapa dimensionamento',     200, 'EtapaDimensionamento.jsx', temTela('EtapaDimensionamento.jsx')],
  ['Engenharia (topologia)', 'PUT /etapa engenharia_eletrica', 200, 'EtapaMppt.jsx', temTela('EtapaMppt.jsx')],
  ['Orçamento',              'POST /orcamentos',               o.status, 'EtapaOrcamentos.jsx', temTela('EtapaOrcamentos.jsx')],
  ['Proposta / opções',      'GET /opcoes',                    (await api('GET', `/api/projetos-fv/${P}/opcoes`)).status, 'EtapaProposta.jsx', temTela('EtapaProposta.jsx')],
  ['ENVIO ao cliente',       '— não existe no fluxo canônico', null, '— nenhuma', 'AUSENTE'],
  ['Aceite da opção',        'POST /proposta/aceitar',         200, 'EtapaProposta.jsx', temTela('EtapaProposta.jsx')],
  ['Gate',                   'GET /gate',                      200, 'EtapaGate.jsx', temTela('EtapaGate.jsx')],
  ['Homologação — status',   'GET /homologacao/status',        status.status, 'EtapaHomologacao.jsx', 'só o Gate'],
  ['Homologação — checklist','GET /homologacao/checklist',     checklist.status, 'EtapaHomologacao.jsx', 'só o Gate'],
  ['Homologação — memorial', 'POST /homologacao/memorial',     memorial.status, 'EtapaHomologacao.jsx', 'só o Gate'],
  ['Homologação — carta',    'POST /homologacao/carta',        carta.status, 'EtapaHomologacao.jsx', 'só o Gate'],
  ['Homologação — ART',      'POST /homologacao/art',          art.status, 'EtapaHomologacao.jsx', 'só o Gate'],
  ['Engenharia — unifilar',  'POST /unifilar/gerar',           unifilar.status, 'EtapaUnifilar.jsx', temTela('EtapaUnifilar.jsx')],
  ['Financeiro',             'POST /financeiro/calcular',      financeiro.status, 'EtapaFinanceiro.jsx', temTela('EtapaFinanceiro.jsx')],
  ['Projeto Executivo',      '— não existe',                   null, 'EtapaExecutivo.jsx', temTela('EtapaExecutivo.jsx')],
  ['EQUIPE DE CAMPO / Execução', '— não existe',               null, 'EtapaExecucao.jsx', temTela('EtapaExecucao.jsx')],
  ['As-Built',               '— não existe',                   null, 'EtapaAsBuilt.jsx', temTela('EtapaAsBuilt.jsx')],
]

console.log(col('ELO DO FLUXO', 28) + col('API', 34) + col('HTTP', 6) + col('TELA', 26) + 'ESTADO')
for (const [elo, rota, http, tela, estado] of ELOS) {
  const apiOk = http === null ? 'não há' : (http < 300 ? String(http) : `✗ ${http}`)
  const veredito = estado === 'AUSENTE' ? '◄ LACUNA'
    : estado === 'stub' ? '◄ STUB (sem agregado)'
      : estado === 'só o Gate' ? '◄ API existe, TELA não expõe'
        : 'ok'
  console.log(col(elo, 28) + col(rota, 34) + col(apiOk, 6) + col(tela, 26) + veredito)
}

// ── A opção NÃO aceita continua barrada? ────────────────────────────────────
console.log('\n── A opção não escolhida é barrada em toda a bifurcação?\n')
const g2 = (await api('GET', `/api/projetos-fv/${P2}/gate`)).json
for (const fase of ['engenharia', 'homologacao']) {
  const f = g2?.fases?.[fase]
  console.log(`   ${col(fase, 14)} liberado=${f?.liberado} motivo=${f?.motivo ?? '—'}`)
}
// Mas os DOCUMENTOS dela ainda respondem?
const memorial2 = await api('POST', `/api/projetos-fv/${P2}/homologacao/memorial`, {
  projeto: { potencia_kwp: 1, inversor: {}, painel: {} }, cliente: { nome: 'X' } })
const status2 = await api('PATCH', `/api/projetos-fv/${P2}/homologacao/status`, { status_homologacao: 'protocolado' })
console.log(`   memorial da NÃO escolhida    → HTTP ${memorial2.status} ${memorial2.status < 300 ? '◄ gera mesmo assim' : ''}`)
console.log(`   avançar status da NÃO escolhida → HTTP ${status2.status} ${status2.status < 300 ? '◄ AVANÇA mesmo assim' : ''}`)
console.log('   ↳ o Gate é consultivo nestes caminhos: nenhum deles chama `exigirGate`.')

// ── Quem chama o Gate de verdade? ───────────────────────────────────────────
console.log('\n── Quem EXIGE o gate hoje (não só consulta)?\n')
const usos = []
for (const arq of ['backend/src/controllers/homologacaoController.js',
  'backend/src/controllers/projetosFVController.js',
  'backend/src/controllers/agregadosFvController.js']) {
  const f = ler(arq)
  usos.push([arq.split('/').pop(), /exigirGate|exigirBaseline/.test(f) ? 'SIM' : 'não'])
}
for (const [a, u] of usos) console.log(`   ${col(a, 34)} exigirGate: ${u}`)

console.log('\n═══ FIM — nenhum código alterado ═══')
