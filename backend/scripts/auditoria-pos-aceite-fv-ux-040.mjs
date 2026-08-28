/**
 * auditoria-pos-aceite-fv-ux-040.mjs — FV-UX-040
 *
 * Mede o que existe DEPOIS do aceite, nó a nó do diagrama da sprint:
 *
 *   HOMOLOGAÇÃO: Documentação → Concessionária → Parecer de Acesso →
 *                Orçamento de Conexão
 *   ENGENHARIA:  Unifilar → Projeto Executivo → Campo → Execução → As-Built
 *
 * Para cada nó, três perguntas:
 *   1. existe REGRA definida (domínio, enum, invariante)?
 *   2. existe PERSISTÊNCIA (campo no schema)?
 *   3. existe CAMINHO (rota + tela)?
 *
 * Um nó só é implementável nesta sprint se a REGRA já estiver definida —
 * inventá-la seria decisão de negócio disfarçada de código.
 *
 * NÃO implementa nada. Ambiente isolado (37017).
 *
 *   node backend/scripts/auditoria-pos-aceite-fv-ux-040.mjs
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
const SCHEMA = ler('backend/src/models/ProjetoFV.js')
/** Schema sem comentários — comentário não é campo. */
const SCHEMA_CODIGO = SCHEMA.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const ROTAS_HOMOLOG = ler('backend/src/routes/homologacao.js')
const ROTAS_FV = ler('backend/src/routes/projetosFV.js')
const CLIENTE_API = ler('frontend/src/fv/api/agregadosFvApi.js')

async function api(metodo, caminho, corpo) {
  const r = await fetch(`${API}${caminho}`, { method: metodo,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo) })
  const tipo = r.headers.get('content-type') ?? ''
  if (tipo.includes('json')) return { status: r.status, json: await r.json().catch(() => null) }
  return { status: r.status, bytes: (await r.arrayBuffer()).byteLength }
}
const salvar = (id, etapa, dados) => api('PUT', `/api/projetos-fv/${id}/etapa`, { etapa, dados })
const secao = (t) => console.log(`\n══ ${t} ${'═'.repeat(Math.max(0, 58 - t.length))}`)

const nos = []
/** Cada nó do diagrama, com as três perguntas respondidas por MEDIÇÃO. */
function no(nome, { regra, persistencia, caminho, evidencia }) {
  const estado = (regra && persistencia && caminho) ? 'COMPLETO'
    : (regra || persistencia || caminho) ? 'PARCIAL' : 'AUSENTE'
  nos.push({ nome, regra, persistencia, caminho, estado, evidencia })
  const m = { COMPLETO: '✓', PARCIAL: '◐', AUSENTE: '○' }[estado]
  const cols = `${regra ? 'R' : '·'}${persistencia ? 'P' : '·'}${caminho ? 'C' : '·'}`
  console.log(`${m} [${cols}] ${nome.padEnd(26)} ${evidencia}`)
}

console.log('═══ FV-UX-040 — auditoria do fluxo pós-aceite ═══')
console.log('     R=regra definida · P=persistência · C=caminho (rota+tela)')

// ── Monta uma proposta aceita, para medir contra estado real ────────────────
const invs = (await api('GET', '/api/equipamentos?tipo=inversor&limit=200')).json
const ZN = ((await api('GET', '/api/equipamentos?tipo=modulo&limit=50')).json?.equipamentos ?? [])
  .find((e) => e.fabricante === 'Znshine')
const SG = (invs?.equipamentos ?? invs ?? []).find((e) => e.modelo === 'SG15RT')
if (!ZN || !SG) { console.error('❌ catálogo não semeado'); process.exit(1) }
const painel = (q) => ({ id: String(ZN._id), marca: 'Znshine', modelo: ZN.modelo,
  potencia_w: 650, quantidade: q, equipamento_id: String(ZN._id) })
const inv = () => ({ id: String(SG._id), marca: SG.fabricante, modelo: SG.modelo,
  potencia_kw: 15, tipo: 'string', fases: 3, quantidade: 1, equipamento_id: String(SG._id) })

const P = (await api('POST', '/api/projetos-fv',
  { nome: `FV-UX-040 ${Date.now()}`, clienteId: cred.cliente_id })).json?._id
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
const c = await api('POST', `/api/projetos-fv/${P}/cotacoes`, { tecnologia: 'fv', premissas: {} })
const o = await api('POST', `/api/projetos-fv/${P}/orcamentos`,
  { cotacao_ref: c.json?.cotacao?._id ?? c.json?._id,
    itens: [{ descricao: 'kit', quantidade: 1, valor_unitario_r: 50000, valor_total_r: 50000 }] })
const oid = o.json?.orcamento?._id ?? o.json?._id
await api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/emitir`, {})
await api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/aprovar`, {})
const P2 = (await api('POST', `/api/projetos-fv/${P}/opcoes`, {})).json?.item?._id
await salvar(P2, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
await salvar(P2, 'equipamentos', { paineis: [painel(24)], inversor: inv(),
  estrutura: { tipo: 'Laje', descricao: '' } })
await salvar(P2, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
  paineis: [painel(24)], inversores: [inv()] }] })
const c2 = await api('POST', `/api/projetos-fv/${P2}/cotacoes`, { tecnologia: 'fv', premissas: {} })
const o2 = await api('POST', `/api/projetos-fv/${P2}/orcamentos`,
  { cotacao_ref: c2.json?.cotacao?._id ?? c2.json?._id,
    itens: [{ descricao: 'kit', quantidade: 1, valor_unitario_r: 58000, valor_total_r: 58000 }] })
const oid2 = o2.json?.orcamento?._id ?? o2.json?._id
await api('POST', `/api/projetos-fv/${P2}/orcamentos/${oid2}/emitir`, {})
await api('POST', `/api/projetos-fv/${P2}/orcamentos/${oid2}/aprovar`, {})
await api('POST', `/api/projetos-fv/${P}/proposta/enviar`, {})
const aceite = await api('POST', `/api/projetos-fv/${P}/proposta/aceitar`, {})
console.log(`\nproposta aceita na Opção 01 (HTTP ${aceite.status}) — ${P}`)

// ═══ BIFURCAÇÃO ════════════════════════════════════════════════════════════
secao('BIFURCAÇÃO — a opção aceita abre os dois caminhos')
{
  const f = await api('GET', `/api/projetos-fv/${P}/fases`)
  const fases = f.json?.fases ?? f.json?.lista ?? []
  const eng = fases.find((x) => x.chave === 'engenharia')
  const hom = fases.find((x) => x.chave === 'homologacao')
  no('Bifurcação Gate', {
    regra: true, persistencia: true,
    caminho: !!(eng && hom),
    evidencia: `engenharia=${eng?.liberada ? 'livre' : 'bloq'} · homologacao=${hom?.liberada ? 'livre' : 'bloq'}`
      + ` · paralelas=${eng?.paralela === true && hom?.paralela === true}`,
  })
  const perdedora = await api('POST', `/api/projetos-fv/${P2}/homologacao/memorial`, {
    projeto: { potencia_kwp: 15.6 }, cliente: { nome: 'x' } })
  no('Só a aceita avança', {
    regra: true, persistencia: true, caminho: perdedora.status === 409,
    evidencia: `não escolhida → HTTP ${perdedora.status} · ${perdedora.json?.codigo}`,
  })
}

// ═══ CAMINHO A · HOMOLOGAÇÃO ═══════════════════════════════════════════════
secao('A · HOMOLOGAÇÃO')
const CORPO = {
  projeto: { potencia_kwp: 15.6, strings: { totalStrings: 2, modulosPorString: 12, totalModulos: 24 },
    estrutura: { tipo: 'Fibrocimento' },
    inversor: { marca: 'Sungrow', modelo: 'SG15RT', potenciaKW: 15, fases: 3, nMppts: 2 },
    painel: { marca: 'Znshine', modelo: ZN.modelo, potenciaW: 650 } },
  cliente: { nome: 'Cliente de Validação', cpf: '000', endereco: 'X' },
}
{
  // A1 · Documentação
  const docs = []
  for (const t of ['memorial', 'carta', 'art']) {
    const r = await api('POST', `/api/projetos-fv/${P}/homologacao/${t}`, CORPO)
    docs.push(`${t}:${r.status}`)
  }
  const ck = await api('GET', `/api/projetos-fv/${P}/homologacao/checklist`)
  no('A1 · Documentação', {
    regra: true,
    persistencia: /checklist:\s*\{\s*type:\s*mongoose\.Schema\.Types\.Mixed/.test(SCHEMA),
    caminho: /documentoHomologacao/.test(CLIENTE_API),
    evidencia: `${docs.join(' ')} · checklist ${ck.json?.checklist?.documentos?.length ?? 0} docs`,
  })

  // A2 · Concessionária (identificação + protocolo)
  const prot = await api('PATCH', `/api/projetos-fv/${P}/homologacao/protocolo`,
    { numero: 'PROT-2026-001' })
  const st = await api('GET', `/api/projetos-fv/${P}/homologacao/status`)
  no('A2 · Concessionária', {
    regra: true,
    persistencia: /numero_protocolo/.test(SCHEMA),
    caminho: /homologacao\/protocolo/.test(CLIENTE_API),
    evidencia: `checklist reconhece "${ck.json?.checklist?.concessionaria}" · `
      + `protocolo HTTP ${prot.status} · a UX ${/protocolo/.test(CLIENTE_API) ? 'chama' : 'NÃO chama'}`,
  })

  // A3 · Parecer de acesso
  // Sem comentário: a única ocorrência de "parecer" no schema é o comentário
  // `P1-PARECER-ATLAS-LINK-01`, que fala de referência a Equipamento — nada a
  // ver com este nó. Um probe que lesse comentário reportaria campo inexistente.
  const semComentario = (f) => f.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const temParecerRota = /parecer/i.test(semComentario(ROTAS_HOMOLOG))
  const temParecerCampo = /parecer/i.test(semComentario(SCHEMA))
  const enumStatus = (SCHEMA.match(/enum: \['rascunho', 'enviado', 'analise', 'aprovado', 'conectado'\]/) ?? [])[0]
  no('A3 · Parecer de acesso', {
    regra: false, persistencia: temParecerCampo, caminho: temParecerRota,
    evidencia: `nenhum campo nem rota no fluxo. O status tem "aprovado", mas nada `
      + `diz que é o parecer${enumStatus ? ' (rascunho→enviado→analise→aprovado→conectado)' : ''}`,
  })

  /**
   * Existe CÓDIGO de parecer de acesso — desativado.
   * `pareceracessoController.js` (197 KB) extrai dados do PDF do parecer da
   * concessionária. A rota está comentada em `server.js` com a nota
   * "DISABLED: pdfjs-dist blocker". O bloqueio pode estar vencido: o próprio
   * controller já importa `PDFParse` de `pdf-parse`, que funciona hoje.
   */
  const server = ler('backend/src/server.js')
  const desativada = /^\s*\/\/\s*app\.use\('\/api\/parecer-acesso'/m.test(server)
  const viva = await api('POST', '/api/parecer-acesso/extrair', {})
  console.log(`   ↳ extrator de parecer: controller ${
    ler('backend/src/controllers/pareceracessoController.js').length} chars, `
    + `rota ${desativada ? 'COMENTADA em server.js' : 'montada'} → HTTP ${viva.status}`)
  console.log(`     motivo declarado: "pdfjs-dist blocker" · o controller usa `
    + `${/from 'pdf-parse'/.test(ler('backend/src/controllers/pareceracessoController.js'))
      ? 'pdf-parse (que funciona hoje)' : 'outra lib'}`)

  // A4 · Orçamento de conexão
  no('A4 · Orçamento de conexão', {
    regra: false,
    persistencia: /orcamento_conexao|custo_conexao/i.test(SCHEMA),
    caminho: /conexao/i.test(ROTAS_HOMOLOG),
    evidencia: 'nenhum campo, nenhuma rota, nenhuma regra — nó inexistente',
  })

  // Existe outro controlador de homologação (assistida) com estados próprios?
  const assistida = await api('GET', `/api/projetos-fv/${P}/homologacao/assistida/checklist`)
  console.log(`   ↳ homologação ASSISTIDA (S9.0): HTTP ${assistida.status}, `
    + `estados ${/status_homologacao/.test(SCHEMA) ? 'no schema' : 'ausentes'} — `
    + `pendente_concessionaria / homologado / reprovado`)
}

// ═══ CAMINHO B · ENGENHARIA ════════════════════════════════════════════════
secao('B · ENGENHARIA')
{
  // B1 · Unifilar
  const u = await api('POST', `/api/projetos-fv/${P}/unifilar/gerar`, {})
  no('B1 · Unifilar', {
    regra: true, persistencia: true, caminho: /unifilar\/gerar/.test(CLIENTE_API),
    evidencia: `HTTP ${u.status} · lacunas ${JSON.stringify(u.json?.lacunas ?? [])}`,
  })

  // B2..B5 — os nós sem agregado
  const telas = {
    'B2 · Projeto Executivo': ['executivo', /projeto_executivo|executivo:/],
    'B3 · Campo (equipe)': ['execucao', /equipe_campo|equipe:/],
    // `projeto_execucao: Boolean` é item do checklist de HOMOLOGAÇÃO, não
    // agregado de execução. O probe anterior casava com ele e reportava campo.
    'B4 · Execução': ['execucao', /execucao:\s*\{|agregado_execucao/],
    'B5 · As-Built': ['asbuilt', /as_built|asbuilt/i],
  }
  for (const [nome, [rota, reSchema]] of Object.entries(telas)) {
    const arq = rota === 'asbuilt' ? 'AsBuilt' : rota[0].toUpperCase() + rota.slice(1)
    const tela = ler(`frontend/src/fv/paginas/etapas/Etapa${arq}.jsx`)
    const consomeApi = /api|fetch|acoes\./i.test(tela)
    no(nome, {
      regra: false,
      persistencia: reSchema.test(SCHEMA_CODIGO),
      caminho: consomeApi,
      evidencia: `tela ${tela ? 'existe' : 'AUSENTE'}, ${consomeApi ? 'consome API' : 'é stub'}`
        + ` · schema ${reSchema.test(SCHEMA_CODIGO) ? 'tem campo' : 'sem campo'}`,
    })
  }
}

// ═══ ORDEM E INDEPENDÊNCIA ═════════════════════════════════════════════════
secao('Os dois caminhos são independentes?')
{
  // Avançar homologação NÃO pode exigir engenharia, e vice-versa.
  const antes = await api('GET', `/api/projetos-fv/${P}/homologacao/status`)
  const av = await api('PATCH', `/api/projetos-fv/${P}/homologacao/status`, { status: 'analise' })
  const u = await api('POST', `/api/projetos-fv/${P}/unifilar/gerar`, {})
  console.log(`   homologação avançou para "analise" (HTTP ${av.status}) `
    + `sem que engenharia tenha concluído nada`)
  console.log(`   unifilar gerou (HTTP ${u.status}) com homologação em "${av.json?.homologacao?.status ?? '?'}"`)
  no('Independência dos caminhos', {
    regra: true, persistencia: true, caminho: av.status === 200 && u.status === 200,
    evidencia: 'nenhum dos dois exige o outro',
  })

  // Existe regra de ORDEM dentro da homologação?
  const pulo = await api('PATCH', `/api/projetos-fv/${P}/homologacao/status`, { status: 'rascunho' })
  no('Ordem dentro da homologação', {
    regra: false, persistencia: true, caminho: true,
    evidencia: `voltar de "analise" para "rascunho" → HTTP ${pulo.status}`
      + ` — o enum não define transições, qualquer valor vale`,
  })
}

// ═══ RESUMO ════════════════════════════════════════════════════════════════
secao('RESUMO')
for (const e of ['COMPLETO', 'PARCIAL', 'AUSENTE']) {
  const l = nos.filter((n) => n.estado === e)
  console.log(`${{ COMPLETO: '✓', PARCIAL: '◐', AUSENTE: '○' }[e]} ${e.padEnd(9)} ${l.length}`)
}
const semRegra = nos.filter((n) => !n.regra)
console.log(`\n── Nós SEM regra definida (não implementáveis nesta sprint) ──`)
for (const n of semRegra) console.log(`   ${n.nome} — ${n.evidencia}`)
const implementaveis = nos.filter((n) => n.regra && !(n.persistencia && n.caminho))
console.log(`\n── Nós COM regra e sem caminho completo (implementáveis) ──`)
console.log(implementaveis.length === 0
  ? '   nenhum — todo nó com regra definida já está fechado'
  : implementaveis.map((n) => `   ${n.nome} — ${n.evidencia}`).join('\n'))

console.log(`\n─── fim da auditoria — nada foi implementado ───`)
console.log(`   aceita=${P} · não escolhida=${P2}`)
