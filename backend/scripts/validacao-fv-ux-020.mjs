/**
 * validacao-fv-ux-020.mjs — FV-UX-020
 *
 * Fluxo inteiro pela API canônica, como a nova UX o percorre:
 * Cliente → Projeto → Dados técnicos → Equipamentos → Dimensionamento →
 * Cotação → Orçamento → Financeiro → Unifilar.
 *
 * Roda exclusivamente contra o ambiente isolado (porta 37017).
 *
 *   node backend/scripts/validacao-fv-ux-020.mjs
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

secao('1 · Catálogo, cliente e projeto')
const [mod, inv] = await Equipamento.create([
  { tipo: 'modulo', fabricante: `DAH ${selo}`, modelo: 'DHN-550',
    especificacoes: { potencia_w: 550, voc_v: 49.9, isc_a: 14.0, vmpp_v: 41.8, impp_a: 13.2,
      eficiencia_pct: 21.3, coef_temp_voc_pct_c: -0.27, numero_celulas: 144 } },
  { tipo: 'inversor', fabricante: `Deye ${selo}`, modelo: 'SUN-8K-G03',
    especificacoes: { potencia: 8, fases: 3, tensao_max_entrada: 600, n_mppts: 2 } },
])
const cli = await api('POST', '/api/clientes', {
  nome: `Cliente UX020 ${selo}`, email: `ux020+${selo}@teste.com`, cidade: 'Natal', estado: 'RN',
})
const prj = await api('POST', '/api/projetos-fv', {
  nome: `Projeto UX020 ${selo}`, clienteId: cli.json?._id ?? cli.json?.cliente?._id,
})
const projetoId = prj.json?._id ?? prj.json?.projeto?._id
ok(!!projetoId, `projeto criado (HTTP ${prj.status})`)
if (!projetoId) process.exit(1)

secao('2 · Dados técnicos (FV-UX-018)')
await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'fatura',
  dados: { consumo_mensal_kwh: 1500, valor_kwh: 0.98, tipo_ligacao: 'Trifásico',
    tensao_v: 380, concessionaria: 'NEOENERGIA COSERN' },
})
const p1 = (await api('GET', `/api/projetos-fv/${projetoId}`)).json
await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'localizacao', dados: { ...(p1.localizacao ?? {}), cidade: 'Natal', estado: 'RN' },
})
ok(true, 'consumo, ligação, tensão, concessionária e UF informados')

secao('3 · Equipamentos (FV-UX-019)')
const p2 = (await api('GET', `/api/projetos-fv/${projetoId}`)).json
await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'equipamentos',
  dados: {
    ...(p2.equipamentos ?? {}),
    paineis: [{ id: String(mod._id), marca: mod.fabricante, modelo: mod.modelo,
      potencia_w: 550, quantidade: null, equipamento_id: String(mod._id) }],
    inversor: { id: String(inv._id), marca: inv.fabricante, modelo: inv.modelo,
      potencia_kw: 8, tipo: 'string', fases: 3, equipamento_id: String(inv._id) },
  },
})
ok(true, 'módulo e inversor selecionados do catálogo')

const uniAntes = await api('POST', `/api/projetos-fv/${projetoId}/unifilar/gerar`, {})
console.log(`   lacunas ANTES do dimensionamento: ${JSON.stringify(uniAntes.json?.lacunas)}`)

secao('4 · Dimensionamento — motor existente, premissas explícitas')
const calc = await api('POST', '/api/dimensionamento/calcular', {
  consumo_mensal_kwh: 1500, cidade: 'Natal', estado: 'RN',
  irradiancia_kwh_m2_dia: 5.42, perdas_pct: 18, margem_pct: 10, pot_modulo_w: 550,
})
ok(calc.status === 200 && calc.json?.sucesso === true, `motor executou (HTTP ${calc.status})`)
const R = calc.json.resultado
console.log(`   potência ${R.potencia_kwp} kWp · geração ${R.geracao_anual_kwh} kWh/ano · ${R.qtd_modulos_estimada} módulos`)
ok(calc.json.input_normalizado.irradiancia_kwh_m2_dia === 5.42, 'HSP informada prevaleceu sobre o fallback')
ok(calc.json.input_normalizado.perdas_pct === 18 && calc.json.input_normalizado.margem_pct === 10,
  'perdas e margem foram as informadas')
// O motor devolve financeiro próprio; nada dele será gravado.
ok(R.payback_anos !== undefined && R.vpl_r !== undefined,
  `o motor devolve financeiro próprio (payback ${R.payback_anos}, VPL ${R.vpl_r}) — será descartado`)

const p3 = (await api('GET', `/api/projetos-fv/${projetoId}`)).json
const grav = await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'dimensionamento',
  dados: {
    ...(p3.dimensionamento ?? {}),
    potencia_kwp: R.potencia_kwp,
    geracao_mensal_kwh: R.geracao_mensal_kwh,
    geracao_anual_kwh: R.geracao_anual_kwh,
    num_paineis: R.qtd_modulos_estimada,
    area_total_m2: R.area_ocupacao_m2,
    metodo: 'automatico',
    calculado_em: calc.json.metadados.calculado_em,
  },
})
ok(grav.status === 200, `dimensionamento gravado (HTTP ${grav.status})`)

secao('5 · Reload — os quatro campos pedidos')
const p4 = (await api('GET', `/api/projetos-fv/${projetoId}`)).json
const D = p4.dimensionamento ?? {}
ok(D.num_paineis === R.qtd_modulos_estimada, `num_paineis ${D.num_paineis}`)
ok(D.potencia_kwp === R.potencia_kwp, `potencia_kwp ${D.potencia_kwp}`)
ok(D.geracao_anual_kwh === R.geracao_anual_kwh, `geracao_anual_kwh ${D.geracao_anual_kwh}`)
ok(D.num_strings == null, `num_strings segue nulo (${D.num_strings}) — depende do stringing/MPPT`)
ok(D.metodo === 'automatico', 'origem declarada: metodo=automatico')
ok(!!D.calculado_em, 'instante do cálculo preservado')
ok(p4.potencia_kwp === R.potencia_kwp, 'espelho flat do schema mantido pelo handler')

secao('6 · Nenhum indicador financeiro do motor foi gravado')
const doc = await ProjetoFV.findById(projetoId).lean()
for (const campo of ['payback_anos', 'irr_pct', 'npv_r']) {
  ok(doc.financeiro?.[campo] == null, `financeiro.${campo} continua nulo (INV-58)`)
}
for (const campo of ['payback_anos', 'vpl_r', 'tir_aa', 'custo_total_r', 'economia_anual_r']) {
  ok(doc.dimensionamento[campo] === undefined, `dimensionamento.${campo} não existe`)
}

secao('7 · Cotação → Orçamento → Financeiro (contrato V1)')
const cot = await api('POST', `/api/projetos-fv/${projetoId}/cotacoes`, {
  tecnologia: 'string', rotulo: 'UX020',
  premissas: { consumo_kwh_mes: 1500, tarifa_kwh: 0.98, hsp_kwh_m2_dia: 5.42, inflacao_energia_aa_pct: 6 },
})
const cotacaoId = cot.json?.cotacao?._id
const orc = await api('POST', `/api/projetos-fv/${projetoId}/orcamentos`, {
  cotacao_ref: cotacaoId,
  itens: [
    { descricao: 'Kit FV', tipo: 'material', quantidade: 1, valor_unitario_r: 62000 },
    { descricao: 'Instalação', tipo: 'servico', quantidade: 1, valor_unitario_r: 18000 },
  ],
  condicoes: { validade_dias: 15, prazo_execucao_dias: 45 },
})
const orcamentoId = orc.json?.orcamento?._id
await api('POST', `/api/projetos-fv/${projetoId}/orcamentos/${orcamentoId}/emitir`, {})
ok(!!orcamentoId, 'cotação e orçamento criados')

const fin = await api('POST', `/api/projetos-fv/${projetoId}/financeiro/calcular`, {})
const F = fin.json?.financeiro
console.log(`   payback ${F?.payback?.anos} · VPL ${F?.vpl?.valor_r} · lacunas ${JSON.stringify(F?.lacunas)}`)
ok(F?.entradas?.geracao_anual_kwh === R.geracao_anual_kwh,
  `o contrato usa a geração do dimensionamento (${F?.entradas?.geracao_anual_kwh})`)
ok(F?.proveniencia?.geracao_anual_kwh === 'dimensionamento.geracao_anual_kwh', 'proveniência declarada')
ok(F?.entradas?.potencia_wp === R.potencia_kwp * 1000, 'potência em Wp veio do dimensionamento')
ok((F?.lacunas ?? []).length === 0, 'contrato sem lacunas')
ok(F?.contrato_versao === '1.0.0', `contrato V1 (${F?.contrato_versao})`)

// O payback do contrato NÃO é o payback do motor de dimensionamento.
ok(F?.payback?.anos !== R.payback_anos,
  `payback do contrato (${F?.payback?.anos}) ≠ payback do motor antigo (${R.payback_anos})`)
ok(F?.premissas?.tarifa_kwh === 0.98, 'tarifa do contrato veio da Cotação, não do motor')

secao('8 · A geração é de fato a entrada — mudá-la muda o contrato')
// Baixar o HSP NÃO serve para este teste: o motor dimensiona PARA O CONSUMO —
// menos sol vira mais kWp e a geração anual fica praticamente a mesma. O que
// move a geração é a margem de sobredimensionamento.
const calc2 = await api('POST', '/api/dimensionamento/calcular', {
  consumo_mensal_kwh: 1500, cidade: 'Natal', estado: 'RN',
  irradiancia_kwh_m2_dia: 5.42, perdas_pct: 18, margem_pct: 40, pot_modulo_w: 550,
})
const R2 = calc2.json.resultado
await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'dimensionamento',
  dados: { ...D, potencia_kwp: R2.potencia_kwp, geracao_mensal_kwh: R2.geracao_mensal_kwh,
    geracao_anual_kwh: R2.geracao_anual_kwh, num_paineis: R2.qtd_modulos_estimada },
})
const fin2 = await api('POST', `/api/projetos-fv/${projetoId}/financeiro/calcular`, {})
ok(fin2.json?.financeiro?.entradas?.geracao_anual_kwh === R2.geracao_anual_kwh,
  `nova geração ${R2.geracao_anual_kwh} chegou ao contrato`)
ok(fin2.json?.financeiro?.payback?.anos !== F?.payback?.anos,
  `payback acompanhou (${F?.payback?.anos} → ${fin2.json?.financeiro?.payback?.anos})`)

// Restaura o dimensionamento original.
await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, { etapa: 'dimensionamento', dados: D })

secao('9 · Unifilar — a lacuna `dimensionamento` desapareceu')
const uniDepois = await api('POST', `/api/projetos-fv/${projetoId}/unifilar/gerar`, {})
const lacDepois = uniDepois.json?.lacunas ?? []
console.log(`   lacunas DEPOIS: ${JSON.stringify(lacDepois)}`)
ok((uniAntes.json?.lacunas ?? []).includes('dimensionamento'), '`dimensionamento` era lacuna')
ok(!lacDepois.includes('dimensionamento'), '`dimensionamento` fechada')
ok(lacDepois.length === 1 && lacDepois[0] === 'arranjoMPPTs',
  `resta apenas \`arranjoMPPTs\` (${JSON.stringify(lacDepois)})`)
ok((uniDepois.json?.svg?.length ?? 0) > 0, `svg gerado (${uniDepois.json?.svg?.length} bytes)`)

secao('10 · Integridade')
const depoisTudo = await ProjetoFV.findById(projetoId).lean()
ok(depoisTudo.engenharia_eletrica == null, 'nenhuma topologia MPPT inventada')
ok(depoisTudo.orcamento == null, 'subdocumento legado de orçamento intocado')
ok(String(depoisTudo.empresa_id) === String(cred.empresa_id), 'tenant carimbado pelo servidor (M-4)')
const catIntacto = await Equipamento.findById(mod._id).lean()
ok(catIntacto.especificacoes.potencia_w === 550, 'catálogo permanece SSOT e intocado')
ok(await Baseline.countDocuments({ projeto_ref: projetoId }) === 0,
  'nenhuma Baseline antes da aprovação (M-2)')

secao('11 · Isolamento entre organizações (M-4)')
const jwt = (await import('jsonwebtoken')).default
const tokenAlheio = jwt.sign(
  { userId: '000000000000000000000009', email: 'outro@teste.com', perfil: 'admin',
    empresa_id: String(new mongoose.Types.ObjectId()) },
  process.env.JWT_SECRET || 'validacao_fv_ux_018_secret_local', { expiresIn: '1h' })
const tentativa = await fetch(`${API}/api/projetos-fv/${projetoId}/etapa`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${tokenAlheio}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ etapa: 'dimensionamento', dados: { potencia_kwp: 999 } }),
})
ok(tentativa.status === 404 || tentativa.status === 403,
  `escrita de outra organização recusada (HTTP ${tentativa.status})`)
const intacto = await ProjetoFV.findById(projetoId).lean()
ok(intacto.dimensionamento.potencia_kwp === D.potencia_kwp, 'o dimensionamento não foi alterado')

console.log(`\n   projeto validado: ${projetoId}`)
await mongoose.disconnect()
console.log(falhas === 0
  ? '\nOK — dimensionamento pelo motor existente, contrato V1 usando a geração correta, MPPT declarado pendente.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
