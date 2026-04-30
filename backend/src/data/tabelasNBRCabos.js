/**
 * Tabelas NBR para Dimensionamento de Cabos
 * Fontes: NBR 5410 (Tabelas 35, 36, 40, 42) e NBR 16612 (cabos solares)
 *
 * NBR 16612: Só permite COBRE na parte DC
 * NBR 5410: Permite cobre ou alumínio na parte AC
 */

/**
 * TABELA COBRE - NBR 5410/16612
 * Capacidade de condução de corrente para cabos de COBRE (70°C-90°C)
 * Método de instalação B1, B2 (ao ar livre ou em eletroduto)
 */
export const tabelaCobre = [
  {
    secao_mm2: 1.0,
    secao_awg: '18',
    ampacidade_b1_a: 15,
    ampacidade_b2_a: 13,
    resistencia_ohm_km: 18.5,
    peso_kg_km: 9,
    diametro_mm: 1.38,
    uso: 'Pequenos circuitos',
  },
  {
    secao_mm2: 1.5,
    secao_awg: '16',
    ampacidade_b1_a: 19,
    ampacidade_b2_a: 17,
    resistencia_ohm_km: 12.1,
    peso_kg_km: 13.5,
    diametro_mm: 1.63,
    uso: 'Circuitos residenciais',
  },
  {
    secao_mm2: 2.5,
    secao_awg: '14',
    ampacidade_b1_a: 26,
    ampacidade_b2_a: 24,
    resistencia_ohm_km: 7.41,
    peso_kg_km: 22.5,
    diametro_mm: 2.08,
    uso: 'Circuitos residenciais, iluminação',
  },
  {
    secao_mm2: 4.0,
    secao_awg: '12',
    ampacidade_b1_a: 35,
    ampacidade_b2_a: 32,
    resistencia_ohm_km: 4.61,
    peso_kg_km: 36,
    diametro_mm: 2.54,
    uso: 'Tomadas, circuitos derivados',
  },
  {
    secao_mm2: 6.0,
    secao_awg: '10',
    ampacidade_b1_a: 45,
    ampacidade_b2_a: 41,
    resistencia_ohm_km: 3.08,
    peso_kg_km: 54,
    diametro_mm: 3.12,
    uso: 'Distribuição interna',
  },
  {
    secao_mm2: 10.0,
    secao_awg: '8',
    ampacidade_b1_a: 59,
    ampacidade_b2_a: 54,
    resistencia_ohm_km: 1.83,
    peso_kg_km: 90,
    diametro_mm: 4.11,
    uso: 'Distribuição, painéis solares DC',
  },
  {
    secao_mm2: 16.0,
    secao_awg: '6',
    ampacidade_b1_a: 76,
    ampacidade_b2_a: 69,
    resistencia_ohm_km: 1.15,
    peso_kg_km: 144,
    diametro_mm: 5.16,
    uso: 'Painel solar → Inversor (DC)',
  },
  {
    secao_mm2: 25.0,
    secao_awg: '4',
    ampacidade_b1_a: 98,
    ampacidade_b2_a: 89,
    resistencia_ohm_km: 0.727,
    peso_kg_km: 225,
    diametro_mm: 6.63,
    uso: 'Arranjos solares, entroncamento',
  },
  {
    secao_mm2: 35.0,
    secao_awg: '2',
    ampacidade_b1_a: 119,
    ampacidade_b2_a: 108,
    resistencia_ohm_km: 0.517,
    peso_kg_km: 315,
    diametro_mm: 7.78,
    uso: 'Distribuição AC, inversores 10-15kW',
  },
  {
    secao_mm2: 50.0,
    secao_awg: '1/0',
    ampacidade_b1_a: 145,
    ampacidade_b2_a: 132,
    resistencia_ohm_km: 0.387,
    peso_kg_km: 450,
    diametro_mm: 9.27,
    uso: 'Inversores 15-20kW, alimentação painel',
  },
  {
    secao_mm2: 70.0,
    secao_awg: '2/0',
    ampacidade_b1_a: 179,
    ampacidade_b2_a: 163,
    resistencia_ohm_km: 0.276,
    peso_kg_km: 630,
    diametro_mm: 10.92,
    uso: 'Inversores 20-25kW, chegada principal',
  },
  {
    secao_mm2: 95.0,
    secao_awg: '3/0',
    ampacidade_b1_a: 210,
    ampacidade_b2_a: 191,
    resistencia_ohm_km: 0.193,
    peso_kg_km: 855,
    diametro_mm: 12.60,
    uso: 'Instalações >25kW',
  },
  {
    secao_mm2: 120.0,
    secao_awg: '4/0',
    ampacidade_b1_a: 239,
    ampacidade_b2_a: 217,
    resistencia_ohm_km: 0.153,
    peso_kg_km: 1080,
    diametro_mm: 13.97,
    uso: 'Instalações de grande porte',
  },
]

/**
 * TABELA ALUMÍNIO - NBR 5410
 * Capacidade de condução para ALUMÍNIO (70°C-90°C)
 * Uso: Apenas na parte AC do sistema (não permitido em DC/painéis)
 */
export const tabelaAluminio = [
  {
    secao_mm2: 4.0,
    ampacidade_b1_a: 27,
    ampacidade_b2_a: 25,
    resistencia_ohm_km: 7.41,
    peso_kg_km: 12.5,
    diametro_mm: 2.88,
    obs: 'Não usar em painéis DC',
  },
  {
    secao_mm2: 6.0,
    ampacidade_b1_a: 34,
    ampacidade_b2_a: 31,
    resistencia_ohm_km: 4.95,
    peso_kg_km: 18.75,
    diametro_mm: 3.53,
    obs: 'Não usar em painéis DC',
  },
  {
    secao_mm2: 10.0,
    ampacidade_b1_a: 45,
    ampacidade_b2_a: 41,
    resistencia_ohm_km: 2.95,
    peso_kg_km: 31.25,
    diametro_mm: 4.60,
    obs: 'Não usar em painéis DC',
  },
  {
    secao_mm2: 16.0,
    ampacidade_b1_a: 59,
    ampacidade_b2_a: 54,
    resistencia_ohm_km: 1.87,
    peso_kg_km: 50,
    diametro_mm: 5.75,
    obs: 'Não usar em painéis DC',
  },
  {
    secao_mm2: 25.0,
    ampacidade_b1_a: 77,
    ampacidade_b2_a: 70,
    resistencia_ohm_km: 1.18,
    peso_kg_km: 78.125,
    diametro_mm: 7.38,
    obs: 'Não usar em painéis DC',
  },
  {
    secao_mm2: 35.0,
    ampacidade_b1_a: 96,
    ampacidade_b2_a: 87,
    resistencia_ohm_km: 0.839,
    peso_kg_km: 109.375,
    diametro_mm: 8.66,
    obs: 'Distribuição AC, não em DC',
  },
  {
    secao_mm2: 50.0,
    ampacidade_b1_a: 118,
    ampacidade_b2_a: 107,
    resistencia_ohm_km: 0.591,
    peso_kg_km: 156.25,
    diametro_mm: 10.21,
    obs: 'Distribuição AC',
  },
  {
    secao_mm2: 70.0,
    ampacidade_b1_a: 147,
    ampacidade_b2_a: 134,
    resistencia_ohm_km: 0.424,
    peso_kg_km: 218.75,
    diametro_mm: 11.94,
    obs: 'Distribuição AC de grande porte',
  },
]

/**
 * TABELA FATORES DE CORREÇÃO
 * Conforme NBR 5410 (Tabelas 40 e 42)
 */
export const fatoresCorrecao = {
  /**
   * Fator de temperatura ambiente
   * Tabela 40 da NBR 5410
   * Considerando temperatura de referência 30°C
   */
  temperatura: {
    '20': 1.18,
    '25': 1.10,
    '30': 1.00,
    '35': 0.91,
    '40': 0.82,
    '45': 0.71,
    '50': 0.58,
  },

  /**
   * Fator de agrupamento de condutores
   * Tabela 42 da NBR 5410
   */
  agrupamento: {
    '1_circuito': 1.00,
    '2_circuitos': 0.80,
    '3_circuitos': 0.70,
    '4_circuitos': 0.65,
    '5_circuitos': 0.60,
    '6_circuitos': 0.57,
    '7_a_9': 0.50,
    '10_a_12': 0.45,
    '13_a_15': 0.41,
    '16_a_18': 0.38,
    '19_a_21': 0.35,
    '>21': 0.31,
  },

  /**
   * Fator de ambiente
   * Para cabos ao ar livre em eletroduto (usa-se método B)
   */
  ambiente: {
    'ao_ar_livre': 1.00,
    'eletroduto_superficie': 0.95,
    'eletroduto_enterrado': 0.80,
    'canaleta_aberta': 0.95,
  },
}

/**
 * RECOMENDAÇÕES PARA SISTEMAS FOTOVOLTAICOS
 * Conforme NBR 16612 e boas práticas
 */
export const recomendacoesString = {
  'Painel → Combiner': {
    material: 'Cobre',
    seccao_minima_mm2: 4,
    protecao: 'Disjuntor + Fusível DC',
    temperatura_operacao_max: '90°C',
    norma: 'NBR 16612',
    observacoes: 'Usar cabos com isolação dupla (PV rated)',
  },
  'Combiner → Inversor': {
    material: 'Cobre',
    seccao_recomendada_mm2: 10,
    protecao: 'Disjuntor isolador DC',
    temperatura_operacao_max: '90°C',
    norma: 'NBR 16612',
    observacoes: 'Pode usar canaleta ou eletroduto',
  },
  'Inversor → Quadro AC': {
    material: 'Cobre',
    seccao_recomendada_mm2: '16-35',
    protecao: 'Disjuntor AC + Dispositivo DR',
    temperatura_operacao_max: '70°C',
    norma: 'NBR 5410',
    observacoes: 'Distância ≤ 10m',
  },
  'Quadro AC → Alimentação Rede': {
    material: 'Cobre ou Alumínio',
    seccao_recomendada_mm2: '35-120',
    protecao: 'IQR (Interruptor Automático)',
    temperatura_operacao_max: '70°C',
    norma: 'NBR 5410',
    observacoes: 'Conforme distância e corrente',
  },
}

/**
 * DIMENSIONAMENTO RÁPIDO
 * Função auxiliar para calcular seção mínima
 */
export const calcularSecaoMinima = (
  corrente_a,
  distancia_m,
  queda_tensao_maxima_pct = 3,
  tensao_v = 48,
  material = 'cobre'
) => {
  /**
   * Fórmula: S = (2 × L × I × ρ) / (V × Δ%)
   * S = seção em mm²
   * L = comprimento em metros
   * I = corrente em amperes
   * ρ = resistividade (cobre ≈ 0.0175, alumínio ≈ 0.0280)
   * V = tensão nominal
   * Δ% = queda de tensão máxima aceita
   */
  const resistividade = material === 'cobre' ? 0.0175 : 0.0280
  const queda_v = (tensao_v * queda_tensao_maxima_pct) / 100

  const secao = (2 * distancia_m * corrente_a * resistividade) / queda_v

  // Encontra a seção comercial mais próxima (arredonda para cima)
  const secoes_comerciais = [1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120]
  const secao_comercial = secoes_comerciais.find(s => s >= secao) || 120

  return {
    secao_calculada_mm2: parseFloat(secao.toFixed(2)),
    secao_comercial_mm2: secao_comercial,
    queda_tensao_v: parseFloat(queda_v.toFixed(2)),
    queda_tensao_pct: queda_tensao_maxima_pct,
  }
}

/**
 * VERIFICAÇÃO DE AMPACIDADE
 * Valida se a seção suporta a corrente com fatores de correção
 */
export const verificarAmpacidade = (secao_mm2, corrente_a, fator_correcao = 1.0) => {
  const caboCobre = tabelaCobre.find(c => c.secao_mm2 === secao_mm2)

  if (!caboCobre) {
    return {
      valido: false,
      mensagem: `Seção ${secao_mm2}mm² não encontrada em tabela`,
    }
  }

  const ampacidade_corrigida = caboCobre.ampacidade_b1_a * fator_correcao

  return {
    valido: corrente_a <= ampacidade_corrigida,
    ampacidade_nominal_a: caboCobre.ampacidade_b1_a,
    ampacidade_corrigida_a: parseFloat(ampacidade_corrigida.toFixed(2)),
    corrente_solicitada_a: corrente_a,
    margem_seguranca_pct: parseFloat(
      (((ampacidade_corrigida - corrente_a) / ampacidade_corrigida) * 100).toFixed(1)
    ),
    mensagem: corrente_a <= ampacidade_corrigida
      ? `✅ Cabo ${secao_mm2}mm² OK (corrente: ${corrente_a}A ≤ ampacidade: ${ampacidade_corrigida.toFixed(1)}A)`
      : `❌ Cabo ${secao_mm2}mm² INSUFICIENTE (corrente: ${corrente_a}A > ampacidade: ${ampacidade_corrigida.toFixed(1)}A)`,
  }
}
