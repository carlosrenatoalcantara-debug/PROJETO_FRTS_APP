/**
 * Electrical Calculations for Diagram Editor
 * Recalcula parâmetros elétricos quando o diagrama é modificado
 * Segue normas NBR 5410 (Brasil)
 */

/**
 * Tabela NBR 5410 de capacidade de cabos de cobre
 * Isolação: 0,6/1kV, temperatura ambiente: 40°C
 */
const TABELA_COBRE = [
  { bitola: 1.5, capacidade_a: 15.5 },
  { bitola: 2.5, capacidade_a: 21 },
  { bitola: 4, capacidade_a: 28 },
  { bitola: 6, capacidade_a: 36 },
  { bitola: 10, capacidade_a: 50 },
  { bitola: 16, capacidade_a: 68 },
  { bitola: 25, capacidade_a: 89 },
  { bitola: 35, capacidade_a: 109 },
  { bitola: 50, capacidade_a: 134 },
  { bitola: 70, capacidade_a: 170 },
  { bitela: 95, capacidade_a: 207 },
  { bitola: 120, capacidade_a: 239 },
  { bitola: 150, capacidade_a: 272 },
  { bitola: 185, capacidade_a: 309 },
  { bitola: 240, capacidade_a: 360 }
];

/**
 * Disjuntores normalizados (curva C)
 */
const DISJUNTORES_NORMALIZADOS = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200];

/**
 * Recalcular parâmetros quando um nó é modificado
 * @param {Array} nodes - Todos os nós do diagrama
 * @param {string} nodeModificadoId - ID do nó que foi modificado
 * @returns {Array} Nós atualizados com novos cálculos
 */
export function recalcularDiagrama(nodes, nodeModificadoId) {
  // Encontrar nó modificado e atualizar dados
  const nodesAtualizados = [...nodes];
  const gridNode = nodesAtualizados.find(n => n.data.tipo === 'rede');
  const breakerNode = nodesAtualizados.find(n => n.data.tipo === 'disjuntor');
  const cableNode = nodesAtualizados.find(n => n.data.tipo === 'cabo');
  const chargerNode = nodesAtualizados.find(n => n.data.tipo === 'carregador');

  if (!gridNode || !breakerNode || !cableNode || !chargerNode) {
    return nodes;
  }

  // Pegar valores atuais
  let corrente_projeto_a = gridNode.data.corrente_projeto_a || 32.5;
  let bitola_atual = cableNode.data.bitola_mm2 || 6;
  let comprimento_m = cableNode.data.comprimento_m || 10;

  // Se potência do carregador mudou, recalcular corrente
  if (nodeModificadoId === chargerNode.id && chargerNode.data.potencia_kw) {
    const tensao = gridNode.data.tensao === '220V' ? 220 : 380;
    const fator_potencia = 0.95;
    const fator_raiz3 = Math.sqrt(3);

    corrente_projeto_a = chargerNode.data.potencia_kw * 1000 / (tensao * fator_raiz3 * fator_potencia);
    gridNode.data.corrente_projeto_a = corrente_projeto_a;
    gridNode.data.label = `REDE\n${corrente_projeto_a.toFixed(1)}A`;
  }

  // Se comprimento do cabo mudou, recalcular bitola
  if (nodeModificadoId === cableNode.id) {
    comprimento_m = cableNode.data.comprimento_m || comprimento_m;
    const novabitola = calcularBitola(corrente_projeto_a, comprimento_m);
    bitola_atual = novabitola;
    cableNode.data.bitola_mm2 = novabitola;
    cableNode.data.label = `CABO\n${novabitola}mm²`;
  }

  // Recalcular queda de tensão
  const queda_tensao_pct = calcularQuedaTensao(
    corrente_projeto_a,
    comprimento_m,
    bitola_atual,
    gridNode.data.tensao === '220V' ? 220 : 380
  );

  // Recalcular disjuntor baseado em corrente
  const corrente_maxima = corrente_projeto_a * 1.25; // Margem de segurança NBR 5410
  const disjuntor = calcularDisjuntor(corrente_maxima);
  breakerNode.data.corrente_a = disjuntor;
  breakerNode.data.label = `DISJUNTOR\n${disjuntor}A`;

  // Atualizar specs node
  const specsNode = nodesAtualizados.find(n => n.data.tipo === 'specs');
  if (specsNode) {
    specsNode.data.queda_tensao_pct = queda_tensao_pct;
    specsNode.data.tempo_seccionamento_s = calcularTempoSeccionamento(
      gridNode.data.tensao === '220V' ? 220 : 380
    );
  }

  return nodesAtualizados;
}

/**
 * Calcular bitola de cabo necessária
 * Segue tabela NBR 5410 com fator de segurança 1.25
 * @param {number} corrente_a - Corrente em amperes
 * @param {number} comprimento_m - Comprimento do cabo em metros
 * @returns {number} Bitola em mm²
 */
function calcularBitola(corrente_a, comprimento_m) {
  const corrente_seguranca = corrente_a * 1.25;

  // Verificar queda de tensão também
  let bitolaMinima = 6; // Mínimo técnico usual para alimentadores

  // Encontrar primeira bitola que suporta a corrente
  for (const item of TABELA_COBRE) {
    if (item.capacidade_a >= corrente_seguranca) {
      bitolaMinima = item.bitola;
      break;
    }
  }

  // Verificar se queda de tensão está OK
  const queda = calcularQuedaTensao(corrente_a, comprimento_m, bitolaMinima, 380);
  if (queda > 3) {
    // Se queda > 3%, aumentar bitola
    const proximaBitola = TABELA_COBRE.find(
      item => item.bitola > bitolaMinima
    );
    if (proximaBitola) {
      bitolaMinima = proximaBitola.bitola;
    }
  }

  return bitolaMinima;
}

/**
 * Calcular queda de tensão
 * Fórmula: V = 2 × R × L × I / 1000, onde R = 0.0179 Ω·mm²/m para cobre @ 70°C
 * @param {number} corrente_a - Corrente em A
 * @param {number} comprimento_m - Comprimento em m
 * @param {number} bitola_mm2 - Bitola em mm²
 * @param {number} tensao_v - Tensão da rede em V
 * @returns {number} Queda de tensão em percentual (0-100)
 */
function calcularQuedaTensao(corrente_a, comprimento_m, bitola_mm2, tensao_v) {
  const resistividade = 0.0179; // Ω·mm²/m para cobre @ 70°C
  const queda_tensao_v = (2 * resistividade * comprimento_m * corrente_a) / bitola_mm2;
  return (queda_tensao_v / tensao_v) * 100;
}

/**
 * Calcular disjuntor normalizado
 * Seleciona o primeiro valor normalizado que é >= corrente máxima
 * @param {number} corrente_maxima_a - Corrente máxima em A
 * @returns {number} Corrente do disjuntor em A
 */
function calcularDisjuntor(corrente_maxima_a) {
  for (const valor of DISJUNTORES_NORMALIZADOS) {
    if (valor >= corrente_maxima_a) {
      return valor;
    }
  }
  // Se nenhum valor normalizado cabe, retorna o máximo
  return DISJUNTORES_NORMALIZADOS[DISJUNTORES_NORMALIZADOS.length - 1];
}

/**
 * Calcular tempo de seccionamento baseado em tensão
 * NBR 5410: Tabela 31
 * @param {number} tensao_v - Tensão em V
 * @returns {number} Tempo em segundos
 */
function calcularTempoSeccionamento(tensao_v) {
  if (tensao_v <= 50) return 5;
  if (tensao_v <= 120) return 0.4;
  return 0.2;
}

/**
 * Validar se os parâmetros estão dentro das normas
 * @param {Object} calculos - Objeto com corrente_a, bitola_mm2, comprimento_m, tensao_v
 * @returns {Object} { valido: boolean, avisos: [], erros: [] }
 */
export function validarParametrosNBR5410(calculos) {
  const { corrente_a, bitola_mm2, comprimento_m, tensao_v = 380 } = calculos;
  const avisos = [];
  const erros = [];

  if (!corrente_a || corrente_a <= 0) {
    erros.push('Corrente inválida');
  }

  if (!bitola_mm2 || bitola_mm2 <= 0) {
    erros.push('Bitola inválida');
  }

  if (!comprimento_m || comprimento_m <= 0) {
    erros.push('Comprimento inválido');
  }

  // Verificar capacidade do cabo
  const cabo = TABELA_COBRE.find(c => c.bitola === bitola_mm2);
  if (cabo && cabo.capacidade_a < corrente_a * 1.25) {
    avisos.push(
      `Cabo ${bitola_mm2}mm² pode estar subdimensionado (capacidade: ${cabo.capacidade_a}A)`
    );
  }

  // Verificar queda de tensão
  const queda = calcularQuedaTensao(corrente_a, comprimento_m, bitola_mm2, tensao_v);
  if (queda > 3) {
    avisos.push(`Queda de tensão alta: ${queda.toFixed(2)}% (máximo: 3%)`);
  }

  return {
    valido: erros.length === 0,
    avisos,
    erros,
    queda_tensao_pct: queda
  };
}

/**
 * Gerar lista de materiais baseado nos parâmetros
 * @param {Object} nodeData - Dados dos nós do diagrama
 * @returns {Array} Lista de materiais
 */
export function gerarListaMateriais(nodeData) {
  const charger = nodeData.find(n => n.data.tipo === 'carregador');
  const breaker = nodeData.find(n => n.data.tipo === 'disjuntor');
  const cable = nodeData.find(n => n.data.tipo === 'cabo');
  const dr = nodeData.find(n => n.data.tipo === 'dr');

  const materiais = [];

  if (charger) {
    materiais.push({
      item: 'Carregador EV',
      especificacao: `${charger.data.tipo_carregador} ${charger.data.potencia_kw}kW - ${charger.data.marca} ${charger.data.modelo}`,
      quantidade: 1
    });
  }

  if (cable) {
    materiais.push({
      item: 'Cabo de alimentação',
      especificacao: `${cable.data.bitola_mm2} mm² (Cu, 0,6/1kV)`,
      quantidade: cable.data.comprimento_m * 1.1 // +10% para segurança
    });
  }

  if (breaker) {
    materiais.push({
      item: 'Disjuntor termomagnético',
      especificacao: `${breaker.data.corrente_a}A Curva C`,
      quantidade: 1
    });
  }

  if (dr) {
    materiais.push({
      item: 'Dispositivo DR',
      especificacao: `${dr.data.ma}mA Tipo A`,
      quantidade: 1
    });
  }

  materiais.push({
    item: 'Eletroduto rígido/conduíte',
    especificacao: 'Proteção mecânica',
    quantidade: cable?.data.comprimento_m || 10
  });

  return materiais;
}

/**
 * Ranges válidos para cada campo
 * Valores fora destes ranges serão rejeitados
 */
const RANGES_VALIDOS = {
  'rede.corrente_projeto_a': { min: 1, max: 200, unidade: 'A' },
  'disjuntor.corrente_a': { min: 6, max: 200, unidade: 'A' },
  'dr.ma': { min: 10, max: 300, unidade: 'mA' },
  'cable.bitola_mm2': { min: 1.5, max: 240, unidade: 'mm²' },
  'cable.comprimento_m': { min: 0.1, max: 1000, unidade: 'm' },
  'carregador.potencia_kw': { min: 3.7, max: 22, unidade: 'kW' }
};

/**
 * Validar um valor de campo antes de permitir edição
 * @param {string} nodeType - Tipo do nó (rede, disjuntor, etc)
 * @param {string} campo - Nome do campo
 * @param {number|string} valor - Novo valor
 * @returns {Object} { valido: boolean, erro?: string }
 */
export function validarValorCampo(nodeType, campo, valor) {
  const chave = `${nodeType}.${campo}`;
  const range = RANGES_VALIDOS[chave];

  if (!range) {
    // Campo não tem validação definida, permitir
    return { valido: true };
  }

  // Converter para número
  const numValue = parseFloat(valor);

  // Verificar se é número válido
  if (isNaN(numValue)) {
    return {
      valido: false,
      erro: `❌ ${campo} deve ser um número válido`
    };
  }

  // Verificar se está no range
  if (numValue < range.min || numValue > range.max) {
    return {
      valido: false,
      erro: `❌ ${campo} deve estar entre ${range.min} e ${range.max} ${range.unidade}`
    };
  }

  return { valido: true };
}

/**
 * Validar fluxo elétrico completo do diagrama
 * Verifica se componentes obrigatórios existem e se há conexões válidas
 * @param {Array} nodes - Array de nós
 * @returns {Object} { valido: boolean, erros: Array<string> }
 */
export function validarFluxoEletricoCompleto(nodes) {
  const erros = [];

  // Componentes obrigatórios
  const temRede = nodes.some(n => n.data.tipo === 'rede');
  const temCarregador = nodes.some(n => n.data.tipo === 'carregador');

  if (!temRede) {
    erros.push('❌ REDE (origem) é obrigatória');
  }

  if (!temCarregador) {
    erros.push('❌ CARREGADOR (destino) é obrigatório');
  }

  // Verificar se há valores inválidos
  const nodeRede = nodes.find(n => n.data.tipo === 'rede');
  if (nodeRede) {
    const { valido } = validarValorCampo('rede', 'corrente_projeto_a', nodeRede.data.corrente_projeto_a);
    if (!valido) {
      erros.push('❌ REDE: corrente inválida');
    }
  }

  const nodeCabo = nodes.find(n => n.data.tipo === 'cabo');
  if (nodeCabo) {
    const validBitola = validarValorCampo('cable', 'bitola_mm2', nodeCabo.data.bitola_mm2);
    const validComprimento = validarValorCampo('cable', 'comprimento_m', nodeCabo.data.comprimento_m);

    if (!validBitola.valido) {
      erros.push('❌ CABO: bitola inválida');
    }
    if (!validComprimento.valido) {
      erros.push('❌ CABO: comprimento inválido');
    }
  }

  const nodeCarregador = nodes.find(n => n.data.tipo === 'carregador');
  if (nodeCarregador) {
    const { valido } = validarValorCampo('carregador', 'potencia_kw', nodeCarregador.data.potencia_kw);
    if (!valido) {
      erros.push('❌ CARREGADOR: potência inválida');
    }
  }

  return {
    valido: erros.length === 0,
    erros
  };
}
