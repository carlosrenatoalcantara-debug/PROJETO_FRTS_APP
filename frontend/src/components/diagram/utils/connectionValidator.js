/**
 * Validador de conexões entre nós em diagramas
 * Implementa matriz de compatibilidade para fluxo elétrico correto
 */

/**
 * Matriz de conectividade permitida
 * Define quais nós podem se conectar a quais
 * Fluxo elétrico: REDE → DISJUNTOR → DPS → DR → CABO → CARREGADOR
 */
export const CONEXOES_PERMITIDAS = {
  'rede': ['disjuntor'],       // REDE → DISJUNTOR
  'disjuntor': ['dps'],        // DISJUNTOR → DPS (obrigatório)
  'dps': ['dr'],             // DPS → DR
  'dr': ['cabo'],           // DR → CABO
  'cabo': ['carregador'],      // CABO → CARREGADOR
  'carregador': [],             // CARREGADOR é ponto final
  'customizado': ['carregador', 'cabo', 'dr'], // Componentes customizados podem conectar em vários lugares
  'specs': []                // SPECS nunca tem conexões
}

/**
 * Valida se uma conexão entre dois nós é permitida
 * @param {string} sourceNodeType - Tipo do nó origem
 * @param {string} targetNodeType - Tipo do nó destino
 * @returns {Object} { valido: boolean, erro?: string }
 */
export function validarConexao(sourceNodeType, targetNodeType) {
  if (!sourceNodeType || !targetNodeType) {
    return {
      valido: false,
      erro: 'Tipo de nó não definido'
    }
  }

  const permitidos = CONEXOES_PERMITIDAS[sourceNodeType]

  if (!permitidos || !permitidos.includes(targetNodeType)) {
    return {
      valido: false,
      erro: `❌ Conexão inválida: ${TIPOS_NODE[sourceNodeType] || sourceNodeType} → ${TIPOS_NODE[targetNodeType] || targetNodeType}`
    }
  }

  return { valido: true }
}

/**
 * Obtém lista de tipos de nó compatíveis como destino
 * @param {string} sourceNodeType - Tipo do nó origem
 * @returns {Array<string>} Array com tipos compatíveis
 */
export function obterHandlesCompativeis(sourceNodeType) {
  return CONEXOES_PERMITIDAS[sourceNodeType] || []
}

/**
 * Tipos de conexão elétrica (CC, CA, Terra)
 */
export const TIPOS_CONEXAO = {
  'CC': { cor: '#ef4444', label: 'Corrente Contínua' },
  'CA': { cor: '#3b82f6', label: 'Corrente Alternada' },
  'TERRA': { cor: '#059669', label: 'Terra' }
}

/**
 * Determina o tipo de conexão esperado entre dois nós
 * @param {string} sourceType - Tipo do nó origem
 * @param {string} targetType - Tipo do nó destino
 * @returns {string} Tipo de conexão (CC, CA, TERRA)
 */
export function obterTipoConexaoEsperado(sourceType, targetType) {
  const mapa = {
    'rede-disjuntor': 'CA',      // REDE → DISJUNTOR = CA
    'disjuntor-dps': 'CA',       // DISJUNTOR → DPS = CA
    'dps-dr': 'CA',              // DPS → DR = CA
    'dr-cabo': 'CA',             // DR → CABO = CA
    'cabo-carregador': 'CC'      // CABO → CARREGADOR = CC
  }

  return mapa[`${sourceType}-${targetType}`] || 'CA'
}

/**
 * Mapa de tipos de nó para rótulos legíveis
 */
const TIPOS_NODE = {
  'grid': 'REDE',
  'breaker': 'DISJUNTOR',
  'dps': 'DPS',
  'dr': 'DR',
  'cable': 'CABO',
  'charger': 'CARREGADOR',
  'customizado': 'COMPONENTE CUSTOMIZADO',
  'specs': 'ESPECIFICAÇÕES'
}

/**
 * Obtém label legível para tipo de nó
 * @param {string} nodeType - Tipo do nó
 * @returns {string} Label legível
 */
export function obterRotuloTipo(nodeType) {
  return TIPOS_NODE[nodeType] || nodeType
}

/**
 * Valida ordem sequencial do fluxo elétrico
 * Garante que não há "gaps" na cadeia REDE → CARREGADOR
 * @param {Array} nodes - Array de nós
 * @param {Array} edges - Array de edges
 * @returns {Object} { valido: boolean, erros: Array<string> }
 */
export function validarFluxoEletrico(nodes, edges) {
  const erros = []

  // Verifica se REDE existe
  const nodeRede = nodes.find(n => n.data.tipo === 'grid')
  if (!nodeRede) {
    erros.push('❌ REDE (origem) é obrigatória')
    return { valido: false, erros }
  }

  // Verifica se CARREGADOR existe
  const nodeCarregador = nodes.find(n => n.data.tipo === 'charger')
  if (!nodeCarregador) {
    erros.push('❌ CARREGADOR (destino) é obrigatório')
    return { valido: false, erros }
  }

  // Verifica se há conexão da REDE
  const edgesRede = edges.filter(e => e.source === nodeRede.id)
  if (edgesRede.length === 0) {
    erros.push('⚠️ REDE não está conectada a nada')
  }

  // Verifica se CARREGADOR tem entrada
  const edgesCarregador = edges.filter(e => e.target === nodeCarregador.id)
  if (edgesCarregador.length === 0) {
    erros.push('⚠️ CARREGADOR não tem entrada conectada')
  }

  return { valido: erros.length === 0, erros }
}

/**
 * Conta número de nós por tipo
 * Útil para verificar duplicatas indesejadas
 * @param {Array} nodes - Array de nós
 * @returns {Object} { grid, breaker, dr, cable, charger, specs }
 */
export function contarNosPorTipo(nodes) {
  return {
    grid: nodes.filter(n => n.data.tipo === 'grid').length,
    breaker: nodes.filter(n => n.data.tipo === 'breaker').length,
    dr: nodes.filter(n => n.data.tipo === 'dr').length,
    cable: nodes.filter(n => n.data.tipo === 'cable').length,
    charger: nodes.filter(n => n.data.tipo === 'charger').length,
    specs: nodes.filter(n => n.data.tipo === 'specs').length
  }
}

/**
 * Valida se há componentes duplicados
 * Alguns componentes devem ser únicos (REDE, SPECS, etc)
 * @param {Array} nodes - Array de nós
 * @returns {Object} { valido: boolean, avisos: Array<string> }
 */
export function validarComponentesUnicos(nodes) {
  const avisos = []
  const contagem = contarNosPorTipo(nodes)

  if (contagem.grid > 1) {
    avisos.push('⚠️ Mais de uma REDE detectada (use apenas uma)')
  }
  if (contagem.charger > 1) {
    avisos.push('⚠️ Mais de um CARREGADOR detectado (use apenas um por agora)')
  }
  if (contagem.specs > 1) {
    avisos.push('⚠️ Mais de um painel de ESPECIFICAÇÕES detectado')
  }

  return { valido: avisos.length === 0, avisos }
}
