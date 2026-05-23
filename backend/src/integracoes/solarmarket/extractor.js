/**
 * extractor.js — S2.9 ETL SolarMarket
 *
 * Responsabilidade: autenticação + extração de dados brutos da API SolarMarket v2.
 *
 * Arquitetura (descoberta em S2.9.1 validação real):
 *  - SolarMarket é um CRM de projetos fotovoltaicos da Forte Solar
 *  - URL base: https://business.solarmarket.com.br/api/v2
 *  - Auth: POST /auth/signin { token: SOLARMARKET_API_KEY } → access_token JWT
 *  - Projetos: GET /projects → 638 projetos, pagina 100/página
 *  - Propostas: GET /projects/:id/proposals → proposta com pricingTable[]
 *  - pricingTable contém: Módulo, Inversor, Componente, KIT, Instalação
 *  - NÃO existe: /proposals, /products, /kits, /catalog
 *
 * Categorias relevantes para catálogo de equipamentos:
 *  - "Módulo"     → painel fotovoltaico
 *  - "Inversor"   → inversor solar
 *  - "Componente" → estrutura, proteções (filtrado por nome)
 *  - "KIT"        → ignorado (preço agregado, não equipamento individual)
 *  - "Instalação" → ignorado (serviço)
 *
 * Rate limits: 60 req/min → delay de 1.1s entre chamadas.
 * Token JWT: válido por ~6h → cacheado em memória por sessão.
 *
 * O extractor é SOMENTE LEITURA — nunca escreve no SolarMarket.
 */

const SM_BASE_URL = process.env.SOLARMARKET_API_URL  || 'https://business.solarmarket.com.br/api/v2'
const SM_API_KEY  = process.env.SOLARMARKET_API_KEY  || ''

// ─── Categorias úteis para o catálogo ────────────────────────────────────
// Componentes de cabo são excluídos — apenas estruturas são relevantes
const CATEGORIAS_EQUIPAMENTO  = ['Módulo', 'Inversor']
const CATEGORIA_COMPONENTE     = 'Componente'
const COMPONENTES_RELEVANTES   = /estrutura|suporte|fixação|fixing|trilho|rack|stringbox|protetor/i
const COMPONENTES_SKIP         = /cabo|cable|conector|connector|fio|wire|fusível|disjuntor/i

// ─── Cache de token em memória ─────────────────────────────────────────────
let _tokenCache = null  // { token: string, expiresAt: Date }

// ─── Rate-limit helper ─────────────────────────────────────────────────────
const RATE_DELAY_MS = 1100  // ~54 req/min (margem abaixo de 60)

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Auth ──────────────────────────────────────────────────────────────────

/**
 * Obtém um token JWT válido.
 * Reutiliza o cache se ainda não expirou (com margem de 5 min).
 *
 * Formato real descoberto em S2.9.1:
 *   POST /auth/signin { "token": "<SOLARMARKET_API_KEY>" }
 *   Response: { "access_token": "eyJ..." }
 *
 * @returns {Promise<string>} Bearer token JWT
 * @throws  {Error} se credenciais ausentes ou login falhar
 */
export async function obterToken() {
  if (!SM_API_KEY) {
    throw new Error(
      '[SolarMarket] Credencial ausente. Configure SOLARMARKET_API_KEY no .env\n' +
      '  Formato: SOLARMARKET_API_KEY=userId:apiKey (ex: 6059:iQANRf...)'
    )
  }

  // Reutiliza cache se válido (com margem de 5 min)
  const agora = new Date()
  if (_tokenCache && _tokenCache.expiresAt > agora) {
    return _tokenCache.token
  }

  console.log('[SM:extractor] Autenticando na API SolarMarket...')
  const res = await fetch(`${SM_BASE_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // IMPORTANTE: SM usa { token: API_KEY }, não email+password
    body: JSON.stringify({ token: SM_API_KEY }),
  })

  if (!res.ok) {
    const corpo = await res.text()
    throw new Error(`[SM:extractor] Login falhou HTTP ${res.status}: ${corpo.slice(0, 300)}`)
  }

  const dados  = await res.json()
  // SM retorna { access_token: "eyJ..." }
  const token  = dados.access_token || dados.token || dados.accessToken || dados.jwt

  if (!token) {
    throw new Error(
      `[SM:extractor] Resposta de login sem token. Keys recebidas: ${JSON.stringify(Object.keys(dados))}`
    )
  }

  // Token válido por ~6h (360 min) — guardamos com margem de 5 min
  const expiresAt = new Date(agora.getTime() + (360 - 5) * 60 * 1000)
  _tokenCache = { token, expiresAt }
  console.log(`[SM:extractor] ✅ JWT obtido. Válido até ${expiresAt.toISOString()}`)

  return token
}

/**
 * Limpa o cache de token (útil em testes ou após 401).
 */
export function limparCacheToken() {
  _tokenCache = null
}

// ─── HTTP helper com autenticação ─────────────────────────────────────────

/**
 * Wrapper de fetch autenticado.
 * Renova o token automaticamente em caso de 401.
 */
async function smFetch(path, opts = {}, _retry = false) {
  const token = await obterToken()
  const url   = `${SM_BASE_URL}${path}`

  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...opts.headers,
    },
  })

  if (res.status === 401 && !_retry) {
    console.warn('[SM:extractor] Token expirado. Renovando...')
    limparCacheToken()
    return smFetch(path, opts, true)
  }

  if (!res.ok) {
    const corpo = await res.text()
    throw new Error(`[SM:extractor] HTTP ${res.status} ${path}: ${corpo.slice(0, 200)}`)
  }

  return res.json()
}

// ─── Paginação de projetos ─────────────────────────────────────────────────

/**
 * Pagina GET /projects com rate-limit respeitado.
 * Resposta SM: { pagination: { totalItems, totalPages }, data: [...] }
 *
 * @param {number} limite  0 = sem limite
 * @returns {Promise<Array>} Array de projetos
 */
async function paginarProjetos(limite = 0) {
  const PER_PAGE = 100
  const projetos = []
  let   pagina   = 1
  let   total    = null

  while (true) {
    const dados = await smFetch(`/projects?page=${pagina}&limit=${PER_PAGE}`)
    await sleep(RATE_DELAY_MS)

    const registros = dados.data || []
    if (total === null) total = dados.pagination?.totalItems ?? registros.length

    projetos.push(...registros)

    const atingiuLimite = limite > 0 && projetos.length >= limite
    const ultimaPagina  = registros.length < PER_PAGE || projetos.length >= total

    if (atingiuLimite || ultimaPagina) break
    pagina++
  }

  return limite > 0 ? projetos.slice(0, limite) : projetos
}

// ─── Endpoints de extração ────────────────────────────────────────────────

/**
 * Busca lista de projetos paginada.
 *
 * @param {object} opcoes
 * @param {number} [opcoes.limite=0]  0 = sem limite
 * @returns {Promise<Array>}
 */
export async function buscarProjetos({ limite = 0 } = {}) {
  console.log(`[SM:extractor] Buscando projetos... (limite=${limite || 'sem limite'})`)
  const projetos = await paginarProjetos(limite)
  console.log(`[SM:extractor] ${projetos.length} projetos encontrados`)
  return projetos
}

/**
 * Alias para compatibilidade — usa buscarProjetos internamente.
 * @deprecated use buscarProjetos
 */
export const buscarPropostas = buscarProjetos

/**
 * Busca a proposta de um projeto (inclui pricingTable com equipamentos).
 * SM expõe: GET /projects/:identifier/proposals → { data: { pricingTable: [...], variables: [...] } }
 *
 * @param {number|string} projetoIdentifier  Identificador sequencial do projeto (não o UUID)
 * @returns {Promise<object|null>}
 */
export async function buscarPropostaDoProjeto(projetoIdentifier) {
  try {
    const dados = await smFetch(`/projects/${projetoIdentifier}/proposals`)
    await sleep(RATE_DELAY_MS)
    return dados.data || dados
  } catch (err) {
    // Projeto pode não ter proposta — ignora 404
    if (err.message.includes('HTTP 404') || err.message.includes('404')) {
      return null
    }
    throw err
  }
}

/**
 * @deprecated use buscarPropostaDoProjeto
 */
export const buscarPropostaDetalhe = buscarPropostaDoProjeto

/**
 * Tenta buscar endpoints /products, /kits (graciosamente ignora 404).
 * Descoberto em S2.9.1 que esses endpoints não existem no SM.
 *
 * @returns {Promise<Array>}  Sempre vazio na versão atual da API SM
 */
export async function buscarProdutos() {
  // SM v2 não tem endpoint de catálogo de produtos direto
  // Deixamos o stub para compatibilidade caso a API evolua
  return []
}

// ─── Extração de line items de uma proposta ────────────────────────────────

/**
 * Determina se um item da categoria "Componente" é relevante para o catálogo.
 *
 * @param {string} nomeItem  Nome do componente (ex: "ESTRUTURA SOLAR ROMAGNOLE...")
 * @returns {boolean}
 */
function componenteEhRelevante(nomeItem) {
  if (!nomeItem) return false
  if (COMPONENTES_SKIP.test(nomeItem))     return false  // cabo, conector → skip
  if (COMPONENTES_RELEVANTES.test(nomeItem)) return true   // estrutura, suporte → ok
  return false
}

/**
 * Extrai line items de equipamentos de uma proposta SM.
 * Formato real: proposta.pricingTable = [{ category, item, qnt, unitCost, salesValue }]
 *
 * @param {object} proposta  Proposta retornada por buscarPropostaDoProjeto()
 * @param {number} projetoId Identificador do projeto pai
 * @returns {Array}          Items normalizados para o normalizer
 */
function extrairLineItemsDaProposta(proposta, projetoId) {
  if (!proposta?.pricingTable?.length) return []

  const resultados = []

  for (const item of proposta.pricingTable) {
    const categoria = item.category || ''
    const nomeItem  = item.item || ''

    // Filtra por categoria relevante
    const ehEquipamento = CATEGORIAS_EQUIPAMENTO.includes(categoria)
    const ehComponenteRelevante = categoria === CATEGORIA_COMPONENTE
      && componenteEhRelevante(nomeItem)

    if (!ehEquipamento && !ehComponenteRelevante) continue

    // Divide "MARCA MODELO" do campo item SM (ex: "JINKO JKM540M-72HL4-V")
    const { marca, modelo } = parsearNomeSM(nomeItem, categoria)

    // Preço: SM frequentemente tem unit_cost=0 para itens individuais
    // O preço real está no KIT, não no item individual
    const precoUnitario = item.unitCost > 0
      ? item.unitCost
      : (item.salesValue > 0 && item.qnt > 0 ? item.salesValue / item.qnt : null)

    resultados.push({
      _sm_projeto_id: projetoId,
      _sm_item_id:    null,
      _sm_raw:        item,
      nome:           nomeItem,
      marca:          marca || null,
      modelo:         modelo || nomeItem,
      categoria:      categoria,
      quantidade:     parseFloat(item.qnt) || 1,
      preco_unitario: precoUnitario,
      preco_total:    item.totalCost || null,
      unidade:        'un',
    })
  }

  return resultados
}

/**
 * Parseia o campo "item" do pricingTable SM para extrair marca e modelo.
 * SM retorna strings em UPPERCASE como "JINKO JKM540M-72HL4-V" ou
 * "ESTRUTURA SOLAR ROMAGNOLE 412135 RS-327...".
 *
 * @param {string} nomeCompleto  Campo `item` do pricingTable
 * @param {string} categoria     "Módulo", "Inversor", "Componente"
 * @returns {{ marca: string|null, modelo: string|null }}
 */
function parsearNomeSM(nomeCompleto, categoria) {
  if (!nomeCompleto) return { marca: null, modelo: null }

  const nome = nomeCompleto.trim()

  // ── Marcas conhecidas no mercado FV (em ordem de especificidade) ─────────
  const MARCAS_FV = [
    // Módulos
    'CANADIAN SOLAR', 'CANADIAN', 'JINKO SOLAR', 'JINKO',
    'JA SOLAR', 'LONGI', 'TRINA SOLAR', 'TRINA',
    'BYD', 'REC', 'RISEN', 'SERAPHIM', 'HANWHA',
    'QCELLS', 'Q CELLS', 'Q.CELLS',
    'YINGLI', 'PHONO SOLAR', 'PHONO',
    'ELGIN', 'WEG', 'ICSolar',
    // Inversores
    'DEYE', 'SOLIS', 'GROWATT', 'HUAWEI', 'SMA',
    'ABB', 'FRONIUS', 'SOFAR', 'GOODWE', 'SAJ',
    'CHINT', 'DELTA', 'KOSTAL', 'SOLAREDGE', 'ENPHASE',
    'SCHNEIDER', 'WEG',
    // Estruturas
    'ROMAGNOLE', 'K2 SYSTEMS', 'K2', 'SCHLETTER', 'UNIRAC',
    'SOLAR GROUP', 'ZEROBYTE', 'NEXO',
    // Distribuidores (não são fabricantes mas aparecem em nomes SM)
    // (Aldo Solar, Renovigi → NÃO são fabricantes, mas aparecem nos nomes de KIT)
  ]

  // Tenta identificar a marca pelo início do nome
  for (const marca of MARCAS_FV) {
    if (nome.toUpperCase().startsWith(marca)) {
      const modelo = nome.slice(marca.length).trim()
      return {
        marca:  titleCaseMarca(marca),
        modelo: modelo.length > 2 ? modelo : nomeCompleto,
      }
    }
  }

  // Para "ESTRUTURA SOLAR ROMAGNOLE ..." → marca = ROMAGNOLE
  if (categoria === CATEGORIA_COMPONENTE) {
    const matchEstrutura = nome.match(/^ESTRUTURA\s+SOLAR\s+(\w+)\s+(.+)$/i)
    if (matchEstrutura) {
      return {
        marca:  titleCaseMarca(matchEstrutura[1]),
        modelo: matchEstrutura[2].trim(),
      }
    }
  }

  // Fallback: primeira palavra como marca, resto como modelo
  const partes = nome.split(/\s+/)
  if (partes.length >= 2) {
    return {
      marca:  titleCaseMarca(partes[0]),
      modelo: partes.slice(1).join(' '),
    }
  }

  return { marca: null, modelo: nome }
}

/**
 * Converte uma marca de UPPERCASE para Title Case preservando acrônimos curtos.
 * Ex: "GROWATT" → "Growatt", "SMA" → "SMA", "K2" → "K2", "CANADIAN SOLAR" → "Canadian Solar"
 *
 * @param {string} str
 * @returns {string}
 */
function titleCaseMarca(str) {
  // Acrônimos curtos (≤3 chars ou contêm número): mantém uppercase
  return str
    .split(/\s+/)
    .map(word => (word.length <= 3 || /\d/.test(word)) ? word.toUpperCase() : capitalize(word))
    .join(' ')
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

// ─── Pipeline principal de extração ──────────────────────────────────────

/**
 * Pipeline principal de extração.
 * Itera projetos → propostas → extrai pricingTable de equipamentos.
 *
 * @param {object} opcoes
 * @param {number} [opcoes.limitePropostas=0]   0 = sem limite (limita projetos)
 * @param {boolean} [opcoes.incluirProdutos=false]  Ignorado — SM não tem endpoint de produtos
 * @returns {Promise<ExtractionResult>}
 *
 * @typedef {object} ExtractionResult
 * @property {Array}  lineItems   Items brutos de equipamentos
 * @property {Array}  produtos    Sempre vazio (SM não tem endpoint de produtos)
 * @property {object} meta        Estatísticas
 */
export async function extrairEquipamentos({
  limitePropostas = 0,
  incluirProdutos = false,
} = {}) {
  const meta = {
    projetos_buscados:     0,
    projetos_com_proposta: 0,
    projetos_sem_proposta: 0,
    line_items_brutos:     0,
    produtos_buscados:     0,
    erros:                 [],
    iniciado_em:           new Date().toISOString(),
  }

  // 1. Busca projetos paginados
  let projetos
  try {
    projetos = await buscarProjetos({ limite: limitePropostas })
    meta.projetos_buscados = projetos.length
  } catch (err) {
    meta.erros.push(`buscarProjetos: ${err.message}`)
    meta.finalizado_em = new Date().toISOString()
    return { lineItems: [], produtos: [], meta }
  }

  // 2. Para cada projeto, busca proposta e extrai pricingTable
  const lineItems = []

  for (const projeto of projetos) {
    const projetoId = projeto.identifier || projeto.id
    try {
      const proposta = await buscarPropostaDoProjeto(projetoId)

      if (!proposta || !proposta.pricingTable?.length) {
        meta.projetos_sem_proposta++
        continue
      }

      const itens = extrairLineItemsDaProposta(proposta, projetoId)
      if (itens.length > 0) {
        meta.projetos_com_proposta++
        lineItems.push(...itens)
      } else {
        meta.projetos_sem_proposta++
      }
    } catch (err) {
      meta.erros.push(`projeto ${projetoId}: ${err.message}`)
    }
  }

  meta.line_items_brutos = lineItems.length
  meta.finalizado_em     = new Date().toISOString()

  console.log(`\n[SM:extractor] Extração concluída:`)
  console.log(`  Projetos: ${meta.projetos_buscados} (${meta.projetos_com_proposta} com equipamentos)`)
  console.log(`  Line items: ${meta.line_items_brutos}`)
  if (meta.erros.length > 0) console.warn(`  Erros: ${meta.erros.length}`)

  return { lineItems, produtos: [], meta }
}
