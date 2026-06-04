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
  let t = String(s).replace(/[^\d.,\-]/g, ' ').trim()
  if (/\d\.\d{3}(\D|$)/.test(t) && /,/.test(t)) t = t.replace(/\./g, '').replace(',', '.')
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

// ── 3+4. Agrupa linhas por Y e associa valores às colunas ────────────────────
function _agruparLinhas(tokens, page, yTol = 3) {
  const ts = tokens.filter(t => t.page === page).sort((a, b) => b.y - a.y || a.x - b.x)
  const linhas = []
  let atual = null
  for (const t of ts) {
    if (!atual || Math.abs(atual.y - t.y) > yTol) {
      atual = { y: t.y, tokens: [] }
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
 * Extrai a matriz: para cada modelo, um `especificacoes` + proveniência.
 * @returns {{ modelos:string[], porModelo: Object<modelo,{especificacoes,_status}> , debug }}
 */
export function montarMatriz(tokens, modelos) {
  const colunas = detectarColunas(tokens, modelos)
  if (colunas.length < 2) return { ok: false, motivo: 'colunas<2', colunas: colunas.length }

  const page = colunas[0].page
  const xPrimeira = colunas[0].x
  const margemRotulo = 30 // tokens com x < (1ª coluna - margem) são rótulo
  const linhas = _agruparLinhas(tokens, page)

  // inicializa saída
  const porModelo = {}
  for (const c of colunas) porModelo[c.modelo] = { especificacoes: {}, _status: {} }

  for (const linha of linhas) {
    if (linha.y > colunas[0].y - 2) continue // ignora cabeçalho e acima
    const toks = linha.tokens.slice().sort((a, b) => a.x - b.x)
    const rotuloToks = toks.filter(t => t.x < xPrimeira - margemRotulo)
    const valorToks = toks.filter(t => t.x >= xPrimeira - margemRotulo)
    if (!rotuloToks.length || !valorToks.length) continue
    const label = rotuloToks.map(t => t.s).join(' ').replace(/\s+/g, ' ').trim()

    // rótulo de FAIXA (MPPT range / temperatura) → 2 campos
    const ehMppt = /mpp.?\s*(voltage\s*)?range|faixa.*mppt|mpp\s+voltage/i.test(label)
    const campo = ehMppt ? '__mppt_range' : rotuloParaCampo(label)
    if (!campo) continue

    // distribui valores nas colunas por X (cada célula = lista de tokens)
    const celulas = colunas.map(() => [])
    for (const v of valorToks) {
      const idx = _colunaMaisProxima(v.x, colunas)
      if (idx >= 0) celulas[idx].push(v.s)
    }
    const presentes = celulas.filter(c => c.length).length
    // valor COMPARTILHADO (1 coluna preenchida para N modelos): replica em todas
    let shared = null
    if (presentes === 1 && colunas.length > 1) shared = celulas.find(c => c.length)

    colunas.forEach((c, i) => {
      const cel = shared != null ? shared : celulas[i]
      if (!cel || !cel.length) return
      _aplicar(porModelo[c.modelo], campo, cel, 'encontrado')
    })
  }

  // potência a partir do NOME do modelo (inferido) quando ausente
  for (const c of colunas) {
    const alvo = porModelo[c.modelo]
    const pNome = potenciaDoModelo(c.modelo)
    if (pNome != null && alvo.especificacoes.potencia_kw == null) {
      alvo.especificacoes.potencia_kw = pNome
      alvo._status.potencia_kw = 'inferido'
    }
  }

  return { ok: true, modelos: colunas.map(c => c.modelo), porModelo, colunas }
}

function _aplicar(destino, campo, celula, status) {
  const esp = destino.especificacoes
  const tokens = Array.isArray(celula) ? celula : [celula]
  const joined = tokens.join(' ')

  if (campo === '__mppt_range') {
    const nums = joined.match(/-?\d+(?:\.\d+)?/g)
    if (nums && nums.length >= 2) {
      if (esp.tensao_mppt_min == null) { esp.tensao_mppt_min = parseFloat(nums[0]); destino._status.tensao_mppt_min = status }
      if (esp.tensao_mppt_max == null) { esp.tensao_mppt_max = parseFloat(nums[1]); destino._status.tensao_mppt_max = status }
    }
    return
  }
  // first-match-wins: não sobrescreve um valor já ENCONTRADO (evita que linhas
  // posteriores — ex.: "Power factor at Rated power" — sobreponham a potência).
  if (destino._status[campo] === 'encontrado') return

  // strings_por_mppt: preserva forma "2/1" (assimetria) — usa só o 1º token.
  if (campo === 'strings_por_mppt') {
    const m = String(tokens[0]).match(/\d+\s*\/\s*\d+|\d+/)
    if (m) { const txt = m[0].replace(/\s+/g, ''); esp[campo] = /\//.test(txt) ? txt : _num(txt); destino._status[campo] = status }
    return
  }
  if (campo === 'grau_protecao_ip' || campo === 'dimensoes' || campo === 'temperatura_operacao' || campo === 'certificacoes') {
    esp[campo] = (campo === 'dimensoes' ? joined : tokens[0]).trim(); destino._status[campo] = status
    return
  }
  // numérico (1º token; conversão W→kW para potências)
  let v = _num(tokens[0])
  if (v == null) return
  if ((campo === 'potencia_kw' || campo === 'potencia_maxima_kw') && v > 500) v = v / 1000
  esp[campo] = v
  destino._status[campo] = status
}

/**
 * API de alto nível: PDF (buffer) + modelos conhecidos → matriz per-modelo.
 * Em qualquer falha retorna ok:false (o chamador faz fallback ao parser de texto).
 */
export async function parseMatricial(pdfBuffer, modelos = []) {
  try {
    if (!pdfBuffer || !Array.isArray(modelos) || modelos.length < 2) return { ok: false, motivo: 'sem_pdf_ou_<2_modelos' }
    const tokens = await extrairTokensPosicionais(pdfBuffer)
    return montarMatriz(tokens, modelos)
  } catch (e) {
    return { ok: false, motivo: `erro:${e?.message || e}` }
  }
}
