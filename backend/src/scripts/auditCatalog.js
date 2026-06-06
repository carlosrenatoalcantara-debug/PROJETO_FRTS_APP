/**
 * auditCatalog.js — P1-CATALOG-AUDIT-01
 *
 * AUDITORIA 100% READ-ONLY do catálogo de inversores. NÃO escreve no banco, NÃO
 * altera SSOT/parser/OCR/schema, NÃO migra, NÃO cria flags. Apenas LÊ e MEDE.
 *
 * Fonte de dados (nesta ordem, read-only):
 *   1) MongoDB (MONGODB_URI) — collection `equipamentos`
 *   2) fallback: data/memory-storage.json (quando USE_MEMORY_STORAGE=true ou Mongo
 *      indisponível) — espelha o comportamento de runtime do app.
 *
 * Interpretação canônica de cada documento via SSOT `lerInversor` (read-only):
 * mapeia dialetos legados (vpv_max→tensao_max_entrada…) e DERIVA tipo_topologia /
 * entradas_por_mppt em tempo de leitura (esses campos não são persistidos).
 *
 * Saídas (evidência, em backend/docs/):
 *   catalogo-auditoria.json · catalogo-auditoria.csv · CATALOGO_AUDITORIA.md
 *
 * Uso:  node src/scripts/auditCatalog.js
 */
import 'dotenv/config'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { lerInversor } from '../equipamentos/inversores/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DOCS = resolve(__dirname, '../../docs')
const MEM = resolve(__dirname, '../../data/memory-storage.json')

// ── helpers ──────────────────────────────────────────────────────────────────
const isNum = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0
const temEntradas = (c) =>
  (Array.isArray(c.entradas_por_mppt) && c.entradas_por_mppt.length > 0) ||
  c.strings_por_mppt != null

// ── FASE 2 — definição do SCORE de qualidade (pesos do enunciado) ────────────
const CAMPOS_SCORE = [
  // CRÍTICO (3x)
  { id: 'potencia_kw',           peso: 3, label: 'Potência nominal',  ok: (c) => isNum(c.potencia_kw) },
  { id: 'n_mppts',               peso: 3, label: 'MPPT (nº)',          ok: (c) => isNum(c.n_mppts) },
  { id: 'strings_entradas',      peso: 3, label: 'Strings/Entradas',  ok: (c) => temEntradas(c) },
  { id: 'corrente_max_por_mppt', peso: 3, label: 'Corrente por MPPT', ok: (c) => isNum(c.corrente_max_por_mppt) },
  // ALTO (2x)
  { id: 'corrente_isc_max',      peso: 2, label: 'Isc por MPPT',      ok: (c) => isNum(c.corrente_isc_max) },
  { id: 'tensao_max_entrada',    peso: 2, label: 'Tensão máx. CC',    ok: (c) => isNum(c.tensao_max_entrada) },
  { id: 'faixa_mppt',            peso: 2, label: 'Faixa MPPT',        ok: (c) => isNum(c.tensao_mppt_min) && isNum(c.tensao_mppt_max) },
  { id: 'tensao_partida',        peso: 2, label: 'Tensão de partida', ok: (c) => isNum(c.tensao_partida) },
  // OPERACIONAL (1x)
  { id: 'eficiencia_maxima',     peso: 1, label: 'Eficiência',        ok: (c) => isNum(c.eficiencia_maxima) },
  { id: 'peso_kg',               peso: 1, label: 'Peso',              ok: (c) => isNum(c.peso_kg) },
  { id: 'dimensoes',             peso: 1, label: 'Dimensões',         ok: (c) => !!c.dimensoes },
  { id: 'grau_protecao_ip',      peso: 1, label: 'Grau IP',           ok: (c) => !!c.grau_protecao_ip },
]
const PESO_TOTAL = CAMPOS_SCORE.reduce((s, f) => s + f.peso, 0)

export { CAMPOS_SCORE, PESO_TOTAL }
export function scoreDe(canon) {
  let obtido = 0
  const faltantes = []
  for (const f of CAMPOS_SCORE) {
    if (f.ok(canon)) obtido += f.peso
    else faltantes.push(f.id)
  }
  return { score: Math.round((obtido / PESO_TOTAL) * 1000) / 10, faltantes }
}

// ── FASE 4 — detecção de OUTLIERS (apenas detecta; nunca corrige/escreve) ────
export function outliersDe(canon) {
  const out = []
  const P = canon.potencia_kw, ef = canon.eficiencia_maxima, vMax = canon.tensao_max_entrada
  const peso = canon.peso_kg, iMppt = canon.corrente_max_por_mppt, nM = canon.n_mppts
  if (isNum(P) && P >= 20 && isNum(peso) && peso <= 10)
    out.push({ regra: 1, campo: 'peso_kg', justificativa: `Potência ${P}kW ≥ 20kW com peso ${peso}kg ≤ 10kg — fisicamente improvável` })
  if (isNum(ef) && (ef < 80 || ef > 100))
    out.push({ regra: 2, campo: 'eficiencia_maxima', justificativa: `Eficiência ${ef}% fora de [80,100]` })
  if (isNum(P) && P <= 5 && isNum(vMax) && vMax >= 1500)
    out.push({ regra: 3, campo: 'tensao_max_entrada', justificativa: `Potência ${P}kW ≤ 5kW com tensão CC ${vMax}V ≥ 1500V — incompatível` })
  if (isNum(P) && isNum(iMppt)) {
    // heurística: corrente DC total estimada vs potência. Razão kW/A típica ~0.1–1.0
    // (tensão DC operacional 100–800V). Fora de [0.03, 4] sugere incompatibilidade.
    const iTot = iMppt * (isNum(nM) ? nM : 1)
    const razao = P / iTot
    if (razao < 0.03 || razao > 4)
      out.push({ regra: 4, campo: 'corrente_max_por_mppt', justificativa: `Potência ${P}kW vs corrente DC total ~${iTot}A (razão ${razao.toFixed(2)} kW/A) — incompatível` })
  }
  const criticosNulos = CAMPOS_SCORE.filter(f => f.peso === 3 && !f.ok(canon)).map(f => f.id)
  if (criticosNulos.length)
    out.push({ regra: 5, campo: criticosNulos.join('+'), justificativa: `Campo(s) CRÍTICO(s) nulo(s): ${criticosNulos.join(', ')}` })
  return out
}

// ── FASE 5 — prioridade comercial (priors de mercado BR; ranking final mistura
//    estes priors com os DADOS REAIS: nº de modelos, completude, outliers) ────
const IMPORTANCIA_COMERCIAL = {
  Huawei: 5, Sungrow: 5, Goodwe: 5, GoodWe: 5, Deye: 5, Solis: 5, SolarEdge: 5, Kehua: 4,
  Growatt: 4, SolaX: 4, Chint: 3, Hopewind: 3, Solplanet: 3, SAJ: 3, Fronius: 3, SMA: 3,
  ABB: 2, Fimer: 2, WEG: 2,
}

function loadDataSource() {
  // 1) tenta Mongo (read-only). Curto timeout; em falha cai para memory-storage.
  // Mantido SÍNCRONO no carregamento do JSON p/ simplicidade; Mongo é tentado em runAudit.
  if (existsSync(MEM)) {
    try {
      const raw = JSON.parse(readFileSync(MEM, 'utf8'))
      const eq = raw?.collections?.equipamentos || []
      return { fonte: 'memory-storage.json', equipamentos: eq }
    } catch (e) { /* ignore */ }
  }
  return { fonte: 'vazio', equipamentos: [] }
}

async function tentarMongo() {
  if (process.env.USE_MEMORY_STORAGE === 'true') return null
  const uri = process.env.MONGODB_URI
  if (!uri) return null
  try {
    const mongoose = (await import('mongoose')).default
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 6000, connectTimeoutMS: 6000, maxPoolSize: 1 })
    const docs = await mongoose.connection.db.collection('equipamentos').find({}).toArray()
    await mongoose.disconnect()
    return { fonte: `mongodb:${(uri.split('@')[1] || '').split('/')[0]}`, equipamentos: docs }
  } catch (e) {
    return { fonte: null, erro: e.message.split('\n')[0] }
  }
}

export async function runAudit() {
  // fonte real: Mongo se possível, senão memory-storage
  let src = await tentarMongo()
  let avisoMongo = null
  if (!src || !src.fonte) {
    if (src?.erro) avisoMongo = `MongoDB indisponível (${src.erro}) → fallback memory-storage`
    else if (process.env.USE_MEMORY_STORAGE === 'true') avisoMongo = 'USE_MEMORY_STORAGE=true → memory-storage (fonte de runtime atual)'
    src = loadDataSource()
  }
  const todos = src.equipamentos || []
  const inversores = todos.filter(e => e.tipo === 'inversor')

  // ── FASE 1 + 2 — inventário + score por modelo ──────────────────────────────
  const registros = inversores.map(e => {
    const esp = e.especificacoes || {}
    // mescla campos top-level conhecidos (potencia_kw às vezes fora de especificacoes)
    const entrada = { ...esp }
    for (const k of ['potencia_kw', 'potencia_w']) if (e[k] != null && entrada[k] == null) entrada[k] = e[k]
    const canon = lerInversor(entrada, { fabricante: e.fabricante, modelo: e.modelo })
    const { score, faltantes } = scoreDe(canon)
    const outliers = outliersDe(canon)
    return {
      id: e._id, fabricante: e.fabricante, modelo: e.modelo,
      canon: {
        potencia_kw: canon.potencia_kw, potencia_maxima_kw: canon.potencia_maxima_kw,
        n_mppts: canon.n_mppts, strings_por_mppt: canon.strings_por_mppt,
        entradas_por_mppt: canon.entradas_por_mppt, tipo_topologia: canon.tipo_topologia,
        corrente_max_por_mppt: canon.corrente_max_por_mppt, corrente_isc_max: canon.corrente_isc_max,
        tensao_max_entrada: canon.tensao_max_entrada, tensao_mppt_min: canon.tensao_mppt_min,
        tensao_mppt_max: canon.tensao_mppt_max, tensao_partida: canon.tensao_partida,
        eficiencia_maxima: canon.eficiencia_maxima, peso_kg: canon.peso_kg,
        dimensoes: canon.dimensoes, grau_protecao_ip: canon.grau_protecao_ip,
      },
      score, campos_faltantes: faltantes, outliers,
    }
  })

  // ── estatísticas por fabricante ─────────────────────────────────────────────
  const porFab = {}
  for (const r of registros) {
    const f = r.fabricante || '(sem fabricante)'
    if (!porFab[f]) porFab[f] = { fabricante: f, modelos: 0, score_soma: 0, outliers: 0, lista: [] }
    porFab[f].modelos++; porFab[f].score_soma += r.score; porFab[f].outliers += r.outliers.length
    porFab[f].lista.push(r.modelo)
  }
  const fabricantes = Object.values(porFab).map(f => ({
    fabricante: f.fabricante, modelos: f.modelos,
    completude_media: Math.round((f.score_soma / f.modelos) * 10) / 10,
    outliers: f.outliers,
    importancia_comercial: IMPORTANCIA_COMERCIAL[f.fabricante] ?? 1,
  }))

  // ── FASE 5 — ranking P0–P3 (mistura prior comercial + dados reais) ──────────
  // prioridade = importância(0..5) ponderada, penalizada por baixa completude e
  // por outliers, e impulsionada por volume de modelos.
  for (const f of fabricantes) {
    const lacuna = (100 - f.completude_media) / 100        // 0 (completo) .. 1 (vazio)
    f._prioridade = f.importancia_comercial * 2 + Math.min(f.modelos, 10) * 0.3 + lacuna * 3 + Math.min(f.outliers, 10) * 0.5
  }
  fabricantes.sort((a, b) => b._prioridade - a._prioridade)
  const faixa = (p) => p >= 11 ? 'P0' : p >= 8 ? 'P1' : p >= 5 ? 'P2' : 'P3'
  for (const f of fabricantes) f.prioridade = faixa(f._prioridade)

  const todosOutliers = registros.flatMap(r => r.outliers.map(o => ({ fabricante: r.fabricante, modelo: r.modelo, ...o })))
  const completudeGlobal = registros.length
    ? Math.round((registros.reduce((s, r) => s + r.score, 0) / registros.length) * 10) / 10 : 0

  return {
    meta: {
      sprint: 'P1-CATALOG-AUDIT-01', gerado_em: new Date().toISOString(),
      fonte_dados: src.fonte, aviso_fonte: avisoMongo,
      somente_leitura: true, escreveu_no_banco: false,
      schema: {
        especificacoes: 'Mixed (livre)',
        campos_derivados_em_leitura: ['tipo_topologia', 'entradas_por_mppt'],
        nota: 'topologia/entradas NÃO existem no schema; SSOT lerInversor deriva em leitura.',
      },
    },
    verificacao_inicial: verificarTopologia(inversores),
    totais: {
      equipamentos_total: todos.length,
      inversores: inversores.length,
      modulos: todos.filter(e => e.tipo === 'modulo').length,
      carregadores_ev: todos.filter(e => e.tipo === 'carregador_ev').length,
      fabricantes_distintos: fabricantes.length,
      completude_global: completudeGlobal,
    },
    pesos_score: CAMPOS_SCORE.map(({ id, peso, label }) => ({ id, peso, label })),
    fabricantes: fabricantes.map(({ _prioridade, ...f }) => f),
    modelos: registros,
    outliers: todosOutliers,
  }
}

// ── verificação inicial obrigatória: topologia/entradas/strings PERSISTIDOS? ──
function verificarTopologia(inversores) {
  const tem = (e, k) => (k in e) || (e.especificacoes && k in e.especificacoes)
  const topo = inversores.filter(e => tem(e, 'tipo_topologia')).length
  const ent = inversores.filter(e => tem(e, 'entradas_por_mppt')).length
  const str = inversores.filter(e => tem(e, 'strings_por_mppt')).length
  return {
    inversores_analisados: inversores.length,
    tipo_topologia_persistido: topo, entradas_por_mppt_persistido: ent, strings_por_mppt_persistido: str,
    mistura_de_formatos: ent > 0 && str > 0,
    conclusao: (topo === 0 && ent === 0 && str === 0)
      ? 'Nenhum dos três é persistido — tipo_topologia e entradas_por_mppt são DERIVADOS em leitura (SSOT lerInversor). Sem mistura, nada a migrar.'
      : `Persistidos → topologia:${topo} entradas:${ent} strings:${str}${ent > 0 && str > 0 ? ' (MISTURA detectada — NÃO migrar, auditoria apenas registra)' : ''}`,
  }
}

// ── FASE 3 — exportação JSON + CSV ───────────────────────────────────────────
function exportarCSV(rel) {
  const head = ['fabricante', 'modelo', 'score', 'topologia', 'potencia_kw', 'potencia_max_kw', 'n_mppts',
    'entradas_por_mppt', 'corrente_max_por_mppt', 'corrente_isc_max', 'tensao_max_cc', 'mppt_min', 'mppt_max',
    'tensao_partida', 'eficiencia', 'peso_kg', 'dimensoes', 'ip', 'campos_faltantes', 'outliers']
  const linhas = [head.join(',')]
  const esc = (v) => {
    if (v == null) return ''
    const s = Array.isArray(v) ? v.join('|') : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  for (const r of rel.modelos) {
    const c = r.canon
    linhas.push([r.fabricante, r.modelo, r.score, c.tipo_topologia, c.potencia_kw, c.potencia_maxima_kw,
      c.n_mppts, esc(c.entradas_por_mppt), c.corrente_max_por_mppt, c.corrente_isc_max, c.tensao_max_entrada,
      c.tensao_mppt_min, c.tensao_mppt_max, c.tensao_partida, c.eficiencia_maxima, c.peso_kg,
      esc(c.dimensoes), c.grau_protecao_ip, esc(r.campos_faltantes), esc(r.outliers.map(o => `R${o.regra}:${o.campo}`))]
      .map(esc).join(','))
  }
  return linhas.join('\n')
}

// ── FASE 6 — relatório executivo Markdown ────────────────────────────────────
function gerarMarkdown(rel) {
  const t = rel.totais, v = rel.verificacao_inicial, m = rel.meta
  const L = []
  L.push('# CATÁLOGO — Relatório de Auditoria (P1-CATALOG-AUDIT-01)\n')
  L.push(`> Gerado em ${m.gerado_em} · **100% read-only** (zero escrita no banco).\n`)
  L.push('## 1. Inventário\n')
  L.push(`- Equipamentos (total): **${t.equipamentos_total}** — inversores ${t.inversores}, módulos ${t.modulos}, carregadores EV ${t.carregadores_ev}`)
  L.push(`- Fabricantes de inversores distintos: **${t.fabricantes_distintos}**`)
  L.push(`- Completude global média (inversores): **${t.completude_global}%**\n`)
  L.push('## 2. Estado real do schema\n')
  L.push('- `Equipamento.especificacoes` é `Mixed` (livre) — campos técnicos não são tipados no schema.')
  L.push('- `tipo_topologia` e `entradas_por_mppt` **não existem no schema**; são DERIVADOS em leitura pelo SSOT `lerInversor` (mapeia dialetos legados como `vpv_max→tensao_max_entrada`).\n')
  L.push('## 3. Estado real do banco\n')
  L.push(`- Fonte auditada: **${m.fonte_dados}**${m.aviso_fonte ? ` — _${m.aviso_fonte}_` : ''}`)
  L.push(`- Verificação obrigatória (persistência) sobre ${v.inversores_analisados} inversores:`)
  L.push(`  - \`tipo_topologia\` persistido: **${v.tipo_topologia_persistido}**`)
  L.push(`  - \`entradas_por_mppt\` persistido: **${v.entradas_por_mppt_persistido}**`)
  L.push(`  - \`strings_por_mppt\` persistido: **${v.strings_por_mppt_persistido}**`)
  L.push(`  - Mistura de formatos: **${v.mistura_de_formatos ? 'SIM' : 'NÃO'}**`)
  L.push(`  - Conclusão: ${v.conclusao}\n`)
  L.push('## 4. Completude por fabricante\n')
  L.push('| Fabricante | Modelos | Completude média | Outliers | Imp. comercial | Prioridade |')
  L.push('|---|---|---|---|---|---|')
  for (const f of rel.fabricantes)
    L.push(`| ${f.fabricante} | ${f.modelos} | ${f.completude_media}% | ${f.outliers} | ${f.importancia_comercial}/5 | ${f.prioridade} |`)
  L.push('\n_Pesos do score:_ CRÍTICO×3 (potência, MPPT, strings/entradas, corrente MPPT) · ALTO×2 (Isc, tensão máx CC, faixa MPPT, tensão de partida) · OPERACIONAL×1 (eficiência, peso, dimensões, IP).\n')
  L.push('## 5. Ranking de prioridades\n')
  for (const faixa of ['P0', 'P1', 'P2', 'P3']) {
    const fs = rel.fabricantes.filter(f => f.prioridade === faixa).map(f => f.fabricante)
    L.push(`- **${faixa}**: ${fs.length ? fs.join(', ') : '—'}`)
  }
  L.push('\n_Critério: importância comercial (prior de mercado BR) + nº de modelos + lacuna de completude + outliers. Baseado nos dados reais encontrados._\n')
  L.push('## 6. Outliers\n')
  if (!rel.outliers.length) L.push('Nenhum outlier detectado nas regras 1–5.\n')
  else {
    L.push('| Fabricante | Modelo | Regra | Campo | Justificativa |')
    L.push('|---|---|---|---|---|')
    for (const o of rel.outliers) L.push(`| ${o.fabricante} | ${o.modelo} | R${o.regra} | ${o.campo} | ${o.justificativa} |`)
    L.push('')
  }
  L.push('## 7. Riscos\n')
  L.push('- **Fonte de dados de produção (Atlas) inacessível** no ambiente atual (`querySrv ECONNREFUSED`) e `USE_MEMORY_STORAGE=true`: a auditoria reflete o store local de runtime, não o catálogo completo de produção. Reexecutar com Atlas acessível para números de produção.')
  L.push('- **Dados legados esparsos**: inversores seed só têm `potencia_kw, vpv_max, ipv_max, eficiencia` — campos CRÍTICOS (MPPT, strings/entradas) e ALTOS (Isc, faixa MPPT, tensão de partida) ausentes → baixa completude.')
  L.push('- **Campos derivados não persistidos**: topologia/entradas dependem do SSOT em leitura; consumidores que leem `especificacoes` cru (sem `lerInversor`) não enxergam esses campos.\n')
  L.push('## 8. Próximas ações (sugestões — NÃO executadas nesta sprint)\n')
  L.push('1. Reexecutar a auditoria com MongoDB Atlas acessível (números de produção).')
  L.push('2. Reprocessar via datasheet os fabricantes P0/P1 com baixa completude (preencher CRÍTICOS/ALTOS) — fora do escopo read-only.')
  L.push('3. Avaliar persistência opcional de `n_mppts`/`entradas_por_mppt` para consumidores que não passam pelo SSOT (decisão de schema — fora do escopo).')
  L.push('4. Tratar outliers detectados caso a caso na origem (datasheet), sem auto-correção.\n')
  return L.join('\n')
}

// ── runner ───────────────────────────────────────────────────────────────────
async function main() {
  const rel = await runAudit()
  writeFileSync(resolve(DOCS, 'catalogo-auditoria.json'), JSON.stringify(rel, null, 2))
  writeFileSync(resolve(DOCS, 'catalogo-auditoria.csv'), exportarCSV(rel))
  writeFileSync(resolve(DOCS, 'CATALOGO_AUDITORIA.md'), gerarMarkdown(rel))
  console.log('✅ Auditoria READ-ONLY concluída (zero escrita no banco).')
  console.log('   Fonte:', rel.meta.fonte_dados, rel.meta.aviso_fonte ? `(${rel.meta.aviso_fonte})` : '')
  console.log('   Inversores:', rel.totais.inversores, '| Fabricantes:', rel.totais.fabricantes_distintos, '| Completude global:', rel.totais.completude_global + '%')
  console.log('   Verificação inicial:', rel.verificacao_inicial.conclusao)
  console.log('   Outliers:', rel.outliers.length)
  console.log('   Gerados: docs/catalogo-auditoria.json, docs/catalogo-auditoria.csv, docs/CATALOGO_AUDITORIA.md')
}

// executa quando chamado diretamente
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch(e => { console.error('❌ Auditoria falhou:', e); process.exit(1) })
}
