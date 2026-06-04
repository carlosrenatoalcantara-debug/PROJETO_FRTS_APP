/**
 * parserTecnicoInversor.js — P0-CAT-09 / CAT-KB-01
 *
 * Parser técnico DETERMINÍSTICO de inversores: extrai especificações diretamente
 * do TEXTO OCR, SEM depender de IA. A IA passa a ser complemento opcional.
 *
 * CAT-KB-01: os rótulos vivem em `ROTULOS_BASE` (fallback hardcoded, SEMPRE
 * presente) e podem ser AUMENTADOS por rótulos vindos da Base de Conhecimento
 * (Mongo) via `setRotulosExtra()`. Se a KB/Mongo falhar, `_rotulosExtra` devolve
 * [] e o parser opera exatamente como antes → ZERO regressão.
 *
 * Saída usa as chaves canônicas de `especificacoes` do catálogo, então entra
 * direto no item (sem mapeamento adicional). PURO, testável, multilíngue (PT/EN).
 */

// ── Injeção de conhecimento (KB) — fallback inerte por padrão ────────────────
let _rotulosExtra = () => []
/** Liga rótulos extra vindos da Base de Conhecimento (Mongo). Reversível. */
export function setRotulosExtra(fn) { _rotulosExtra = (typeof fn === 'function') ? fn : (() => []) }
/** Rótulos efetivos de um campo: hardcoded (base) + KB (extra). Base nunca some. */
function _labels(campo) {
  const base = ROTULOS_BASE[campo] || []
  let extra = []
  try { extra = _rotulosExtra(campo) || [] } catch { extra = [] }
  return extra.length ? [...base, ...extra] : base
}

// ── Normalização ───────────────────────────────────────────────────────────────
function _norm(texto) {
  return String(texto || '')
    .replace(/ /g, ' ')        // nbsp
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

// ── Rótulos base (fallback hardcoded; a KB pode adicionar mais) ───────────────
// Chave = nome do campo em `especificacoes`. Os valores são "regex source" (str).
export const ROTULOS_BASE = {
  potencia_kw: ['Rated\\s+(?:AC\\s+)?(?:Output\\s+)?Power', 'Nominal\\s+(?:AC\\s+)?Output\\s+Power', 'AC\\s+(?:Rated\\s+)?Output\\s+Power', 'Pot[êe]ncia\\s+nominal(?:\\s+(?:AC|CA))?', 'Pot[êe]ncia\\s+(?:CA\\s+)?ativa\\s+nominal', 'Pot[êe]ncia\\s+activa\\s+nominal', 'Pot[êe]ncia\\s+ativa\\s+nominal\\s+(?:de\\s+)?sa[íi]da', 'Output\\s+Power'],
  potencia_maxima_kw: ['Max[^\\n]{0,14}(?:AC\\s+)?(?:Apparent\\s+|Output\\s+)Power', 'Maximum\\s+(?:AC\\s+)?(?:Apparent\\s+)?Power', 'Pot[êe]ncia\\s+m[áa]x[^\\n]{0,14}(?:CA|AC|sa[íi]da|aparente)', 'Pot[êe]ncia\\s+CA\\s+ativa\\s+m[áa]x', 'Pot[êe]ncia\\s+aparente\\s+m[áa]x', 'Max\\.?\\s+apparent\\s+power'],
  n_mppts: ['N[ºo]\\.?\\s*(?:de\\s*)?MPPTs?', 'Number\\s+of\\s+MPPTs?', 'MPPT\\s+Number', 'Quantidade\\s+de\\s+MPPT', 'MPP\\s*Trackers?', 'N[ºo]\\.?\\s*of\\s*(?:independent\\s*)?MPP(?:T|\\s*(?:inputs?|trackers?))', 'N[ºo]\\.?\\s*(?:de\\s*)?(?:entradas?|rastreadores?)\\s*MPP'],
  strings_por_mppt: ['Strings?\\s+(?:por|per)\\s+MPPT', 'Entradas?\\s+por\\s+MPPT', 'No\\.?\\s+of\\s+(?:input\\s+)?strings?(?:\\s+per\\s+MPPT)?', 'N[úu]mero\\s+de\\s+(?:DC\\s+)?Connection\\s+Sets', 'Number\\s+of\\s+DC\\s+Connection\\s+Sets', 'N[ºo]\\s*de\\s*strings'],
  tensao_max_entrada: ['Max[^\\n]{0,14}(?:DC|PV)\\s+Input\\s+Voltage', 'Max[^\\n]{0,14}(?:DC|PV)\\s+Voltage', 'Maximum\\s+(?:DC|PV)\\s+Voltage', 'Tens[ãa]o\\s+m[áa]x[^\\n]{0,18}(?:CC|DC)', 'Tens[ãa]o\\s+(?:de\\s+)?entrada\\s+m[áa]xima', 'Max\\.?\\s+Tens[ãa]o\\s+de\\s+Entrada\\s+CC'],
  // tensao_mppt_min e tensao_mppt_max compartilham os rótulos de FAIXA
  _mppt_range: ['MPPT\\s+(?:Voltage\\s+)?Range', 'MPP\\s+Voltage\\s+Range', 'Faixa\\s+(?:de\\s+)?(?:tens[ãa]o\\s+)?(?:de\\s+)?MPPT', 'Faixa\\s+de\\s+opera[çc][ãa]o\\s+MPPT', 'Full\\s+load\\s+MPPT'],
  tensao_ac: ['Rated\\s+(?:Grid|AC|Output)\\s+Voltage', 'Nominal\\s+(?:Grid|AC|Output)\\s+Voltage', 'Tens[ãa]o\\s+nominal[^\\n]{0,14}(?:CA|AC|rede)'],
  corrente_ac_saida: ['Max[^\\n]{0,14}(?:AC\\s+)?Output\\s+Current', 'Rated\\s+(?:AC\\s+)?Output\\s+Current', 'Nominal\\s+(?:AC\\s+)?Output\\s+Current', 'Max\\.?\\s*AC\\s+Current', 'Corrente\\s+(?:de\\s+)?sa[íi]da\\s+m[áa]xima', 'Max\\.?\\s+Corrente\\s+de\\s+Sa[íi]da\\s+CA', 'Corrente\\s+nominal\\s+de\\s+sa[íi]da', 'Corrente[^\\n]{0,14}sa[íi]da'],
  corrente_max_por_mppt: ['Max[^\\n]{0,14}Input\\s+Current', 'Max[^\\n]{0,14}(?:PV|DC)\\s+Current', 'Max\\.?\\s*DC\\s+Input\\s+Current', 'Corrente\\s+(?:de\\s+)?entrada\\s+m[áa]x', 'Max\\.?\\s+Corrente\\s+de\\s+Entrada\\s+CC', 'Corrente\\s+m[áa]x[^\\n]{0,14}(?:entrada|MPPT|PV)'],
  corrente_isc_max: ['Max[^\\n]{0,14}Short[^\\n]{0,8}Current', 'Short[\\s-]*circuit\\s+Current', 'Corrente\\s+de\\s+curto[\\s-]*circuito\\s+m[áa]x', 'Corrente\\s+(?:de\\s+)?curto'],
  eficiencia_maxima: ['Max[^\\n]{0,8}Efficiency', 'Peak\\s+Efficiency', 'Efici[êe]ncia\\s+m[áa]x', 'Max\\.?\\s+Efici[êe]ncia'],
  eficiencia_europeia: ['(?:European|Euro)\\s+Efficiency', 'Efici[êe]ncia\\s+(?:europeia|euro)'],
  peso_kg: ['Weight', 'Peso'],
  _temperatura_range: ['Operating\\s+Temperature', 'Ambient\\s+Temperature', 'Temperatura\\s+(?:de\\s+)?opera[çc][ãa]o', 'Temperatura\\s+ambiente'],
  garantia_anos: ['Warranty', 'Garantia'],
  // P1-INV-HARDEN-PLUS-01: rótulos p/ campos antes só-regex (matricial agora os lê)
  dimensoes: ['Dimens[õo]es', 'Dimension', 'Size\\s*\\('],
  grau_protecao_ip: ['Grau\\s+de\\s+prote[çc][ãa]o', 'Protection\\s+(?:degree|class|rating)', '[ÍI]ndice\\s+de\\s+prote', 'Ingress\\s+protection'],
  fases: ['Fases?\\s+(?:de\\s+)?alimenta', 'Feed[\\s-]*in\\s+phases', 'N[úu]mero\\s+de\\s+fases', 'Output\\s+phases'],
}

// ── Extratores por campo (tabelas linearizadas: "Rótulo (unidade) valor…") ─────
const CAMPOS = [
  ['potencia_kw', (t) => {
    const v = _valor(t, _labels('potencia_kw'), { min: 0.4, max: 600000 })
    return v != null ? (v > 500 ? v / 1000 : v) : null   // W → kW
  }],
  ['potencia_maxima_kw', (t) => {
    const v = _valor(t, _labels('potencia_maxima_kw'), { min: 0.4, max: 600000 })
    return v != null ? (v > 500 ? v / 1000 : v) : null
  }],
  ['n_mppts', (t) => {
    if (/Dual[\s-]*MPPT/i.test(t)) return 2
    if (/(?:Single|Mono)[\s-]*MPPT/i.test(t)) return 1
    if (/Tri(?:ple)?[\s-]*MPPT/i.test(t)) return 3
    return _valor(t, _labels('n_mppts'), { min: 1, max: 24 })
  }],
  ['strings_por_mppt', (t) => _valor(t, _labels('strings_por_mppt'), { min: 1, max: 24 })],
  ['tensao_max_entrada', (t) => _valor(t, _labels('tensao_max_entrada'), { min: 200, max: 1500 })],
  ['tensao_mppt_min', (t) => { const f = _faixa(t, _labels('_mppt_range')); return f ? f[0] : null }],
  ['tensao_mppt_max', (t) => { const f = _faixa(t, _labels('_mppt_range')); return f ? f[1] : null }],
  ['tensao_ac', (t) => _valor(t, _labels('tensao_ac'), { min: 100, max: 1000 })],
  ['fases', (t) => {
    const v = _valor(t, _labels('fases'), { min: 1, max: 3 })
    if (v === 1 || v === 3) return v
    if (/three[\s-]*phase|trif[áa]sic|3\s*\/\s*N\s*\/\s*PE|3-Phase/i.test(t)) return 3
    if (/single[\s-]*phase|monof[áa]sic|1\s*\/\s*N\s*\/\s*PE|1-Phase/i.test(t)) return 1
    return null
  }],
  ['corrente_ac_saida', (t) => _valor(t, _labels('corrente_ac_saida'), { min: 1, max: 400 })],
  ['corrente_max_por_mppt', (t) => _valor(t, _labels('corrente_max_por_mppt'), { min: 1, max: 100 })],
  ['corrente_isc_max', (t) => _valor(t, _labels('corrente_isc_max'), { min: 1, max: 120 })],
  ['eficiencia_maxima', (t) => _valor(t, _labels('eficiencia_maxima'), { min: 90, max: 100 })],
  ['eficiencia_europeia', (t) => _valor(t, _labels('eficiencia_europeia'), { min: 90, max: 100 })],
  ['peso_kg', (t) => _valor(t, _labels('peso_kg'), { min: 2, max: 200 })],
  ['dimensoes', (t) => {
    const m = _norm(t).match(/(\d{2,4})\s*[x×*]\s*(\d{2,4})\s*[x×*]\s*(\d{2,4})/i)
    return m ? `${m[1]}x${m[2]}x${m[3]}` : null
  }],
  ['grau_protecao_ip', (t) => { const m = _norm(t).match(/\bIP\s?(6[5-8]|54|55|2[01])\b/i); return m ? `IP${m[1]}` : null }],
  ['temperatura_operacao', (t) => { const f = _faixa(t, _labels('_temperatura_range')); return (f && f[0] <= 5 && f[1] >= 40) ? `${f[0]}~+${f[1]}°C` : null }],
  ['garantia_anos', (t) => _valor(t, _labels('garantia_anos'), { min: 1, max: 30 })],
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
