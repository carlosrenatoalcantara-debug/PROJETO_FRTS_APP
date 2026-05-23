// backend/src/electrical/validators/evDomainValidator.js

import { deepFreezeSafe } from '../../utils/freeze.js'
import {
  StructuredEngineError,
  ErrorSeverity,
  ErrorCategory
} from '../../utils/errors.js'
import { validateMobilityProjectDTO } from '../dto/mobilityProjectDTO.js'
import { EV_INVARIANTS } from '../constants/evInvariants.js'
import { executeChargingApprovalPipeline } from '../pipelines/evChargingApprovalPipeline.js'

/**
 * EV Domain Validator
 *
 * Pure validation of EV charging infrastructure against governance invariants.
 * NO optimization logic.
 * NO smart charging.
 * NO dynamic scheduling.
 * NO communication with FV or BESS validators.
 *
 * Input Contract: EnergyContext (immutable, read-only)
 * - available_pv_kw: Available solar generation (from FV domain)
 * - available_bess_kw: Available battery discharge (from BESS domain)
 * - grid_limit_kw: Grid connection limit
 * - load_priority: Base load priority (inherited from orchestrator)
 * - operating_mode: System operating mode (CARREGAMENTO, ESPERA, DESCARREGAMENTO)
 *
 * Output: Frozen immutable validation result
 *
 * Pure Function Guarantee:
 * - No side effects
 * - No shared state modification
 * - Deterministic output for identical inputs
 * - No temporal dependencies (no Date.now, Math.random)
 */

export function validateEVDomain(mobilityData, energyContext, engenharia = {}) {
  // Validate input contract
  if (!energyContext || typeof energyContext !== 'object' || Array.isArray(energyContext)) {
    throw new StructuredEngineError({
      code: 'ERR_EV_ENERGY_CONTEXT_INVALID',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.ELECTRICAL_PHYSICS,
      message: 'EnergyContext must be a non-array object'
    })
  }

  // Validate MobilityDTO structure
  let mobilityValidated
  try {
    mobilityValidated = validateMobilityProjectDTO(mobilityData)
  } catch (err) {
    throw new StructuredEngineError({
      code: 'ERR_EV_MOBILITY_VALIDATION_FAILED',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.ELECTRICAL_PHYSICS,
      message: `Mobility DTO validation error: ${err.message}`
    })
  }

  const data = mobilityValidated.data

  // CRITICAL GOVERNANCE: Freeze inputs before pipeline execution
  // Ensures immutability throughout validation pipeline
  const frozenEnergyContext = Object.freeze({ ...energyContext })
  const frozenMobilityData = Object.freeze({
    ...data,
    carregadores: Object.freeze([...(data.carregadores || [])]),
    protecoes: Object.freeze({ ...(data.protecoes || {}) })
  })

  // Execute charging approval pipeline
  // Pure function: deterministic, stateless, side-effect-free
  const pipelineResult = executeChargingApprovalPipeline(frozenEnergyContext, frozenMobilityData)

  // Build final EV Result contract (frozen)
  const result = {
    ev_score: pipelineResult.ev_score,
    score_eletrico: pipelineResult.score_eletrico, // Alias for consistency
    aprovado: pipelineResult.aprovado,
    validacoes: pipelineResult.validacoes,
    alertas: pipelineResult.alertas,
    status: pipelineResult.status,
    schema_version: '1.0.0'
  }

  return deepFreezeSafe(result)
}

/**
 * Contract Guarantees
 *
 * Input:
 * - mobilityData: validated via validateMobilityProjectDTO
 * - energyContext: immutable, read-only reference to available resources
 * - engenharia: temperature bounds (optional)
 *
 * Output:
 * - Immutable frozen object
 * - Deterministic for identical inputs
 * - No side effects
 * - No FV/BESS validator dependencies
 *
 * Forbidden:
 * - Do NOT import FV validators
 * - Do NOT import BESS validators
 * - Do NOT modify energyContext
 * - Do NOT create shared state
 * - Do NOT use temporal functions
 */
