// backend/src/parser/contracts/parserContracts.js

/**
 * PARSER CONTRACTS
 *
 * These contracts define the immutable boundaries of the parser system.
 * They ONLY define data structures, NOT executable logic.
 *
 * CRITICAL: These contracts are DOCUMENTATION and VALIDATION.
 * They enforce the separation between:
 * - Parser (extraction/normalization)
 * - Engineering (sizing/validation)
 */

/**
 * RAWDTO CONTRACT
 *
 * Parser output: Raw extracted data from PDF
 * NO normalization, NO imputation, NO engineering decisions
 *
 * This is what the PDF actually contained.
 */
export const RawDTOContract = {
  // Validation schema
  schema: {
    distributorId: 'string',
    distributorNome: 'string',
    extractedAt: 'ISO8601',

    cliente: {
      nome_cliente: 'string|null',
      cpf_cnpj_parcial: 'string|null',
      endereco: 'string|null',
      bairro: 'string|null',
      cidade: 'string|null',
      estado: 'string|null',
      cep: 'string|null'
    },

    unidade: {
      codigo_cliente: 'string|null',
      codigo_instalacao: 'string|null',
      classe_tarifaria: 'string|null',
      tipo_fornecimento: 'string|null',
      tensao: 'number|null',
      modalidade: 'string|null',
      referencia_fatura: 'string|null',
      leitura_atual: 'number|null',
      leitura_anterior: 'number|null',
      numero_dias: 'number|null'
    },

    consumo: {
      consumo_medio: 'number|null',
      consumo_meses_brutos: 'array<{mes, ano, consumo_kwh, dias}>',
      compensacao_energia: 'number|null',
      tarifa: 'number|null'
    },

    parserMetadata: {
      version: 'string',
      confidenceScore: 'number[0-100]',
      criticalFieldsMissing: 'array<string>',
      extractionErrors: 'array<string>'
    }
  },

  description: `
    Raw extraction output.
    Represents EXACTLY what the PDF contained.
    May have missing fields, incomplete arrays, uncertain data.

    This is NEVER fed to engineering.
    This goes through NORMALIZER first.
  `
}

/**
 * NORMALIZEDDTO CONTRACT
 *
 * Normalizer output: Production-ready input for engineering
 *
 * CRITICAL INVARIANTS:
 * - consumo_12_meses ALWAYS has exactly 12 elements
 * - Missing months are imputed deterministically
 * - All required fields are present (throws if not)
 * - Stable ordering guaranteed
 * - Deterministic and replayable
 */
export const NormalizedDTOContract = {
  schema: {
    distributorId: 'string',
    distributorNome: 'string',

    cliente: {
      nome_cliente: 'string',
      cpf_cnpj_parcial: 'string',
      endereco: 'string',
      bairro: 'string|null',
      cidade: 'string',
      estado: 'string[2]',
      cep: 'string|null'
    },

    unidade: {
      codigo_cliente: 'string',
      codigo_instalacao: 'string',  // MANDATORY - throws if missing
      classe_tarifaria: 'string',
      tipo_fornecimento: 'string',
      tensao: 'number > 0',
      modalidade: 'string',
      referencia_fatura: 'string',
      leitura_atual: 'number|null',
      leitura_anterior: 'number|null',
      numero_dias: 'number > 0'
    },

    consumo: {
      consumo_medio: 'number >= 0',
      consumo_12_meses: 'array<number>[EXACTLY 12]',  // CRITICAL
      dados_estimados: 'boolean',
      posicoes_array: '12',
      compensacao_energia: 'number >= 0',
      tarifa: 'number|null',
      perfil_consumo: 'string',
      sazonalidade: {
        desvio_padrao: 'number',
        coeficiente_variacao: 'number',
        sazonalidade: 'string[LOW|MEDIUM|HIGH]'
      }
    },

    normalizationMetadata: {
      confianca_extracao: 'number[0-100]',
      imputedMonths: 'number',
      imputationMethod: 'string',
      mediaImputada: 'number',
      deterministic: 'true'
    }
  },

  invariants: [
    'consumo_12_meses.length === 12',
    'codigo_instalacao !== null',
    'codigo_instalacao !== ""',
    'consumo_12_meses.every(c => Number.isFinite(c) && c >= 0)',
    'All field values deterministic (same input → same output)',
    'confianca_extracao is quality metric, not boolean'
  ],

  description: `
    Normalized extraction ready for engineering.

    GUARANTEES:
    - 12-position consumption array (imputed if needed)
    - All required fields present
    - Deterministic and replayable
    - Safe to freeze via deepFreezeSafe()
    - Can be fed to FV engine without modification

    This is the ONLY output that enters engineering.
  `
}

/**
 * CONCESSIONARIAPROFILE CONTRACT
 *
 * PURE DATA STRUCTURE
 * Defines distributor-specific configuration ONLY
 * Contains NO executable business logic
 * Contains NO engineering decisions
 *
 * CRITICAL: This is CONFIGURATION, not CODE
 */
export const ConcessionariaProfileContract = {
  schema: {
    // Identification
    id: 'string',
    nome: 'string',
    aliases: 'array<string>',
    estado: 'string[2]',
    region: 'string',
    ativo: 'boolean',

    // Parsing rules (regex patterns only)
    parsing_rules: {
      '[fieldName]': {
        patterns: 'array<RegExp>',
        required: 'boolean',
        critical: 'boolean|optional',
        type: 'string|numeric|optional'
      }
    },

    // Homologation rules (data only)
    homologation_rules: {
      format: 'string',
      language: 'string',
      required_documents: 'array<string>',
      submission_method: 'string',
      response_time_days: 'number'
    },

    // Technical profiles (data only)
    tension_profiles: 'array<{tensao, tipo, fases, max_potencia_kw}>',
    tariff_patterns: 'object<category, aliases[]>',
    technical_constraints: 'object<constraint_name, value>'
  },

  invariants: [
    'Only data, NO executable code',
    'Only configuration, NO business logic',
    'Only metadata, NO engineering decisions',
    'Immutable after registration',
    'Can be edited without touching parser core'
  ],

  description: `
    Concessionária configuration profile.

    This is PURE DATA:
    - Parsing patterns
    - Homologation metadata
    - Technical constraints

    This is NOT LOGIC:
    - No field selection algorithms
    - No engineering rules
    - No validation decisions
    - No sizing recommendations

    Profiles are editable CONFIGURATION.
    Parser CORE is immutable CODE.
  `
}

/**
 * PARSER CORE CONTRACT
 *
 * The immutable engine that orchestrates parsing
 * Takes: PDF Buffer + ConcessionariaProfile
 * Returns: RawDTO
 */
export const ParserCoreContract = {
  interface: {
    parseBillPDF: 'async(pdfBuffer, distributorId) -> RawDTO'
  },

  invariants: [
    'NEVER mutates input',
    'NEVER contains hardcoded distributor logic',
    'ONLY uses ConcessionariaProfile configuration',
    'Supports any distributor via profile',
    'Pure function: same input -> same output',
    'Deterministic extraction only'
  ]
}

/**
 * NORMALIZER CONTRACT
 *
 * The gateway between parser and engineering
 * Takes: RawDTO
 * Returns: NormalizedDTO (frozen, deterministic, production-ready)
 */
export const NormalizerContract = {
  interface: {
    normalize: 'async(rawDTO) -> NormalizedDTO'
  },

  responsibilities: [
    'Enforce required field presence (throw if missing)',
    'Impute missing months -> 12-position array',
    'Normalize data types',
    'Calculate derived fields (sazonalidade, perfil)',
    'Calculate confidence score',
    'Freeze output via deepFreezeSafe()',
    'Preserve determinism'
  ],

  invariants: [
    'consumo_12_meses is ALWAYS 12 elements',
    'Throws ERR_CRITICAL_MISSING_FIELD if codigo_instalacao missing',
    'Deterministic imputation (available months average)',
    'dados_estimados tracks if imputation occurred',
    'Output is frozen (immutable at runtime)',
    'Same RawDTO -> Same NormalizedDTO ALWAYS'
  ],

  description: `
    The ONLY gateway into the engineering pipeline.

    Parser output (RawDTO) enters here.
    Only NormalizedDTO exits to engineering.

    This is where:
    - Missing data is imputed
    - Required fields are enforced
    - 12-position consumption array is guaranteed
    - Immutability boundary is established
  `
}

/**
 * Validation helper
 */
export function validateContract(data, contractSchema) {
  // This is a placeholder for actual validation
  // In production, would use schema validator library
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data: not an object')
  }
  return data
}
