/**
 * validacao-fv-ux-018.mjs — FV-UX-018
 *
 * Percorre pela API canônica exatamente o que a nova tela faz: cria cliente e
 * projeto, informa os dados técnicos por `PUT /:id/etapa`, relê, confere a
 * persistência direto no banco e gera o unifilar para medir quais lacunas
 * desapareceram.
 *
 * Roda exclusivamente contra o ambiente isolado (porta 37017).
 *
 *   node backend/scripts/validacao-fv-ux-018.mjs
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

const selo = Date.now().toString().slice(-8)

secao('1 · Cliente e projeto pela API canônica')
const cli = await api('POST', '/api/clientes', {
  nome: `Cliente UX018 ${selo}`, email: `ux018+${selo}@teste.com`, cidade: 'Natal', estado: 'RN',
})
const clienteId = cli.json?._id ?? cli.json?.cliente?._id
ok(!!clienteId, `cliente criado (HTTP ${cli.status})`)

const prj = await api('POST', '/api/projetos-fv', { nome: `Projeto UX018 ${selo}`, clienteId })
const projetoId = prj.json?._id ?? prj.json?.projeto?._id
ok(!!projetoId, `projeto criado (HTTP ${prj.status})`)
if (!projetoId) process.exit(1)

secao('2 · Estado inicial — o que a etapa técnica encontra vazio')
const antes = (await api('GET', `/api/projetos-fv/${projetoId}`)).json
ok(antes?.fatura_extracao?.consumo_mensal_kwh == null, 'consumo ausente')
ok(antes?.fatura_extracao?.tipo_ligacao == null, 'ligação ausente')
ok(antes?.fatura_extracao?.tensao_v == null, 'tensão ausente')
ok(antes?.fatura_extracao?.concessionaria == null, 'concessionária ausente')
ok(antes?.localizacao?.estado == null, 'UF ausente')

const uniAntes = await api('POST', `/api/projetos-fv/${projetoId}/unifilar/gerar`, {})
console.log(`   lacunas do unifilar ANTES: ${JSON.stringify(uniAntes.json?.lacunas)}`)

secao('3 · Salvar — as duas etapas que a tela usa')
const f1 = await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'fatura',
  dados: {
    consumo_mensal_kwh: 1500, valor_kwh: 0.98, tipo_ligacao: 'Trifásico',
    tensao_v: 380, concessionaria: 'NEOENERGIA COSERN',
  },
})
ok(f1.status === 200, `etapa fatura gravada (HTTP ${f1.status})`)

// A tela envia a localização sobre a cópia devolvida pelo servidor.
const l1 = await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'localizacao', dados: { ...(antes.localizacao ?? {}), estado: 'RN' },
})
ok(l1.status === 200, `etapa localizacao gravada (HTTP ${l1.status})`)

secao('4 · Recarregar — a tela relê o servidor após salvar')
const depois = (await api('GET', `/api/projetos-fv/${projetoId}`)).json
const fe = depois?.fatura_extracao ?? {}
ok(fe.consumo_mensal_kwh === 1500, `consumo ${fe.consumo_mensal_kwh}`)
ok(fe.valor_kwh === 0.98, `tarifa ${fe.valor_kwh}`)
ok(fe.tipo_ligacao === 'Trifásico', `ligação ${fe.tipo_ligacao}`)
ok(fe.tensao_v === 380, `tensão ${fe.tensao_v}`)
ok(fe.concessionaria === 'NEOENERGIA COSERN', `concessionária ${fe.concessionaria}`)
ok(depois?.localizacao?.estado === 'RN', `UF ${depois?.localizacao?.estado}`)
ok(depois?.local_resolvido?.estado === 'RN', 'UF aparece no local resolvido')

secao('5 · Zero explícito é preservado; branco continua ausência')
const z = await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'fatura', dados: { valor_kwh: 0 },
})
ok(z.status === 200, `zero gravado (HTTP ${z.status})`)
const comZero = (await api('GET', `/api/projetos-fv/${projetoId}`)).json
ok(comZero.fatura_extracao.valor_kwh === 0, 'tarifa 0 persistida como zero — não virou null')
ok(comZero.fatura_extracao.consumo_mensal_kwh === 1500, 'campo não enviado permaneceu intacto')

const nulo = await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'fatura', dados: { valor_kwh: null },
})
ok(nulo.status === 200, `ausência gravada (HTTP ${nulo.status})`)
const semTarifa = (await api('GET', `/api/projetos-fv/${projetoId}`)).json
ok(semTarifa.fatura_extracao.valor_kwh === null, 'campo limpo virou null, não 0')

// Restaura para as verificações seguintes.
await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, { etapa: 'fatura', dados: { valor_kwh: 0.98 } })

secao('6 · A localização não perdeu nada')
// O handler substitui `localizacao` INTEIRA. Para provar que a tela não apaga
// nada, primeiro se povoa o subdocumento; depois se troca SÓ a UF, como a tela
// faz — sobre a cópia devolvida pelo servidor.
await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'localizacao',
  dados: {
    ...(depois.localizacao ?? {}),
    cidade: 'Natal', latitude: -5.79, longitude: -35.2,
    temperatura_min_historica_c: 18, temperatura_max_historica_c: 34,
  },
})
const povoado = (await api('GET', `/api/projetos-fv/${projetoId}`)).json
ok(povoado.localizacao.cidade === 'Natal', 'localização povoada')

await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'localizacao', dados: { ...povoado.localizacao, estado: 'PB' },
})
const trocado = (await api('GET', `/api/projetos-fv/${projetoId}`)).json
ok(trocado.localizacao.estado === 'PB', 'UF trocada')
ok(trocado.localizacao.cidade === 'Natal', 'cidade preservada na substituição do subdocumento')
ok(trocado.localizacao.latitude === -5.79, 'coordenadas preservadas')
ok(trocado.localizacao.temperatura_min_historica_c === 18, 'Tmin preservada — decide a Voc_max')
ok(trocado.localizacao.temperatura_max_historica_c === 34, 'Tmax preservada')
ok(trocado.localizacao.temperatura_referencia_c === 25, 'Tref (STC) preservada')

// Volta para RN, que é a UF usada nas conferências seguintes.
await api('PUT', `/api/projetos-fv/${projetoId}/etapa`, {
  etapa: 'localizacao', dados: { ...trocado.localizacao, estado: 'RN' },
})

secao('7 · Unifilar — quais lacunas desapareceram')
const uniDepois = await api('POST', `/api/projetos-fv/${projetoId}/unifilar/gerar`, {})
const lacunasAntes = uniAntes.json?.lacunas ?? []
const lacunasDepois = uniDepois.json?.lacunas ?? []
console.log(`   lacunas DEPOIS: ${JSON.stringify(lacunasDepois)}`)
for (const campo of ['tipo_ligacao', 'tensao', 'distribuidora', 'uf']) {
  ok(lacunasAntes.includes(campo) && !lacunasDepois.includes(campo), `\`${campo}\` fechada`)
}
ok(lacunasDepois.includes('arranjoMPPTs'),
  '`arranjoMPPTs` continua declarada — MPPT está fora do escopo desta sprint')
ok(uniDepois.json?.proveniencia?.tipo_ligacao === 'fatura_extracao.tipo_ligacao',
  'proveniência aponta o caminho persistido, não um default')

secao('8 · Persistência conferida direto no banco')
await mongoose.connect(cred.uri)
const { ProjetoFV } = await import('../src/models/ProjetoFV.js')
const doc = await ProjetoFV.findById(projetoId).lean()
ok(doc.fatura_extracao.tipo_ligacao === 'Trifásico', 'ligação no documento')
ok(doc.fatura_extracao.tensao_v === 380, 'tensão no documento')
ok(doc.localizacao.estado === 'RN', 'UF no documento')
ok(doc.engenharia_eletrica == null, 'nenhuma engenharia elétrica foi inventada')
ok(doc.dimensionamento?.potencia_kwp == null, 'nenhum dimensionamento foi calculado')
ok(doc.financeiro?.payback_anos == null, 'nenhum indicador financeiro foi gravado (INV-58)')
ok(String(doc.empresa_id) === String(cred.empresa_id), 'tenant carimbado pelo servidor (M-4)')

secao('9 · Isolamento entre organizações (M-4)')
const alheio = await ProjetoFV.findOne({
  _id: projetoId, empresa_id: new mongoose.Types.ObjectId(),
}).lean()
ok(alheio === null, 'outra organização não enxerga o projeto')

const jwt = (await import('jsonwebtoken')).default
const tokenAlheio = jwt.sign(
  { userId: '000000000000000000000009', email: 'outro@teste.com', perfil: 'admin',
    empresa_id: String(new mongoose.Types.ObjectId()) },
  process.env.JWT_SECRET || 'validacao_fv_ux_018_secret_local', { expiresIn: '1h' })
const tentativa = await fetch(`${API}/api/projetos-fv/${projetoId}/etapa`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${tokenAlheio}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ etapa: 'fatura', dados: { tensao_v: 127 } }),
})
ok(tentativa.status === 404 || tentativa.status === 403,
  `escrita de outra organização recusada (HTTP ${tentativa.status})`)
const intacto = await ProjetoFV.findById(projetoId).lean()
ok(intacto.fatura_extracao.tensao_v === 380, 'o valor não foi alterado pela tentativa alheia')

secao('10 · O wizard não foi necessário')
ok(doc.schema_version === 3, 'documento em v3, gravado pela etapa canônica')
console.log(`   projeto validado: ${projetoId}`)

await mongoose.disconnect()
console.log(falhas === 0
  ? '\nOK — dados técnicos informados, persistidos e relidos pela nova UX.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
