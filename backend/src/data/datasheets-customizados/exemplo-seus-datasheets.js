/**
 * TEMPLATE: Seus Datasheets Customizados
 *
 * Instruções:
 * 1. Renomeie este arquivo com sua marca/modelo
 * 2. Preencha os dados do seu datasheet
 * 3. Salve e o sistema carregará automaticamente
 * 4. Teste pelo formulário de novo equipamento
 */

/**
 * Exemplo de módulo customizado
 * Copie, adapte e use!
 */
export const meusDatasheetsModulos = {
  'Sua Marca': {
    // Chave: potência ou faixa (ex: '500-520', '610', 'HxV model')
    '500-520': {
      // Identificação
      modelo: 'MARCA-MODELO-510',
      fabricante: 'Sua Marca',

      // Potência
      potencia_wp: 510,

      // Parâmetros elétricos (encontre no datasheet)
      voc: 48.2,              // Tensão de circuito aberto (V)
      isc: 13.5,              // Corrente de curto-circuito (A)
      vmp: 39.0,              // Tensão no ponto de máxima potência (V)
      imp: 13.08,             // Corrente no ponto de máxima potência (A)

      // Eficiência e garantia
      eficiencia_pct: 20.5,   // Eficiência de conversão (%)
      garantia_anos: 12,      // Garantia do produto

      // Tipo de célula
      tipo: 'monocristalino',  // Opções: monocristalino, policristalino, bifacial, n-type

      // Dados físicos (opcional)
      area_m2: 2.49,          // Área do painel
      peso_kg: 21.5,          // Peso
      dimensoes_hxlxp_cm: '200x100x4',

      // Coeficientes de temperatura (opcional)
      temperatura_coef_voc_pct_c: -0.27,   // Voc varia com temperatura
      temperatura_coef_isc_pct_c: 0.05,
      temperatura_coef_pmax_pct_c: -0.35,  // Mais importante para potência

      // Temperatura de operação
      temperatura_min_c: -40,
      temperatura_max_c: 85,

      // Metadados
      data_datasheet: '2024-04-30',         // Data do datasheet
      fonte: 'Datasheet PDF do fabricante',
      nota: 'Adicione qualquer nota importante aqui',
    },

    // Você pode adicionar múltiplas potências
    '600-620': {
      modelo: 'MARCA-MODELO-610',
      potencia_wp: 610,
      voc: 52.1,
      isc: 14.2,
      vmp: 42.1,
      imp: 14.48,
      eficiencia_pct: 21.5,
      garantia_anos: 12,
      tipo: 'monocristalino',
    }
  }
}

/**
 * Exemplo de inversor customizado
 */
export const meusDatasheetsInversores = {
  'Seu Fabricante': {
    monofasico: {
      '3-6kW': {
        '5': {
          modelo: 'SEU-INVERSOR-5K',
          potencia_kw: 5.0,
          fases: 1,
          mppts: 2,

          // Entrada DC
          tensao_min_v: 150,
          tensao_max_v: 600,
          corrente_entrada_max_a: 30,

          // Saída AC
          corrente_saida_ac_max_a: 21.7,  // 5000W ÷ 230V

          // Eficiência
          eficiencia_max_pct: 98.5,

          // Características
          peso_kg: 12,
          dimensoes_hxlxp_cm: '45x55x20',
          temperatura_min_c: -20,
          temperatura_max_c: 60,

          // Proteções
          protecoes: ['AFCI', 'Anti-ilhamento', 'Isolação'],

          data_datasheet: '2024-04-30',
          fonte_url: 'https://...',
        }
      }
    },

    trifasico: {
      '5-15kW': {
        '10': {
          modelo: 'SEU-INVERSOR-10K-3F',
          potencia_kw: 10.0,
          fases: 3,
          mppts: 3,  // 3-fásico pode ter mais MPPT
          tensao_min_v: 160,
          tensao_max_v: 700,
          corrente_entrada_max_a: 60,
          // Corrente por fase em 3-fásico
          corrente_saida_ac_max_a: 15.2,  // 10000W ÷ (230V × √3)
          eficiencia_max_pct: 98.6,
          peso_kg: 22,
          data_datasheet: '2024-04-30',
        }
      }
    }
  }
}

/**
 * Exemplo de carregador customizado
 */
export const meusDatasheetsCarregadores = {
  'Seu Fabricante Carregador': {
    DC: {
      'Modelo MPPT 150A': {
        tipo: 'DC',
        entrada_v_max: 200,
        entrada_v_min: 100,
        saida_a: 150,

        // Compatibilidade com tensões de bateria
        compativel_bateria: ['12V', '24V', '48V'],

        // Características
        eficiencia_pct: 98,
        mppts: 1,

        // Proteções e features
        tecnologia: 'MPPT',
        peso_kg: 5,
        data_datasheet: '2024-04-30',
      }
    },

    AC: {
      'Carregador Híbrido 8kW': {
        tipo: 'AC',
        entrada_ac_potencia_w: 8000,
        saida_ac_potencia_w: 8000,
        entrada_dc_v: '48V nominal',
        saida_dc_a: 166,  // 8000W ÷ 48V
        compativel_bateria: ['Lithium', 'LiFePO4', 'AGM'],
        eficiencia_pct: 96,
        data_datasheet: '2024-04-30',
      }
    }
  }
}

/**
 * IMPORTANTE - Leia antes de usar:
 *
 * ✅ O QUE COPIAR DO DATASHEET:
 * - Voc, Isc, Vmp, Imp (Module): procure em "Electrical Specifications"
 * - Potência (Wp): está bem em destaque no datasheet
 * - Eficiência: procure por "Efficiency %" ou "Rendimento %"
 * - Temperatura: "Operating Temperature Range" ou "Intervalo de Operação"
 *
 * ⚠️ UNIDADES CORRETAS:
 * - Voltagem: sempre em Volts (V), não kV
 * - Corrente: sempre em Amperes (A), não mA
 * - Potência: Wp para módulos, kW para inversores
 * - Temperatura: Celsius (°C)
 * - Área: metros quadrados (m²)
 * - Peso: quilogramas (kg)
 *
 * 🔍 VALIDAÇÃO:
 * Após preencher, valide a potência: Pmax ≈ Vmp × Imp
 * Exemplo: 39.0V × 13.08A ≈ 510W ✓
 *
 * 💾 SALVAR:
 * Salve com nome descritivo:
 * - meus-modulos-ja-solar.js
 * - meus-inversores-growatt.js
 * - etc.
 */
