/**
 * validacao-fv-ux-034.mjs — FV-UX-034
 *
 * Prova, pela API canônica:
 *   1. os quatro endpoints de homologação que respondiam 500 voltaram;
 *   2. a regra 5 da FV-DOM-032 passou a valer na API, não só na leitura do Gate:
 *      a opção NÃO escolhida deixa de gerar documento e de avançar status;
 *   3. a opção ACEITA continua fazendo tudo;
 *   4. consulta continua aberta para a não escolhida (regra 9);
 *   5. projeto SEM opções decide como sempre — Baseline manda;
 *   6. a dívida B7 continua INERTE: o memorial não mudou.
 *
 * Ambiente isolado (37017).
 *
 *   node backend/scripts/validacao-fv-ux-034.mjs
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
async function api(metodo, caminho, corpo) {
  const r = await fetch(`${API}${caminho}`, { method: metodo, headers: h,
    body: corpo === undefined ? undefined : JSON.stringify(corpo) })
  let json = null
  try { json = await r.json() } catch { /* sem corpo */ }
  return { status: r.status, json }
}
const salvar = (id, etapa, dados) => api('PUT', `/api/projetos-fv/${id}/etapa`, { etapa, dados })

console.log('═══ FV-UX-034 — fluxo comercial final ═══')

const inv = (await api('GET', '/api/equipamentos?tipo=inversor&limit=200')).json
const ZN = ((await api('GET', '/api/equipamentos?tipo=modulo&limit=50')).json?.equipamentos ?? [])
  .find((e) => e.fabricante === 'Znshine')
const SG = (inv?.equipamentos ?? inv ?? []).find((e) => e.modelo === 'SG15RT')
ok(!!ZN && !!SG, 'catálogo semeado')
if (!ZN) process.exit(1)

const painel = () => ({ id: String(ZN._id), marca: 'Znshine', modelo: ZN.modelo,
  potencia_w: 650, quantidade: 24, equipamento_id: String(ZN._id) })
const comp = () => ({ id: String(SG._id), marca: SG.fabricante, modelo: SG.modelo,
  potencia_kw: 15, tipo: 'string', fases: 3, quantidade: 1, equipamento_id: String(SG._id) })
const CORPO_DOC = {
  projeto: { potencia_kwp: 15.6, strings: { totalStrings: 2, modulosPorString: 12, totalModulos: 24 },
    estrutura: { tipo: 'Fibrocimento' },
    inversor: { marca: 'Sungrow', modelo: 'SG15RT', potenciaKW: 15, fases: 3, nMppts: 3 },
    painel: { marca: 'Znshine', modelo: 'ZXM7', potenciaW: 650 } },
  cliente: { nome: 'Cliente de Validação', cpf: '000', endereco: 'X' },
}

async function montarProjeto(nome) {
  const P = (await api('POST', '/api/projetos-fv', { nome: `${nome} ${Date.now()}`, clienteId: cred.cliente_id })).json?._id
  await salvar(P, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
  await salvar(P, 'fatura', { tipo_ligacao: 'Trifásico', tensao_v: 380, concessionaria: 'Neoenergia' })
  await salvar(P, 'localizacao', { estado: 'RN' })
  await salvar(P, 'equipamentos', { paineis: [painel()], inversor: comp(), estrutura: { tipo: 'Fibrocimento', descricao: '' } })
  await salvar(P, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal', paineis: [painel()], inversores: [comp()] }] })
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

// ═══ 1 · Projeto SIMPLES (sem opções) ══════════════════════════════════════
secao('1 · Endpoints que respondiam 500 voltaram')
const PS = await montarProjeto('FV-UX-034 simples')
await aprovarOrcamento(PS, 50000)
{
  const st = await api('GET', `/api/projetos-fv/${PS}/homologacao/status`)
  ok(st.status === 200, `GET /homologacao/status → ${st.status} (era 500)`)
  const ck = await api('GET', `/api/projetos-fv/${PS}/homologacao/checklist`)
  ok(ck.status === 200, `GET /homologacao/checklist → ${ck.status} (era 500)`)
  // Contrato real: `documentos` é ARRAY de `{ id, concluido }`; o status, um
  // valor do enum ['rascunho','enviado','analise','aprovado','conectado'].
  const pk = await api('PATCH', `/api/projetos-fv/${PS}/homologacao/checklist`,
    { documentos: [{ id: 'art', nome: 'ART', concluido: true },
      { id: 'memorial', nome: 'Memorial', concluido: false }] })
  ok(pk.status < 400, `PATCH /homologacao/checklist → ${pk.status} (era 500)`)
  const ps = await api('PATCH', `/api/projetos-fv/${PS}/homologacao/status`,
    { status: 'enviado' })
  ok(ps.status < 400, `PATCH /homologacao/status → ${ps.status} (era 500)`)
  // E o que foi gravado volta na leitura — os dois endpoints se fecham.
  const st2 = await api('GET', `/api/projetos-fv/${PS}/homologacao/status`)
  ok(JSON.stringify(st2.json).includes('enviado'), 'o status gravado volta na leitura')
  const ck2 = await api('GET', `/api/projetos-fv/${PS}/homologacao/checklist`)
  ok(JSON.stringify(ck2.json).includes('art'), 'o checklist gravado volta na leitura')
}

secao('2 · Projeto sem opções: o Gate decide como sempre')
{
  const m = await api('POST', `/api/projetos-fv/${PS}/homologacao/memorial`, CORPO_DOC)
  ok(m.status === 200, `com Baseline íntegra, memorial gera (HTTP ${m.status})`)

  // Sem Baseline, o Gate barra — comportamento histórico do domínio.
  const semBaseline = await montarProjeto('FV-UX-034 sem baseline')
  const m2 = await api('POST', `/api/projetos-fv/${semBaseline}/homologacao/memorial`, CORPO_DOC)
  ok(m2.status === 409 && m2.json?.codigo === 'SEM_BASELINE',
    `sem Baseline, memorial BLOQUEIA: HTTP ${m2.status} · ${m2.json?.codigo}`)
  const st = await api('GET', `/api/projetos-fv/${semBaseline}/homologacao/status`)
  ok(st.status === 200, 'mas CONSULTAR status continua liberado')
}

// ═══ 3 · Proposta com duas opções ══════════════════════════════════════════
secao('3 · A regra 5 da FV-DOM-032 passou a valer na API')
const P1 = await montarProjeto('FV-UX-034 proposta')
const P2 = (await api('POST', `/api/projetos-fv/${P1}/opcoes`, {})).json?.item?._id
await salvar(P2, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
await salvar(P2, 'equipamentos', { paineis: [painel()], inversor: comp(), estrutura: { tipo: 'Fibrocimento', descricao: '' } })
await salvar(P2, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal', paineis: [painel()], inversores: [comp()] }] })
ok(await aprovarOrcamento(P1, 50000) === 200, 'Opção 01: orçamento aprovado')
ok(await aprovarOrcamento(P2, 58000) === 200, 'Opção 02: orçamento aprovado')

{
  // Antes do aceite, NENHUMA gera documento.
  for (const [rot, P] of [['Opção 01', P1], ['Opção 02', P2]]) {
    const m = await api('POST', `/api/projetos-fv/${P}/homologacao/memorial`, CORPO_DOC)
    ok(m.status === 409 && m.json?.codigo === 'PROPOSTA_SEM_ACEITE',
      `${rot} sem aceite: memorial BLOQUEIA (${m.json?.codigo})`)
  }
}

secao('4 · Depois do aceite, só a escolhida avança (regras 5 e 9)')
{
  // FV-UX-035: o aceite passou a exigir que a proposta tenha sido ENVIADA ao
  // cliente. Antes desta sprint o endpoint não exigia nada, e por isso estes
  // scripts aceitavam direto. O envio não altera nada que eles medem — ele
  // apenas recoloca a proposta na condição em que o aceite é possível.
  await api('POST', `/api/projetos-fv/${P2}/proposta/enviar`, {})
  ok((await api('POST', `/api/projetos-fv/${P2}/proposta/aceitar`, {})).status === 200,
    'Opção 02 aceita')

  // A ACEITA faz tudo.
  for (const [rot, caminho, corpo] of [
    ['memorial', `/api/projetos-fv/${P2}/homologacao/memorial`, CORPO_DOC],
    ['carta', `/api/projetos-fv/${P2}/homologacao/carta`, CORPO_DOC],
    ['ART', `/api/projetos-fv/${P2}/homologacao/art`, CORPO_DOC],
  ]) {
    const r = await api('POST', caminho, corpo)
    ok(r.status === 200, `Opção 02 (aceita): ${rot} → HTTP ${r.status}`)
  }
  const av = await api('PATCH', `/api/projetos-fv/${P2}/homologacao/status`, { status: 'enviado' })
  ok(av.status < 400, `Opção 02 (aceita): avança status → HTTP ${av.status}`)

  // A NÃO ESCOLHIDA não passa. Era o buraco medido na auditoria.
  for (const [rot, caminho] of [
    ['memorial', `/api/projetos-fv/${P1}/homologacao/memorial`],
    ['carta', `/api/projetos-fv/${P1}/homologacao/carta`],
    ['ART', `/api/projetos-fv/${P1}/homologacao/art`],
  ]) {
    const r = await api('POST', caminho, CORPO_DOC)
    ok(r.status === 409 && r.json?.codigo === 'OPCAO_NAO_ESCOLHIDA',
      `Opção 01 (não escolhida): ${rot} → HTTP ${r.status} · ${r.json?.codigo}`)
  }
  const av1 = await api('PATCH', `/api/projetos-fv/${P1}/homologacao/status`, { status: 'enviado' })
  ok(av1.status === 409 && av1.json?.codigo === 'OPCAO_NAO_ESCOLHIDA',
    `Opção 01 (não escolhida): avançar status → HTTP ${av1.status} · ${av1.json?.codigo}`)
  const ck1 = await api('PATCH', `/api/projetos-fv/${P1}/homologacao/checklist`,
    { documentos: [{ id: 'art', concluido: true }] })
  ok(ck1.status === 409, `Opção 01 (não escolhida): marcar checklist → HTTP ${ck1.status}`)
}

secao('5 · A não escolhida continua CONSULTÁVEL (regra 9)')
{
  const st = await api('GET', `/api/projetos-fv/${P1}/homologacao/status`)
  ok(st.status === 200, `ler status → HTTP ${st.status}`)
  const ck = await api('GET', `/api/projetos-fv/${P1}/homologacao/checklist`)
  ok(ck.status === 200, `ler checklist → HTTP ${ck.status}`)
  const u = await api('POST', `/api/projetos-fv/${P1}/unifilar/gerar`, {})
  ok(u.status === 200, `unifilar continua consultável → HTTP ${u.status}`)
  const f = await api('POST', `/api/projetos-fv/${P1}/financeiro/calcular`, {})
  ok(f.status === 200, `financeiro continua calculável → HTTP ${f.status}`)
  const b = await api('GET', `/api/projetos-fv/${P1}/baseline`)
  ok(!!b.json?.baseline, 'Baseline dela intacta')
}

secao('6 · A dívida B7 continua INERTE — o memorial não mudou')
{
  const m = await api('POST', `/api/projetos-fv/${PS}/homologacao/memorial`, CORPO_DOC)
  const texto = m.json?.conteudo ?? ''
  ok(m.json?.origem === 'vivo', `origem = ${m.json?.origem} (o deps continua vazio)`)
  ok(m.json?.usou_snapshot === false, 'usou_snapshot = false, como antes')
  ok(texto.includes('Especificações do snapshot do projeto'),
    'a nota de fonte continua a do SNAPSHOT — o Atlas vivo NÃO foi reativado')
  ok(!texto.includes('obtidas do catálogo (Atlas)'),
    'e não apareceu a nota do catálogo vivo')
  ok(texto.includes('5. ARRANJO DAS STRINGS'), 'memorial de string intacto')
  ok(texto.includes('Número de MPPT: 3'), 'MPPT continua vindo do body, não do Atlas')
}

console.log(falhas === 0
  ? `\nOK — homologação viva, Gate exigido, não escolhida barrada e consultável.\n   simples: ${PS}\n   Opção 01: ${P1}\n   Opção 02: ${P2}`
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
