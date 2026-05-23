/**
 * kitTokenizerService.js — S2.14 Passo 1
 *
 * Tokenizador determinístico para busca de kits FV.
 * 100% em memória, sem IA, sem LLM.
 *
 * ── Responsabilidades ────────────────────────────────────────────────────────
 *  · Normalizar texto de busca (lowercase + remoção de acentos)
 *  · Remover stopwords
 *  · Extrair potência alvo (kWp), consumo (kWh/mês), marcas, tecnologias
 *  · Produzir `tokens_normalizados` — readiness para embeddings híbridos futuros
 *
 * ── Readiness: embeddings futuros ───────────────────────────────────────────
 *  O campo `tokens_normalizados` é produzido e estruturado de forma a permitir
 *  futura vetorização (word2vec / sentence-transformer) sem alterar a interface.
 *  A estrutura de retorno inclui `meta.confianca_parse` (0–1) que sinaliza
 *  quão ricos são os sinais extraídos — útil para decidir se embeddings
 *  semânticos seriam necessários para complementar a busca estruturada.
 */

// ─── Stopwords ────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'e', 'de', 'do', 'da', 'dos', 'das', 'um', 'uma', 'o', 'a', 'os', 'as',
  'para', 'com', 'em', 'no', 'na', 'nos', 'nas', 'por', 'que', 'ou', 'seu',
  'sua', 'kit', 'sistema', 'quero', 'preciso', 'tenho', 'uso', 'usar', 'ter',
  'ser', 'meu', 'minha', 'mais', 'menos', 'muito', 'pouco', 'bom', 'melhor',
  'painel', 'paineis', 'modulo', 'modulos', 'placa', 'placas', 'inversor',
  'inversores', 'fotovoltaico', 'fv', 'solar', 'energia',
])

// ─── Catálogo de marcas ───────────────────────────────────────────────────────

const MARCAS_PAINEIS = [
  { canonical: 'Canadian Solar',  termos: ['canadian', 'canadian solar'] },
  { canonical: 'Jinko Solar',     termos: ['jinko', 'jinko solar'] },
  { canonical: 'JA Solar',        termos: ['ja solar', 'jasolar', 'ja'] },
  { canonical: 'Trina Solar',     termos: ['trina', 'trina solar'] },
  { canonical: 'LONGi',           termos: ['longi', 'longi solar', 'longe', 'longui'] },
  { canonical: 'Renesola',        termos: ['renesola'] },
  { canonical: 'ZNshine',         termos: ['znshine', 'zn shine'] },
  { canonical: 'Leapton',         termos: ['leapton'] },
  { canonical: 'Risen',           termos: ['risen', 'risen energy'] },
  { canonical: 'Tongwei',         termos: ['tongwei'] },
  { canonical: 'Era Solar',       termos: ['era solar', 'era'] },
  { canonical: 'Helius',          termos: ['helius'] },
  { canonical: 'Hanesun',         termos: ['hanesun'] },
  { canonical: 'BYD',             termos: ['byd'] },
]

const MARCAS_INVERSORES = [
  { canonical: 'Fronius',         termos: ['fronius'] },
  { canonical: 'Deye',            termos: ['deye'] },
  { canonical: 'Growatt',         termos: ['growatt'] },
  { canonical: 'Sungrow',         termos: ['sungrow'] },
  { canonical: 'Goodwe',          termos: ['goodwe', 'good we'] },
  { canonical: 'Kehua',           termos: ['kehua'] },
  { canonical: 'Solax',           termos: ['solax', 'sol ax'] },
  { canonical: 'Solplanet',       termos: ['solplanet', 'sol planet'] },
  { canonical: 'Hoymiles',        termos: ['hoymiles', 'hoy miles'] },
  { canonical: 'APsystems',       termos: ['apsystems', 'ap systems', 'apsystem'] },
  { canonical: 'Huawei',          termos: ['huawei'] },
  { canonical: 'Tsuness',         termos: ['tsuness'] },
  { canonical: 'Nep',             termos: ['nep'] },
  { canonical: 'Enphase',         termos: ['enphase'] },
]

// ─── Mapa de tecnologias ──────────────────────────────────────────────────────

const MAPA_TECNOLOGIAS = {
  bifacial:       ['bifacial', 'bifaz', 'dupla face', 'double glass', 'bifi'],
  microinversor:  ['microinversor', 'micro inversor', 'microinverter', 'micro'],
  hibrido:        ['hibrido', 'hybrid', 'com bateria', 'bateria'],
  string:         ['string inversor', 'inversor string', 'centralizado'],
  ntype:          ['ntype', 'n-type', 'n type', 'topcon', 'hjt', 'heterojuncao'],
  trifasico:      ['trifasico', 'trifasico', 'trif', '3f', 'trifas', 'trifasica'],
  monofasico:     ['monofasico', 'monofasico', 'monof', '1f', 'monofas'],
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function normalizar(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

// ─── Extratores ───────────────────────────────────────────────────────────────

/**
 * Extrai potência alvo em kWp a partir de múltiplos formatos:
 * "5kWp", "5kW", "5.5kwp", "5500W", "10 paineis 550W", "600kWh" (ignorado)
 */
function extrairPotenciaKwp(q) {
  const norm = normalizar(q)

  // Padrão direto kWp / kW (prioritário)
  const kwpMatch = norm.match(/(\d+(?:[.,]\d+)?)\s*kwp/)
  if (kwpMatch) return parseFloat(kwpMatch[1].replace(',', '.'))

  const kwMatch = norm.match(/(\d+(?:[.,]\d+)?)\s*kw(?!h)/)
  if (kwMatch) return parseFloat(kwMatch[1].replace(',', '.'))

  // "10 paineis 550W" → 10 × 550W = 5.5kWp
  const qtdWpMatch = norm.match(/(\d+)\s*(?:paineis?|modulos?|placas?)[^0-9]*(\d{2,4})\s*w(?!h)/i)
  if (qtdWpMatch) {
    const qtd = parseInt(qtdWpMatch[1])
    const wp  = parseInt(qtdWpMatch[2])
    if (wp >= 100 && wp <= 800 && qtd >= 1 && qtd <= 200) {
      return Math.round((qtd * wp) / 100) / 10  // arredonda em 0.1
    }
  }

  // Watt grande isolado: "5000W", "5500Wp"
  const wGrandeMatch = norm.match(/(\d{4,6})\s*wp?(?!\d)/)
  if (wGrandeMatch) {
    const val = parseInt(wGrandeMatch[1])
    if (val >= 1000 && val <= 500000) return Math.round(val / 100) / 10
  }

  return null
}

/** Extrai consumo mensal em kWh */
function extrairConsumoKwh(q) {
  const norm = normalizar(q)
  const match = norm.match(/(\d{2,6})\s*kwh/)
  if (!match) return null
  const val = parseInt(match[1])
  return val >= 50 && val <= 100000 ? val : null
}

/** Extrai marcas presentes no texto, separadas por papel (painel/inversor) */
function extrairMarcas(q) {
  const norm = normalizar(q)
  const encontradas = { paineis: [], inversores: [], todas: [] }

  for (const { canonical, termos } of MARCAS_PAINEIS) {
    if (termos.some(t => norm.includes(normalizar(t)))) {
      if (!encontradas.paineis.includes(canonical)) {
        encontradas.paineis.push(canonical)
        encontradas.todas.push(canonical)
      }
    }
  }

  for (const { canonical, termos } of MARCAS_INVERSORES) {
    if (termos.some(t => norm.includes(normalizar(t)))) {
      if (!encontradas.inversores.includes(canonical)) {
        encontradas.inversores.push(canonical)
        encontradas.todas.push(canonical)
      }
    }
  }

  return encontradas
}

/** Extrai tecnologias mencionadas */
function extrairTecnologias(q) {
  const norm = normalizar(q)
  const encontradas = []

  for (const [tecnologia, termos] of Object.entries(MAPA_TECNOLOGIAS)) {
    if (termos.some(t => norm.includes(normalizar(t)))) {
      encontradas.push(tecnologia)
    }
  }

  return encontradas
}

/**
 * Produz tokens normalizados limpos, prontos para vetorização futura.
 * Remove stopwords, números puros, unidades, duplicatas.
 */
function extrairTokensNormalizados(q) {
  const norm = normalizar(q)
  const tokens = norm
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2)
    .filter(t => !STOPWORDS.has(t))
    .filter(t => !/^\d+$/.test(t))                         // não é número puro
    .filter(t => !/^\d+(?:kw|kwp|kwh|wp?|w)$/.test(t))    // não é unidade

  return [...new Set(tokens)]  // sem duplicatas
}

// ─── Exportação principal ─────────────────────────────────────────────────────

/**
 * tokenizarBusca — Parseia o texto livre e extrai metadados estruturados.
 *
 * @param {string} busca - Texto livre do usuário
 * @returns {TokenizerResult}
 *
 * @typedef {object} TokenizerResult
 *   busca_original, busca_normalizada, potencia_alvo_kwp, consumo_kwh_mes,
 *   marcas, tecnologias, tokens_normalizados, meta
 */
export function tokenizarBusca(busca) {
  if (!busca || typeof busca !== 'string' || !busca.trim()) {
    return {
      busca_original:       '',
      busca_normalizada:    '',
      potencia_alvo_kwp:    null,
      consumo_kwh_mes:      null,
      marcas:               { paineis: [], inversores: [], todas: [] },
      tecnologias:          [],
      tokens_normalizados:  [],   // ← readiness: pronto para vetorização/embedding
      meta: {
        tem_marca_painel:   false,
        tem_marca_inversor: false,
        tem_potencia:       false,
        tem_consumo:        false,
        tem_tecnologia:     false,
        confianca_parse:    0,    // 0–1: riqueza semântica da busca
        tokens_count:       0,
      },
    }
  }

  const busca_normalizada   = normalizar(busca)
  const potencia_alvo_kwp   = extrairPotenciaKwp(busca)
  const consumo_kwh_mes     = extrairConsumoKwh(busca)
  const marcas              = extrairMarcas(busca)
  const tecnologias         = extrairTecnologias(busca)
  const tokens_normalizados = extrairTokensNormalizados(busca)

  // Confiança do parse: soma ponderada dos sinais encontrados (0–1)
  let sinais = 0
  if (potencia_alvo_kwp)           sinais += 0.35
  if (consumo_kwh_mes)             sinais += 0.20
  if (marcas.paineis.length > 0)   sinais += 0.20
  if (marcas.inversores.length > 0)sinais += 0.15
  if (tecnologias.length > 0)      sinais += 0.10
  const confianca_parse = Math.min(1, Math.round(sinais * 100) / 100)

  return {
    busca_original:       busca,
    busca_normalizada,
    potencia_alvo_kwp,
    consumo_kwh_mes,
    marcas,
    tecnologias,
    tokens_normalizados,  // ← readiness embedding: vetores futuros aqui
    meta: {
      tem_marca_painel:   marcas.paineis.length > 0,
      tem_marca_inversor: marcas.inversores.length > 0,
      tem_potencia:       potencia_alvo_kwp !== null,
      tem_consumo:        consumo_kwh_mes !== null,
      tem_tecnologia:     tecnologias.length > 0,
      confianca_parse,
      tokens_count:       tokens_normalizados.length,
    },
  }
}
