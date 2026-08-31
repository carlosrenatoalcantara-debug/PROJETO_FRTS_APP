/**
 * auditoria-envio-fv-ux-035.mjs — FV-UX-035
 *
 * Mede — não lê — o que existe hoje entre a proposta montada e o aceite:
 *
 *   1. o PDF da proposta é gerável por opção?
 *   2. existe transporte de e-mail? em que estado?
 *   3. existe link público / token de acesso do cliente?
 *   4. existe QUALQUER registro do ato de envio?
 *   5. o aceite exige envio prévio? (regra principal da sprint)
 *   6. a UX nova alcança alguma dessas coisas?
 *
 * NÃO implementa nada. Ambiente isolado (37017).
 *
 *   node backend/scripts/auditoria-envio-fv-ux-035.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FRONT = path.resolve(RAIZ, '../frontend/src')
const cred = JSON.parse(readFileSync(path.join(RAIZ, '.ambiente-validacao.json'), 'utf8'))
const TOKEN = readFileSync(path.join(RAIZ, '.token-validacao'), 'utf8').trim()
const API = 'http://127.0.0.1:5001'
if (!cred.uri.includes('37017')) { console.error('❌ só no isolado'); process.exit(1) }

const h = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
async function api(metodo, caminho, corpo) {
  const r = await fetch(`${API}${caminho}`, { method: metodo, headers: h,
    body: corpo === undefined ? undefined : JSON.stringify(corpo) })
  const tipo = r.headers.get('content-type') ?? ''
  let json = null, bytes = 0
  if (tipo.includes('json')) { try { json = await r.json() } catch { /* vazio */ } }
  else { bytes = (await r.arrayBuffer()).byteLength }
  return { status: r.status, json, bytes, tipo }
}
const salvar = (id, etapa, dados) => api('PUT', `/api/projetos-fv/${id}/etapa`, { etapa, dados })
const secao = (t) => console.log(`\n══ ${t}`)
const achado = (existe, o) => console.log(`${existe ? '●' : '○'} ${o}`)

const ler = (rel) => { try { return readFileSync(path.resolve(RAIZ, rel), 'utf8') } catch { return '' } }
const lerFront = (rel) => { try { return readFileSync(path.resolve(FRONT, rel), 'utf8') } catch { return '' } }
/** Varre todo o frontend atrás de um padrão — a UX alcança isto? */
function frontContem(re, dir = FRONT) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (frontContem(re, p)) return true; continue }
    if (!/\.(js|jsx)$/.test(e.name)) continue
    if (re.test(readFileSync(p, 'utf8'))) return true
  }
  return false
}

console.log('═══ FV-UX-035 — auditoria: envio da proposta ao cliente ═══')

// ── Monta uma proposta real com duas opções ────────────────────────────────
const invs = (await api('GET', '/api/equipamentos?tipo=inversor&limit=200')).json
const ZN = ((await api('GET', '/api/equipamentos?tipo=modulo&limit=50')).json?.equipamentos ?? [])
  .find((e) => e.fabricante === 'Znshine')
const SG = (invs?.equipamentos ?? invs ?? []).find((e) => e.modelo === 'SG15RT')
if (!ZN || !SG) { console.error('❌ catálogo não semeado'); process.exit(1) }

const painel = () => ({ id: String(ZN._id), marca: 'Znshine', modelo: ZN.modelo,
  potencia_w: 650, quantidade: 24, equipamento_id: String(ZN._id) })
const comp = () => ({ id: String(SG._id), marca: SG.fabricante, modelo: SG.modelo,
  potencia_kw: 15, tipo: 'string', fases: 3, quantidade: 1, equipamento_id: String(SG._id) })

async function montar(nome) {
  const P = (await api('POST', '/api/projetos-fv',
    { nome: `${nome} ${Date.now()}`, clienteId: cred.cliente_id })).json?._id
  await salvar(P, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
  await salvar(P, 'fatura', { tipo_ligacao: 'Trifásico', tensao_v: 380, concessionaria: 'Neoenergia' })
  await salvar(P, 'localizacao', { estado: 'RN' })
  await salvar(P, 'equipamentos', { paineis: [painel()], inversor: comp(),
    estrutura: { tipo: 'Fibrocimento', descricao: '' } })
  await salvar(P, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
    paineis: [painel()], inversores: [comp()] }] })
  return P
}
async function aprovarOrcamento(P, valor) {
  const c = await api('POST', `/api/projetos-fv/${P}/cotacoes`, { tecnologia: 'fv', premissas: {} })
  const cid = c.json?.cotacao?._id ?? c.json?._id
  const o = await api('POST', `/api/projetos-fv/${P}/orcamentos`, { cotacao_ref: cid,
    itens: [{ descricao: 'kit', quantidade: 1, valor_unitario_r: valor, valor_total_r: valor }] })
  const oid = o.json?.orcamento?._id ?? o.json?._id
  await api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/emitir`, {})
  return (await api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/aprovar`, {})).status
}

const P1 = await montar('FV-UX-035 auditoria')
const P2 = (await api('POST', `/api/projetos-fv/${P1}/opcoes`, {})).json?.item?._id
await salvar(P2, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
await salvar(P2, 'equipamentos', { paineis: [painel()], inversor: comp(),
  estrutura: { tipo: 'Fibrocimento', descricao: '' } })
await salvar(P2, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
  paineis: [painel()], inversores: [comp()] }] })
await aprovarOrcamento(P1, 50000)
await aprovarOrcamento(P2, 58000)
console.log(`\nproposta montada — Opção 01 ${P1} · Opção 02 ${P2}`)

// ═══ 1 · PDF da proposta ═══════════════════════════════════════════════════
secao('1 · PDF da proposta')
{
  const g = await api('POST', `/api/projetos-fv/${P1}/proposta/gerar`, {})
  achado(g.status === 200 && g.bytes > 0,
    `POST /proposta/gerar → HTTP ${g.status}, ${g.bytes} bytes (${g.tipo || 'sem tipo'})`)
  const v = await api('POST', `/api/projetos-fv/${P2}/proposta/visualizar`, {})
  achado(v.status === 200 && !!v.json?.pdf_base64,
    `POST /proposta/visualizar (Opção 02) → HTTP ${v.status}, base64 ${
      v.json?.pdf_base64 ? `${v.json.pdf_base64.length} chars` : 'ausente'}`)
  achado(v.status === 200, 'o PDF é POR OPÇÃO — cada irmã gera o seu')
  const d = await api('GET', `/api/projetos-fv/${P1}/proposta/download`)
  achado(d.status === 200, `GET /proposta/download → HTTP ${d.status} (arquivo salvo em disco)`)
}

// ═══ 2 · Transporte de e-mail ══════════════════════════════════════════════
secao('2 · Transporte de e-mail')
{
  const src = ler('src/services/mailService.js')
  achado(src.includes('nodemailer'), 'mailService.js existe e usa nodemailer (SMTP Zoho)')
  achado(src.includes("motivo: 'SMTP não configurado'"),
    'degrada com segurança: sem credencial NÃO lança, devolve { enviado:false }')
  achado(!!process.env.SMTP_USER && !!process.env.SMTP_PASS,
    `credencial SMTP no ambiente: ${process.env.SMTP_USER ? 'presente' : 'AUSENTE'}`)
  const usos = ['gestao.js', 'auth-security.js']
    .filter((f) => /enviarEmail/.test(ler(`src/routes/${f}`)))
  achado(usos.length > 0, `quem já envia e-mail hoje: ${usos.join(', ') || 'ninguém'}`)
  achado(/enviarEmail/.test(ler('src/controllers/projetosFVController.js')),
    'algum controller FV envia e-mail')
}

// ═══ 3 · Link público / token do cliente ═══════════════════════════════════
secao('3 · Link público para o cliente')
{
  const mail = ler('src/services/mailService.js')
  achado(mail.includes('export function gerarToken'),
    'helpers de token existem (gerarToken/hashToken, SHA-256, só o hash persiste)')
  const gestao = ler('src/routes/gestao.js')
  achado(gestao.includes('reset_token_hash') && gestao.includes('APP_URL'),
    'precedente de link com token: convite/reset em gestao.js')
  const modelo = ler('src/models/ProjetoFV.js')
  achado(/token/i.test(modelo), 'ProjetoFV tem campo de token de acesso')
  const server = ler('src/server.js')
  achado(/publica|public\b/i.test(server), 'existe rota pública (sem autenticação) montada')
}

// ═══ 4 · Registro do ato de envio ══════════════════════════════════════════
secao('4 · Registro do ato de envio')
{
  const modelo = ler('src/models/ProjetoFV.js')
  achado(/proposta_envio|enviada_em|proposta_status/.test(modelo),
    'ProjetoFV registra envio da proposta')
  achado(readdirSync(path.join(RAIZ, 'src/models')).some((f) => /proposta/i.test(f)),
    `modelo dedicado de proposta: ${
      readdirSync(path.join(RAIZ, 'src/models')).filter((f) => /proposta/i.test(f)).join(', ') || 'nenhum'}`)
  const rotas = ler('src/routes/projetosFV.js')
  achado(/proposta\/enviar/.test(rotas), 'rota POST /proposta/enviar')
  const p = (await api('GET', `/api/projetos-fv/${P1}`)).json
  const proj = p?.projeto ?? p
  achado(Object.keys(proj ?? {}).some((k) => /envio|enviad/i.test(k)),
    `campos de envio no documento devolvido: ${
      Object.keys(proj ?? {}).filter((k) => /envio|enviad/i.test(k)).join(', ') || 'nenhum'}`)
}

// ═══ 5 · A regra principal da sprint vale hoje? ════════════════════════════
secao('5 · O aceite exige envio prévio?')
{
  const a = await api('POST', `/api/projetos-fv/${P2}/proposta/aceitar`, {})
  achado(a.status !== 200,
    `aceite SEM nenhum envio → HTTP ${a.status}${a.json?.codigo ? ` · ${a.json.codigo}` : ''}`)
  console.log(a.status === 200
    ? '   ⇒ LACUNA: a proposta é aceita sem nunca ter sido disponibilizada ao cliente.'
    : '   ⇒ a regra já vale.')
}

// ═══ 6 · A UX nova alcança algo disso? ═════════════════════════════════════
secao('6 · Alcance da UX nova (/fv)')
{
  achado(frontContem(/proposta\/(gerar|visualizar|download)/),
    'a UX chama o PDF da proposta')
  achado(frontContem(/proposta\/enviar|enviarProposta/), 'a UX tem ação de enviar')
  const etapa = lerFront('fv/paginas/etapas/EtapaProposta.jsx')
  achado(/aceitarOpcao/.test(etapa), 'a UX tem ação de aceitar (existe hoje)')
  achado(frontContem(/PropostaPublica|proposta-publica/), 'existe tela pública do cliente')
}

// ═══ 7 · O mecanismo QUE JÁ EXISTE alcança uma opção canônica? ═════════════
// Achado central: compartilhamento público de proposta EXISTE inteiro
// (token + snapshot congelado + página do cliente + tracking). A pergunta é se
// ele funciona para uma opção criada pelo fluxo /fv da FV-DOM-032.
secao('7 · O compartilhamento existente alcança a opção canônica?')
{
  const c = await api('POST', `/api/projetos-fv/${P1}/governanca/comercial/compartilhar`,
    { validade_dias: 30 })
  achado(c.status === 200,
    `POST /governanca/comercial/compartilhar → HTTP ${c.status}${
      c.json?.codigo ? ` · ${c.json.codigo}` : ''}`)
  if (c.status !== 200) {
    console.log(`   ⇒ ${c.json?.erro}`)
    console.log('   ⇒ o link público exige FREEZE da governança comercial LEGADA,')
    console.log('     que o fluxo /fv nunca aciona: orçamento aprovado ≠ proposta congelada.')
  }

  // O que o /fv produz chega a `governanca.comercial`?
  const p = (await api('GET', `/api/projetos-fv/${P1}`)).json
  const com = (p?.projeto ?? p)?.governanca?.comercial ?? null
  achado(!!com, `o projeto /fv tem governanca.comercial: ${
    com ? `workflow_status=${com.workflow_status ?? 'null'}` : 'ausente'}`)
  achado(!!com?.snapshot_comercial, 'tem snapshot_comercial congelado')
  achado(Array.isArray(com?.compartilhamentos) && com.compartilhamentos.length > 0,
    `compartilhamentos existentes: ${com?.compartilhamentos?.length ?? 0}`)

  // O compartilhamento é por PROJETO. A proposta da FV-DOM-032 é o GRUPO.
  achado(/grupo/i.test(ler('src/routes/publico.js')),
    'a rota pública conhece o conceito de GRUPO de opções')
  const ctrl = ler('src/controllers/projetosFVController.js')
  const trecho = ctrl.slice(ctrl.indexOf('criarCompartilhamento'), ctrl.indexOf('obterPropostaPublica'))
  achado(/proposta_grupo_id/.test(trecho), 'criarCompartilhamento conhece proposta_grupo_id')
}

console.log(`\n─── fim da auditoria — nada foi implementado ───`)
