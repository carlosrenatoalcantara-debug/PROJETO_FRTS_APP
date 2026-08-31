/**
 * auditoria-e2e-fv-ux-037.mjs — FV-UX-037
 *
 * Percorre o fluxo canônico INTEIRO e mede cada nó do diagrama, comparando
 * arquitetura × código × produto final. NÃO implementa nada.
 *
 *   CLIENTE → PROJETO → EQUIPAMENTOS → ESTRUTURA → DIMENSIONAMENTO →
 *   TOPOLOGIA (string ∥ micro) → ENGENHARIA → ORÇAMENTO → PROPOSTA (N opções +
 *   PDF) → ENVIO → ACEITE → ⑂ HOMOLOGAÇÃO ∥ ENGENHARIA → CONEXÃO → EXECUÇÃO →
 *   AS-BUILT
 *
 * Ambiente isolado (37017), backend com SMTP neutralizado.
 *
 *   node backend/scripts/auditoria-e2e-fv-ux-037.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFParse } from 'pdf-parse'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP = path.resolve(RAIZ, '..')
const cred = JSON.parse(readFileSync(path.join(RAIZ, '.ambiente-validacao.json'), 'utf8'))
const TOKEN = readFileSync(path.join(RAIZ, '.token-validacao'), 'utf8').trim()
const API = 'http://127.0.0.1:5001'
if (!cred.uri.includes('37017')) { console.error('❌ só no isolado'); process.exit(1) }

// ── Instrumentos ────────────────────────────────────────────────────────────
const linhas = []
const OK = 'OK', LACUNA = 'LACUNA', DIVERG = 'DIVERGE', STUB = 'STUB'
function nota(no, estado, evidencia) {
  linhas.push({ no, estado, evidencia })
  const marca = { OK: '✓', LACUNA: '○', DIVERGE: '⚠', STUB: '◌' }[estado]
  console.log(`${marca} ${no.padEnd(38)} ${evidencia}`)
}
const secao = (t) => console.log(`\n══ ${t} ${'═'.repeat(Math.max(0, 60 - t.length))}`)

async function api(metodo, caminho, corpo, token = TOKEN) {
  const r = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  const tipo = r.headers.get('content-type') ?? ''
  if (tipo.includes('json')) return { status: r.status, json: await r.json().catch(() => null), tipo }
  const buf = Buffer.from(await r.arrayBuffer())
  return { status: r.status, buf, bytes: buf.length, tipo }
}
const publico = (m, c, b) => fetch(`${API}${c}`, { method: m,
  headers: { 'Content-Type': 'application/json' },
  body: b === undefined ? undefined : JSON.stringify(b) })
  .then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }))
const salvar = (id, etapa, dados) => api('PUT', `/api/projetos-fv/${id}/etapa`, { etapa, dados })
const ler = (rel) => { try { return readFileSync(path.resolve(APP, rel), 'utf8') } catch { return '' } }
async function textoPDF(buf) {
  const p = new PDFParse({ data: buf })
  try { return (await p.getText()).text.replace(/-- \d+ of \d+ --/g, ' ') } finally { await p.destroy() }
}

console.log('═══ FV-UX-037 — auditoria do fluxo FV end-to-end ═══')

// ── Catálogo ────────────────────────────────────────────────────────────────
const invs = (await api('GET', '/api/equipamentos?tipo=inversor&limit=200')).json
const mods = (await api('GET', '/api/equipamentos?tipo=modulo&limit=50')).json
const ZN = (mods?.equipamentos ?? []).find((e) => e.fabricante === 'Znshine')
const SG = (invs?.equipamentos ?? invs ?? []).find((e) => e.modelo === 'SG15RT')
const SG2 = (invs?.equipamentos ?? invs ?? []).find((e) => e.modelo && e.modelo !== 'SG15RT'
  && String(e.especificacoes?.tipo ?? '').toLowerCase() !== 'microinversor')
const MICRO = (invs?.equipamentos ?? invs ?? []).find((e) => e.modelo === 'HMS-2000-4T')
if (!ZN || !SG || !MICRO) { console.error('❌ catálogo não semeado'); process.exit(1) }

const painel = (q) => ({ id: String(ZN._id), marca: 'Znshine', modelo: ZN.modelo,
  potencia_w: 650, quantidade: q, equipamento_id: String(ZN._id) })
const invDe = (eq, q, tipo) => ({ id: String(eq._id), marca: eq.fabricante, modelo: eq.modelo,
  potencia_kw: tipo === 'micro' ? 2 : 15, tipo, fases: tipo === 'micro' ? 1 : 3,
  quantidade: q, equipamento_id: String(eq._id) })

// ═══ 1 · CLIENTE → PROJETO ═════════════════════════════════════════════════
secao('1 · CLIENTE → PROJETO FV')
let P1 = null
{
  const cli = await api('GET', `/api/clientes/${cred.cliente_id}`)
  nota('Cliente existe e é legível', cli.status === 200 ? OK : LACUNA, `HTTP ${cli.status}`)

  const r = await api('POST', '/api/projetos-fv',
    { nome: `FV-UX-037 ${Date.now()}`, clienteId: cred.cliente_id })
  P1 = r.json?._id
  nota('Projeto nasce vinculado ao cliente', P1 ? OK : LACUNA, `HTTP ${r.status} · ${P1}`)

  const semCliente = await api('POST', '/api/projetos-fv', { nome: 'sem cliente' })
  nota('Projeto SEM cliente é recusado', semCliente.status >= 400 ? OK : DIVERG,
    `HTTP ${semCliente.status}`)
}

// ═══ 2 · EQUIPAMENTOS ══════════════════════════════════════════════════════
secao('2 · EQUIPAMENTOS — N modelos + quantidades')
{
  await salvar(P1, 'fatura', { tipo_ligacao: 'Trifásico', tensao_v: 380, concessionaria: 'Neoenergia' })
  await salvar(P1, 'localizacao', { estado: 'RN' })

  // O diagrama pede N MODELOS de módulo e N MODELOS de inversor.
  const doisModulos = [painel(12), { ...painel(12), modelo: `${ZN.modelo}-B` }]
  const r = await salvar(P1, 'equipamentos', {
    paineis: doisModulos,
    inversor: invDe(SG, 1, 'string'),
    estrutura: { tipo: 'Fibrocimento', descricao: '' },
  })
  const p = (await api('GET', `/api/projetos-fv/${P1}`)).json
  const proj = p?.projeto ?? p
  const paineisSalvos = proj?.equipamentos?.paineis ?? []
  nota('Módulos: N modelos', paineisSalvos.length >= 2 ? OK : DIVERG,
    `${paineisSalvos.length} modelo(s) persistido(s) · HTTP ${r.status}`)
  nota('Módulos: quantidade por modelo',
    paineisSalvos.every((x) => Number.isFinite(x.quantidade)) ? OK : DIVERG,
    `quantidades: ${paineisSalvos.map((x) => x.quantidade).join(' / ')}`)

  const inv = proj?.equipamentos?.inversor
  nota('Inversores: N modelos', Array.isArray(inv) ? OK : DIVERG,
    Array.isArray(inv) ? `${inv.length} modelos` : '`equipamentos.inversor` é objeto ÚNICO, não lista')
  nota('Inversores: quantidade', inv?.quantidade !== undefined ? OK : DIVERG,
    inv?.quantidade === undefined ? '`quantidade` NÃO é persistida neste subdoc' : String(inv.quantidade))

  // Onde a quantidade realmente vive:
  await salvar(P1, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
    paineis: doisModulos, inversores: [invDe(SG, 2, 'string'), invDe(SG2 ?? SG, 1, 'string')] }] })
  const p2 = (await api('GET', `/api/projetos-fv/${P1}`)).json
  const arr = ((p2?.projeto ?? p2)?.arranjos ?? [])[0]
  nota('Composição: N inversores no arranjo',
    (arr?.inversores?.length ?? 0) >= 2 ? OK : DIVERG,
    `arranjos[0].inversores = ${arr?.inversores?.length ?? 0}, com quantidade `
    + `${arr?.inversores?.map((i) => i.quantidade).join('/')}`)
}

// ═══ 3 · ESTRUTURA ═════════════════════════════════════════════════════════
secao('3 · ESTRUTURA')
{
  const p = (await api('GET', `/api/projetos-fv/${P1}`)).json
  const est = (p?.projeto ?? p)?.equipamentos?.estrutura
  nota('Estrutura persistida', est?.tipo ? OK : LACUNA, `tipo = ${est?.tipo}`)
  nota('Etapa `estrutura` própria no PUT /etapa', DIVERG,
    'não existe — grava dentro de `equipamentos` (decisão FV-UX-030)')
  const semDescricao = await salvar(P1, 'equipamentos', {
    paineis: [painel(24)], inversor: invDe(SG, 1, 'string'),
    estrutura: { tipo: 'Outro', descricao: '' } })
  nota('"Outro" exige descrição', semDescricao.status >= 400 ? OK : DIVERG,
    `HTTP ${semDescricao.status}`)
  await salvar(P1, 'equipamentos', { paineis: [painel(24)], inversor: invDe(SG, 1, 'string'),
    estrutura: { tipo: 'Fibrocimento', descricao: '' } })
  await salvar(P1, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
    paineis: [painel(24)], inversores: [invDe(SG, 1, 'string')] }] })
}

// ═══ 4 · DIMENSIONAMENTO ═══════════════════════════════════════════════════
secao('4 · DIMENSIONAMENTO')
{
  const r = await salvar(P1, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
  const p = (await api('GET', `/api/projetos-fv/${P1}`)).json
  const d = (p?.projeto ?? p)?.dimensionamento
  nota('Dimensionamento persistido', d?.potencia_kwp ? OK : LACUNA,
    `${d?.num_paineis} módulos · ${d?.potencia_kwp} kWp · HTTP ${r.status}`)
  const totais = await api('GET', `/api/projetos-fv/${P1}/totais`)
  nota('Totais derivados pelo servidor', totais.status === 200 ? OK : LACUNA,
    `HTTP ${totais.status}`)
}

// ═══ 5 · TOPOLOGIA ═════════════════════════════════════════════════════════
secao('5 · TOPOLOGIA — string (MPPT→strings→módulos)')
{
  const r = await salvar(P1, 'engenharia_eletrica', { arranjo: { num_mppts_usados: 2,
    mppts: [{ mppt: 1, strings_paralelo: 1, modulos_por_string: 12, total_modulos: 12 },
      { mppt: 2, strings_paralelo: 1, modulos_por_string: 12, total_modulos: 12 }] } })
  const p = (await api('GET', `/api/projetos-fv/${P1}`)).json
  const mppts = (p?.projeto ?? p)?.engenharia_eletrica?.arranjo?.mppts ?? []
  nota('MPPT → strings → módulos', mppts.length === 2 ? OK : LACUNA,
    `${mppts.length} MPPT · ${mppts.map((m) => `${m.strings_paralelo}s×${m.modulos_por_string}`).join(' + ')}`
    + ` · HTTP ${r.status}`)
}

secao('5B · TOPOLOGIA — micro (micros→entradas→módulos)')
let PM = null
{
  PM = (await api('POST', '/api/projetos-fv',
    { nome: `FV-UX-037 micro ${Date.now()}`, clienteId: cred.cliente_id })).json?._id
  await salvar(PM, 'fatura', { tipo_ligacao: 'Monofásico', tensao_v: 220, concessionaria: 'Neoenergia' })
  await salvar(PM, 'localizacao', { estado: 'RN' })
  await salvar(PM, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
  await salvar(PM, 'equipamentos', { paineis: [painel(24)], inversor: invDe(MICRO, 8, 'micro'),
    estrutura: { tipo: 'Fibrocimento', descricao: '' } })
  const r = await salvar(PM, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
    paineis: [painel(24)], inversores: [invDe(MICRO, 8, 'micro')],
    configuracao_eletrica: { micros: [{ equipamento_id: String(MICRO._id),
      marca: MICRO.fabricante, modelo: MICRO.modelo, quantidade: 8,
      entradas_por_micro: 4, modulos_por_entrada: 1,
      distribuicao: [3, 3, 3, 3, 3, 3, 3, 3] }] } }] })
  const p = (await api('GET', `/api/projetos-fv/${PM}`)).json
  const micros = ((p?.projeto ?? p)?.arranjos ?? [])[0]?.configuracao_eletrica?.micros ?? []
  nota('micros → entradas → módulos', micros.length > 0 ? OK : LACUNA,
    `${micros[0]?.quantidade} micros × ${micros[0]?.entradas_por_micro} entradas · `
    + `distribuição ${JSON.stringify(micros[0]?.distribuicao)} · HTTP ${r.status}`)
}

// ═══ 6 · ENGENHARIA ════════════════════════════════════════════════════════
secao('6 · ENGENHARIA — validação, unifilar, memorial')
{
  for (const [rot, P] of [['string', P1], ['micro', PM]]) {
    const u = await api('POST', `/api/projetos-fv/${P}/unifilar/gerar`, {})
    const svg = u.json?.svg ?? ''
    nota(`Unifilar (${rot})`, u.status === 200 && svg.length > 0 ? OK : LACUNA,
      `HTTP ${u.status} · ${svg.length} bytes · lacunas ${JSON.stringify(u.json?.lacunas ?? [])}`)
    nota(`  ↳ desenho é da topologia ${rot}`,
      rot === 'micro'
        ? (/MICROINVERSORES|MI-1/.test(svg) ? OK : DIVERG)
        : (/MPPT/.test(svg) ? OK : DIVERG),
      rot === 'micro' ? `contém símbolo de micro: ${/MI-1/.test(svg)}` : `contém MPPT: ${/MPPT/.test(svg)}`)
  }
  const comp = await api('POST', `/api/projetos-fv/${P1}/financeiro/calcular`, {})
  nota('Validação elétrica exposta', comp.status < 500 ? OK : LACUNA, `HTTP ${comp.status}`)
}

// ═══ 7 · ORÇAMENTO ═════════════════════════════════════════════════════════
secao('7 · ORÇAMENTO')
async function aprovar(P, valor) {
  const c = await api('POST', `/api/projetos-fv/${P}/cotacoes`, { tecnologia: 'fv', premissas: {} })
  const cid = c.json?.cotacao?._id ?? c.json?._id
  const o = await api('POST', `/api/projetos-fv/${P}/orcamentos`, { cotacao_ref: cid,
    itens: [{ descricao: 'kit', quantidade: 1, valor_unitario_r: valor, valor_total_r: valor }] })
  const oid = o.json?.orcamento?._id ?? o.json?._id
  await api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/emitir`, {})
  return api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/aprovar`, {})
}
{
  const a = await aprovar(P1, 50000)
  nota('Cotação → Orçamento → Aprovação', a.status === 200 ? OK : LACUNA, `HTTP ${a.status}`)
  const b = await api('GET', `/api/projetos-fv/${P1}/baseline`)
  nota('Baseline congelada na aprovação', b.json?.baseline?.hash ? OK : LACUNA,
    `hash ${b.json?.baseline?.hash?.slice(0, 12) ?? '—'}`)
  const segundo = await aprovar(P1, 51000)
  nota('INV-ORC-3: um só APROVADO por projeto', segundo.status >= 400 ? OK : DIVERG,
    `segundo aprovar → HTTP ${segundo.status}`)
  const vig = await api('GET', `/api/projetos-fv/${P1}/orcamentos/vigente`)
  const total = vig.json?.orcamento?.totais?.total_venda_r ?? vig.json?.totais?.total_venda_r
  nota('Total do orçamento é legível', total != null ? OK : DIVERG,
    total != null ? `R$ ${total}` : 'totais NÃO vêm no payload de `/orcamentos/vigente`')
}

// ═══ 8 · PROPOSTA COM OPÇÕES ═══════════════════════════════════════════════
secao('8 · PROPOSTA — N opções + PDF por opção')
let P2 = null, P3 = null
{
  P2 = (await api('POST', `/api/projetos-fv/${P1}/opcoes`, {})).json?.item?._id
  await salvar(P2, 'dimensionamento', { num_paineis: 30, potencia_kwp: 19.5 })
  await salvar(P2, 'equipamentos', { paineis: [painel(30)], inversor: invDe(MICRO, 8, 'micro'),
    estrutura: { tipo: 'Laje', descricao: '' } })
  await salvar(P2, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
    paineis: [painel(30)], inversores: [invDe(MICRO, 8, 'micro')] }] })
  await aprovar(P2, 64500)

  // O diagrama diz "N opções" — a terceira prova que não há teto em 2.
  const r3 = await api('POST', `/api/projetos-fv/${P1}/opcoes`, {})
  P3 = r3.json?.item?._id
  nota('N opções (3ª)', P3 ? OK : DIVERG, `HTTP ${r3.status} · ${P3 ?? r3.json?.erro}`)
  if (P3) {
    await salvar(P3, 'dimensionamento', { num_paineis: 20, potencia_kwp: 13 })
    await salvar(P3, 'equipamentos', { paineis: [painel(20)], inversor: invDe(SG, 1, 'string'),
      estrutura: { tipo: 'Metálico', descricao: '' } })
    await salvar(P3, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
      paineis: [painel(20)], inversores: [invDe(SG, 1, 'string')] }] })
    await aprovar(P3, 41000)
  }

  const lista = await api('GET', `/api/projetos-fv/${P1}/opcoes`)
  nota('Listagem agrupa o grupo', (lista.json?.opcoes?.length ?? 0) >= 3 ? OK : DIVERG,
    `${lista.json?.opcoes?.length} opções · rótulos `
    + `${lista.json?.opcoes?.map((o) => o.opcao_rotulo).join(', ')}`)
  nota('  ↳ preço por opção na listagem',
    (lista.json?.opcoes ?? []).every((o) => o.orcamento?.total_venda_r != null) ? OK : DIVERG,
    (lista.json?.opcoes ?? []).map((o) => o.orcamento?.total_venda_r).join(' / '))

  // PDF por opção
  const textos = {}
  for (const [rot, P] of [['Opção 01', P1], ['Opção 02', P2], ['Opção 03', P3]]) {
    if (!P) continue
    const g = await api('POST', `/api/projetos-fv/${P}/proposta/gerar`, {})
    textos[rot] = g.buf ? await textoPDF(g.buf) : ''
    nota(`PDF ${rot}`, g.status === 200 && g.bytes > 0 ? OK : LACUNA,
      `HTTP ${g.status} · ${g.bytes} bytes · identifica-se: ${new RegExp(rot).test(textos[rot])}`)
  }
  const cruzamento = /Laje/.test(textos['Opção 01'] ?? '') || /Metálico/.test(textos['Opção 01'] ?? '')
  nota('  ↳ sem mistura entre opções', cruzamento ? DIVERG : OK,
    cruzamento ? 'a Opção 01 traz dado de irmã' : 'cada PDF traz só o seu')
}

// ═══ 9 · ENVIO ═════════════════════════════════════════════════════════════
secao('9 · ENVIO AO CLIENTE — link público do grupo')
let TOKEN_PUB = null
{
  const antes = await api('POST', `/api/projetos-fv/${P2}/proposta/aceitar`, {})
  nota('Aceite ANTES do envio é barrado', antes.json?.codigo === 'PROPOSTA_NAO_ENVIADA' ? OK : DIVERG,
    `HTTP ${antes.status} · ${antes.json?.codigo}`)

  const env = await api('POST', `/api/projetos-fv/${P1}/proposta/enviar`, {})
  TOKEN_PUB = env.json?.token
  nota('Envio canônico', env.status === 200 ? OK : LACUNA,
    `HTTP ${env.status} · ${env.json?.opcoes} opções · ${env.json?.url}`)
  nota('  ↳ e-mail declarado honestamente',
    env.json?.email?.enviado === false && env.json?.email?.smtp_configurado === false ? OK : DIVERG,
    `enviado=${env.json?.email?.enviado} smtp=${env.json?.email?.smtp_configurado}`)

  const pag = await publico('GET', `/api/publico/proposta-fv/${TOKEN_PUB}`)
  const ops = pag.json?.snapshot?.opcoes ?? []
  nota('Página pública sem login', pag.status === 200 ? OK : LACUNA,
    `HTTP ${pag.status} · ${ops.length} opções`)
  nota('  ↳ link é do GRUPO, com todas', ops.length >= 3 ? OK : DIVERG,
    `mostra ${ops.length} de 3`)
  nota('  ↳ não vaza custo/margem/markup',
    /margem|markup|custo/i.test(JSON.stringify(pag.json)) ? DIVERG : OK, 'varredura no payload')
  nota('  ↳ PDF oferecido ao cliente',
    /pdf/i.test(JSON.stringify(pag.json)) ? OK : LACUNA,
    'a página pública não referencia o PDF da proposta')
}

// ═══ 10 · ACEITE ═══════════════════════════════════════════════════════════
secao('10 · ACEITE — somente uma opção')
{
  const a = await publico('POST', `/api/publico/proposta-fv/${TOKEN_PUB}/aceitar`,
    { projeto_ref: String(P2) })
  nota('Cliente aceita pela página pública', a.status === 200 ? OK : LACUNA, `HTTP ${a.status}`)
  const outra = await api('POST', `/api/projetos-fv/${P1}/proposta/aceitar`, {})
  nota('Só UMA opção por grupo', outra.json?.codigo === 'PROPOSTA_JA_ACEITA' ? OK : DIVERG,
    `HTTP ${outra.status} · ${outra.json?.codigo}`)
  const p = (await api('GET', `/api/projetos-fv/${P2}`)).json
  const ac = (p?.projeto ?? p)?.proposta_aceite ?? {}
  nota('Evidência do aceite', ac.origem && ac.share_id ? OK : LACUNA,
    `origem=${ac.origem} token=${ac.token_envio ? 'sim' : 'não'} share=${ac.share_id}`)
}

// ═══ 11 · BIFURCAÇÃO ═══════════════════════════════════════════════════════
secao('11 · HOMOLOGAÇÃO ∥ ENGENHARIA (só a aceita avança)')
const CORPO_DOC = {
  projeto: { potencia_kwp: 19.5, strings: { totalStrings: 2, modulosPorString: 15, totalModulos: 30 },
    estrutura: { tipo: 'Laje' },
    inversor: { marca: 'Hoymiles', modelo: 'HMS-2000-4T', potenciaKW: 2, fases: 1 },
    painel: { marca: 'Znshine', modelo: ZN.modelo, potenciaW: 650 } },
  cliente: { nome: 'Cliente de Validação', cpf: '000', endereco: 'X' },
}
{
  for (const [rot, caminho] of [['memorial', 'memorial'], ['carta', 'carta'], ['ART', 'art']]) {
    const r = await api('POST', `/api/projetos-fv/${P2}/homologacao/${caminho}`, CORPO_DOC)
    nota(`Aceita: ${rot}`, r.status === 200 ? OK : LACUNA, `HTTP ${r.status}`)
  }
  const barrada = await api('POST', `/api/projetos-fv/${P1}/homologacao/memorial`, CORPO_DOC)
  nota('Não escolhida é barrada', barrada.json?.codigo === 'OPCAO_NAO_ESCOLHIDA' ? OK : DIVERG,
    `HTTP ${barrada.status} · ${barrada.json?.codigo}`)
  const consulta = await api('GET', `/api/projetos-fv/${P1}/homologacao/status`)
  nota('  ↳ mas continua consultável', consulta.status === 200 ? OK : DIVERG, `HTTP ${consulta.status}`)

  const fases = await api('GET', `/api/projetos-fv/${P2}/fases`)
  const f = fases.json?.fases ?? fases.json?.lista ?? []
  nota('Fases paralelas declaradas', f.length > 0 ? OK : LACUNA,
    f.map((x) => `${x.chave}:${x.liberada ? 'livre' : 'bloq'}`).join(' '))
}

// ═══ 12 · HOMOLOGAÇÃO: concessionária, protocolo, parecer ══════════════════
secao('12 · HOMOLOGAÇÃO — documentos, protocolo, parecer de acesso')
{
  const ck = await api('GET', `/api/projetos-fv/${P2}/homologacao/checklist`)
  const docs = ck.json?.checklist?.documentos ?? []
  nota('Checklist de documentos', docs.length > 0 ? OK : LACUNA, `${docs.length} documentos`)
  nota('  ↳ concessionária identificada',
    ck.json?.checklist?.concessionaria && ck.json.checklist.concessionaria !== 'Não informada'
      ? OK : DIVERG,
    `concessionaria = "${ck.json?.checklist?.concessionaria}" (a fatura declarou Neoenergia)`)

  const st = await api('PATCH', `/api/projetos-fv/${P2}/homologacao/status`, { status: 'enviado' })
  nota('Avanço de status', st.status === 200 ? OK : LACUNA, `HTTP ${st.status}`)

  const prot = await api('PATCH', `/api/projetos-fv/${P2}/homologacao/protocolo`,
    { numero: '2026-0001', data: new Date().toISOString() })
  nota('Protocolo na concessionária', prot.status < 400 ? OK : LACUNA, `HTTP ${prot.status}`)

  const rotas = ler('backend/src/routes/homologacao.js')
  nota('Parecer de acesso', /parecer/i.test(rotas) ? OK : LACUNA,
    /parecer/i.test(rotas) ? 'rota existe' : 'nenhuma rota/campo de parecer de acesso')
  nota('Orçamento de conexão', /conexao|orcamento_conexao/i.test(rotas) ? OK : LACUNA,
    'nó "ORÇAMENTO/CONEXÃO" do diagrama')
}

// ═══ 13 · EXECUÇÃO / AS-BUILT ══════════════════════════════════════════════
secao('13 · PROJETO EXECUTIVO → EXECUÇÃO → AS-BUILT')
{
  const fluxo = ler('frontend/src/fv/fluxo.js')
  for (const chave of ['executivo', 'execucao', 'as_built', 'asbuilt']) {
    if (!new RegExp(chave, 'i').test(fluxo)) continue
    const tela = ler(`frontend/src/fv/paginas/etapas/Etapa${chave === 'as_built' || chave === 'asbuilt'
      ? 'AsBuilt' : chave[0].toUpperCase() + chave.slice(1)}.jsx`)
    const temAgregado = /api|fetch|acoes\./i.test(tela)
    nota(`Etapa ${chave}`, temAgregado ? OK : STUB,
      temAgregado ? 'consome API' : 'tela sem agregado — só declara que não é rastreável')
  }
  const modelo = ler('backend/src/models/ProjetoFV.js')
  for (const [rot, re] of [
    ['Projeto executivo', /projeto_executivo|executivo:/],
    ['Execução/campo', /execucao:|equipe_campo/],
    ['As-built', /as_built|asbuilt/i],
  ]) nota(`Agregado: ${rot}`, re.test(modelo) ? OK : LACUNA,
    re.test(modelo) ? 'campo existe no schema' : 'nenhum campo no ProjetoFV')
}

// ═══ 14 · A UX ALCANÇA CADA NÓ? ════════════════════════════════════════════
secao('14 · Alcance da UX /fv')
{
  const rotas = ler('frontend/src/fv/rotas.jsx')
  const etapas = [...rotas.matchAll(/path="([a-z-]+)"/g)].map((m) => m[1])
  nota('Etapas roteadas', etapas.length > 0 ? OK : LACUNA, etapas.join(' · '))
  const api037 = ler('frontend/src/fv/api/agregadosFvApi.js')
  for (const [rot, re] of [
    ['unifilar', /unifilar\/gerar/],
    ['PDF da proposta', /proposta\/gerar/],
    ['envio', /proposta\/enviar/],
    ['aceite', /proposta\/aceitar/],
    ['homologação', /homologacao\//],
    ['memorial/carta/ART', /homologacao\/\$\{tipo\}|documentoHomologacao/],
  ]) nota(`UX chama ${rot}`, re.test(api037) ? OK : LACUNA, re.test(api037) ? 'sim' : 'NÃO')
}

// ═══ RESUMO ════════════════════════════════════════════════════════════════
secao('RESUMO')
const por = (e) => linhas.filter((l) => l.estado === e)
console.log(`✓ OK        ${por(OK).length}`)
console.log(`⚠ DIVERGE   ${por(DIVERG).length}`)
console.log(`○ LACUNA    ${por(LACUNA).length}`)
console.log(`◌ STUB      ${por(STUB).length}`)
for (const e of [DIVERG, LACUNA, STUB]) {
  if (por(e).length === 0) continue
  console.log(`\n── ${e} ──`)
  for (const l of por(e)) console.log(`   ${l.no} — ${l.evidencia}`)
}
console.log(`\nprojetos: grupo=${P1} · opção02=${P2} · opção03=${P3} · micro=${PM}`)
console.log(`token público: ${TOKEN_PUB}`)
