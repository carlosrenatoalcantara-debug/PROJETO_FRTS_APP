/**
 * validacao-fv-dom-047.mjs — FV-DOM-047
 *
 * Prova o que a conexão FAZ e, sobretudo, o que ela **não faz** — que é onde
 * estão as decisões das FV-DOM-044/045/046:
 *
 *   1. o fato é registrado, corrigido e removido; a data é a máquina inteira;
 *   2. `numero_medidor` é opcional → lacuna declarada, nunca bloqueio;
 *   3. NÃO altera `projeto.status`, Gate nem Baseline;
 *   4. NÃO exige `homologado` — declara divergência em vez de impedir;
 *   5. a divergência é DERIVADA, nunca persistida (INV-58);
 *   6. a opção NÃO escolhida não registra conexão (FV-DOM-032 regra 5);
 *   7. o legado `homologacao.status = 'conectado'` fica intocado;
 *   8. toda escrita é AUDITADA — o defeito que a máquina A tem.
 *
 * Ambiente isolado (37017), backend com SMTP_USER="" SMTP_PASS="".
 *
 *   node backend/scripts/validacao-fv-dom-047.mjs
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
  return { status: r.status, json: await r.json().catch(() => null) }
}
const salvar = (id, etapa, dados) => api('PUT', `/api/projetos-fv/${id}/etapa`, { etapa, dados })

console.log('═══ FV-DOM-047 — conexão física da usina ═══')

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

async function aprovar(P, valor) {
  const c = await api('POST', `/api/projetos-fv/${P}/cotacoes`, { tecnologia: 'fv', premissas: {} })
  const o = await api('POST', `/api/projetos-fv/${P}/orcamentos`,
    { cotacao_ref: c.json?.cotacao?._id ?? c.json?._id,
      itens: [{ descricao: 'kit', quantidade: 1, valor_unitario_r: valor, valor_total_r: valor }] })
  const oid = o.json?.orcamento?._id ?? o.json?._id
  await api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/emitir`, {})
  return api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/aprovar`, {})
}
async function montar(nome) {
  const P = (await api('POST', '/api/projetos-fv',
    { nome: `${nome} ${Date.now()}`, clienteId: cred.cliente_id })).json?._id
  await salvar(P, 'fatura', { tipo_ligacao: 'Trifásico', tensao_v: 380, concessionaria: 'Cosern' })
  await salvar(P, 'localizacao', { estado: 'RN' })
  await salvar(P, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
  await salvar(P, 'equipamentos', { paineis: [painel(24)], inversor: inv(),
    estrutura: { tipo: 'Fibrocimento', descricao: '' } })
  await salvar(P, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
    paineis: [painel(24)], inversores: [inv()] }] })
  return P
}

// ═══ 1 · O fato ════════════════════════════════════════════════════════════
secao('1 · Registrar, corrigir, remover')
const P = await montar('FV-DOM-047')
{
  const vazio = await api('GET', `/api/projetos-fv/${P}/conexao`)
  ok(vazio.json?.conectada === false, `começa não conectada (conectada=${vazio.json?.conectada})`)
  ok(vazio.json?.conexao?.conectada_em === null, '`conectada_em` = null é a única forma de "não conectada"')
  ok((vazio.json?.lacunas ?? []).includes('conexao.conectada_em'), 'lacuna declarada')

  const r = await api('PUT', `/api/projetos-fv/${P}/conexao`,
    { conectada_em: '2026-05-14', numero_medidor: 'MED-77123' })
  ok(r.status === 200 && r.json?.conectada === true, `registra → HTTP ${r.status}`)
  ok(String(r.json?.conexao?.conectada_em).startsWith('2026-05-14'),
    `data gravada: ${r.json?.conexao?.conectada_em}`)
  ok(r.json?.conexao?.numero_medidor === 'MED-77123', 'medidor gravado')

  const corrige = await api('PUT', `/api/projetos-fv/${P}/conexao`,
    { conectada_em: '2026-05-12', numero_medidor: 'MED-77123' })
  ok(String(corrige.json?.conexao?.conectada_em).startsWith('2026-05-12'),
    'corrigir a data corrige o MESMO fato — não cria segunda conexão')

  const rem = await api('DELETE', `/api/projetos-fv/${P}/conexao`)
  ok(rem.json?.conectada === false, 'remover desfaz o lançamento')
  await api('PUT', `/api/projetos-fv/${P}/conexao`, { conectada_em: '2026-05-12' })
}

// ═══ 2 · Data é o único obrigatório ════════════════════════════════════════
secao('2 · A data é o fato; medidor é opcional')
{
  const Q = await montar('FV-DOM-047 medidor')
  const semMedidor = await api('PUT', `/api/projetos-fv/${Q}/conexao`,
    { conectada_em: '2026-05-14' })
  ok(semMedidor.status === 200, `sem medidor → HTTP ${semMedidor.status} (não bloqueia)`)
  ok((semMedidor.json?.lacunas ?? []).includes('conexao.numero_medidor'),
    'medidor ausente vira LACUNA declarada')

  const semData = await api('PUT', `/api/projetos-fv/${Q}/conexao`, { numero_medidor: 'X' })
  ok(semData.status === 400 && semData.json?.codigo === 'SEM_DATA',
    `sem data → HTTP ${semData.status} · ${semData.json?.codigo}`)
  const dataMa = await api('PUT', `/api/projetos-fv/${Q}/conexao`, { conectada_em: 'ontem' })
  ok(dataMa.json?.codigo === 'DATA_INVALIDA', `data ilegível → ${dataMa.json?.codigo}`)
  const futuro = await api('PUT', `/api/projetos-fv/${Q}/conexao`, { conectada_em: '2099-01-01' })
  ok(futuro.json?.codigo === 'DATA_NO_FUTURO', `data no futuro → ${futuro.json?.codigo}`)
}

// ═══ 3 · ZERO efeito colateral ═════════════════════════════════════════════
secao('3 · Não altera projeto.status, Gate nem Baseline')
{
  const R = await montar('FV-DOM-047 efeitos')
  await aprovar(R, 50000)
  const antesP = (await api('GET', `/api/projetos-fv/${R}`)).json
  const statusAntes = (antesP?.projeto ?? antesP)?.status
  const baseAntes = (await api('GET', `/api/projetos-fv/${R}/baseline`)).json?.baseline?.hash
  const gateAntes = (await api('GET', `/api/projetos-fv/${R}/gate`)).json

  await api('PUT', `/api/projetos-fv/${R}/conexao`, { conectada_em: '2026-05-14' })

  const depoisP = (await api('GET', `/api/projetos-fv/${R}`)).json
  const statusDepois = (depoisP?.projeto ?? depoisP)?.status
  const baseDepois = (await api('GET', `/api/projetos-fv/${R}/baseline`)).json?.baseline?.hash
  const gateDepois = (await api('GET', `/api/projetos-fv/${R}/gate`)).json

  ok(statusAntes === statusDepois,
    `projeto.status inalterado: "${statusAntes}" → "${statusDepois}"`)
  ok(statusDepois !== 'concluido' && statusDepois !== 'em_execucao',
    'conexão NÃO encerra nem inicia execução')
  ok(baseAntes === baseDepois, `Baseline com o mesmo hash: ${String(baseAntes).slice(0, 12)}`)
  ok(JSON.stringify(gateAntes) === JSON.stringify(gateDepois), 'Gate byte a byte igual')

  const fonte = ler('backend/src/dominio/conexao/index.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  ok(!/projeto\.status|Baseline|avaliarGate/.test(fonte),
    'o domínio da conexão não menciona status do projeto, Baseline nem Gate')
}

// ═══ 4 · Homologação: recomendação, não bloqueio ═══════════════════════════
secao('4 · Não exige `homologado` — declara divergência')
{
  const S = await montar('FV-DOM-047 divergencia')
  const semHomolog = await api('PUT', `/api/projetos-fv/${S}/conexao`,
    { conectada_em: '2026-05-14' })
  ok(semHomolog.status === 200, `conecta sem homologação → HTTP ${semHomolog.status}`)
  ok(semHomolog.json?.divergencia?.divergente === true,
    `divergência DECLARADA: "${semHomolog.json?.divergencia?.motivo}"`)

  // O caso crítico da FV-DOM-040, agora explicitado em vez de silencioso.
  await aprovar(S, 50000)
  const S2 = (await api('POST', `/api/projetos-fv/${S}/opcoes`, {})).json?.item?._id
  await salvar(S2, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
  await salvar(S2, 'equipamentos', { paineis: [painel(24)], inversor: inv(),
    estrutura: { tipo: 'Laje', descricao: '' } })
  await salvar(S2, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
    paineis: [painel(24)], inversores: [inv()] }] })
  await aprovar(S2, 58000)
  await api('POST', `/api/projetos-fv/${S}/proposta/enviar`, {})
  await api('POST', `/api/projetos-fv/${S}/proposta/aceitar`, {})
  await api('PATCH', `/api/projetos-fv/${S}/homologacao/assistida/status`,
    { status: 'reprovado', motivo: 'documentação incompleta' })

  const critico = await api('GET', `/api/projetos-fv/${S}/conexao`)
  ok(critico.json?.divergencia?.divergente === true
    && /REPROVADA/.test(critico.json?.divergencia?.motivo ?? ''),
  `conectada + reprovada agora é DECLARADA: "${critico.json?.divergencia?.motivo}"`)

  // E é DERIVADA — não existe campo persistido.
  const p = (await api('GET', `/api/projetos-fv/${S}`)).json
  const conexao = (p?.projeto ?? p)?.conexao ?? {}
  ok(!('sem_homologacao' in conexao) && !('divergente' in conexao),
    `a divergência NÃO é persistida (campos: ${Object.keys(conexao).join(', ')})`)
  ok(Object.keys(conexao).length === 3,
    'exatamente 3 campos, como o contrato especifica')

  // Homologado → sem divergência.
  await api('PATCH', `/api/projetos-fv/${S}/homologacao/assistida/status`,
    { status: 'homologado' })
  const okHomolog = await api('GET', `/api/projetos-fv/${S}/conexao`)
  ok(okHomolog.json?.divergencia?.divergente === false, 'homologado → sem divergência')
}

// ═══ 5 · Regra 5 da FV-DOM-032 ═════════════════════════════════════════════
secao('5 · A opção NÃO escolhida não registra conexão')
{
  const T = await montar('FV-DOM-047 opcoes')
  await aprovar(T, 50000)
  const T2 = (await api('POST', `/api/projetos-fv/${T}/opcoes`, {})).json?.item?._id
  await salvar(T2, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
  await salvar(T2, 'equipamentos', { paineis: [painel(24)], inversor: inv(),
    estrutura: { tipo: 'Laje', descricao: '' } })
  await salvar(T2, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
    paineis: [painel(24)], inversores: [inv()] }] })
  await aprovar(T2, 58000)

  // Antes do aceite ninguém foi escolhido — nada bloqueia.
  const antesAceite = await api('PUT', `/api/projetos-fv/${T2}/conexao`,
    { conectada_em: '2026-05-14' })
  ok(antesAceite.status === 200, `sem escolha feita, não bloqueia (HTTP ${antesAceite.status})`)
  await api('DELETE', `/api/projetos-fv/${T2}/conexao`)

  await api('POST', `/api/projetos-fv/${T}/proposta/enviar`, {})
  await api('POST', `/api/projetos-fv/${T}/proposta/aceitar`, {})

  const perdedora = await api('PUT', `/api/projetos-fv/${T2}/conexao`,
    { conectada_em: '2026-05-14' })
  ok(perdedora.status === 409 && perdedora.json?.codigo === 'OPCAO_NAO_ESCOLHIDA',
    `opção não escolhida → HTTP ${perdedora.status} · ${perdedora.json?.codigo}`)
  const aceita = await api('PUT', `/api/projetos-fv/${T}/conexao`, { conectada_em: '2026-05-14' })
  ok(aceita.status === 200, `a opção ACEITA registra → HTTP ${aceita.status}`)
  const consulta = await api('GET', `/api/projetos-fv/${T2}/conexao`)
  ok(consulta.status === 200, 'e CONSULTAR a não escolhida segue liberado (regra 9)')
}

// ═══ 6 · Legado intocado ═══════════════════════════════════════════════════
secao('6 · `homologacao.status = conectado` permanece histórico')
{
  const U = await montar('FV-DOM-047 legado')
  await aprovar(U, 50000)
  await api('PATCH', `/api/projetos-fv/${U}/homologacao/status`, { status: 'conectado' })

  const c = await api('GET', `/api/projetos-fv/${U}/conexao`)
  ok(c.json?.conectada === false,
    'o valor legado NÃO é interpretado como conexão — nenhum backfill')
  ok(c.json?.legado_conectado === true, 'mas é EXIBIDO como registro histórico')

  await api('PUT', `/api/projetos-fv/${U}/conexao`, { conectada_em: '2026-05-14' })
  const p = (await api('GET', `/api/projetos-fv/${U}`)).json
  ok((p?.projeto ?? p)?.homologacao?.status === 'conectado',
    'e registrar conexão não apaga nem converte o legado')
}

// ═══ 7 · Auditoria obrigatória ═════════════════════════════════════════════
secao('7 · Toda escrita é auditada — o defeito da máquina A')
{
  const ctrl = ler('backend/src/controllers/projetosFVController.js')
  const bloco = ctrl.slice(ctrl.indexOf('export const registrarConexaoFV'),
    ctrl.indexOf('export const removerConexaoFV'))
  ok(/auditarCiclo\(req, antes \? 'CONEXAO_CORRIGIDA' : 'CONEXAO_REGISTRADA'/.test(bloco),
    'registrar audita, distinguindo registro de correção')
  const blocoRem = ctrl.slice(ctrl.indexOf('export const removerConexaoFV'))
  ok(/auditarCiclo\(req, 'CONEXAO_REMOVIDA'/.test(blocoRem), 'remover audita')

  /**
   * Medição real no AuditLog. A primeira versão desta asserção terminava em
   * `|| true` — passava sempre e não media nada. Guard vazio é pior que guard
   * ausente, porque parece cobertura.
   *
   * `auditarCiclo` grava o detalhe em `path`, não num campo `detalhe`.
   */
  const { MongoClient } = await import('mongodb')
  const cli = await MongoClient.connect(cred.uri.replace(/\/[^/]*$/, ''))
  try {
    const col = cli.db('forte_solar_validacao').collection('auditlogs')
    const registros = await col.find({ acao: { $regex: '^CONEXAO_' } }).toArray()
    ok(registros.length > 0, `${registros.length} entradas CONEXAO_* no AuditLog`)
    ok(registros.every((r) => !!r.usuario && r.usuario !== 'anonymous'),
      `todas com autor identificado (ex.: ${registros[0]?.usuario})`)
    ok(registros.some((r) => r.acao === 'CONEXAO_REGISTRADA')
      && registros.some((r) => r.acao === 'CONEXAO_CORRIGIDA')
      && registros.some((r) => r.acao === 'CONEXAO_REMOVIDA'),
    'os três atos aparecem distinguidos')
    const corrigida = registros.find((r) => r.acao === 'CONEXAO_CORRIGIDA')
    ok(/→/.test(corrigida?.path ?? ''),
      `a correção guarda a transição: "${(corrigida?.path ?? '').split(' ').slice(1).join(' ')}"`)
  } finally { await cli.close() }
  console.log('   ⇒ é o que substitui `registrada_por`: o autor vive no AuditLog,')
  console.log('     e foi por não auditar que a máquina A perdeu autor e data.')
}

// ═══ 8 · Contrato ══════════════════════════════════════════════════════════
secao('8 · O contrato tem exatamente os campos decididos')
{
  const schema = ler('backend/src/models/ProjetoFV.js')
  const bloco = schema.slice(schema.indexOf('conexao: {'), schema.indexOf('conexao: {') + 320)
  for (const campo of ['conectada_em', 'numero_medidor', 'observacoes']) {
    ok(bloco.includes(campo), `campo \`${campo}\``)
  }
  for (const ausente of ['registrada_por', 'sem_homologacao', 'estado', 'enum']) {
    ok(!bloco.includes(ausente), `SEM \`${ausente}\``)
  }
}

console.log(falhas === 0
  ? '\nOK — conexão é fato: registrada, sem efeito colateral e sem inventar regra.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
