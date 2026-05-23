// backend/src/electrical/dto/mobilityProjectDTO.js

import { deepFreezeSafe } from '../../utils/freeze.js'
import {
  StructuredEngineError,
  ErrorSeverity,
  ErrorCategory
} from '../../utils/errors.js'

/**
 * MobilityDTO Contract
 *
 * Governs EV charging infrastructure validation contracts.
 * Pure validation, no optimization logic.
 * Deterministic serialization compatible.
 *
 * Immutable output: all fields frozen recursively.
 */

export function validateMobilityProjectDTO(mobilityData) {
  const errorTracking = new Set()

  // Input structure validation
  if (!mobilityData || typeof mobilityData !== 'object' || Array.isArray(mobilityData)) {
    throw new StructuredEngineError({
      code: 'ERR_MOBILITY_PAYLOAD_INVALID',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.ELECTRICAL_PHYSICS,
      message: 'Mobility data must be a non-array object'
    })
  }

  // Required field: carregadores (charging infrastructure)
  if (!Array.isArray(mobilityData.carregadores)) {
    errorTracking.add('ERR_MOBILITY_CARREGADORES_INVALID')
  }

  // Required field: demanda_simultanea_kw (simultaneous demand)
  if (typeof mobilityData.demanda_simultanea_kw !== 'number' || !Number.isFinite(mobilityData.demanda_simultanea_kw)) {
    errorTracking.add('ERR_MOBILITY_DEMANDA_INVALIDA')
  } else if (mobilityData.demanda_simultanea_kw < 0) {
    errorTracking.add('ERR_MOBILITY_DEMANDA_NEGATIVA')
  }

  // Required field: potencia_total_kw (total charging power)
  if (typeof mobilityData.potencia_total_kw !== 'number' || !Number.isFinite(mobilityData.potencia_total_kw)) {
    errorTracking.add('ERR_MOBILITY_POTENCIA_INVALIDA')
  } else if (mobilityData.potencia_total_kw < 0) {
    errorTracking.add('ERR_MOBILITY_POTENCIA_NEGATIVA')
  }

  // Required field: fator_simultaneidade (simultaneity factor)
  if (typeof mobilityData.fator_simultaneidade !== 'number' || !Number.isFinite(mobilityData.fator_simultaneidade)) {
    errorTracking.add('ERR_MOBILITY_FATOR_INVALIDO')
  } else if (mobilityData.fator_simultaneidade < 0 || mobilityData.fator_simultaneidade > 1) {
    errorTracking.add('ERR_MOBILITY_FATOR_OUT_OF_RANGE')
  }

  // Required field: estrategia_carregamento (charging strategy)
  const validStrategies = ['SEQUENCIAL', 'SIMULTANEO', 'ADAPTATIVO', 'PRIORIZADO']
  if (typeof mobilityData.estrategia_carregamento !== 'string' || !validStrategies.includes(mobilityData.estrategia_carregamento)) {
    errorTracking.add('ERR_MOBILITY_ESTRATEGIA_INVALIDA')
  }

  // Required field: limite_rede_kw (grid limit)
  if (typeof mobilityData.limite_rede_kw !== 'number' || !Number.isFinite(mobilityData.limite_rede_kw)) {
    errorTracking.add('ERR_MOBILITY_LIMITE_REDE_INVALIDO')
  } else if (mobilityData.limite_rede_kw <= 0) {
    errorTracking.add('ERR_MOBILITY_LIMITE_REDE_POSITIVO')
  }

  // Required field: prioridade_carga (load priority: 0-1, higher = higher priority)
  if (typeof mobilityData.prioridade_carga !== 'number' || !Number.isFinite(mobilityData.prioridade_carga)) {
    errorTracking.add('ERR_MOBILITY_PRIORIDADE_INVALIDA')
  } else if (mobilityData.prioridade_carga < 0 || mobilityData.prioridade_carga > 1) {
    errorTracking.add('ERR_MOBILITY_PRIORIDADE_OUT_OF_RANGE')
  }

  // Required field: modo_operacao (operating mode)
  const validModos = ['CARREGAMENTO', 'ESPERA', 'DESCARREGAMENTO']
  if (typeof mobilityData.modo_operacao !== 'string' || !validModos.includes(mobilityData.modo_operacao)) {
    errorTracking.add('ERR_MOBILITY_MODO_INVALIDO')
  }

  // Required field: protecoes (protection measures)
  if (!mobilityData.protecoes || typeof mobilityData.protecoes !== 'object' || Array.isArray(mobilityData.protecoes)) {
    errorTracking.add('ERR_MOBILITY_PROTECOES_INVALIDA')
  }

  // Temperature bounds validation (inherited from engenharia context)
  if (typeof mobilityData.temperatura_minima_projeto !== 'number' || !Number.isFinite(mobilityData.temperatura_minima_projeto)) {
    errorTracking.add('ERR_MOBILITY_TEMP_MIN_INVALIDA')
  }

  if (typeof mobilityData.temperatura_maxima_projeto !== 'number' || !Number.isFinite(mobilityData.temperatura_maxima_projeto)) {
    errorTracking.add('ERR_MOBILITY_TEMP_MAX_INVALIDA')
  }

  if (errorTracking.size > 0) {
    throw new StructuredEngineError({
      code: 'ERR_MOBILITY_DTO_VALIDATION_FAILED',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.ELECTRICAL_PHYSICS,
      message: `Mobility DTO validation failed: ${Array.from(errorTracking).join(', ')}`
    })
  }

  // Return immutable validated payload
  return deepFreezeSafe({
    data: {
      carregadores: mobilityData.carregadores,
      demanda_simultanea_kw: mobilityData.demanda_simultanea_kw,
      potencia_total_kw: mobilityData.potencia_total_kw,
      fator_simultaneidade: mobilityData.fator_simultaneidade,
      estrategia_carregamento: mobilityData.estrategia_carregamento,
      limite_rede_kw: mobilityData.limite_rede_kw,
      prioridade_carga: mobilityData.prioridade_carga,
      modo_operacao: mobilityData.modo_operacao,
      protecoes: mobilityData.protecoes,
      temperatura_minima_projeto: mobilityData.temperatura_minima_projeto,
      temperatura_maxima_projeto: mobilityData.temperatura_maxima_projeto
    },
    schema_version: '1.0.0'
  })
}
