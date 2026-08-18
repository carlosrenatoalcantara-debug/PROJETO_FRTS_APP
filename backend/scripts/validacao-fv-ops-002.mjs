/**
 * validacao-fv-ops-002.mjs — FV-OPS-002
 *
 * Validação integrada PÓS-COMMIT do fluxo canônico completo:
 *
 *   Cliente → Projeto → Dados técnicos → Equipamentos → Dimensionamento →
 *   MPPT → Validação elétrica → Cotação → Orçamento → Financeiro →
 *   Aprovação → Baseline → Gate → Unifilar
 *
 * Roda exclusivamente contra o ambiente isolado (porta 37017).
 *
 *   node backend/scripts/validacao-fv-ops-002.mjs
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
const secao = (t) => console.log(`\n══ ${t}`)

async function api(metodo, caminho, corpo, token = TOKEN) {
  const r = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
const { Orcamento } = await import('../src/models/Orcamento.js')
const { verificarIntegridade } = await import('../src/dominio/baseline/congelarOrcamento.js')

const selo = Date.now().toString().slice(-8)

// ═══ 1 · Catálogo ═══════════════════════════════════════════════════════════
secao('1 · CATÁLOGO')
const [mod, inv] = await Equipamento.create([
  { tipo: 'modulo', fabricante: `DAH ${selo}`, modelo: 'DHN-550',
    especificacoes: { potencia_w: 550, voc_v: 49.9, isc_a: 14.0, vmpp_v: 41.8, impp_a: 13.2,
      eficiencia_pct: 21.3, coef_temp_voc_pct_c: -0.27, noct_c: 44, numero_celulas: 144 } },
  { tipo: 'inversor', fabricante: `Sungrow ${selo}`, modelo: 'SG20RT',
    especificacoes: { potencia: 20, fases: 3, tensao_max_entrada: 1000, tensao_mppt_min: 200,
      tensao_mppt_max: 850, corrente_max_por_mppt: 25, n_mppts: 2, strings_por_mppt: 2 } },
])
const catMod = await api('GET', '/api/equipamentos/engenharia?tipo=modulo')
const catInv = await api('GET', '/api/equipamentos/engenharia?tipo=inversor')
ok(catMod.json?.equipamentos?.some((e) => String(e._id) === String(mod._id)), 'módulo oferecido pelo catálogo')
ok(catInv.json?.equipamentos?.some((e) => String(e._id) === String(inv._id)), 'inversor oferecido pelo catálogo')

// ═══ 2 · Cliente e projeto ══════════════════════════════════════════════════
secao('2 · CLIENTE → PROJETO')
const cli = await api('POST', '/api/clientes', {
  nome: `Cliente OPS002 ${selo}`, email: `ops002+${selo}@teste.com`, cidade: 'Natal', estado: 'RN',
})
const prj = await api('POST', '/api/projetos-fv', {
  nome: `Projeto OPS002 ${selo}`, clienteId: cli.json?._id ?? cli.json?.cliente?._id,
})
const P = prj.json?._id ?? prj.json?.projeto?._id
ok(!!P, `projeto criado (HTTP ${prj.status})`)
if (!P) process.exit(1)

// ═══ 3 · Dados técnicos ═════════════════════════════════════════════════════
secao('3 · DADOS TÉCNICOS')
await api('PUT', `/api/projetos-fv/${P}/etapa`, {
  etapa: 'fatura',
  dados: { consumo_mensal_kwh: 1500, valor_kwh: 0.98, tipo_ligacao: 'Trifásico',
    tensao_v: 380, concessionaria: 'NEOENERGIA COSERN' },
})
const p1 = (await api('GET', `/api/projetos-fv/${P}`)).json
await api('PUT', `/api/projetos-fv/${P}/etapa`, {
  etapa: 'localizacao', dados: { ...(p1.localizacao ?? {}), cidade: 'Natal', estado: 'RN' },
})
const t = (await api('GET', `/api/projetos-fv/${P}`)).json
ok(t.fatura_extracao.consumo_mensal_kwh === 1500, `consumo ${t.fatura_extracao.consumo_mensal_kwh} kWh/mês`)
ok(t.fatura_extracao.valor_kwh === 0.98, `tarifa ${t.fatura_extracao.valor_kwh} R$/kWh`)
ok(t.fatura_extracao.tensao_v === 380, `tensão ${t.fatura_extracao.tensao_v} V`)
ok(t.fatura_extracao.tipo_ligacao === 'Trifásico', `ligação ${t.fatura_extracao.tipo_ligacao}`)
ok(t.fatura_extracao.concessionaria === 'NEOENERGIA COSERN', 'concessionária')
ok(t.localizacao.estado === 'RN', `UF ${t.localizacao.estado}`)

// ═══ 4 · Equipamentos ═══════════════════════════════════════════════════════
secao('4 · EQUIPAMENTOS')
const doCat = catMod.json.equipamentos.find((e) => String(e._id) === String(mod._id))
const invCat = catInv.json.equipamentos.find((e) => String(e._id) === String(inv._id))
await api('PUT', `/api/projetos-fv/${P}/etapa`, {
  etapa: 'equipamentos',
  dados: {
    ...(t.equipamentos ?? {}),
    paineis: [{ id: String(mod._id), marca: doCat.fabricante, modelo: doCat.modelo,
      potencia_w: doCat.especificacoes.potencia_w, quantidade: 24, equipamento_id: String(mod._id) }],
    inversor: { id: String(inv._id), marca: invCat.fabricante, modelo: invCat.modelo,
      potencia_kw: invCat.especificacoes.potencia, tipo: 'string',
      fases: invCat.especificacoes.fases, equipamento_id: String(inv._id) },
  },
})
const e = (await api('GET', `/api/projetos-fv/${P}`)).json.equipamentos
ok(String(e.paineis[0].equipamento_id) === String(mod._id), 'módulo referencia o catálogo')
ok(String(e.inversor.equipamento_id) === String(inv._id), 'inversor referencia o catálogo')
ok(e.paineis[0].potencia_w === 550, `potência do módulo veio do catálogo (${e.paineis[0].potencia_w} W)`)
ok(e.paineis[0].potencia_w !== 0 && e.paineis[0].modelo === 'DHN-550', 'sem entrada manual, sem default')

// ═══ 5 · Dimensionamento ════════════════════════════════════════════════════
secao('5 · DIMENSIONAMENTO')
const calc = await api('POST', '/api/dimensionamento/calcular', {
  consumo_mensal_kwh: 1500, cidade: 'Natal', estado: 'RN',
  irradiancia_kwh_m2_dia: 5.42, perdas_pct: 18, margem_pct: 10, pot_modulo_w: 550,
})
const R = calc.json.resultado
ok(calc.json.input_normalizado.irradiancia_kwh_m2_dia === 5.42, 'HSP explícita prevaleceu sobre o fallback')
const p3 = (await api('GET', `/api/projetos-fv/${P}`)).json
await api('PUT', `/api/projetos-fv/${P}/etapa`, {
  etapa: 'dimensionamento',
  dados: { ...(p3.dimensionamento ?? {}),
    potencia_kwp: R.potencia_kwp, geracao_mensal_kwh: R.geracao_mensal_kwh,
    geracao_anual_kwh: R.geracao_anual_kwh, num_paineis: 24, num_strings: 2,
    area_total_m2: R.area_ocupacao_m2, metodo: 'automatico' },
})
const D = (await api('GET', `/api/projetos-fv/${P}`)).json.dimensionamento
ok(D.geracao_anual_kwh === R.geracao_anual_kwh, `geração ${D.geracao_anual_kwh} kWh/ano`)
ok(D.potencia_kwp === R.potencia_kwp, `potência ${D.potencia_kwp} kWp`)
ok(D.num_paineis === 24, `módulos ${D.num_paineis}`)
for (const c of ['payback_anos', 'vpl_r', 'tir_aa', 'custo_total_r', 'economia_anual_r']) {
  ok(D[c] === undefined, `motor legado NÃO gravou \`${c}\``)
}

const uniAntes = await api('POST', `/api/projetos-fv/${P}/unifilar/gerar`, {})
console.log(`   lacunas antes do MPPT: ${JSON.stringify(uniAntes.json?.lacunas)}`)

// ═══ 6 · Validação elétrica canônica ════════════════════════════════════════
secao('6 · VALIDAÇÃO ELÉTRICA CANÔNICA')
const val = await api('POST', '/api/engenharia/compatibilidade-eletrica', {
  dados_eletricos_modulo: { voc: 49.9, vmpp: 41.8, isc: 14, impp: 13.2, potencia_w: 550,
    coef_temp_voc: -0.27, temp_noct: 44 },
  dados_eletricos_inversor: { tensao_max_entrada: 1000, mppt_min: 200, mppt_max: 850,
    corrente_max_mppt: 25, potencia_ca_kw: 20 },
  arranjo_proposto: { quantidade_modulos_por_string: 12, quantidade_strings_paralelo: 1, num_mppt_usados: 2 },
  dados_climaticos_regiao: { temperatura_min_historica_c: 14, temperatura_max_historica_c: 38 },
})
const C = val.json?.calculos ?? {}
console.log(`   Voc frio ${C.voc_string_max} V · Vmpp quente ${C.vmpp_string_quente} V · Isc ${C.isc_total} A`)
ok(C.isc_total === 17.5, `Q1 — Isc de projeto ${C.isc_total} A = 14 × 1 × 1,25`)
ok(C.isc_fator_seguranca === 1.25, 'Q1 — fator declarado na resposta')
ok(C.voc_string_max === 616.58, `Q4 — coeficiente %/°C interpretado como %/°C (${C.voc_string_max} V)`)
ok(C.vmpp_string_quente < 41.8 * 12, `Q3 — Vmpp quente (${C.vmpp_string_quente} V) abaixo do STC (${41.8 * 12} V)`)
ok(C.t_cel_max_c === 68, `Q5 — T de célula com NOCT 44 (${C.t_cel_max_c} °C)`)
ok(val.json?.compativel === true, 'arranjo compatível')
ok(Array.isArray(val.json?.warnings) && Array.isArray(val.json?.erros), 'diagnósticos presentes')
ok(!!val.json?.clima_utilizado, 'proveniência climática declarada')
ok(val.json.clima_utilizado.usou_fallback === false, 'clima informado, sem fallback')

// ═══ 7 · Topologia MPPT ═════════════════════════════════════════════════════
secao('7 · TOPOLOGIA MPPT (autorada)')
await api('PUT', `/api/projetos-fv/${P}/etapa`, {
  etapa: 'engenharia_eletrica',
  dados: {
    arranjo: {
      quantidade_modulos_por_string: 12, quantidade_strings_paralelo: 1,
      total_modulos: 24, num_mppts_usados: 2,
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
const A = (await api('GET', `/api/projetos-fv/${P}`)).json.engenharia_eletrica
ok(A.arranjo.mppts.length === 2, `${A.arranjo.mppts.length} MPPTs persistidos`)
ok(A.arranjo.mppts.every((m) => m.modulos_por_string === 12), 'módulos por string preservados')
ok(A.arranjo.num_mppts_usados === 2, 'MPPTs usados preservados')
ok(A.compatibilidade.calculos_principais.isc_total === 17.5, 'diagnóstico canônico persistido')
ok(A.clima_utilizado.uf === 'RN', 'proveniência climática persistida')

// ═══ 8 · Cotação → Orçamento ════════════════════════════════════════════════
secao('8 · COTAÇÃO → ORÇAMENTO')
const cot = await api('POST', `/api/projetos-fv/${P}/cotacoes`, {
  tecnologia: 'string', rotulo: 'OPS002',
  premissas: { consumo_kwh_mes: 1500, tarifa_kwh: 0.98, hsp_kwh_m2_dia: 5.42, inflacao_energia_aa_pct: 6 },
})
const cotacaoId = cot.json?.cotacao?._id
const orc = await api('POST', `/api/projetos-fv/${P}/orcamentos`, {
  cotacao_ref: cotacaoId,
  itens: [
    { descricao: 'Kit FV', tipo: 'material', quantidade: 1, valor_unitario_r: 62000 },
    { descricao: 'Instalação', tipo: 'servico', quantidade: 1, valor_unitario_r: 18000 },
  ],
  condicoes: { validade_dias: 15, prazo_execucao_dias: 45 },
})
const O = orc.json?.orcamento?._id
await api('POST', `/api/projetos-fv/${P}/orcamentos/${O}/emitir`, {})
const orcDoc = await Orcamento.findById(O).lean()
ok(orcDoc.total_r === undefined, 'orçamento NÃO persiste total (INV-58) — é derivado dos itens')
ok(orcDoc.itens.length === 2, 'itens persistidos')
ok(String(orcDoc.cotacao_ref) === String(cotacaoId), 'orçamento referencia a cotação (M-1)')

// ═══ 9 · Financeiro ═════════════════════════════════════════════════════════
secao('9 · FINANCEIRO — contrato V1')
const fin = await api('POST', `/api/projetos-fv/${P}/financeiro/calcular`, {})
const F = fin.json?.financeiro
console.log(`   payback ${F?.payback?.anos} (inteiro ${F?.payback?.anos_inteiro}) · VPL ${F?.vpl?.valor_r} · TIR ${F?.tir?.valor_aa_pct}`)
ok(F?.contrato_versao === '1.0.0', `contrato V1 (${F?.contrato_versao})`)
ok(F?.vpl?.taxa_aa_pct === 10, `D2 — TMA ${F?.vpl?.taxa_aa_pct}% a.a.`)
ok(F?.premissas?.natureza_taxa === 'nominal', 'D2 — TMA nominal')
ok(F?.premissas?.inflacao_energia_aa_pct === 6, 'D3 — inflação veio da Cotação')
ok(F?.proveniencia?.inflacao_energia_aa_pct === 'cotacao.premissas.inflacao_energia_aa_pct',
  'D3 — proveniência da inflação declarada')
ok(F?.payback?.convencao === 'fracionario', 'D1 — convenção fracionária')
ok(typeof F?.payback?.anos === 'number', `D1 — payback fracionário ${F?.payback?.anos}`)
ok(F?.payback?.anos_inteiro === Math.ceil(F?.payback?.anos), `D1 — inteiro secundário ${F?.payback?.anos_inteiro}`)
ok(typeof F?.vpl?.valor_r === 'number', 'VPL calculado')
ok(F?.tir?.convergiu === true ? typeof F.tir.valor_aa_pct === 'number' : F.tir.valor_aa_pct === null,
  `TIR só quando convergida (convergiu=${F?.tir?.convergiu})`)
ok((F?.lacunas ?? []).length === 0, 'sem lacunas')
ok(F?.regulatorio?.motivo === 'D5_PENDENTE', 'D5 continua declarada pendente')
ok(F?.entradas?.geracao_anual_kwh === R.geracao_anual_kwh, 'usa a geração do dimensionamento')
ok(F?.entradas?.investimento_r === 80000, 'investimento derivado dos itens do orçamento')
// Nenhuma fórmula antiga: o payback do motor legado é outro número.
ok(F?.payback?.anos !== R.payback_anos,
  `payback do contrato (${F?.payback?.anos}) ≠ motor legado (${R.payback_anos})`)

// ═══ 10 · Aprovação → Baseline → Gate ═══════════════════════════════════════
secao('10 · APROVAÇÃO → BASELINE → GATE')
const gateAntes = await api('GET', `/api/projetos-fv/${P}/gate`)
ok(gateAntes.json?.fases?.engenharia?.liberado === false,
  `Gate FECHADO sem Baseline (${gateAntes.json?.fases?.engenharia?.motivo})`)

const aprov = await api('POST', `/api/projetos-fv/${P}/orcamentos/${O}/aprovar`, {})
ok(aprov.status === 200, `aprovado (HTTP ${aprov.status})`)

const orc2 = await api('POST', `/api/projetos-fv/${P}/orcamentos`, {
  cotacao_ref: cotacaoId,
  itens: [{ descricao: 'Alternativa', tipo: 'material', quantidade: 1, valor_unitario_r: 90000 }],
})
await api('POST', `/api/projetos-fv/${P}/orcamentos/${orc2.json?.orcamento?._id}/emitir`, {})
const segundo = await api('POST', `/api/projetos-fv/${P}/orcamentos/${orc2.json?.orcamento?._id}/aprovar`, {})
ok(segundo.status >= 400, `segundo orçamento recusado (HTTP ${segundo.status}) — INV-ORC-3`)
ok(await Orcamento.countDocuments({ projeto_ref: P, estado: 'APROVADO' }) === 1,
  'exatamente 1 orçamento aprovado')

const bl = await Baseline.findOne({ projeto_ref: P }).lean()
ok(!!bl, 'Baseline criada pela aprovação')
ok(!!bl.hash, `hash presente (${bl.hash?.slice(0, 12)}…)`)
ok(verificarIntegridade(bl), 'hash íntegro')
// A Baseline congela o CONTEÚDO — o orçamento aprovado e a cotação que o
// originou, cada um na sua forma. As premissas do cenário viajam dentro da
// cotação congelada, não na raiz do documento.
const premCong = bl.conteudo?.cotacao?.premissas ?? {}
ok(premCong.inflacao_energia_aa_pct === 6, `premissas congeladas — inflação ${premCong.inflacao_energia_aa_pct}%`)
ok(premCong.tarifa_kwh === 0.98, `tarifa congelada ${premCong.tarifa_kwh}`)
ok(premCong.consumo_kwh_mes === 1500, `consumo congelado ${premCong.consumo_kwh_mes}`)
ok(bl.conteudo?.orcamento?.estado === 'APROVADO', 'o orçamento congelado é o aprovado')
ok(bl.conteudo?.orcamento?.totais?.total_r === 80000,
  'total do orçamento congelado (derivado dos itens, não indicador financeiro)')
const blStr = JSON.stringify(bl)
for (const proibido of ['payback', 'vpl', 'tir', 'valor_presente']) {
  ok(!blStr.toLowerCase().includes(proibido), `Baseline NÃO congela \`${proibido}\` (INV-58)`)
}

const gateDepois = await api('GET', `/api/projetos-fv/${P}/gate`)
ok(gateDepois.json?.fases?.engenharia?.liberado === true, 'Gate LIBERADO com Baseline válida')
ok(gateDepois.json?.fases?.homologacao?.liberado === true, 'homologação liberada')

// ═══ 11 · Unifilar ══════════════════════════════════════════════════════════
secao('11 · UNIFILAR')
const uni = await api('POST', `/api/projetos-fv/${P}/unifilar/gerar`, {})
const lac = uni.json?.lacunas ?? []
console.log(`   lacunas = ${JSON.stringify(lac)}`)
ok(lac.length === 0, 'lacunas = []')
ok(uni.json?.proveniencia?.arranjoMPPTs === 'engenharia_eletrica.arranjo.mppts', 'topologia com proveniência')
ok(uni.json?.proveniencia?.painel === 'equipamentos.paineis[0]', 'módulo com proveniência')
const bruto = JSON.stringify(uni.json)
ok(bruto.includes('DHN-550'), 'desenho usa o módulo real (DHN-550)')
ok(bruto.includes('SG20RT'), 'desenho usa o inversor real (SG20RT)')
ok(!bruto.includes('Fronius SYMO'), 'sem o inversor default')
ok((uni.json?.svg?.length ?? 0) > 0, `svg gerado (${uni.json?.svg?.length} bytes)`)

// ═══ 12 · Isolamento entre dois tenants ═════════════════════════════════════
secao('12 · SEGURANÇA — dois tenants')
const jwt = (await import('jsonwebtoken')).default
const SEGREDO = process.env.JWT_SECRET || 'validacao_fv_ux_018_secret_local'
const outraEmpresa = new mongoose.Types.ObjectId()
const tokenB = jwt.sign({ userId: '000000000000000000000009', email: 'b@teste.com',
  perfil: 'admin', empresa_id: String(outraEmpresa) }, SEGREDO, { expiresIn: '1h' })

const leituraB = await api('GET', `/api/projetos-fv/${P}`, undefined, tokenB)
ok(leituraB.status === 404 || leituraB.status === 403, `tenant B não LÊ o projeto (HTTP ${leituraB.status})`)
const listaB = await api('GET', '/api/projetos-fv', undefined, tokenB)
const vazamento = (listaB.json?.itens ?? listaB.json ?? []).some?.((p) => String(p._id) === String(P))
ok(!vazamento, 'projeto não aparece na listagem do tenant B')
const escritaB = await api('PUT', `/api/projetos-fv/${P}/etapa`,
  { etapa: 'engenharia_eletrica', dados: { arranjo: { mppts: [] } } }, tokenB)
ok(escritaB.status === 404 || escritaB.status === 403, `tenant B não ESCREVE (HTTP ${escritaB.status})`)
const finB = await api('POST', `/api/projetos-fv/${P}/financeiro/calcular`, {}, tokenB)
ok(finB.status >= 400, `tenant B não calcula financeiro (HTTP ${finB.status})`)
const blB = await api('GET', `/api/projetos-fv/${P}/baseline`, undefined, tokenB)
ok(blB.status >= 400 || !blB.json?.baseline, 'tenant B não lê a Baseline')
const intacto = await ProjetoFV.findById(P).lean()
ok(intacto.engenharia_eletrica.arranjo.mppts.length === 2, 'topologia intacta após as tentativas')

// ═══ Resumo ═════════════════════════════════════════════════════════════════
console.log(`\n   projeto validado: ${P}`)
await mongoose.disconnect()
console.log(falhas === 0
  ? '\nOK — fluxo canônico completo operacional pós-commit.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
