/**
 * parserTecnicoInversor.js — P0-CAT-09
 *
 * Parser técnico DETERMINÍSTICO de inversores: extrai especificações diretamente
 * do TEXTO OCR, SEM depender de IA. A IA passa a ser complemento opcional.
 *
 * Saída usa as chaves canônicas de `especificacoes` do catálogo, então entra
 * direto no item (sem mapeamento adicional). PURO, testável, multilíngue (PT/EN).
 */

// ── Normalização ───────────────────────────────────────────────────────────────
function _norm(texto) {
  return String(texto || '')
    .replace(/ /g, ' ')        // nbsp
    .replace(/[ \t]+/g, ' ')
    .replace(/\r/g, '')
}

/** Primeiro grupo numérico de um match (aceita 1.234,56 / 1,234.56 / 1234.5). */
function _num(s) {
  if (s == null) return null
  let t = String(s).trim()
  // remove separador de milhar e normaliza decimal
  if (/\d\.\d{3}(\D|$)/.test(t) && /,/.test(t)) t = t.replace(/\./g, '').replace(',', '.')
  else t = t.replace(',', '.')
  const m = t.match(/-?\d+(?:\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

/**
 * Tabelas de datasheet viram "Rótulo (unidade) <tab> valor1 <tab> valor2 ...".
 * Pega o PRIMEIRO número que aparece após o rótulo (pulando a unidade entre
 * parênteses e tabs), na MESMA linha.
 * @returns {number|null}
 */
function _valor(texto, rotulos, { min = -Infinity, max = Infinity } = {}) {
  const t = _norm(texto)
  for (const r of rotulos) {
    const re = new RegExp(`${r}[^\\n\\d]{0,35}?(-?\\d[\\d.,/]*)`, 'i')
    const m = t.match(re)
    if (m) { const v = _num(m[1]); if (v != null && v >= min && v <= max) return v }
  }
  return null
}

/** Faixa "min ~ max" após o rótulo (ex.: "MPPT Range (V) 260~850"). */
function _faixa(texto, rotulos) {
  const t = _norm(texto)
  for (const r of rotulos) {
    const re = new RegExp(`${r}[^\\n\\d]{0,35}?(-?\\d{1,4})\\s*[~–\\-aà]\\s*(\\d{2,4})`, 'i')
    const m = t.match(re)
    if (m) return [parseInt(m[1]), parseInt(m[2])]
  }
  return null
}

/** Texto após o rótulo (ex.: faixa de temperatura, dimensões). */
function _texto(texto, rotulos, valorRe) {
  const t = _norm(texto)
  for (const r of rotulos) {
    const re = new RegExp(`${r}[^\\n]{0,35}?(${valorRe.source})`, valorRe.flags.includes('i') ? 'i' : 'i')
    const m = t.match(re)
    if (m) return m[1]
  }
  return null
}

/** Potência (kW) a partir do NOME do modelo: GW20K, ASW15K, MID25K, 1P7K, SUN2000-100K. */
export function potenciaDoModelo(modelo) {
  if (!modelo) return null
  // Primeiro número seguido de "K" dentro de faixa de potência (kW).
  // Ex.: GW20K→20, MID25KTL3-X→25, 1P7K-4G→7, SUN2000-100KTL→100 (ignora 2000).
  for (const m of String(modelo).toUpperCase().matchAll(/(\d+(?:\.\d+)?)K/g)) {
    const v = parseFloat(m[1])
    if (v >= 0.5 && v <= 500) return v
  }
  return null
}

// ── Extratores por campo (tabelas linearizadas: "Rótulo (unidade) valor…") ─────
const POT_AC = ['Rated\\s+(?:AC\\s+)?(?:Output\\s+)?Power', 'Nominal\\s+(?:AC\\s+)?Output\\s+Power', 'AC\\s+(?:Rated\\s+)?Output\\s+Power', 'Pot[êe]ncia\\s+nominal(?:\\s+(?:AC|CA))?', 'Output\\s+Power']
const CAMPOS = [
  ['potencia_kw', (t) => {
    const v = _valor(t, POT_AC, { min: 0.4, max: 600000 })
    return v != null ? (v > 500 ? v / 1000 : v) : null   // W → kW
  }],
  ['potencia_maxima_kw', (t) => {
    const v = _valor(t, ['Max[^\\n]{0,14}(?:AC\\s+)?(?:Apparent\\s+|Output\\s+)Power', 'Maximum\\s+(?:AC\\s+)?(?:Apparent\\s+)?Power', 'Pot[êe]ncia\\s+m[áa]x[^\\n]{0,14}(?:CA|AC|sa[íi]da|aparente)', 'Max\\.?\\s+apparent\\s+power'], { min: 0.4, max: 600000 })
    return v != null ? (v > 500 ? v / 1000 : v) : null
  }],
  ['n_mppts', (t) => {
    if (/Dual[\s-]*MPPT/i.test(t)) return 2
    if (/(?:Single|Mono)[\s-]*MPPT/i.test(t)) return 1
    if (/Tri(?:ple)?[\s-]*MPPT/i.test(t)) return 3
    return _valor(t, ['N[ºo]\\.?\\s*(?:de\\s*)?MPPTs?', 'Number\\s+of\\s+MPPTs?', 'MPPT\\s+Number', 'Quantidade\\s+de\\s+MPPT', 'MPP\\s*Trackers?'], { min: 1, max: 24 })
  }],
  ['strings_por_mppt', (t) => _valor(t, ['Strings?\\s+(?:por|per)\\s+MPPT', 'Entradas?\\s+por\\s+MPPT', 'No\\.?\\s+of\\s+(?:input\\s+)?strings?(?:\\s+per\\s+MPPT)?'], { min: 1, max: 24 })],
  ['tensao_max_entrada', (t) => _valor(t, ['Max[^\\n]{0,14}(?:DC|PV)\\s+Input\\s+Voltage', 'Max[^\\n]{0,14}(?:DC|PV)\\s+Voltage', 'Maximum\\s+(?:DC|PV)\\s+Voltage', 'Tens[ãa]o\\s+m[áa]x[^\\n]{0,18}(?:CC|DC)'], { min: 200, max: 1500 })],
  ['tensao_mppt_min', (t) => { const f = _faixa(t, ['MPPT\\s+(?:Voltage\\s+)?Range', 'MPP\\s+Voltage\\s+Range', 'Faixa\\s+(?:de\\s+)?(?:tens[ãa]o\\s+)?(?:de\\s+)?MPPT', 'Full\\s+load\\s+MPPT']); return f ? f[0] : null }],
  ['tensao_mppt_max', (t) => { const f = _faixa(t, ['MPPT\\s+(?:Voltage\\s+)?Range', 'MPP\\s+Voltage\\s+Range', 'Faixa\\s+(?:de\\s+)?(?:tens[ãa]o\\s+)?(?:de\\s+)?MPPT', 'Full\\s+load\\s+MPPT']); return f ? f[1] : null }],
  ['tensao_ac', (t) => _valor(t, ['Rated\\s+(?:Grid|AC|Output)\\s+Voltage', 'Nominal\\s+(?:Grid|AC|Output)\\s+Voltage', 'Tens[ãa]o\\s+nominal[^\\n]{0,14}(?:CA|AC|rede)'], { min: 100, max: 1000 })],
  ['corrente_ac_saida', (t) => _valor(t, ['Max[^\\n]{0,14}(?:AC\\s+)?Output\\s+Current', 'Rated\\s+(?:AC\\s+)?Output\\s+Current', 'Nominal\\s+(?:AC\\s+)?Output\\s+Current', 'Corrente[^\\n]{0,14}sa[íi]da'], { min: 1, max: 400 })],
  ['corrente_max_por_mppt', (t) => _valor(t, ['Max[^\\n]{0,14}Input\\s+Current', 'Max[^\\n]{0,14}(?:PV|DC)\\s+Current', 'Corrente\\s+m[áa]x[^\\n]{0,14}(?:entrada|MPPT|PV)'], { min: 1, max: 100 })],
  ['corrente_isc_max', (t) => _valor(t, ['Max[^\\n]{0,14}Short[^\\n]{0,8}Current', 'Short[\\s-]*circuit\\s+Current', 'Corrente\\s+(?:de\\s+)?curto'], { min: 1, max: 120 })],
  ['eficiencia_maxima', (t) => _valor(t, ['Max[^\\n]{0,8}Efficiency', 'Peak\\s+Efficiency', 'Efici[êe]ncia\\s+m[áa]x'], { min: 90, max: 100 })],
  ['eficiencia_europeia', (t) => _valor(t, ['(?:European|Euro)\\s+Efficiency', 'Efici[êe]ncia\\s+(?:europeia|euro)'], { min: 90, max: 100 })],
  ['peso_kg', (t) => _valor(t, ['Weight', 'Peso'], { min: 2, max: 200 })],
  ['dimensoes', (t) => {
    const m = _norm(t).match(/(\d{2,4})\s*[x×*]\s*(\d{2,4})\s*[x×*]\s*(\d{2,4})/i)
    return m ? `${m[1]}x${m[2]}x${m[3]}` : null
  }],
  ['grau_protecao_ip', (t) => { const m = _norm(t).match(/\bIP\s?(6[5-8]|54|55|2[01])\b/i); return m ? `IP${m[1]}` : null }],
  ['temperatura_operacao', (t) => { const f = _faixa(t, ['Operating\\s+Temperature', 'Ambient\\s+Temperature', 'Temperatura\\s+(?:de\\s+)?opera[çc][ãa]o', 'Temperatura\\s+ambiente']); return (f && f[0] <= 5 && f[1] >= 40) ? `${f[0]}~+${f[1]}°C` : null }],
  ['garantia_anos', (t) => _valor(t, ['Warranty', 'Garantia'], { min: 1, max: 30 })],
  ['certificacoes', (t) => {
    const cs = []
    for (const [re, nome] of [[/INMETRO/i, 'INMETRO'], [/IEC\s?62109/i, 'IEC 62109'], [/IEC\s?61727/i, 'IEC 61727'], [/NBR\s?16149/i, 'NBR 16149'], [/NBR\s?16150/i, 'NBR 16150'], [/VDE[\s-]?(?:AR|4105)/i, 'VDE'], [/UL\s?1741/i, 'UL 1741']]) {
      if (re.test(t)) cs.push(nome)
    }
    return cs.length ? cs.join(', ') : null
  }],
]

/**
 * Extrai especificações técnicas do texto OCR (sem IA).
 * @param {string} texto  texto OCR completo
 * @param {string} [modelo] nome do modelo (para derivar potência do nome)
 * @returns {Object} especificacoes (só chaves encontradas)
 */
export function extrairSpecsTecnicas(texto, modelo = null) {
  const esp = {}
  for (const [chave, fn] of CAMPOS) {
    try {
      const v = fn(texto)
      if (v !== null && v !== undefined && v !== '') esp[chave] = v
    } catch { /* campo ignorado */ }
  }
  // Potência: prioriza o NOME do modelo (per-modelo em datasheets multi-modelo)
  const pModelo = potenciaDoModelo(modelo)
  if (pModelo != null) esp.potencia_kw = pModelo
  return esp
}

/** Lista de chaves que o parser sabe extrair (para relatórios/cobertura). */
export const CAMPOS_SUPORTADOS = CAMPOS.map(c => c[0])
