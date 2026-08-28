/**
 * validacao-fv-ux-036.mjs — FV-UX-036
 *
 * Prova, pela API canônica e lendo o TEXTO do PDF gerado:
 *
 *   1. cada opção gera o seu documento;
 *   2. o documento identifica a opção (Opção 01 / Opção 02);
 *   3. módulos, inversor/microinversores, quantidades, estrutura e valores são
 *      os DA OPÇÃO — sem mistura entre irmãs;
 *   4. o que ninguém informou vira lacuna ("—"), não default fabricado;
 *   5. projeto SEM dado não faz o documento inventar;
 *   6. isolamento entre tenants;
 *   7. o erro real do backend chega ao cliente;
 *   8. gerar o PDF NÃO altera aceite, envio nem Gate (FV-UX-035 intacta).
 *
 * Ambiente isolado (37017), backend com `SMTP_USER="" SMTP_PASS=""`.
 *
 *   node backend/scripts/validacao-fv-ux-036.mjs
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import jwt from 'jsonwebtoken'
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
  if (tipo.includes('json')) return { status: r.status, json: await r.json().catch(() => null), tipo }
  const buf = Buffer.from(await r.arrayBuffer())
  return { status: r.status, buf, bytes: buf.length, tipo }
}
const salvar = (id, etapa, dados) => api('PUT', `/api/projetos-fv/${id}/etapa`, { etapa, dados })

/** Texto do PDF pela biblioteca que o repositório já usa. */
async function texto(buf) {
  const p = new PDFParse({ data: buf })
  try {
    const { text } = await p.getText()
    return text.replace(/-- \d+ of \d+ --/g, ' ')
  } finally { await p.destroy() }
}
const pdfDe = async (P) => {
  const r = await api('POST', `/api/projetos-fv/${P}/proposta/gerar`, {})
  return { status: r.status, buf: r.buf, texto: r.buf ? await texto(r.buf) : '' }
}

console.log('═══ FV-UX-036 — PDF da proposta por opção ═══')

const invs = (await api('GET', '/api/equipamentos?tipo=inversor&limit=200')).json
const ZN = ((await api('GET', '/api/equipamentos?tipo=modulo&limit=50')).json?.equipamentos ?? [])
  .find((e) => e.fabricante === 'Znshine')
const SG = (invs?.equipamentos ?? invs ?? []).find((e) => e.modelo === 'SG15RT')
const MICRO = (invs?.equipamentos ?? invs ?? []).find((e) => e.modelo === 'HMS-2000-4T')
ok(!!ZN && !!SG && !!MICRO, 'catálogo semeado (módulo, inversor string e micro)')
if (!ZN || !SG || !MICRO) process.exit(1)

const painel = (q) => ({ id: String(ZN._id), marca: 'Znshine', modelo: ZN.modelo,
  potencia_w: 650, quantidade: q, equipamento_id: String(ZN._id) })
const inv = (eq, q, tipo) => ({ id: String(eq._id), marca: eq.fabricante, modelo: eq.modelo,
  potencia_kw: tipo === 'micro' ? 2 : 15, tipo, fases: tipo === 'micro' ? 1 : 3,
  quantidade: q, equipamento_id: String(eq._id) })

async function equipar(P, { modulos, equipamento, tipo, qtd, estrutura }) {
  await salvar(P, 'dimensionamento', { num_paineis: modulos, potencia_kwp: modulos * 0.65 })
  await salvar(P, 'equipamentos', { paineis: [painel(modulos)],
    inversor: inv(equipamento, qtd, tipo), estrutura: { tipo: estrutura, descricao: '' } })
  await salvar(P, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
    paineis: [painel(modulos)], inversores: [inv(equipamento, qtd, tipo)] }] })
}
async function novo(nome) {
  const P = (await api('POST', '/api/projetos-fv',
    { nome: `${nome} ${Date.now()}`, clienteId: cred.cliente_id })).json?._id
  await salvar(P, 'fatura', { tipo_ligacao: 'Trifásico', tensao_v: 380, concessionaria: 'Neoenergia' })
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
  return (await api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/aprovar`, {})).status
}

// Opção 01: STRING, 24 × 650 W, Sungrow SG15RT, Fibrocimento, R$ 50.000
// Opção 02: MICRO,  30 × 650 W, 8 × Hoymiles HMS-2000-4T, Laje, R$ 64.500
const P1 = await novo('FV-UX-036')
await equipar(P1, { modulos: 24, equipamento: SG, tipo: 'string', qtd: 1, estrutura: 'Fibrocimento' })
const P2 = (await api('POST', `/api/projetos-fv/${P1}/opcoes`, {})).json?.item?._id
await equipar(P2, { modulos: 30, equipamento: MICRO, tipo: 'micro', qtd: 8, estrutura: 'Laje' })
await aprovar(P1, 50000)
await aprovar(P2, 64500)

// ═══ 1 e 2 · Um documento por opção, identificado ══════════════════════════
secao('1 · Cada opção gera o SEU documento, identificado')
const D1 = await pdfDe(P1)
const D2 = await pdfDe(P2)
{
  ok(D1.status === 200 && D1.buf?.slice(0, 4).toString() === '%PDF',
    `Opção 01 → HTTP ${D1.status}, ${D1.buf?.length} bytes`)
  ok(D2.status === 200 && D2.buf?.slice(0, 4).toString() === '%PDF',
    `Opção 02 → HTTP ${D2.status}, ${D2.buf?.length} bytes`)
  ok(/Opção 01/.test(D1.texto), 'o PDF da Opção 01 se identifica como Opção 01')
  ok(/Opção 02/.test(D2.texto), 'o PDF da Opção 02 se identifica como Opção 02')
  ok(!/Opção 02/.test(D1.texto), 'o da Opção 01 não menciona a Opção 02')
  ok(!/Opção 01/.test(D2.texto), 'o da Opção 02 não menciona a Opção 01')
}

// ═══ 3 · Conteúdo canônico, sem mistura ════════════════════════════════════
secao('3 · Conteúdo é o da opção — módulos, inversor, estrutura, valores')
{
  const casos = [
    ['Opção 01: 24 módulos', D1.texto, /24 módulos/],
    ['Opção 01: módulo do catálogo', D1.texto, /Znshine ZXM7-UHLD144-650\/M/],
    ['Opção 01: 650 W por módulo', D1.texto, /650W por módulo/],
    ['Opção 01: seção "Inversor"', D1.texto, /Inversor/],
    ['Opção 01: Sungrow SG15RT 15 kW', D1.texto, /Sungrow SG15RT - 15kW/],
    ['Opção 01: trifásico', D1.texto, /Fases: 3F/],
    ['Opção 01: Fibrocimento', D1.texto, /Fibrocimento/],
    ['Opção 01: 15.6 kWp', D1.texto, /15\.6 kWp/],
    ['Opção 01: R$ 50.000', D1.texto, /50\.000/],

    ['Opção 02: 30 módulos', D2.texto, /30 módulos/],
    ['Opção 02: seção "Microinversores"', D2.texto, /Microinversores/],
    ['Opção 02: QUANTIDADE 8 ×', D2.texto, /8 × Hoymiles HMS-2000-4T/],
    ['Opção 02: 2 kW por micro', D2.texto, /- 2kW/],
    ['Opção 02: monofásico', D2.texto, /Fases: 1F/],
    ['Opção 02: Laje', D2.texto, /Laje/],
    ['Opção 02: 19.5 kWp', D2.texto, /19\.5 kWp/],
    ['Opção 02: R$ 64.500', D2.texto, /64\.500/],
  ]
  for (const [rot, txt, re] of casos) ok(re.test(txt), rot)

  secao('4 · Nenhuma mistura entre as irmãs')
  const naoDeve = [
    ['a Opção 01 não traz a estrutura da 02', D1.texto, /Laje/],
    ['a Opção 01 não traz o micro da 02', D1.texto, /HMS-2000/],
    ['a Opção 01 não traz 30 módulos', D1.texto, /30 módulos/],
    ['a Opção 01 não traz o valor da 02', D1.texto, /64\.500/],
    ['a Opção 02 não traz a estrutura da 01', D2.texto, /Fibrocimento/],
    ['a Opção 02 não traz o inversor da 01', D2.texto, /SG15RT/],
    ['a Opção 02 não traz 24 módulos', D2.texto, /24 módulos/],
    ['a Opção 02 não traz o valor da 01', D2.texto, /R\$ 50\.000/],
  ]
  for (const [rot, txt, re] of naoDeve) ok(!re.test(txt), rot)
}

// ═══ 5 · Sem dado, lacuna — nunca default fabricado ════════════════════════
secao('5 · Projeto SEM equipamento não faz o documento inventar')
{
  const VAZIO = await novo('FV-UX-036 vazio')
  const d = await pdfDe(VAZIO)
  ok(d.status === 200, `gera mesmo sem equipamento → HTTP ${d.status}`)
  const inventados = [
    ['"10 módulos"', /10 módulos/],
    ['"400W"', /400W/],
    ['"5kW"', /- 5kW/],
    ['"Fibrocimento" (default)', /Fibrocimento/],
    ['"12 anos (produto)"', /12 anos \(produto\)/],
    ['"Marca Modelo"', /Marca Modelo/],
  ]
  for (const [rot, re] of inventados) ok(!re.test(d.texto), `não inventa ${rot}`)
  ok((d.texto.match(/—/g) ?? []).length >= 3,
    `declara lacunas: ${(d.texto.match(/—/g) ?? []).length} marcas "—"`)
  ok(!/Opção/.test(d.texto), 'projeto que não é opção não ganha rótulo de opção')
}

// ═══ 6 · Isolamento ════════════════════════════════════════════════════════
secao('6 · Isolamento por empresa_id e projeto inexistente')
{
  const outro = jwt.sign({ userId: '000000000000000000000002', email: 'x@y.com', perfil: 'admin',
    empresa_id: '0'.repeat(23) + '9' }, 'validacao_fv_ux_018_secret_local', { expiresIn: '1h' })
  const r = await api('POST', `/api/projetos-fv/${P1}/proposta/gerar`, {}, outro)
  ok(r.status === 404, `outro tenant → HTTP ${r.status} (sem vazar o documento)`)
  ok(!r.buf || r.buf.slice(0, 4).toString() !== '%PDF', 'e nenhum PDF é devolvido')

  const inexistente = await api('POST', '/api/projetos-fv/000000000000000000000123/proposta/gerar', {})
  ok(inexistente.status === 404, `projeto inexistente → HTTP ${inexistente.status}`)

  // ═══ 7 · Erro real chega ao cliente ═══════════════════════════════════════
  secao('7 · O erro real do backend chega ao cliente')
  const invalido = await api('POST', '/api/projetos-fv/nao-e-um-id/proposta/gerar', {})
  ok(invalido.status === 400 && /inválido/i.test(invalido.json?.erro ?? ''),
    `ID inválido → HTTP ${invalido.status} · "${invalido.json?.erro}"`)
}

// ═══ 8 · A FV-UX-035 continua intacta ══════════════════════════════════════
secao('8 · Gerar PDF não mexe em envio, aceite nem Gate')
{
  const envAntes = await api('GET', `/api/projetos-fv/${P1}/proposta/envio`)
  ok(envAntes.json?.enviada === false, 'depois de gerar 2 PDFs, a proposta segue NÃO enviada')

  const aceite = await api('POST', `/api/projetos-fv/${P2}/proposta/aceitar`, {})
  ok(aceite.status === 409 && aceite.json?.codigo === 'PROPOSTA_NAO_ENVIADA',
    `o aceite continua exigindo envio: ${aceite.json?.codigo}`)

  await api('POST', `/api/projetos-fv/${P1}/proposta/enviar`, {})
  ok((await api('POST', `/api/projetos-fv/${P2}/proposta/aceitar`, {})).status === 200,
    'enviada, a opção é aceita normalmente')

  // O PDF continua acessível DEPOIS do aceite — não é bloqueado por ele.
  const depois = await pdfDe(P1)
  ok(depois.status === 200 && /Opção 01/.test(depois.texto),
    `a opção NÃO escolhida continua gerando o seu PDF → HTTP ${depois.status}`)

  const CORPO = { projeto: { potencia_kwp: 15.6,
    strings: { totalStrings: 2, modulosPorString: 12, totalModulos: 24 },
    inversor: { marca: 'Sungrow', modelo: 'SG15RT', potenciaKW: 15, fases: 3, nMppts: 3 },
    painel: { marca: 'Znshine', modelo: 'ZXM7', potenciaW: 650 } },
  cliente: { nome: 'Cliente de Validação' } }
  const mem = await api('POST', `/api/projetos-fv/${P2}/homologacao/memorial`, CORPO)
  ok(mem.status === 200, `o Gate segue liberando a ACEITA → HTTP ${mem.status}`)
  const barrada = await api('POST', `/api/projetos-fv/${P1}/homologacao/memorial`, CORPO)
  ok(barrada.status === 409 && barrada.json?.codigo === 'OPCAO_NAO_ESCOLHIDA',
    `e barrando a não escolhida → ${barrada.json?.codigo}`)
}

console.log(falhas === 0
  ? '\nOK — um PDF por opção, com os dados da opção, sem inventar o que não sabe.'
  : `\n${falhas} FALHA(S).`)
console.log(`   Opção 01: ${P1}\n   Opção 02: ${P2}`)
process.exit(falhas === 0 ? 0 : 1)
