// backend/src/electrical/constants/evInvariants.js

/**
 * EV Domain Invariants
 *
 * Pure validation rules for EV charging infrastructure.
 * No optimization logic. No dynamic scheduling.
 * Immutable governance constants.
 *
 * Invariant Categories:
 * - BLOCKING: Project fails if violated
 * - WARNING: Project passes but with alert
 * - INFORMATIONAL: Logged for analysis only
 */

export const EV_INVARIANTS = {
  // 1. Transformador Overload Protection (BLOCKING)
  TRANSFORMADOR_OVERLOAD: {
    code: 'EV_TRANSFORMADOR_OVERLOAD',
    category: 'BLOCKING',
    severity: 'CRITICO',
    description: 'Simultaneous EV charge demand exceeds transformer capacity',
    limit_percentage: 0.8, // 80% of transformer rating
    enforcement: 'hard'
  },

  // 2. Ramal Overload Protection (BLOCKING)
  RAMAL_OVERLOAD: {
    code: 'EV_RAMAL_OVERLOAD',
    category: 'BLOCKING',
    severity: 'CRITICO',
    description: 'Circuit branch current exceeds rated capacity',
    limit_percentage: 0.8, // 80% of branch rating
    enforcement: 'hard'
  },

  // 3. Simultaneidade Validation (BLOCKING)
  SIMULTANEIDADE_VIOLATION: {
    code: 'EV_SIMULTANEIDADE_VIOLATION',
    category: 'BLOCKING',
    severity: 'CRITICO',
    description: 'Simultaneous charging demand violates time-based constraints',
    max_simultaneous_vehicles: 3, // Site-specific, configurable
    enforcement: 'hard'
  },

  // 4. Corrente Máxima (BLOCKING)
  CORRENTE_MAXIMA: {
    code: 'EV_CORRENTE_MAXIMA',
    category: 'BLOCKING',
    severity: 'CRITICO',
    description: 'EV charging current exceeds safe limit',
    max_current_a: 63, // Per IEC 61851 (Type 2 connector limit)
    enforcement: 'hard'
  },

  // 5. Seletividade de Proteção (WARNING)
  SELETIVIDADE_DEGRADED: {
    code: 'EV_SELETIVIDADE_DEGRADED',
    category: 'WARNING',
    severity: 'ADVERTENCIA',
    description: 'Circuit protection selectivity may be compromised',
    enforcement: 'soft'
  },

  // 6. Queda de Tensão (WARNING)
  QUEDA_TENSAO_LIMITE: {
    code: 'EV_QUEDA_TENSAO_LIMITE',
    category: 'WARNING',
    severity: 'ADVERTENCIA',
    description: 'Voltage drop during charging exceeds recommended threshold',
    max_voltage_drop_percent: 3.0, // 3% nominal voltage
    enforcement: 'soft'
  },

  // 7. Trifásico Desbalanceamento (WARNING)
  TRIFASICO_DESBALANÇO: {
    code: 'EV_TRIFASICO_DESBALANÇO',
    category: 'WARNING',
    severity: 'ADVERTENCIA',
    description: 'Unbalanced loading across three-phase system',
    max_imbalance_percent: 10.0, // 10% phase current variation allowed
    enforcement: 'soft'
  },

  // 8. Limite da Rede (BLOCKING)
  LIMITE_REDE: {
    code: 'EV_LIMITE_REDE',
    category: 'BLOCKING',
    severity: 'CRITICO',
    description: 'Total EV load exceeds grid connection limit',
    enforcement: 'hard'
  },

  // 9. Fallback de Segurança (BLOCKING)
  FALLBACK_SEGURANCA: {
    code: 'EV_FALLBACK_SEGURANCA',
    category: 'BLOCKING',
    severity: 'CRITICO',
    description: 'Safety fallback condition: charging mode invalid or unsafe',
    enforcement: 'hard'
  },

  // 10. Anti-Islanding (BLOCKING)
  ANTI_ISLANDING: {
    code: 'EV_ANTI_ISLANDING',
    category: 'BLOCKING',
    severity: 'CRITICO',
    description: 'Islanding protection verification failed',
    enforcement: 'hard'
  }
}

/**
 * Invariant Enforcement Policies
 *
 * BLOCKING (hard):
 * - Project approval blocked if violated
 * - Must be resolved before charging can proceed
 * - Included in falhas array
 * - score_eletrico penalty applied
 *
 * WARNING (soft):
 * - Project approval allowed
 * - Alert issued for monitoring
 * - Included in alertas array
 * - No score penalty (informational only)
 *
 * INFORMATIONAL:
 * - Logged for analysis
 * - No impact on approval
 * - Future enhancement point
 */

export const INVARIANT_POLICIES = {
  BLOCKING: {
    approval_impact: true,
    score_penalty: 0.2, // 20% score reduction per blocking violation
    array_field: 'falhas'
  },
  WARNING: {
    approval_impact: false,
    score_penalty: 0.0, // No score impact for warnings
    array_field: 'alertas'
  },
  INFORMATIONAL: {
    approval_impact: false,
    score_penalty: 0.0,
    array_field: null // Not propagated to output
  }
}

/**
 * Deterministic Default Values
 *
 * Applied when values not provided in MobilityDTO
 */
export const EV_DEFAULTS = {
  fator_simultaneidade: 1.0, // All vehicles can charge simultaneously (conservative)
  estrategia_carregamento: 'SEQUENCIAL', // Sequential charging (safe default)
  prioridade_carga: 0.5, // Medium priority (equal to other loads)
  modo_operacao: 'CARREGAMENTO', // Charging mode (typical operation)
  temperatura_minima_projeto: 0, // 0°C minimum
  temperatura_maxima_projeto: 45, // 45°C maximum
  protecoes: {
    rcd_enabled: true, // RCD protection enabled
    overvoltage_protection: true,
    overcurrent_protection: true,
    temperature_monitoring: true
  }
}
