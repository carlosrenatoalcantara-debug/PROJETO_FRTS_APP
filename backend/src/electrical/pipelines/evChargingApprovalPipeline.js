// backend/src/electrical/pipelines/evChargingApprovalPipeline.js

/**
 * EV Charging Approval Pipeline
 *
 * Deterministic, replayable validation pipeline for EV charging infrastructure.
 * Pure function: stateless, side-effect-free, deterministic output.
 *
 * Architecture:
 * 1. Freeze inputs (EnergyContext, MobilityDTO)
 * 2. Sequential invariant stages
 * 3. Isolated rule evaluation
 * 4. Deterministic aggregation
 * 5. Freeze output
 *
 * Immutability Enforcement:
 * - All inputs must be immutable before pipeline entry
 * - All intermediate results frozen
 * - Final output frozen before return
 *
 * NO side effects, NO hidden state, NO cross-validator communication.
 */

import { EV_INVARIANTS, INVARIANT_POLICIES } from '../constants/evInvariants.js'

/**
 * Pipeline Stage: Blocking Invariant Validation
 *
 * Evaluates blocking invariants (must pass for approval).
 * Returns isolated validation results for each blocking rule.
 * NO mutation of inputs.
 */
function executeBlockingInvariants(energyContext, mobilityData) {
  const results = {}

  // Stage 1: Transformador Overload
  // Check if simultaneous EV demand exceeds transformer safe limit (80%)
  const demandaSimultanea = mobilityData.demanda_simultanea_kw || 0
  const gridLimit = energyContext.grid_limit_kw || 0
  const transformadorSafeLimit = gridLimit * EV_INVARIANTS.TRANSFORMADOR_OVERLOAD.limit_percentage

  results.transformador = {
    validacao: demandaSimultanea <= transformadorSafeLimit,
    code: EV_INVARIANTS.TRANSFORMADOR_OVERLOAD.code,
    categoria: EV_INVARIANTS.TRANSFORMADOR_OVERLOAD.category,
    nivel: EV_INVARIANTS.TRANSFORMADOR_OVERLOAD.severity,
    mensagem: demandaSimultanea <= transformadorSafeLimit
      ? null
      : `EV simultaneous demand (${demandaSimultanea.toFixed(2)} kW) exceeds transformer safe limit (${transformadorSafeLimit.toFixed(2)} kW)`,
    demand: demandaSimultanea,
    limit: transformadorSafeLimit
  }

  // Stage 2: Ramal Overload (per-charger circuit analysis)
  const chargersCount = Array.isArray(mobilityData.carregadores) ? mobilityData.carregadores.length : 0
  let ramalPasses = true
  let ramalMessage = null

  if (chargersCount > 0) {
    const avgPowerPerCharger = mobilityData.potencia_total_kw / chargersCount
    const estimatedCurrent = (avgPowerPerCharger * 1000) / 230 // Single-phase 230V reference
    if (estimatedCurrent > EV_INVARIANTS.CORRENTE_MAXIMA.max_current_a) {
      ramalPasses = false
      ramalMessage = `Per-charger current (${estimatedCurrent.toFixed(2)}A) exceeds limit`
    }
  }

  results.ramal = {
    validacao: ramalPasses,
    code: EV_INVARIANTS.RAMAL_OVERLOAD.code,
    categoria: EV_INVARIANTS.RAMAL_OVERLOAD.category,
    nivel: EV_INVARIANTS.RAMAL_OVERLOAD.severity,
    mensagem: ramalMessage,
    chargers: chargersCount
  }

  // Stage 3: Simultaneidade Violation
  // Check if charger count exceeds safe simultaneous limit
  const simultaneidadePasses = chargersCount <= EV_INVARIANTS.SIMULTANEIDADE_VIOLATION.max_simultaneous_vehicles ||
                              (mobilityData.fator_simultaneidade || 1.0) < 0.5

  results.simultaneidade = {
    validacao: simultaneidadePasses,
    code: EV_INVARIANTS.SIMULTANEIDADE_VIOLATION.code,
    categoria: EV_INVARIANTS.SIMULTANEIDADE_VIOLATION.category,
    nivel: EV_INVARIANTS.SIMULTANEIDADE_VIOLATION.severity,
    mensagem: simultaneidadePasses ? null : `Charger count (${chargersCount}) exceeds safe simultaneous limit`,
    chargers: chargersCount,
    limit: EV_INVARIANTS.SIMULTANEIDADE_VIOLATION.max_simultaneous_vehicles
  }

  // Stage 4: Corrente Máxima (absolute maximum current limit)
  const maxCurrent = demandaSimultanea > 0 && gridLimit > 0
    ? (demandaSimultanea * 1000) / 400 // 3-phase 400V reference
    : 0

  const correntePasses = maxCurrent <= EV_INVARIANTS.CORRENTE_MAXIMA.max_current_a

  results.corrente = {
    validacao: correntePasses,
    code: EV_INVARIANTS.CORRENTE_MAXIMA.code,
    categoria: EV_INVARIANTS.CORRENTE_MAXIMA.category,
    nivel: EV_INVARIANTS.CORRENTE_MAXIMA.severity,
    mensagem: correntePasses ? null : `Maximum current (${maxCurrent.toFixed(2)}A) exceeds limit`,
    current: maxCurrent,
    limit: EV_INVARIANTS.CORRENTE_MAXIMA.max_current_a
  }

  // Stage 5: Limite da Rede (grid connection limit)
  const limiteRedePasses = demandaSimultanea <= gridLimit

  results.limite_rede = {
    validacao: limiteRedePasses,
    code: EV_INVARIANTS.LIMITE_REDE.code,
    categoria: EV_INVARIANTS.LIMITE_REDE.category,
    nivel: EV_INVARIANTS.LIMITE_REDE.severity,
    mensagem: limiteRedePasses ? null : `EV demand (${demandaSimultanea.toFixed(2)} kW) exceeds grid limit`,
    demand: demandaSimultanea,
    limit: gridLimit
  }

  // Stage 6: Fallback de Segurança (safe mode validation)
  const validModos = ['CARREGAMENTO', 'ESPERA', 'DESCARREGAMENTO']
  const operatingMode = energyContext.operating_mode || 'CARREGAMENTO'
  const fallbackPasses = validModos.includes(operatingMode)

  results.fallback_seguranca = {
    validacao: fallbackPasses,
    code: EV_INVARIANTS.FALLBACK_SEGURANCA.code,
    categoria: EV_INVARIANTS.FALLBACK_SEGURANCA.category,
    nivel: EV_INVARIANTS.FALLBACK_SEGURANCA.severity,
    mensagem: fallbackPasses ? null : `Invalid operating mode: ${operatingMode}`,
    mode: operatingMode
  }

  // Stage 7: Anti-Islanding
  const protecoes = mobilityData.protecoes || {}
  const antiIslandingPasses = protecoes.overvoltage_protection !== false || operatingMode === 'ESPERA'

  results.anti_islanding = {
    validacao: antiIslandingPasses,
    code: EV_INVARIANTS.ANTI_ISLANDING.code,
    categoria: EV_INVARIANTS.ANTI_ISLANDING.category,
    nivel: EV_INVARIANTS.ANTI_ISLANDING.severity,
    mensagem: antiIslandingPasses ? null : 'Anti-islanding protection not configured',
    protection_enabled: protecoes.overvoltage_protection === true
  }

  return Object.freeze(results)
}

/**
 * Pipeline Stage: Warning Invariant Validation
 *
 * Evaluates warning invariants (do NOT block approval).
 * Returns isolated validation results.
 * Warnings are informational for monitoring.
 */
function executeWarningInvariants(energyContext, mobilityData) {
  const results = {}

  // Stage 1: Seletividade de Proteção
  const protecoes = mobilityData.protecoes || {}
  const seletividadePasses = protecoes.rcd_enabled && protecoes.overcurrent_protection

  results.seletividade = {
    validacao: seletividadePasses,
    code: EV_INVARIANTS.SELETIVIDADE_DEGRADED.code,
    categoria: EV_INVARIANTS.SELETIVIDADE_DEGRADED.category,
    nivel: EV_INVARIANTS.SELETIVIDADE_DEGRADED.severity,
    mensagem: seletividadePasses ? null : 'Protection selectivity may be degraded',
    rcd_enabled: protecoes.rcd_enabled === true,
    overcurrent_enabled: protecoes.overcurrent_protection === true
  }

  // Stage 2: Queda de Tensão (voltage drop)
  const demandaSimultanea = mobilityData.demanda_simultanea_kw || 0
  const gridLimit = energyContext.grid_limit_kw || 0
  const loadRatio = gridLimit > 0 ? demandaSimultanea / gridLimit : 0
  const quedaTensaoPasses = loadRatio <= 0.7

  results.queda_tensao = {
    validacao: quedaTensaoPasses,
    code: EV_INVARIANTS.QUEDA_TENSAO_LIMITE.code,
    categoria: EV_INVARIANTS.QUEDA_TENSAO_LIMITE.category,
    nivel: EV_INVARIANTS.QUEDA_TENSAO_LIMITE.severity,
    mensagem: quedaTensaoPasses ? null : `High load ratio (${(loadRatio * 100).toFixed(1)}%) may cause voltage drop > 3%`,
    load_ratio: loadRatio,
    threshold: 0.7
  }

  // Stage 3: Trifásico Desbalanceamento
  const chargersCount = Array.isArray(mobilityData.carregadores) ? mobilityData.carregadores.length : 0
  const trifasicoPasses = chargersCount % 3 === 0

  results.trifasico = {
    validacao: trifasicoPasses,
    code: EV_INVARIANTS.TRIFASICO_DESBALANÇO.code,
    categoria: EV_INVARIANTS.TRIFASICO_DESBALANÇO.category,
    nivel: EV_INVARIANTS.TRIFASICO_DESBALANÇO.severity,
    mensagem: trifasicoPasses ? null : `Charger count (${chargersCount}) not divisible by 3`,
    chargers: chargersCount,
    note: 'Distribute evenly across phases for optimal balancing'
  }

  return Object.freeze(results)
}

/**
 * Pipeline Stage: Deterministic Aggregation
 *
 * Aggregates blocking + warning results into final validation array.
 * Maintains deterministic ordering via canonical sorting.
 * Returns frozen immutable result.
 */
function aggregateValidationResults(blockingResults, warningResults) {
  const allValidacoes = {}

  // Extract blocking validations
  const blockingKeys = Object.keys(blockingResults).sort()
  for (const key of blockingKeys) {
    const result = blockingResults[key]
    allValidacoes[key] = result.validacao
  }

  // Extract warning validations
  const warningKeys = Object.keys(warningResults).sort()
  for (const key of warningKeys) {
    const result = warningResults[key]
    allValidacoes[key] = result.validacao
  }

  return Object.freeze(allValidacoes)
}

/**
 * Pipeline Stage: Deterministic Score Calculation
 *
 * Multiplicative penalty model (same as FV/BESS).
 * Blocking failures: 20% penalty each.
 * Warning failures: 0% penalty (informational only).
 * Result: fully deterministic, replayable score.
 */
function calculateEVScore(blockingResults, warningResults) {
  let score = 1.0

  // Apply blocking penalties only
  const blockingKeys = Object.keys(blockingResults)
  for (const key of blockingKeys) {
    const result = blockingResults[key]
    if (!result.validacao) {
      score *= 0.2 // 20% penalty per blocking violation
    }
  }

  // Warnings do NOT affect score (informational only)

  // Clamp to [0, 1]
  score = Math.max(0, Math.min(score, 1))

  return score
}

/**
 * Main Pipeline: Deterministic Charging Approval
 *
 * Input Contract:
 * - energyContext: immutable, read-only
 * - mobilityData: immutable, read-only
 *
 * Output Contract:
 * - Frozen immutable result
 * - Deterministic for identical inputs
 * - Serialization-stable
 *
 * Pipeline Stages:
 * 1. Validate inputs are immutable
 * 2. Execute blocking invariants
 * 3. Execute warning invariants
 * 4. Aggregate validations
 * 5. Calculate score
 * 6. Determine approval
 * 7. Freeze output
 */
export function executeChargingApprovalPipeline(energyContext, mobilityData) {
  // Stage 1: Validate inputs are frozen (immutable)
  // Note: In strict governance, inputs MUST be frozen before entering pipeline
  if (!Object.isFrozen(energyContext)) {
    throw new Error('energyContext must be immutable (frozen) before pipeline execution')
  }
  if (!Object.isFrozen(mobilityData)) {
    throw new Error('mobilityData must be immutable (frozen) before pipeline execution')
  }

  // Stage 2: Execute blocking invariants
  const blockingResults = executeBlockingInvariants(energyContext, mobilityData)

  // Stage 3: Execute warning invariants
  const warningResults = executeWarningInvariants(energyContext, mobilityData)

  // Stage 4: Aggregate validations
  const validacoes = aggregateValidationResults(blockingResults, warningResults)

  // Stage 5: Calculate EV score
  const ev_score = calculateEVScore(blockingResults, warningResults)

  // Stage 6: Determine approval (all blocking validations must pass)
  const blockers = ['transformador', 'ramal', 'simultaneidade', 'corrente', 'limite_rede', 'fallback_seguranca', 'anti_islanding']
  const aprovado = blockers.every(key => validacoes[key] === true)

  // Stage 7: Build detailed alerts (blocking + warning)
  const alertas = []

  // Collect blocking alerts
  for (const key of Object.keys(blockingResults).sort()) {
    const result = blockingResults[key]
    if (!result.validacao && result.mensagem) {
      alertas.push({
        nivel: result.nivel,
        code: result.code,
        mensagem: result.mensagem
      })
    }
  }

  // Collect warning alerts
  for (const key of Object.keys(warningResults).sort()) {
    const result = warningResults[key]
    if (!result.validacao && result.mensagem) {
      alertas.push({
        nivel: result.nivel,
        code: result.code,
        mensagem: result.mensagem
      })
    }
  }

  // Stage 8: Freeze final output
  const result = {
    ev_score,
    score_eletrico: ev_score, // Alias for consistency with FV/BESS
    validacoes: Object.freeze(validacoes),
    alertas: Object.freeze(alertas),
    aprovado,
    status: aprovado ? 'OTIMIZADO' : 'REJEITADO'
  }

  return Object.freeze(result)
}
