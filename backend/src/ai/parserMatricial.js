/**
 * parserMatricial.js — P1-INV-MATRIX-01
 *
 * Parser MATRICIAL POSICIONAL de datasheets multi-modelo, SEM IA.
 *
 * Causa do bug "todos os modelos recebem a coluna 1": o texto linearizado do PDF
 * (pdf-parse) COLAPSA a grade da tabela (células mescladas, colunas em blocos),
 * então um parser baseado em texto associa a coluna errada.
 *
 * Solução: usar as COORDENADAS (x,y) de cada token (via pdfjs):
 *   - cabeçalhos de modelo (GW17K-DT, SG5.0RT…) definem o X de cada COLUNA;
 *   - cada linha da tabela é um Y; o token mais à esquerda é o RÓTULO;
 *   - cada valor numérico é atribuído à COLUNA cujo X é o mais próximo;
 *   - rótulo → campo canônico via ROTULOS_BASE (mesmo vocabulário do parser).
 *
 * Saída: 1 `especificacoes` por modelo, com proveniência por campo
 * (encontrado | inferido), para a Importação Assistida.
 */

import { ROTULOS_BASE } from './parserTecnicoInversor.js'
import { potenciaDoModelo } from './parserTecnicoInversor.js'

// ── 1. Extração de tokens posicionais ────────────────────────────────────────
export async function extrairTokensPosicionais(pdfBuffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // pdfjs exige Uint8Array "puro" (não Buffer do Node). Copia defensivamente.
  const data = new Uint8Array(
    pdfBuffer instanceof Uint8Array ? pdfBuffer
      : (pdfBuffer?.buffer ? pdfBuffer : Uint8Array.from(pdfBuffer))
  )
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise
  const tokens = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    for (const it of tc.items) {
      const s = (it.str || '').trim()
      if (!s) continue
      tokens.push({ page: p, x: Math.round(it.transform[4]), y: Math.round(it.transform[5]), s })
    }
  }
  return tokens
}

// ── util ─────────────────────────────────────────────────────────────────────
const _normModelo = (s) => String(s || '').toUpperCase().replace(/\s+/g, '').replace(/[—–]/g, '-')

function _num(s) {
  if (s == null) return null
  // separa por espaço (não junta "60.4/57.7" em "60.457.7")
  let t = String(s).replace(/[^\d.,\-]/g, ' ').trim().split(/\s+/)[0]
  // P1-INV-HARDEN-PLUS-02: vírgula/ponto de MILHAR → remove ("1,100"→1100).
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '')
  else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.')
  else t = t.replace(',', '.')
  const m = t.match(/-?\d+(?:\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

// Compila ROTULOS_BASE em [{campo, res:RegExp[]}] (ignora chaves internas _range).
// PRIORIDADE: campos mais ESPECÍFICOS primeiro — senão o alias genérico de
// potencia_kw ("Output Power") capturaria "Max. AC Output Power" antes da
// potencia_maxima_kw. Ordem explícita resolve a ambiguidade.
const _PRIORIDADE = ['potencia_maxima_kw', 'corrente_isc_max', 'corrente_max_por_mppt', 'eficiencia_europeia']
const _MATCHERS = Object.entries(ROTULOS_BASE)
  .filter(([campo]) => !campo.startsWith('_'))
  .sort(([a], [b]) => {
    const ia = _PRIORIDADE.indexOf(a), ib = _PRIORIDADE.indexOf(b)
    if (ia === -1 && ib === -1) return 0   // ambos sem prioridade: mantém ordem
    if (ia === -1) return 1                 // a sem prioridade → depois
    if (ib === -1) return -1                // b sem prioridade → depois
    return ia - ib                          // ambos prioritários: pela ordem da lista
  })
  .map(([campo, lista]) => ({ campo, res: lista.map(r => new RegExp(r, 'i')) }))

/** Rótulo (texto) → campo canônico (primeiro matcher que casa). */
export function rotuloParaCampo(label) {
  const t = String(label || '')
  for (const m of _MATCHERS) {
    if (m.res.some(re => re.test(t))) return m.campo
  }
  return null
}

// ── 2. Detecção das colunas (cabeçalhos de modelo) ───────────────────────────
/**
 * Acha a linha de cabeçalho cujos tokens correspondem aos modelos conhecidos.
 * @param {Array} tokens
 * @param {string[]} modelos  modelos já identificados (expandirModelosInversor)
 * @returns {Array<{modelo,x,y,page}>} colunas ordenadas por x
 */
export function detectarColunas(tokens, modelos = []) {
  const alvo = [...new Set(modelos)].map(m => ({ n: _normModelo(m), modelo: m }))
                                    .filter(a => a.n.length >= 4)
                                    .sort((a, b) => b.n.length - a.n.length) // mais longos primeiro
  // candidatos: token cujo texto normalizado == modelo, OU um contém o outro
  // (ex.: header "GW7000-MS-30" casa o modelo detectado "GW7000-MS").
  const hits = []
  for (const t of tokens) {
    const n = _normModelo(t.s)
    if (n.length < 4) continue
    const m = alvo.find(a => a.n === n || n.includes(a.n) || a.n.includes(n))
    if (m) hits.push({ ...t, modelo: m.modelo })
  }
  if (hits.length < 2) return []
  // agrupa por (page,y) e escolhe a linha com mais modelos distintos
  const grupos = new Map()
  for (const h of hits) {
    const key = `${h.page}:${Math.round(h.y / 4)}`
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key).push(h)
  }
  let melhor = []
  for (const g of grupos.values()) {
    const distintos = new Set(g.map(h => h.modelo))
    if (distintos.size > new Set(melhor.map(h => h.modelo)).size) melhor = g
  }
  // dedup por modelo, ordena por x
  const porModelo = new Map()
  for (const h of melhor) if (!porModelo.has(h.modelo)) porModelo.set(h.modelo, h)
  return [...porModelo.values()].sort((a, b) => a.x - b.x)
}

// Níveis de CONFIANÇA por campo (P1-INV-HARDEN-01).
export const CONF = {
  ENCONTRADO: 'encontrado',       // valor direto na coluna do modelo (100%)
  INF_ALTA:   'inferido_alta',    // célula compartilhada/mesclada (carry-forward)
  INF_MEDIA:  'inferido_media',   // derivado (ex.: potência do nome do modelo)
  INF_BAIXA:  'inferido_baixa',   // coluna distante / fallback de texto
  FALTANTE:   'faltante',
}

/**
 * AUTO-detecção de colunas (P1-INV-HARDEN-PLUS-01): quando a lista de modelos do
 * texto é fraca, encontra a linha de cabeçalho diretamente nos tokens — tokens
 * "código de modelo" (letras+dígitos) na mesma Y, com PREFIXO comum (SG5/SG6,
 * ASW9100/ASW7300, R5-3K/R5-4K). Robusto contra falsos cabeçalhos.
 */
const _ehCodModelo = (s) => /^[A-Z][A-Z0-9]{0,4}[-\s]?\d/i.test(s) && /[A-Z]/i.test(s) && /\d/.test(s) && s.length >= 3 && s.length <= 18 && !/^\d/.test(s)
function _prefixoComum(strs) {
  if (!strs.length) return ''
  let p = strs[0]
  for (const s of strs) { let i = 0; while (i < p.length && i < s.length && p[i].toUpperCase() === s[i].toUpperCase()) i++; p = p.slice(0, i) }
  return p
}
export function detectarColunasAuto(tokens) {
  const cands = tokens.filter(t => _ehCodModelo(t.s))
  const grupos = new Map()
  for (const t of cands) {
    const key = `${t.page}:${Math.round(t.y / 4)}`
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key).push(t)
  }
  let melhor = null, melhorScore = 0
  for (const g of grupos.values()) {
    // dedup por texto, ordena por x
    const uniq = [...new Map(g.map(t => [_normModelo(t.s), t])).values()].sort((a, b) => a.x - b.x)
    if (uniq.length < 2) continue
    const pref = _prefixoComum(uniq.map(t => t.s))
    if (pref.length < 2) continue                       // exige família comum
    const score = uniq.length * pref.length
    if (score > melhorScore) { melhorScore = score; melhor = uniq.map(t => ({ ...t, modelo: t.s })) }
  }
  return melhor || []
}

// ── 3+4. Agrupa linhas por (página,Y) — MULTI-PÁGINA ─────────────────────────
function _agruparLinhas(tokens, yTol = 3) {
  const ts = tokens.slice().sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x)
  const linhas = []
  let atual = null
  for (const t of ts) {
    if (!atual || atual.page !== t.page || Math.abs(atual.y - t.y) > yTol) {
      atual = { page: t.page, y: t.y, tokens: [] }
      linhas.push(atual)
    }
    atual.tokens.push(t)
  }
  return linhas
}

/** Índice da coluna cujo x-centro é o mais próximo (dentro de tolerância). */
function _colunaMaisProxima(x, colunas, tol = 40) {
  let melhor = -1, dist = Infinity
  colunas.forEach((c, i) => {
    const d = Math.abs(c.x - x)
    if (d < dist) { dist = d; melhor = i }
  })
  return dist <= tol ? melhor : -1
}

/**
 * Distribui as células de UMA linha nas N colunas, com tratamento EXPLÍCITO de
 * células compartilhadas/mescladas (carry-forward) e nível de confiança:
 *   - todas as N colunas preenchidas → cada uma ENCONTRADO;
 *   - 1 só preenchida → compartilhada: origem ENCONTRADO, demais INF_ALTA;
 *   - subconjunto preenchido (merge agrupado, ex.: corrente Sungrow) → o valor
 *     "vaza" para a direita até a próxima coluna preenchida (INF_ALTA).
 * @returns {Array<{cel:string[],conf:string}|null>}
 */
function _distribuir(celulas) {
  const N = celulas.length
  const out = new Array(N).fill(null)
  const filled = celulas.map((c, i) => (c.length ? i : -1)).filter(i => i >= 0)
  if (!filled.length) return out

  if (filled.length === N) {
    for (let i = 0; i < N; i++) out[i] = { cel: celulas[i], conf: CONF.ENCONTRADO }
    return out
  }
  if (filled.length === 1) {
    const o = filled[0]
    for (let i = 0; i < N; i++) out[i] = { cel: celulas[o], conf: i === o ? CONF.ENCONTRADO : CONF.INF_ALTA }
    return out
  }
  // merge agrupado: carry-forward + backfill das colunas iniciais vazias
  let last = null
  for (let i = 0; i < N; i++) {
    if (celulas[i].length) { last = celulas[i]; out[i] = { cel: celulas[i], conf: CONF.ENCONTRADO } }
    else if (last) out[i] = { cel: last, conf: CONF.INF_ALTA }
  }
  const first = filled[0]
  for (let i = 0; i < first; i++) out[i] = { cel: celulas[first], conf: CONF.INF_ALTA }
  return out
}

/**
 * Extrai a matriz: para cada modelo, um `especificacoes` + confiança por campo.
 * MULTI-PÁGINA: processa linhas de TODAS as páginas sob as mesmas colunas.
 * @returns {{ modelos:string[], porModelo: Object<modelo,{especificacoes,_status}> }}
 */
export function montarMatriz(tokens, modelos) {
  // P1-INV-HARDEN-PLUS-01: usa a detecção que achar MAIS colunas (a lista textual
  // costuma ser incompleta — ex.: Sungrow acha 2, o cabeçalho tem 6).
  const known = detectarColunas(tokens, modelos)
  const auto = detectarColunasAuto(tokens)
  let colunas = auto.length > known.length ? auto : known
  if (colunas.length < 2) colunas = auto.length >= known.length ? auto : known
  if (colunas.length < 2) return { ok: false, motivo: 'colunas<2', colunas: colunas.length }

  const pageCab = colunas[0].page
  const yCab = colunas[0].y
  const xPrimeira = colunas[0].x
  const margemRotulo = 30
  const linhas = _agruparLinhas(tokens)

  const porModelo = {}
  for (const c of colunas) porModelo[c.modelo] = { especificacoes: {}, _status: {} }

  for (const linha of linhas) {
    // na página do cabeçalho, ignora a linha do cabeçalho e o que está acima
    if (linha.page === pageCab && linha.y > yCab - 2) continue
    const toks = linha.tokens.slice().sort((a, b) => a.x - b.x)
    const rotuloToks = toks.filter(t => t.x < xPrimeira - margemRotulo)
    const valorToks = toks.filter(t => t.x >= xPrimeira - margemRotulo)
    if (!rotuloToks.length || !valorToks.length) continue
    const label = rotuloToks.map(t => t.s).join(' ').replace(/\s+/g, ' ').trim()

    const ehMppt = /mpp.?\s*(voltage\s*)?range|faixa.*mppt|mpp\s+voltage/i.test(label)
    const campo = ehMppt ? '__mppt_range' : rotuloParaCampo(label)
    if (!campo) continue

    const celulas = colunas.map(() => [])
    for (const v of valorToks) {
      const idx = _colunaMaisProxima(v.x, colunas)
      if (idx >= 0) celulas[idx].push(v.s)
    }
    const dist = _distribuir(celulas)
    colunas.forEach((c, i) => {
      if (dist[i]) _aplicar(porModelo[c.modelo], campo, dist[i].cel, dist[i].conf)
    })
  }

  // potência a partir do NOME do modelo (inferido média) quando ausente
  for (const c of colunas) {
    const alvo = porModelo[c.modelo]
    const pNome = potenciaDoModelo(c.modelo)
    if (pNome != null && alvo.especificacoes.potencia_kw == null) {
      alvo.especificacoes.potencia_kw = pNome
      alvo._status.potencia_kw = CONF.INF_MEDIA
    }
  }

  return { ok: true, modelos: colunas.map(c => c.modelo), porModelo, colunas }
}

function _aplicar(destino, campo, celula, status) {
  const esp = destino.especificacoes
  const tokens = Array.isArray(celula) ? celula : [celula]
  const joined = tokens.join(' ')

  if (campo === '__mppt_range') {
    // tolera unidade e vírgula de milhar: "200 V ~ 1,000 V" → [200, 1000]
    const fm = joined.match(/(\d[\d.,]*)\s*[A-Za-z]{0,4}\s*[~–—\-aà]\s*[A-Za-z]{0,4}\s*(\d[\d.,]*)/)
    if (fm) {
      const a = _num(fm[1]), b = _num(fm[2])
      if (a != null && b != null && a < b) {
        if (esp.tensao_mppt_min == null) { esp.tensao_mppt_min = a; destino._status.tensao_mppt_min = status }
        if (esp.tensao_mppt_max == null) { esp.tensao_mppt_max = b; destino._status.tensao_mppt_max = status }
      }
    }
    return
  }
  // first-write-wins: não sobrescreve um campo já preenchido (evita que linhas
  // posteriores — ex.: "Power factor at Rated power" — sobreponham a potência).
  if (destino._status[campo]) return

  // strings_por_mppt: PRESERVA a assimetria completa ("3/3/2/2", "2/1") — não reduz
  // a valor único (P1-INV-HARDEN-PLUS-02, CHINT).
  if (campo === 'strings_por_mppt') {
    const m = joined.match(/\d+(?:\s*\/\s*\d+)+|\d+/)
    if (m) { const txt = m[0].replace(/\s+/g, ''); esp[campo] = /\//.test(txt) ? txt : _num(txt); destino._status[campo] = status }
    return
  }
  if (campo === 'grau_protecao_ip') {
    // só aceita IP válido (evita "IP" truncado); senão deixa o complemento global preencher
    const m = joined.match(/IP\s?(6[5-8]|54|55|2[01]|6[5-8]K)/i)
    if (m) { esp[campo] = 'IP' + m[1].toUpperCase(); destino._status[campo] = status }
    return
  }
  if (campo === 'dimensoes' || campo === 'temperatura_operacao' || campo === 'certificacoes') {
    esp[campo] = (campo === 'dimensoes' ? joined : tokens[0]).trim(); destino._status[campo] = status
    return
  }
  // P1-MICRO-EXTRACT-01: formato COMPOSTO "A × B" (microinversores).
  // Conceito: "contagem_de_entradas × corrente_por_entrada" (ex.: Hoymiles
  // "4 × 25", APsystems "20A x 4"). Para um campo de CORRENTE o valor físico é
  // o MAIOR dos dois (a corrente por entrada); o menor é a contagem de entradas.
  // Vale para qualquer fabricante que use a notação N×corrente (família semântica,
  // não regra por marca). Só aplica em campos de corrente; rejeita fora da faixa.
  if (campo === 'corrente_max_por_mppt' || campo === 'corrente_isc_max') {
    const cz = joined.match(/(\d{1,3})\s*[Aa]?\s*[x×*]\s*(\d{1,3})/)
    if (cz) {
      const val = Math.max(parseInt(cz[1]), parseInt(cz[2]))
      const rgc = _RANGES[campo]
      if (Number.isFinite(val) && (!rgc || (val >= rgc[0] && val <= rgc[1]))) {
        esp[campo] = val; destino._status[campo] = status; return
      }
    }
  }
  // numérico: VARRE os tokens e pega o PRIMEIRO valor dentro da FAIXA física
  // (P1-INV-HARDEN-PLUS-02). Ignora nota de rodapé ("1 1,100"→1100), e descarta
  // valores implausíveis (corrente total 360A como por-MPPT, fator de potência
  // 0.99 como fases). Não inventa — só rejeita o fisicamente impossível.
  const rg = _RANGES[campo]
  let v = null
  for (const tk of tokens) {
    let n = _num(tk)
    if (n == null) continue
    if ((campo === 'potencia_kw' || campo === 'potencia_maxima_kw') && n > 500) n = n / 1000
    if (!rg || (n >= rg[0] && n <= rg[1])) { v = n; break }
  }
  if (v == null) return
  esp[campo] = v
  destino._status[campo] = status
}

// Faixas físicas plausíveis (espelham os limites do parser de texto).
const _RANGES = {
  potencia_kw: [0.4, 600], potencia_maxima_kw: [0.4, 600], tensao_max_entrada: [40, 1500],
  tensao_ac: [100, 1000], corrente_ac_saida: [1, 400], corrente_max_por_mppt: [1, 100],
  corrente_isc_max: [1, 120], eficiencia_maxima: [90, 100], eficiencia_europeia: [90, 100],
  peso_kg: [2, 200], garantia_anos: [1, 30], n_mppts: [1, 30], total_entradas_cc: [1, 48], fases: [1, 3], frequencia_hz: [40, 70],
}

/**
 * API de alto nível: PDF (buffer) + modelos conhecidos → matriz per-modelo.
 * Em qualquer falha retorna ok:false (o chamador faz fallback ao parser de texto).
 */
export async function parseMatricial(pdfBuffer, modelos = []) {
  try {
    if (!pdfBuffer) return { ok: false, motivo: 'sem_pdf' }
    const tokens = await extrairTokensPosicionais(pdfBuffer)
    // P1-INV-HARDEN-PLUS-01: sem gate de "≥2 modelos" — montarMatriz tenta a lista
    // conhecida e, se falhar, AUTO-detecta as colunas no cabeçalho do PDF.
    return montarMatriz(tokens, Array.isArray(modelos) ? modelos : [])
  } catch (e) {
    return { ok: false, motivo: `erro:${e?.message || e}` }
  }
}

// ── Parser SINGLE-COLUMN POSICIONAL (P1-INV-HARDEN-PLUS-02) ───────────────────
/**
 * Datasheets single-model column-major (ex.: Sungrow SG110CX): rótulo na coluna
 * ESQUERDA, valor na coluna DIREITA da MESMA linha visual (Y). O parser de texto
 * falha porque a linearização separa rótulo e valor. Aqui usamos (x,y): por linha,
 * o maior GAP horizontal separa rótulo (esquerda) de valor (direita).
 */
function _splitRotuloValor(toks, gapMin = 45) {
  if (toks.length < 2) return null
  let maxGap = 0, idx = -1
  for (let i = 1; i < toks.length; i++) {
    const g = toks[i].x - (toks[i - 1].x + 0)
    if (g > maxGap) { maxGap = g; idx = i }
  }
  if (maxGap < gapMin || idx < 1) return null
  const valor = toks.slice(idx).map(t => t.s)
  if (!valor.some(s => /\d/.test(s))) return null   // valor precisa ter número
  const rotulo = toks.slice(0, idx).map(t => t.s).join(' ').replace(/\s+/g, ' ').trim()
  if (rotulo.replace(/[^A-Za-zÀ-ÿ]/g, '').length < 3) return null   // rótulo precisa ter texto
  return { rotulo, valor }
}

export function montarColunaUnica(tokens) {
  const linhas = _agruparLinhas(tokens)
  const destino = { especificacoes: {}, _status: {} }
  let aplicados = 0
  for (const linha of linhas) {
    const toks = linha.tokens.slice().sort((a, b) => a.x - b.x)
    const sv = _splitRotuloValor(toks)
    if (!sv) continue
    const ehMppt = /mpp.?\s*(?:operating\s+)?(?:voltage\s+)?range|faixa.*mpp/i.test(sv.rotulo)
    const campo = ehMppt ? '__mppt_range' : rotuloParaCampo(sv.rotulo)
    if (!campo) continue
    const antes = Object.keys(destino.especificacoes).length
    _aplicar(destino, campo, sv.valor, CONF.ENCONTRADO)
    if (Object.keys(destino.especificacoes).length > antes) aplicados++
  }
  return { ok: aplicados >= 3, especificacoes: destino.especificacoes, _status: destino._status, aplicados }
}

/** PDF (buffer) single-model → especificacoes via coluna única posicional. */
export async function parseColunaUnica(pdfBuffer) {
  try {
    if (!pdfBuffer) return { ok: false, motivo: 'sem_pdf' }
    const tokens = await extrairTokensPosicionais(pdfBuffer)
    return montarColunaUnica(tokens)
  } catch (e) {
    return { ok: false, motivo: `erro:${e?.message || e}` }
  }
}
