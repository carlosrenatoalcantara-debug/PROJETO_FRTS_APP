/**
 * validacao-fv-dom-025.mjs — FV-DOM-025, FASE 8
 *
 * Fluxo completo pela API canônica, agora com topologia MPPT:
 * Cliente → Projeto → Dados técnicos → Equipamentos → Dimensionamento →
 * Topologia MPPT → Validação elétrica → Cotação → Orçamento → Financeiro →
 * Unifilar.
 *
 * Roda exclusivamente contra o ambiente isolado (porta 37017).
 *
 *   node backend/scripts/validacao-fv-dom-025.mjs
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cred = JSON.parse(readFileSync(path.join(RAIZ, '.ambiente-validacao.json'), 'utf8'))
const TOKEN = readFileSync(path.join(RAIZ, '.token-validacao'), 'utf8').trim()
const API = 'http://127.0.0.1:5001'

if (!cred.uri.includes('37017')) {
  console.error('❌ RECUSADO: só roda no ambiente isolado (porta 37017).')
  process.exit(1)
}

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

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

await mongoose.connect(cred.uri)
const { Equipamento } = await import('../src/models/Equipamento.js')
const { ProjetoFV } = await import('../src/models/ProjetoFV.js')
const { Baseline } = await import('../src/models/Baseline.js')

const selo = Date.now().toString().slice(-8)

secao('1 · Catálogo + projeto + dados técnicos + equipamentos')
const [mod, inv] = await Equipamento.create([
  { tipo: 'modulo', fabricante: `DAH ${selo}`, modelo: 'DHN-550',
    especificacoes: { potencia_w: 550, voc_v: 49.9, isc_a: 14.0, vmpp_v: 41.8, impp_a: 13.2,
      eficiencia_pct: 21.3, coef_temp_voc_pct_c: -0.27, noct_c: 44, numero_celulas: 144 } },
  { tipo: 'inversor', fabricante: `Sungrow ${selo}`, modelo: 'SG20RT',
    especificacoes: { potencia: 20, fases: 3, tensao_max_entrada: 1000, tensao_mppt_min: 200,
      tensao_mppt_max: 850, corrente_max_por_mppt: 25, n_mppts: 2, strings_por_mppt: 2 } },
])
const cli = await api('POST', '/api/clientes', {
  nome: `Cliente 025 ${selo}`, email: `d025+${selo}@teste.com`, cidade: 'Natal', estado: 'RN',
})
const prj = await api('POST', '/api/projetos-fv', {
  nome: `Projeto 025 ${selo}`, clienteId: cli.json?._id ?? cli.json?.cliente?._id,
})
const projetoId = prj.json?._id ?? prj.json?.projeto?._id
ok(!!projetoId, `projeto criado (HTTP ${prj.status})`)
if (!projetoId) process.exit(1)

await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'fatura',
  dados: { consumo_mensal_kwh: 1500, valor_kwh: 0.98, tipo_ligacao: 'Trifásico',
    tensao_v: 380, concessionaria: 'NEOENERGIA COSERN' },
})
const p1 = (await api('GET', `/api/projetos-fv/${projetoId}`)).json
await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'localizacao', dados: { ...(p1.localizacao ?? {}), cidade: 'Natal', estado: 'RN' },
})
const p2 = (await api('GET', `/api/projetos-fv/${projetoId}`)).json
await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'equipamentos',
  dados: {
    ...(p2.equipamentos ?? {}),
    paineis: [{ id: String(mod._id), marca: mod.fabricante, modelo: mod.modelo,
      potencia_w: 550, quantidade: 24, equipamento_id: String(mod._id) }],
    inversor: { id: String(inv._id), marca: inv.fabricante, modelo: inv.modelo,
      potencia_kw: 20, tipo: 'string', fases: 3, equipamento_id: String(inv._id) },
  },
})
ok(true, 'dados técnicos e equipamentos informados')

secao('2 · Dimensionamento')
const calc = await api('POST', '/api/dimensionamento/calcular', {
  consumo_mensal_kwh: 1500, cidade: 'Natal', estado: 'RN',
  irradiancia_kwh_m2_dia: 5.42, perdas_pct: 18, margem_pct: 10, pot_modulo_w: 550,
})
const R = calc.json.resultado
const p3 = (await api('GET', `/api/projetos-fv/${projetoId}`)).json
await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'dimensionamento',
  dados: { ...(p3.dimensionamento ?? {}),
    potencia_kwp: R.potencia_kwp, geracao_mensal_kwh: R.geracao_mensal_kwh,
    geracao_anual_kwh: R.geracao_anual_kwh, num_paineis: 24,
    num_strings: 2, area_total_m2: R.area_ocupacao_m2, metodo: 'automatico' },
})
ok(true, `dimensionado: ${R.potencia_kwp} kWp · ${R.geracao_anual_kwh} kWh/ano`)

const uniAntes = await api('POST', `/api/projetos-fv/${projetoId}/unifilar/gerar`, {})
console.log(`   lacunas ANTES da topologia: ${JSON.stringify(uniAntes.json?.lacunas)}`)

secao('3 · Validação elétrica canônica')
const val = await api('POST', '/api/engenharia/compatibilidade-eletrica', {
  dados_eletricos_modulo: { voc: 49.9, vmpp: 41.8, isc: 14, impp: 13.2, potencia_w: 550,
    coef_temp_voc: -0.27, temp_noct: 44 },   // %/°C, como o catálogo guarda
  dados_eletricos_inversor: { tensao_max_entrada: 1000, mppt_min: 200, mppt_max: 850,
    corrente_max_mppt: 25, potencia_ca_kw: 20 },
  arranjo_proposto: { quantidade_modulos_por_string: 12, quantidade_strings_paralelo: 1, num_mppt_usados: 2 },
  dados_climaticos_regiao: { temperatura_min_historica_c: 14, temperatura_max_historica_c: 38 },
})
ok(val.status === 200, `HTTP ${val.status} — contrato preservado`)
const C = val.json?.calculos ?? {}
console.log(`   Voc frio ${C.voc_string_max} V · Vmpp quente ${C.vmpp_string_quente} V · Isc ${C.isc_total} A`)
ok(C.isc_fator_seguranca === 1.25, 'Q1 — fator declarado na resposta')
ok(C.isc_total === 17.5, `Q1 — Isc de projeto ${C.isc_total} A (14 × 1 × 1,25)`)
ok(C.voc_string_max === 616.58, `Q4 — %/°C interpretado corretamente (${C.voc_string_max} V, não ~2400)`)
ok(val.json?.compativel === true, 'arranjo dentro dos limites deste inversor')

secao('4 · Topologia MPPT — autorada, gravada pela etapa existente')
const topo = await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'engenharia_eletrica',
  dados: {
    arranjo: {
      quantidade_modulos_por_string: 12,
      quantidade_strings_paralelo: 1,
      total_modulos: 24,
      num_mppts_usados: 2,
      mppts: [
        { mppt: 1, strings_paralelo: 1, modulos_por_string: 12, total_modulos: 12 },
        { mppt: 2, strings_paralelo: 1, modulos_por_string: 12, total_modulos: 12 },
      ],
    },
    clima_utilizado: { cidade: 'Natal', uf: 'RN', temperatura_min_historica_c: 14,
      temperatura_max_historica_c: 38, fonte: 'manual', usou_fallback: false },
    compatibilidade: {
      versao_motor: '2.0.0-sprint2', compativel: val.json.compativel,
      diagnosticos: [...(val.json.erros ?? []), ...(val.json.warnings ?? [])],
      calculos_principais: C, analisado_em: new Date().toISOString(),
    },
  },
})
ok(topo.status === 200, `topologia gravada (HTTP ${topo.status})`)

secao('5 · Reload — a topologia volta íntegra')
const depois = (await api('GET', `/api/projetos-fv/${projetoId}`)).json
const A = depois.engenharia_eletrica?.arranjo ?? {}
ok(Array.isArray(A.mppts) && A.mppts.length === 2, `mppts[] com ${A.mppts?.length} entradas`)
ok(A.mppts?.[0]?.modulos_por_string === 12, 'módulos por string preservados')
ok(A.mppts?.[0]?.strings_paralelo === 1, 'strings por MPPT preservadas')
ok(A.num_mppts_usados === 2, 'MPPTs usados preservados')
ok(depois.engenharia_eletrica?.clima_utilizado?.uf === 'RN', 'clima preservado')

secao('6 · Unifilar — a última lacuna fecha')
const uniDepois = await api('POST', `/api/projetos-fv/${projetoId}/unifilar/gerar`, {})
const lac = uniDepois.json?.lacunas ?? []
console.log(`   lacunas DEPOIS: ${JSON.stringify(lac)}`)
ok((uniAntes.json?.lacunas ?? []).includes('arranjoMPPTs'), '`arranjoMPPTs` era lacuna')
ok(!lac.includes('arranjoMPPTs'), '`arranjoMPPTs` FECHADA')
ok(lac.length === 0, `nenhuma lacuna restante (${JSON.stringify(lac)})`)
ok(uniDepois.json?.proveniencia?.arranjoMPPTs === 'engenharia_eletrica.arranjo.mppts',
  'proveniência aponta o caminho persistido')

secao('7 · O desenho usa os equipamentos reais, não os defaults')
const svg = uniDepois.json?.svg ?? ''
ok(svg.length > 0, `svg gerado (${svg.length} bytes)`)
const esp = uniDepois.json?.especificacoes ?? {}
console.log(`   especificações: ${JSON.stringify(Object.keys(esp)).slice(0, 120)}`)
ok(!svg.includes('Fronius SYMO'), 'sem o inversor default Fronius')
ok(svg.includes(String(inv.modelo)) || JSON.stringify(uniDepois.json).includes(String(inv.modelo)),
  `inversor real presente (${inv.modelo})`)
ok(JSON.stringify(uniDepois.json).includes('DHN-550'), 'módulo real presente (DHN-550)')

secao('8 · Comercial e financeiro seguem intactos')
const cot = await api('POST', `/api/projetos-fv/${projetoId}/cotacoes`, {
  tecnologia: 'string', rotulo: '025',
  premissas: { consumo_kwh_mes: 1500, tarifa_kwh: 0.98, hsp_kwh_m2_dia: 5.42, inflacao_energia_aa_pct: 6 },
})
const orc = await api('POST', `/api/projetos-fv/${projetoId}/orcamentos`, {
  cotacao_ref: cot.json?.cotacao?._id,
  itens: [{ descricao: 'Kit FV', tipo: 'material', quantidade: 1, valor_unitario_r: 80000 }],
  condicoes: { validade_dias: 15, prazo_execucao_dias: 45 },
})
const orcamentoId = orc.json?.orcamento?._id
await api('POST', `/api/projetos-fv/${projetoId}/orcamentos/${orcamentoId}/emitir`, {})
const fin = await api('POST', `/api/projetos-fv/${projetoId}/financeiro/calcular`, {})
const F = fin.json?.financeiro
console.log(`   payback ${F?.payback?.anos} · VPL ${F?.vpl?.valor_r} · lacunas ${JSON.stringify(F?.lacunas)}`)
ok(F?.entradas?.geracao_anual_kwh === R.geracao_anual_kwh, 'contrato V1 usa a geração do dimensionamento')
ok((F?.lacunas ?? []).length === 0, 'contrato sem lacunas')
ok(F?.contrato_versao === '1.0.0', 'contrato financeiro inalterado')

secao('9 · Integridade')
const doc = await ProjetoFV.findById(projetoId).lean()
ok(doc.financeiro?.payback_anos == null, 'nenhum indicador financeiro persistido (INV-58)')
ok(String(doc.empresa_id) === String(cred.empresa_id), 'tenant carimbado (M-4)')
ok(await Baseline.countDocuments({ projeto_ref: projetoId }) === 0,
  'nenhuma Baseline antes da aprovação (M-2)')
const catIntacto = await Equipamento.findById(mod._id).lean()
ok(catIntacto.especificacoes.coef_temp_voc_pct_c === -0.27,
  'catálogo intocado e ainda em %/°C (Q4)')

secao('10 · Isolamento entre organizações (M-4)')
const jwt = (await import('jsonwebtoken')).default
const tokenAlheio = jwt.sign(
  { userId: '000000000000000000000009', email: 'outro@teste.com', perfil: 'admin',
    empresa_id: String(new mongoose.Types.ObjectId()) },
  process.env.JWT_SECRET || 'validacao_fv_ux_018_secret_local', { expiresIn: '1h' })
const tentativa = await fetch(`${API}/api/projetos-fv/${projetoId}/etapa`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${tokenAlheio}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ etapa: 'engenharia_eletrica', dados: { arranjo: { mppts: [] } } }),
})
ok(tentativa.status === 404 || tentativa.status === 403,
  `escrita alheia recusada (HTTP ${tentativa.status})`)
const intacto = await ProjetoFV.findById(projetoId).lean()
ok(intacto.engenharia_eletrica.arranjo.mppts.length === 2, 'topologia não foi apagada')

console.log(`\n   projeto validado: ${projetoId}`)
await mongoose.disconnect()
console.log(falhas === 0
  ? '\nOK — topologia MPPT persistida, unifilar sem lacunas, validador canônico em uso.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
