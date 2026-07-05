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
/**
 * Gera lista de materiais necessários para instalação de carregador EV.
 * EV-BUGFIX-02:
 *   - DPS: 2 unidades (NBR 5410 6.3.5.2 — fase + neutro)
 *   - Eletroduto: ceil(distancia / 3m) barras
 *   - Abraçadeiras: 3 por barra
 *   - Bucha + parafuso: 4 por barra
 */
function gerarListaMaterialesNBRProjeto(potencia_kw, tipo_carregador, bitola_mm2, disjuntor_a, dr_ma, comprimento_m) {
  const BARRA_M = 3
  const distancia = Math.max(0, Number(comprimento_m) || 0)
  const barras = Math.max(1, Math.ceil(distancia / BARRA_M))
  const abracadeiras = barras * 3
  const fixacoes = barras * 4
  return [
    { item: 'Carregador EV', especificacao: `${tipo_carregador} ${potencia_kw}kW`, quantidade: 1, unidade: 'un' },
    { item: 'Cabo de alimentação', especificacao: `${bitola_mm2} mm² (Cu, 0,6/1kV)`, quantidade: distancia, unidade: 'm' },
    { item: 'Disjuntor termomagnético', especificacao: `${disjuntor_a}A Curva C`, quantidade: 1, unidade: 'un' },
    { item: 'Dispositivo DR', especificacao: `${dr_ma}mA Tipo A`, quantidade: 1, unidade: 'un' },
    // EV-BUGFIX-02: DPS mínimo 2 (NBR 5410)
    { item: 'DPS (Proteção contra Surtos)', especificacao: '420V Classe II', quantidade: 2, unidade: 'un' },
    // EV-BUGFIX-02: eletroduto em barras
    { item: 'Eletroduto rígido', especificacao: `Proteção mecânica · barras de ${BARRA_M}m`, quantidade: barras, unidade: 'barra' },
    // EV-BUGFIX-02: abraçadeiras 3/barra
    { item: 'Abraçadeira', especificacao: `Fixação do eletroduto (3/barra)`, quantidade: abracadeiras, unidade: 'un' },
    // EV-BUGFIX-02: bucha + parafuso 4/barra
    { item: 'Bucha + parafuso', especificacao: `Fixação em alvenaria (4/barra)`, quantidade: fixacoes, unidade: 'jogo' },
    { item: 'Fita isolante', especificacao: 'Vedação de conexões', quantidade: 5, unidade: 'rolo' },
    { item: 'Haste de aterramento', especificacao: '2,4m cobre 16mm dia', quantidade: 1, unidade: 'un' },
    { item: 'Tomadas/conectores', especificacao: 'Conforme carregador', quantidade: 2, unidade: 'un' },
  ]
}

// BUG-017: tabela de condutores (Cu 70°C, eletroduto — NBR 5410 Tab.36) IDÊNTICA ao
// motor do frontend (services/calculosNBR5410EV.js). Fonte de valores única entre os motores.
const TABELA_COBRE_NBR = [
  { bitola: 1.5, capacidade_a: 15.5 }, { bitola: 2.5, capacidade_a: 21 }, { bitola: 4, capacidade_a: 28 },
  { bitola: 6, capacidade_a: 36 }, { bitola: 10, capacidade_a: 50 }, { bitola: 16, capacidade_a: 68 },
  { bitola: 25, capacidade_a: 89 }, { bitola: 35, capacidade_a: 109 }, { bitola: 50, capacidade_a: 134 },
  { bitola: 70, capacidade_a: 170 }, { bitola: 95, capacidade_a: 207 }, { bitola: 120, capacidade_a: 239 },
]
const DISJUNTORES_NBR = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200]

export function executarCalculosProjetoEV(dados) {
  if (!dados.carregadores || dados.carregadores.length === 0) {
    return { erro: 'Nenhum carregador definido' }
  }

  const carregador = dados.carregadores[0]
  const potencia_kw = carregador.potencia_kw || 7
  // BUG-017: MESMOS inputs e MESMA metodologia do motor do frontend (elimina divergência).
  const tensao_v = carregador.tensao_entrada_v || dados.tensao_sistema || 220
  const numero_fases = Number(carregador.numero_fases) || (String(carregador.tipo || '').includes('Tri') ? 3 : 1)
  const comprimento_m = dados.comprimento_cabo_m || 30
  const resistencia_ohms = dados.resistencia_aterramento_ohms

  // Ib (corrente de projeto) = nominal do CATÁLOGO, ou P/(V·√3(tri)·fp). Nunca inflada por
  // arredondamento comercial nem por fator de segurança (o 1,25 é SÓ para o condutor).
  const fator_potencia = 0.95
  const fator_raiz3 = numero_fases === 3 ? Math.sqrt(3) : 1
  const corrente_calculada = (potencia_kw * 1000) / (tensao_v * fator_raiz3 * fator_potencia)
  const Ib = carregador.corrente_entrada_a ? Number(carregador.corrente_entrada_a) : corrente_calculada
  const corrente_projeto_a = parseFloat(Ib.toFixed(2))

  // Condutor: Iz ≥ Ib·1,25 (carga contínua NBR 5410 9.5.1.1) corrigido por temperatura (0,95).
  const corrente_maxima_a = Ib * 1.25
  const corrente_corrigida = corrente_maxima_a / 0.95
  let bitola_cabo_mm2 = 2.5
  for (const c of TABELA_COBRE_NBR) { if (c.capacidade_a >= corrente_corrigida) { bitola_cabo_mm2 = c.bitola; break } }

  // Queda de tensão (ρ Cu 70°C = 0,0179; limite 3%) — MESMA fórmula do frontend.
  const resistividade = 0.0179
  const quedaPct = (S) => ((resistividade * comprimento_m * Ib) / S / tensao_v) * 100
  let queda_tensao_pct = quedaPct(bitola_cabo_mm2)
  if (queda_tensao_pct > 3) {
    for (const c of TABELA_COBRE_NBR) { if (quedaPct(c.bitola) <= 3) { bitola_cabo_mm2 = c.bitola; queda_tensao_pct = quedaPct(c.bitola); break } }
  }

  // Disjuntor: menor comercial ≥ Ib (Ib ≤ In ≤ Iz).
  let disjuntor_a = DISJUNTORES_NBR[DISJUNTORES_NBR.length - 1]
  for (const d of DISJUNTORES_NBR) { if (d >= Ib) { disjuntor_a = d; break } }
  const capacidade_cabo_a = TABELA_COBRE_NBR.find(c => c.bitola === bitola_cabo_mm2)?.capacidade_a || 0

  const dr_data = obterEspecificacaoDRNBREIEC618511()
  const dr_ma = dr_data.corrente_fuga_max_ma
  const dps_kv = tensao_v >= 380 ? 420 : 275
  const dps_capacidade_a = Math.round(Ib + 20)
  let tempo_seccionamento_s = 0.2
  if (tensao_v <= 120) tempo_seccionamento_s = 0.4
  if (tensao_v <= 50) tempo_seccionamento_s = 5

  const aterramento_data = resistencia_ohms ? validarAteramentoNBR5410(resistencia_ohms) : null
  const conformidade = {
    corrente_ok: true,
    bitola_ok: queda_tensao_pct <= 3,
    queda_tensao_ok: queda_tensao_pct <= 3,
    disjuntor_ok: disjuntor_a <= capacidade_cabo_a,   // In ≤ Iz
    dr_ok: dr_ma <= 30,
    aterramento_ok: aterramento_data ? aterramento_data.conforme : null,
    spda_necessario: false,
    conforme: queda_tensao_pct <= 3 && disjuntor_a <= capacidade_cabo_a && (!aterramento_data || aterramento_data.conforme),
  }

  return {
    calculos_nbr: {
      corrente_projeto_a,
      corrente_maxima_a: parseFloat(corrente_maxima_a.toFixed(2)),
      bitola_cabo_mm2,
      disjuntor_a,
      dr_ma,
      dps_kv,
      dps_capacidade_a,
      tempo_seccionamento_s,
      queda_tensao_pct: parseFloat(queda_tensao_pct.toFixed(2)),
    },
    conformidade_norms: conformidade,
    detalhes: {
      corrente: { corrente_calculada: parseFloat(corrente_calculada.toFixed(2)), Ib: corrente_projeto_a, norma: 'NBR 5410:2004' },
      bitola: { bitola_mm2: bitola_cabo_mm2, capacidade_cabo_a, queda_tensao_real: parseFloat(queda_tensao_pct.toFixed(2)) },
      disjuntor: { disjuntor_a, norma: 'NBR 5410:2004' },
      dr: dr_data,
      aterramento: aterramento_data,
    },
  }
}

export {
  obterEspecificacaoDRNBREIEC618511,
  obterModoOperacao,
  obterEspecificacaoConector,
  validarAteramentoNBR5410,
  gerarChecklistConformidadeNormas,
  MODOS_OPERACAO,
  TABELA_BITOLAS,
}
