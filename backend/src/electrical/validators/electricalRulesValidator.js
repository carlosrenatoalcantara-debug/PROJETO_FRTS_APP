// backend/src/electrical/validators/electricalRulesValidator.js

import { deepFreezeSafe } from '../../utils/freeze.js'
import {
  StructuredEngineError,
  ErrorSeverity,
  ErrorCategory
} from '../../utils/errors.js'
import { calculateStringSizing } from '../calculators/stringSizingCalculator.js'
import { calculateBessSizing } from '../calculators/bessSizingCalculator.js'
import { validateBessProjectDTO } from '../dto/bessProjectDTO.js'

export function validateElectricalRules(projectData, context = {}) {
  const safeContext = {
    ...context,
    parentTraceId: context.traceId ?? null,
    timestamp: context.timestamp ?? new Date().toISOString(),
    engineModule: 'ELECTRICAL_VALIDATOR'
  }

  if (!projectData || typeof projectData !== 'object' || Array.isArray(projectData)) {
    throw new StructuredEngineError({
      code:     'ERR_ESTRUTURA_PROJETO_INVALIDA',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.ELECTRICAL_PHYSICS,
      message:  'PAYLOAD DE PROJETO ELETRICO INVALIDO',
      context:  safeContext
    })
  }

  if (!projectData.engenharia || typeof projectData.engenharia !== 'object' || Array.isArray(projectData.engenharia)) {
    throw new StructuredEngineError({
      code:     'ERR_ENGENHARIA_INVALIDA',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.ELECTRICAL_PHYSICS,
      message:  'BLOCO DE ENGENHARIA INVALIDO OU AUSENTE',
      context:  safeContext
    })
  }

  if (
    !projectData.geracao ||
    !Array.isArray(projectData.geracao.strings) ||
    !Array.isArray(projectData.geracao.inversores) ||
    !Array.isArray(projectData.geracao.modulos)
  ) {
    throw new StructuredEngineError({
      code:     'ERR_ESTRUTURA_GERACAO_INVALIDA',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.ELECTRICAL_PHYSICS,
      message:  'ESTRUTURA DE GERACAO OU DTO DE EQUIPAMENTOS INVALIDA NO PROJETO',
      context:  safeContext
    })
  }

  // Check if BESS-only project (no FV strings but has BESS data)
  const hasBessData = projectData.armazenamento && typeof projectData.armazenamento === 'object' && !Array.isArray(projectData.armazenamento);
  const hasFvStrings = projectData.geracao.strings.length > 0;

  if (!hasFvStrings && !hasBessData) {
    return deepFreezeSafe({
      aprovado:       false,
      score_eletrico: 0,
      falhas:         ['ERR_PROJETO_SEM_STRINGS'],
      alertas:        [],
      validacoes:     { voc: false, corrente: false, mppt: false, balanceamento: false }
    })
  }

  // BESS-only validation path (skip FV validation if no strings)
  if (!hasFvStrings && hasBessData) {
    try {
      const bessValidated = validateBessProjectDTO(projectData.armazenamento)
      const bessResults = calculateBessSizing(bessValidated.data, projectData.engenharia)

      return deepFreezeSafe({
        aprovado: bessResults.aprovado,
        score_eletrico: bessResults.score_eletrico,
        falhas: bessResults.alertas.filter(a => a.nivel === 'CRITICO').map(a => a.code).sort(),
        alertas: bessResults.alertas.filter(a => a.nivel === 'ADVERTENCIA').map(a => a.code).sort(),
        validacoes: bessResults.validacoes,
        bess_score: {
          aprovado: bessResults.aprovado,
          score: bessResults.score_eletrico,
          validacoes: bessResults.validacoes,
          alertas: bessResults.alertas
        }
      })
    } catch (err) {
      return deepFreezeSafe({
        aprovado: false,
        score_eletrico: 0,
        falhas: ['ERR_BESS_VALIDATION_ERROR'],
        alertas: [],
        validacoes: { tensao: false, profundidade_descarga: false, autonomia: false, corrente: false }
      })
    }
  }

  const falhasTracking   = new Set()
  const alertasTracking  = new Set()
  const validacoes       = { voc: true, corrente: true, mppt: true, balanceamento: true }
  const mpptDistribution = Object.create(null)

  for (let i = 0; i < projectData.geracao.strings.length; i++) {
    const stringData = projectData.geracao.strings[i]

    if (!stringData || typeof stringData !== 'object' || Array.isArray(stringData)) {
      throw new StructuredEngineError({
        code:     'ERR_ESTRUTURA_STRING_INVALIDA',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.ELECTRICAL_PHYSICS,
        message:  `DADOS DA STRING INVALIDOS NA POSICAO: ${i}`,
        context:  { ...safeContext, index: i }
      })
    }

    const invIdx  = stringData.inversor_index ?? 0
    const modIdx  = stringData.modulo_index   ?? 0
    const mpptIdx = stringData.mppt_index     ?? 0

    const inversor = projectData.geracao.inversores[invIdx]
    const modulo   = projectData.geracao.modulos[modIdx]

    if (!inversor || !modulo) {
      throw new StructuredEngineError({
        code:     'ERR_REFERENCIA_EQUIPAMENTO',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.ELECTRICAL_PHYSICS,
        message:  'INVERSOR OU MODULO REFERENCIADO NA STRING NAO ENCONTRADO',
        context:  { ...safeContext, invIdx, modIdx }
      })
    }

    const mpptKey = `${invIdx}_${mpptIdx}`
    if (!mpptDistribution[mpptKey]) mpptDistribution[mpptKey] = []

    const vOc  = (Number.isFinite(modulo.v_oc)  ? modulo.v_oc  : 0).toFixed(6)
    const iSc  = (Number.isFinite(modulo.i_sc)  ? modulo.i_sc  : 0).toFixed(6)
    const vMpp = (Number.isFinite(modulo.v_mpp) ? modulo.v_mpp : 0).toFixed(6)

    mpptDistribution[mpptKey].push({
      fingerprint:        `${modulo.modelo || 'GENERICO'}|${vOc}|${iSc}|${vMpp}`,
      quantidade_modulos: stringData.quantidade_modulos
    })

    const results = calculateStringSizing(stringData, inversor, modulo, projectData.engenharia)

    if (!results || typeof results !== 'object' || Array.isArray(results)) {
      throw new StructuredEngineError({
        code:     'ERR_RESULTADO_SIZING_INVALIDO',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.ELECTRICAL_PHYSICS,
        message:  'RESULTADO DO CALCULO ELETRICO INVALIDO',
        context:  { ...safeContext, index: i }
      })
    }

    if (results.tensao_maxima_ok   === false) validacoes.voc      = false
    if (results.limite_corrente_ok === false) validacoes.corrente  = false
    if (results.limite_mppt_ok     === false) validacoes.mppt      = false

    if (Array.isArray(results.alertas)) {
      for (const alert of results.alertas) {
        if (!alert || typeof alert !== 'object' || Array.isArray(alert)) {
          alertasTracking.add('WARN_ALERTA_MALFORMADO_TIPO')
          continue
        }
        if (typeof alert.mensagem !== 'string') {
          alertasTracking.add('WARN_ALERTA_MALFORMADO_MENSAGEM')
          continue
        }
        if (alert.nivel !== 'CRITICO' && alert.nivel !== 'ADVERTENCIA') {
          alertasTracking.add('WARN_ALERTA_MALFORMADO_NIVEL')
          continue
        }
        if (typeof alert.code !== 'string' || alert.code.trim().length === 0) {
          alertasTracking.add('WARN_ALERTA_MALFORMADO_CODE')
          continue
        }

        if (alert.nivel === 'CRITICO') {
          falhasTracking.add(alert.code)
        } else {
          alertasTracking.add(alert.code)
        }
      }
    }
  }

  for (const key of Object.keys(mpptDistribution)) {
    const group = mpptDistribution[key]
    if (!Array.isArray(group) || group.length === 0) continue

    const ref = group[0]
    if (group.some(s => s.fingerprint !== ref.fingerprint || s.quantidade_modulos !== ref.quantidade_modulos)) {
      validacoes.balanceamento = false
      alertasTracking.add('WARN_FISICA_DESBALANCEAMENTO_MPPT')
    }
  }

  let score_eletrico = 1.0
  if (!validacoes.voc)          score_eletrico *= 0.10
  if (!validacoes.corrente)     score_eletrico *= 0.40
  if (!validacoes.mppt)         score_eletrico *= 0.90
  if (!validacoes.balanceamento) score_eletrico *= 0.70

  score_eletrico = Number.isFinite(score_eletrico)
    ? Math.max(0, Math.min(score_eletrico, 1))
    : 0

  const aprovado = validacoes.voc && validacoes.corrente

  // Optional BESS validation (only if BESS data provided, alongside FV validation)
  let bessScore = null
  if (projectData.armazenamento && typeof projectData.armazenamento === 'object' && !Array.isArray(projectData.armazenamento)) {
    try {
      const bessValidated = validateBessProjectDTO(projectData.armazenamento)
      const bessResults = calculateBessSizing(bessValidated.data, projectData.engenharia)

      bessScore = {
        score: bessResults.score_eletrico,
        aprovado: bessResults.aprovado,
        validacoes: bessResults.validacoes,
        alertas: bessResults.alertas
      }

      if (Array.isArray(bessResults.alertas)) {
        for (const alert of bessResults.alertas) {
          if (alert.nivel === 'CRITICO') {
            falhasTracking.add(alert.code)
          } else {
            alertasTracking.add(alert.code)
          }
        }
      }
    } catch (err) {
      alertasTracking.add('WARN_BESS_VALIDATION_SKIPPED')
    }
  }

  const result = {
    aprovado,
    score_eletrico,
    falhas:     Array.from(falhasTracking).sort(),
    alertas:    Array.from(alertasTracking).sort(),
    validacoes
  }

  // Only include bess_score if BESS was validated (backward compatibility)
  if (bessScore !== null) {
    result.bess_score = bessScore
  }

  return deepFreezeSafe(result)
}
