/**
 * semantic_aliases.js — S2.9.3 Camada Semântica Variables SolarMarket
 *
 * Dicionário de mapeamento: nome_canônico → [lista de aliases SM conhecidos]
 *
 * Como adicionar um novo alias (< 10 segundos para um dev júnior):
 *   1. Localize a chave canônica correspondente (ex: 'geracao_mensal_kwh')
 *   2. Acrescente a nova string SM no array daquela chave
 *   3. Salve. Nenhum outro arquivo precisa ser alterado.
 *
 *   Exemplo:
 *     geracao_mensal_kwh: [
 *       ...existentes...,
 *       'nova_variavel_sm_que_apareceu',  // ← apenas esta linha
 *     ],
 *
 * Regras de cadastro de alias:
 *  - Sempre em camelCase ou snake_case exatamente como aparece no JSON do SM
 *  - Não normalizar aqui — a engine converte para lowercase antes de indexar
 *  - Não duplicar aliases entre chaves canônicas diferentes
 *  - Caso de ambiguidade: preferir a chave mais específica
 *
 * Estrutura do índice em runtime (construído pelo variablesNormalizer.js):
 *  ALIAS_INDEX: Map<lowercase_alias → canonical_key>
 *  Construído uma única vez no module load. Lookup: O(1) por campo.
 */

/**
 * @typedef {Object} SemanticAliasMap
 * @description Mapa de chaves canônicas para arrays de aliases SM aceitos.
 *              Toda chave canônica também funciona como alias de si mesma.
 */
export const SEMANTIC_ALIASES = {

  // ── Geração de energia ────────────────────────────────────────────────────
  // Campo mais crítico do ProjetoFV: geração mensal estimada em kWh
  geracao_mensal_kwh: [
    'geracaoMensal',
    'v_geracao_estimada',
    'energiaPrevista',
    'geracao_kwh',
    'energia_gerada',
    'energia_mensal',
    'geracao_estimada',
    'geracao',
    'geração',
    'energiaMensal',
    'geração_mensal',
    'kwh_gerado',
    'kwh_mes',
    'producao_mensal',
    'producaoMensal',
    'monthly_generation',
    'generation_kwh',
    'producao_kwh',
    'producaoKwh',
    'energia_prevista',
    'v_energia',
  ],

  // ── Consumo de energia ────────────────────────────────────────────────────
  consumo_mensal_kwh: [
    'consumo_medio',
    'v_consumo',
    'consumoKwh',
    'consumo_kwh',
    'consumo_mensal',
    'consumo',
    'consumoMedio',
    'media_consumo',
    'mediaConsumo',
    'avg_consumption',
    'monthly_consumption',
    'consumption_kwh',
    'consumo_medio_kwh',
    'mediaKwh',
    'media_kwh',
  ],

  // ── Potência do sistema ───────────────────────────────────────────────────
  potencia_instalada_kwp: [
    'potencia_kwp',
    'potencia_pico_kwp',
    'potencia_sistema',
    'v_potencia',
    'potenciaInstalada',
    'potencia_instalada',
    'peak_power_kwp',
    'system_power',
    'kwp',
    'potenciaPico',
    'potencia_total',
    'total_power_kwp',
    'potenciaSistema',
  ],

  // ── Módulos fotovoltaicos ─────────────────────────────────────────────────
  num_modulos: [
    'qtd_modulos',
    'quantidade_modulos',
    'quantidadeModulos',
    'num_paineis',
    'qtd_paineis',
    'paineis',
    'modulos',
    'panels',
    'panel_count',
    'v_modulos',
    'total_modulos',
    'numModulos',
    'quantidade_paineis',
  ],

  potencia_modulo_wp: [
    'potencia_painel',
    'wp_modulo',
    'potenciaModulo',
    'wp',
    'watt_pico',
    'watt_peak',
    'module_power',
    'panel_power_wp',
    'potenciaWp',
    'wp_painel',
  ],

  // ── Inversores ────────────────────────────────────────────────────────────
  num_inversores: [
    'qtd_inversores',
    'quantidade_inversores',
    'quantidadeInversores',
    'inversores',
    'inverters',
    'inverter_count',
    'v_inversores',
    'numInversores',
    'total_inversores',
  ],

  potencia_inversor_kw: [
    'potencia_inversor',
    'kw_inversor',
    'potenciaInversor',
    'inverter_power',
    'inverter_kw',
    'potenciaInversorKw',
  ],

  // ── Custos do projeto ─────────────────────────────────────────────────────
  custo_kit: [
    'pricingTable.custo',
    'valor_kit',
    'custo_total_equipamentos',
    'custo_equipamentos',
    'kit_cost',
    'equipment_cost',
    'valor_equipamentos',
    'v_custo_kit',
    'custoKit',
    'custo_modulos_inversores',
  ],

  custo_instalacao: [
    'valor_instalacao',
    'custo_mao_obra',
    'mao_de_obra',
    'labor_cost',
    'installation_cost',
    'v_instalacao',
    'custoInstalacao',
    'instalacao',
    'servico',
    'maoDeObra',
  ],

  custo_total: [
    'valor_total',
    'total_project',
    'total_cost',
    'custo_projeto',
    'valorTotal',
    'preco_total',
    'v_total',
    'custoTotal',
    'total',
    'valor_proposta',
  ],

  // ── Irradiação / Localização ──────────────────────────────────────────────
  irradiacao_local: [
    'irradiacao',
    'hsp',
    'horas_sol_pico',
    'solar_irradiation',
    'irradiação',
    'irradiacao_kwh_m2',
    'v_irradiacao',
    'irradiacaoLocal',
    'hsp_local',
    'irradiancia',
    'global_horizontal_irradiance',
  ],

  // ── Área necessária ───────────────────────────────────────────────────────
  area_necessaria_m2: [
    'area_telhado',
    'area_necessaria',
    'areaTelhado',
    'roof_area',
    'area_m2',
    'v_area',
    'area',
    'areaM2',
    'area_instalacao',
    'rooftop_area',
  ],

  // ── Retorno financeiro ────────────────────────────────────────────────────
  payback_anos: [
    'payback',
    'retorno_investimento',
    'roi_anos',
    'payback_years',
    'tempo_retorno',
    'v_payback',
    'paybackAnos',
    'periodo_retorno',
    'return_years',
  ],

  economia_anual: [
    'economiaAnual',
    'economia_kwh',
    'economia_anual',
    'annual_savings',
    'savings_kwh',
    'v_economia',
    'economiaAnualReais',
    'economia_reais',
    'economia_mensal',
  ],

  // ── Sustentabilidade ──────────────────────────────────────────────────────
  co2_evitado_ton: [
    'co2_evitado',
    'co2',
    'carbono_evitado',
    'emissao_evitada',
    'co2_savings',
    'carbon_offset',
    'v_co2',
    'co2Evitado',
    'emissoesCo2',
    'toneladas_co2',
  ],

  // ── Dados do cliente / projeto (referência) ───────────────────────────────
  cidade: [
    'city',
    'municipio',
    'localidade',
    'v_cidade',
  ],

  estado_uf: [
    'estado',
    'uf',
    'state',
    'v_estado',
  ],

  tarifa_kwh: [
    'tarifa',
    'tarifa_energia',
    'preco_kwh',
    'energy_rate',
    'v_tarifa',
    'tarifaKwh',
    'tarifa_media',
    'valor_kwh',
  ],

}
