// backend/src/importadores/concessionariaProfiles.js

/**
 * UNIVERSAL CONCESSIONÁRIA PROFILE SYSTEM
 *
 * Defines configurable parsing rules, homologation constraints, and technical specs
 * for all Brazilian utilities. Enables single parser to support multiple distributors
 * without hardcoded logic.
 *
 * Profile structure:
 * ├─ Identificação
 * ├─ Parsing rules (regex patterns for each field)
 * ├─ Homologation rules
 * ├─ Tension profiles
 * ├─ Tariff patterns
 * └─ Technical constraints
 */

export const CONCESSIONARIA_PROFILES = {
  neoenergia_cosern: {
    id: 'neoenergia_cosern',
    nome: 'Neoenergia Cosern',
    aliases: ['cosern', 'neoenergia', 'neoenergia cosern'],
    estado: 'RN',
    region: 'Nordeste',
    ativo: true,

    // Parsing rules (regex patterns for field extraction)
    parsing_rules: {
      nome_cliente: {
        patterns: [
          /(?:NOME DO (?:TITULAR|CLIENTE)|Titular)[\s:]+([A-ZÀÁÂÃÈÉÊÌÍÎÒÓÔÕÙÚÛ\s]+?)(?:\n|$)/i
        ],
        required: true
      },
      cpf_cnpj_parcial: {
        patterns: [
          /(?:CPF|CNPJ)[\s:]*([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}|[0-9]{2}\.[0-9]{3}\.[0-9]{3}\/[0-9]{4}-[0-9]{2})/i
        ],
        required: true
      },
      endereco: {
        patterns: [
          /(?:ENDEREÇO|Endereço)[\s:]+([^\n]+?)(?:\n|$)/i
        ],
        required: true
      },
      bairro: {
        patterns: [
          /(?:BAIRRO|Bairro)[\s:]+([^\n]+?)(?:\n|$)/i
        ],
        required: false
      },
      cidade: {
        patterns: [
          /(?:CIDADE|Cidade)[\s:]+([A-ZÀÁÂÃÈÉÊÌÍÎÒÓÔÕÙÚÛ\s]+?)(?:\n|$)/i
        ],
        required: true
      },
      estado: {
        patterns: [
          /(?:UF|ESTADO|Estado)[\s:]*([A-Z]{2})(?:\n|$)/i
        ],
        required: true
      },
      cep: {
        patterns: [
          /(?:CEP|Cep)[\s:]*([0-9]{5}-[0-9]{3})/i
        ],
        required: false
      },
      codigo_cliente: {
        patterns: [
          /(?:CÓDIGO DO CLIENTE|Código do cliente)[\s:]*([0-9]+)(?:\n|$)/i
        ],
        required: true
      },
      codigo_instalacao: {
        patterns: [
          /(?:CÓDIGO DA INSTALAÇÃO|Código da instalação|N\.?\s?UC)[\s:]*([0-9]+)(?:\n|$)/i
        ],
        required: true,
        critical: true
      },
      classe_tarifaria: {
        patterns: [
          /(?:CLASSE|TARIFA|Tarifa)[\s:]*([A-ZÀÁÂÃÈÉÊÌÍÎÒÓÔÕÙÚÛ0-9\s]+?)(?:\n|$)/i
        ],
        required: true
      },
      tipo_fornecimento: {
        patterns: [
          /(?:TIPO DE FORNECIMENTO|Tipo de fornecimento)[\s:]*([^\n]+?)(?:\n|$)/i
        ],
        required: true
      },
      tensao: {
        patterns: [
          /(?:TENSÃO|Tensão)[\s:]*([0-9]+(?:[.,][0-9]+)?)\s*V/i
        ],
        required: true,
        type: 'numeric'
      },
      modalidade: {
        patterns: [
          /(?:MODALIDADE|Modalidade)[\s:]*([A-ZÀÁÂÃÈÉÊÌÍÎÒÓÔÕÙÚÛ]+?)(?:\n|$)/i
        ],
        required: false
      },
      referencia_fatura: {
        patterns: [
          /(?:REFERÊNCIA|Referência)[\s:]*([0-9]{2}\/[0-9]{4})/i
        ],
        required: true
      },
      leitura_atual: {
        patterns: [
          /(?:LEITURA ATUAL|Leitura atual)[\s:]*([0-9]+)/i
        ],
        required: false,
        type: 'numeric'
      },
      leitura_anterior: {
        patterns: [
          /(?:LEITURA ANTERIOR|Leitura anterior)[\s:]*([0-9]+)/i
        ],
        required: false,
        type: 'numeric'
      },
      numero_dias: {
        patterns: [
          /(?:DIAS|Dias)[\s:]*([0-9]+)(?:\n|$)/i
        ],
        required: true,
        type: 'numeric'
      },
      consumo_pattern: {
        patterns: [
          /(\d{2})\/(\d{4})\s+([0-9.,]+)\s+kWh?\s+(\d+)/gi
        ],
        description: 'Monthly consumption pattern: MM/YYYY CONSUMPTION_KWH DAYS'
      },
      tarifa: {
        patterns: [
          /(?:TARIFA|Tarifa)[\s:]*R?\$\s*([0-9.,]+)/i
        ],
        required: false,
        type: 'numeric'
      }
    },

    // Homologation rules (format, structure, requirements)
    homologation_rules: {
      format: 'formulario_digital_aneel',
      language: 'pt-BR',
      required_documents: [
        'ART_instalador',
        'ART_projeto',
        'diagramas_unifilar',
        'especificacoes_tecnicas',
        'datasheet_inversores',
        'datasheet_modulos'
      ],
      submission_method: 'portal_cosern',
      inspection_required: true,
      response_time_days: 30
    },

    // Tension profiles (supported voltages and configurations)
    tension_profiles: [
      {
        tensao: 127,
        tipo: 'monofasico',
        fases: 1,
        neutro: true,
        tierra: true,
        max_potencia_kw: 4.4
      },
      {
        tensao: 220,
        tipo: 'bifasico',
        fases: 2,
        neutro: true,
        tierra: true,
        max_potencia_kw: 8.8
      },
      {
        tensao: 220,
        tipo: 'trifasico',
        fases: 3,
        neutro: false,
        tierra: true,
        max_potencia_kw: 50
      }
    ],

    // Tariff patterns and classes
    tariff_patterns: {
      residencial: ['B1', 'Residencial'],
      comercial_pequeno: ['B2', 'Comercial'],
      rural: ['B3', 'Rural'],
      comercial_grande: ['A3a', 'A4', 'Grande'],
      industrial: ['A1', 'A2', 'Industrial']
    },

    // Technical constraints (equipment requirements, protections, etc.)
    technical_constraints: {
      min_modulos: 1,
      max_modulos: 500,
      min_potencia_kw: 1.5,
      max_potencia_kw: 75,
      protecoes_obrigatorias: [
        'DPS_entrada',
        'DCEDC',
        'DCAC',
        'chave_seccionadora_cc',
        'chave_seccionadora_ca',
        'RCD_tipo_A'
      ],
      aterramento_obrigatorio: true,
      caixa_medicao_concessionaria: true
    }
  },

  // Additional profiles extracted from legacy knowledge (S3.6 preservation)

  enel_sp: {
    id: 'enel_sp',
    nome: 'ENEL São Paulo',
    aliases: ['enel', 'enel sp', 'enelsp'],
    estado: 'SP',
    region: 'Sudeste',
    ativo: true,

    parsing_rules: {
      nome_cliente: {
        patterns: [/(?:NOME|TITULAR)[\s:]+([A-ZÀÁÂÃÈÉÊÌÍÎÒÓÔÕÙÚÛ\s]+?)(?:\n|$)/i],
        required: true
      },
      cpf_cnpj_parcial: {
        patterns: [/(?:CPF|CNPJ)[\s:]*([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}|[0-9]{2}\.[0-9]{3}\.[0-9]{3}\/[0-9]{4}-[0-9]{2})/i],
        required: true
      },
      codigo_instalacao: {
        patterns: [/(?:UNIDADE CONSUMIDORA|UC|Código)[\s:]*([0-9]+)/i],
        required: true,
        critical: true
      },
      classe_tarifaria: {
        patterns: [/(?:CLASSE|GRUPO)[\s:]*([A-Z0-9]+)/i],
        required: true
      },
      tensao: {
        patterns: [/(?:TENSÃO|VOLTAGEM)[\s:]*([0-9]+)\s*V/i],
        required: true
      }
    },

    homologation_rules: {
      format: 'portal_enel_x',
      language: 'pt-BR',
      submission_method: 'portal_enel_gd',
      response_time_days: 30,
      special_notes: 'Algumas regiões ainda usam 127V monofásico. Verificar tensão local antes de dimensionar.'
    },

    tension_profiles: [
      { tensao: 127, tipo: 'monofasico', fases: 1, max_potencia_kw: 4.4, special_note: 'Algumas áreas de SP ainda 127V' },
      { tensao: 220, tipo: 'bifasico', fases: 2, max_potencia_kw: 8.8 },
      { tensao: 220, tipo: 'trifasico', fases: 3, max_potencia_kw: 50 }
    ],

    tariff_patterns: {
      residencial: ['B1', 'Residencial'],
      comercial: ['B2', 'Comercial'],
      industrial: ['A1', 'A2', 'A3', 'A4']
    },

    technical_constraints: {
      min_potencia_kw: 1.5,
      max_potencia_kw: 75,
      protecoes_obrigatorias: ['DPS_entrada', 'DCEDC', 'DCAC', 'RCD_tipo_A'],
      aterramento_obrigatorio: true
    }
  },

  copel_parana: {
    id: 'copel_parana',
    nome: 'COPEL Paraná',
    aliases: ['copel', 'coelpr'],
    estado: 'PR',
    region: 'Sul',
    ativo: true,

    parsing_rules: {
      nome_cliente: {
        patterns: [/(?:CLIENTE|TITULAR)[\s:]+([A-ZÀÁÂÃÈÉÊÌÍÎÒÓÔÕÙÚÛ\s]+?)(?:\n|$)/i],
        required: true
      },
      cpf_cnpj_parcial: {
        patterns: [/(?:CPF|CNPJ|INSCRIÇÃO)[\s:]*([0-9\.\-\/]+)/i],
        required: true
      },
      codigo_instalacao: {
        patterns: [/(?:CÓDIGO DA UNIDADE|UNIDADE CONSUMIDORA)[\s:]*([0-9]+)/i],
        required: true,
        critical: true
      },
      classe_tarifaria: {
        patterns: [/(?:CLASSE)[\s:]*([A-Z0-9]+)/i],
        required: true
      },
      tensao: {
        patterns: [/(?:TENSÃO)[\s:]*([0-9]+)\s*V/i],
        required: true
      }
    },

    homologation_rules: {
      format: 'portal_copel_gd',
      language: 'pt-BR',
      submission_method: 'portal_copel_online',
      response_time_days: 30,
      special_notes: 'Paraná migrou para 220V residencial (220/380V). Verificar padrão local.'
    },

    tension_profiles: [
      { tensao: 220, tipo: 'monofasico', fases: 1, max_potencia_kw: 4.4, note: 'Após migração para 220V' },
      { tensao: 220, tipo: 'bifasico', fases: 2, max_potencia_kw: 8.8 },
      { tensao: 220, tipo: 'trifasico', fases: 3, max_potencia_kw: 50 }
    ],

    tariff_patterns: {
      residencial: ['B1', 'Residencial'],
      comercial: ['B2', 'Comercial']
    },

    technical_constraints: {
      min_potencia_kw: 1.5,
      max_potencia_kw: 75
    }
  },

  cemig_minas: {
    id: 'cemig_minas',
    nome: 'CEMIG Distribuição (MG)',
    aliases: ['cemig', 'cemig-mg'],
    estado: 'MG',
    region: 'Sudeste',
    ativo: true,

    parsing_rules: {
      nome_cliente: {
        patterns: [/(?:CLIENTE|TITULAR)[\s:]+([A-ZÀÁÂÃÈÉÊÌÍÎÒÓÔÕÙÚÛ\s]+?)(?:\n|$)/i],
        required: true
      },
      codigo_instalacao: {
        patterns: [/(?:UNIDADE CONSUMIDORA|UC)[\s:]*([0-9]+)/i],
        required: true,
        critical: true
      }
    },

    homologation_rules: {
      format: 'portal_engenheiro_cemig',
      language: 'pt-BR',
      submission_method: 'sistema_gd_cemig',
      response_time_days: 30,
      required_form: 'CEMIG-GD-01',
      special_notes: 'Submissão online via Portal do Engenheiro CEMIG obrigatória.'
    },

    tension_profiles: [
      { tensao: 127, tipo: 'monofasico', fases: 1, max_potencia_kw: 4.4 },
      { tensao: 220, tipo: 'bifasico', fases: 2, max_potencia_kw: 8.8 },
      { tensao: 220, tipo: 'trifasico', fases: 3, max_potencia_kw: 50 }
    ],

    tariff_patterns: {
      residencial: ['B1', 'Residencial'],
      comercial: ['B2', 'Comercial']
    },

    technical_constraints: {
      min_potencia_kw: 1.5,
      max_potencia_kw: 75
    }
  },

  energisa_paraiba: {
    id: 'energisa_paraiba',
    nome: 'Energisa Paraíba',
    aliases: ['energisa', 'energisa-pb', 'epb'],
    estado: 'PB',
    region: 'Nordeste',
    ativo: true,

    parsing_rules: {
      nome_cliente: {
        patterns: [/(?:CLIENTE|TITULAR)[\s:]+([A-ZÀÁÂÃÈÉÊÌÍÎÒÓÔÕÙÚÛ\s]+?)(?:\n|$)/i],
        required: true
      },
      codigo_instalacao: {
        patterns: [/(?:UNIDADE|UC|CÓDIGO)[\s:]*([0-9]+)/i],
        required: true,
        critical: true
      }
    },

    homologation_rules: {
      format: 'portal_energisa',
      language: 'pt-BR',
      submission_method: 'portal_gd_energisa',
      response_time_days: 30
    },

    tension_profiles: [
      { tensao: 127, tipo: 'monofasico', fases: 1, max_potencia_kw: 4.4 },
      { tensao: 220, tipo: 'bifasico', fases: 2, max_potencia_kw: 8.8 },
      { tensao: 220, tipo: 'trifasico', fases: 3, max_potencia_kw: 50 }
    ],

    tariff_patterns: {
      residencial: ['B1', 'Residencial'],
      comercial: ['B2', 'Comercial']
    },

    technical_constraints: {
      min_potencia_kw: 1.5,
      max_potencia_kw: 75
    }
  }
}

/**
 * Get profile by distributor ID
 */
export function getConcessionariaProfile(distributorId) {
  const normalizedId = distributorId.toLowerCase().trim()

  // Direct lookup
  if (CONCESSIONARIA_PROFILES[normalizedId]) {
    return CONCESSIONARIA_PROFILES[normalizedId]
  }

  // Alias lookup
  for (const [key, profile] of Object.entries(CONCESSIONARIA_PROFILES)) {
    if (profile.aliases && profile.aliases.includes(normalizedId)) {
      return profile
    }
  }

  return null
}

/**
 * Get active profiles
 */
export function getActiveProfiles() {
  return Object.values(CONCESSIONARIA_PROFILES).filter(p => p.ativo)
}

/**
 * List all available distributors
 */
export function listDistributors() {
  return Object.values(CONCESSIONARIA_PROFILES).map(p => ({
    id: p.id,
    nome: p.nome,
    estado: p.estado,
    region: p.region,
    ativo: p.ativo
  }))
}

/**
 * Add new concessionária profile
 */
export function registerProfile(profileDefinition) {
  const { id, nome, aliases = [] } = profileDefinition

  if (!id || !nome) {
    throw new Error('Profile must have id and nome')
  }

  CONCESSIONARIA_PROFILES[id] = {
    ...profileDefinition,
    ativo: true
  }

  return CONCESSIONARIA_PROFILES[id]
}
