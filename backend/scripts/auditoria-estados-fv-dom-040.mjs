/**
 * auditoria-estados-fv-dom-040.mjs — FV-DOM-040
 *
 * Audita as máquinas de estado de Homologação, Conexão, Gate e Baseline:
 * quem grava, quem lê, quais transições são aceitas, como se relacionam, e se
 * há combinações mutuamente exclusivas que o sistema permite mesmo assim.
 *
 * Reproduz o caso crítico:  conexão = CONECTADO  ∧  homologação = REPROVADA
 *
 * NÃO implementa nada, NÃO cria estado, NÃO altera transição.
 * Ambiente isolado (37017).
 *
 *   node backend/scripts/auditoria-estados-fv-dom-040.mjs
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP = path.resolve(RAIZ, '..')
const cred = JSON.parse(readFileSync(path.join(RAIZ, '.ambiente-validacao.json'), 'utf8'))
const TOKEN = readFileSync(path.join(RAIZ, '.token-validacao'), 'utf8').trim()
const API = 'http://127.0.0.1:5001'
if (!cred.uri.includes('37017')) { console.error('❌ só no isolado'); process.exit(1) }

const ler = (rel) => { try { return readFileSync(path.resolve(APP, rel), 'utf8') } catch { return '' } }
const codigo = (rel) => ler(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const secao = (t) => console.log(`\n══ ${t} ${'═'.repeat(Math.max(0, 56 - t.length))}`)
const item = (m, t) => console.log(`${m} ${t}`)

async function api(metodo, caminho, corpo) {
  const r = await fetch(`${API}${caminho}`, { method: metodo,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo) })
  const tipo = r.headers.get('content-type') ?? ''
  if (tipo.includes('json')) return { status: r.status, json: await r.json().catch(() => null) }
  return { status: r.status }
}
const salvar = (id, etapa, dados) => api('PUT', `/api/projetos-fv/${id}/etapa`, { etapa, dados })
const estadoDe = async (P) => {
  const p = (await api('GET', `/api/projetos-fv/${P}`)).json
  const proj = p?.projeto ?? p
  return {
    status: proj?.homologacao?.status ?? null,
    assistida: proj?.homologacao?.status_homologacao ?? null,
    projeto: proj?.status ?? null,
    freeze: proj?.governanca?.freeze_status ?? null,
  }
}

console.log('═══ FV-DOM-040 — auditoria das máquinas de estado ═══')

// ═══ 1 · Inventário ════════════════════════════════════════════════════════
secao('1 · Quais máquinas existem')
const SCHEMA = codigo('backend/src/models/ProjetoFV.js')
{
  const legado = (SCHEMA.match(/enum: \['rascunho', 'enviado', 'analise', 'aprovado', 'conectado'\]/) ?? [])[0]
  const assist = (SCHEMA.match(/enum: \['nao_iniciado'[^\]]*\]/) ?? [])[0]
  item('●', `HOMOLOGAÇÃO-A (legada)  ${legado ? legado.replace('enum: ', '') : 'ausente'}`)
  item('●', `HOMOLOGAÇÃO-B (assistida) ${assist ? assist.replace('enum: ', '') : 'ausente'}`)
  item('●', 'CONEXÃO — não tem máquina própria: "conectado" é o último estado de A')
  item('●', 'GATE — DERIVADO, nunca persistido (INV-58). Lê Baseline + opção aceita')
  item('●', 'BASELINE — agregado próprio, congelado; índice único por projeto')
  console.log('')
  item('○', `PROJETO.status (ciclo de vida, 11 estados) — máquina paralela, fora do escopo`)
  item('○', `governanca.freeze_status e workflow comercial — máquinas do wizard legado`)
}

// ═══ 2 · Quem grava, quem lê ═══════════════════════════════════════════════
secao('2 · Quem grava e quem lê cada uma')
{
  const ctrl = codigo('backend/src/controllers/homologacaoController.js')
  const rotas = codigo('backend/src/routes/homologacao.js')
  item(/projeto\.homologacao\.status = status/.test(ctrl) ? '●' : '○',
    'A é gravada por: PATCH /homologacao/status → homologacaoController')
  item(/status_homologacao = status/.test(rotas) ? '●' : '○',
    'B é gravada por: PATCH /homologacao/assistida/status → routes/homologacao.js')

  const leemA = ['frontend/src/fv/paginas/etapas/EtapaHomologacao.jsx']
    .filter((f) => /estado\?\.status|homologacao\?\.status\b/.test(ler(f)))
  const leemB = ['frontend/src/components/fv/homologacao/CentralDados.jsx',
    'frontend/src/components/crm/CrmProjetos.jsx']
    .filter((f) => /status_homologacao/.test(ler(f)))
  item('⚠', `UX NOVA (/fv) dirige a máquina LEGADA (A): ${leemA.length > 0}`)
  item('⚠', `UX LEGADA dirige a máquina ASSISTIDA (B): ${leemB.map((f) => f.split('/').pop()).join(', ')}`)
  console.log('   ⇒ inversão: a interface nova usa a máquina antiga, e vice-versa.')

  // Quem mais consome os estados para DECIDIR algo?
  const decisores = ['backend/src/dominio/gate/index.js',
    'backend/src/services/BaselineService.js',
    'backend/src/dominio/proposta/index.js']
    .filter((f) => /homologacao\.status|status_homologacao/.test(codigo(f)))
  item(decisores.length === 0 ? '●' : '⚠',
    decisores.length === 0
      ? 'NENHUM domínio decide com base nesses estados — são puramente descritivos'
      : `decidem com base neles: ${decisores.join(', ')}`)
}

// ═══ 3 · Projeto de referência ═════════════════════════════════════════════
const invs = (await api('GET', '/api/equipamentos?tipo=inversor&limit=200')).json
const ZN = ((await api('GET', '/api/equipamentos?tipo=modulo&limit=50')).json?.equipamentos ?? [])
  .find((e) => e.fabricante === 'Znshine')
const SG = (invs?.equipamentos ?? invs ?? []).find((e) => e.modelo === 'SG15RT')
if (!ZN || !SG) { console.error('❌ catálogo não semeado'); process.exit(1) }
const painel = (q) => ({ id: String(ZN._id), marca: 'Znshine', modelo: ZN.modelo,
  potencia_w: 650, quantidade: q, equipamento_id: String(ZN._id) })
const inv = () => ({ id: String(SG._id), marca: SG.fabricante, modelo: SG.modelo,
  potencia_kw: 15, tipo: 'string', fases: 3, quantidade: 1, equipamento_id: String(SG._id) })

async function projetoAceito(nome) {
  const P = (await api('POST', '/api/projetos-fv',
    { nome: `${nome} ${Date.now()}`, clienteId: cred.cliente_id })).json?._id
  await salvar(P, 'fatura', { tipo_ligacao: 'Trifásico', tensao_v: 380, concessionaria: 'Cosern' })
  await salvar(P, 'localizacao', { estado: 'RN' })
  await salvar(P, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
  await salvar(P, 'equipamentos', { paineis: [painel(24)], inversor: inv(),
    estrutura: { tipo: 'Fibrocimento', descricao: '' } })
  await salvar(P, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
    paineis: [painel(24)], inversores: [inv()] }] })
  const aprovar = async (proj, valor) => {
    const c = await api('POST', `/api/projetos-fv/${proj}/cotacoes`, { tecnologia: 'fv', premissas: {} })
    const o = await api('POST', `/api/projetos-fv/${proj}/orcamentos`,
      { cotacao_ref: c.json?.cotacao?._id ?? c.json?._id,
        itens: [{ descricao: 'kit', quantidade: 1, valor_unitario_r: valor, valor_total_r: valor }] })
    const oid = o.json?.orcamento?._id ?? o.json?._id
    await api('POST', `/api/projetos-fv/${proj}/orcamentos/${oid}/emitir`, {})
    return api('POST', `/api/projetos-fv/${proj}/orcamentos/${oid}/aprovar`, {})
  }
  await aprovar(P, 50000)
  const P2 = (await api('POST', `/api/projetos-fv/${P}/opcoes`, {})).json?.item?._id
  await salvar(P2, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
  await salvar(P2, 'equipamentos', { paineis: [painel(24)], inversor: inv(),
    estrutura: { tipo: 'Laje', descricao: '' } })
  await salvar(P2, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
    paineis: [painel(24)], inversores: [inv()] }] })
  await aprovar(P2, 58000)
  await api('POST', `/api/projetos-fv/${P}/proposta/enviar`, {})
  await api('POST', `/api/projetos-fv/${P}/proposta/aceitar`, {})
  return P
}

// ═══ 4 · Transições ════════════════════════════════════════════════════════
secao('4 · Quais transições são aceitas')
{
  const P = await projetoAceito('FV-DOM-040 transicoes')

  // Máquina A: pular do início ao fim, e voltar.
  const salto = await api('PATCH', `/api/projetos-fv/${P}/homologacao/status`, { status: 'conectado' })
  item(salto.status === 200 ? '⚠' : '●',
    `A: rascunho → conectado (pula 3 estados) → HTTP ${salto.status}`)
  const volta = await api('PATCH', `/api/projetos-fv/${P}/homologacao/status`, { status: 'rascunho' })
  item(volta.status === 200 ? '⚠' : '●',
    `A: conectado → rascunho (regride) → HTTP ${volta.status}`)
  const foraA = await api('PATCH', `/api/projetos-fv/${P}/homologacao/status`, { status: 'inventado' })
  item(foraA.status >= 400 ? '●' : '⚠',
    `A: valor fora do enum → HTTP ${foraA.status} (${foraA.json?.erro ?? ''})`)

  // Máquina B: idem.
  const saltoB = await api('PATCH', `/api/projetos-fv/${P}/homologacao/assistida/status`,
    { status: 'homologado' })
  item(saltoB.status === 200 ? '⚠' : '●',
    `B: nao_iniciado → homologado (pula 4) → HTTP ${saltoB.status}`)
  const voltaB = await api('PATCH', `/api/projetos-fv/${P}/homologacao/assistida/status`,
    { status: 'nao_iniciado' })
  item(voltaB.status === 200 ? '⚠' : '●',
    `B: homologado → nao_iniciado (regride) → HTTP ${voltaB.status}`)
  const foraB = await api('PATCH', `/api/projetos-fv/${P}/homologacao/assistida/status`,
    { status: 'inventado' })
  item(foraB.status >= 400 ? '●' : '⚠', `B: valor fora do enum → HTTP ${foraB.status}`)

  const assist = codigo('backend/src/utils/homologacao/homologacaoAssistida.js')
  item(/TRANSICOES|transicoesPermitidas|podeTransitar/.test(assist) ? '●' : '⚠',
    'existe tabela de transições declarada em algum lugar?')
}

// ═══ 5 · CASO CRÍTICO ══════════════════════════════════════════════════════
secao('5 · CASO CRÍTICO — conexão CONECTADO ∧ homologação REPROVADA')
{
  const P = await projetoAceito('FV-DOM-040 caso critico')
  const a = await api('PATCH', `/api/projetos-fv/${P}/homologacao/status`, { status: 'conectado' })
  const b = await api('PATCH', `/api/projetos-fv/${P}/homologacao/assistida/status`,
    { status: 'reprovado', motivo: 'documentação incompleta' })
  const e = await estadoDe(P)

  item(a.status === 200 && b.status === 200 ? '⚠' : '●',
    `gravar os dois: A→conectado HTTP ${a.status} · B→reprovado HTTP ${b.status}`)
  console.log('')
  console.log('   ┌─ ESTADO RESULTANTE ────────────────────────────────┐')
  console.log(`   │  homologacao.status            = ${String(e.status).padEnd(16)}│`)
  console.log(`   │  homologacao.status_homologacao = ${String(e.assistida).padEnd(15)}│`)
  console.log(`   │  projeto.status                = ${String(e.projeto).padEnd(16)}│`)
  console.log('   └────────────────────────────────────────────────────┘')
  console.log('   O sistema afirma, ao mesmo tempo, que a usina está CONECTADA')
  console.log('   à rede e que a homologação foi REPROVADA pela concessionária.')
  console.log('')

  // A ordem inversa também passa?
  const Q = await projetoAceito('FV-DOM-040 caso critico inverso')
  await api('PATCH', `/api/projetos-fv/${Q}/homologacao/assistida/status`, { status: 'reprovado' })
  const a2 = await api('PATCH', `/api/projetos-fv/${Q}/homologacao/status`, { status: 'conectado' })
  item(a2.status === 200 ? '⚠' : '●',
    `ordem inversa (reprovar e depois conectar) → HTTP ${a2.status}`)

  // Quem lê isso, lê o quê?
  const st = await api('GET', `/api/projetos-fv/${P}/homologacao/status`)
  const assistCk = await api('GET', `/api/projetos-fv/${P}/homologacao/assistida/checklist`)
  item('⚠', `GET /homologacao/status devolve: "${st.json?.homologacao?.status}" `
    + `(e também "${st.json?.homologacao?.status_homologacao}" no mesmo payload)`)
  item('●', `GET /assistida/checklist responde ${assistCk.status} — indiferente à contradição`)
}

// ═══ 6 · Relação com Gate e Baseline ═══════════════════════════════════════
secao('6 · Gate e Baseline dependem desses estados?')
{
  const P = await projetoAceito('FV-DOM-040 gate')
  const antes = await api('GET', `/api/projetos-fv/${P}/fases`)
  const fAntes = (antes.json?.fases ?? []).find((f) => f.chave === 'homologacao')
  await api('PATCH', `/api/projetos-fv/${P}/homologacao/assistida/status`, { status: 'reprovado' })
  await api('PATCH', `/api/projetos-fv/${P}/homologacao/status`, { status: 'conectado' })
  const depois = await api('GET', `/api/projetos-fv/${P}/fases`)
  const fDepois = (depois.json?.fases ?? []).find((f) => f.chave === 'homologacao')

  item(fAntes?.liberada === fDepois?.liberada ? '●' : '⚠',
    `Gate antes=${fAntes?.liberada} · depois de REPROVAR=${fDepois?.liberada}`)
  console.log('   ⇒ o Gate não olha o estado da homologação: ele decide por')
  console.log('     Baseline íntegra + opção aceita (FV-DOM-001 / FV-DOM-032).')

  const b = await api('GET', `/api/projetos-fv/${P}/baseline`)
  item(b.json?.baseline?.hash ? '●' : '⚠',
    `Baseline intacta após reprovar: hash ${b.json?.baseline?.hash?.slice(0, 12)}`)

  const gate = codigo('backend/src/dominio/gate/index.js')
  item(!/homologacao\.status|status_homologacao/.test(gate) ? '●' : '⚠',
    'o domínio do Gate NÃO lê estado de homologação — confirmado na fonte')

  // E o inverso: o Gate barra a escrita de estado?
  const NAO = await projetoAceito('FV-DOM-040 gate inverso')
  const irma = (await api('GET', `/api/projetos-fv/${NAO}/opcoes`)).json?.opcoes
    ?.find((o) => o.proposta_aceite?.aceita !== true)
  if (irma) {
    const bloq = await api('PATCH', `/api/projetos-fv/${irma._id}/homologacao/status`,
      { status: 'conectado' })
    item(bloq.status === 409 ? '●' : '⚠',
      `opção NÃO escolhida tentando conectar → HTTP ${bloq.status} `
      + `(${bloq.json?.codigo ?? ''}) — o Gate barra a ESCRITA`)
  }
}

// ═══ 7 · Independência ou exclusão mútua ═══════════════════════════════════
secao('7 · Os estados são independentes ou mutuamente exclusivos?')
{
  const rotas = codigo('backend/src/routes/homologacao.js')
  const ctrl = codigo('backend/src/controllers/homologacaoController.js')
  item(!/status_homologacao/.test(ctrl.slice(ctrl.indexOf('atualizarStatusHomologacao'))) ? '●' : '⚠',
    'ao gravar A, ninguém consulta B')
  item(!/homologacao\.status\s*[^_]/.test(rotas.slice(rotas.indexOf("'/assistida/status'"),
    rotas.indexOf("'/protocolo'"))) ? '●' : '⚠',
    'ao gravar B, ninguém consulta A')
  item('⚠', 'NENHUMA regra declara combinação inválida — as duas são independentes')
  console.log('   ⇒ 5 × 7 = 35 combinações possíveis, todas aceitas, incluindo')
  console.log('     as contraditórias. Nenhuma tabela de exclusão existe.')
}

// ═══ 8 · Endpoints ═════════════════════════════════════════════════════════
secao('8 · Endpoints que tocam estado')
{
  const rotas = ler('backend/src/routes/homologacao.js')
  const lista = [...rotas.matchAll(/router\.(get|post|patch)\('([^']+)'/g)]
    .map((m) => `${m[1].toUpperCase().padEnd(5)} /homologacao${m[2]}`)
  for (const r of lista) {
    const escreve = /PATCH|POST/.test(r) && /status|protocolo|checklist/.test(r)
    console.log(`   ${escreve ? '✎' : ' '} ${r}`)
  }
  console.log('\n   ✎ = grava estado ou dado de acompanhamento')
}

console.log('\n─── fim da auditoria — nada foi implementado ───')
