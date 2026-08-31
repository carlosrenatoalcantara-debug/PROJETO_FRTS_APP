/**
 * validacao-fv-ux-040.mjs — FV-UX-040
 *
 * Esta sprint implementou APENAS os nós cuja regra já estava definida:
 *
 *   1. o Gate passa a cobrir `/protocolo` e `/assistida/status` — duas rotas de
 *      AVANÇO que escaparam da FV-UX-034. A regra é a de sempre (FV-DOM-032,
 *      regra 5: só a opção aceita avança); faltava aplicá-la;
 *   2. o protocolo da concessionária chega à UX — a regra, o campo, o histórico
 *      e a auditoria já existiam; faltava caminho.
 *
 * E prova que os dois caminhos pós-aceite continuam INDEPENDENTES.
 *
 * Ambiente isolado (37017), backend com SMTP_USER="" SMTP_PASS="".
 *
 *   node backend/scripts/validacao-fv-ux-040.mjs
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

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n══ ${t}`)
const ler = (rel) => { try { return readFileSync(path.resolve(APP, rel), 'utf8') } catch { return '' } }

async function api(metodo, caminho, corpo) {
  const r = await fetch(`${API}${caminho}`, { method: metodo,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo) })
  const tipo = r.headers.get('content-type') ?? ''
  if (tipo.includes('json')) return { status: r.status, json: await r.json().catch(() => null) }
  return { status: r.status, bytes: (await r.arrayBuffer()).byteLength }
}
const salvar = (id, etapa, dados) => api('PUT', `/api/projetos-fv/${id}/etapa`, { etapa, dados })

console.log('═══ FV-UX-040 — fluxo pós-aceite ═══')

const invs = (await api('GET', '/api/equipamentos?tipo=inversor&limit=200')).json
const ZN = ((await api('GET', '/api/equipamentos?tipo=modulo&limit=50')).json?.equipamentos ?? [])
  .find((e) => e.fabricante === 'Znshine')
const SG = (invs?.equipamentos ?? invs ?? []).find((e) => e.modelo === 'SG15RT')
ok(!!ZN && !!SG, 'catálogo semeado')
if (!ZN || !SG) process.exit(1)

const painel = (q) => ({ id: String(ZN._id), marca: 'Znshine', modelo: ZN.modelo,
  potencia_w: 650, quantidade: q, equipamento_id: String(ZN._id) })
const inv = () => ({ id: String(SG._id), marca: SG.fabricante, modelo: SG.modelo,
  potencia_kw: 15, tipo: 'string', fases: 3, quantidade: 1, equipamento_id: String(SG._id) })

async function montar(nome) {
  const P = (await api('POST', '/api/projetos-fv',
    { nome: `${nome} ${Date.now()}`, clienteId: cred.cliente_id })).json?._id
  await salvar(P, 'fatura', { tipo_ligacao: 'Trifásico', tensao_v: 380, concessionaria: 'Neoenergia' })
  await salvar(P, 'localizacao', { estado: 'RN' })
  await salvar(P, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
  await salvar(P, 'equipamentos', { paineis: [painel(24)], inversor: inv(),
    estrutura: { tipo: 'Fibrocimento', descricao: '' } })
  await salvar(P, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
    paineis: [painel(24)], inversores: [inv()] }] })
  await salvar(P, 'engenharia_eletrica', { arranjo: { num_mppts_usados: 2,
    mppts: [{ mppt: 1, strings_paralelo: 1, modulos_por_string: 12, total_modulos: 12 },
      { mppt: 2, strings_paralelo: 1, modulos_por_string: 12, total_modulos: 12 }] } })
  return P
}
async function aprovar(P, valor) {
  const c = await api('POST', `/api/projetos-fv/${P}/cotacoes`, { tecnologia: 'fv', premissas: {} })
  const o = await api('POST', `/api/projetos-fv/${P}/orcamentos`,
    { cotacao_ref: c.json?.cotacao?._id ?? c.json?._id,
      itens: [{ descricao: 'kit', quantidade: 1, valor_unitario_r: valor, valor_total_r: valor }] })
  const oid = o.json?.orcamento?._id ?? o.json?._id
  await api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/emitir`, {})
  return api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/aprovar`, {})
}

// Proposta com duas opções, uma aceita.
const A = await montar('FV-UX-040 aceita')
const B = (await api('POST', `/api/projetos-fv/${A}/opcoes`, {})).json?.item?._id
await salvar(B, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
await salvar(B, 'equipamentos', { paineis: [painel(24)], inversor: inv(),
  estrutura: { tipo: 'Laje', descricao: '' } })
await salvar(B, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
  paineis: [painel(24)], inversores: [inv()] }] })
await aprovar(A, 50000)
await aprovar(B, 58000)
await api('POST', `/api/projetos-fv/${A}/proposta/enviar`, {})
ok((await api('POST', `/api/projetos-fv/${A}/proposta/aceitar`, {})).status === 200,
  'Opção 01 aceita')

// ═══ 1 · O Gate cobre as rotas que haviam escapado ═════════════════════════
secao('1 · Gate nas rotas que escaparam da FV-UX-034')
{
  const prot = await api('PATCH', `/api/projetos-fv/${B}/homologacao/protocolo`,
    { numero_protocolo: 'NAO-DEVERIA' })
  ok(prot.status === 409 && prot.json?.codigo === 'OPCAO_NAO_ESCOLHIDA',
    `não escolhida · protocolo → HTTP ${prot.status} · ${prot.json?.codigo}`)

  const assist = await api('PATCH', `/api/projetos-fv/${B}/homologacao/assistida/status`,
    { status: 'homologado' })
  ok(assist.status === 409 && assist.json?.codigo === 'OPCAO_NAO_ESCOLHIDA',
    `não escolhida · assistida/status → HTTP ${assist.status} · ${assist.json?.codigo}`)

  // Nada foi gravado na perdedora.
  const p = (await api('GET', `/api/projetos-fv/${B}`)).json
  const h = (p?.projeto ?? p)?.homologacao ?? {}
  ok(!h.numero_protocolo, `e nada ficou gravado: protocolo = ${JSON.stringify(h.numero_protocolo)}`)

  // Consulta continua aberta — regra 9.
  for (const [rot, caminho] of [['status', 'status'], ['checklist', 'checklist'],
    ['assistida/checklist', 'assistida/checklist']]) {
    const r = await api('GET', `/api/projetos-fv/${B}/homologacao/${caminho}`)
    ok(r.status === 200, `mas CONSULTAR ${rot} segue liberado (HTTP ${r.status})`)
  }
}

// ═══ 2 · A opção ACEITA protocola ══════════════════════════════════════════
secao('2 · Protocolo da concessionária (nó A2)')
{
  const vazio = await api('GET', `/api/projetos-fv/${A}/homologacao/status`)
  ok(!vazio.json?.homologacao?.numero_protocolo, 'começa sem protocolo')

  const r = await api('PATCH', `/api/projetos-fv/${A}/homologacao/protocolo`,
    { numero_protocolo: 'PROT-2026-0042' })
  ok(r.status === 200 && r.json?.numero_protocolo === 'PROT-2026-0042',
    `registra → HTTP ${r.status} · ${r.json?.numero_protocolo}`)
  ok(!!r.json?.protocolo_atualizado_em, 'com data de atualização')
  ok((r.json?.protocolo_historico ?? []).length >= 1,
    `e histórico (${r.json?.protocolo_historico?.length} registro(s))`)

  const lido = await api('GET', `/api/projetos-fv/${A}/homologacao/status`)
  ok(lido.json?.homologacao?.numero_protocolo === 'PROT-2026-0042',
    'o protocolo volta na leitura — é ele que a tela mostra')

  // Correção volta ao histórico, não apaga o anterior.
  const corrige = await api('PATCH', `/api/projetos-fv/${A}/homologacao/protocolo`,
    { numero_protocolo: 'PROT-2026-0043' })
  ok(corrige.json?.protocolo_historico?.length >= 2,
    `corrigir preserva o anterior no histórico (${corrige.json?.protocolo_historico?.length})`)

  // Vazio limpa — e a limpeza também é registrada.
  const limpa = await api('PATCH', `/api/projetos-fv/${A}/homologacao/protocolo`,
    { numero_protocolo: '' })
  ok(limpa.json?.numero_protocolo === null, 'string vazia LIMPA o protocolo')
  ok(limpa.json?.protocolo_historico?.length >= 3, 'e a remoção fica no histórico')
  await api('PATCH', `/api/projetos-fv/${A}/homologacao/protocolo`,
    { numero_protocolo: 'PROT-2026-0043' })
}

// ═══ 3 · A UX alcança o nó ═════════════════════════════════════════════════
secao('3 · A UX alcança o protocolo')
{
  const clienteApi = ler('frontend/src/fv/api/agregadosFvApi.js')
  const tela = ler('frontend/src/fv/paginas/etapas/EtapaHomologacao.jsx')
  ok(/homologacao\/protocolo/.test(clienteApi), 'o cliente de API chama a rota')
  ok(/numero_protocolo/.test(clienteApi), 'com o nome de campo do contrato')
  ok(/Protocolo na concessionária/.test(tela), 'a tela expõe o protocolo')
  ok(/registrarProtocoloHomologacao\(id/.test(tela), 'e envia ao servidor')
  ok(/disabled=\{!fase\.liberada[\s\S]{0,80}\}/.test(tela),
    'com escrita desabilitada quando o Gate bloqueia')
  ok(!/numero_protocolo\s*=\s*['"`]/.test(tela), 'a tela não inventa protocolo')
}

// ═══ 4 · Os dois caminhos seguem independentes ═════════════════════════════
secao('4 · Homologação ∥ Engenharia continuam independentes')
{
  const u = await api('POST', `/api/projetos-fv/${A}/unifilar/gerar`, {})
  ok(u.status === 200, `engenharia (unifilar) avança com homologação protocolada (HTTP ${u.status})`)

  const st = await api('PATCH', `/api/projetos-fv/${A}/homologacao/status`, { status: 'analise' })
  ok(st.status === 200, `homologação avança sem engenharia concluída (HTTP ${st.status})`)

  const f = await api('GET', `/api/projetos-fv/${A}/fases`)
  const fases = f.json?.fases ?? f.json?.lista ?? []
  const eng = fases.find((x) => x.chave === 'engenharia')
  const hom = fases.find((x) => x.chave === 'homologacao')
  ok(eng?.paralela === true && hom?.paralela === true,
    'as duas seguem declaradas como paralelas')
  ok(eng?.liberada === true && hom?.liberada === true,
    'e as duas liberadas para a opção aceita')
}

// ═══ 5 · Nada foi inventado nos nós sem regra ══════════════════════════════
secao('5 · Nós sem regra continuam declarando que não existem')
{
  const schema = ler('backend/src/models/ProjetoFV.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const [rot, re] of [
    ['orçamento de conexão', /orcamento_conexao|custo_conexao/i],
    ['projeto executivo', /projeto_executivo|executivo:/],
    ['as-built', /as_built|asbuilt/i],
  ]) ok(!re.test(schema), `nenhum campo novo para ${rot} — segue pendente de decisão`)

  /**
   * FV-DOM-042 decidiu o parecer (D1/D7) e criou `parecer_extracao`. Exigir
   * "nenhum campo de parecer" virou guarda falsa. O que ESTA sprint garantia
   * continua garantido, e por conteúdo: o parecer modela o DOCUMENTO, não o
   * processo — os estados de deferimento que a FV-UX-040 mediu como sem regra
   * seguem sem existir.
   */
  ok(/parecer_extracao:\s*\{/.test(schema),
    'o parecer virou envelope de DOCUMENTO (FV-DOM-042/D7)')
  ok(/enum: \['extraido', 'confirmado', null\]/.test(schema),
    'com dois estados: extraido × confirmado')
  ok(!/deferid|indeferid|parecer_status|parecer_favoravel/i.test(schema),
    'e NENHUM estado de deferimento foi inventado — continua sem regra')

  for (const [rot, arq] of [['Projeto Executivo', 'EtapaExecutivo'],
    ['Execução', 'EtapaExecucao'], ['As-Built', 'EtapaAsBuilt']]) {
    const tela = ler(`frontend/src/fv/paginas/etapas/${arq}.jsx`)
    ok(/não implementad/i.test(tela),
      `a tela de ${rot} continua declarando honestamente que não é rastreável`)
  }
}

console.log(falhas === 0
  ? '\nOK — Gate completo na homologação, protocolo na UX, caminhos independentes.'
  : `\n${falhas} FALHA(S).`)
console.log(`   aceita=${A} · não escolhida=${B}`)
process.exit(falhas === 0 ? 0 : 1)
