/**
 * auditoria-e2e-fv.mjs — FV-OPS-001
 *
 * Percorre o fluxo FV pela API canônica — a mesma que a nova UX consome — e
 * registra ONDE ele para. Não corrige nada; só observa.
 *
 * Roda exclusivamente contra o ambiente isolado (porta 37017).
 *
 *   node backend/scripts/auditoria-e2e-fv.mjs
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cred = JSON.parse(readFileSync(path.join(RAIZ, '.ambiente-validacao.json'), 'utf8'))
const TOKEN = readFileSync(path.join(RAIZ, '.token-validacao'), 'utf8').trim()
const API = 'http://127.0.0.1:5001'

if (!cred.uri.includes('37017')) {
  console.error('❌ RECUSADO: só roda no ambiente isolado.')
  process.exit(1)
}

const resultados = []
const registrar = (etapa, estado, detalhe) => {
  resultados.push({ etapa, estado, detalhe })
  const icone = estado === 'OK' ? '✓' : estado === 'BLOQUEADO' ? '✗' : '⚠'
  console.log(`${icone} ${etapa.padEnd(28)} ${detalhe}`)
}

async function api(metodo, caminho, corpo) {
  const r = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo ?? {}),
  })
  let json = null
  try { json = await r.json() } catch { /* resposta sem corpo */ }
  return { status: r.status, json }
}

console.log('═══ AUDITORIA E2E — fluxo FV pela API canônica ═══\n')

// ── 1 · Cliente ─────────────────────────────────────────────────────────────
const selo = Date.now().toString().slice(-8)
let cliente = await api('POST', '/api/clientes', {
  nome: `Cliente E2E ${selo}`, email: `e2e+${selo}@teste.com`,
  cidade: 'Natal', estado: 'RN',
})
registrar('1 · Cliente', cliente.status === 201 || cliente.status === 200 ? 'OK' : 'BLOQUEADO',
  `HTTP ${cliente.status} ${cliente.json?._id ?? cliente.json?.cliente?._id ?? JSON.stringify(cliente.json)?.slice(0, 80)}`)
const clienteId = cliente.json?._id ?? cliente.json?.cliente?._id ?? cred.cliente_id

// ── 2 · Projeto FV ──────────────────────────────────────────────────────────
const proj = await api('POST', '/api/projetos-fv', {
  nome: `Projeto E2E ${selo}`, clienteId,
})
const projetoId = proj.json?._id ?? proj.json?.projeto?._id
registrar('2 · Projeto FV', projetoId ? 'OK' : 'BLOQUEADO',
  `HTTP ${proj.status} ${projetoId ?? JSON.stringify(proj.json)?.slice(0, 100)}`)
if (!projetoId) { console.log('\nsem projeto — auditoria encerrada'); process.exit(1) }

// ── 3/4/5 · Dados técnicos, dimensionamento, equipamentos ───────────────────
// Existe caminho CANÔNICO (rota que a nova UX consome) para preencher isso?
const etapaTecnica = await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'dimensionamento',
  dados: { potencia_kwp: 14.3, geracao_anual_kwh: 18000, num_paineis: 26 },
})
registrar('3 · Dados técnicos', etapaTecnica.status === 200 ? 'PARCIAL' : 'BLOQUEADO',
  `PUT /:id/etapa → HTTP ${etapaTecnica.status} — rota do WIZARD, sem tela na nova UX`)

const equip = await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'equipamentos',
  dados: {
    paineis: [{ id: 'dah_550', marca: 'DAH', modelo: 'DHN-550', potencia_w: 550, quantidade: 26 }],
    inversor: { marca: 'Deye', modelo: 'SUN-8K-G03', potencia_kw: 8, tipo: 'string', fases: 3 },
  },
})
registrar('4 · Equipamentos', equip.status === 200 ? 'PARCIAL' : 'BLOQUEADO',
  `PUT /:id/etapa → HTTP ${equip.status} — rota do WIZARD, sem tela na nova UX`)

// ── 6 · Cotação ─────────────────────────────────────────────────────────────
const cot = await api('POST', `/api/projetos-fv/${projetoId}/cotacoes`, {
  tecnologia: 'string', rotulo: 'E2E',
  premissas: { consumo_kwh_mes: 1500, tarifa_kwh: 0.98, hsp_kwh_m2_dia: 5.2, inflacao_energia_aa_pct: 6 },
})
const cotacaoId = cot.json?.cotacao?._id
registrar('6 · Cotação', cotacaoId ? 'OK' : 'BLOQUEADO', `HTTP ${cot.status} ${cotacaoId ?? ''}`)

// ── 7 · Orçamento ───────────────────────────────────────────────────────────
const orc = await api('POST', `/api/projetos-fv/${projetoId}/orcamentos`, {
  cotacao_ref: cotacaoId,
  itens: [
    { descricao: 'Kit FV 14,3 kWp', tipo: 'material', quantidade: 1, valor_unitario_r: 62000 },
    { descricao: 'Instalação', tipo: 'servico', quantidade: 1, valor_unitario_r: 18000 },
  ],
  condicoes: { validade_dias: 15, prazo_execucao_dias: 45 },
})
const orcamentoId = orc.json?.orcamento?._id
registrar('7 · Orçamento', orcamentoId ? 'OK' : 'BLOQUEADO', `HTTP ${orc.status} ${orcamentoId ?? ''}`)

const emitir = await api('POST', `/api/projetos-fv/${projetoId}/orcamentos/${orcamentoId}/emitir`, {})
registrar('7b · Emitir', emitir.status === 200 ? 'OK' : 'BLOQUEADO', `HTTP ${emitir.status}`)

// ── 8 · Financeiro V1 ───────────────────────────────────────────────────────
const fin = await api('POST', `/api/projetos-fv/${projetoId}/financeiro/calcular`, {})
const f = fin.json?.financeiro
registrar('8 · Financeiro V1', f?.payback?.anos != null ? 'OK' : 'PARCIAL',
  `payback ${f?.payback?.anos} · VPL ${f?.vpl?.valor_r} · lacunas ${JSON.stringify(f?.lacunas)}`)

// ── 9 · Aprovação ───────────────────────────────────────────────────────────
const aprov = await api('POST', `/api/projetos-fv/${projetoId}/orcamentos/${orcamentoId}/aprovar`, {})
registrar('9 · Aprovação', aprov.status === 200 ? 'OK' : 'BLOQUEADO',
  `HTTP ${aprov.status} ${aprov.json?.erro ?? ''}`)

// ── 10 · Baseline ───────────────────────────────────────────────────────────
const bl = await api('GET', `/api/projetos-fv/${projetoId}/baseline`)
registrar('10 · Baseline', bl.json?.baseline ? 'OK' : 'BLOQUEADO',
  `HTTP ${bl.status} hash ${bl.json?.baseline?.hash?.slice(0, 12) ?? '—'} · íntegra: ${bl.json?.integra}`)

// ── 11 · Gate ───────────────────────────────────────────────────────────────
const gate = await api('GET', `/api/projetos-fv/${projetoId}/gate`)
const eng = gate.json?.fases?.engenharia
registrar('11 · Gate', eng?.liberado === true ? 'OK' : 'BLOQUEADO',
  `engenharia liberada: ${eng?.liberado} ${eng?.motivo ?? ''}`)

// ── 12 · Unifilar ───────────────────────────────────────────────────────────
const uni = await api('POST', `/api/projetos-fv/${projetoId}/unifilar/gerar`, {})
registrar('12 · Unifilar', uni.json?.svg ? (uni.json.lacunas?.length ? 'PARCIAL' : 'OK') : 'BLOQUEADO',
  `svg ${uni.json?.svg?.length ?? 0} bytes · lacunas ${JSON.stringify(uni.json?.lacunas)}`)

// ── Beneficiárias (etapa da nova UX, fora do caminho principal) ─────────────
const ben = await api('GET', `/api/projetos-fv/${projetoId}/beneficiarias/resumo`)
registrar('+ Beneficiárias', ben.status === 200 ? 'OK' : 'BLOQUEADO',
  `HTTP ${ben.status} total ${ben.json?.total}`)

// ── Resumo ──────────────────────────────────────────────────────────────────
console.log('\n═══ RESUMO ═══')
for (const e of ['OK', 'PARCIAL', 'BLOQUEADO']) {
  const lista = resultados.filter((r) => r.estado === e)
  if (lista.length) console.log(`${e}: ${lista.map((r) => r.etapa.split(' · ')[1] ?? r.etapa).join(', ')}`)
}
console.log(`\nprojeto auditado: ${projetoId}`)
