/**
 * validacao-fv-ux-038.mjs — FV-UX-038
 *
 * Prova que as cinco divergências da FV-UX-037 foram fechadas, e que nada do
 * que já funcionava mudou:
 *
 *   D1 · quantidade e pluralidade de inversores vêm da composição canônica
 *   D2 · "Outro" sem descrição é recusado pela API, não só pela tela
 *   D3 · o checklist lê concessionária/UF do projeto
 *   D4 · o tracking do envio é do GRUPO, não da irmã sorteada
 *   D5 · projeto micro sem topologia autorada não cai no motor de string
 *
 * Cenário obrigatório da sprint: 24 × Znshine 650 W + 8 × Hoymiles HMS-2000-4T.
 *
 * Ambiente isolado (37017), backend com SMTP_USER="" SMTP_PASS="".
 *
 *   node backend/scripts/validacao-fv-ux-038.mjs
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFParse } from 'pdf-parse'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cred = JSON.parse(readFileSync(path.join(RAIZ, '.ambiente-validacao.json'), 'utf8'))
const TOKEN = readFileSync(path.join(RAIZ, '.token-validacao'), 'utf8').trim()
const API = 'http://127.0.0.1:5001'
if (!cred.uri.includes('37017')) { console.error('❌ só no isolado'); process.exit(1) }

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n══ ${t}`)

async function api(metodo, caminho, corpo, token = TOKEN) {
  const r = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  const tipo = r.headers.get('content-type') ?? ''
  if (tipo.includes('json')) return { status: r.status, json: await r.json().catch(() => null) }
  const buf = Buffer.from(await r.arrayBuffer())
  return { status: r.status, buf, bytes: buf.length }
}
const publico = (m, c, b) => fetch(`${API}${c}`, { method: m,
  headers: { 'Content-Type': 'application/json' },
  body: b === undefined ? undefined : JSON.stringify(b) })
  .then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }))
const salvar = (id, etapa, dados) => api('PUT', `/api/projetos-fv/${id}/etapa`, { etapa, dados })
async function textoPDF(buf) {
  const p = new PDFParse({ data: buf })
  try { return (await p.getText()).text.replace(/-- \d+ of \d+ --/g, ' ') } finally { await p.destroy() }
}

console.log('═══ FV-UX-038 — correção das divergências E2E ═══')

const invs = (await api('GET', '/api/equipamentos?tipo=inversor&limit=200')).json
const ZN = ((await api('GET', '/api/equipamentos?tipo=modulo&limit=50')).json?.equipamentos ?? [])
  .find((e) => e.fabricante === 'Znshine')
const SG = (invs?.equipamentos ?? invs ?? []).find((e) => e.modelo === 'SG15RT')
const MICRO = (invs?.equipamentos ?? invs ?? []).find((e) => e.modelo === 'HMS-2000-4T')
ok(!!ZN && !!SG && !!MICRO, 'catálogo semeado')
if (!ZN || !SG || !MICRO) process.exit(1)

const painel = (q) => ({ id: String(ZN._id), marca: 'Znshine', modelo: ZN.modelo,
  potencia_w: 650, quantidade: q, equipamento_id: String(ZN._id) })
const invDe = (eq, q, tipo) => ({ id: String(eq._id), marca: eq.fabricante, modelo: eq.modelo,
  potencia_kw: tipo === 'micro' ? 2 : 15, tipo, fases: tipo === 'micro' ? 1 : 3,
  quantidade: q, equipamento_id: String(eq._id) })

async function novo(nome) {
  const P = (await api('POST', '/api/projetos-fv',
    { nome: `${nome} ${Date.now()}`, clienteId: cred.cliente_id })).json?._id
  await salvar(P, 'fatura', { tipo_ligacao: 'Monofásico', tensao_v: 220, concessionaria: 'Neoenergia' })
  await salvar(P, 'localizacao', { estado: 'RN' })
  return P
}
async function aprovar(P, valor) {
  const c = await api('POST', `/api/projetos-fv/${P}/cotacoes`, { tecnologia: 'fv', premissas: {} })
  const cid = c.json?.cotacao?._id ?? c.json?._id
  const o = await api('POST', `/api/projetos-fv/${P}/orcamentos`, { cotacao_ref: cid,
    itens: [{ descricao: 'kit', quantidade: 1, valor_unitario_r: valor, valor_total_r: valor }] })
  const oid = o.json?.orcamento?._id ?? o.json?._id
  await api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/emitir`, {})
  return api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/aprovar`, {})
}

// ═══ D1 · CENÁRIO OBRIGATÓRIO: 24 × Znshine 650 W + 8 × Hoymiles ═══════════
secao('D1 · 24 × Znshine 650 W + 8 × Hoymiles HMS-2000-4T')
const PM = await novo('FV-UX-038 micro')
{
  await salvar(PM, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
  await salvar(PM, 'equipamentos', { paineis: [painel(24)], inversor: invDe(MICRO, 8, 'micro'),
    estrutura: { tipo: 'Fibrocimento', descricao: '' } })
  await salvar(PM, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
    paineis: [painel(24)], inversores: [invDe(MICRO, 8, 'micro')],
    configuracao_eletrica: { micros: [{ equipamento_id: String(MICRO._id),
      marca: MICRO.fabricante, modelo: MICRO.modelo, quantidade: 8,
      entradas_por_micro: 4, modulos_por_entrada: 1,
      distribuicao: [3, 3, 3, 3, 3, 3, 3, 3] }] } }] })
  await aprovar(PM, 60000)

  // O PDF é o consumidor mais visível.
  const g = await api('POST', `/api/projetos-fv/${PM}/proposta/gerar`, {})
  const t = await textoPDF(g.buf)
  ok(/24 módulos Znshine/.test(t), `PDF: 24 módulos Znshine`)
  ok(/8 × Hoymiles HMS-2000-4T/.test(t), 'PDF: 8 × Hoymiles HMS-2000-4T')
  ok(/Microinversores/.test(t), 'PDF: seção "Microinversores"')

  // A listagem e o snapshot do envio precisam dizer o mesmo.
  const PO = (await api('POST', `/api/projetos-fv/${PM}/opcoes`, {})).json?.item?._id
  await salvar(PO, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
  await salvar(PO, 'equipamentos', { paineis: [painel(24)], inversor: invDe(SG, 1, 'string'),
    estrutura: { tipo: 'Laje', descricao: '' } })
  await salvar(PO, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
    paineis: [painel(24)], inversores: [invDe(SG, 1, 'string')] }] })
  await aprovar(PO, 52000)

  const lista = await api('GET', `/api/projetos-fv/${PM}/opcoes`)
  const op1 = (lista.json?.opcoes ?? []).find((o) => String(o._id) === String(PM))
  ok(Array.isArray(op1?.inversores), 'listagem devolve `inversores[]`')
  ok(op1?.inversores?.[0]?.quantidade === 8,
    `listagem: quantidade = ${op1?.inversores?.[0]?.quantidade} (esperado 8)`)
  ok(op1?.inversor === MICRO.modelo,
    `listagem mantém resumo legível: "${op1?.inversor}"`)

  const env = await api('POST', `/api/projetos-fv/${PM}/proposta/enviar`, {})
  const pag = await publico('GET', `/api/publico/proposta-fv/${env.json?.token}`)
  const snapMicro = (pag.json?.snapshot?.opcoes ?? []).find((o) => String(o.projeto_ref) === String(PM))
  ok(snapMicro?.inversores?.[0]?.quantidade === 8,
    `snapshot do cliente: ${snapMicro?.inversores?.[0]?.quantidade} × ${snapMicro?.inversores?.[0]?.modelo}`)
  ok(snapMicro?.modulos?.[0]?.quantidade === 24,
    `snapshot do cliente: ${snapMicro?.modulos?.[0]?.quantidade} módulos`)
  ok(snapMicro?.inversor === MICRO.modelo, 'snapshot mantém `inversor` (compat)')

  // Nenhuma segunda quantidade foi criada em `equipamentos.inversor`.
  const p = (await api('GET', `/api/projetos-fv/${PM}`)).json
  ok((p?.projeto ?? p)?.equipamentos?.inversor?.quantidade === undefined,
    'nenhuma segunda quantidade em `equipamentos.inversor`')
}

// ═══ D1B · Múltiplos modelos de inversor ═══════════════════════════════════
secao('D1B · Dois modelos de inversor no mesmo projeto')
{
  const PD = await novo('FV-UX-038 dois inversores')
  await salvar(PD, 'dimensionamento', { num_paineis: 40, potencia_kwp: 26 })
  await salvar(PD, 'equipamentos', { paineis: [painel(40)], inversor: invDe(SG, 2, 'string'),
    estrutura: { tipo: 'Metálico', descricao: '' } })
  await salvar(PD, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
    paineis: [painel(40)],
    inversores: [invDe(SG, 2, 'string'), invDe(MICRO, 4, 'micro')] }] })
  await aprovar(PD, 90000)

  const g = await api('POST', `/api/projetos-fv/${PD}/proposta/gerar`, {})
  const t = await textoPDF(g.buf)
  ok(/2 × Sungrow SG15RT/.test(t), 'PDF: 2 × Sungrow SG15RT')
  ok(/4 × Hoymiles HMS-2000-4T/.test(t), 'PDF: o SEGUNDO modelo também aparece')

  const lista = await api('GET', `/api/projetos-fv/${PD}/opcoes`)
  ok(lista.status === 200, 'listagem responde para projeto sem grupo')
}

// ═══ D2 · "Outro" exige descrição — na API ═════════════════════════════════
secao('D2 · A regra da estrutura vale na API')
{
  const PE = await novo('FV-UX-038 estrutura')
  const mau = await salvar(PE, 'equipamentos', { paineis: [painel(10)],
    inversor: invDe(SG, 1, 'string'), estrutura: { tipo: 'Outro', descricao: '' } })
  ok(mau.status === 400 && mau.json?.codigo === 'ESTRUTURA_INVALIDA',
    `"Outro" sem descrição → HTTP ${mau.status} · ${mau.json?.codigo}`)

  const bom = await salvar(PE, 'equipamentos', { paineis: [painel(10)],
    inversor: invDe(SG, 1, 'string'), estrutura: { tipo: 'Outro', descricao: 'Trapezoidal' } })
  ok(bom.status === 200, `"Outro" COM descrição → HTTP ${bom.status}`)

  const ausente = await salvar(PE, 'equipamentos', { paineis: [painel(10)],
    inversor: invDe(SG, 1, 'string'), estrutura: { tipo: '', descricao: '' } })
  ok(ausente.status === 200, `estrutura AUSENTE continua sendo lacuna, não erro → HTTP ${ausente.status}`)

  // Valor LEGADO fora da lista continua aceito e intacto — garantia da
  // FV-UX-030 (§5), que a primeira versão desta regra quebrou.
  const legado = await salvar(PE, 'equipamentos', { paineis: [painel(10)],
    inversor: invDe(SG, 1, 'string'), estrutura: { tipo: 'Mini Trilho', descricao: '' } })
  ok(legado.status === 200, `tipo legado fora da lista → HTTP ${legado.status}`)
  const pl = (await api('GET', `/api/projetos-fv/${PE}`)).json
  ok((pl?.projeto ?? pl)?.equipamentos?.estrutura?.tipo === 'Mini Trilho',
    'e é devolvido sem reclassificação')

  const semEstrutura = await salvar(PE, 'dimensionamento', { num_paineis: 10, potencia_kwp: 6.5 })
  ok(semEstrutura.status === 200, 'outras etapas não são afetadas')
}

// ═══ D3 · Checklist lê a concessionária do projeto ═════════════════════════
secao('D3 · O checklist conhece a concessionária do projeto')
{
  const ck = await api('GET', `/api/projetos-fv/${PM}/homologacao/checklist`)
  ok(ck.json?.checklist?.concessionaria === 'Neoenergia',
    `sem query: concessionaria = "${ck.json?.checklist?.concessionaria}"`)
  ok(ck.json?.checklist?.estado === 'RN',
    `sem query: estado = "${ck.json?.checklist?.estado}"`)

  const forcado = await api('GET',
    `/api/projetos-fv/${PM}/homologacao/checklist?estado=SP&concessionaria=Enel`)
  ok(forcado.json?.checklist?.concessionaria === 'Enel',
    'a query continua tendo precedência (compat)')
}

// ═══ D4 · Tracking é do GRUPO ══════════════════════════════════════════════
secao('D4 · O tracking do envio é do grupo, não da irmã sorteada')
{
  const PG = await novo('FV-UX-038 grupo')
  await salvar(PG, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
  await salvar(PG, 'equipamentos', { paineis: [painel(24)], inversor: invDe(SG, 1, 'string'),
    estrutura: { tipo: 'Fibrocimento', descricao: '' } })
  await salvar(PG, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
    paineis: [painel(24)], inversores: [invDe(SG, 1, 'string')] }] })
  const PG2 = (await api('POST', `/api/projetos-fv/${PG}/opcoes`, {})).json?.item?._id
  await salvar(PG2, 'dimensionamento', { num_paineis: 30, potencia_kwp: 19.5 })
  await salvar(PG2, 'equipamentos', { paineis: [painel(30)], inversor: invDe(SG, 1, 'string'),
    estrutura: { tipo: 'Laje', descricao: '' } })
  await salvar(PG2, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
    paineis: [painel(30)], inversores: [invDe(SG, 1, 'string')] }] })
  await aprovar(PG, 50000)
  await aprovar(PG2, 64500)

  const env = await api('POST', `/api/projetos-fv/${PG}/proposta/enviar`, {})
  const tok = env.json?.token

  // O cliente abre o link DUAS vezes.
  await publico('GET', `/api/publico/proposta-fv/${tok}`)
  await publico('GET', `/api/publico/proposta-fv/${tok}`)

  const vistas = []
  for (const P of [PG, PG2]) {
    const e = await api('GET', `/api/projetos-fv/${P}/proposta/envio`)
    vistas.push(e.json?.ultimo?.visualizacoes ?? 0)
  }
  ok(vistas.every((v) => v === 2),
    `todas as irmãs enxergam as 2 aberturas: ${vistas.join(' / ')}`)
  const e2 = await api('GET', `/api/projetos-fv/${PG2}/proposta/envio`)
  ok(!!e2.json?.ultimo?.ultimo_acesso,
    `a irmã que NÃO recebeu o incremento tem a data: ${e2.json?.ultimo?.ultimo_acesso}`)

  // E o aceite continua funcionando pelo público.
  const a = await publico('POST', `/api/publico/proposta-fv/${tok}/aceitar`,
    { projeto_ref: String(PG2) })
  ok(a.status === 200, `aceite público → HTTP ${a.status}`)
}

// ═══ D5 · Micro sem topologia não vira string ══════════════════════════════
secao('D5 · Projeto micro SEM topologia autorada')
{
  const PS = await novo('FV-UX-038 micro sem topologia')
  await salvar(PS, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
  await salvar(PS, 'equipamentos', { paineis: [painel(24)], inversor: invDe(MICRO, 8, 'micro'),
    estrutura: { tipo: 'Fibrocimento', descricao: '' } })
  await salvar(PS, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
    paineis: [painel(24)], inversores: [invDe(MICRO, 8, 'micro')] }] })   // SEM micros[]

  const u = await api('POST', `/api/projetos-fv/${PS}/unifilar/gerar`, {})
  const lac = u.json?.lacunas ?? []
  ok(u.json?.especificacoes?.topologia === 'micro',
    `topologia = ${u.json?.especificacoes?.topologia} (era "string")`)
  ok(!lac.includes('arranjoMPPTs'),
    `NÃO exige MPPT de um sistema sem MPPT: ${JSON.stringify(lac)}`)
  ok(lac.includes('topologiaMicro') || lac.includes('configuracao_eletrica.micros'),
    'declara a lacuna da topologia micro')
  ok(!/MPPT 1|MPPT 2/.test(u.json?.svg ?? ''),
    'o desenho não inventa MPPT')

  // Com a topologia autorada, nada mudou.
  const u2 = await api('POST', `/api/projetos-fv/${PM}/unifilar/gerar`, {})
  ok(u2.json?.especificacoes?.topologia === 'micro' && (u2.json?.lacunas ?? []).length === 0,
    `micro COM topologia: lacunas ${JSON.stringify(u2.json?.lacunas)}`)

  // E o caminho STRING continua idêntico.
  const PT = await novo('FV-UX-038 string')
  await salvar(PT, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
  await salvar(PT, 'equipamentos', { paineis: [painel(24)], inversor: invDe(SG, 1, 'string'),
    estrutura: { tipo: 'Fibrocimento', descricao: '' } })
  await salvar(PT, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
    paineis: [painel(24)], inversores: [invDe(SG, 1, 'string')] }] })
  const u3 = await api('POST', `/api/projetos-fv/${PT}/unifilar/gerar`, {})
  ok((u3.json?.lacunas ?? []).includes('arranjoMPPTs'),
    `string sem MPPT CONTINUA exigindo arranjoMPPTs: ${JSON.stringify(u3.json?.lacunas)}`)
  ok(u3.json?.especificacoes?.topologia === undefined,
    'o caminho string não ganhou campo novo')
}

console.log(falhas === 0
  ? '\nOK — D1 a D5 fechadas, sem segunda fonte de verdade e sem mexer no que já valia.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
