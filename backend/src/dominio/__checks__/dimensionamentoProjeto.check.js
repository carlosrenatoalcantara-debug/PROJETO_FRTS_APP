/**
 * dimensionamentoProjeto.check.js — FV-UX-020
 *
 * Terceiro bloqueio da FV-OPS-001. O ponto sensível não é a gravação — é o que
 * o motor devolve JUNTO com o resultado técnico.
 *
 * `dimensionarFV` calcula payback, VPL, TIR, economia e custo com defaults
 * próprios de tarifa, custo por kWp, inflação e taxa. A FV-DOM-015E auditou esse
 * bloco e o deixou onde estava, fora do fluxo canônico. Este check existe para
 * garantir que a nova UX consuma a parte técnica e SÓ ela.
 *
 *   node backend/src/dominio/__checks__/dimensionamentoProjeto.check.js
 */
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { adaptarProjetoParaUnifilar, lacunasDaProveniencia } from '../unifilar/index.js'
import { adaptarProjetoParaFinanceiro } from '../financeiro/index.js'
import { dimensionarFV } from '../../services/dimensionamentoFV.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

const ler = (rel) => readFileSync(path.resolve(AQUI, rel), 'utf8')
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const CTRL = ler('../../controllers/projetosFVController.js')
const ROTAS_DIM = ler('../../routes/dimensionamento.js')
const MODELO = ler('../../models/ProjetoFV.js')
const API_UX = ler('../../../../frontend/src/fv/api/agregadosFvApi.js')
const ETAPA_UX = ler('../../../../frontend/src/fv/paginas/etapas/EtapaDimensionamento.jsx')

secao('1 · Nenhuma rota, motor ou campo novo')
ok(ROTAS_DIM.includes("router.post('/calcular'"), 'o motor continua em POST /api/dimensionamento/calcular')
ok(API_UX.includes("'/api/dimensionamento/calcular'"), 'a UX chama a rota existente')
ok(!API_UX.includes('/api/dimensionamento/strings'), 'stringing NÃO foi consumido (é MPPT)')
const trechoEtapas = CTRL.slice(CTRL.indexOf('ETAPAS_PERMITIDAS = ['), CTRL.indexOf('ETAPAS_PERMITIDAS = [') + 700)
ok(trechoEtapas.includes("'dimensionamento'"), 'a etapa já pertencia à lista fechada')
const blocoSchema = MODELO.slice(MODELO.indexOf('const dimensionamentoV3Schema'), MODELO.indexOf('const layoutSolarV3Schema'))
for (const campo of ['potencia_kwp', 'geracao_mensal_kwh', 'geracao_anual_kwh',
  'num_paineis', 'num_strings', 'area_total_m2', 'metodo', 'calculado_em']) {
  ok(blocoSchema.includes(campo), `\`dimensionamento.${campo}\` já existia no schema`)
}

secao('2 · O motor devolve financeiro — e é isso que não pode passar')
const r = dimensionarFV({
  consumo_mensal_kwh: 1500, cidade: 'Natal', estado: 'RN',
  irradiancia_kwh_m2_dia: 5.42, perdas_pct: 18, margem_pct: 10, pot_modulo_w: 550,
  agora: new Date('2026-08-17T10:00:00.000Z'),
})
ok(r.sucesso === true, 'motor executou')
for (const campo of ['payback_anos', 'vpl_r', 'tir_aa', 'custo_total_r', 'economia_anual_r']) {
  ok(r.resultado[campo] !== undefined, `o motor DEVOLVE \`${campo}\` (${r.resultado[campo]})`)
}
const etapaSemCom = semComentarios(ETAPA_UX)
for (const campo of ['payback_anos', 'vpl_r', 'tir_aa', 'custo_total_r',
  'economia_anual_r', 'economia_25anos_r', 'geracao_25anos_kwh']) {
  ok(!etapaSemCom.includes(campo), `a tela NÃO lê \`${campo}\``)
}

secao('3 · Nenhuma fórmula migrou para o cliente')
for (const p of ['Math.pow', 'Math.ceil', 'Math.floor', 'dimensionarFV',
  'calcularPotenciaKwp', 'calcularGeracao', 'calcularVPL', 'calcularTIR', 'calcularPayback',
  '@fortesolar/fv-shared', '* 30', '/ 1000']) {
  ok(!etapaSemCom.includes(p), `ausente no cliente: \`${p}\``)
}

secao('4 · Nenhuma premissa de engenharia assumida')
for (const d of ['?? 18', '|| 18', '?? 10', '|| 10', '?? 5.0', '|| 5.0', '?? 5.55',
  '?? 550', '|| 550', '?? 0.8', '?? 4200']) {
  ok(!etapaSemCom.includes(d), `sem default \`${d}\``)
}
ok(etapaSemCom.includes("perdas_pct: ''") && etapaSemCom.includes("margem_pct: ''"),
  'perdas e margem nascem vazias — o usuário decide')

secao('5 · As premissas viajam explícitas — o default do motor não decide')
// Sem irradiância explícita o motor cai no fallback por estado; com ela, não.
const semHsp = dimensionarFV({ consumo_mensal_kwh: 1500, estado: 'RN', perdas_pct: 18, margem_pct: 10 })
const comHsp = dimensionarFV({ consumo_mensal_kwh: 1500, estado: 'RN', perdas_pct: 18, margem_pct: 10,
  irradiancia_kwh_m2_dia: 5.42 })
ok(semHsp.input_normalizado.irradiancia_kwh_m2_dia === 5.55,
  `sem HSP o motor assume 5.55 (fallback RN) — por isso a tela sempre a envia`)
ok(comHsp.input_normalizado.irradiancia_kwh_m2_dia === 5.42, 'com HSP explícita, é a informada que vale')
ok(semHsp.resultado.potencia_kwp !== comHsp.resultado.potencia_kwp,
  'a diferença é material, não cosmética')

secao('6 · O resultado alimenta o contrato financeiro pela porta certa')
const PROJETO = {
  _id: '000000000000000000000001',
  nome: 'Projeto E2E',
  clienteId: { nome: 'Cliente E2E' },
  localizacao: { cidade: 'Natal', estado: 'RN' },
  fatura_extracao: { tipo_ligacao: 'Trifásico', tensao_v: 380, concessionaria: 'NEOENERGIA COSERN',
    consumo_mensal_kwh: 1500 },
  equipamentos: {
    paineis: [{ id: 'm1', marca: 'DAH', modelo: 'DHN-550', potencia_w: 550, quantidade: 23, equipamento_id: 'm1' }],
    inversor: { id: 'i1', marca: 'Deye', modelo: 'SUN-8K-G03', potencia_kw: 8, tipo: 'string', fases: 3 },
  },
  dimensionamento: {
    potencia_kwp: r.resultado.potencia_kwp,
    geracao_mensal_kwh: r.resultado.geracao_mensal_kwh,
    geracao_anual_kwh: r.resultado.geracao_anual_kwh,
    num_paineis: r.resultado.qtd_modulos_estimada,
    area_total_m2: r.resultado.area_ocupacao_m2,
    metodo: 'automatico',
  },
}
const COTACAO = { premissas: { tarifa_kwh: 0.98, inflacao_energia_aa_pct: 6, consumo_kwh_mes: 1500 } }
const ORCAMENTO = { itens: [{ quantidade: 1, valor_unitario_r: 80000 }] }
const adaptado = adaptarProjetoParaFinanceiro(PROJETO, { orcamento: ORCAMENTO, cotacao: COTACAO })
ok(adaptado.entradas.geracao_anual_kwh === r.resultado.geracao_anual_kwh,
  `geração chega ao contrato (${adaptado.entradas.geracao_anual_kwh} kWh)`)
ok(adaptado.proveniencia.geracao_anual_kwh === 'dimensionamento.geracao_anual_kwh',
  'proveniência declarada')
ok(adaptado.entradas.potencia_wp === r.resultado.potencia_kwp * 1000, 'potência chega em Wp')
// O contrato NÃO recebe nada do bloco financeiro do motor antigo.
ok(adaptado.premissas.tarifa_kwh === 0.98, 'a tarifa continua vindo da Cotação, não do motor')
ok(adaptado.proveniencia.tarifa_kwh === 'cotacao.premissas.tarifa_kwh', 'tarifa com fonte canônica')

secao('7 · O efeito no unifilar')
const SEM = { ...PROJETO, dimensionamento: null }
const lacunasAntes = lacunasDaProveniencia(adaptarProjetoParaUnifilar(SEM).proveniencia)
const lacunasDepois = lacunasDaProveniencia(adaptarProjetoParaUnifilar(PROJETO).proveniencia)
console.log(`   antes:  ${JSON.stringify(lacunasAntes)}`)
console.log(`   depois: ${JSON.stringify(lacunasDepois)}`)
ok(lacunasAntes.includes('dimensionamento'), '`dimensionamento` era lacuna')
ok(!lacunasDepois.includes('dimensionamento'), '`dimensionamento` deixou de ser lacuna')
ok(lacunasDepois.includes('arranjoMPPTs'), '`arranjoMPPTs` segue lacuna — MPPT fora do escopo')
ok(lacunasDepois.length === 1, `resta uma única lacuna (${JSON.stringify(lacunasDepois)})`)

secao('8 · Strings e inversores continuam sem fonte, e sem invenção')
const { entrada } = adaptarProjetoParaUnifilar(PROJETO)
ok(entrada.dimensionamento.numPaineis === r.resultado.qtd_modulos_estimada,
  `módulos (${entrada.dimensionamento.numPaineis})`)
ok(entrada.dimensionamento.numStrings === null, 'numStrings nulo — nenhum motor o produz')
ok(entrada.dimensionamento.numInversores === null, 'numInversores nulo')
ok(PROJETO.dimensionamento.num_strings === undefined, 'a tela não grava num_strings')
ok(PROJETO.engenharia_eletrica === undefined, 'nenhuma topologia inventada')

secao('9 · INV-58 — o motor não persiste')
const fonteMotor = ler('../../services/dimensionamentoFV.js')
for (const p of ['save(', 'updateOne', 'findOneAndUpdate', "from 'mongoose'"]) {
  ok(!fonteMotor.includes(p), `motor não persiste (\`${p}\` ausente)`)
}
ok(ler('../../controllers/dimensionamentoController.js').includes('Não persiste no banco'),
  'o controller declara que não persiste')

secao('10 · Determinismo — mesma entrada, mesmo resultado')
const a = dimensionarFV({ consumo_mensal_kwh: 1500, irradiancia_kwh_m2_dia: 5.42,
  perdas_pct: 18, margem_pct: 10, pot_modulo_w: 550, agora: new Date(0) })
const b = dimensionarFV({ consumo_mensal_kwh: 1500, irradiancia_kwh_m2_dia: 5.42,
  perdas_pct: 18, margem_pct: 10, pot_modulo_w: 550, agora: new Date(0) })
ok(JSON.stringify(a) === JSON.stringify(b), 'duas execuções idênticas')

console.log(falhas === 0
  ? '\nOK — dimensionamento pelo motor existente; financeiro do motor descartado; MPPT declarado pendente.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
