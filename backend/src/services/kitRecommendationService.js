/**
 * kitRecommendationService.js — S2.14 Passo 4
 *
 * Orquestrador do Motor de Recomendação de Kits FV.
 * 100% determinístico, em memória, sem IA, sem LLM, sem persistência.
 *
 * ── Fluxo ─────────────────────────────────────────────────────────────────────
 *  1. Tokenizar busca livre (kitTokenizerService)
 *  2. Gerar candidatos: PAINEIS × INVERSORES (produto cartesiano)
 *  3. Pré-filtro elétrico rápido (runtime-only, sem chamar compatibilidadeEletricaService)
 *  4. Pré-filtro de potência ±40% se alvo conhecido
 *  5. Aplicar filtros técnicos opcionais (somente_bifacial, etc.)
 *  6. Calcular custo mediano do conjunto candidato
 *  7. Scoring engine (4 critérios ponderados)
 *  8. Ranking final → Top 10
 *
 * ── Passo 3 — Readiness Técnica Futura ───────────────────────────────────────
 *  FILTROS_TECNICOS_PADRAO define a estrutura para futura integração com o
 *  optimizer de arranjo FV (S2.12). Os campos existem na API mesmo sem uso
 *  imediato — já recebidos no body e passados ao orquestrador.
 */

import { PAINEIS }      from '../data/catalogoPaineis.js'
import { INVERSORES }   from '../data/catalogoInversores.js'
import { tokenizarBusca }  from './kitTokenizerService.js'
import { calcularScore }   from './kitScoringEngineService.js'

// ─── Passo 3: Readiness Técnica Futura ───────────────────────────────────────

/**
 * Estrutura padrão de filtros técnicos.
 * Preparada para integração futura com optimizer de arranjo FV (S2.12).
 *
 * @typedef {object} FiltrosTecnicos
 *   oversizing_minimo    — Fator mínimo de oversizing (padrão 1.0)
 *   oversizing_maximo    — Fator máximo de oversizing (padrão 1.50)
 *   somente_bifacial     — Restringe a módulos bifaciais
 *   somente_microinversor — Restringe a microinversores
 *   mppt_minimo          — Número mínimo de entradas MPPT
 */
export const FILTROS_TECNICOS_PADRAO = Object.freeze({
  oversizing_minimo:     1.0,   // sem restrição inferior além de compatibilidade básica
  oversizing_maximo:     1.50,  // limite superior razoável para string
  somente_bifacial:      false,
  somente_microinversor: false,
  mppt_minimo:           1,
})

// ─── Helpers internos ─────────────────────────────────────────────────────────

/** Mediana estatística — robusta a outliers */
function mediana(arr) {
  if (!arr || arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Validação elétrica rápida — runtime-only.
 * NÃO chama compatibilidadeEletricaService (evita overhead e dependência circular).
 * Só descarta combinações física/eletricamente impossíveis; casos borderline
 * são mantidos e penalizados pelo scoring engine.
 *
 * Regras:
 *  1. Pelo menos 1 módulo necessário (trivial, mas guarda o fluxo)
 *  2. Tensão máxima: Voc_módulo × (módulos por string) < Voc_max_inversor × 1.05 (tolerância 5%)
 *  3. Tensão mínima MPPT: Vmpp_módulo × (módulos por string) ≥ mpptMin_inversor × 0.90 (tolerância 10%)
 *  4. Corrente: Isc_módulo × (strings paralelo) ≤ imaxMppt_inversor × nMppts × 1.10
 */
function validarEletricoRapido(painel, inversor, numModulosPorString, numStringsPar) {
  if (numModulosPorString <= 0 || numStringsPar <= 0) return false

  const vocArray    = painel.voc  * numModulosPorString
  const vmppArray   = painel.vmpp * numModulosPorString
  const iscTotal    = painel.isc  * numStringsPar

  // Tensão máxima (com tolerância de 5% — evitar falso-positivo por coeficiente temp)
  if (vocArray > (inversor.vocMax ?? 1000) * 1.05) return false

  // Tensão mínima MPPT (com tolerância de 10%)
  if (vmppArray < (inversor.mpptMin ?? 100) * 0.90) return false

  // Corrente máxima MPPT total (com tolerância de 10%)
  const imaxTotal = (inversor.imaxMppt ?? 20) * (inversor.nMppts ?? 1)
  if (iscTotal > imaxTotal * 1.10) return false

  return true
}

/**
 * Detecta se um painel é bifacial pelo modelo/descrição.
 * Heurística textual — suficiente para filtro de preferência do usuário.
 */
function isBifacial(painel) {
  const texto = `${painel.modelo ?? ''} ${painel.descricao ?? ''}`.toLowerCase()
  return texto.includes('bifacial') || texto.includes('bifaz') || texto.includes('bifi') ||
         texto.includes('double glass') || texto.includes('dupla face')
}

/**
 * Calcula número de módulos por string a partir dos parâmetros elétricos.
 * Usa fórmula conservadora centrada na janela MPPT para maximizar score de engenharia.
 *
 * Returns { modulos_por_string, strings_paralelo, potencia_total_kwp, custo_total, custo_por_kwp }
 * Returns null se nenhuma configuração válida for encontrada.
 */
function calcularMelhorArranjo(painel, inversor, potenciaAlvoKwp) {
  // Limites de módulos por string a varrer
  const minStr = Math.max(1, Math.floor((inversor.mpptMin ?? 100) / painel.vmpp))
  const maxStr = Math.min(30, Math.floor((inversor.vocMax ?? 1000) / painel.voc))

  // Potência total alvo: usa alvo informado ou estima a partir do inversor
  const potAlvo = potenciaAlvoKwp
    ? potenciaAlvoKwp * 1000   // W
    : (inversor.potenciaKW ?? 5) * 1000 * 1.20  // oversizing padrão 20%

  let melhor = null
  let melhorScore = -Infinity

  for (let mps = minStr; mps <= maxStr; mps++) {
    // Número de strings paralelo para atingir potência alvo
    const wpPorString   = painel.pmpp * mps
    const stringsNeeded = Math.max(1, Math.round(potAlvo / wpPorString))
    const stringsMax    = Math.min(20, stringsNeeded + 2)

    for (let sp = Math.max(1, stringsNeeded - 1); sp <= stringsMax; sp++) {
      if (!validarEletricoRapido(painel, inversor, mps, sp)) continue

      const potTotalW    = painel.pmpp * mps * sp
      const potTotalKwp  = potTotalW / 1000
      const oversizing   = potTotalKwp / (inversor.potenciaKW ?? potTotalKwp)

      // Score simples: favorece oversizing próximo de 1.20 e potência próxima do alvo
      const distOversizing = Math.abs(oversizing - 1.20)
      const distPotencia   = potAlvo > 0
        ? Math.abs(potTotalW - potAlvo) / potAlvo
        : 0
      const s = -(distOversizing + distPotencia)

      if (s > melhorScore) {
        melhorScore = s
        melhor = { mps, sp, potTotalKwp, oversizing }
      }
    }
  }

  if (!melhor) return null

  const { mps, sp, potTotalKwp, oversizing } = melhor
  const numTotalModulos = mps * sp
  const custoTotal      = numTotalModulos * (painel.precoUnitario ?? 0) +
                          (inversor.precoUnitario ?? 0)
  const custoPorKwp     = potTotalKwp > 0 ? custoTotal / potTotalKwp : 0

  return {
    modulos_por_string:  mps,
    strings_paralelo:    sp,
    num_total_modulos:   numTotalModulos,
    potencia_total_kwp:  +potTotalKwp.toFixed(3),
    oversizing_fator:    +oversizing.toFixed(3),
    custo_total:         +custoTotal.toFixed(2),
    custo_por_kwp:       +custoPorKwp.toFixed(2),
  }
}

// ─── Geração de candidatos ────────────────────────────────────────────────────

/**
 * Gera todos os candidatos (painel × inversor) e aplica pré-filtros.
 *
 * @param {number|null} potenciaAlvoKwp  - Potência alvo extraída do tokenizer
 * @param {object}      filtros          - Filtros técnicos (FILTROS_TECNICOS_PADRAO + overrides)
 * @returns {Array<Candidato>}
 */
function gerarCandidatos(potenciaAlvoKwp, filtros) {
  const candidatos = []

  for (const painel of PAINEIS) {
    // Filtro: somente_bifacial
    if (filtros.somente_bifacial && !isBifacial(painel)) continue

    for (const inversor of INVERSORES) {
      // Filtro: somente_microinversor
      if (filtros.somente_microinversor) {
        const tipoLower = (inversor.tipoInversor ?? '').toLowerCase()
        if (!tipoLower.includes('micro')) continue
      }

      // Filtro: mppt_minimo
      if ((inversor.nMppts ?? 1) < (filtros.mppt_minimo ?? 1)) continue

      // Calcular melhor arranjo elétrico para este par
      const arranjo = calcularMelhorArranjo(painel, inversor, potenciaAlvoKwp)
      if (!arranjo) continue  // nenhuma configuração elétrica válida

      // Pré-filtro de potência ±40% — só quando potência alvo é conhecida
      if (potenciaAlvoKwp != null) {
        const razao = arranjo.potencia_total_kwp / potenciaAlvoKwp
        if (razao < 0.60 || razao > 1.40) continue
      }

      // Pré-filtro de oversizing pelos limites técnicos
      if (arranjo.oversizing_fator < filtros.oversizing_minimo) continue
      if (arranjo.oversizing_fator > filtros.oversizing_maximo) continue

      candidatos.push({
        painel,
        inversor,
        arranjo,
        // Campos denormalizados para o scoring engine
        custo_por_kwp: arranjo.custo_por_kwp,
      })
    }
  }

  return candidatos
}

// ─── Exportação principal ─────────────────────────────────────────────────────

/**
 * recomendarKits — Ponto de entrada público do orquestrador.
 *
 * @param {object} params
 *   @param {string} [params.busca='']           - Texto livre de busca
 *   @param {number} [params.potencia_kwp]        - Potência alvo (override do tokenizer)
 *   @param {number} [params.consumo_kwh_mes]     - Consumo mensal (override do tokenizer)
 *   @param {object} [params.filtros_tecnicos={}] - Filtros técnicos adicionais (Passo 3)
 *
 * @returns {RecomendacaoResult}
 *
 * @typedef {object} RecomendacaoResult
 *   tokens, potencia_alvo_kwp, total_candidatos, top10, meta
 */
export function recomendarKits({
  busca           = '',
  potencia_kwp    = null,
  consumo_kwh_mes = null,
  filtros_tecnicos = {},
} = {}) {
  const tInicio = Date.now()

  // ── Passo 1: Tokenizar ────────────────────────────────────────────────────
  const tokens = tokenizarBusca(busca)

  // Override explícito do frontend tem prioridade sobre tokenizer
  const potenciaAlvoKwp = potencia_kwp  ?? tokens.potencia_alvo_kwp  ?? null
  const consumoKwhMes   = consumo_kwh_mes ?? tokens.consumo_kwh_mes  ?? null

  // ── Passo 2: Merge de filtros ─────────────────────────────────────────────
  const filtros = {
    ...FILTROS_TECNICOS_PADRAO,
    ...filtros_tecnicos,
    // Sanitização para evitar valores absurdos vindos do body
    oversizing_minimo: Math.max(0.5,  filtros_tecnicos.oversizing_minimo  ?? FILTROS_TECNICOS_PADRAO.oversizing_minimo),
    oversizing_maximo: Math.min(3.0,  filtros_tecnicos.oversizing_maximo  ?? FILTROS_TECNICOS_PADRAO.oversizing_maximo),
    mppt_minimo:       Math.max(1,    filtros_tecnicos.mppt_minimo        ?? FILTROS_TECNICOS_PADRAO.mppt_minimo),
    somente_bifacial:      !!filtros_tecnicos.somente_bifacial,
    somente_microinversor: !!filtros_tecnicos.somente_microinversor,
  }

  // ── Passo 3: Gerar candidatos (produto cartesiano + pré-filtros) ──────────
  const candidatos = gerarCandidatos(potenciaAlvoKwp, filtros)

  // ── Passo 4: Custo mediano do conjunto ────────────────────────────────────
  const custosKwp   = candidatos.map(c => c.custo_por_kwp).filter(v => v > 0)
  const custoMediano = mediana(custosKwp)

  // ── Passo 5: Scoring ──────────────────────────────────────────────────────
  const scorados = candidatos.map(candidato => {
    // Monta kit completo — campos nomeados exatamente como kitScoringEngineService espera
    const kit = {
      id:              `${candidato.painel.id}_${candidato.inversor.id}`,
      painel:          candidato.painel,
      inversor:        candidato.inversor,
      arranjo:         candidato.arranjo,
      custo_por_kwp:   candidato.custo_por_kwp,
      custo_total:     candidato.arranjo.custo_total,
      potencia_kwp:    candidato.arranjo.potencia_total_kwp,
      // ── campos consumidos por calcScoreTecnico ─────────────────────────
      potencia_cc_kwp: candidato.arranjo.potencia_total_kwp,
      valido_eletrico: true,   // já filtrado em calcularMelhorArranjo
      erros_eletricos: [],
      // ── campos consumidos por calcScoreEngenharia ──────────────────────
      fator_oversizing: candidato.arranjo.oversizing_fator,
      oversizing_fator: candidato.arranjo.oversizing_fator,
      num_paineis:     candidato.arranjo.modulos_por_string,  // módulos em série p/ Vmpp
    }
    return calcularScore(kit, tokens, custoMediano)
  })

  // ── Passo 6: Ranking final ─────────────────────────────────────────────────
  scorados.sort((a, b) => b.score_final - a.score_final)
  const top10 = scorados.slice(0, 10)

  const tFim = Date.now()

  // ── Passo 7: Resultado estruturado ────────────────────────────────────────
  return {
    tokens: {
      busca_original:      tokens.busca_original,
      potencia_alvo_kwp:   potenciaAlvoKwp,
      consumo_kwh_mes:     consumoKwhMes,
      marcas:              tokens.marcas,
      tecnologias:         tokens.tecnologias,
      meta:                tokens.meta,
    },
    potencia_alvo_kwp:  potenciaAlvoKwp,
    consumo_kwh_mes:    consumoKwhMes,
    filtros_aplicados:  filtros,
    total_candidatos:   candidatos.length,
    custo_mediano_kwp:  +custoMediano.toFixed(2),
    top10:              top10.map((kit, idx) => ({
      posicao:              idx + 1,
      id:                   kit.id,
      painel: {
        id:           kit.painel.id,
        marca:        kit.painel.marca,
        modelo:       kit.painel.modelo,
        pmpp:         kit.painel.pmpp,
        voc:          kit.painel.voc,
        area:         kit.painel.area,
        garantia_produto:     kit.painel.garantiaProduto,
        garantia_performance: kit.painel.garantiaPerformance,
        preco_unitario:       kit.painel.precoUnitario,
      },
      inversor: {
        id:           kit.inversor.id,
        marca:        kit.inversor.marca,
        modelo:       kit.inversor.modelo,
        potencia_kw:  kit.inversor.potenciaKW,
        tipo:         kit.inversor.tipoInversor,
        fase_ac:      kit.inversor.faseAC,
        garantia:     kit.inversor.garantia,
        preco_unitario: kit.inversor.precoUnitario,
      },
      arranjo:              kit.arranjo,
      custo_total:          kit.custo_total,
      custo_por_kwp:        kit.custo_por_kwp,
      potencia_kwp:         kit.potencia_kwp,
      oversizing_fator:     kit.oversizing_fator,
      score_final:          kit.score_final,
      // Converte objeto → array para facilitar iteração no frontend
      score_breakdown:      kit.score_breakdown
        ? Object.entries(kit.score_breakdown).map(([criterio, dados]) => ({
            criterio,
            ...dados,
          }))
        : [],
      explicacao_score:     kit.explicacao_score,
    })),
    meta: {
      tempo_execucao_ms:    tFim - tInicio,
      total_paineis_catalogo:    PAINEIS.length,
      total_inversores_catalogo: INVERSORES.length,
      combinacoes_brutas:        PAINEIS.length * INVERSORES.length,
      candidatos_pos_filtro:     candidatos.length,
      custo_mediano_kwp:         +custoMediano.toFixed(2),
      confianca_parse:           tokens.meta.confianca_parse,
      tem_potencia_alvo:         potenciaAlvoKwp !== null,
      tem_consumo:               consumoKwhMes !== null,
    },
  }
}
