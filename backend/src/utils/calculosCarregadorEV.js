/**
 * Cálculos e validações para Carregadores de Veículos Elétricos
 * Conforme ABNT NBR 17019:2022, NBR 5410:2004, NBR IEC 61851-1:2021
 * E requisitos do Corpo de Bombeiros do RN (RT-05-2025)
 */

// Tabela de bitolas conforme NBR 5410
const TABELA_BITOLAS = {
  // Corrente (A) -> { bitola_minima_mm2, capacidade_amperes_cu, dist_max_5pct }
  10: { bitola: 1.5, capacidade: 13, dist_max_5pct: 38 },
  16: { bitola: 2.5, capacidade: 17.5, dist_max_5pct: 27 },
  20: { bitola: 2.5, capacidade: 17.5, dist_max_5pct: 27 },
  25: { bitola: 4, capacidade: 27, dist_max_5pct: 50 },
  32: { bitola: 6, capacidade: 34, dist_max_5pct: 73 },
  40: { bitola: 10, capacidade: 50, dist_max_5pct: 121 },
  50: { bitola: 16, capacidade: 68, dist_max_5pct: 205 },
  63: { bitola: 25, capacidade: 89, dist_max_5pct: 339 },
  80: { bitola: 35, capacidade: 113, dist_max_5pct: 476 },
  100: { bitola: 50, capacidade: 134, dist_max_5pct: 571 },
}

const MODOS_OPERACAO = {
  1: {
    nome: 'Recarga Normal (Residencial)',
    descricao: 'Tomada convencional, proteção no quadro',
    tensao: '230V monofásico',
    corrente_max: 16,
    tipo_conector: 'Tomada convencional',
    aplicacao: 'Residências, carga lenta (6-8h)',
  },
  2: {
    nome: 'Recarga Portátil',
    descricao: 'Dispositivo de proteção portátil (CPSE)',
    tensao: '230V ou 400V',
    corrente_max: 32,
    tipo_conector: 'Conector específico com CPSE',
    aplicacao: 'Soluções temporárias ou emergenciais',
  },
  3: {
    nome: 'Recarga Dedicada com Wall Box',
    descricao: 'Wall box com comunicação bidirecional',
    tensao: '230V ou 400V (trifásico)',
    corrente_max: 32,
    tipo_conector: 'IEC 62196-2 (Type 2)',
    aplicacao: 'Garagens, estacionamentos, condomínios (6-8h)',
  },
  4: {
    nome: 'Recarga Rápida DC',
    descricao: 'Carregador DC com conversão AC/DC',
    tensao: '400V a 920V DC',
    corrente_max: 350,
    tipo_conector: 'CCS (Combined Charging System) ou CHAdeMO',
    aplicacao: 'Estações públicas de recarga rápida (20-30min)',
  },
}

/**
 * Calcula a corrente de projeto conforme NBR 5410
 * I_projeto = (P / V) × 1.25 (fator de segurança)
 *
 * @param {number} potencia_kw - Potência do carregador em kW
 * @param {number} tensao_v - Tensão de alimentação em Volts
 * @returns {object} { corrente_calculada, corrente_comercial, fator_seguranca }
 */
function calcularCorrenteProjetoNBR5410(potencia_kw, tensao_v = 230) {
  const potencia_w = potencia_kw * 1000
  const fator_seguranca = 1.25
  const corrente_calculada = (potencia_w / tensao_v) * fator_seguranca

  // Encontrar valor comercial mais próximo (arredondar para cima)
  const valores_comerciais = [10, 16, 20, 25, 32, 40, 50, 63, 80, 100]
  const corrente_comercial = valores_comerciais.find(
    (val) => val >= corrente_calculada
  ) || valores_comerciais[valores_comerciais.length - 1]

  return {
    corrente_calculada: parseFloat(corrente_calculada.toFixed(2)),
    corrente_comercial,
    fator_seguranca,
    unidade: 'A',
    norma: 'NBR 5410:2004',
  }
}

/**
 * Calcula a bitola do condutor conforme NBR 5410
 * Considera capacidade de corrente e queda de tensão máxima de 3%
 *
 * @param {number} corrente_a - Corrente de projeto em Amperes
 * @param {number} comprimento_m - Comprimento da instalação em metros
 * @param {number} queda_tensao_max - Queda de tensão máxima permitida (%)
 * @returns {object} { bitola_mm2, queda_tensao_real, recomendacao }
 */
function calcularBitolaNBR5410(
  corrente_a,
  comprimento_m,
  queda_tensao_max = 3,
  tensao_v = 230
) {
  // Encontrar bitola pela corrente
  const fila_bitolas = Object.values(TABELA_BITOLAS)
  let bitola_recomendada = fila_bitolas[0].bitola

  for (const [, dados] of Object.entries(TABELA_BITOLAS)) {
    if (dados.capacidade >= corrente_a) {
      bitola_recomendada = dados.bitola
      break
    }
  }

  // Verificar queda de tensão (fórmula: ΔU = (2 × ρ × L × I) / S)
  const resistividade_cobre = 0.0175 // Ω·mm²/m
  const queda_tensao_calculada =
    (2 * resistividade_cobre * comprimento_m * corrente_a) / bitola_recomendada

  const queda_tensao_percentual = (queda_tensao_calculada / tensao_v) * 100

  // Se queda de tensão exceder o máximo, aumentar a bitola
  let bitola_final = bitola_recomendada
  if (queda_tensao_percentual > queda_tensao_max) {
    const opcoes_bitolas = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120]
    for (const bitola of opcoes_bitolas) {
      const queda = (2 * resistividade_cobre * comprimento_m * corrente_a) / bitola
      const queda_pct = (queda / tensao_v) * 100
      if (queda_pct <= queda_tensao_max) {
        bitola_final = bitola
        break
      }
    }
  }

  const queda_final =
    (2 * resistividade_cobre * comprimento_m * corrente_a) / bitola_final
  const queda_final_pct = (queda_final / tensao_v) * 100

  return {
    bitola_mm2: bitola_final,
    bitola_calculada: bitola_recomendada,
    queda_tensao_real: parseFloat(queda_final_pct.toFixed(2)),
    queda_tensao_max: queda_tensao_max,
    queda_tensao_ok: queda_final_pct <= queda_tensao_max,
    unidade_bitola: 'mm²',
    unidade_queda: '%',
    norma: 'NBR 5410:2004',
  }
}

/**
 * Calcula os parâmetros do disjuntor conforme NBR 5410
 * I_disjuntor = 1.3 × I_projeto (máximo permitido)
 *
 * @param {number} corrente_a - Corrente de projeto em Amperes
 * @returns {object} { disjuntor_A, curva_recomendada, norma }
 */
function calcularDisjuntorNBR5410(corrente_a) {
  // Disjuntor máximo permitido = 1.3 × I_projeto
  const disjuntor_max = corrente_a * 1.3

  // Valores comerciais de disjuntores
  const valores_comerciais = [10, 16, 20, 25, 32, 40, 50, 63, 80, 100]
  const disjuntor_recomendado = valores_comerciais.find(
    (val) => val >= disjuntor_max
  ) || valores_comerciais[valores_comerciais.length - 1]

  // Definir curva baseado na aplicação
  let curva = 'C' // Padrão para cargas normais
  if (corrente_a <= 16) {
    curva = 'B' // Para cargas com inrush suave
  }

  return {
    disjuntor_a: disjuntor_recomendado,
    disjuntor_max_permitido: parseFloat(disjuntor_max.toFixed(2)),
    curva_recomendada: curva,
    tipo: `Disjuntor ${disjuntor_recomendado}A Curva ${curva}`,
    norma: 'NBR 5410:2004',
  }
}

/**
 * Valida e retorna informações do DR (Dispositivo de Proteção Diferencial)
 * Conforme NBR IEC 61851-1:2021
 * Obrigatório: 30mA máximo
 *
 * @returns {object} { corrente_fuga_max_ma, tipo_recomendado, norma }
 */
function obterEspecificacaoDRNBREIEC618511() {
  return {
    corrente_fuga_max_ma: 30,
    tipo_recomendado: 'Tipo AC',
    tipos_disponiveis: ['Tipo AC', 'Tipo A', 'Tipo B'],
    descricao:
      'Dispositivo de Proteção Diferencial Residual (DR) obrigatório para carregadores EV',
    norma: 'NBR IEC 61851-1:2021',
    observacao:
      'Usar Tipo AC padrão. Tipo A para cargas com corrente contínua. Tipo B para instalações com harmônicos significativos.',
  }
}

/**
 * Retorna informações sobre o modo de operação do carregador
 * Conforme NBR IEC 61851-1:2021
 *
 * @param {number} modo - Modo de operação (1, 2, 3 ou 4)
 * @returns {object} Especificações do modo
 */
function obterModoOperacao(modo) {
  return {
    ...MODOS_OPERACAO[modo],
    modo,
    norma: 'NBR IEC 61851-1:2021',
  }
}

/**
 * Retorna especificações do conector conforme NBR IEC 62196
 *
 * @param {string} tipo_conector - Tipo de conector (Type2, Tesla, CCS, CHAdeMO)
 * @returns {object} Especificações do conector
 */
function obterEspecificacaoConector(tipo_conector) {
  const conectores = {
    'IEC 62196-2 (Type 2)': {
      nome: 'IEC 62196-2 (Mennekes Type 2)',
      corrente_max_a: 32,
      tensao_max_v: 400,
      fase: 'Monofásico ou Trifásico',
      uso: 'Padrão europeu para Modo 3',
      norma: 'ABNT NBR IEC 62196-2:2021',
    },
    'Tesla Supercharger': {
      nome: 'Tesla Proprietary Connector',
      corrente_max_a: 250,
      tensao_max_v: 920,
      fase: 'DC (Modo 4)',
      uso: 'Recarga rápida DC exclusiva Tesla',
      norma: 'Especificação proprietária',
    },
    'CCS (Combined Charging System)': {
      nome: 'CCS Combo 2',
      corrente_max_a: 350,
      tensao_max_v: 920,
      fase: 'AC (Modo 3) + DC (Modo 4)',
      uso: 'Padrão internacional para AC+DC',
      norma: 'ABNT NBR IEC 62196-3:2021',
    },
    'CHAdeMO': {
      nome: 'CHAdeMO (CHArge de MOve)',
      corrente_max_a: 350,
      tensao_max_v: 500,
      fase: 'DC (Modo 4)',
      uso: 'Padrão asiático para recarga rápida',
      norma: 'ABNT NBR IEC 62196-3:2021',
    },
  }

  return conectores[tipo_conector] || conectores['IEC 62196-2 (Type 2)']
}

/**
 * Calcula resistência de aterramento conforme NBR 5410
 * Máximo permitido: 10Ω (preferível < 5Ω)
 *
 * @param {number} resistencia_medida_ohms - Resistência medida em Ohms
 * @returns {object} { resistencia_medida, max_permitida, conforme, recomendacao }
 */
function validarAteramentoNBR5410(resistencia_medida_ohms) {
  const max_permitida = 10
  const recomendada = 5

  return {
    resistencia_medida: resistencia_medida_ohms,
    max_permitida,
    recomendada,
    conforme: resistencia_medida_ohms <= max_permitida,
    conforme_recomendado: resistencia_medida_ohms <= recomendada,
    status:
      resistencia_medida_ohms <= recomendada
        ? '✓ Excelente'
        : resistencia_medida_ohms <= max_permitida
          ? '⚠ Aceitável (considere melhorar)'
          : '✗ Não conforme (aumentar eletrodos)',
    unidade: 'Ω',
    norma: 'NBR 5410:2004',
  }
}

/**
 * Gera checklist completo de conformidade com normas
 *
 * @param {object} dados_projeto - Dados do projeto EV
 * @returns {object} Checklist de conformidade
 */
function gerarChecklistConformidadeNormas(dados_projeto) {
  return {
    normas_aplicadas: [
      'ABNT NBR 17019:2022',
      'ABNT NBR 5410:2004',
      'ABNT NBR IEC 61851-1:2021',
      'ABNT NBR IEC 62196-1/2/3:2021',
      'ABNT NBR 5419:2026 (se SPDA)',
      'Corpo de Bombeiros RN - RT-05-2025 (Requisitos regionais)',
    ],
    checklist: {
      informacoes_gerais: {
        'Modo de operação definido': !!dados_projeto.modo_operacao,
        'Tensão de alimentação especificada': !!dados_projeto.tensao_sistema,
        'Potência do carregador definida': !!dados_projeto.carregadores?.[0]?.potencia_kw,
        'Comprimento da instalação informado': !!dados_projeto.comprimento_cabo_m,
      },
      calculos_dimensionamento: {
        'Corrente de projeto calculada (NBR 5410)': !!dados_projeto.calculos_nbr?.corrente_projeto_a,
        'Bitola do condutor definida (NBR 5410)': !!dados_projeto.calculos_nbr?.bitola_cabo_mm2,
        'Queda de tensão verificada (máx 3%)': (dados_projeto.calculos_nbr?.queda_tensao_pct || 0) <= 3,
        'Disjuntor dimensionado (NBR 5410)': !!dados_projeto.calculos_nbr?.disjuntor_a,
      },
      protecoes: {
        'DR 30mA especificado (NBR IEC 61851-1)': dados_projeto.calculos_nbr?.dr_ma === 30,
        'Aterramento < 10Ω (NBR 5410)': (dados_projeto.resistencia_aterramento_ohms || 0) <= 10,
        'Tipo de conector definido (NBR IEC 62196)': !!dados_projeto.tipo_conector,
        'SPDA especificado (se ao ar livre)': !dados_projeto.conformidade_norms?.spda_necessario || !!dados_projeto.conformidade_norms?.spda_necessario === false,
      },
      seguranca: {
        'Sinalização de segurança planejada': true, // TODO: Adicionar campo
        'Acesso restrito/seguro': true, // TODO: Adicionar campo
        'ART registrada': true, // TODO: Adicionar campo
        'Manual de operação disponível': true, // TODO: Adicionar campo
      },
    },
  }
}

/**
 * Determina o modo de operação recomendado baseado no tipo de carregador
 * Conforme NBR IEC 61851-1:2021
 *
 * @param {string} tipo_carregador - Tipo: AC_Mono, AC_Tri, DC
 * @param {number} potencia_kw - Potência em kW (opcional)
 * @returns {number} Modo (1, 2, 3 ou 4)
 */
export function determinarModoOperacao(tipo_carregador, potencia_kw = 0) {
  if (tipo_carregador === 'DC' || potencia_kw > 50) {
    return 4 // Modo 4: Recarga Rápida DC
  }
  if (tipo_carregador === 'AC_Tri' && potencia_kw > 11) {
    return 3 // Modo 3: Recarga Dedicada com Wall Box (Trifásico)
  }
  if (tipo_carregador === 'AC_Tri' || (tipo_carregador === 'AC_Mono' && potencia_kw > 7)) {
    return 3 // Modo 3: Recarga Dedicada com Wall Box
  }
  return 1 // Modo 1: Recarga Normal (padrão)
}

/**
 * Executa cálculos completos para um projeto EV
 * Retorna objeto com todos os cálculos e validações conforme normas
 *
 * @param {object} dados - Dados do projeto com potencia_kw, tensao_v, comprimento_m, resistencia_ohms
 * @returns {object} Objeto com cálculos_nbr e conformidade_norms
 */
export function executarCalculosProjetoEV(dados) {
  if (!dados.carregadores || dados.carregadores.length === 0) {
    return { erro: 'Nenhum carregador definido' }
  }

  const carregador = dados.carregadores[0]
  const potencia_kw = carregador.potencia_kw || 7
  const tensao_v = dados.tensao_sistema || 230
  const comprimento_m = dados.comprimento_cabo_m || 30
  const resistencia_ohms = dados.resistencia_aterramento_ohms

  // Cálculo de corrente de projeto
  const corrente_data = calcularCorrenteProjetoNBR5410(potencia_kw, tensao_v)
  const corrente_projeto = corrente_data.corrente_comercial

  // Cálculo de bitola
  const bitola_data = calcularBitolaNBR5410(
    corrente_projeto,
    comprimento_m,
    3, // máximo 3% de queda
    tensao_v
  )

  // Cálculo de disjuntor
  const disjuntor_data = calcularDisjuntorNBR5410(corrente_projeto)

  // Especificação de DR
  const dr_data = obterEspecificacaoDRNBREIEC618511()

  // Validação de aterramento
  const aterramento_data = resistencia_ohms
    ? validarAteramentoNBR5410(resistencia_ohms)
    : null

  // Conformidade
  const conformidade = {
    corrente_ok: true,
    bitola_ok: bitola_data.queda_tensao_ok,
    queda_tensao_ok: bitola_data.queda_tensao_ok,
    disjuntor_ok: true,
    dr_ok: dr_data.corrente_fuga_max_ma <= 30,
    aterramento_ok: aterramento_data ? aterramento_data.conforme : null,
    spda_necessario: false, // Será determinado por localização
    conforme: bitola_data.queda_tensao_ok && (!aterramento_data || aterramento_data.conforme),
  }

  return {
    calculos_nbr: {
      corrente_projeto_a: corrente_projeto,
      corrente_maxima_a: corrente_data.corrente_calculada,
      bitola_cabo_mm2: bitola_data.bitola_mm2,
      disjuntor_a: disjuntor_data.disjuntor_a,
      dr_ma: dr_data.corrente_fuga_max_ma,
      queda_tensao_pct: bitola_data.queda_tensao_real,
    },
    conformidade_norms: conformidade,
    detalhes: {
      corrente: corrente_data,
      bitola: bitola_data,
      disjuntor: disjuntor_data,
      dr: dr_data,
      aterramento: aterramento_data,
    },
  }
}

export {
  calcularCorrenteProjetoNBR5410,
  calcularBitolaNBR5410,
  calcularDisjuntorNBR5410,
  obterEspecificacaoDRNBREIEC618511,
  obterModoOperacao,
  obterEspecificacaoConector,
  validarAteramentoNBR5410,
  gerarChecklistConformidadeNormas,
  MODOS_OPERACAO,
  TABELA_BITOLAS,
}
