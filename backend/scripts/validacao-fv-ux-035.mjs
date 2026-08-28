/**
 * validacao-fv-ux-035.mjs — FV-UX-035
 *
 * Prova, pela API canônica:
 *   1. o ACEITE exige envio prévio — a regra principal da sprint;
 *   2. o envio reusa `compartilhamentos[]`, sem acionar o freeze legado;
 *   3. o link é UM por GRUPO e mostra TODAS as opções;
 *   4. a página pública devolve o snapshot congelado, nunca recalcula;
 *   5. cliente e operador aceitam pelo MESMO domínio, com evidência distinta;
 *   6. uma só opção aceita por grupo; reaceitar a mesma é idempotente;
 *   7. depois do aceite, o Gate da FV-UX-034 continua mandando;
 *   8. o compartilhamento LEGADO não virou envio de proposta.
 *
 * Ambiente isolado (37017).
 *
 * ⚠ O backend desta validação PRECISA subir com `SMTP_USER=""  SMTP_PASS=""`.
 * O `backend/.env` carrega credencial Zoho REAL, e sem neutralizá-la o envio
 * da proposta dispara e-mail de verdade pela conta da empresa. Medido na
 * primeira execução desta sprint: `enviado=true` com destinatário
 * `validacao+…@exemplo.com`. Domínio reservado (RFC 2606), então ninguém
 * recebeu — mas a conta real foi usada. Ambiente isolado não fala com fora.
 *
 *   MONGODB_URI=… PORT=5001 SMTP_USER= SMTP_PASS= node backend/src/server.js
 *   node backend/scripts/validacao-fv-ux-035.mjs
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cred = JSON.parse(readFileSync(path.join(RAIZ, '.ambiente-validacao.json'), 'utf8'))
const TOKEN = readFileSync(path.join(RAIZ, '.token-validacao'), 'utf8').trim()
const API = 'http://127.0.0.1:5001'
if (!cred.uri.includes('37017')) { console.error('❌ só no isolado'); process.exit(1) }

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n══ ${t}`)
const h = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
async function api(metodo, caminho, corpo, autenticado = true) {
  const r = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: autenticado ? h : { 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  let json = null
  try { json = await r.json() } catch { /* sem corpo */ }
  return { status: r.status, json }
}
/** Chamada SEM token — é assim que o cliente final acessa. */
const publico = (metodo, caminho, corpo) => api(metodo, caminho, corpo, false)
const salvar = (id, etapa, dados) => api('PUT', `/api/projetos-fv/${id}/etapa`, { etapa, dados })

console.log('═══ FV-UX-035 — envio da proposta e gate de aceite ═══')

const invs = (await api('GET', '/api/equipamentos?tipo=inversor&limit=200')).json
const ZN = ((await api('GET', '/api/equipamentos?tipo=modulo&limit=50')).json?.equipamentos ?? [])
  .find((e) => e.fabricante === 'Znshine')
const SG = (invs?.equipamentos ?? invs ?? []).find((e) => e.modelo === 'SG15RT')
ok(!!ZN && !!SG, 'catálogo semeado')
if (!ZN || !SG) process.exit(1)

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
async function propostaComDuasOpcoes(nome) {
  const A = await montar(nome)
  const B = (await api('POST', `/api/projetos-fv/${A}/opcoes`, {})).json?.item?._id
  await salvar(B, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
  await salvar(B, 'equipamentos', { paineis: [painel()], inversor: comp(),
    estrutura: { tipo: 'Fibrocimento', descricao: '' } })
  await salvar(B, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
    paineis: [painel()], inversores: [comp()] }] })
  await aprovarOrcamento(A, 50000)
  await aprovarOrcamento(B, 58000)
  return [A, B]
}

// ═══ 1 · A regra principal: sem envio, sem aceite ══════════════════════════
secao('1 · O aceite exige envio prévio (regra principal)')
const [P1, P2] = await propostaComDuasOpcoes('FV-UX-035 proposta')
{
  const a = await api('POST', `/api/projetos-fv/${P2}/proposta/aceitar`, {})
  ok(a.status === 409 && a.json?.codigo === 'PROPOSTA_NAO_ENVIADA',
    `aceite antes do envio BLOQUEIA: HTTP ${a.status} · ${a.json?.codigo}`)

  const e = await api('GET', `/api/projetos-fv/${P1}/proposta/envio`)
  ok(e.status === 200 && e.json?.enviada === false,
    `estado do envio antes de enviar: enviada=${e.json?.enviada}`)
}

// ═══ 2 · O envio ═══════════════════════════════════════════════════════════
secao('2 · Envio: reusa o compartilhamento, sem freeze legado')
let TOKEN_PUBLICO = null
{
  const env = await api('POST', `/api/projetos-fv/${P1}/proposta/enviar`, { validade_dias: 30 })
  ok(env.status === 200, `POST /proposta/enviar → HTTP ${env.status} ${env.json?.codigo ?? ''}`)
  TOKEN_PUBLICO = env.json?.token ?? null
  ok(!!TOKEN_PUBLICO, `token gerado: ${TOKEN_PUBLICO ? 'sim' : 'não'}`)
  ok(env.json?.opcoes === 2, `o envio cobre as DUAS opções (${env.json?.opcoes})`)
  ok(typeof env.json?.url === 'string' && env.json.url.includes(TOKEN_PUBLICO ?? '#'),
    `url do cliente: ${env.json?.url}`)
  // Sem SMTP no ambiente isolado: tem de dizer que NÃO enviou, não fingir.
  ok(env.json?.email?.enviado === false && env.json?.email?.smtp_configurado === false,
    `sem SMTP, declara honestamente: enviado=${env.json?.email?.enviado}`)
  ok(env.status === 200, 'nenhum freeze legado foi exigido (era 409 SEM_SNAPSHOT_CONGELADO)')

  // A marca canônica está gravada — e nas DUAS irmãs, porque o envio é do grupo.
  for (const [rot, P] of [['Opção 01', P1], ['Opção 02', P2]]) {
    const e = await api('GET', `/api/projetos-fv/${P}/proposta/envio`)
    ok(e.json?.enviada === true && e.json?.vigente === true,
      `${rot} enxerga o envio: enviada=${e.json?.enviada} vigente=${e.json?.vigente}`)
  }
}

// ═══ 3 · A página pública ══════════════════════════════════════════════════
secao('3 · Página pública: um link, todas as opções, sem auth')
{
  const p = await publico('GET', `/api/publico/proposta-fv/${TOKEN_PUBLICO}`)
  ok(p.status === 200, `GET público SEM token de auth → HTTP ${p.status}`)
  const ops = p.json?.snapshot?.opcoes ?? []
  ok(ops.length === 2, `a página traz as duas opções (${ops.length})`)
  ok(ops.every((o) => typeof o.valor_total_r === 'number'),
    `cada opção tem preço: ${ops.map((o) => o.valor_total_r).join(' / ')}`)
  ok(ops.every((o) => o.estrutura === 'Fibrocimento'),
    'a estrutura da FV-UX-030 chega ao cliente')
  // Promessa da rota pública: nada interno.
  const bruto = JSON.stringify(p.json)
  ok(!/margem|markup|custo/i.test(bruto), 'não vaza custo, margem nem markup')
  ok(!!p.json?.snapshot_hash, `snapshot congelado, com hash: ${p.json?.snapshot_hash?.slice(0, 12)}…`)

  // Tracking do acesso do cliente.
  const e = await api('GET', `/api/projetos-fv/${P1}/proposta/envio`)
  ok((e.json?.ultimo?.visualizacoes ?? 0) >= 1,
    `o acesso do cliente ficou registrado: ${e.json?.ultimo?.visualizacoes} visualização(ões)`)

  const invalido = await publico('GET', '/api/publico/proposta-fv/token-que-nao-existe')
  ok(invalido.status === 404, `token inválido → HTTP ${invalido.status}`)
}

// ═══ 4 · O snapshot é congelado — não acompanha mudança posterior ══════════
secao('4 · O snapshot representa a proposta ENVIADA')
{
  const antes = (await publico('GET', `/api/publico/proposta-fv/${TOKEN_PUBLICO}`))
    .json?.snapshot?.opcoes?.find((o) => o.projeto_ref === String(P2))
  await salvar(P2, 'equipamentos', { paineis: [painel()], inversor: comp(),
    estrutura: { tipo: 'Laje', descricao: 'alterada depois do envio' } })
  const depois = (await publico('GET', `/api/publico/proposta-fv/${TOKEN_PUBLICO}`))
    .json?.snapshot?.opcoes?.find((o) => o.projeto_ref === String(P2))
  ok(antes?.estrutura === 'Fibrocimento' && depois?.estrutura === 'Fibrocimento',
    `alterar o projeto NÃO altera o que o cliente recebeu (${depois?.estrutura})`)
}

// ═══ 5 · Aceite do CLIENTE, na página pública ══════════════════════════════
secao('5 · Aceite público, pelo mesmo domínio')
{
  const fora = await publico('POST', `/api/publico/proposta-fv/${TOKEN_PUBLICO}/aceitar`,
    { projeto_ref: String(cred.projeto_id) })
  ok(fora.status === 404 && fora.json?.codigo === 'OPCAO_FORA_DO_ENVIO',
    `opção de outra proposta → HTTP ${fora.status} · ${fora.json?.codigo}`)

  const a = await publico('POST', `/api/publico/proposta-fv/${TOKEN_PUBLICO}/aceitar`,
    { projeto_ref: String(P2) })
  ok(a.status === 200 && a.json?.repetido === false,
    `cliente aceita a Opção 02 → HTTP ${a.status}`)

  const p = await api('GET', `/api/projetos-fv/${P2}`)
  const ac = (p.json?.projeto ?? p.json)?.proposta_aceite ?? {}
  ok(ac.aceita === true && ac.origem === 'cliente',
    `evidência: origem=${ac.origem}`)
  ok(ac.token_envio === TOKEN_PUBLICO, 'evidência: token da sessão pública registrado')
  ok(!!ac.snapshot_hash && !!ac.share_id,
    `evidência: qual proposta estava à vista (share=${ac.share_id})`)
  ok(ac.aceita_por === null, 'aceite do cliente NÃO atribui usuário interno')

  // Idempotência (decisão de negócio: "o aceite deve ser idempotente").
  const r = await publico('POST', `/api/publico/proposta-fv/${TOKEN_PUBLICO}/aceitar`,
    { projeto_ref: String(P2) })
  ok(r.status === 200 && r.json?.repetido === true,
    `reaceitar a MESMA opção é idempotente (repetido=${r.json?.repetido})`)
  const p2 = await api('GET', `/api/projetos-fv/${P2}`)
  ok((p2.json?.projeto ?? p2.json)?.proposta_aceite?.aceita_em === ac.aceita_em,
    'a evidência original NÃO foi sobrescrita')

  // Uma só por grupo.
  const outra = await publico('POST', `/api/publico/proposta-fv/${TOKEN_PUBLICO}/aceitar`,
    { projeto_ref: String(P1) })
  ok(outra.status === 409 && outra.json?.codigo === 'PROPOSTA_JA_ACEITA',
    `aceitar a outra opção → HTTP ${outra.status} · ${outra.json?.codigo}`)

  // O cliente passa a ver a própria escolha ao reabrir o link.
  const pg = await publico('GET', `/api/publico/proposta-fv/${TOKEN_PUBLICO}`)
  ok(pg.json?.aceita?.projeto_ref === String(P2),
    `ao reabrir, a página mostra a opção aceita (${pg.json?.aceita?.opcao_rotulo})`)
}

// ═══ 6 · Aceite INTERNO — mesmo domínio, evidência diferente ═══════════════
secao('6 · Aceite interno, pelo mesmo domínio')
{
  const [Q1, Q2] = await propostaComDuasOpcoes('FV-UX-035 interna')
  const bloqueado = await api('POST', `/api/projetos-fv/${Q1}/proposta/aceitar`, {})
  ok(bloqueado.json?.codigo === 'PROPOSTA_NAO_ENVIADA',
    `interno também exige envio: ${bloqueado.json?.codigo}`)

  await api('POST', `/api/projetos-fv/${Q1}/proposta/enviar`, {})
  const a = await api('POST', `/api/projetos-fv/${Q1}/proposta/aceitar`,
    { motivo: 'cliente confirmou por telefone' })
  ok(a.status === 200, `operador registra o aceite → HTTP ${a.status}`)

  const p = await api('GET', `/api/projetos-fv/${Q1}`)
  const ac = (p.json?.projeto ?? p.json)?.proposta_aceite ?? {}
  ok(ac.origem === 'interno', `evidência: origem=${ac.origem}`)
  ok(!!ac.aceita_por, `evidência: usuário responsável (${ac.aceita_por})`)
  ok(ac.token_envio === null, 'aceite interno NÃO inventa token de cliente')
  ok(ac.motivo === 'cliente confirmou por telefone', 'o meio real fica registrado')
  ok(!!ac.snapshot_hash, 'evidência: snapshot da proposta apresentada')

  const outra = await api('POST', `/api/projetos-fv/${Q2}/proposta/aceitar`, {})
  ok(outra.status === 409 && outra.json?.codigo === 'PROPOSTA_JA_ACEITA',
    `a outra opção → HTTP ${outra.status} · ${outra.json?.codigo}`)
}

// ═══ 7 · O Gate da FV-UX-034 continua mandando depois do aceite ════════════
secao('7 · Depois do aceite, o Gate decide como antes')
{
  const CORPO_DOC = {
    projeto: { potencia_kwp: 15.6,
      strings: { totalStrings: 2, modulosPorString: 12, totalModulos: 24 },
      estrutura: { tipo: 'Fibrocimento' },
      inversor: { marca: 'Sungrow', modelo: 'SG15RT', potenciaKW: 15, fases: 3, nMppts: 3 },
      painel: { marca: 'Znshine', modelo: 'ZXM7', potenciaW: 650 } },
    cliente: { nome: 'Cliente de Validação', cpf: '000', endereco: 'X' },
  }
  const aceita = await api('POST', `/api/projetos-fv/${P2}/homologacao/memorial`, CORPO_DOC)
  ok(aceita.status === 200, `a opção ACEITA gera memorial → HTTP ${aceita.status}`)
  const perdedora = await api('POST', `/api/projetos-fv/${P1}/homologacao/memorial`, CORPO_DOC)
  ok(perdedora.status === 409 && perdedora.json?.codigo === 'OPCAO_NAO_ESCOLHIDA',
    `a NÃO escolhida continua barrada → ${perdedora.json?.codigo}`)
  const consulta = await api('GET', `/api/projetos-fv/${P1}/homologacao/status`)
  ok(consulta.status === 200, 'e continua consultável (regra 9)')
}

// ═══ 8 · O compartilhamento LEGADO não vira envio de proposta ══════════════
secao('8 · Fronteira com o compartilhamento legado')
{
  const [R1] = await propostaComDuasOpcoes('FV-UX-035 fronteira')
  // A rota legada segue exigindo o freeze comercial — nada mudou nela.
  const legado = await api('POST', `/api/projetos-fv/${R1}/governanca/comercial/compartilhar`, {})
  ok(legado.status === 409 && legado.json?.codigo === 'SEM_SNAPSHOT_CONGELADO',
    `a rota legada continua exigindo freeze: ${legado.json?.codigo}`)
  const e = await api('GET', `/api/projetos-fv/${R1}/proposta/envio`)
  ok(e.json?.enviada === false,
    'e o fluxo canônico NÃO a considera envio de proposta')
  const a = await api('POST', `/api/projetos-fv/${R1}/proposta/aceitar`, {})
  ok(a.json?.codigo === 'PROPOSTA_NAO_ENVIADA',
    `logo, o aceite continua barrado: ${a.json?.codigo}`)
}

console.log(falhas === 0
  ? '\nOK — envio precede aceite; um link por grupo; cliente e operador num domínio só.'
  : `\n${falhas} FALHA(S).`)
console.log(`   Opção 01: ${P1}\n   Opção 02: ${P2}\n   token público: ${TOKEN_PUBLICO}`)
process.exit(falhas === 0 ? 0 : 1)
