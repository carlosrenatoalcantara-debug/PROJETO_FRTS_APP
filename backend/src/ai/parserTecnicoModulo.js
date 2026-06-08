/**
 * parserTecnicoModulo.js — P0-MODULE-PARSER-01
 *
 * Primeiro parser FUNCIONAL de módulos fotovoltaicos. Extrai os 9 campos mínimos da seção
 * STC do datasheet, com **validação de faixa rígida** — na dúvida, retorna `null` (NUNCA
 * inventa valor). Corrige o falso-positivo de dimensões (garbled) do parser de inversor.
 *
 * Suporta layout de TEXTO (rótulo→valor) e MATRICIAL (multi-potência: pega o 1º valor em faixa).
 * NÃO altera o parser de inversor/SSOT/Atlas.
 */

// Faixas físicas de um módulo PV (W/V/A/%/células/mm/kg)
export const FAIXAS = {
  potencia_wp:    { min: 50,   max: 800,  int: true },
  voc:            { min: 15,   max: 65 },
  isc:            { min: 3,    max: 25 },
  vmp:            { min: 10,   max: 58 },
  imp:            { min: 3,    max: 22 },
  eficiencia:     { min: 10,   max: 25 },
  numero_celulas: { min: 36,   max: 168, int: true },
  peso:           { min: 8,    max: 45 },
}

// Rótulos (EN + PT), do mais específico para o mais genérico
const ROTULOS = {
  potencia_wp:    ['Maximum\\s+Power\\s*\\(?\\s*Pmax', 'Rated\\s+(?:output|power)\\s*\\(?\\s*Pmpp', 'Nominal\\s+(?:Maximum\\s+)?Power', 'Pot[êe]ncia\\s+(?:M[áa]xima|Nominal)', 'Pmax', 'Pmpp'],
  voc:            ['Open[\\s-]*circuit\\s+Voltage\\s*\\(?\\s*Voc', 'Tens[ãa]o\\s+de\\s+Circuito\\s+Aberto', 'Voc'],
  isc:            ['Short[\\s-]*circuit\\s+Current\\s*\\(?\\s*Isc', 'Corrente\\s+de\\s+Curto[\\s-]*circuito', 'Isc'],
  vmp:            ['Maximum\\s+Power\\s+Voltage\\s*\\(?\\s*Vmp', 'Rated\\s+voltage\\s*\\(?\\s*Vmpp', 'Voltage\\s+at\\s+(?:Pmax|maximum)', 'Tens[ãa]o\\s+de\\s+M[áa]xima\\s+Pot[êe]ncia', 'Vmpp', 'Vmp'],
  imp:            ['Maximum\\s+Power\\s+Current\\s*\\(?\\s*Imp', 'Rated\\s+current\\s*\\(?\\s*Impp', 'Current\\s+at\\s+(?:Pmax|maximum)', 'Corrente\\s+de\\s+M[áa]xima\\s+Pot[êe]ncia', 'Impp', 'Imp'],
  eficiencia:     ['Module\\s+Efficiency', 'Panel\\s+Efficiency', 'Efici[êe]ncia\\s+d[oe]?\\s*M[óo]dulo', 'Efficiency'],
  peso:           ['Module\\s+weight', 'Weight', 'Peso'],
}

const _num = (s) => { if (s == null) return null; const t = String(s).replace(',', '.').match(/-?\d+(?:\.\d+)?/); const n = t ? parseFloat(t[0]) : NaN; return Number.isFinite(n) ? n : null }
const _emFaixa = (n, f) => n != null && n >= f.min && n <= f.max && (!f.int || Number.isInteger(n))

/**
 * Acha o 1º número EM FAIXA após qualquer um dos rótulos (janela curta). Rejeita fora de faixa.
 */
function _extrair(texto, campo) {
  const f = FAIXAS[campo]
  for (const lab of ROTULOS[campo]) {
    const re = new RegExp(lab + '[^\\d\\n]{0,28}((?:\\d{1,4}(?:[.,]\\d+)?))', 'i')
    const m = texto.match(re)
    if (m) { const n = _num(m[1]); if (_emFaixa(n, f)) return f.int ? Math.round(n) : n }
  }
  return null
}

/** Nº de células — rótulo OU padrão "144 half-cell". Contagem deve ser DIVISÍVEL POR 6
 *  (células em strings de 6/12) — rejeita falsos-positivos como 45/158. */
const _celulaValida = (n) => _emFaixa(n, FAIXAS.numero_celulas) && n % 6 === 0
function _celulas(texto) {
  const lab = texto.match(/(?:Number\s+of\s+Cells|N[úu]mero\s+de\s+C[ée]lulas|Cells?\s*\(?(?:pcs)?\)?)[^\d\n]{0,12}(\d{2,3})/i)
  if (lab) { const n = parseInt(lab[1], 10); if (_celulaValida(n)) return n }
  const pat = texto.match(/\b(\d{2,3})\s*(?:half[\s-]?cells?|cells?|pcs)\b/i)
  if (pat) { const n = parseInt(pat[1], 10); if (_celulaValida(n)) return n }
  return null
}

/**
 * Dimensões — SÓ aceita 3 números na faixa física de módulo (corrige o falso-positivo garbled).
 * Comprimento 1500–2500, Largura 900–1400, Espessura 25–60 mm (em qualquer ordem).
 */
function _dimensoes(texto) {
  const re = /(?:Dimension[s]?|Outer\s+dimensions|Dimens[õo]es|Size)[^\d\n]{0,18}(\d{3,4})\s*[x×*]\s*(\d{3,4})\s*[x×*]\s*(\d{1,3})/i
  const m = texto.match(re)
  if (!m) return null
  const nums = [m[1], m[2], m[3]].map(Number)
  const comp = nums.find(n => n >= 1500 && n <= 2500)
  const larg = nums.find(n => n >= 900 && n <= 1400)
  const esp = nums.find(n => n >= 25 && n <= 60)
  if (comp && larg && esp) return `${comp}x${larg}x${esp}`   // só se TODAS as 3 dimensões forem plausíveis
  return null                                                 // na dúvida → null (sem garbled)
}

/**
 * Extrai as especificações de um módulo PV a partir do texto do datasheet.
 * @returns {object} campos válidos (em faixa); campos duvidosos são OMITIDOS (nunca inventa).
 */
export function extrairSpecsModulo(texto) {
  if (!texto || typeof texto !== 'string') return {}
  const out = {}
  for (const campo of Object.keys(ROTULOS)) { const v = _extrair(texto, campo); if (v != null) out[campo] = v }
  const cel = _celulas(texto); if (cel != null) out.numero_celulas = cel
  const dim = _dimensoes(texto); if (dim != null) out.dimensoes = dim
  return out
}

/**
 * Reconstrói o texto AGRUPANDO tokens por linha (Y) — preserva rótulo→valor que a linearização
 * do pdf-parse separa em datasheets 2-coluna/matriciais (ex.: DAH, Risen, ZNShine).
 */
export function reconstruirLinhas(tokens) {
  if (!Array.isArray(tokens) || !tokens.length) return ''
  const byY = new Map()
  for (const t of tokens) { const k = `${t.page}:${Math.round(t.y / 3)}`; if (!byY.has(k)) byY.set(k, []); byY.get(k).push(t) }
  return [...byY.values()].map(g => g.sort((a, b) => a.x - b.x).map(t => t.s).join(' ')).join('\n')
}

/** Extrai specs de módulo a partir de tokens posicionais (caminho matricial/2-coluna). */
export function extrairSpecsModuloDeTokens(tokens) {
  return extrairSpecsModulo(reconstruirLinhas(tokens))
}

/**
 * Pipeline completo: tenta TEXTO e TOKENS, mescla (1º valor válido por campo). 100% leitura.
 * @param {Buffer} pdfBuffer
 */
export async function extrairSpecsModuloDePdf(pdfBuffer, { extrairTokens } = {}) {
  let texto = ''
  try { const { PDFParse } = await import('pdf-parse'); const p = new PDFParse({ data: pdfBuffer }); texto = (await p.getText()).text; await p.destroy() } catch { /* */ }
  const aText = extrairSpecsModulo(texto)
  let aTok = {}
  try {
    const fn = extrairTokens || (await import('./parserMatricial.js')).extrairTokensPosicionais
    const tokens = await fn(pdfBuffer)
    aTok = extrairSpecsModuloDeTokens(tokens)
  } catch { /* */ }
  return { ...aTok, ...aText }   // texto tem prioridade quando ambos válidos
}
