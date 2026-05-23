/**
 * kitScoringEngineService.js — S2.14 Passo 2
 *
 * Motor de scoring determinístico para kits FV.
 * 100% matemático, auditável, sem IA, sem LLM, sem I/O.
 *
 * ── Critérios e pesos ────────────────────────────────────────────────────────
 *
 *  score_tecnico    (35 %)  — Proximidade da potência alvo + validade elétrica
 *  score_comercial  (35 %)  — Custo R$/kWp normalizado + garantias
 *  score_semantico  (20 %)  — Match de marca, tecnologia e tokens livres
 *  score_engenharia (10 %)  — Oversizing ideal + centralidade MPPT
 *
 * ── Saída por kit ────────────────────────────────────────────────────────────
 *  score_final       {number}   0–100, 2 casas decimais
 *  score_breakdown   {object}   score + peso + descrição por critério
 *  explicacao_score  {string[]} frases auditáveis (✓ bônus / △ penalidade / ✗ crítico)
 *
 * ── Readiness: integração futura com optimizer FV (S2.12) ───────────────────
 *  filtros_tecnicos: estrutura preparada para receber oversizing_minimo,
 *  oversizing_maximo, mppt_minimo — ainda não aplicados no scoring.
 */

// ─── Pesos e constantes ───────────────────────────────────────────────────────

export const PESOS = Object.freeze({
  tecnico:    0.35,
  comercial:  0.35,
  semantico:  0.20,
  engenharia: 0.10,
})

const OVERSIZING_IDEAL_MIN = 1.15
const OVERSIZING_IDEAL_MAX = 1.30

// ─── Utilitários matemáticos ──────────────────────────────────────────────────

const r2   = v => Math.round(v * 100) / 100
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

function normalizar(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

// ─── Formatador BRL ───────────────────────────────────────────────────────────

const fmtBRL = v =>
  new Intl.NumberFormat('pt-BR', {
    style:                 'currency',
    currency:              'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v)

// ─── score_tecnico (potência match + validade elétrica) ──────────────────────

/**
 * Mede quão próxima é a potência CC do kit ao alvo solicitado.
 * Penaliza fortemente combinações eletricamente inválidas.
 *
 *   desvio 0%  → score 100
 *   desvio 50% → score 0  (decaimento linear)
 */
function calcScoreTecnico(kit, tokens) {
  const { potencia_alvo_kwp }    = tokens
  const { potencia_cc_kwp, valido_eletrico, erros_eletricos } = kit
  const explicacoes = []

  let score

  if (potencia_alvo_kwp && potencia_alvo_kwp > 0) {
    const desvioRel = Math.abs(potencia_cc_kwp - potencia_alvo_kwp) / potencia_alvo_kwp
    score = clamp((1 - desvioRel / 0.50) * 100, 0, 100)

    const diff = r2(potencia_cc_kwp - potencia_alvo_kwp)
    if (Math.abs(diff) <= 0.10) {
      explicacoes.push(`✓ Potência ${potencia_cc_kwp.toFixed(2)} kWp — exatamente no alvo`)
    } else if (diff > 0) {
      explicacoes.push(`△ ${potencia_cc_kwp.toFixed(2)} kWp (+${diff.toFixed(2)} acima do alvo de ${potencia_alvo_kwp} kWp)`)
    } else {
      explicacoes.push(`▽ ${potencia_cc_kwp.toFixed(2)} kWp (${diff.toFixed(2)} abaixo do alvo de ${potencia_alvo_kwp} kWp)`)
    }
  } else {
    score = 50  // neutro: sem alvo definido
    explicacoes.push(`◯ Sem alvo de potência definido — score neutro (${potencia_cc_kwp.toFixed(2)} kWp gerado)`)
  }

  // Penalidade elétrica: invalidade reduz 70% do score
  if (!valido_eletrico) {
    score = score * 0.30
    erros_eletricos.forEach(e => explicacoes.push(`✗ Erro elétrico: ${e}`))
  } else {
    explicacoes.push('✓ Validação elétrica OK (Voc, Vmpp, Isc dentro dos limites)')
  }

  return { score: r2(clamp(score, 0, 100)), explicacoes }
}

// ─── score_comercial (custo-benefício + garantias) ────────────────────────────

/**
 * Compara o custo/kWp do kit com a mediana do conjunto candidato.
 *   50% abaixo da mediana → score 100
 *   Na mediana           → score 50
 *   50% acima da mediana → score 0
 */
function calcScoreCusto(kit, custoMediano) {
  const desvio = (kit.custo_por_kwp - custoMediano) / custoMediano
  return clamp((0.5 - desvio) * 100, 0, 100)
}

function calcScoreGarantiaInversor(anos) {
  if (anos >= 25) return 100
  if (anos >= 15) return 90
  if (anos >= 10) return 75
  if (anos >= 5)  return 40
  return 20
}

function calcScoreGarantiaPainel(garantiaPerformance) {
  if (garantiaPerformance >= 25) return 100
  if (garantiaPerformance >= 20) return 80
  if (garantiaPerformance >= 15) return 60
  return 50
}

function calcScoreComercial(kit, custoMediano) {
  const explicacoes = []

  const sCusto    = r2(calcScoreCusto(kit, custoMediano))
  const sGarInv   = r2(calcScoreGarantiaInversor(kit.inversor.garantia))
  const sGarPnl   = r2(calcScoreGarantiaPainel(kit.painel.garantiaPerformance))

  // Pesos internos: custo=60%, garantia inversor=25%, garantia painel=15%
  const score = r2(0.60 * sCusto + 0.25 * sGarInv + 0.15 * sGarPnl)

  const custoPorKwpFmt = fmtBRL(kit.custo_por_kwp)
  if (sCusto >= 70)      explicacoes.push(`✓ Custo ${custoPorKwpFmt}/kWp — abaixo da média do catálogo`)
  else if (sCusto >= 40) explicacoes.push(`◯ Custo ${custoPorKwpFmt}/kWp — próximo à média do catálogo`)
  else                   explicacoes.push(`△ Custo ${custoPorKwpFmt}/kWp — acima da média do catálogo`)

  if (sGarInv >= 75) explicacoes.push(`✓ Garantia inversor ${kit.inversor.garantia} anos`)
  else               explicacoes.push(`◯ Garantia inversor ${kit.inversor.garantia} anos`)

  if (kit.painel.garantiaProduto >= 15) {
    explicacoes.push(`✓ Garantia produto painel ${kit.painel.garantiaProduto} anos (premium)`)
  }

  if (kit.painel.percentualPerformance && kit.painel.percentualPerformance >= 84) {
    explicacoes.push(`✓ Performance garantida: ${kit.painel.percentualPerformance}% em 25 anos`)
  }

  return { score: clamp(score, 0, 100), explicacoes }
}

// ─── score_semantico (marcas + tecnologias + tokens) ─────────────────────────

/**
 * Pontua em três dimensões:
 *   · Marca de painel (40 pts): match exato → 40; sem preferência → 20 (neutro)
 *   · Marca de inversor (40 pts): idem
 *   · Tecnologia (20 pts): match → 20; sem preferência → 10 (neutro)
 *
 * Score neutro (sem preferências) = 50.
 * Score máximo (todos matched) = 100.
 */
function calcScoreSemântico(kit, tokens) {
  const { marcas, tecnologias } = tokens
  const explicacoes = []

  let pontos    = 0
  const maxPts  = 100  // 40 + 40 + 20

  // ── Marca do painel (40 pts) ─────────────────────────────────────────────
  if (marcas.paineis.length > 0) {
    const marcaNorm = normalizar(kit.painel.marca)
    const matched   = marcas.paineis.some(m =>
      marcaNorm.includes(normalizar(m)) || normalizar(m).includes(marcaNorm)
    )
    if (matched) {
      pontos += 40
      explicacoes.push(`✓ Match exato de marca painel: ${kit.painel.marca}`)
    } else {
      explicacoes.push(`✗ Painel ${kit.painel.marca} ≠ busca (${marcas.paineis.join(', ')})`)
    }
  } else {
    pontos += 20  // neutro — sem preferência expressa
    explicacoes.push(`◯ Sem preferência de marca de painel — ${kit.painel.marca}`)
  }

  // ── Marca do inversor (40 pts) ───────────────────────────────────────────
  if (marcas.inversores.length > 0) {
    const marcaInvNorm = normalizar(kit.inversor.marca)
    const matched      = marcas.inversores.some(m =>
      marcaInvNorm.includes(normalizar(m)) || normalizar(m).includes(marcaInvNorm)
    )
    if (matched) {
      pontos += 40
      explicacoes.push(`✓ Match exato de marca inversor: ${kit.inversor.marca}`)
    } else {
      explicacoes.push(`✗ Inversor ${kit.inversor.marca} ≠ busca (${marcas.inversores.join(', ')})`)
    }
  } else {
    pontos += 20  // neutro
    explicacoes.push(`◯ Sem preferência de marca de inversor — ${kit.inversor.marca}`)
  }

  // ── Tecnologia (20 pts) ──────────────────────────────────────────────────
  if (tecnologias.length > 0) {
    let matchTec = false

    if (tecnologias.includes('microinversor') && kit.inversor.tipoInversor === 'micro') {
      pontos += 20; matchTec = true
      explicacoes.push('✓ Microinversor — conforme solicitado')
    }
    if (tecnologias.includes('string') && kit.inversor.tipoInversor === 'string') {
      pontos += 20; matchTec = true
      explicacoes.push('✓ Inversor string — conforme solicitado')
    }
    if (tecnologias.includes('trifasico') && kit.inversor.faseAC === 3) {
      pontos += 15; matchTec = true
      explicacoes.push('✓ Inversor trifásico — conforme solicitado')
    }
    if (tecnologias.includes('monofasico') && kit.inversor.faseAC === 1) {
      pontos += 15; matchTec = true
      explicacoes.push('✓ Inversor monofásico — conforme solicitado')
    }

    if (!matchTec) {
      pontos += 0
      explicacoes.push(`△ Tecnologia "${tecnologias.join(', ')}" — não correspondida`)
    }
  } else {
    pontos += 10  // neutro
  }

  const score = r2((Math.min(pontos, maxPts) / maxPts) * 100)
  return { score: clamp(score, 0, 100), explicacoes }
}

// ─── score_engenharia (oversizing + centralidade MPPT) ───────────────────────

/**
 * scoreOversizing: faixa ideal [1.15–1.30] → 100
 * Decaimento linear fora da faixa; zera em <0.90 ou >1.55.
 */
function calcScoreOversizing(fator) {
  if (fator >= OVERSIZING_IDEAL_MIN && fator <= OVERSIZING_IDEAL_MAX) return 100
  if (fator < OVERSIZING_IDEAL_MIN) {
    const desvio = (OVERSIZING_IDEAL_MIN - fator) / OVERSIZING_IDEAL_MIN
    return clamp((1 - desvio / 0.25) * 100, 0, 100)
  }
  // Acima do ideal
  const desvio = (fator - OVERSIZING_IDEAL_MAX) / OVERSIZING_IDEAL_MAX
  return clamp((1 - desvio / 0.20) * 100, 0, 100)
}

/**
 * scoreMPPT: quão centralizado está Vmpp_string na janela MPPT do inversor.
 * Centro perfeito → 100; borda da janela → 0.
 */
function calcScoreMPPT(kit) {
  const { inversor, painel, num_paineis } = kit
  const vmppString = painel.vmpp * num_paineis
  const centro     = (inversor.mpptMin + inversor.mpptMax) / 2
  const halfWidth  = (inversor.mpptMax - inversor.mpptMin) / 2
  if (halfWidth <= 0) return 0
  const dist = Math.abs(vmppString - centro)
  return clamp((1 - dist / halfWidth) * 100, 0, 100)
}

function calcScoreEngenharia(kit) {
  const explicacoes = []

  const sOversizing = r2(calcScoreOversizing(kit.fator_oversizing))
  const sMPPT       = r2(calcScoreMPPT(kit))

  // Pesos internos: oversizing=60%, MPPT=40%
  const score = r2(0.60 * sOversizing + 0.40 * sMPPT)

  if (sOversizing >= 90) {
    explicacoes.push(`✓ Oversizing ${kit.fator_oversizing.toFixed(2)}× — faixa ideal [${OVERSIZING_IDEAL_MIN}–${OVERSIZING_IDEAL_MAX}]`)
  } else if (sOversizing >= 50) {
    explicacoes.push(`◯ Oversizing ${kit.fator_oversizing.toFixed(2)}× — aceitável, fora do ideal`)
  } else {
    explicacoes.push(`△ Oversizing ${kit.fator_oversizing.toFixed(2)}× — distante da faixa recomendada`)
  }

  if (sMPPT >= 80) {
    explicacoes.push('✓ Vmpp string bem centralizado na janela MPPT')
  } else if (sMPPT >= 50) {
    explicacoes.push('◯ Vmpp dentro da janela MPPT, porém não centralizado')
  } else {
    explicacoes.push('△ Vmpp próximo ao limite da janela MPPT')
  }

  return {
    score: clamp(score, 0, 100),
    explicacoes,
    detalhes: {
      oversizing:       sOversizing,
      mppt_centralidade: sMPPT,
    },
  }
}

// ─── Função de score final ponderado ─────────────────────────────────────────

/**
 * calcularScore — Calcula o score completo de um kit candidato.
 *
 * @param {object} kit         — Kit gerado pelo orchestrador (painel + inversor + métricas)
 * @param {object} tokens      — Resultado do tokenizarBusca()
 * @param {number} custoMediano — Custo mediano/kWp do conjunto para normalização
 * @returns {KitComScore}
 */
export function calcularScore(kit, tokens, custoMediano) {
  const tec = calcScoreTecnico(kit, tokens)
  const com = calcScoreComercial(kit, custoMediano)
  const sem = calcScoreSemântico(kit, tokens)
  const eng = calcScoreEngenharia(kit)

  const score_final = r2(
    PESOS.tecnico    * tec.score +
    PESOS.comercial  * com.score +
    PESOS.semantico  * sem.score +
    PESOS.engenharia * eng.score
  )

  return {
    ...kit,
    score_final,
    score_breakdown: {
      tecnico: {
        score:    r2(tec.score),
        peso:     35,
        descricao: 'Proximidade da potência alvo + validade elétrica',
      },
      comercial: {
        score:    r2(com.score),
        peso:     35,
        descricao: 'Custo R$/kWp normalizado + garantias inversor e painel',
      },
      semantico: {
        score:    r2(sem.score),
        peso:     20,
        descricao: 'Match de marca, tecnologia e tokens de busca',
      },
      engenharia: {
        score:    r2(eng.score),
        peso:     10,
        descricao: `Oversizing ideal [${OVERSIZING_IDEAL_MIN}–${OVERSIZING_IDEAL_MAX}] + centralidade MPPT`,
        detalhes: eng.detalhes,
      },
    },
    explicacao_score: [
      ...tec.explicacoes,
      ...com.explicacoes,
      ...sem.explicacoes,
      ...eng.explicacoes,
    ],
  }
}

// ─── Exportações de constantes ────────────────────────────────────────────────

export const SCORING_CONSTANTES = Object.freeze({
  PESOS,
  OVERSIZING_IDEAL_MIN,
  OVERSIZING_IDEAL_MAX,
})
