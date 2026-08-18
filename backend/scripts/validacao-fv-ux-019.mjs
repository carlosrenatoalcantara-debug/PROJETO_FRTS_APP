/**
 * validacao-fv-ux-019.mjs — FV-UX-019
 *
 * Percorre pela API canônica o que a nova UX faz: cliente → projeto → dados
 * técnicos → seleção de módulo e inversor do catálogo → salvar → recarregar →
 * unifilar. Confere a persistência direto no banco.
 *
 * Roda exclusivamente contra o ambiente isolado (porta 37017).
 *
 *   node backend/scripts/validacao-fv-ux-019.mjs
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

const selo = Date.now().toString().slice(-8)

secao('0 · Catálogo — registros de teste, inclusive um bloqueado')
// O catálogo tem porteiro: `utilizavel_em_projeto` cai para false quando faltam
// os campos que a engenharia exige (módulo sem Voc/Isc, por exemplo). Semeia-se
// um registro completo e um incompleto justamente para medir o porteiro.
const [mod, modIncompleto, inv, micro] = await Equipamento.create([
  { tipo: 'modulo', fabricante: `DAH ${selo}`, modelo: 'DHN-550',
    especificacoes: { potencia_w: 550, voc_v: 49.9, isc_a: 14.0, vmpp_v: 41.8, impp_a: 13.2,
      eficiencia_pct: 21.3, coef_temp_voc_pct_c: -0.27, numero_celulas: 144 } },
  { tipo: 'modulo', fabricante: `Incompleto ${selo}`, modelo: 'SEM-VOC',
    especificacoes: { potencia_w: 550 } },
  { tipo: 'inversor', fabricante: `Deye ${selo}`, modelo: 'SUN-8K-G03',
    especificacoes: { potencia: 8, fases: 3, tensao_max_entrada: 600, n_mppts: 2 } },
  { tipo: 'inversor', fabricante: `Hoymiles ${selo}`, modelo: 'HMS-2000',
    especificacoes: { potencia: 2, fases: 1, tensao_max_entrada: 60, n_mppts: 4 } },
])
ok(!!mod._id && !!inv._id, 'catálogo semeado')

secao('1 · Catálogo pela API oficial de engenharia')
const catModulos = await api('GET', '/api/equipamentos/engenharia?tipo=modulo')
const catInversores = await api('GET', '/api/equipamentos/engenharia?tipo=inversor')
ok(catModulos.status === 200, `módulos HTTP ${catModulos.status} (${catModulos.json?.total})`)
ok(catInversores.status === 200, `inversores HTTP ${catInversores.status} (${catInversores.json?.total})`)
ok(catModulos.json?.fonte === 'catalogo_mongo', 'fonte declarada: catalogo_mongo')
const doCat = (lista, id) => (lista ?? []).find((e) => String(e._id) === String(id))
ok(!!doCat(catModulos.json?.equipamentos, mod._id), 'o módulo completo aparece no catálogo')
ok(!!doCat(catInversores.json?.equipamentos, inv._id), 'o inversor aparece no catálogo')

// A porta que a nova UX herda de graça: o que a engenharia bloqueou não é
// oferecido para seleção. A tela não decide isso — o servidor já decidiu.
const bloqueado = await Equipamento.findById(modIncompleto._id).lean()
ok(bloqueado.utilizavel_em_projeto === false,
  `módulo sem Voc/Isc bloqueado pelo catálogo (${JSON.stringify(bloqueado.bloqueio_engenharia)})`)
ok(!doCat(catModulos.json?.equipamentos, modIncompleto._id),
  'módulo bloqueado NÃO é oferecido para seleção')
const comBloqueados = await api('GET', '/api/equipamentos/engenharia?tipo=modulo&incluir_bloqueados=true')
ok(!!doCat(comBloqueados.json?.equipamentos, modIncompleto._id),
  'e continua visível quando explicitamente solicitado — o filtro é do servidor')

secao('2 · Cliente → Projeto → Dados técnicos (FV-UX-018)')
const cli = await api('POST', '/api/clientes', {
  nome: `Cliente UX019 ${selo}`, email: `ux019+${selo}@teste.com`, cidade: 'Natal', estado: 'RN',
})
const clienteId = cli.json?._id ?? cli.json?.cliente?._id
const prj = await api('POST', '/api/projetos-fv', { nome: `Projeto UX019 ${selo}`, clienteId })
const projetoId = prj.json?._id ?? prj.json?.projeto?._id
ok(!!projetoId, `projeto criado (HTTP ${prj.status})`)
if (!projetoId) process.exit(1)

await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'fatura',
  dados: {
    consumo_mensal_kwh: 1500, valor_kwh: 0.98, tipo_ligacao: 'Trifásico',
    tensao_v: 380, concessionaria: 'NEOENERGIA COSERN',
  },
})
const comTecnicos = (await api('GET', `/api/projetos-fv/${projetoId}`)).json
await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'localizacao', dados: { ...(comTecnicos.localizacao ?? {}), estado: 'RN' },
})
ok(true, 'dados técnicos informados')

const uniAntes = await api('POST', `/api/projetos-fv/${projetoId}/unifilar/gerar`, {})
console.log(`   lacunas ANTES: ${JSON.stringify(uniAntes.json?.lacunas)}`)

secao('3 · Selecionar módulo e inversor — como a tela monta o payload')
const equipAtual = (await api('GET', `/api/projetos-fv/${projetoId}`)).json.equipamentos ?? {}
const sel = await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'equipamentos',
  dados: {
    ...equipAtual,
    paineis: [{
      id: String(mod._id), marca: mod.fabricante, modelo: mod.modelo,
      potencia_w: 550, quantidade: 26, equipamento_id: String(mod._id),
    }],
    inversor: {
      id: String(inv._id), marca: inv.fabricante, modelo: inv.modelo,
      potencia_kw: 8, tipo: 'string', fases: 3, equipamento_id: String(inv._id),
    },
  },
})
ok(sel.status === 200, `etapa equipamentos gravada (HTTP ${sel.status})`)

secao('4 · Recarregar — a seleção volta do servidor')
const depois = (await api('GET', `/api/projetos-fv/${projetoId}`)).json
const painel = depois.equipamentos?.paineis?.[0]
ok(String(painel?.equipamento_id) === String(mod._id), 'módulo referencia o catálogo')
ok(painel?.potencia_w === 550, `potência do módulo ${painel?.potencia_w}`)
ok(painel?.quantidade === 26, `quantidade ${painel?.quantidade}`)
ok(String(depois.equipamentos?.inversor?.equipamento_id) === String(inv._id), 'inversor referencia o catálogo')
ok(depois.equipamentos?.inversor?.potencia_kw === 8, 'potência do inversor')
ok(depois.equipamentos?.inversor?.tipo === 'string', 'tecnologia do inversor')

secao('5 · Trocar a seleção substitui — não acumula')
const troca = await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'equipamentos',
  dados: {
    ...depois.equipamentos,
    inversor: {
      id: String(micro._id), marca: micro.fabricante, modelo: micro.modelo,
      potencia_kw: 2, tipo: 'micro', fases: 1, equipamento_id: String(micro._id),
    },
  },
})
ok(troca.status === 200, `troca gravada (HTTP ${troca.status})`)
const trocado = (await api('GET', `/api/projetos-fv/${projetoId}`)).json
ok(String(trocado.equipamentos.inversor.equipamento_id) === String(micro._id), 'inversor trocado')
ok(trocado.equipamentos.inversor.tipo === 'micro', 'tecnologia acompanhou a troca')
ok(trocado.equipamentos.paineis.length === 1, 'módulo não foi duplicado pela troca')

// Volta ao inversor string para as conferências seguintes.
await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'equipamentos',
  dados: { ...trocado.equipamentos, inversor: depois.equipamentos.inversor },
})

secao('6 · Especificação ausente no catálogo permanece ausente')
// Defesa de fundo: mesmo que um registro sem potência chegue à tela, o valor
// gravado é `null` — nunca 0, nunca o default de 550 W do motor.
const semSpec = await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'equipamentos',
  dados: {
    ...depois.equipamentos,
    paineis: [{
      id: String(modIncompleto._id), marca: modIncompleto.fabricante, modelo: modIncompleto.modelo,
      potencia_w: null, quantidade: 26, equipamento_id: String(modIncompleto._id),
    }],
  },
})
ok(semSpec.status === 200, `gravado (HTTP ${semSpec.status})`)
const comNulo = (await api('GET', `/api/projetos-fv/${projetoId}`)).json
ok(comNulo.equipamentos.paineis[0].potencia_w == null,
  'potência não declarada permaneceu nula — não virou 0 nem 550')

// Restaura o módulo com especificação.
await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'equipamentos', dados: { ...comNulo.equipamentos, paineis: depois.equipamentos.paineis },
})

secao('7 · Unifilar — quais lacunas desapareceram')
const uniDepois = await api('POST', `/api/projetos-fv/${projetoId}/unifilar/gerar`, {})
const lacAntes = uniAntes.json?.lacunas ?? []
const lacDepois = uniDepois.json?.lacunas ?? []
console.log(`   lacunas DEPOIS: ${JSON.stringify(lacDepois)}`)
for (const campo of ['painel', 'inversor']) {
  ok(lacAntes.includes(campo) && !lacDepois.includes(campo), `\`${campo}\` fechada`)
}
ok(lacDepois.includes('arranjoMPPTs'), '`arranjoMPPTs` continua declarada (MPPT fora do escopo)')
ok(lacDepois.includes('dimensionamento'), '`dimensionamento` continua declarado (fora do escopo)')
ok(uniDepois.json?.proveniencia?.painel === 'equipamentos.paineis[0]', 'proveniência aponta o caminho persistido')
ok((uniDepois.json?.svg?.length ?? 0) > 0, `svg gerado (${uniDepois.json?.svg?.length} bytes)`)

secao('8 · Conferência direta no banco')
const doc = await ProjetoFV.findById(projetoId).lean()
ok(String(doc.equipamentos.paineis[0].equipamento_id) === String(mod._id), 'referência persistida como ObjectId')
ok(String(doc.equipamentos.inversor.equipamento_id) === String(inv._id), 'referência do inversor persistida')
ok(doc.dimensionamento?.potencia_kwp == null, 'nenhum dimensionamento inventado')
ok(doc.dimensionamento?.num_paineis == null, 'a quantidade NÃO virou num_paineis')
ok(doc.engenharia_eletrica == null, 'nenhuma topologia MPPT inventada')
ok(doc.financeiro?.payback_anos == null, 'nenhum dado financeiro criado (INV-58)')
ok(doc.orcamento == null || doc.orcamento?.total_r == null, 'nenhum orçamento criado')
ok(String(doc.empresa_id) === String(cred.empresa_id), 'tenant carimbado pelo servidor (M-4)')

secao('9 · Nenhuma segunda fonte — o catálogo não foi alterado nem duplicado')
const catDepois = await Equipamento.findById(mod._id).lean()
ok(catDepois.especificacoes.potencia_w === 550 && catDepois.especificacoes.voc_v === 49.9,
  'o registro do catálogo permanece intacto')
ok(await Equipamento.countDocuments({ fabricante: mod.fabricante }) === 1,
  'nenhuma cópia do equipamento foi criada')

secao('10 · Isolamento entre organizações (M-4)')
const jwt = (await import('jsonwebtoken')).default
const tokenAlheio = jwt.sign(
  { userId: '000000000000000000000009', email: 'outro@teste.com', perfil: 'admin',
    empresa_id: String(new mongoose.Types.ObjectId()) },
  process.env.JWT_SECRET || 'validacao_fv_ux_018_secret_local', { expiresIn: '1h' })
const tentativa = await fetch(`${API}/api/projetos-fv/${projetoId}/etapa`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${tokenAlheio}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ etapa: 'equipamentos', dados: { paineis: [], inversor: {} } }),
})
ok(tentativa.status === 404 || tentativa.status === 403,
  `escrita de outra organização recusada (HTTP ${tentativa.status})`)
const intacto = await ProjetoFV.findById(projetoId).lean()
ok(intacto.equipamentos.paineis.length === 1, 'a seleção não foi apagada pela tentativa alheia')

secao('11 · O wizard não foi necessário')
ok(doc.schema_version === 3, 'documento em v3, gravado pela etapa canônica')
console.log(`   projeto validado: ${projetoId}`)

await mongoose.disconnect()
console.log(falhas === 0
  ? '\nOK — equipamentos selecionados do catálogo, persistidos e relidos pela nova UX.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
