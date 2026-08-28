/**
 * validacao-fv-dom-032.mjs — FV-DOM-032
 *
 * Constrói a proposta do enunciado — Opção 01 string, Opção 02 micro — e prova
 * as nove regras comerciais pela API canônica.
 *
 * Ambiente isolado (37017).
 *
 *   node backend/scripts/validacao-fv-dom-032.mjs
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
const ler = async (id) => { const r = await api('GET', `/api/projetos-fv/${id}`); return r.json?.projeto ?? r.json }

console.log('═══ FV-DOM-032 — opções concorrentes da mesma proposta ═══')

const inv = (await api('GET', '/api/equipamentos?tipo=inversor&limit=200')).json
const inversores = inv?.equipamentos ?? inv ?? []
const mods = (await api('GET', '/api/equipamentos?tipo=modulo&limit=50')).json
const ZN = (mods?.equipamentos ?? mods ?? []).find((e) => e.fabricante === 'Znshine')
const SG = inversores.find((e) => e.modelo === 'SG15RT')
const HM = inversores.find((e) => e.modelo === 'HMS-2000-4T')
ok(!!ZN && !!SG && !!HM, 'catálogo semeado')
if (!ZN) process.exit(1)

const painel = () => ({ id: String(ZN._id), marca: 'Znshine', modelo: ZN.modelo,
  potencia_w: 650, quantidade: 24, equipamento_id: String(ZN._id) })
const comp = (eq, q, tipo) => ({ id: String(eq._id), marca: eq.fabricante, modelo: eq.modelo,
  potencia_kw: eq.especificacoes.potencia, tipo, fases: eq.especificacoes.fases,
  quantidade: q, equipamento_id: String(eq._id) })

// ── Opção 01 — string ───────────────────────────────────────────────────────
secao('1 · Opção 01 (string) e a criação da Opção 02 (regra 1)')
const P1 = (await api('POST', '/api/projetos-fv',
  { nome: `FV-DOM-032 proposta ${Date.now()}`, clienteId: cred.cliente_id })).json?._id
await salvar(P1, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
await salvar(P1, 'fatura', { tipo_ligacao: 'Trifásico', tensao_v: 380, concessionaria: 'Neoenergia' })
await salvar(P1, 'localizacao', { estado: 'RN' })
await salvar(P1, 'equipamentos', { paineis: [painel()], inversor: comp(SG, 1, 'string'),
  estrutura: { tipo: 'Fibrocimento', descricao: '' } })
await salvar(P1, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
  paineis: [painel()], inversores: [comp(SG, 1, 'string')] }] })
await salvar(P1, 'engenharia_eletrica', { arranjo: { num_mppts_usados: 2, mppts: [
  { mppt: 1, strings_paralelo: 1, modulos_por_string: 12, total_modulos: 12 },
  { mppt: 2, strings_paralelo: 1, modulos_por_string: 12, total_modulos: 12 }] } })

const criacao = await api('POST', `/api/projetos-fv/${P1}/opcoes`, {})
const P2 = criacao.json?.item?._id
ok(criacao.status === 201 && !!P2, `Opção 02 criada (HTTP ${criacao.status})`)
ok(criacao.json?.opcao_numero === 2, `numerada como ${criacao.json?.opcao_numero}`)

const q1 = await ler(P1)
ok(q1.tipo_projeto === 'opcao' && q1.opcao_numero === 1 && q1.opcao_rotulo === 'Opção 01',
  `a origem virou ${q1.opcao_rotulo} (tipo ${q1.tipo_projeto})`)
ok(!!q1.proposta_grupo_id, 'grupo de proposta carimbado')
const q2inicial = await ler(P2)
ok(String(q2inicial.proposta_grupo_id) === String(q1.proposta_grupo_id),
  'as duas opções compartilham o MESMO grupo')
ok(q2inicial.projeto_origem_id === null || q2inicial.projeto_origem_id === undefined,
  '`projeto_origem_id` NÃO foi usado — opções são pares, não pai e filho')

secao('2 · A opção nova nasce sem estado técnico (não compartilha)')
ok((q2inicial.equipamentos?.paineis ?? []).length === 0, 'sem painéis')
ok(!q2inicial.equipamentos?.inversor?.modelo, 'sem inversor')
ok(!q2inicial.equipamentos?.estrutura?.tipo, 'sem estrutura')
ok((q2inicial.arranjos ?? []).length === 0, 'sem arranjos')
ok(!q2inicial.dimensionamento?.num_paineis, 'sem dimensionamento')
ok(!q2inicial.engenharia_eletrica?.arranjo?.mppts?.length, 'sem engenharia elétrica')
ok(!q2inicial.financeiro?.payback_anos, 'sem financeiro')
// O que É herdado: o que é do cliente e do local, não do projeto técnico.
ok(q2inicial.fatura_extracao?.concessionaria === 'Neoenergia', 'herdou a concessionária')
ok(q2inicial.localizacao?.estado === 'RN', 'herdou a UF')
ok(String(q2inicial.clienteId?._id ?? q2inicial.clienteId) === String(q1.clienteId?._id ?? q1.clienteId),
  'mesmo cliente')

// ── Opção 02 — micro ────────────────────────────────────────────────────────
secao('3 · Opção 02 recebe topologia PRÓPRIA (micro)')
await salvar(P2, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
await salvar(P2, 'fatura', { tipo_ligacao: 'Monofásico', tensao_v: 220, concessionaria: 'Neoenergia' })
await salvar(P2, 'equipamentos', { paineis: [painel()], inversor: comp(HM, 8, 'micro'),
  estrutura: { tipo: 'Fibrocimento', descricao: '' } })
await salvar(P2, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal', topologia: 'micro',
  paineis: [painel()], inversores: [comp(HM, 8, 'micro')],
  configuracao_eletrica: { micros: [{ equipamento_id: String(HM._id), marca: HM.fabricante,
    modelo: HM.modelo, quantidade: 8, entradas_por_micro: 4, modulos_por_entrada: 1,
    distribuicao: [3, 3, 3, 3, 3, 3, 3, 3] }] } }] })

const u1 = (await api('POST', `/api/projetos-fv/${P1}/unifilar/gerar`, {})).json
const u2 = (await api('POST', `/api/projetos-fv/${P2}/unifilar/gerar`, {})).json
ok(u1?.especificacoes?.num_mppts !== undefined, `Opção 01 desenhada pelo motor STRING (${u1?.especificacoes?.num_mppts} MPPT)`)
ok(u2?.especificacoes?.topologia === 'micro', 'Opção 02 desenhada pelo motor MICRO')
ok(u2?.especificacoes?.num_microinversores === 8, `8 microinversores (${u2?.especificacoes?.num_microinversores})`)
ok(u1.svg !== u2.svg, 'os dois unifilares são diferentes')

// A Opção 01 não foi contaminada.
const q1b = await ler(P1)
ok(q1b.equipamentos?.inversor?.modelo === 'SG15RT', `Opção 01 intacta: ${q1b.equipamentos?.inversor?.modelo}`)
ok(q1b.engenharia_eletrica?.arranjo?.mppts?.length === 2, 'MPPTs da Opção 01 preservados')
ok(!q1b.arranjos?.[0]?.configuracao_eletrica?.micros, 'Opção 01 não ganhou micros')

// ── Orçamento e Baseline por opção ──────────────────────────────────────────
secao('4 · Cada opção tem orçamento e Baseline PRÓPRIOS (regra 2)')
async function aprovarOrcamento(P, valor) {
  const c = await api('POST', `/api/projetos-fv/${P}/cotacoes`, { tecnologia: 'fv', premissas: {} })
  const cid = c.json?.cotacao?._id ?? c.json?._id
  const o = await api('POST', `/api/projetos-fv/${P}/orcamentos`, { cotacao_ref: cid,
    itens: [{ descricao: 'kit', quantidade: 1, valor_unitario_r: valor, valor_total_r: valor }] })
  const oid = o.json?.orcamento?._id ?? o.json?._id
  await api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/emitir`, {})
  const ap = await api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/aprovar`, {})
  return ap.status
}
ok(await aprovarOrcamento(P1, 50000) === 200, 'orçamento da Opção 01 aprovado')
ok(await aprovarOrcamento(P2, 58000) === 200, 'orçamento da Opção 02 aprovado')
const b1 = (await api('GET', `/api/projetos-fv/${P1}/baseline`)).json
const b2 = (await api('GET', `/api/projetos-fv/${P2}/baseline`)).json
ok(!!b1?.baseline && !!b2?.baseline, 'as DUAS têm Baseline (regra 7)')
ok(b1.baseline.hash !== b2.baseline.hash, `hashes distintos: ${b1.baseline.hash?.slice(0, 8)} / ${b2.baseline.hash?.slice(0, 8)}`)

secao('5 · Aprovar orçamento NÃO é aceitar a proposta (regra 3)')
for (const [rot, P] of [['Opção 01', P1], ['Opção 02', P2]]) {
  const p = await ler(P)
  ok(p.proposta_aceite?.aceita !== true, `${rot}: orçamento aprovado, proposta NÃO aceita`)
  const g = (await api('GET', `/api/projetos-fv/${P}/gate`)).json
  const eng = g?.fases?.engenharia
  ok(eng?.liberado === false && eng?.motivo === 'PROPOSTA_SEM_ACEITE',
    `${rot}: gate BLOQUEADO — ${eng?.motivo}`)
}

secao('6 · O aceite escolhe UMA opção (regra 4) e só ela avança (regra 5)')
// FV-UX-035: o aceite passou a exigir que a proposta tenha sido ENVIADA ao
// cliente. Antes desta sprint o endpoint não exigia nada, e por isso estes
// scripts aceitavam direto. O envio não altera nada que eles medem — ele
// apenas recoloca a proposta na condição em que o aceite é possível.
await api('POST', `/api/projetos-fv/${P2}/proposta/enviar`, {})
const ac = await api('POST', `/api/projetos-fv/${P2}/proposta/aceitar`, { motivo: 'cliente escolheu micro' })
ok(ac.status === 200, `Opção 02 aceita (HTTP ${ac.status})`)
{
  const g2 = (await api('GET', `/api/projetos-fv/${P2}/gate`)).json
  ok(g2?.fases?.engenharia?.liberado === true, 'Opção 02: engenharia LIBERADA')
  ok(g2?.fases?.homologacao?.liberado === true, 'Opção 02: homologação LIBERADA')
  const g1 = (await api('GET', `/api/projetos-fv/${P1}/gate`)).json
  ok(g1?.fases?.engenharia?.liberado === false && g1?.fases?.engenharia?.motivo === 'OPCAO_NAO_ESCOLHIDA',
    `Opção 01: BLOQUEADA — ${g1?.fases?.engenharia?.motivo}`)
  ok(/não foi a escolhida/.test(g1?.fases?.engenharia?.mensagem ?? ''), 'a mensagem explica o motivo')
}

secao('7 · Regra 8 — nenhuma outra opção pode ser aceita')
{
  const r = await api('POST', `/api/projetos-fv/${P1}/proposta/aceitar`, {})
  ok(r.status === 409 && r.json?.codigo === 'PROPOSTA_JA_ACEITA',
    `Opção 01 recusada: HTTP ${r.status} · ${r.json?.codigo}`)
  const q = await ler(P1)
  ok(q.proposta_aceite?.aceita !== true, 'e a Opção 01 continua não aceita')
}

secao('8 · Regras 6, 7 e 9 — a perdedora permanece íntegra e consultável')
{
  const q = await ler(P1)
  ok(!!q && q.excluido !== true, 'Opção 01 NÃO foi excluída')
  ok(q.status !== 'arquivado', 'nem arquivada automaticamente')
  const b = (await api('GET', `/api/projetos-fv/${P1}/baseline`)).json
  ok(b?.baseline?.hash === b1.baseline.hash, 'a Baseline dela continua com o MESMO hash')
  ok(b?.integridade?.ok !== false, 'e continua íntegra')
  const u = (await api('POST', `/api/projetos-fv/${P1}/unifilar/gerar`, {})).json
  ok(!!u?.svg, 'o unifilar dela continua consultável')
  const fin = (await api('POST', `/api/projetos-fv/${P1}/financeiro/calcular`, {})).json
  ok(fin?.sucesso !== false, 'o financeiro dela continua calculável')
}

secao('9 · A proposta lista as suas opções')
{
  const l = (await api('GET', `/api/projetos-fv/${P1}/opcoes`)).json
  ok(l?.opcoes?.length === 2, `${l?.opcoes?.length} opções no grupo`)
  ok(l.opcoes[0].opcao_rotulo === 'Opção 01' && l.opcoes[1].opcao_rotulo === 'Opção 02',
    `ordenadas: ${l.opcoes.map((o) => o.opcao_rotulo).join(', ')}`)
  ok(String(l?.aceita?._id) === String(P2), `a aceita é a ${l?.aceita?.opcao_rotulo}`)
  const doOutro = (await api('GET', `/api/projetos-fv/${P2}/opcoes`)).json
  ok(doOutro?.opcoes?.length === 2, 'qualquer irmã enxerga o grupo inteiro')
}

secao('10 · Projeto SEM opções não muda de comportamento')
{
  const PS = (await api('POST', '/api/projetos-fv',
    { nome: `FV-DOM-032 sozinho ${Date.now()}`, clienteId: cred.cliente_id })).json?._id
  const p = await ler(PS)
  ok(p.tipo_projeto === 'novo' && !p.proposta_grupo_id, 'nasce `novo`, sem grupo')
  const g = (await api('GET', `/api/projetos-fv/${PS}/gate`)).json
  ok(g?.fases?.engenharia?.motivo === 'SEM_BASELINE',
    `gate decide como sempre: ${g?.fases?.engenharia?.motivo}`)
  const l = (await api('GET', `/api/projetos-fv/${PS}/opcoes`)).json
  ok(l?.opcoes?.length === 0 && l?.proposta_grupo_id === null, 'sem grupo, sem opções')
}

console.log(falhas === 0
  ? `\nOK — duas opções completas, uma aceita, a outra íntegra e bloqueada.\n   Opção 01: ${P1}\n   Opção 02: ${P2}`
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
