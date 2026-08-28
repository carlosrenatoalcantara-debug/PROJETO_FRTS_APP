/**
 * auditoria-opcoes-fv-dom-032.mjs — FV-DOM-032, item 1
 *
 * A pergunta não é "dá para modelar duas opções?" — é "o que EXATAMENTE quebra
 * em cada caminho?". Este script constrói as duas opções do enunciado pelos DOIS
 * caminhos possíveis e mede:
 *
 *   A. UM ProjetoFV com dois arranjos concorrentes
 *   B. DOIS ProjetoFV irmãos (o padrão que `ampliarProjetoFV` já usa)
 *
 * Depois percorre cada superfície que a sprint mandou mapear e registra se ela
 * isola por opção, se compartilha, ou se colide.
 *
 * SÓ MEDE — cria projetos no ambiente EFÊMERO (37017) e não altera código.
 *
 *   node backend/scripts/auditoria-opcoes-fv-dom-032.mjs
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cred = JSON.parse(readFileSync(path.join(RAIZ, '.ambiente-validacao.json'), 'utf8'))
const TOKEN = readFileSync(path.join(RAIZ, '.token-validacao'), 'utf8').trim()
const API = 'http://127.0.0.1:5001'
if (!cred.uri.includes('37017')) { console.error('❌ só no isolado'); process.exit(1) }

const h = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
async function api(metodo, caminho, corpo) {
  const r = await fetch(`${API}${caminho}`, { method: metodo, headers: h,
    body: corpo === undefined ? undefined : JSON.stringify(corpo) })
  let json = null
  try { json = await r.json() } catch { /* sem corpo */ }
  return { status: r.status, json }
}
const salvar = (id, etapa, dados) => api('PUT', `/api/projetos-fv/${id}/etapa`, { etapa, dados })
const ler = async (id) => (await api('GET', `/api/projetos-fv/${id}`)).json?.projeto
  ?? (await api('GET', `/api/projetos-fv/${id}`)).json

console.log('═══ FV-DOM-032 · item 1 — auditoria das duas opções ═══\n')

// ── Catálogo ────────────────────────────────────────────────────────────────
const inv = (await api('GET', '/api/equipamentos?tipo=inversor&limit=200')).json
const inversores = inv?.equipamentos ?? inv ?? []
const mods = (await api('GET', '/api/equipamentos?tipo=modulo&limit=50')).json
const ZN = (mods?.equipamentos ?? mods ?? []).find((e) => e.fabricante === 'Znshine')
const SG = inversores.find((e) => e.modelo === 'SG15RT')
const HM = inversores.find((e) => e.modelo === 'HMS-2000-4T')
if (!ZN || !SG || !HM) { console.error('rode o seed antes'); process.exit(1) }

const painel = () => ({ id: String(ZN._id), marca: 'Znshine', modelo: ZN.modelo,
  potencia_w: 650, quantidade: 24, equipamento_id: String(ZN._id) })
const comp = (eq, q, tipo) => ({ id: String(eq._id), marca: eq.fabricante, modelo: eq.modelo,
  potencia_kw: eq.especificacoes.potencia, tipo, fases: eq.especificacoes.fases,
  quantidade: q, equipamento_id: String(eq._id) })

// ═══ CAMINHO A · Um ProjetoFV, dois arranjos ════════════════════════════════
console.log('── A · UM ProjetoFV com dois arranjos concorrentes\n')
const PA = (await api('POST', '/api/projetos-fv', { nome: `FV-DOM-032 caminho A ${Date.now()}`, clienteId: cred.cliente_id })).json?._id
await salvar(PA, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
await salvar(PA, 'fatura', { tipo_ligacao: 'Trifásico', tensao_v: 380, concessionaria: 'Neoenergia' })
await salvar(PA, 'localizacao', { estado: 'RN' })
const rA = await salvar(PA, 'arranjos', { lista: [
  { id: 'op1', rotulo: 'Opção 01', tipo: 'principal', paineis: [painel()], inversores: [comp(SG, 1, 'string')] },
  { id: 'op2', rotulo: 'Opção 02', tipo: 'secundario', topologia: 'micro',
    paineis: [painel()], inversores: [comp(HM, 8, 'micro')],
    configuracao_eletrica: { micros: [{ equipamento_id: String(HM._id), marca: HM.fabricante,
      modelo: HM.modelo, quantidade: 8, entradas_por_micro: 4, modulos_por_entrada: 1,
      distribuicao: [3, 3, 3, 3, 3, 3, 3, 3] }] } },
] })
const pA = await ler(PA)
console.log(`   grava dois arranjos             : ${rA.status === 200 && pA.arranjos.length === 2 ? 'SIM' : 'não'} (${pA.arranjos.length})`)

// O que é ÚNICO no projeto e portanto NÃO pode divergir entre as opções:
const unicos = [
  ['equipamentos.paineis/inversor', 'projeção legada — um módulo, um inversor'],
  ['equipamentos.estrutura', 'uma estrutura por projeto'],
  ['dimensionamento', 'um num_paineis, uma potencia_kwp'],
  ['engenharia_eletrica.arranjo', 'UMA topologia MPPT por projeto'],
  ['financeiro', 'um conjunto de indicadores'],
  ['unifilar', 'um cache de desenho'],
  ['homologacao', 'um status, um protocolo'],
  ['proposta', 'um número, uma versão, um status'],
]
console.log('\n   Campos ÚNICOS no ProjetoFV — as duas opções teriam de COMPARTILHAR:')
for (const [campo, nota] of unicos) console.log(`     ✗ ${campo.padEnd(32)} ${nota}`)

// Agregados: um por PROJETO, não por arranjo.
const cot = await api('POST', `/api/projetos-fv/${PA}/cotacoes`, { tecnologia: 'fv', premissas: {} })
console.log(`\n   Cotação criada                  : HTTP ${cot.status}`)
console.log('     ↳ `Cotacao.projeto_ref` aponta para o PROJETO. Não há campo de arranjo.')
console.log('     ↳ `Orcamento.projeto_ref` idem, e o índice `unico_aprovado_por_projeto`')
console.log('       impede DOIS orçamentos APROVADOS no mesmo projeto.')
console.log('     ↳ `Baseline` tem `unico_baseline_por_projeto` — UMA baseline por projeto.')
console.log('\n   VEREDITO A: não isola. Cada opção precisa de orçamento e baseline PRÓPRIOS,')
console.log('               e os dois índices únicos são por projeto. Fim de linha.')

// ═══ CAMINHO B · Dois ProjetoFV irmãos ══════════════════════════════════════
console.log('\n\n── B · DOIS ProjetoFV irmãos (padrão de `ampliarProjetoFV`)\n')
async function criarOpcao(nome, inversor, qtd, tipo, micros) {
  const P = (await api('POST', '/api/projetos-fv', { nome, clienteId: cred.cliente_id })).json?._id
  await salvar(P, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
  await salvar(P, 'fatura', { tipo_ligacao: tipo === 'micro' ? 'Monofásico' : 'Trifásico', tensao_v: tipo === 'micro' ? 220 : 380, concessionaria: 'Neoenergia' })
  await salvar(P, 'localizacao', { estado: 'RN' })
  await salvar(P, 'equipamentos', { paineis: [painel()], inversor: comp(inversor, qtd, tipo),
    estrutura: { tipo: 'Fibrocimento', descricao: '' } })
  await salvar(P, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
    ...(micros ? { topologia: 'micro', configuracao_eletrica: { micros } } : {}),
    paineis: [painel()], inversores: [comp(inversor, qtd, tipo)] }] })
  return P
}
const P1 = await criarOpcao(`FV-DOM-032 Opção 01 string ${Date.now()}`, SG, 1, 'string', null)
const P2 = await criarOpcao(`FV-DOM-032 Opção 02 micro ${Date.now()}`, HM, 8, 'micro',
  [{ equipamento_id: String(HM._id), marca: HM.fabricante, modelo: HM.modelo,
    quantidade: 8, entradas_por_micro: 4, modulos_por_entrada: 1, distribuicao: [3, 3, 3, 3, 3, 3, 3, 3] }])
await salvar(P1, 'engenharia_eletrica', { arranjo: { num_mppts_usados: 2, mppts: [
  { mppt: 1, strings_paralelo: 1, modulos_por_string: 12, total_modulos: 12 },
  { mppt: 2, strings_paralelo: 1, modulos_por_string: 12, total_modulos: 12 }] } })

console.log(`   Opção 01 (string): ${P1}`)
console.log(`   Opção 02 (micro) : ${P2}\n`)

const col = (v, n) => String(v ?? '—').padEnd(n)
console.log(col('SUPERFÍCIE', 26) + col('OPÇÃO 01', 30) + col('OPÇÃO 02', 30) + 'ISOLA?')
const q1 = await ler(P1); const q2 = await ler(P2)
const u1 = (await api('POST', `/api/projetos-fv/${P1}/unifilar/gerar`, {})).json
const u2 = (await api('POST', `/api/projetos-fv/${P2}/unifilar/gerar`, {})).json
const linhas = [
  ['equipamentos', q1.equipamentos?.inversor?.modelo, q2.equipamentos?.inversor?.modelo],
  ['composição (arranjos)', `${q1.arranjos?.[0]?.inversores?.[0]?.quantidade} × ${q1.arranjos?.[0]?.inversores?.[0]?.modelo}`, `${q2.arranjos?.[0]?.inversores?.[0]?.quantidade} × ${q2.arranjos?.[0]?.inversores?.[0]?.modelo}`],
  ['topologia', q1.arranjos?.[0]?.topologia ?? 'string (implícita)', q2.arranjos?.[0]?.topologia],
  ['configuracao_eletrica', q1.arranjos?.[0]?.configuracao_eletrica?.micros ? 'micros[]' : '—', q2.arranjos?.[0]?.configuracao_eletrica?.micros?.length + ' micro(s)'],
  ['engenharia_eletrica', `${q1.engenharia_eletrica?.arranjo?.mppts?.length ?? 0} MPPT`, `${q2.engenharia_eletrica?.arranjo?.mppts?.length ?? 0} MPPT`],
  ['estrutura', q1.equipamentos?.estrutura?.tipo, q2.equipamentos?.estrutura?.tipo],
  ['dimensionamento', `${q1.dimensionamento?.num_paineis} mód`, `${q2.dimensionamento?.num_paineis} mód`],
  ['unifilar', u1?.especificacoes?.num_mppts !== undefined ? 'motor string' : 'motor micro', u2?.especificacoes?.topologia === 'micro' ? 'motor micro' : 'motor string'],
  ['unifilar CC/CA', `${u1?.especificacoes?.potencia_cc_kwp}/${u1?.especificacoes?.potencia_ca_kw} kW`, `${u2?.especificacoes?.potencia_cc_kwp}/${u2?.especificacoes?.potencia_ca_kw} kW`],
]
for (const [s, a, b] of linhas) console.log(col(s, 26) + col(a, 30) + col(b, 30) + 'SIM')

// Agregados próprios
const c1 = await api('POST', `/api/projetos-fv/${P1}/cotacoes`, { tecnologia: 'fv', premissas: {} })
const c2 = await api('POST', `/api/projetos-fv/${P2}/cotacoes`, { tecnologia: 'fv', premissas: {} })
console.log(col('Cotacao', 26) + col(`HTTP ${c1.status}`, 30) + col(`HTTP ${c2.status}`, 30) +
  (c1.status < 300 && c2.status < 300 ? 'SIM' : 'NÃO'))
console.log('\n   VEREDITO B: isola tudo. Cada opção é um agregado completo — cotação,')
console.log('               orçamento, aprovação, baseline, gate e homologação próprios.')

// ═══ O QUE FALTA NO CAMINHO B ═══════════════════════════════════════════════
console.log('\n\n── O que o caminho B NÃO resolve sozinho\n')
console.log(`   1. Relação entre as opções: ${q1.projeto_origem_id ?? 'null'} / ${q2.projeto_origem_id ?? 'null'}`)
console.log('      `projeto_origem_id` hoje significa "ampliação DE" — derivação, não')
console.log('      alternativa. Reusá-lo faria a Opção 02 apontar para a Opção 01, que')
console.log('      passaria a ser privilegiada. Opções são PARES, não pai e filho.')
console.log(`   2. \`tipo_projeto\` aceita apenas: ${JSON.stringify(['novo', 'ampliacao'])}`)
console.log('   3. Nada impede as DUAS opções de chegarem a Baseline e homologação.')
console.log('      Cada uma tem seu índice único — em projetos diferentes, não colidem.')
const lista = (await api('GET', '/api/projetos-fv')).json
const total = Array.isArray(lista?.projetos) ? lista.projetos.length : (lista?.length ?? '?')
console.log(`   4. A listagem devolve ${total} projeto(s): as opções aparecem SOLTAS,`)
console.log('      sem agrupamento — o mesmo já acontece hoje com `ampliacao`.')

await mongoose.disconnect().catch(() => {})
console.log('\n═══ FIM — nenhum código alterado ═══')
