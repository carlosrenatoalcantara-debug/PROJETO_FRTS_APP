/**
 * auditoria-conexao-fv-ux-044.mjs — FV-UX-044
 *
 * Mede o fluxo entre Parecer confirmado e a conexão com a concessionária, nó a
 * nó do diagrama da sprint:
 *
 *   preparação documental → envio à concessionária → orçamento/taxa de conexão
 *   → acompanhamento → retorno da concessionária
 *
 * Para cada nó: existe REGRA, PERSISTÊNCIA e CAMINHO (rota + tela)?
 * Um nó só é implementável se a REGRA já existir — inventá-la seria decisão de
 * negócio disfarçada de código.
 *
 * NÃO implementa nada. Ambiente isolado (37017).
 *
 *   node backend/scripts/auditoria-conexao-fv-ux-044.mjs
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

const ler = (rel) => { try { return readFileSync(path.resolve(APP, rel), 'utf8') } catch { return '' } }
const codigo = (rel) => ler(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const SCHEMA = codigo('backend/src/models/ProjetoFV.js')
const ROTAS = ler('backend/src/routes/homologacao.js')
const UX = ler('frontend/src/fv/api/agregadosFvApi.js')

async function api(metodo, caminho, corpo) {
  const r = await fetch(`${API}${caminho}`, { method: metodo,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo) })
  const tipo = r.headers.get('content-type') ?? ''
  if (tipo.includes('json')) return { status: r.status, json: await r.json().catch(() => null) }
  return { status: r.status }
}
const salvar = (id, etapa, dados) => api('PUT', `/api/projetos-fv/${id}/etapa`, { etapa, dados })
const secao = (t) => console.log(`\n══ ${t} ${'═'.repeat(Math.max(0, 56 - t.length))}`)

const nos = []
function no(nome, { regra, persistencia, caminho, evidencia }) {
  const estado = (regra && persistencia && caminho) ? 'COMPLETO'
    : regra ? 'FALTA CAMINHO' : 'SEM REGRA'
  nos.push({ nome, regra, persistencia, caminho, estado, evidencia })
  const m = { COMPLETO: '✓', 'FALTA CAMINHO': '◐', 'SEM REGRA': '○' }[estado]
  console.log(`${m} [${regra ? 'R' : '·'}${persistencia ? 'P' : '·'}${caminho ? 'C' : '·'}] `
    + `${nome.padEnd(30)} ${evidencia}`)
}

console.log('═══ FV-UX-044 — Parecer → conexão com a concessionária ═══')
console.log('     R=regra · P=persistência · C=caminho (rota+tela)')

// ── Projeto aceito, com parecer confirmado ─────────────────────────────────
const invs = (await api('GET', '/api/equipamentos?tipo=inversor&limit=200')).json
const ZN = ((await api('GET', '/api/equipamentos?tipo=modulo&limit=50')).json?.equipamentos ?? [])
  .find((e) => e.fabricante === 'Znshine')
const SG = (invs?.equipamentos ?? invs ?? []).find((e) => e.modelo === 'SG15RT')
if (!ZN || !SG) { console.error('❌ catálogo não semeado'); process.exit(1) }
const painel = (q) => ({ id: String(ZN._id), marca: 'Znshine', modelo: ZN.modelo,
  potencia_w: 650, quantidade: q, equipamento_id: String(ZN._id) })
const inv = () => ({ id: String(SG._id), marca: SG.fabricante, modelo: SG.modelo,
  potencia_kw: 15, tipo: 'string', fases: 3, quantidade: 1, equipamento_id: String(SG._id) })

const P = (await api('POST', '/api/projetos-fv',
  { nome: `FV-UX-044 ${Date.now()}`, clienteId: cred.cliente_id })).json?._id
await salvar(P, 'fatura', { tipo_ligacao: 'Trifásico', tensao_v: 380, concessionaria: 'Cosern' })
await salvar(P, 'localizacao', { estado: 'RN' })
await salvar(P, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
await salvar(P, 'equipamentos', { paineis: [painel(24)], inversor: inv(),
  estrutura: { tipo: 'Fibrocimento', descricao: '' } })
await salvar(P, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
  paineis: [painel(24)], inversores: [inv()] }] })
const c = await api('POST', `/api/projetos-fv/${P}/cotacoes`, { tecnologia: 'fv', premissas: {} })
const o = await api('POST', `/api/projetos-fv/${P}/orcamentos`,
  { cotacao_ref: c.json?.cotacao?._id ?? c.json?._id,
    itens: [{ descricao: 'kit', quantidade: 1, valor_unitario_r: 50000, valor_total_r: 50000 }] })
const oid = o.json?.orcamento?._id ?? o.json?._id
await api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/emitir`, {})
await api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/aprovar`, {})
const P2 = (await api('POST', `/api/projetos-fv/${P}/opcoes`, {})).json?.item?._id
await salvar(P2, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
await salvar(P2, 'equipamentos', { paineis: [painel(24)], inversor: inv(),
  estrutura: { tipo: 'Laje', descricao: '' } })
await salvar(P2, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
  paineis: [painel(24)], inversores: [inv()] }] })
const c2 = await api('POST', `/api/projetos-fv/${P2}/cotacoes`, { tecnologia: 'fv', premissas: {} })
const o2 = await api('POST', `/api/projetos-fv/${P2}/orcamentos`,
  { cotacao_ref: c2.json?.cotacao?._id ?? c2.json?._id,
    itens: [{ descricao: 'kit', quantidade: 1, valor_unitario_r: 58000, valor_total_r: 58000 }] })
const oid2 = o2.json?.orcamento?._id ?? o2.json?._id
await api('POST', `/api/projetos-fv/${P2}/orcamentos/${oid2}/emitir`, {})
await api('POST', `/api/projetos-fv/${P2}/orcamentos/${oid2}/aprovar`, {})
await api('POST', `/api/projetos-fv/${P}/proposta/enviar`, {})
await api('POST', `/api/projetos-fv/${P}/proposta/aceitar`, {})
await api('POST', `/api/projetos-fv/${P}/parecer`, { metodo: 'manual', dados: {
  numero_parecer: '2409118802',
  cliente: { cpf_cnpj: '123.456.789-10', nome: 'CLIENTE' },
  uc: { numero_cliente: '2409118802', distribuidora: 'Cosern',
    tipo_ligacao: 'Trifásico', tensao_v: 380 },
  geracao: { modulos: [{ marca: 'Znshine', modelo: 'ZXM7', potencia_w: 650, quantidade: 24 }],
    inversores: [{ marca: 'Sungrow', modelo: 'SG15RT', potencia_kw: 15, quantidade: 1 }],
    potencia_instalada_kwp: 15.6 },
} })
const conf = await api('POST', `/api/projetos-fv/${P}/parecer/confirmar`, {})
console.log(`\nparecer confirmado (HTTP ${conf.status}) — projeto ${P}`)

// ═══ Ponto de partida ══════════════════════════════════════════════════════
secao('0 · O parecer confirmado é legível pelo resto do fluxo?')
{
  const g = await api('GET', `/api/projetos-fv/${P}/parecer`)
  no('Parecer confirmado', {
    regra: true, persistencia: true, caminho: true,
    evidencia: `estado=${g.json?.estado} · confirmado=${g.json?.confirmado}`,
  })
  // Alguém além da própria tela consulta o parecer?
  const consumidores = ['backend/src/utils/homologacao/homologacaoAssistida.js',
    'backend/src/controllers/homologacaoController.js']
    .filter((f) => /parecer_extracao/.test(codigo(f)))
  no('Homologação lê o parecer', {
    regra: false, persistencia: true, caminho: consumidores.length > 0,
    evidencia: consumidores.length > 0
      ? consumidores.join(', ')
      : 'NINGUÉM — o parecer confirmado não influencia checklist, validação nem estado',
  })
}

// ═══ 1 · Preparação documental ═════════════════════════════════════════════
secao('1 · Preparação documental')
{
  const ck = await api('GET', `/api/projetos-fv/${P}/homologacao/assistida/checklist`)
  const val = await api('GET', `/api/projetos-fv/${P}/homologacao/assistida/validacao`)
  const pac = await api('GET', `/api/projetos-fv/${P}/homologacao/assistida/pacote`)
  const reg = await api('GET', `/api/projetos-fv/${P}/homologacao/assistida/regras`)
  no('Checklist por concessionária', {
    regra: true, persistencia: true, caminho: /assistida/.test(UX),
    evidencia: `checklist ${ck.status} · validação ${val.status} · pacote ${pac.status}`
      + ` · regras ${reg.status} · UX chama /assistida: ${/assistida/.test(UX)}`,
  })
  const regras = reg.json?.regras ?? reg.json
  no('Regras da concessionária', {
    regra: true, persistencia: true, caminho: /assistida\/regras/.test(UX),
    evidencia: `documentos obrigatórios: `
      + `${(regras?.documentos_obrigatorios ?? []).length} · formulários: `
      + `${(regras?.formularios ?? []).length}`,
  })
}

// ═══ 2 · Envio à concessionária ════════════════════════════════════════════
secao('2 · Envio à concessionária')
{
  const prot = await api('PATCH', `/api/projetos-fv/${P}/homologacao/protocolo`,
    { numero_protocolo: 'PROT-044' })
  no('Protocolo', {
    regra: true, persistencia: /numero_protocolo/.test(SCHEMA),
    caminho: /homologacao\/protocolo/.test(UX),
    evidencia: `HTTP ${prot.status} · histórico ${prot.json?.protocolo_historico?.length ?? 0}`,
  })
  const st = await api('PATCH', `/api/projetos-fv/${P}/homologacao/assistida/status`,
    { status: 'pendente_concessionaria' })
  no('Estado "na concessionária"', {
    regra: true, persistencia: /status_homologacao/.test(SCHEMA),
    caminho: /assistida\/status/.test(UX),
    evidencia: `HTTP ${st.status} · a UX ${/assistida\/status/.test(UX) ? 'chama' : 'NÃO chama'}`,
  })
  // Data de envio existe?
  no('Data de envio', {
    regra: true, persistencia: /data_envio/.test(SCHEMA), caminho: /data_envio/.test(UX),
    evidencia: `campo data_envio no schema: ${/data_envio/.test(SCHEMA)}`
      + ` · exposto na UX: ${/data_envio/.test(UX)}`,
  })
}

// ═══ 3 · Orçamento / taxa de conexão ═══════════════════════════════════════
secao('3 · Orçamento / taxa de conexão')
{
  const buscas = ['taxa_conexao', 'custo_conexao', 'orcamento_conexao', 'valor_conexao',
    'taxa_disponibilidade', 'obra_conexao']
  const noSchema = buscas.filter((b) => new RegExp(b, 'i').test(SCHEMA))
  const naRota = buscas.filter((b) => new RegExp(b, 'i').test(ROTAS))
  const noProvider = buscas.filter((b) =>
    new RegExp(b, 'i').test(codigo('backend/src/utils/homologacao/concessionariaProvider.js')))
  no('Taxa/orçamento de conexão', {
    regra: false, persistencia: noSchema.length > 0, caminho: naRota.length > 0,
    evidencia: `schema: ${noSchema.join(',') || 'nada'} · rota: ${naRota.join(',') || 'nada'}`
      + ` · provider: ${noProvider.join(',') || 'nada'}`,
  })
  // O agregado Orcamento serve? É comercial, do cliente.
  const orcModel = codigo('backend/src/models/Orcamento.js')
  no('Reuso do agregado Orcamento', {
    regra: false, persistencia: true, caminho: true,
    evidencia: `existe, mas é o orçamento COMERCIAL (INV-ORC-3: um aprovado por `
      + `projeto, vira Baseline). Tipo de despesa: `
      + `${/tipo:\s*\{[^}]*enum:\s*\[[^\]]*servico/.test(orcModel) ? 'material/servico' : 'n/d'}`,
  })
  console.log('   ⇒ nenhuma regra diz quem paga, quando cobra, se entra no orçamento')
  console.log('     do cliente, ou o que acontece quando a taxa inviabiliza a venda.')
}

// ═══ 4 · Acompanhamento ════════════════════════════════════════════════════
secao('4 · Acompanhamento do processo')
{
  const p = (await api('GET', `/api/projetos-fv/${P}`)).json
  const h = (p?.projeto ?? p)?.homologacao ?? {}
  no('Histórico de estados', {
    regra: true, persistencia: /historico_status/.test(SCHEMA),
    caminho: /historico_status/.test(UX),
    evidencia: `${h.historico_status?.length ?? 0} transição(ões) registradas`
      + ` · exposto na UX: ${/historico_status/.test(UX)}`,
  })
  const provider = codigo('backend/src/utils/homologacao/concessionariaProvider.js')
  no('Prazo / SLA da concessionária', {
    regra: /prazo|sla|dias/i.test(provider), persistencia: false, caminho: false,
    evidencia: /prazo|sla|dias/i.test(provider)
      ? 'o provider declara prazo'
      : 'o provider NÃO declara prazo — nada mede atraso',
  })
}

// ═══ 5 · Retorno da concessionária ═════════════════════════════════════════
secao('5 · Retorno da concessionária')
{
  const a = await api('PATCH', `/api/projetos-fv/${P}/homologacao/assistida/status`,
    { status: 'homologado' })
  const r = await api('PATCH', `/api/projetos-fv/${P}/homologacao/assistida/status`,
    { status: 'reprovado', motivo: 'documentação incompleta' })
  no('Deferido / indeferido', {
    regra: true, persistencia: /status_homologacao/.test(SCHEMA),
    caminho: /assistida\/status/.test(UX),
    evidencia: `homologado ${a.status} · reprovado ${r.status}`
      + ` · motivo registrado: ${/motivo/.test(SCHEMA)}`,
  })
  const legado = await api('PATCH', `/api/projetos-fv/${P}/homologacao/status`,
    { status: 'conectado' })
  no('Conexão efetivada', {
    regra: true, persistencia: true, caminho: /homologacao\/status/.test(UX),
    evidencia: `estado "conectado" (máquina legada) → HTTP ${legado.status}`,
  })
}

// ═══ 6 · Duas máquinas de estado ═══════════════════════════════════════════
secao('6 · Quantas máquinas de estado a homologação tem?')
{
  const legado = (SCHEMA.match(/enum: \['rascunho', 'enviado', 'analise', 'aprovado', 'conectado'\]/) ?? [])[0]
  const assistida = /status_homologacao/.test(SCHEMA)
  console.log(`   legada     : rascunho → enviado → analise → aprovado → conectado`)
  console.log(`   assistida  : nao_iniciado → em_preparacao → pendente_documentacao →`)
  console.log(`                pendente_engenharia → pendente_concessionaria → homologado/reprovado`)
  const p = (await api('GET', `/api/projetos-fv/${P}`)).json
  const h = (p?.projeto ?? p)?.homologacao ?? {}
  console.log(`   estado atual do projeto: status="${h.status}" · `
    + `status_homologacao="${h.status_homologacao}"`)
  no('Máquina de estado única', {
    regra: false, persistencia: !!(legado && assistida), caminho: true,
    evidencia: 'DUAS máquinas coexistem e podem divergir — nenhuma regra as concilia',
  })
}

// ═══ RESUMO ════════════════════════════════════════════════════════════════
secao('RESUMO')
for (const e of ['COMPLETO', 'FALTA CAMINHO', 'SEM REGRA']) {
  const l = nos.filter((n) => n.estado === e)
  console.log(`${{ COMPLETO: '✓', 'FALTA CAMINHO': '◐', 'SEM REGRA': '○' }[e]} ${e.padEnd(14)} ${l.length}`)
}
const implementaveis = nos.filter((n) => n.regra && !n.caminho)
console.log('\n── COM regra, sem caminho (implementável) ──')
console.log(implementaveis.length === 0 ? '   nenhum'
  : implementaveis.map((n) => `   ${n.nome} — ${n.evidencia}`).join('\n'))
const semRegra = nos.filter((n) => !n.regra)
console.log('\n── SEM regra (exige decisão de negócio) ──')
for (const n of semRegra) console.log(`   ${n.nome} — ${n.evidencia}`)

console.log('\n─── fim da auditoria — nada foi implementado ───')
console.log(`   projeto: ${P}`)
