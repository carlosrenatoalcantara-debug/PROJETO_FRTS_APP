/**
 * kitRecommendationController.js — S2.14 Passo 5
 *
 * Controller HTTP para o Motor de Recomendação de Kits FV.
 * Zero persistência, zero side-effects — 100% read-only analítico.
 *
 * POST /api/v1/kits/recomendar
 */

import { recomendarKits } from '../services/kitRecommendationService.js'

/**
 * recomendarKitsHandler
 *
 * Body (todos opcionais — pode-se enviar só `busca`):
 *   busca           {string}  — Texto livre: "5kWp canadian bifacial"
 *   potencia_kwp    {number}  — Override da potência alvo (kWp)
 *   consumo_kwh_mes {number}  — Override do consumo mensal (kWh)
 *   filtros_tecnicos {object} — Filtros avançados (Passo 3 readiness):
 *     oversizing_minimo     {number}  default 1.0
 *     oversizing_maximo     {number}  default 1.50
 *     somente_bifacial      {boolean} default false
 *     somente_microinversor {boolean} default false
 *     mppt_minimo           {number}  default 1
 *
 * Resposta 200: { tokens, potencia_alvo_kwp, total_candidatos, top10[], meta }
 * Resposta 400: { erro } — parâmetros inválidos
 * Resposta 500: { erro, detalhe? } — erro interno
 */
export async function recomendarKitsHandler(req, res) {
  try {
    const {
      busca            = '',
      potencia_kwp,
      consumo_kwh_mes,
      filtros_tecnicos = {},
    } = req.body ?? {}

    // ── Validações básicas ────────────────────────────────────────────────────

    if (typeof busca !== 'string') {
      return res.status(400).json({ erro: '`busca` deve ser uma string.' })
    }

    if (potencia_kwp !== undefined && potencia_kwp !== null) {
      const v = Number(potencia_kwp)
      if (isNaN(v) || v <= 0 || v > 10000) {
        return res.status(400).json({ erro: '`potencia_kwp` deve ser um número positivo (kWp).' })
      }
    }

    if (consumo_kwh_mes !== undefined && consumo_kwh_mes !== null) {
      const v = Number(consumo_kwh_mes)
      if (isNaN(v) || v <= 0 || v > 1000000) {
        return res.status(400).json({ erro: '`consumo_kwh_mes` deve ser um número positivo (kWh/mês).' })
      }
    }

    if (filtros_tecnicos !== null && typeof filtros_tecnicos !== 'object') {
      return res.status(400).json({ erro: '`filtros_tecnicos` deve ser um objeto.' })
    }

    // Validação extra do busca: não aceita strings absurdamente longas
    if (busca.length > 500) {
      return res.status(400).json({ erro: '`busca` excede o limite de 500 caracteres.' })
    }

    // ── Orquestrador ─────────────────────────────────────────────────────────

    const resultado = recomendarKits({
      busca,
      potencia_kwp:    potencia_kwp    != null ? Number(potencia_kwp)    : null,
      consumo_kwh_mes: consumo_kwh_mes != null ? Number(consumo_kwh_mes) : null,
      filtros_tecnicos: filtros_tecnicos ?? {},
    })

    // Log de métricas (sem dados pessoais)
    console.log(
      `[kits/recomendar] busca="${busca.slice(0, 60)}" | ` +
      `potencia=${resultado.potencia_alvo_kwp}kWp | ` +
      `candidatos=${resultado.total_candidatos} | ` +
      `top=${resultado.top10.length} | ` +
      `${resultado.meta.tempo_execucao_ms}ms`
    )

    return res.status(200).json(resultado)

  } catch (err) {
    console.error('[kits/recomendar] Erro interno:', err.message)
    return res.status(500).json({
      erro:    'Erro interno ao processar recomendação de kits.',
      detalhe: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    })
  }
}
