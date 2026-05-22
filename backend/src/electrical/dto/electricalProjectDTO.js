// backend/src/electrical/dto/electricalProjectDTO.js

import { deepFreezeSafe }                                       from '../../utils/freeze.js'
import { StructuredEngineError, ErrorSeverity, ErrorCategory }  from '../../utils/errors.js'
import { ELECTRICAL_LIMITS }                                    from '../constants/limits.js'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Valida e normaliza o payload bruto de um projeto elétrico fotovoltaico.
 *
 * Retorna um objeto imutável com:
 *   { valido: true, data: { ...cleanData }, ...cleanData }
 *
 * O espalhamento de cleanData no topo mantém compatibilidade com consumidores
 * existentes que acessam dto.concessionaria, dto.geracao, etc. diretamente.
 * Novos consumidores devem usar dto.data.* como caminho canônico.
 *
 * @param {object} payload   Dados brutos do projeto
 * @param {object} context   Metadados de rastreabilidade (deterministicSeed, traceId, etc.)
 * @returns {Readonly<object>}
 * @throws {StructuredEngineError}
 */
export function validateElectricalProjectDTO(payload, context = {}) {

  // ── 1. Integridade do payload ──────────────────────────────────────────────

  if (payload === null || typeof payload !== 'object') {
    throw new StructuredEngineError({
      code:     'FALHA_DTO_PAYLOAD_INVALIDO',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.DTO_VALIDATION,
      message:  'Payload ausente ou de tipo invalido para inicializacao do DTO eletrico.',
      context:  { ...context }
    })
  }

  // ── 2. Blocos estruturais obrigatórios ────────────────────────────────────

  if (!payload.engenharia || typeof payload.engenharia !== 'object') {
    throw new StructuredEngineError({
      code:     'FALHA_DTO_BLOCO_ENGENHARIA_AUSENTE',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.DTO_VALIDATION,
      message:  'Bloco "engenharia" ausente ou de tipo invalido no payload.',
      context:  { ...context }
    })
  }

  if (!payload.geracao || typeof payload.geracao !== 'object') {
    throw new StructuredEngineError({
      code:     'FALHA_DTO_BLOCO_GERACAO_AUSENTE',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.DTO_VALIDATION,
      message:  'Bloco "geracao" ausente ou de tipo invalido no payload.',
      context:  { ...context }
    })
  }

  // ── 3. Concessionária regional ────────────────────────────────────────────

  const concessionaria = typeof payload.concessionaria === 'string'
    ? payload.concessionaria.trim().toLowerCase()
    : ''

  if (!ELECTRICAL_LIMITS.ALLOWED_CONCESSIONARIAS.includes(concessionaria)) {
    throw new StructuredEngineError({
      code:     'FALHA_DTO_CONCESSIONARIA_INVALIDA',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.DTO_VALIDATION,
      message:  `Concessionaria invalida ou nao suportada: "${payload.concessionaria}". ` +
                `Permitidas: ${ELECTRICAL_LIMITS.ALLOWED_CONCESSIONARIAS.join(', ')}.`,
      context:  { ...context, concessionaria }
    })
  }

  // ── Campos gerais ─────────────────────────────────────────────────────────

  const grupo_tarifario = typeof payload.grupo_tarifario === 'string'
    ? payload.grupo_tarifario.toUpperCase().trim()
    : null

  const tensao_atendimento = Number.isFinite(payload.tensao_atendimento)
    ? payload.tensao_atendimento
    : null

  // ── Unidade Consumidora ───────────────────────────────────────────────────

  const rawUc = (payload.uc && typeof payload.uc === 'object') ? payload.uc : {}
  const uc = {
    titular: typeof rawUc.titular === 'string' ? rawUc.titular.trim()          : null,
    codigo:  typeof rawUc.codigo  === 'string' ? rawUc.codigo.trim()           : null,
    cidade:  typeof rawUc.cidade  === 'string' ? rawUc.cidade.trim()           : null,
    uf:      typeof rawUc.uf      === 'string' ? rawUc.uf.trim().toUpperCase() : null
  }

  // ── 4. Trava de ordem térmica ─────────────────────────────────────────────

  const rawEngenharia = payload.engenharia

  const temperatura_minima_projeto = Number.isFinite(rawEngenharia.temperatura_minima_projeto)
    ? rawEngenharia.temperatura_minima_projeto
    : 10

  const temperatura_maxima_projeto = Number.isFinite(rawEngenharia.temperatura_maxima_projeto)
    ? rawEngenharia.temperatura_maxima_projeto
    : 40

  if (temperatura_minima_projeto >= temperatura_maxima_projeto) {
    throw new StructuredEngineError({
      code:     'FALHA_DTO_ORDEM_TERMICA_INVALIDA',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.DTO_VALIDATION,
      message:  `temperatura_minima_projeto (${temperatura_minima_projeto} C) deve ser ` +
                `estritamente menor que temperatura_maxima_projeto (${temperatura_maxima_projeto} C).`,
      context:  { ...context, temperatura_minima_projeto, temperatura_maxima_projeto }
    })
  }

  const engenharia = {
    temperatura_minima_projeto,
    temperatura_maxima_projeto,
    voc_max_corrigido: Number.isFinite(rawEngenharia.voc_max_corrigido) ? rawEngenharia.voc_max_corrigido : null,
    isc_max_corrigido: Number.isFinite(rawEngenharia.isc_max_corrigido) ? rawEngenharia.isc_max_corrigido : null,
    fator_temperatura: Number.isFinite(rawEngenharia.fator_temperatura) ? rawEngenharia.fator_temperatura : null
  }

  // ── 5. Sanidade de hardware — Inversores ──────────────────────────────────

  const rawGeracao = payload.geracao

  if (!Array.isArray(rawGeracao.inversores) || rawGeracao.inversores.length === 0) {
    throw new StructuredEngineError({
      code:     'FALHA_DTO_INVERSORES_AUSENTES',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.DTO_VALIDATION,
      message:  'Array "inversores" ausente ou vazio no bloco geracao.',
      context:  { ...context }
    })
  }

  const inversores = rawGeracao.inversores.map((inv, idx) => {

    if (!inv || typeof inv !== 'object') {
      throw new StructuredEngineError({
        code:     'FALHA_DTO_INVERSOR_INVALIDO',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.DTO_VALIDATION,
        message:  `Inversor [${idx}]: entrada nula ou de tipo invalido.`,
        context:  { ...context, inversor_index: idx }
      })
    }

    const requiredFinite = ['potencia_nominal_kw', 'v_max_dc', 'v_mppt_min', 'v_mppt_max', 'i_max_mppt']
    for (const field of requiredFinite) {
      if (!Number.isFinite(inv[field])) {
        throw new StructuredEngineError({
          code:     'FALHA_DTO_INVERSOR_CAMPO_INVALIDO',
          severity: ErrorSeverity.CRITICAL,
          category: ErrorCategory.DTO_VALIDATION,
          message:  `Inversor [${idx}]: campo "${field}" ausente ou nao finito.`,
          context:  { ...context, inversor_index: idx, field }
        })
      }
    }

    if (!inv.modelo || String(inv.modelo).trim() === '') {
      throw new StructuredEngineError({
        code:     'FALHA_DTO_INVERSOR_MODELO_AUSENTE',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.DTO_VALIDATION,
        message:  `Inversor [${idx}]: campo "modelo" ausente ou vazio.`,
        context:  { ...context, inversor_index: idx }
      })
    }

    if (inv.v_mppt_min <= 0) {
      throw new StructuredEngineError({
        code:     'FALHA_DTO_INVERSOR_MPPT_MIN_INVALIDO',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.DTO_VALIDATION,
        message:  `Inversor [${idx}]: v_mppt_min (${inv.v_mppt_min}) deve ser estritamente positivo.`,
        context:  { ...context, inversor_index: idx, v_mppt_min: inv.v_mppt_min }
      })
    }

    if (inv.v_mppt_min >= inv.v_mppt_max) {
      throw new StructuredEngineError({
        code:     'FALHA_DTO_INVERSOR_JANELA_MPPT_INVALIDA',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.DTO_VALIDATION,
        message:  `Inversor [${idx}]: v_mppt_min (${inv.v_mppt_min}V) deve ser estritamente ` +
                  `menor que v_mppt_max (${inv.v_mppt_max}V).`,
        context:  { ...context, inversor_index: idx, v_mppt_min: inv.v_mppt_min, v_mppt_max: inv.v_mppt_max }
      })
    }

    if (inv.i_max_mppt <= 0 || inv.i_max_mppt > ELECTRICAL_LIMITS.CURRENT_MAX_SAFE_DC) {
      throw new StructuredEngineError({
        code:     'FALHA_DTO_INVERSOR_CORRENTE_MPPT_FORA_LIMITES',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.DTO_VALIDATION,
        message:  `Inversor [${idx}]: i_max_mppt (${inv.i_max_mppt}A) deve estar no intervalo ` +
                  `(0, ${ELECTRICAL_LIMITS.CURRENT_MAX_SAFE_DC}].`,
        context:  { ...context, inversor_index: idx, i_max_mppt: inv.i_max_mppt }
      })
    }

    if (inv.v_max_dc > ELECTRICAL_LIMITS.VOLTAGE_MAX_SAFE_DC) {
      throw new StructuredEngineError({
        code:     'FALHA_DTO_INVERSOR_TENSAO_MAX_EXCEDE_LIMITE_FISICO',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.ELECTRICAL_PHYSICS,
        message:  `Inversor [${idx}]: v_max_dc (${inv.v_max_dc}V) excede o limite fisico de ` +
                  `isolacao de ${ELECTRICAL_LIMITS.VOLTAGE_MAX_SAFE_DC}V.`,
        context:  { ...context, inversor_index: idx, v_max_dc: inv.v_max_dc }
      })
    }

    const mppts_disponiveis = Number.isFinite(inv.mppts_disponiveis) && inv.mppts_disponiveis >= 1
      ? Math.floor(inv.mppts_disponiveis)
      : 1

    return {
      modelo:              String(inv.modelo).trim(),
      potencia_nominal_kw: Number(inv.potencia_nominal_kw),
      v_max_dc:            Number(inv.v_max_dc),
      v_mppt_min:          Number(inv.v_mppt_min),
      v_mppt_max:          Number(inv.v_mppt_max),
      i_max_mppt:          Number(inv.i_max_mppt),
      mppts_disponiveis
    }
  })

  // ── 5. Sanidade de hardware — Módulos ─────────────────────────────────────

  if (!Array.isArray(rawGeracao.modulos) || rawGeracao.modulos.length === 0) {
    throw new StructuredEngineError({
      code:     'FALHA_DTO_MODULOS_AUSENTES',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.DTO_VALIDATION,
      message:  'Array "modulos" ausente ou vazio no bloco geracao.',
      context:  { ...context }
    })
  }

  const modulos = rawGeracao.modulos.map((mod, idx) => {

    if (!mod || typeof mod !== 'object') {
      throw new StructuredEngineError({
        code:     'FALHA_DTO_MODULO_INVALIDO',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.DTO_VALIDATION,
        message:  `Modulo [${idx}]: entrada nula ou de tipo invalido.`,
        context:  { ...context, modulo_index: idx }
      })
    }

    const requiredFinite = ['p_max', 'v_oc', 'i_sc', 'v_mpp', 'coef_temp_voc']
    for (const field of requiredFinite) {
      if (!Number.isFinite(mod[field])) {
        throw new StructuredEngineError({
          code:     'FALHA_DTO_MODULO_CAMPO_INVALIDO',
          severity: ErrorSeverity.CRITICAL,
          category: ErrorCategory.DTO_VALIDATION,
          message:  `Modulo [${idx}]: campo "${field}" ausente ou nao finito.`,
          context:  { ...context, modulo_index: idx, field }
        })
      }
    }

    if (!mod.modelo || String(mod.modelo).trim() === '') {
      throw new StructuredEngineError({
        code:     'FALHA_DTO_MODULO_MODELO_AUSENTE',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.DTO_VALIDATION,
        message:  `Modulo [${idx}]: campo "modelo" ausente ou vazio.`,
        context:  { ...context, modulo_index: idx }
      })
    }

    if (Math.abs(mod.coef_temp_voc) >= 0.1) {
      throw new StructuredEngineError({
        code:     'FALHA_DTO_MODULO_COEF_TEMP_VOC_PERCENTUAL',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.DTO_VALIDATION,
        message:  `Modulo [${idx}]: coef_temp_voc (${mod.coef_temp_voc}) parece estar em formato ` +
                  `percentual. Informe em fracao decimal por C (|valor| < 0.1, ex: -0.0025).`,
        context:  { ...context, modulo_index: idx, coef_temp_voc: mod.coef_temp_voc }
      })
    }

    const rawCoefPmax = mod.coef_temp_pmax
    const hasCoefPmax = Number.isFinite(rawCoefPmax) && rawCoefPmax !== 0

    if (hasCoefPmax && Math.abs(rawCoefPmax) >= 0.1) {
      throw new StructuredEngineError({
        code:     'FALHA_DTO_MODULO_COEF_TEMP_PMAX_PERCENTUAL',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.DTO_VALIDATION,
        message:  `Modulo [${idx}]: coef_temp_pmax (${rawCoefPmax}) parece estar em formato ` +
                  `percentual. Informe em fracao decimal por C (|valor| < 0.1, ex: -0.0030).`,
        context:  { ...context, modulo_index: idx, coef_temp_pmax: rawCoefPmax }
      })
    }

    return {
      modelo:         String(mod.modelo).trim(),
      p_max:          Number(mod.p_max),
      v_oc:           Number(mod.v_oc),
      i_sc:           Number(mod.i_sc),
      v_mpp:          Number(mod.v_mpp),
      coef_temp_voc:  Number(mod.coef_temp_voc),
      coef_temp_pmax: hasCoefPmax ? Number(rawCoefPmax) : -0.0035
    }
  })

  // ── 6. Topologia multi-módulo e integridade referencial das strings ────────

  const rawStrings = Array.isArray(rawGeracao.strings) ? rawGeracao.strings : []

  const strings = rawStrings.map((st, idx) => {

    if (!st || typeof st !== 'object') {
      throw new StructuredEngineError({
        code:     'FALHA_DTO_STRING_INVALIDA',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.DTO_VALIDATION,
        message:  `String [${idx}]: entrada nula ou de tipo invalido.`,
        context:  { ...context, string_index: idx }
      })
    }

    if (!Number.isFinite(st.quantidade_modulos) ||
        !Number.isFinite(st.inversor_index)      ||
        !Number.isFinite(st.mppt_index)) {
      throw new StructuredEngineError({
        code:     'FALHA_DTO_STRING_CAMPOS_INDEXACAO_INVALIDOS',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.DTO_VALIDATION,
        message:  `String [${idx}]: quantidade_modulos, inversor_index e mppt_index sao obrigatorios e devem ser numericos.`,
        context:  { ...context, string_index: idx }
      })
    }

    const invIndex  = Math.floor(st.inversor_index)
    const mpptIndex = Math.floor(st.mppt_index)

    // modulo_index: opcional com default 0 para compatibilidade com fixtures legados
    const modIdx = Number.isFinite(st.modulo_index)
      ? Math.floor(st.modulo_index)
      : 0

    const qtdModulos  = st.quantidade_modulos
    const qtdParalelo = Number.isFinite(st.quantidade_strings_paralelo)
      ? st.quantidade_strings_paralelo
      : 1

    if (!Number.isInteger(qtdModulos) || qtdModulos < 1) {
      throw new StructuredEngineError({
        code:     'FALHA_DTO_STRING_QUANTIDADE_MODULOS_INVALIDA',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.DTO_VALIDATION,
        message:  `String [${idx}]: quantidade_modulos (${qtdModulos}) deve ser inteiro >= 1.`,
        context:  { ...context, string_index: idx, quantidade_modulos: qtdModulos }
      })
    }

    if (!Number.isInteger(qtdParalelo) || qtdParalelo < 1) {
      throw new StructuredEngineError({
        code:     'FALHA_DTO_STRING_QUANTIDADE_PARALELO_INVALIDA',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.DTO_VALIDATION,
        message:  `String [${idx}]: quantidade_strings_paralelo (${qtdParalelo}) deve ser inteiro >= 1.`,
        context:  { ...context, string_index: idx, quantidade_strings_paralelo: qtdParalelo }
      })
    }

    if (invIndex < 0 || invIndex >= inversores.length) {
      throw new StructuredEngineError({
        code:     'FALHA_DTO_INTEGRIDADE_REFERENCIAL_INVERSOR',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.DTO_VALIDATION,
        message:  `String [${idx}]: inversor_index (${invIndex}) fora dos limites ` +
                  `validos [0, ${inversores.length - 1}].`,
        context:  { ...context, string_index: idx, inversor_index: invIndex }
      })
    }

    if (modIdx < 0 || modIdx >= modulos.length) {
      throw new StructuredEngineError({
        code:     'FALHA_DTO_INTEGRIDADE_REFERENCIAL_MODULO',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.DTO_VALIDATION,
        message:  `String [${idx}]: modulo_index (${modIdx}) fora dos limites ` +
                  `validos [0, ${modulos.length - 1}].`,
        context:  { ...context, string_index: idx, modulo_index: modIdx }
      })
    }

    const inversorAlvo = inversores[invIndex]
    if (mpptIndex < 0 || mpptIndex >= inversorAlvo.mppts_disponiveis) {
      throw new StructuredEngineError({
        code:     'FALHA_DTO_INTEGRIDADE_FISICA_MPPT',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.ELECTRICAL_PHYSICS,
        message:  `String [${idx}]: mppt_index (${mpptIndex}) excede os canais MPPT ` +
                  `disponiveis (${inversorAlvo.mppts_disponiveis}) do inversor [${invIndex}].`,
        context:  { ...context, string_index: idx, mppt_index: mpptIndex, inversor_index: invIndex }
      })
    }

    return {
      quantidade_modulos:          qtdModulos,
      quantidade_strings_paralelo: qtdParalelo,
      inversor_index:              invIndex,
      modulo_index:                modIdx,
      mppt_index:                  mpptIndex
    }
  })

  // ── Potência instalada ────────────────────────────────────────────────────

  const potencia_kwp = Number.isFinite(rawGeracao.potencia_kwp) ? rawGeracao.potencia_kwp : null

  if (potencia_kwp !== null && potencia_kwp <= 0) {
    throw new StructuredEngineError({
      code:     'FALHA_DTO_POTENCIA_KWP_INVALIDA',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.DTO_VALIDATION,
      message:  `potencia_kwp (${potencia_kwp}) deve ser estritamente positivo.`,
      context:  { ...context, potencia_kwp }
    })
  }

  // ── Auditoria ─────────────────────────────────────────────────────────────

  const rawAuditoria = (payload.auditoria && typeof payload.auditoria === 'object') ? payload.auditoria : {}
  const auditoria = {
    origem_dados: Array.isArray(rawAuditoria.origem_dados)
      ? rawAuditoria.origem_dados.map(String)
      : ['ocr_pipeline'],
    score_global: Number.isFinite(rawAuditoria.score_global) ? rawAuditoria.score_global : null,
    timestamp:    typeof rawAuditoria.timestamp === 'string'
      ? rawAuditoria.timestamp
      : new Date().toISOString()
  }

  // ── Montagem do DTO limpo ─────────────────────────────────────────────────

  const cleanData = {
    concessionaria,
    grupo_tarifario,
    tensao_atendimento,
    uc,
    geracao: { potencia_kwp, inversores, modulos, strings },
    engenharia,
    auditoria
  }

  // valido + data (caminho canônico) + spread (compatibilidade com consumidores legados)
  return deepFreezeSafe({
    valido: true,
    data:   cleanData,
    ...cleanData
  })
}

// ─── Alias de compatibilidade reversa ─────────────────────────────────────────
// Consumidores existentes que chamam createElectricalProjectDTO continuam funcionando.
export { validateElectricalProjectDTO as createElectricalProjectDTO }
