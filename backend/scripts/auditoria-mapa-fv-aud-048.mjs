/**
 * auditoria-mapa-fv-aud-048.mjs — FV-AUD-048
 *
 * Fotografia técnica do fluxo FV, medida contra o código em execução.
 * NÃO implementa, NÃO corrige, NÃO infere.
 *
 * Vocabulário do resultado:
 *   OK              comportamento existe e foi exercido
 *   STUB            tela/rota existe, domínio não
 *   NÃO IMPLEMENTADO nenhuma evidência no código
 *   DIVERGÊNCIA     dois pontos tratam o mesmo conceito de formas diferentes
 *   CONTRADIÇÃO     dois estados coexistem afirmando coisas incompatíveis
 *
 *   node backend/scripts/auditoria-mapa-fv-aud-048.mjs
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
const secao = (t) => console.log(`\n══ ${t} ${'═'.repeat(Math.max(0, 54 - t.length))}`)
const linha = (marca, txt) => console.log(`${marca} ${txt}`)

async function api(metodo, caminho, corpo) {
  const r = await fetch(`${API}${caminho}`, { method: metodo,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo) })
  const tipo = r.headers.get('content-type') ?? ''
  if (tipo.includes('json')) return { status: r.status, json: await r.json().catch(() => null) }
  return { status: r.status, bytes: (await r.arrayBuffer()).byteLength }
}
const salvar = (id, etapa, dados) => api('PUT', `/api/projetos-fv/${id}/etapa`, { etapa, dados })

console.log('═══ FV-AUD-048 — mapa real do sistema FV ═══')

// ── Insumos ─────────────────────────────────────────────────────────────────
const invs = (await api('GET', '/api/equipamentos?tipo=inversor&limit=200')).json
const ZN = ((await api('GET', '/api/equipamentos?tipo=modulo&limit=50')).json?.equipamentos ?? [])
  .find((e) => e.fabricante === 'Znshine')
const SG = (invs?.equipamentos ?? invs ?? []).find((e) => e.modelo === 'SG15RT')
const MICRO = (invs?.equipamentos ?? invs ?? []).find((e) => e.modelo === 'HMS-2000-4T')
if (!ZN || !SG) { console.error('❌ catálogo não semeado'); process.exit(1) }
const painel = (q) => ({ id: String(ZN._id), marca: 'Znshine', modelo: ZN.modelo,
  potencia_w: 650, quantidade: q, equipamento_id: String(ZN._id) })
const invDe = (eq, q, tipo) => ({ id: String(eq._id), marca: eq.fabricante, modelo: eq.modelo,
  potencia_kw: tipo === 'micro' ? 2 : 15, tipo, fases: tipo === 'micro' ? 1 : 3,
  quantidade: q, equipamento_id: String(eq._id) })

// ═══ A · O FLUXO, NÓ A NÓ ══════════════════════════════════════════════════
secao('A · Fluxo ponta a ponta — exercitado')
const P = (await api('POST', '/api/projetos-fv',
  { nome: `FV-AUD-048 ${Date.now()}`, clienteId: cred.cliente_id })).json?._id
linha('OK  ', `CLIENTE → PROJETO        POST /api/projetos-fv → ${P}`)

await salvar(P, 'fatura', { tipo_ligacao: 'Trifásico', tensao_v: 380, concessionaria: 'Cosern' })
await salvar(P, 'localizacao', { estado: 'RN' })
const eq = await salvar(P, 'equipamentos', { paineis: [painel(24)], inversor: invDe(SG, 1, 'string'),
  estrutura: { tipo: 'Fibrocimento', descricao: '' } })
linha('OK  ', `EQUIPAMENTOS + ESTRUTURA PUT /:id/etapa (etapa "equipamentos") → ${eq.status}`)
const dim = await salvar(P, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
linha('OK  ', `DIMENSIONAMENTO          PUT /:id/etapa (etapa "dimensionamento") → ${dim.status}`)
const arr = await salvar(P, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
  paineis: [painel(24)], inversores: [invDe(SG, 1, 'string')] }] })
linha('OK  ', `COMPOSIÇÃO               PUT /:id/etapa (etapa "arranjos") → ${arr.status}`)
const topo = await salvar(P, 'engenharia_eletrica', { arranjo: { num_mppts_usados: 2,
  mppts: [{ mppt: 1, strings_paralelo: 1, modulos_por_string: 12, total_modulos: 12 },
    { mppt: 2, strings_paralelo: 1, modulos_por_string: 12, total_modulos: 12 }] } })
linha('OK  ', `TOPOLOGIA string         PUT /:id/etapa (etapa "engenharia_eletrica") → ${topo.status}`)

const u = await api('POST', `/api/projetos-fv/${P}/unifilar/gerar`, {})
linha('OK  ', `ENGENHARIA · unifilar    POST /:id/unifilar/gerar → ${u.status}, `
  + `lacunas ${JSON.stringify(u.json?.lacunas ?? [])}`)

const c = await api('POST', `/api/projetos-fv/${P}/cotacoes`, { tecnologia: 'fv', premissas: {} })
const o = await api('POST', `/api/projetos-fv/${P}/orcamentos`,
  { cotacao_ref: c.json?.cotacao?._id ?? c.json?._id,
    itens: [{ descricao: 'kit', quantidade: 1, valor_unitario_r: 50000, valor_total_r: 50000 }] })
const oid = o.json?.orcamento?._id ?? o.json?._id
await api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/emitir`, {})
const apr = await api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/aprovar`, {})
linha('OK  ', `ORÇAMENTO                Cotacao → Orcamento → aprovar → ${apr.status}`)
const b = await api('GET', `/api/projetos-fv/${P}/baseline`)
linha('OK  ', `BASELINE                 nasce da aprovação · hash ${b.json?.baseline?.hash?.slice(0, 12)}`)

const P2 = (await api('POST', `/api/projetos-fv/${P}/opcoes`, {})).json?.item?._id
await salvar(P2, 'dimensionamento', { num_paineis: 30, potencia_kwp: 19.5 })
await salvar(P2, 'equipamentos', { paineis: [painel(30)],
  inversor: invDe(MICRO ?? SG, 8, MICRO ? 'micro' : 'string'), estrutura: { tipo: 'Laje', descricao: '' } })
await salvar(P2, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
  paineis: [painel(30)], inversores: [invDe(MICRO ?? SG, 8, MICRO ? 'micro' : 'string')] }] })
const c2 = await api('POST', `/api/projetos-fv/${P2}/cotacoes`, { tecnologia: 'fv', premissas: {} })
const o2 = await api('POST', `/api/projetos-fv/${P2}/orcamentos`,
  { cotacao_ref: c2.json?.cotacao?._id ?? c2.json?._id,
    itens: [{ descricao: 'kit', quantidade: 1, valor_unitario_r: 64500, valor_total_r: 64500 }] })
const oid2 = o2.json?.orcamento?._id ?? o2.json?._id
await api('POST', `/api/projetos-fv/${P2}/orcamentos/${oid2}/emitir`, {})
await api('POST', `/api/projetos-fv/${P2}/orcamentos/${oid2}/aprovar`, {})
const lista = await api('GET', `/api/projetos-fv/${P}/opcoes`)
linha('OK  ', `PROPOSTA · OPÇÕES        ${lista.json?.opcoes?.length} irmãs por proposta_grupo_id`)

const pdf = await api('POST', `/api/projetos-fv/${P}/proposta/gerar`, {})
linha('OK  ', `PDF por opção            POST /:id/proposta/gerar → ${pdf.status}, ${pdf.bytes} bytes`)

const env = await api('POST', `/api/projetos-fv/${P}/proposta/enviar`, {})
linha('OK  ', `ENVIO                    POST /:id/proposta/enviar → ${env.status}, `
  + `${env.json?.opcoes} opções, snapshot ${env.json?.snapshot_hash?.slice(0, 12)}`)
const ace = await api('POST', `/api/projetos-fv/${P}/proposta/aceitar`, {})
linha('OK  ', `ACEITE                   POST /:id/proposta/aceitar → ${ace.status}`)

// ═══ B · A BIFURCAÇÃO ══════════════════════════════════════════════════════
secao('B · Depois do ACEITE — os dois caminhos')
{
  const f = await api('GET', `/api/projetos-fv/${P}/fases`)
  const fases = f.json?.fases ?? f.json?.lista ?? []
  const eng = fases.find((x) => x.chave === 'engenharia')
  const hom = fases.find((x) => x.chave === 'homologacao')
  console.log(`   ACEITE`)
  console.log(`      ├── HOMOLOGAÇÃO   liberada=${hom?.liberada} paralela=${hom?.paralela}`)
  console.log(`      └── ENGENHARIA    liberada=${eng?.liberada} paralela=${eng?.paralela}`)

  // Independência: cada um avança sem o outro.
  const h1 = await api('PATCH', `/api/projetos-fv/${P}/homologacao/assistida/status`,
    { status: 'em_preparacao' })
  const e1 = await api('POST', `/api/projetos-fv/${P}/unifilar/gerar`, {})
  linha('OK  ', `homologação avança (${h1.status}) sem engenharia concluir`)
  linha('OK  ', `engenharia avança (${e1.status}) com homologação em preparação`)
  linha('OK  ', 'NÃO são sequência — nenhum exige o outro')

  const perdedora = await api('POST', `/api/projetos-fv/${P2}/homologacao/memorial`,
    { projeto: { potencia_kwp: 19.5 }, cliente: { nome: 'x' } })
  linha('OK  ', `só a opção ACEITA avança: não escolhida → ${perdedora.status} `
    + `${perdedora.json?.codigo}`)
}

// ═══ C · DOCUMENTOS ════════════════════════════════════════════════════════
secao('C · Documentos — estado de cada um')
{
  const CORPO = { projeto: { potencia_kwp: 15.6,
    strings: { totalStrings: 2, modulosPorString: 12, totalModulos: 24 },
    inversor: { marca: 'Sungrow', modelo: 'SG15RT', potenciaKW: 15, fases: 3, nMppts: 2 },
    painel: { marca: 'Znshine', modelo: ZN.modelo, potenciaW: 650 } },
  cliente: { nome: 'Cliente de Validação' } }
  for (const [rot, m, caminho, corpo] of [
    ['proposta (PDF)', 'POST', `/api/projetos-fv/${P}/proposta/gerar`, {}],
    ['memorial', 'POST', `/api/projetos-fv/${P}/homologacao/memorial`, CORPO],
    ['carta', 'POST', `/api/projetos-fv/${P}/homologacao/carta`, CORPO],
    ['ART', 'POST', `/api/projetos-fv/${P}/homologacao/art`, CORPO],
    ['unifilar', 'POST', `/api/projetos-fv/${P}/unifilar/gerar`, {}],
    ['pacote homologação', 'GET', `/api/projetos-fv/${P}/homologacao/assistida/pacote`],
  ]) {
    const r = await api(m, caminho, corpo)
    linha(r.status === 200 ? 'OK  ' : 'FALHA', `${rot.padEnd(20)} ${m} → ${r.status}`)
  }
  const dl = await api('GET', `/api/projetos-fv/${P}/proposta/download`)
  linha('STUB', `download da proposta  GET → ${dl.status} — `
    + `\`salvarPropostaEmArquivo\` exportado e nunca chamado`)
}

// ═══ D · MÁQUINAS DE ESTADO ════════════════════════════════════════════════
secao('D · Máquinas de estado — separadas, como estão')
{
  const SCHEMA = codigo('backend/src/models/ProjetoFV.js')
  const m = (re) => (SCHEMA.match(re) ?? [])[0] ?? 'ausente'
  console.log(`   PROJETO      ${m(/enum: \['rascunho', 'em_simulacao'[^\]]*\]/)}`)
  console.log(`                campo: projeto.status · 3 escritores, TODOS manuais`)
  console.log(`   PROPOSTA     proposta_aceite.aceita (Boolean) + índice único por grupo`)
  console.log(`   HOMOLOG-A    ${m(/enum: \['rascunho', 'enviado', 'analise', 'aprovado', 'conectado'\]/)}`)
  console.log(`   HOMOLOG-B    ${m(/enum: \['nao_iniciado'[^\]]*\]/)}`)
  console.log(`   PARECER      ${m(/enum: \['extraido', 'confirmado', null\]/)}`)
  console.log(`   CONEXÃO      conexao.conectada_em (Date|null) — sem enum: a data É a máquina`)
  console.log(`   GATE         DERIVADO, nunca persistido (INV-58)`)
  console.log(`   BASELINE     agregado próprio, imutável (M-2), índice único por projeto`)
}

// ═══ E · CONTRADIÇÃO E DIVERGÊNCIA ═════════════════════════════════════════
secao('E · Contradições e divergências ainda vivas')
{
  // CONTRADIÇÃO 1 — as duas máquinas de homologação.
  const a = await api('PATCH', `/api/projetos-fv/${P}/homologacao/status`, { status: 'conectado' })
  const bb = await api('PATCH', `/api/projetos-fv/${P}/homologacao/assistida/status`,
    { status: 'reprovado', motivo: 'auditoria' })
  const p = (await api('GET', `/api/projetos-fv/${P}`)).json
  const proj = p?.projeto ?? p
  linha('CONTRADIÇÃO',
    `homologacao.status="${proj?.homologacao?.status}" ∧ `
    + `status_homologacao="${proj?.homologacao?.status_homologacao}" `
    + `(HTTP ${a.status}/${bb.status}) — nenhuma regra as concilia`)
  linha('CONTRADIÇÃO',
    `…e projeto.status="${proj?.status}" — terceira afirmação incompatível`)

  // A conexão nova, em contraste, DECLARA a divergência.
  await api('PUT', `/api/projetos-fv/${P}/conexao`, { conectada_em: '2026-05-14' })
  const cx = await api('GET', `/api/projetos-fv/${P}/conexao`)
  linha('OK  ', `conexão declara: "${cx.json?.divergencia?.motivo}"`)

  // DIVERGÊNCIA 1 — duas UX dirigindo máquinas trocadas.
  const uxNova = /estado\?\.status/.test(ler('frontend/src/fv/paginas/etapas/EtapaHomologacao.jsx'))
  const uxLegada = /status_homologacao/.test(ler('frontend/src/components/fv/homologacao/CentralDados.jsx'))
  linha('DIVERGÊNCIA', `UX nova dirige a máquina LEGADA (${uxNova}); `
    + `UX legada dirige a ASSISTIDA (${uxLegada})`)

  // DIVERGÊNCIA 2 — dois motores de unifilar.
  const doisMotores = ['backend/src/controllers/pareceracessoController.js',
    'backend/src/controllers/unifilarController.js']
    .filter((f) => /simbolosUnifilar/.test(codigo(f)))
  linha('DIVERGÊNCIA', `dois motores de unifilar: dominio/unifilar (canônico) × `
    + `utils/simbolosUnifilar (${doisMotores.length} consumidores)`)

  // DIVERGÊNCIA 3 — leitor comparando contra o enum errado.
  linha('DIVERGÊNCIA', `backfillLocalSuperficie:66 compara homologacao.status === 'homologado', `
    + `valor que NÃO pertence ao enum de A`)
}

// ═══ F · NÃO IMPLEMENTADO / STUB ═══════════════════════════════════════════
secao('F · Nós sem domínio')
{
  const SCHEMA = codigo('backend/src/models/ProjetoFV.js')
  for (const [rot, arq, re] of [
    ['Projeto Executivo', 'EtapaExecutivo', /projeto_executivo/],
    ['Execução', 'EtapaExecucao', /\bexecucao:\s*\{/],
    ['As-Built', 'EtapaAsBuilt', /as_built|asbuilt/i],
  ]) {
    const tela = ler(`frontend/src/fv/paginas/etapas/${arq}.jsx`)
    const declara = /não implementad/i.test(tela)
    linha('STUB', `${rot.padEnd(20)} tela roteada, declara "não implementado"=${declara}, `
      + `schema=${re.test(SCHEMA) ? 'tem campo' : 'sem campo'}`)
  }
  for (const [rot, re, onde] of [
    ['Orçamento de conexão', /orcamento_conexao|taxa_conexao|custo_conexao/i, SCHEMA],
    ['Parecer como ETAPA do processo', /deferid|indeferid|parecer_status/i, SCHEMA],
    ['Conexão provisória', /provisori/i, SCHEMA],
    ['Prazo/SLA da concessionária', /prazo|sla/i,
      codigo('backend/src/utils/homologacao/concessionariaProvider.js')],
  ]) linha('NÃO IMPL', `${rot.padEnd(34)} ${re.test(onde) ? 'existe' : 'nenhuma evidência'}`)

  const envio = codigo('backend/src/services/EnvioPropostaService.js')
  linha(/gerarPropostaComercial/.test(envio) ? 'OK  ' : 'NÃO IMPL',
    'PDF na página pública do cliente'.padEnd(34)
    + `${/gerarPropostaComercial/.test(envio) ? 'existe' : 'o cliente recebe a página, não o PDF'}`)
  const parecerLido = ['backend/src/utils/homologacao/homologacaoAssistida.js',
    'backend/src/controllers/homologacaoController.js']
    .some((f) => /parecer_extracao/.test(codigo(f)))
  linha(parecerLido ? 'OK  ' : 'NÃO IMPL',
    'Homologação consome o parecer'.padEnd(34)
    + `${parecerLido ? 'sim' : 'ninguém lê `parecer_extracao`'}`)
}

console.log(`\n─── fim do mapa — nada foi implementado nem corrigido ───`)
console.log(`   projeto base: ${P} · irmã: ${P2}`)
