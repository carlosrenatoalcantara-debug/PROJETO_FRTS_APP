/**
 * auditoria-pdf-fv-ux-036.mjs — FV-UX-036
 *
 * Mede o gerador de PDF da proposta ANTES de expô-lo na nova UX:
 *
 *   1. o endpoint existe e devolve o quê (bytes? arquivo? URL?);
 *   2. gerar altera algum estado persistente?
 *   3. o PDF é por OPÇÃO ou pelo GRUPO?
 *   4. o documento identifica a opção a que pertence?
 *   5. o conteúdo é o da opção — ou vem de outra forma de projeto?
 *   6. há defaults fabricados no documento?
 *   7. o isolamento por empresa_id vale?
 *   8. o fluxo público da FV-UX-035 usa este PDF?
 *
 * NÃO implementa nada. Ambiente isolado (37017).
 *
 *   node backend/scripts/auditoria-pdf-fv-ux-036.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cred = JSON.parse(readFileSync(path.join(RAIZ, '.ambiente-validacao.json'), 'utf8'))
const TOKEN = readFileSync(path.join(RAIZ, '.token-validacao'), 'utf8').trim()
const API = 'http://127.0.0.1:5001'
const TMP = process.env.TMP_AUDIT || '.'
if (!cred.uri.includes('37017')) { console.error('❌ só no isolado'); process.exit(1) }

const h = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
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
const salvar = (id, etapa, dados) => api('PUT', `/api/projetos-fv/${id}/etapa`, { etapa, dados })
const secao = (t) => console.log(`\n══ ${t}`)
const achado = (b, o) => console.log(`${b ? '●' : '○'} ${o}`)
const ler = (rel) => { try { return readFileSync(path.resolve(RAIZ, rel), 'utf8') } catch { return '' } }

/**
 * Texto do PDF pela biblioteca que o repositório já usa (`pdf-parse`).
 *
 * A primeira versão desta auditoria trazia um extrator artesanal (inflate +
 * regex de operador `Tj`) que devolvia texto VAZIO — e um extrator cego faz
 * toda asserção de conteúdo falhar, o que parece defeito do documento. Medir
 * exige instrumento verificado.
 */
import { PDFParse } from 'pdf-parse'
async function textoDoPDF(buf) {
  const p = new PDFParse({ data: buf })
  try {
    const { text } = await p.getText()
    return text.replace(/-- \d+ of \d+ --/g, ' ')
  } finally {
    await p.destroy()
  }
}

console.log('═══ FV-UX-036 — auditoria do PDF da proposta ═══')

const invs = (await api('GET', '/api/equipamentos?tipo=inversor&limit=200')).json
const ZN = ((await api('GET', '/api/equipamentos?tipo=modulo&limit=50')).json?.equipamentos ?? [])
  .find((e) => e.fabricante === 'Znshine')
const SG = (invs?.equipamentos ?? invs ?? []).find((e) => e.modelo === 'SG15RT')
const MICRO = (invs?.equipamentos ?? invs ?? []).find((e) => e.modelo === 'HMS-2000-4T')
if (!ZN || !SG) { console.error('❌ catálogo não semeado'); process.exit(1) }

const painel = (q = 24) => ({ id: String(ZN._id), marca: 'Znshine', modelo: ZN.modelo,
  potencia_w: 650, quantidade: q, equipamento_id: String(ZN._id) })
const inv = (eq, q, tipo) => ({ id: String(eq._id), marca: eq.fabricante, modelo: eq.modelo,
  potencia_kw: tipo === 'micro' ? 2 : 15, tipo, fases: tipo === 'micro' ? 1 : 3,
  quantidade: q, equipamento_id: String(eq._id) })

async function montar(nome, { modulos = 24, equip = SG, tipo = 'string', qtd = 1, estrutura = 'Fibrocimento' } = {}) {
  const P = (await api('POST', '/api/projetos-fv',
    { nome: `${nome} ${Date.now()}`, clienteId: cred.cliente_id })).json?._id
  await salvar(P, 'dimensionamento', { num_paineis: modulos, potencia_kwp: modulos * 0.65 })
  await salvar(P, 'fatura', { tipo_ligacao: 'Trifásico', tensao_v: 380, concessionaria: 'Neoenergia' })
  await salvar(P, 'localizacao', { estado: 'RN' })
  await salvar(P, 'equipamentos', { paineis: [painel(modulos)], inversor: inv(equip, qtd, tipo),
    estrutura: { tipo: estrutura, descricao: '' } })
  await salvar(P, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
    paineis: [painel(modulos)], inversores: [inv(equip, qtd, tipo)] }] })
  return P
}
async function aprovar(P, valor) {
  const c = await api('POST', `/api/projetos-fv/${P}/cotacoes`, { tecnologia: 'fv', premissas: {} })
  const cid = c.json?.cotacao?._id ?? c.json?._id
  const o = await api('POST', `/api/projetos-fv/${P}/orcamentos`, { cotacao_ref: cid,
    itens: [{ descricao: 'kit', quantidade: 1, valor_unitario_r: valor, valor_total_r: valor }] })
  const oid = o.json?.orcamento?._id ?? o.json?._id
  await api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/emitir`, {})
  return (await api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/aprovar`, {})).status
}

// Opção 01: string, 24 módulos, Fibrocimento. Opção 02: micro, 30, Laje.
const P1 = await montar('FV-UX-036 auditoria', {})
const P2 = (await api('POST', `/api/projetos-fv/${P1}/opcoes`, {})).json?.item?._id
await salvar(P2, 'dimensionamento', { num_paineis: 30, potencia_kwp: 19.5 })
await salvar(P2, 'equipamentos', { paineis: [painel(30)],
  inversor: inv(MICRO ?? SG, 8, MICRO ? 'micro' : 'string'), estrutura: { tipo: 'Laje', descricao: '' } })
await salvar(P2, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
  paineis: [painel(30)], inversores: [inv(MICRO ?? SG, 8, MICRO ? 'micro' : 'string')] }] })
await aprovar(P1, 50000)
await aprovar(P2, 64500)
console.log(`\nproposta montada — Opção 01 ${P1} (string/24/Fibrocimento)`)
console.log(`                   Opção 02 ${P2} (micro/30/Laje)`)

// ═══ 1 · O contrato do endpoint ════════════════════════════════════════════
secao('1 · O que o endpoint devolve')
let PDF1 = null
{
  const g = await api('POST', `/api/projetos-fv/${P1}/proposta/gerar`, {})
  PDF1 = g.buf
  achado(g.status === 200 && g.tipo.includes('pdf'),
    `POST /proposta/gerar → HTTP ${g.status}, ${g.bytes} bytes, ${g.tipo}`)
  achado(!!g.buf && g.buf.slice(0, 4).toString() === '%PDF', 'devolve BYTES do PDF, não URL nem referência')

  const v = await api('POST', `/api/projetos-fv/${P1}/proposta/visualizar`, {})
  achado(v.status === 200 && !!v.json?.pdf_base64,
    `POST /proposta/visualizar → base64 (${v.json?.pdf_base64?.length ?? 0} chars)`)
  achado(Array.isArray(v.json?.lacunas), `visualizar declara lacunas: ${JSON.stringify(v.json?.lacunas)}`)

  const d = await api('GET', `/api/projetos-fv/${P1}/proposta/download`)
  achado(d.status === 200, `GET /proposta/download → HTTP ${d.status}`)
  achado(ler('src/controllers/propostaController.js').includes('salvarPropostaEmArquivo'),
    'alguém chama `salvarPropostaEmArquivo` (senão `download` é rota morta)')
}

// ═══ 2 · Efeito colateral ══════════════════════════════════════════════════
secao('2 · Gerar altera estado persistente?')
{
  const antes = JSON.stringify((await api('GET', `/api/projetos-fv/${P1}`)).json)
  await api('POST', `/api/projetos-fv/${P1}/proposta/gerar`, {})
  const depois = JSON.stringify((await api('GET', `/api/projetos-fv/${P1}`)).json)
  achado(antes !== depois, 'gerar o PDF muda o documento do projeto')
  const env = await api('GET', `/api/projetos-fv/${P1}/proposta/envio`)
  achado(env.json?.enviada === true, 'gerar o PDF conta como ENVIO da proposta')
}

// ═══ 3 · Por opção ou por grupo? ═══════════════════════════════════════════
secao('3 · O PDF é por opção ou pelo grupo?')
{
  const g2 = await api('POST', `/api/projetos-fv/${P2}/proposta/gerar`, {})
  achado(g2.status === 200, `a Opção 02 gera o seu próprio → HTTP ${g2.status}, ${g2.bytes} bytes`)
  achado(g2.bytes !== PDF1?.length,
    `os documentos diferem em tamanho (${PDF1?.length} vs ${g2.bytes})`)
  const ctrl = ler('src/controllers/propostaController.js')
  achado(/proposta_grupo_id/.test(ctrl), 'o controller conhece `proposta_grupo_id`')
  achado(/req\.params\.projetoId/.test(ctrl), 'o documento é montado a partir de UM ProjetoFV')

  if (PDF1) writeFileSync(path.join(TMP, 'fv-ux-036-opcao01.pdf'), PDF1)
  if (g2.buf) writeFileSync(path.join(TMP, 'fv-ux-036-opcao02.pdf'), g2.buf)

  // ═══ 4 e 5 · O conteúdo ═════════════════════════════════════════════════
  secao('4 · O documento identifica a opção?')
  const t1 = await textoDoPDF(PDF1)
  const t2 = await textoDoPDF(g2.buf)
  achado(/Opção 01|Opcao 01/i.test(t1), 'o PDF da Opção 01 diz que é a Opção 01')
  achado(/Opção 02|Opcao 02/i.test(t2), 'o PDF da Opção 02 diz que é a Opção 02')

  secao('5 · O conteúdo é o da opção?')
  const casos = [
    ['módulos da Opção 01 (24)', t1, /\b24\b/],
    ['módulos da Opção 02 (30)', t2, /\b30\b/],
    ['inversor da Opção 01 (SG15RT)', t1, /SG15RT/],
    ['inversor da Opção 02 (HMS-2000)', t2, /HMS-2000/],
    ['estrutura da Opção 01 (Fibrocimento)', t1, /Fibrocimento/i],
    ['estrutura da Opção 02 (Laje)', t2, /Laje/i],
    ['valor da Opção 01 (50.000)', t1, /50\.?000/],
    ['valor da Opção 02 (64.500)', t2, /64\.?500/],
  ]
  for (const [rot, txt, re] of casos) achado(re.test(txt), rot)

  achado(!/Laje/i.test(t1), 'o PDF da Opção 01 NÃO traz a estrutura da Opção 02')
  achado(!/SG15RT/.test(t2) || !MICRO, 'o PDF da Opção 02 NÃO traz o inversor da Opção 01')

  // ═══ 6 · Defaults fabricados ════════════════════════════════════════════
  secao('6 · O documento inventa valor quando não sabe?')
  // Sem comentário: a própria documentação do fix cita `|| 10`, `|| 400` — um
  // contador que lesse comentário acusaria a explicação, não o código.
  const svc = ler('src/services/propostaComercialService.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const fabricados = [...svc.matchAll(/\|\|\s*(\d+|'[^']+')/g)].map((m) => m[1])
  achado(fabricados.length === 0,
    `defaults literais no gerador: ${fabricados.length}`)
  if (fabricados.length > 0) {
    console.log(`   ⇒ amostra: ${[...new Set(fabricados)].slice(0, 12).join(', ')}`)
  }
  // O sintoma no documento: números que ninguém informou.
  achado(!/10 módulos|400W|garantia_produto/i.test(t1),
    'o PDF da Opção 01 não exibe módulo/potência inventados')
  for (const [rot, re] of [['"10 módulos"', /10 módulos/], ['"400W"', /400\s*W/],
    ['"5kW"', /\b5\s*kW/], ['"12 anos"', /12 anos/]]) {
    if (re.test(t1)) console.log(`   ⇒ presente no documento: ${rot}`)
  }

  // Qual FORMA do projeto o gerador lê?
  secao('6B · Qual forma de projeto o gerador espera?')
  achado(/projeto\.equipamentos\?\.inversor|projeto\.equipamentos\.inversor/.test(svc),
    'lê a forma CANÔNICA (`equipamentos.inversor`)')
  achado(/projeto\.inversor|projeto\.painel|projeto\.strings/.test(svc),
    'lê a forma do WIZARD LEGADO (`projeto.inversor`, `projeto.painel`, `projeto.strings`)')
  achado(/projeto\.dimensionamento/.test(svc), 'lê `dimensionamento` canônico')
  achado(/projeto\.arranjos/.test(svc), 'lê `arranjos[]` canônico')
}

// ═══ 7 · Isolamento ════════════════════════════════════════════════════════
secao('7 · Isolamento por empresa_id')
{
  const jwt = (await import('jsonwebtoken')).default
  const outro = jwt.sign({ userId: '000000000000000000000002', email: 'x@y.com', perfil: 'admin',
    empresa_id: '0'.repeat(23) + '9' }, 'validacao_fv_ux_018_secret_local', { expiresIn: '1h' })
  const r = await api('POST', `/api/projetos-fv/${P1}/proposta/gerar`, {}, outro)
  achado(r.status === 404 || r.status === 403,
    `outro tenant tentando gerar → HTTP ${r.status} (esperado 404/403)`)
}

// ═══ 8 · O fluxo público usa este PDF? ═════════════════════════════════════
secao('8 · Relação com o envio canônico (FV-UX-035)')
{
  const svcEnvio = ler('src/services/EnvioPropostaService.js')
  achado(/gerarPropostaComercial|propostaComercialService/.test(svcEnvio),
    'o envio canônico usa o gerador de PDF')
  achado(/pdf/i.test(svcEnvio), 'o snapshot do envio guarda PDF')
  const pub = ler('../frontend/src/pages/PropostaFVPublica.jsx')
  achado(/pdf/i.test(pub), 'a página do cliente oferece o PDF')
}

// ═══ 9 · A UX nova ═════════════════════════════════════════════════════════
secao('9 · A UX nova alcança o PDF?')
{
  const etapa = ler('../frontend/src/fv/paginas/etapas/EtapaProposta.jsx')
  const clienteApi = ler('../frontend/src/fv/api/agregadosFvApi.js')
  achado(/proposta\/(gerar|visualizar)/.test(clienteApi), 'o cliente de API tem a chamada')
  achado(/PDF/i.test(etapa), 'a EtapaProposta menciona PDF')
}

console.log(`\n─── fim da auditoria — nada foi implementado ───`)
console.log(`   PDFs salvos em ${path.resolve(TMP)}`)
console.log(`   Opção 01: ${P1}\n   Opção 02: ${P2}`)
