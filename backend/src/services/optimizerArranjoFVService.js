/**
 * optimizerArranjoFVService.js — S2.12
 *
 * Optimizer determinístico de arranjo FV por Grid Search matemático.
 *
 * ── Responsabilidade ─────────────────────────────────────────────────────────
 *  Encontrar o melhor par (módulos_por_string × strings_paralelo) que maximize
 *  um score composto de 4 critérios físico-econômicos, testando cada combinação
 *  através de compatibilidadeEletricaService (NÃO alterado).
 *
 * ── Garantias arquiteturais ──────────────────────────────────────────────────
 *  ✔ 100% read-only — zero escrita em banco, zero I/O
 *  ✔ Determinístico — mesmo input → mesmo output, sempre
 *  ✔ Auditável — score_breakdown por critério para cada config válida
 *  ✔ Limitado — teto de 500 combinações testadas (proteção de CPU)
 *  ✔ Sem IA/LLM — algoritmo puramente matemático (grid + score)
 *
 * ── Critérios de Score (0–100) ───────────────────────────────────────────────
 *
 *  MPPT (peso 40 %)
 *    Vmpp operacional (média frio/quente) deve estar próximo ao centro da
 *    janela MPPT do inversor. Quanto mais próximo do centro → maior score.
 *
 *    centro_mppt = (mppt_min + mppt_max) / 2
 *    half_width  = (mppt_max - mppt_min) / 2
 *    vmpp_op     = (vmpp_string_frio + vmpp_string_quente) / 2
 *    score = max(0, 1 − |vmpp_op − centro_mppt| / half_width) × 100
 *
 *  Oversizing (peso 30 %)
 *    Faixa ideal: 1.15 × ≤ fator ≤ 1.30 ×. Penalidade linear fora da faixa.
 *    Além de 1.50 × → já descartado pelo motor de compatibilidade.
 *
 *    fator < 1.15 → score = (fator / 1.15) × 100
 *    1.15 ≤ fator ≤ 1.30 → score = 100
 *    1.30 < fator < 1.50 → score = (1 − (fator − 1.30) / 0.20) × 100
 *
 *  Margem de Tensão (peso 20 %)
 *    Folga de Voc no pior frio (pior caso de tensão). Maior folga = mais seguro.
 *    Referência: 20 % de folga = score 100. Linear abaixo.
 *
 *    folga = 1 − voc_string_max / tensao_max_entrada
 *    score = min(100, folga / 0.20 × 100)
 *
 *  Simplificação (peso 10 %)
 *    Menos strings em paralelo = menos cabos CC = menor custo de fiação.
 *    Decai 15 pontos por string adicional.
 *
 *    score = max(0, 100 − (strings_paralelo − 1) × 15)
 *
 * ── Fórmula final ────────────────────────────────────────────────────────────
 *   score_final = 0.40 × s_mppt + 0.30 × s_oversizing
 *               + 0.20 × s_tensao + 0.10 × s_simplificacao
 *
 * ── Saída ────────────────────────────────────────────────────────────────────
 *  {
 *    melhor_configuracao: Configuracao | null,
 *    configuracoes_validas: Configuracao[10],    // Top 10 por score_final
 *    configuracoes_descartadas: Descartada[],
 *    resumo_estatistico: Resumo,
 *  }
 */

import { analisarCompatibilidade, CONSTANTES } from './compatibilidadeEletricaService.js'

// ─── Constantes do optimizer ──────────────────────────────────────────────────

const MAX_COMBINACOES      = 500   // proteção de CPU
const TOP_N_RETORNADAS     = 10    // tamanho máximo do array de válidas
const OVERSIZING_ALVO_MIN  = 1.15  // faixa ideal CC/CA (limite inferior)
const OVERSIZING_ALVO_MAX  = 1.30  // faixa ideal CC/CA (limite superior)

// ─── Defaults das restrições ──────────────────────────────────────────────────

const RESTRICOES_PADRAO = Object.freeze({
  min_modulos_por_string: 3,
  max_modulos_por_string: 25,
  min_strings_paralelo:   1,
  max_strings_paralelo:   6,
  max_total_modulos:      null,   // sem limite
})

// ─── Helpers matemáticos ──────────────────────────────────────────────────────

function r2(v) { return Math.round(v * 100) / 100 }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// ─── Funções de score por critério ────────────────────────────────────────────

/**
 * Score MPPT (0–100)
 * Avalia quão centralizado Vmpp operacional está na janela MPPT.
 */
function scoreMPPT(calculos, limites) {
  const { vmpp_string_frio, vmpp_string_quente } = calculos
  const { faixa_mppt_min: mppt_min, faixa_mppt_max: mppt_max } = limites

  const centro    = (mppt_min + mppt_max) / 2
  const halfWidth = (mppt_max - mppt_min) / 2
  const vmppOp    = (vmpp_string_frio + vmpp_string_quente) / 2

  if (halfWidth <= 0) return 0
  const dist  = Math.abs(vmppOp - centro)
  return clamp((1 - dist / halfWidth) * 100, 0, 100)
}

/**
 * Score Oversizing (0–100)
 * Penalidade linear fora da faixa ideal [1.15, 1.30].
 */
function scoreOversizing(fator) {
  if (fator < OVERSIZING_ALVO_MIN) {
    // Abaixo do ideal: menos potência instalada do que o inversor aguenta
    return clamp((fator / OVERSIZING_ALVO_MIN) * 100, 0, 100)
  }
  if (fator <= OVERSIZING_ALVO_MAX) {
    // Dentro da faixa ideal
    return 100
  }
  // Acima do ideal (mas ainda válido: fator < 1.50)
  const excesso = fator - OVERSIZING_ALVO_MAX
  const janela  = CONSTANTES.OVERSIZING_LIMITE_ERRO - OVERSIZING_ALVO_MAX  // 0.20
  return clamp((1 - excesso / janela) * 100, 0, 100)
}

/**
 * Score Margem de Tensão (0–100)
 * Folga do Voc do string contra a tensão máxima CC.
 * Referência: 20 % de folga → score 100 (linear abaixo).
 */
function scoreTensao(calculos, limites) {
  const folga = 1 - calculos.voc_string_max / limites.tensao_max_inversor
  const REFERENCIA = 0.20  // 20 % de folga = score perfeito
  return clamp((folga / REFERENCIA) * 100, 0, 100)
}

/**
 * Score Simplificação (0–100)
 * Decai 15 pts por string adicional em paralelo.
 */
function scoreSimplificacao(strings_paralelo) {
  return clamp(100 - (strings_paralelo - 1) * 15, 0, 100)
}

/**
 * Calcula score_final ponderado e retorna breakdown completo.
 */
function calcularScore(resultado) {
  const { calculos, limites } = resultado
  const fator = calculos.fator_oversizing

  const s_mppt          = r2(scoreMPPT(calculos, limites))
  const s_oversizing    = r2(scoreOversizing(fator))
  const s_tensao        = r2(scoreTensao(calculos, limites))
  const s_simplificacao = r2(scoreSimplificacao(calculos.total_strings))

  const score_final = r2(
    0.40 * s_mppt +
    0.30 * s_oversizing +
    0.20 * s_tensao +
    0.10 * s_simplificacao
  )

  return {
    score_final,
    score_breakdown: {
      mppt:          { score: s_mppt,          peso: 40, descricao: 'Centralidade do Vmpp na janela MPPT' },
      oversizing:    { score: s_oversizing,    peso: 30, descricao: `Fator CC/CA ideal [${OVERSIZING_ALVO_MIN}–${OVERSIZING_ALVO_MAX}]` },
      tensao:        { score: s_tensao,        peso: 20, descricao: 'Folga de Voc contra tensão máxima CC' },
      simplificacao: { score: s_simplificacao, peso: 10, descricao: 'Redução de strings em paralelo (fiação)' },
    },
  }
}

// ─── Extração de resumo do resultado do motor ─────────────────────────────────

function extrairCalculosPrincipais(resultado) {
  const { calculos, limites, clima_utilizado } = resultado
  return {
    voc_string_max:              calculos.voc_string_max,
    vmpp_string_frio:            calculos.vmpp_string_frio,
    vmpp_string_quente:          calculos.vmpp_string_quente,
    isc_total:                   calculos.isc_total,
    fator_oversizing:            calculos.fator_oversizing,
    potencia_cc_total_kwp:       calculos.potencia_cc_total,
    total_modulos:               calculos.total_modulos,
    t_cel_max_c:                 calculos.t_cel_max_c,
    margem_tensao_percentual:    calculos.margem_tensao_percentual,
    margem_mppt_max_percentual:  calculos.margem_mppt_max_percentual,
    margem_mppt_min_percentual:  calculos.margem_mppt_min_percentual,
    margem_oversizing_percentual: calculos.margem_oversizing_percentual,
    tensao_max_inversor:         limites.tensao_max_inversor,
    faixa_mppt:                  `${limites.faixa_mppt_min}–${limites.faixa_mppt_max} V`,
    clima_fonte:                 clima_utilizado.fonte,
  }
}

// ─── Motor principal do optimizer ─────────────────────────────────────────────

/**
 * Encontra o arranjo FV ótimo por Grid Search determinístico.
 *
 * @param {object} params
 * @param {object} params.dados_eletricos_modulo    — parâmetros elétricos do módulo FV
 * @param {object} params.dados_eletricos_inversor  — parâmetros elétricos do inversor
 * @param {object} params.dados_climaticos_regiao   — Tmin/Tmax históricos (ou null → fallback)
 * @param {object} params.restricoes                — limites do grid (opcionais)
 * @returns {ResultadoOptimizer}
 *
 * @typedef {object} Configuracao
 *   modulos_por_string, strings_paralelo, score_final, score_breakdown, calculos_principais
 *
 * @typedef {object} ResultadoOptimizer
 *   melhor_configuracao, configuracoes_validas, configuracoes_descartadas, resumo_estatistico
 */
export function otimizarArranjoFV({
  dados_eletricos_modulo,
  dados_eletricos_inversor,
  dados_climaticos_regiao = null,
  restricoes = {},
}) {
  const t0 = Date.now()

  // ── Mescla restrições com defaults ─────────────────────────────────────────
  const res = {
    ...RESTRICOES_PADRAO,
    ...Object.fromEntries(
      Object.entries(restricoes).filter(([, v]) => v != null)
    ),
  }

  const configuracoes_validas     = []
  const configuracoes_descartadas = []
  let total_testadas = 0

  // ── Grid Search ─────────────────────────────────────────────────────────────
  outer:
  for (let m = res.min_modulos_por_string; m <= res.max_modulos_por_string; m++) {
    for (let s = res.min_strings_paralelo; s <= res.max_strings_paralelo; s++) {

      // Teto de segurança anti-CPU
      if (total_testadas >= MAX_COMBINACOES) break outer

      // Filtro de total de módulos (quando informado)
      const total = m * s
      if (res.max_total_modulos != null && total > res.max_total_modulos) continue

      total_testadas++

      // ── Testa a combinação no motor de compatibilidade ──────────────────
      let resultado
      try {
        resultado = analisarCompatibilidade({
          dados_eletricos_modulo,
          dados_eletricos_inversor,
          arranjo_proposto: {
            quantidade_modulos_por_string: m,
            quantidade_strings_paralelo:   s,
            num_mppt_usados: 1,
          },
          dados_climaticos_regiao,
        })
      } catch (err) {
        // Erro inesperado no motor — descarta combinação
        configuracoes_descartadas.push({
          modulos_por_string: m, strings_paralelo: s,
          motivos: [`Erro inesperado no motor: ${err.message}`],
        })
        continue
      }

      // ── Descarta se inválida ─────────────────────────────────────────────
      if (!resultado.compativel || resultado.erros.length > 0) {
        configuracoes_descartadas.push({
          modulos_por_string:  m,
          strings_paralelo:    s,
          total_modulos:       total,
          motivos: resultado.erros.map(e => `[${e.codigo}] ${e.explicacao_curta ?? e.mensagem}`),
        })
        continue
      }

      // ── Calcula score ────────────────────────────────────────────────────
      const { score_final, score_breakdown } = calcularScore(resultado)

      configuracoes_validas.push({
        modulos_por_string:  m,
        strings_paralelo:    s,
        total_modulos:       total,
        score_final,
        score_breakdown,
        calculos_principais: extrairCalculosPrincipais(resultado),
        warnings_count:      resultado.warnings.length,
        warnings:            resultado.warnings.map(w => w.codigo),
      })
    }
  }

  // ── Ordena válidas por score_final desc, mantém Top N ──────────────────────
  configuracoes_validas.sort((a, b) => b.score_final - a.score_final)
  const top = configuracoes_validas.slice(0, TOP_N_RETORNADAS)
  const melhor = top.length > 0 ? top[0] : null

  const tempo_execucao_ms = Date.now() - t0

  return {
    melhor_configuracao: melhor,

    // Top 10 por score_final (pode ser menos se poucas combinações forem válidas)
    configuracoes_validas: top,

    // Todas as combinações descartadas com motivo
    configuracoes_descartadas,

    resumo_estatistico: {
      total_testadas,
      total_validas:     configuracoes_validas.length,
      total_descartadas: configuracoes_descartadas.length,
      tempo_execucao_ms,
      restricoes_usadas: res,
      teto_combinacoes:  MAX_COMBINACOES,
      top_n:             TOP_N_RETORNADAS,
    },
  }
}

// ─── Export de constantes para uso no handler/frontend ───────────────────────

export const OPTIMIZER_CONSTANTES = Object.freeze({
  MAX_COMBINACOES,
  OVERSIZING_ALVO_MIN,
  OVERSIZING_ALVO_MAX,
  RESTRICOES_PADRAO: { ...RESTRICOES_PADRAO },
  PESOS: { mppt: 40, oversizing: 30, tensao: 20, simplificacao: 10 },
})
