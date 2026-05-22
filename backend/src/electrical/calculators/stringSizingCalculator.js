// backend/src/electrical/calculators/stringSizingCalculator.js

import { ELECTRICAL_LIMITS }                     from '../constants/limits.js'
import { deepFreezeSafe }                        from '../../utils/freeze.js'
import { StructuredEngineError, SEVERITY, CATEGORY } from '../../utils/errors.js'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calcula o dimensionamento termoelétrico de uma string fotovoltaica.
 *
 * Retorna um objeto imutável com flags de compatibilidade legada preservados:
 *   tensao_maxima_ok, limite_mppt_ok, limite_corrente_ok, strings_validas
 * E os novos campos canônicos:
 *   vmpp_operacao_min, vmpp_operacao_max, voc_corrigido_frio, alertas (objetos estruturados)
 *
 * @param {object} stringData  { quantidade_modulos, quantidade_strings_paralelo }
 * @param {object} inversor    Objeto de inversor do DTO (normalizado)
 * @param {object} modulo      Objeto de módulo do DTO (normalizado)
 * @param {object} engenharia  { temperatura_minima_projeto, temperatura_maxima_projeto }
 * @returns {Readonly<object>}
 * @throws {StructuredEngineError}
 */
export function calculateStringSizing(stringData, inversor, modulo, engenharia) {

  // ── Validação de entrada ──────────────────────────────────────────────────

  if (!stringData || typeof stringData !== 'object') {
    throw new StructuredEngineError(
      'FALHA_INVARIANTE_ELETRICA',
      'stringData ausente ou invalido.',
      { severity: SEVERITY.CRITICAL, category: CATEGORY.ELECTRICAL_PHYSICS }
    )
  }
  if (!inversor || typeof inversor !== 'object') {
    throw new StructuredEngineError(
      'FALHA_INVARIANTE_ELETRICA',
      'inversor ausente ou invalido.',
      { severity: SEVERITY.CRITICAL, category: CATEGORY.ELECTRICAL_PHYSICS }
    )
  }
  if (!modulo || typeof modulo !== 'object') {
    throw new StructuredEngineError(
      'FALHA_INVARIANTE_ELETRICA',
      'modulo ausente ou invalido.',
      { severity: SEVERITY.CRITICAL, category: CATEGORY.ELECTRICAL_PHYSICS }
    )
  }
  if (!engenharia || typeof engenharia !== 'object') {
    throw new StructuredEngineError(
      'FALHA_INVARIANTE_ELETRICA',
      'engenharia ausente ou invalido.',
      { severity: SEVERITY.CRITICAL, category: CATEGORY.ELECTRICAL_PHYSICS }
    )
  }

  const { quantidade_modulos, quantidade_strings_paralelo = 1 } = stringData
  const { temperatura_minima_projeto, temperatura_maxima_projeto } = engenharia

  if (!Number.isFinite(temperatura_minima_projeto) || !Number.isFinite(temperatura_maxima_projeto)) {
    throw new StructuredEngineError(
      'FALHA_INVARIANTE_ELETRICA',
      'Temperaturas de projeto ausentes ou nao finitas em engenharia.',
      { severity: SEVERITY.CRITICAL, category: CATEGORY.ELECTRICAL_PHYSICS }
    )
  }

  if (!Number.isFinite(quantidade_modulos) || quantidade_modulos <= 0) {
    throw new StructuredEngineError(
      'FALHA_INVARIANTE_ELETRICA',
      `quantidade_modulos (${quantidade_modulos}) deve ser um numero positivo finito.`,
      { severity: SEVERITY.CRITICAL, category: CATEGORY.ELECTRICAL_PHYSICS }
    )
  }

  if (!Number.isFinite(quantidade_strings_paralelo) || quantidade_strings_paralelo <= 0) {
    throw new StructuredEngineError(
      'FALHA_INVARIANTE_ELETRICA',
      `quantidade_strings_paralelo (${quantidade_strings_paralelo}) deve ser um numero positivo finito.`,
      { severity: SEVERITY.CRITICAL, category: CATEGORY.ELECTRICAL_PHYSICS }
    )
  }

  const alertas = []

  // ── Deltas térmicos a partir de STC ──────────────────────────────────────

  const deltaTFrio   = temperatura_minima_projeto - ELECTRICAL_LIMITS.TEMPERATURE_STC
  const deltaTQuente = temperatura_maxima_projeto  - ELECTRICAL_LIMITS.TEMPERATURE_STC

  // ── 1. Voc no pior cenário de frio (tensão máxima absoluta em circuito aberto) ──

  const vocModuloFrio    = modulo.v_oc * (1 + modulo.coef_temp_voc * deltaTFrio)
  const vocCorrigidoFrio = vocModuloFrio * quantidade_modulos

  // ── 2. Coalescência do coeficiente térmico de Vmpp ────────────────────────
  //
  // Avaliação explícita de tipo: evita o operador || que substitui
  // o valor zero (simulação teórica legítima) pelo fallback.

  const coefTempVmpp = Number.isFinite(modulo.coef_temp_pmax) && modulo.coef_temp_pmax !== 0
    ? modulo.coef_temp_pmax
    : -0.0035

  // ── 3. Janela de Vmpp operacional nos extremos térmicos ───────────────────
  //
  // Ambos os extremos usam coefTempVmpp — coeficiente consistente para Vmpp.
  // Jamais usar coef_temp_voc aqui (coeficiente de Voc, não de Vmpp).

  const vmppModuloMin = modulo.v_mpp * (1 + coefTempVmpp * deltaTQuente)  // quente → Vmpp mínima
  const vmppModuloMax = modulo.v_mpp * (1 + coefTempVmpp * deltaTFrio)    // frio   → Vmpp máxima

  const vmppTotalMin = vmppModuloMin * quantidade_modulos
  const vmppTotalMax = vmppModuloMax * quantidade_modulos

  // ── 4. Corrente normativa (âncora em constante regulamentada) ─────────────

  const correnteTotalMppt =
    modulo.i_sc * ELECTRICAL_LIMITS.SAFETY_FACTOR_ISC * quantidade_strings_paralelo

  // ── 5. Guard pós-cálculo: NaN / Infinity ──────────────────────────────────

  if (!Number.isFinite(vocCorrigidoFrio) ||
      !Number.isFinite(vmppTotalMin)     ||
      !Number.isFinite(vmppTotalMax)     ||
      !Number.isFinite(correnteTotalMppt)) {
    throw new StructuredEngineError(
      'FALHA_COMPUTACIONAL_ELETRICA',
      'Operacao aritmetica resultou em indeterminacao matematica (NaN ou Infinity).',
      { severity: SEVERITY.CRITICAL, category: CATEGORY.ELECTRICAL_PHYSICS }
    )
  }

  // ── 6. Avaliação dos critérios físicos e limites de equipamento ───────────

  const tensao_maxima_ok   = vocCorrigidoFrio <= inversor.v_max_dc
  const limite_mppt_ok     = vmppTotalMin >= inversor.v_mppt_min && vmppTotalMax <= inversor.v_mppt_max
  const limite_corrente_ok = correnteTotalMppt <= inversor.i_max_mppt

  if (!tensao_maxima_ok) {
    alertas.push({
      nivel:    'CRITICO',
      code:     'ERR_FISICA_OVERVOLTAGE_CRITICAL',
      mensagem: `CRITICO: Tensao Voc calculada no frio (${vocCorrigidoFrio.toFixed(2)}V) ` +
                `supera o limite destrutivo de entrada do inversor (${inversor.v_max_dc}V).`
    })
  }

  if (!limite_mppt_ok) {
    alertas.push({
      nivel:    'ADVERTENCIA',
      code:     'WARN_FISICA_JANELA_MPPT_ESCAPE',
      mensagem: `ADVERTENCIA: Janela MPPT fora dos limites ideais do inversor ` +
                `(${inversor.v_mppt_min}V a ${inversor.v_mppt_max}V). ` +
                `Faixa dinamica calculada: ${vmppTotalMin.toFixed(2)}V - ${vmppTotalMax.toFixed(2)}V.`
    })
  }

  if (!limite_corrente_ok) {
    alertas.push({
      nivel:    'CRITICO',
      code:     'ERR_FISICA_OVERCURRENT_CRITICAL',
      mensagem: `CRITICO: Corrente total MPPT (${correnteTotalMppt.toFixed(2)}A) ` +
                `satura o limite da entrada do inversor (${inversor.i_max_mppt}A).`
    })
  }

  // ── 7. Status de avaliação ────────────────────────────────────────────────

  const strings_validas = tensao_maxima_ok && limite_corrente_ok

  let status
  if (strings_validas && limite_mppt_ok) {
    status = 'OTIMIZADO'
  } else if (strings_validas && !limite_mppt_ok) {
    status = 'SUBOTIMIZADO'
  } else {
    status = 'REJEITADO'
  }

  // ── Resultado imutável ────────────────────────────────────────────────────

  return deepFreezeSafe({
    // ── Campos canônicos ──
    voc_corrigido_frio:  Number(vocCorrigidoFrio.toFixed(4)),
    vmpp_operacao_min:   Number(vmppTotalMin.toFixed(4)),
    vmpp_operacao_max:   Number(vmppTotalMax.toFixed(4)),
    status,

    // ── Flags de compatibilidade legada (preservados para Fusion Engine e Validator) ──
    tensao_maxima_ok,
    limite_mppt_ok,
    limite_corrente_ok,
    strings_validas,

    // ── Alias legado (vmpp_operacao → vmpp_operacao_min) ──
    vmpp_operacao: Number(vmppTotalMin.toFixed(4)),

    // ── Alertas estruturados { nivel, code, mensagem } ──
    alertas: [...alertas]
  })
}
