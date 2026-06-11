/**
 * normalizer.js — S2.9 ETL SolarMarket
 *
 * Responsabilidade: transformar itens brutos do SolarMarket para o
 * schema canônico do Equipamento (Forte Solar).
 *
 * Regras:
 *  - Forte Solar é a fonte de verdade — SM é referência comercial auxiliar
 *  - Nunca sobrescreve dados enriquecidos pelo Gemini (origem 'datasheet_gemini')
 *  - Hash único: sha256(fabricante_normalizado + '|' + modelo_normalizado)
 *  - Classificação de tipo por heurística de nome/categoria
 *
 * S2.9.3: Camada semântica de variáveis integrada via variablesNormalizer.js.
 * Exporta normalizarVariables() para uso direto pelo importer/pipeline.
 */

import crypto from 'crypto'

// S2.9.3: re-exporta normalização de variables da proposta SM
export {
  normalizarVariables,
  resolverAlias,
  estatisticasAliasIndex,
} from './variablesNormalizer.js'

// ─── Mapeamento direto de categorias SM → tipos Forte Solar ──────────────
// Descoberto em S2.9.1: SM usa categorias explícitas no pricingTable.
// Isso tem prioridade sobre a inferência por regex.

const CATEGORIA_SM_PARA_TIPO = {
  'Módulo':     'modulo',
  'Inversor':   'inversor',
  'Componente': null,  // inferido pelo nome (estrutura, etc.)
  'KIT':        null,  // ignorado pelo extractor — só chega aqui se passado explicitamente
}

// ─── Mapeamento por regex (fallback / Componentes) ────────────────────────

const TIPO_MAP = [
  // Módulos / Painéis
  { tipo: 'modulo', regex: /m[oó]dul|painel|panel|placa|fotovoltai|pv\s*module|bifacial|mono[- ]?cristal|poli[- ]?cristal|half[- ]?cell|topcon|hjt|perc/i },
  // Inversores
  { tipo: 'inversor', regex: /inversor|inverter|micro[- ]?invers|string\s*inv|on[- ]?grid|off[- ]?grid|grid[- ]?tied|microinverter/i },
  // Estruturas / Suportes
  { tipo: 'estrutura', regex: /estrutura|suporte|fixação|fixing|rack|trilho|clamp|grampo|gancho|telhado|telha|cobertura|ground[- ]?mount/i },
  // Baterias
  { tipo: 'bateria', regex: /bateria|battery|acumul|armazena|ess|bess|lifepo|lítio|lithium|gel\s*battery/i },
  // Carregador EV
  { tipo: 'carregador_ev', regex: /carregador.*ve[íi]culo|ev\s*charger|evse|wallbox|eletroposto|ponto\s*de\s*carga/i },
]

// Palavras que indicam equipamento de suporte (não equipamento principal)
const SKIP_REGEX = /serviço|service|instalação|installation|mão\s*de\s*obra|mao\s*de\s*obra|manutenção|frete|entrega|desconto|taxa|garantia\s*estendida/i

// ─── Normalização de strings ───────────────────────────────────────────────

/**
 * Normaliza fabricante/modelo para geração de hash único.
 * Remove espaços extras, acentos, converte para uppercase.
 *
 * @param {string} str
 * @returns {string}
 */
export function normalizarTexto(str) {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // remove acentos
    .toUpperCase()
    .replace(/[^A-Z0-9\-_.]/g, ' ')   // mantém apenas alfanum + alguns símbolos
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normalização agressiva: mantém APENAS alfanumérico (A-Z, 0-9), sem espaço,
 * sem hífen, sem barra, sem asterisco. Usado exclusivamente para matching
 * tolerante no índice flexível — NÃO altera o hash_unico canônico.
 *
 * Exemplos:
 *   "JAM72S30-550/MR"     → "JAM72S30550MR"
 *   "MIN 5000TL-X"        → "MIN5000TLX"
 *   "HY-M10/144H 575W"   → "HYM10144H575W"
 *   "LP182*199-M-66-NH"   → "LP182199M66NH"
 *
 * @param {string} str
 * @returns {string}
 */
export function normalizarAgressive(str) {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

/**
 * Gera hash único SHA-256 (10 primeiros chars = suficiente para dedup).
 *
 * @param {string} fabricanteNorm
 * @param {string} modeloNorm
 * @returns {string}
 */
export function gerarHash(fabricanteNorm, modeloNorm) {
  const entrada = `${fabricanteNorm}|${modeloNorm}`
  return crypto.createHash('sha256').update(entrada).digest('hex').slice(0, 24)
}

// ─── Classificação de tipo ─────────────────────────────────────────────────

/**
 * Infere o tipo de equipamento a partir da categoria SM (prioridade) ou regex.
 *
 * SM expõe categorias explícitas no pricingTable:
 *   "Módulo" → 'modulo', "Inversor" → 'inversor', "Componente" → inferir por nome
 *
 * @param {object} item  Item bruto SM
 * @returns {string|null}  'modulo' | 'inversor' | 'estrutura' | 'bateria' | 'carregador_ev' | null
 */
export function inferirTipo(item) {
  // 1ª prioridade: categoria SM explícita
  const categoriaSM = item.categoria || item._sm_raw?.category
  if (categoriaSM && CATEGORIA_SM_PARA_TIPO[categoriaSM] !== undefined) {
    const tipoDireto = CATEGORIA_SM_PARA_TIPO[categoriaSM]
    if (tipoDireto) return tipoDireto
    // null = "Componente" → continua para inferência por regex
  }

  // 2ª prioridade: inferência por regex no texto completo
  const texto = [
    item.categoria,
    item.nome,
    item.modelo,
    item._sm_raw?.category,
    item._sm_raw?.subcategory,
    item._sm_raw?.type,
  ]
    .filter(Boolean)
    .join(' ')

  for (const { tipo, regex } of TIPO_MAP) {
    if (regex.test(texto)) return tipo
  }

  return null
}

// ─── Extração de especificações ───────────────────────────────────────────

/**
 * Extrai potência em watts de um item SM.
 * Tenta múltiplos campos e formatos (ex: "550W", "5KW", "5.5 kW").
 *
 * @param {object} item  Item bruto SM
 * @returns {number|null}  Potência em watts
 */
function extrairPotenciaW(item) {
  const raw = item._sm_raw || {}

  // Campos diretos
  const candidatos = [
    raw.power_w, raw.power, raw.potencia_w, raw.potencia,
    raw.watt, raw.watts, raw.wp, raw.peak_power,
  ]

  for (const v of candidatos) {
    const n = parseFloat(v)
    if (!isNaN(n) && n > 0) {
      // Se parece ser kW (valor muito pequeno), converte
      if (n < 20) return Math.round(n * 1000)
      return Math.round(n)
    }
  }

  // Tenta extrair de nome/modelo (ex: "BYD 550W", "Deye 5kW")
  const textos = [item.nome, item.modelo, raw.description].filter(Boolean).join(' ')
  const matchW  = textos.match(/(\d+(?:[.,]\d+)?)\s*[Ww](?:att)?(?!\w)/)
  const matchKW = textos.match(/(\d+(?:[.,]\d+)?)\s*[Kk][Ww](?:att)?(?!\w)/)

  if (matchKW) return Math.round(parseFloat(matchKW[1].replace(',', '.')) * 1000)
  if (matchW)  return Math.round(parseFloat(matchW[1].replace(',', '.')))

  return null
}

/**
 * Extrai especificações extras do item SM que possam ter valor técnico.
 *
 * @param {object} item   Item bruto SM
 * @param {string} tipo   Tipo inferido ('modulo', 'inversor', etc.)
 * @returns {object}      Especificações parciais
 */
function extrairEspecificacoes(item, tipo) {
  const raw   = item._sm_raw || {}
  const specs = {}

  // Potência sempre tenta extrair
  const potW = extrairPotenciaW(item)
  if (potW) {
    if (tipo === 'modulo') {
      specs.potencia_w    = potW
      specs.potencia_pico = potW
    } else if (tipo === 'inversor') {
      specs.potencia_kw      = parseFloat((potW / 1000).toFixed(2))
      specs.potencia_nominal = specs.potencia_kw
    } else {
      specs.potencia_w = potW
    }
  }

  // Campos técnicos extras se presentes no SM
  const mapa = {
    // modulo
    eficiencia:        raw.efficiency || raw.eficiencia,
    celulas:           raw.cells || raw.celulas,
    tipo_celula:       raw.cell_type || raw.tipo_celula,
    voc:               raw.voc || raw.open_circuit_voltage,
    isc:               raw.isc || raw.short_circuit_current,
    // inversor
    mppt:              raw.mppt || raw.num_mppt,
    fases:             raw.phases || raw.fases,
    tensao_saida:      raw.output_voltage || raw.tensao_saida,
    // geral
    peso_kg:           raw.weight || raw.peso,
    dimensoes:         raw.dimensions || raw.dimensoes,
    ip:                raw.ip_rating || raw.ip,
    garantia_produto:  raw.warranty || raw.garantia || raw.warranty_years,
  }

  for (const [chave, valor] of Object.entries(mapa)) {
    if (valor !== undefined && valor !== null && valor !== '') {
      specs[chave] = valor
    }
  }

  return Object.keys(specs).length > 0 ? specs : {}
}

// ─── Normalização principal ───────────────────────────────────────────────

/**
 * Normaliza um item bruto do SolarMarket para o schema Equipamento.
 *
 * @param {object} itemBruto  Item do extractor (extrai lineItems)
 * @returns {NormalizationResult|null}  null se item deve ser descartado
 *
 * @typedef {object} NormalizationResult
 * @property {object}  equipamento     Payload compatível com Equipamento schema
 * @property {object}  meta            Metadados da normalização
 * @property {boolean} valido          false = foi rejeitado pelo validator interno
 * @property {string[]} alertas        Avisos não-fatais
 */
export function normalizar(itemBruto) {
  const alertas = []

  // ── Filtro rápido: serviços, descontos, etc. ─────────────────────────────
  const textoCompleto = [itemBruto.nome, itemBruto.categoria, itemBruto.modelo].filter(Boolean).join(' ')
  if (SKIP_REGEX.test(textoCompleto)) {
    return null  // descarta silenciosamente
  }

  // ── Fabricante ────────────────────────────────────────────────────────────
  let fabricante = itemBruto.marca || extrairFabricanteDoNome(itemBruto.nome)
  if (!fabricante) {
    return null  // sem fabricante, inútil para catálogo
  }
  fabricante = titleCase(fabricante.trim())

  // ── Modelo ────────────────────────────────────────────────────────────────
  let modelo = extrairModelo(itemBruto)
  if (!modelo) {
    alertas.push('modelo ausente — usando nome completo como modelo')
    modelo = itemBruto.nome?.trim() || null
  }
  if (!modelo) return null

  modelo = modelo.trim()

  // ── Tipo ──────────────────────────────────────────────────────────────────
  const tipo = inferirTipo(itemBruto)
  if (!tipo) {
    alertas.push('tipo não identificado — item pode ser ignorado pelo matcher')
  }

  // ── Hash único ────────────────────────────────────────────────────────────
  const fabricanteNorm = normalizarTexto(fabricante)
  const modeloNorm     = normalizarTexto(modelo)
  const hashUnico      = gerarHash(fabricanteNorm, modeloNorm)

  // ── Especificações ────────────────────────────────────────────────────────
  const especificacoes = extrairEspecificacoes(itemBruto, tipo)

  // ── Preço ─────────────────────────────────────────────────────────────────
  let precoSugerido = null
  if (itemBruto.preco_unitario && itemBruto.preco_unitario > 0) {
    precoSugerido = parseFloat(itemBruto.preco_unitario.toFixed(2))
  } else if (itemBruto.preco_total && itemBruto.quantidade > 0) {
    precoSugerido = parseFloat((itemBruto.preco_total / itemBruto.quantidade).toFixed(2))
  }

  // ── Payload Equipamento ───────────────────────────────────────────────────
  const equipamento = {
    // Campos obrigatórios
    tipo:       tipo || 'modulo',  // fallback necessário para schema (required)
    fabricante,
    modelo,
    // Especificações
    especificacoes: Object.keys(especificacoes).length > 0 ? especificacoes : {},
    // Preço (só atualiza se SM tiver dado)
    ...(precoSugerido !== null ? { preco_sugerido: precoSugerido } : {}),

    // Campos S2.6.1 — origem e identificação
    origem: {
      tipo:     'import_solarmarket',
      fonte:    'solarmarket_api_v2',
      arquivo_original_url: null,
      em:       new Date(),
    },
    identificacao: {
      fabricante_normalizado: fabricanteNorm,
      modelo_normalizado:     modeloNorm,
      hash_unico:             hashUnico,
      aliases:                [],
    },

    // Status (importação do SM não garante qualidade máxima)
    _schema_versao: '2.0',
    ativo: true,
  }

  return {
    equipamento,
    meta: {
      sm_proposta_id: itemBruto._sm_proposta_id,
      sm_item_id:     itemBruto._sm_item_id,
      hash_unico:     hashUnico,
      tipo_inferido:  tipo,
      tem_preco:      precoSugerido !== null,
      tem_specs:      Object.keys(especificacoes).length > 0,
    },
    valido: !!tipo,   // tipo identificado = mais confiança
    alertas,
  }
}

/**
 * Normaliza um array de itens brutos.
 * Descarta nulos (itens não-equipamento) e duplicatas por hash.
 *
 * @param {Array} itensBrutos
 * @returns {{ normalizados: Array, descartados: number, duplicatasPorHash: number }}
 */
export function normalizarLote(itensBrutos) {
  const vistos = new Set()
  const normalizados = []
  let descartados = 0
  let duplicatasPorHash = 0

  for (const item of itensBrutos) {
    try {
      const resultado = normalizar(item)

      if (!resultado) {
        descartados++
        continue
      }

      // Deduplica por hash dentro do lote
      const { hash_unico } = resultado.meta
      if (vistos.has(hash_unico)) {
        duplicatasPorHash++
        continue
      }
      vistos.add(hash_unico)

      normalizados.push(resultado)
    } catch (err) {
      descartados++
      console.warn('[SM:normalizer] Erro ao normalizar item:', err.message)
    }
  }

  return { normalizados, descartados, duplicatasPorHash }
}

// ─── Helpers de texto ──────────────────────────────────────────────────────

/**
 * Tenta extrair fabricante do nome completo do produto.
 * Heurística: primeira palavra se parece ser uma marca conhecida.
 *
 * @param {string|null} nome
 * @returns {string|null}
 */
function extrairFabricanteDoNome(nome) {
  if (!nome) return null

  // Marcas conhecidas no mercado FV
  const MARCAS = [
    'Canadian Solar', 'Jinko', 'JA Solar', 'Longi', 'LONGi', 'Trina',
    'BYD', 'REC', 'Risen', 'Seraphim', 'Hanwha', 'Q Cells', 'Q.Cells',
    'Deye', 'Solis', 'Growatt', 'Huawei', 'SMA', 'ABB', 'Fronius', 'Sofar',
    'Goodwe', 'SAJ', 'Chint', 'Delta', 'Kostal', 'SolarEdge', 'Enphase',
    'Aldo Solar', 'Elgin', 'WEG', 'Schneider',
    'Unirac', 'K2', 'Schletter', 'Romagnole', 'Renovigi', 'Solar Group',
    'Zerobyte', 'Nexo', 'ForteMax', 'IcSolar', 'Yingli',
  ]

  const nomeLower = nome.toLowerCase()
  for (const marca of MARCAS) {
    if (nomeLower.includes(marca.toLowerCase())) {
      return marca
    }
  }

  // Fallback: primeira palavra capitalizada (assumindo "Marca Modelo XY")
  const palavras = nome.trim().split(/\s+/)
  if (palavras.length >= 2 && /^[A-Z]/.test(palavras[0])) {
    return palavras[0]
  }

  return null
}

/**
 * Extrai modelo do item SM.
 * Tenta campo modelo direto, depois remove o fabricante do nome.
 *
 * @param {object} item
 * @returns {string|null}
 */
function extrairModelo(item) {
  // Campo modelo direto
  if (item.modelo && item.modelo.length > 1) return item.modelo

  // Remove fabricante do nome para isolar o modelo
  if (item.nome && item.marca) {
    const marcaPattern = new RegExp(
      item.marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i'
    )
    const semMarca = item.nome.replace(marcaPattern, '').trim()
    if (semMarca.length > 2) return semMarca
  }

  // Usa SKU/código como modelo se disponível
  const raw = item._sm_raw || {}
  const sku = raw.sku || raw.codigo || raw.code || raw.part_number
  if (sku && sku.length > 2) return String(sku)

  // Fallback: nome completo
  return item.nome || null
}

/**
 * Converte string para Title Case.
 *
 * @param {string} str
 * @returns {string}
 */
function titleCase(str) {
  return str
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
}
