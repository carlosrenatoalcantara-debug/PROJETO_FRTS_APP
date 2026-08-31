/**
 * validacao-fv-ux-030.mjs — FV-UX-030
 *
 * Prova, pela API canônica (a mesma que a nova UX chama), que a estrutura:
 *   1. grava em `equipamentos.estrutura.{tipo,descricao}` — campos existentes;
 *   2. sobrevive a salvar → recarregar → editar, com o texto exato;
 *   3. não apaga a composição de módulos e inversores, e não é apagada por ela;
 *   4. ausência permanece ausência — nada é preenchido pelo servidor;
 *   5. valor legado fora da lista da UX é aceito e devolvido intacto;
 *   6. não altera dimensionamento, engenharia elétrica nem financeiro.
 *
 * Ambiente isolado (37017). Não toca produção.
 *
 *   node backend/scripts/validacao-fv-ux-030.mjs
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cred = JSON.parse(readFileSync(path.join(RAIZ, '.ambiente-validacao.json'), 'utf8'))
const TOKEN = readFileSync(path.join(RAIZ, '.token-validacao'), 'utf8').trim()
const API = 'http://127.0.0.1:5001'

if (!cred.uri.includes('37017')) { console.error('❌ só no ambiente isolado'); process.exit(1) }

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n══ ${t}`)

async function api(metodo, caminho, corpo) {
  const r = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  let json = null
  try { json = await r.json() } catch { /* sem corpo */ }
  return { status: r.status, json }
}
const lerProjeto = async (id) => { const r = await api('GET', `/api/projetos-fv/${id}`); return r.json?.projeto ?? r.json }
const salvar = (id, etapa, dados) => api('PUT', `/api/projetos-fv/${id}/etapa`, { etapa, dados })

console.log('═══ FV-UX-030 — estrutura da instalação ═══')

// ── Projeto de trabalho ─────────────────────────────────────────────────────
const criado = await api('POST', '/api/projetos-fv', {
  nome: `FV-UX-030 estrutura ${Date.now()}`, clienteId: cred.cliente_id,
})
const P = criado.json?._id ?? criado.json?.projeto?._id
ok(!!P, `projeto criado (HTTP ${criado.status}) ${P}`)
if (!P) { console.error(JSON.stringify(criado.json)); process.exit(1) }

// Composição, como a EtapaEquipamentos grava (arranjos[] + projeção legada).
const PAINEL = { id: 'm1', marca: 'Znshine', modelo: 'ZXM7-UHLD144-650/M', potencia_w: 650, quantidade: 24 }
const INVERSOR = { id: 'i1', marca: 'Sungrow', modelo: 'SG15RT', potencia_kw: 15, tipo: 'string', fases: 3 }
await salvar(P, 'arranjos', {
  lista: [{ id: 'principal', rotulo: 'Arranjo principal', tipo: 'principal',
    paineis: [PAINEL], inversores: [{ ...INVERSOR, quantidade: 1 }] }],
})
await salvar(P, 'equipamentos', { paineis: [PAINEL], inversor: INVERSOR, estrutura: { tipo: '', descricao: '' } })
await salvar(P, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })

secao('1 · Ausência permanece ausência')
{
  const p = await lerProjeto(P)
  ok(p?.equipamentos?.estrutura?.tipo === '', `tipo vazio permanece vazio (recebido: ${JSON.stringify(p?.equipamentos?.estrutura?.tipo)})`)
  ok(!p?.equipamentos?.estrutura?.descricao, 'descrição vazia — servidor não preencheu nada')
}

secao('2 · Cada um dos seis tipos grava e volta idêntico')
for (const tipo of ['Fibrocimento', 'Cerâmico', 'Metálico', 'Solo', 'Laje', 'Outro']) {
  const anterior = await lerProjeto(P)
  const descricao = tipo === 'Outro' ? 'trapézio sobre mezanino' : ''
  const r = await salvar(P, 'equipamentos', { ...anterior.equipamentos, estrutura: { tipo, descricao } })
  const p = await lerProjeto(P)
  ok(r.status === 200 && p?.equipamentos?.estrutura?.tipo === tipo,
    `${tipo}: HTTP ${r.status}, lido "${p?.equipamentos?.estrutura?.tipo}"`)
  if (tipo === 'Outro') {
    ok(p?.equipamentos?.estrutura?.descricao === descricao, `  ↳ descrição preservada: "${p?.equipamentos?.estrutura?.descricao}"`)
  }
}

secao('3 · Salvar a estrutura NÃO apaga a composição')
{
  const p = await lerProjeto(P)
  ok(p?.equipamentos?.paineis?.length === 1, `1 painel na projeção (${p?.equipamentos?.paineis?.length})`)
  ok(p?.equipamentos?.paineis?.[0]?.modelo === PAINEL.modelo, `módulo intacto: ${p?.equipamentos?.paineis?.[0]?.modelo}`)
  ok(p?.equipamentos?.paineis?.[0]?.quantidade === 24, `quantidade intacta: ${p?.equipamentos?.paineis?.[0]?.quantidade}`)
  ok(p?.equipamentos?.inversor?.modelo === INVERSOR.modelo, `inversor intacto: ${p?.equipamentos?.inversor?.modelo}`)
  const a = p?.arranjos?.[0]
  ok(a?.paineis?.[0]?.quantidade === 24, `arranjos[] intacto: ${a?.paineis?.[0]?.quantidade} módulos`)
  ok(a?.inversores?.[0]?.quantidade === 1, `arranjos[] intacto: ${a?.inversores?.[0]?.quantidade} inversor`)
}

secao('4 · Editar a composição NÃO apaga a estrutura')
{
  const antes = await lerProjeto(P)
  const estruturaAntes = antes.equipamentos.estrutura
  // É o que `projecaoLegado()` monta: carrega o que veio e troca só a composição.
  await salvar(P, 'arranjos', {
    lista: [{ ...antes.arranjos[0], paineis: [{ ...PAINEL, quantidade: 30 }] }],
  })
  await salvar(P, 'equipamentos', {
    ...antes.equipamentos,
    paineis: [{ ...PAINEL, quantidade: 30 }],
  })
  const p = await lerProjeto(P)
  ok(p?.equipamentos?.paineis?.[0]?.quantidade === 30, `composição alterada para 30 (${p?.equipamentos?.paineis?.[0]?.quantidade})`)
  ok(p?.equipamentos?.estrutura?.tipo === estruturaAntes.tipo,
    `estrutura preservada: "${p?.equipamentos?.estrutura?.tipo}"`)
  ok(p?.equipamentos?.estrutura?.descricao === estruturaAntes.descricao,
    `descrição preservada: "${p?.equipamentos?.estrutura?.descricao}"`)
}

secao('5 · Valor legado fora da lista é aceito e devolvido intacto')
{
  const antes = await lerProjeto(P)
  await salvar(P, 'equipamentos', { ...antes.equipamentos, estrutura: { tipo: 'Mini Trilho', descricao: '' } })
  const p = await lerProjeto(P)
  ok(p?.equipamentos?.estrutura?.tipo === 'Mini Trilho',
    `"Mini Trilho" não foi reclassificado (lido: "${p?.equipamentos?.estrutura?.tipo}")`)
}

secao('6 · Limpar a estrutura tem efeito')
{
  const antes = await lerProjeto(P)
  await salvar(P, 'equipamentos', { ...antes.equipamentos, estrutura: { tipo: '', descricao: '' } })
  const p = await lerProjeto(P)
  ok(p?.equipamentos?.estrutura?.tipo === '', 'estrutura limpa de fato')
  ok(p?.equipamentos?.paineis?.length === 1, 'a composição continua lá')
}

secao('7 · Nada de dimensionamento, engenharia elétrica ou financeiro mudou')
{
  const antes = await lerProjeto(P)
  await salvar(P, 'equipamentos', { ...antes.equipamentos, estrutura: { tipo: 'Solo', descricao: '' } })
  const p = await lerProjeto(P)
  ok(p?.dimensionamento?.num_paineis === 24, `dimensionamento intacto (${p?.dimensionamento?.num_paineis})`)
  ok(p?.dimensionamento?.potencia_kwp === 15.6, `potência intacta (${p?.dimensionamento?.potencia_kwp})`)
  ok(JSON.stringify(p?.engenharia_eletrica ?? {}) === JSON.stringify(antes.engenharia_eletrica ?? {}),
    'engenharia elétrica byte a byte igual')
  ok(JSON.stringify(p?.financeiro ?? {}) === JSON.stringify(antes.financeiro ?? {}),
    'financeiro byte a byte igual')
  ok(!('estrutura' in (p?.arranjos?.[0] ?? {})), 'nenhum campo `estrutura` foi criado em arranjos[]')
}

console.log(falhas === 0
  ? `\nOK — estrutura persistida em campo existente, íntegra em ida e volta, sem tocar nada mais.\n   projeto: ${P}`
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
