/**
 * React Flow Helpers
 * Converte dados de diagrama SVG para estrutura React Flow
 * e gerencia posicionamento automático de nós
 */

/**
 * Converter dados de cálculos NBR 5410 para nodes e edges React Flow
 * @param {Object} calculos - Objeto com resultados de calcularParametrosNBR5410
 * @param {Object} projeto - Dados do projeto (nome, cliente, endereço)
 * @returns {Object} { nodes: [], edges: [] }
 */
export function converterCalculosParaNodesEdges(calculos, projeto) {
  const nodePositions = {
    grid: { x: 100, y: 50 },
    breaker: { x: 100, y: 150 },
    dps: { x: 100, y: 225 },
    dr: { x: 100, y: 300 },
    cable: { x: 100, y: 400 },
    charger: { x: 100, y: 500 },
    specs: { x: 400, y: 50 }
  };

  // Nó 1: REDE (Grid/Power Source)
  const gridNode = {
    id: 'grid-1',
    type: 'gridNodeRealista',
    position: nodePositions.grid,
    data: {
      tipo: 'rede',
      nome: 'REDE',
      fases: projeto.tensao || 'Trifásico',
      tensao: projeto.tensao === 'monofasico' ? '220V' : '380V',
      corrente_projeto_a: calculos.corrente_projeto_a,
      label: `REDE\n${calculos.corrente_projeto_a?.toFixed(1)}A`,
      editable: true
    }
  };

  // Nó 2: DISJUNTOR (Main Breaker)
  const breakerNode = {
    id: 'breaker-1',
    type: 'breakerNodeRealista',
    position: nodePositions.breaker,
    data: {
      tipo: 'disjuntor',
      nome: 'DISJUNTOR',
      corrente_a: calculos.disjuntor_a,
      corrente_maxima_a: calculos.corrente_maxima_a,
      label: `DISJUNTOR\n${calculos.disjuntor_a}A`,
      editable: true
    }
  };

  // Nó 2.5: DPS (Surge Protection) - OBRIGATÓRIO
  const dpsNode = {
    id: 'dps-1',
    type: 'dpsNodeRealista',
    position: nodePositions.dps,
    data: {
      tipo: 'dps',
      nome: 'DPS',
      tensao_kv: calculos.dps_kv,
      capacidade_a: calculos.dps_capacidade_a,
      label: `DPS\n${calculos.dps_kv}V`,
      editable: true,
      obrigatorio: true
    }
  };

  // Nó 3: DR (Differential Protection)
  const drNode = {
    id: 'dr-1',
    type: 'drNodeRealista',
    position: nodePositions.dr,
    data: {
      tipo: 'dr',
      nome: 'DR',
      ma: calculos.dr_ma,
      label: `DR\n${calculos.dr_ma}mA`,
      editable: true
    }
  };

  // Nó 4: CABO (Cable)
  const cableNode = {
    id: 'cable-1',
    type: 'cableNodeRealista',
    position: nodePositions.cable,
    data: {
      tipo: 'cabo',
      nome: 'CABO',
      bitola_mm2: calculos.bitola_cabo_mm2,
      comprimento_m: projeto.comprimento_cabo || 10,
      label: `CABO\n${calculos.bitola_cabo_mm2}mm²`,
      editable: true
    }
  };

  // Nó 5: CARREGADOR (EV Charger)
  const chargerNode = {
    id: 'charger-1',
    type: 'chargerNodeRealista',
    position: nodePositions.charger,
    data: {
      tipo: 'carregador',
      nome: 'CARREGADOR',
      potencia_kw: projeto.carregador_potencia_kw,
      tipo_carregador: projeto.carregador_tipo || 'AC Trifásico',
      marca: projeto.carregador_marca,
      modelo: projeto.carregador_modelo,
      label: `CARREGADOR\n${projeto.carregador_potencia_kw}kW`,
      editable: true
    }
  };

  // Nó 6: ESPECIFICAÇÕES (Info Panel - não é na vertical flow, é ao lado)
  const specsNode = {
    id: 'specs-1',
    type: 'specsNode',
    position: nodePositions.specs,
    data: {
      tipo: 'specs',
      nome: 'ESPECIFICAÇÕES',
      queda_tensao_pct: calculos.queda_tensao_pct,
      tempo_seccionamento_s: calculos.tempo_seccionamento_s,
      materiais: calculos.materiais || [],
      projeto_nome: projeto.projeto_nome,
      cliente_nome: projeto.cliente_nome,
      endereco: projeto.endereco,
      tecnico_nome: projeto.tecnico_nome,
      tecnico_crea: projeto.tecnico_crea,
      editable: false
    }
  };

  const nodes = [gridNode, breakerNode, dpsNode, drNode, cableNode, chargerNode, specsNode];

  // Edges: conexões lineares de cima para baixo
  const edges = [
    {
      id: 'grid-breaker',
      source: 'grid-1',
      target: 'breaker-1',
      type: 'smoothstep',
      animated: false,
      data: { tipo: 'ca' }
    },
    {
      id: 'breaker-dps',
      source: 'breaker-1',
      target: 'dps-1',
      type: 'smoothstep',
      animated: false,
      data: { tipo: 'ca' }
    },
    {
      id: 'dps-dr',
      source: 'dps-1',
      target: 'dr-1',
      type: 'smoothstep',
      animated: false,
      data: { tipo: 'ca' }
    },
    {
      id: 'dr-cable',
      source: 'dr-1',
      target: 'cable-1',
      type: 'smoothstep',
      animated: false,
      data: { tipo: 'ca' }
    },
    {
      id: 'cable-charger',
      source: 'cable-1',
      target: 'charger-1',
      type: 'smoothstep',
      animated: false,
      data: { tipo: 'ca' }
    }
  ];

  return { nodes, edges };
}

/**
 * Obter configuração de cores e estilos por tipo de nó
 * @param {string} tipo - Tipo de nó (rede, disjuntor, dr, cabo, carregador)
 * @returns {Object} Configuração de cores e estilos
 */
export function obterEstiloNode(tipo) {
  const estilos = {
    rede: {
      background: '#f97316',
      border: '2px solid #ea580c',
      color: '#fff'
    },
    disjuntor: {
      background: '#3b82f6',
      border: '2px solid #1d4ed8',
      color: '#fff'
    },
    dps: {
      background: '#ff6b35',
      border: '3px solid #e85922',
      color: '#fff'
    },
    dr: {
      background: '#8b5cf6',
      border: '2px solid #7c3aed',
      color: '#fff'
    },
    cabo: {
      background: '#10b981',
      border: '2px solid #059669',
      color: '#fff'
    },
    carregador: {
      background: '#ec4899',
      border: '2px solid #db2777',
      color: '#fff'
    },
    specs: {
      background: '#f3f4f6',
      border: '2px solid #d1d5db',
      color: '#1f2937'
    },
    customizado: {
      background: '#fbbf24',
      border: '2px solid #f59e0b',
      color: '#1f2937'
    }
  };

  return estilos[tipo] || estilos.rede;
}

/**
 * Validar se um diagrama tem todos os nós mínimos necessários
 * @param {Array} nodes - Array de nós
 * @returns {Object} { valido: boolean, erros: [] }
 */
export function validarDiagrama(nodes) {
  const tiposObrigatorios = ['rede', 'disjuntor', 'dps', 'dr', 'cabo', 'carregador'];
  const tiposPresentes = nodes.map(n => n.data.tipo);

  const erros = tiposObrigatorios.filter(
    tipo => !tiposPresentes.includes(tipo)
  ).map(tipo => {
    if (tipo === 'dps') {
      return `❌ Componente OBRIGATÓRIO faltando: DPS (Proteção contra Surtos)`;
    }
    return `Falta componente obrigatório: ${tipo}`;
  });

  return {
    valido: erros.length === 0,
    erros
  };
}

/**
 * Exportar diagrama como JSON
 * @param {Array} nodes - Nós do diagrama
 * @param {Array} edges - Arestas do diagrama
 * @returns {string} JSON stringificado
 */
export function exportarDiagrama(nodes, edges) {
  return JSON.stringify({ nodes, edges }, null, 2);
}

/**
 * Importar diagrama de JSON
 * @param {string} jsonString - JSON do diagrama
 * @returns {Object} { nodes: [], edges: [] } ou null se inválido
 */
export function importarDiagrama(jsonString) {
  try {
    const diagrama = JSON.parse(jsonString);
    if (diagrama.nodes && diagrama.edges) {
      return diagrama;
    }
    return null;
  } catch (e) {
    console.error('Erro ao importar diagrama:', e);
    return null;
  }
}

/**
 * Resetar posições dos nós (layout automático)
 * @param {Array} nodes - Array de nós
 * @returns {Array} Nós com posições reorganizadas
 */
export function resetarPosicoes(nodes) {
  const nodePositions = {
    grid: { x: 100, y: 50 },
    breaker: { x: 100, y: 150 },
    dr: { x: 100, y: 250 },
    cable: { x: 100, y: 350 },
    charger: { x: 100, y: 450 },
    specs: { x: 400, y: 50 }
  };

  return nodes.map(node => ({
    ...node,
    position: nodePositions[node.data.tipo] || node.position
  }));
}
