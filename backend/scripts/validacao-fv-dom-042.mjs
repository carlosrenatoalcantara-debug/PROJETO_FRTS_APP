/**
 * validacao-fv-dom-042.mjs — FV-DOM-042
 *
 * Prova as sete decisões, cada uma pela API e pelo domínio:
 *
 *   D1 · identidade e estado (extraido × confirmado)
 *   D2 · pertence a projeto existente; não cria cliente nem projeto
 *   D3 · GD I vira lacuna, não conversão, e o enum não muda
 *   D4 · nada é sobrescrito; divergência vira conflito declarado
 *   D5 · nenhum provedor externo sem configuração explícita
 *   D6 · nenhuma coleta para treino
 *   D7 · envelope próprio; `fatura_extracao` intacta
 *
 * Ambiente isolado (37017), backend com SMTP_USER="" SMTP_PASS="".
 *
 *   node backend/scripts/validacao-fv-dom-042.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
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
const api = async (metodo, caminho, corpo) => {
  const r = await fetch(`${API}${caminho}`, { method: metodo,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo) })
  return { status: r.status, json: await r.json().catch(() => null) }
}
const salvar = (id, etapa, dados) => api('PUT', `/api/projetos-fv/${id}/etapa`, { etapa, dados })

console.log('═══ FV-DOM-042 — Parecer de Acesso ═══')

/** Extração de exemplo — 24 × 650 W + 8 microinversores, o cenário da casa. */
const EXTRACAO = {
  numero_parecer: '2409118802',
  emitido_em: '2026-03-11',
  cliente: { nome: 'JOÃO SILVA DOS SANTOS', cpf_cnpj: '123.456.789-10',
    email: null, endereco: 'RUA PRINCIPAL, 123, NATAL - RN' },
  uc: { numero_cliente: '2409118802', distribuidora: 'Neoenergia',
    tipo_ligacao: 'Monofásico', tensao_v: 220, grupo_tarifario: 'B',
    modalidade_gd: 'GD II', potencia_contratada_kw: 11 },
  geracao: {
    modulos: [{ marca: 'Znshine', modelo: 'ZXM7-UHLD144-650/M', potencia_w: 650, quantidade: 24 }],
    inversores: [{ marca: 'Hoymiles', modelo: 'HMS-2000-4T', potencia_kw: 2, quantidade: 8 }],
    potencia_instalada_kwp: 15.6,
  },
}

async function novoProjeto(nome) {
  const P = (await api('POST', '/api/projetos-fv',
    { nome: `${nome} ${Date.now()}`, clienteId: cred.cliente_id })).json?._id
  await salvar(P, 'fatura', { tipo_ligacao: 'Trifásico', tensao_v: 380, concessionaria: 'Cosern' })
  return P
}

// ═══ D2 · Pertence a projeto existente ═════════════════════════════════════
secao('D2 · O parecer pertence a um projeto que já existe')
const P = await novoProjeto('FV-DOM-042')
{
  const antes = (await api('GET', '/api/clientes?limit=200')).json
  const nAntes = (antes?.clientes ?? antes?.itens ?? antes ?? []).length

  const r = await api('POST', `/api/projetos-fv/${P}/parecer`,
    { metodo: 'manual', dados: EXTRACAO })
  ok(r.status === 200, `registra no projeto existente → HTTP ${r.status}`)

  const depois = (await api('GET', '/api/clientes?limit=200')).json
  const nDepois = (depois?.clientes ?? depois?.itens ?? depois ?? []).length
  ok(nAntes === nDepois, `nenhum cliente foi criado (${nAntes} → ${nDepois})`)

  const inexistente = await api('POST', '/api/projetos-fv/000000000000000000000123/parecer',
    { metodo: 'manual', dados: EXTRACAO })
  ok(inexistente.status === 404, `projeto inexistente → HTTP ${inexistente.status} (não cria)`)
}

// ═══ D1 · Identidade e estado ══════════════════════════════════════════════
secao('D1 · Identidade própria e estado do documento')
{
  const g = await api('GET', `/api/projetos-fv/${P}/parecer`)
  ok(g.json?.numero_parecer === '2409118802', `numero_parecer: ${g.json?.numero_parecer}`)
  ok(String(g.json?.emitido_em ?? '').startsWith('2026-03-11'), `emitido_em: ${g.json?.emitido_em}`)
  ok(g.json?.estado === 'extraido', `estado inicial: ${g.json?.estado}`)
  ok(g.json?.confirmado === false, 'documento extraído ≠ parecer confirmado')

  const c = await api('POST', `/api/projetos-fv/${P}/parecer/confirmar`, {})
  ok(c.status === 200 && c.json?.estado === 'confirmado',
    `confirmação humana → estado ${c.json?.estado}`)
  ok(!!c.json?.confirmado_por, `registra quem confirmou: ${c.json?.confirmado_por}`)
  ok(c.json?.aplicado_ao_projeto === false,
    'confirmar NÃO move dado para o projeto — isso segue sendo ato explícito')

  const dupla = await api('POST', `/api/projetos-fv/${P}/parecer/confirmar`, {})
  ok(dupla.status === 409 && dupla.json?.codigo === 'JA_CONFIRMADO',
    `confirmar de novo → HTTP ${dupla.status} · ${dupla.json?.codigo}`)

  const sobrescrever = await api('POST', `/api/projetos-fv/${P}/parecer`,
    { metodo: 'manual', dados: EXTRACAO })
  ok(sobrescrever.status === 409,
    `registrar por cima de um confirmado → HTTP ${sobrescrever.status}`)
}

// ═══ D4 · Nada sobrescrito; conflito declarado ═════════════════════════════
secao('D4 · Precedência: conflito é declarado, não resolvido')
{
  const Q = await novoProjeto('FV-DOM-042 conflito')
  // A fatura já afirmou Trifásico/380/Cosern; o parecer diz Monofásico/220/Neoenergia.
  const r = await api('POST', `/api/projetos-fv/${Q}/parecer`,
    { metodo: 'manual', dados: EXTRACAO })
  const comp = r.json?.comparacao
  ok(comp?.tem_conflito === true, `conflito detectado: ${comp?.conflitos?.length} campo(s)`)
  const campos = (comp?.conflitos ?? []).map((c) => c.campo)
  for (const c of ['uc.tipo_ligacao', 'uc.tensao_v', 'documento.distribuidora']) {
    ok(campos.includes(c), `  ↳ ${c} declarado como conflito`)
  }
  ok((comp?.novos ?? []).length > 0, `campos NOVOS (projeto não tinha): ${comp.novos.length}`)

  // E o canônico não foi tocado.
  const p = (await api('GET', `/api/projetos-fv/${Q}`)).json
  const proj = p?.projeto ?? p
  ok(proj?.fatura_extracao?.tipo_ligacao === 'Trifásico',
    `fatura_extracao.tipo_ligacao intacto: ${proj?.fatura_extracao?.tipo_ligacao}`)
  ok(proj?.fatura_extracao?.tensao_v === 380,
    `fatura_extracao.tensao_v intacto: ${proj?.fatura_extracao?.tensao_v}`)
  ok(proj?.fatura_extracao?.concessionaria === 'Cosern',
    `concessionária intacta: ${proj?.fatura_extracao?.concessionaria}`)
  ok(!proj?.equipamentos?.paineis?.length,
    'nada foi escrito em `equipamentos` a partir do parecer')
  ok(!proj?.arranjos?.length, 'nada foi escrito em `arranjos`')
}

// ═══ D3 · GD I ═════════════════════════════════════════════════════════════
secao('D3 · GD I vira lacuna, não conversão')
{
  const R = await novoProjeto('FV-DOM-042 gd1')
  const r = await api('POST', `/api/projetos-fv/${R}/parecer`, { metodo: 'manual',
    dados: { ...EXTRACAO, uc: { ...EXTRACAO.uc, modalidade_gd: 'GD I' } } })
  ok(r.status === 200, `parecer com GD I é aceito → HTTP ${r.status}`)
  ok(r.json?.dados?.uc?.modalidade_gd === 'GD I',
    `valor PRESERVADO como veio: "${r.json?.dados?.uc?.modalidade_gd}"`)
  ok(r.json?.dados?.uc?.modalidade_gd_aceita === false, 'marcado como fora do domínio')
  ok((r.json?.validacao?.lacunas ?? []).some((l) => l.includes('modalidade_gd')),
    'lacuna declarada')
  ok(!(r.json?.validacao?.bloqueios ?? []).some((b) => /GD/.test(b)),
    'e NÃO bloqueia — o documento diz o que diz')

  const schema = ler('backend/src/models/ProjetoFV.js')
  ok(/enum: \['GD II', 'GD III'\]/.test(schema),
    'o enum `unidades_consumidoras[].regra` NÃO foi ampliado')
}

// ═══ D5 · Provedor externo ═════════════════════════════════════════════════
secao('D5 · Nenhum provedor externo sem configuração explícita')
{
  const S = await novoProjeto('FV-DOM-042 llm')
  const r = await api('POST', `/api/projetos-fv/${S}/parecer`,
    { metodo: 'llm_externo', dados: EXTRACAO })
  ok(r.status === 501 && r.json?.codigo === 'PROVEDOR_NAO_CONFIGURADO',
    `llm_externo sem configuração → HTTP ${r.status} · ${r.json?.codigo}`)
  ok(/Nenhum documento foi enviado/.test(r.json?.erro ?? ''),
    'e a mensagem diz que nada saiu daqui')

  const g = await api('GET', `/api/projetos-fv/${S}/parecer`)
  ok(g.json?.registrado === false, 'nada foi gravado')

  const invalido = await api('POST', `/api/projetos-fv/${S}/parecer`,
    { metodo: 'gemini_vision', dados: EXTRACAO })
  ok(invalido.status === 400 && invalido.json?.codigo === 'METODO_INVALIDO',
    `método desconhecido → HTTP ${invalido.status} · ${invalido.json?.codigo}`)

  // Nenhuma credencial é descoberta: o domínio não lê env de chave nenhuma.
  const dominio = ler('backend/src/dominio/parecer/index.js')
  ok(!/process\.env/.test(dominio), 'o domínio não lê variável de ambiente alguma')
  ok(!/GoogleGenerativeAI|API_KEY/.test(dominio), 'nem conhece provedor ou chave')
}

// ═══ D6 · Treino ═══════════════════════════════════════════════════════════
secao('D6 · Nenhuma coleta para treino')
{
  const ctrl = ler('backend/src/controllers/projetosFVController.js')
  const dominio = ler('backend/src/dominio/parecer/index.js')
  for (const [rot, fonte] of [['domínio', dominio], ['controller', ctrl]]) {
    ok(!/trainingDataCollector|adicionarExemploTreinamento/.test(fonte),
      `${rot} não chama o coletor legado`)
  }
  ok(!existsSync(path.resolve(APP, 'backend/data/training-data')),
    'nenhum diretório de treino foi criado')
  const server = ler('backend/src/server.js')
  ok(/^\s*\/\/\s*app\.use\('\/api\/parecer-acesso'/m.test(server),
    'a rota legada continua COMENTADA — não foi reativada')
}

// ═══ D7 · Envelope próprio ═════════════════════════════════════════════════
secao('D7 · `parecer_extracao` é irmão de `fatura_extracao`')
{
  const schema = ler('backend/src/models/ProjetoFV.js')
  ok(/parecer_extracao:\s*\{/.test(schema), 'campo `parecer_extracao` existe')
  ok(/fatura_extracao:\s*\{/.test(schema), 'e `fatura_extracao` continua existindo')
  for (const campo of ['metodo', 'confianca', 'confirmado_pelo_usuario']) {
    const bloco = schema.slice(schema.indexOf('parecer_extracao:'),
      schema.indexOf('parecer_extracao:') + 2400)
    ok(bloco.includes(campo), `  ↳ mesmo padrão conceitual: ${campo}`)
  }
  const p = (await api('GET', `/api/projetos-fv/${P}`)).json
  const proj = p?.projeto ?? p
  ok(!!proj?.parecer_extracao?.estado, 'o envelope persiste')
  ok(proj?.fatura_extracao?.tipo_ligacao === 'Trifásico',
    'e a fatura do mesmo projeto segue com o SEU dado — origens separadas')
}

// ═══ Normalização e validação ══════════════════════════════════════════════
secao('Contrato: normalização sem default, validação em três níveis')
{
  const T = await novoProjeto('FV-DOM-042 lacunas')
  // Só o mínimo: identificação + um módulo. Todo o resto ausente.
  const r = await api('POST', `/api/projetos-fv/${T}/parecer`, { metodo: 'manual',
    dados: { cliente: { cpf_cnpj: '123.456.789-10' },
      geracao: { modulos: [{ marca: 'Znshine', modelo: 'ZXM7', quantidade: 10 }] } } })
  ok(r.status === 200, `extração mínima é aproveitável → HTTP ${r.status}`)
  const d = r.json?.dados
  ok(d?.uc?.tipo_ligacao === null, 'tipo_ligacao ausente → null (o legado punha "Monofásico")')
  ok(d?.uc?.tensao_v === null, 'tensao_v ausente → null (o legado punha 220)')
  ok(d?.uc?.modalidade_gd === null, 'modalidade_gd ausente → null (o legado punha "GD II")')
  ok(d?.cliente?.email === null, 'e-mail ausente → null, NUNCA sintetizado')
  ok(Array.isArray(d?.geracao?.inversores), '`inversores` é lista mesmo vazia')
  ok((r.json?.validacao?.lacunas ?? []).length > 5,
    `${r.json?.validacao?.lacunas?.length} lacunas nomeadas`)
  ok(r.json?.validacao?.taxa_completude === undefined,
    'sem "taxa de completude" — o contrato a descartou')

  // Impeditivo
  const U = await novoProjeto('FV-DOM-042 impeditivo')
  const vazio = await api('POST', `/api/projetos-fv/${U}/parecer`,
    { metodo: 'manual', dados: { cliente: { nome: 'X' } } })
  ok(vazio.status === 400 && vazio.json?.codigo === 'EXTRACAO_INVALIDA',
    `sem identificação nem geração → HTTP ${vazio.status} · ${vazio.json?.codigo}`)

  // Bloqueio: quantidade ausente impede CONFIRMAR, mas não impede registrar.
  const V = await novoProjeto('FV-DOM-042 bloqueio')
  const b = await api('POST', `/api/projetos-fv/${V}/parecer`, { metodo: 'manual',
    dados: { cliente: { cpf_cnpj: '123.456.789-10' },
      geracao: { modulos: [{ marca: 'Znshine', modelo: 'ZXM7' }] } } })
  ok(b.status === 200 && b.json?.validacao?.confirmavel === false,
    `quantidade ausente: registra mas não é confirmável (${b.json?.validacao?.bloqueios?.[0]})`)
  const cb = await api('POST', `/api/projetos-fv/${V}/parecer/confirmar`, {})
  ok(cb.status === 400, `e a confirmação é recusada → HTTP ${cb.status}`)

  // Coerência potência × soma dos módulos
  const W = await novoProjeto('FV-DOM-042 coerencia')
  const inc = await api('POST', `/api/projetos-fv/${W}/parecer`, { metodo: 'manual',
    dados: { ...EXTRACAO, geracao: { ...EXTRACAO.geracao, potencia_instalada_kwp: 30 } } })
  ok((inc.json?.validacao?.bloqueios ?? []).some((x) => /diverge/.test(x)),
    `potência incoerente vira bloqueio: ${inc.json?.validacao?.bloqueios?.[0]}`)
}

console.log(falhas === 0
  ? '\nOK — D1 a D7 implementadas; o parecer informa e não decide nada sozinho.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
