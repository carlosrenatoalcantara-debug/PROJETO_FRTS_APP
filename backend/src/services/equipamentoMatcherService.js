/**
 * equipamentoMatcherService.js — S2.15-B.3A
 *
 * Motor de matching determinístico de 5 camadas para equipamentos FV.
 * Implementa Coeficiente Sørensen-Dice sobre tokens normalizados,
 * detecção de ambiguidade por proximidade de família e audit trail completo.
 *
 * Versão: 2.15.3-A
 * Autoria: S2.15-B.3A (hardening arquitetural)
 *
 * Correções aplicadas sobre o rascunho original:
 *   [FIX-1] Campo de potência: catalogo usa `pmpp` (W) e `potenciaKW` (kW),
 *           não `potencia`/`potenciaNominal`. Função _potenciaW() abstrai isso.
 *   [FIX-2] Layer 1: match exato modelo+marca sem potência retornava null.
 *           Agora retorna score 0.97 se potência ausente mas modelo+marca batem.
 *   [FIX-3] import() com caminho relativo ao CWD quebra em Railway/PM2/Docker.
 *           Substituído por URL relativa ao arquivo atual via import.meta.url.
 */

// ─── Constantes ───────────────────────────────────────────────────────────────

export const VERSAO_MATCHER = '2.15.3-A'

/** Limiar mínimo de Dice para aceitar um candidato na Layer 2 (MATCH_NORMALIZADO) */
const LIMIAR_NORMALIZADO = 0.80

/** Limiar mínimo de Dice para aceitar um candidato na Layer 3 (FUZZY) */
const LIMIAR_FUZZY = 0.50

/** Penalidade de score aplicada em resultados Fuzzy (incerteza estrutural) */
const PENALIDADE_FUZZY = 0.80

/** Limiar de Dice de marca para aceitar na Layer 4 (MARCA+POTÊNCIA) */
const LIMIAR_MARCA_POTENCIA = 0.80

/** Tolerância em W para comparação de potência (acomoda arredondamentos do OCR) */
const TOLERANCIA_POTENCIA_W = 5

/** Janela de proximidade para detecção de ambiguidade por família de modelo */
const LIMIAR_AMBIGUIDADE = 0.12

// ─── Helpers de campo ─────────────────────────────────────────────────────────

/**
 * Extrai a marca de um registro do catálogo.
 * O catálogo real usa `marca` em painéis e inversores.
 * O campo `fabricante` é mantido como fallback para compatibilidade futura.
 */
function _marca(eq) {
  return eq.fabricante ?? eq.marca ?? ''
}

/**
 * Extrai a potência de um registro do catálogo, sempre em Watts.
 *
 * Painéis:    eq.pmpp        → já em W
 * Inversores: eq.potenciaKW  → converte kW → W
 * Fallback:   eq.potencia / eq.potenciaNominal (catálogos externos)
 *
 * [FIX-1] O rascunho original referenciava eq.potencia/eq.potenciaNominal
 * que não existem no catalogoPaineis.js nem no catalogoInversores.js.
 */
function _potenciaW(eq) {
  if (typeof eq.pmpp === 'number')        return eq.pmpp                  // painel (W)
  if (typeof eq.potenciaKW === 'number')  return eq.potenciaKW * 1000     // inversor (kW→W)
  // fallback para catálogos externos
  const raw = eq.potencia ?? eq.potenciaNominal
  return raw !== undefined ? parseInt(raw, 10) : NaN
}

// ─── Classe principal ─────────────────────────────────────────────────────────

export class EquipamentoMatcherService {

  /**
   * @param {object} [config]
   * @param {string} [config.caminhoPaineis]    — caminho absoluto para override em testes
   * @param {string} [config.caminhoInversores] — caminho absoluto para override em testes
   */
  constructor(config = {}) {
    // Caminhos resolvidos relativamente ao arquivo atual (não ao CWD do processo).
    // [FIX-3] import.meta.url garante resolução correta em Railway, PM2 e Docker.
    this._urlPaineis    = config.caminhoPaineis
      ?? new URL('../data/catalogoPaineis.js',    import.meta.url).href
    this._urlInversores = config.caminhoInversores
      ?? new URL('../data/catalogoInversores.js', import.meta.url).href

    this.versaoMatcher = VERSAO_MATCHER
  }

  // ─── Lazy-loading dos catálogos ─────────────────────────────────────────────

  /**
   * Carrega os catálogos via dynamic import().
   *
   * Node.js cacheia o resultado da primeira chamada por URL — chamadas subsequentes
   * retornam o módulo do cache sem re-leitura de disco. O lazy-loading aqui serve
   * para isolamento em testes (paths injetáveis) e não para redução de heap por
   * chamada (o cache do módulo é global ao processo).
   *
   * @returns {Promise<object[]>} — array unificado com `tipoEquipamento` injetado
   */
  async _getCatalogos() {
    try {
      const [paineisModule, inversoresModule] = await Promise.all([
        import(this._urlPaineis),
        import(this._urlInversores),
      ])

      const paineis = (paineisModule.PAINEIS ?? paineisModule.default ?? paineisModule)
        .map(p => ({ ...p, tipoEquipamento: 'painel' }))

      const inversores = (inversoresModule.INVERSORES ?? inversoresModule.default ?? inversoresModule)
        .map(i => ({ ...i, tipoEquipamento: 'inversor' }))

      return [...paineis, ...inversores]
    } catch (err) {
      throw new Error(`Falha no lazy-loading dos catálogos: ${err.message}`)
    }
  }

  // ─── Normalização e similaridade ────────────────────────────────────────────

  /**
   * Tokeniza e normaliza: lowercase, sem acento, só alfanumérico, split por espaço.
   * @param {*} texto
   * @returns {string[]}
   */
  _normalizarParaTokens(texto) {
    if (!texto) return []
    return texto
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0)
  }

  /**
   * Coeficiente Sørensen-Dice sobre conjuntos de tokens.
   * Imune a reordenação de termos (ex.: "Solar Canadian" ≡ "Canadian Solar").
   *
   * Dice(A,B) = 2 * |A ∩ B| / (|A| + |B|)
   *
   * @param {string[]} tokensA
   * @param {string[]} tokensB
   * @returns {number} — [0.0, 1.0]
   */
  _calcularDiceTokens(tokensA, tokensB) {
    if (tokensA.length === 0 || tokensB.length === 0) return 0.0
    const setB = new Set(tokensB)
    let intersecao = 0
    for (const t of tokensA) { if (setB.has(t)) intersecao++ }
    return (2.0 * intersecao) / (tokensA.length + tokensB.length)
  }

  // ─── Motor de matching principal ─────────────────────────────────────────────

  /**
   * Executa o motor de correspondência de 5 camadas.
   *
   * @param {string|null} fabricanteInput — marca declarada no documento
   * @param {string|null} modeloInput     — modelo declarado no documento
   * @param {number|string|null} potenciaInput — potência em W (ex.: 550, "550", "550W")
   * @returns {Promise<MatchResult>}
   */
  async matchEquipamento(fabricanteInput, modeloInput, potenciaInput) {
    const auditado_em = new Date().toISOString()

    const tokensFab = this._normalizarParaTokens(fabricanteInput)
    const tokensMod = this._normalizarParaTokens(modeloInput)

    // Potência de entrada em W (aceita inteiro, string "550", "550W", "5kW")
    const potInputW = _parsePotenciaInputW(potenciaInput)

    const catalogo = await this._getCatalogos()

    let candidatos       = []
    const camadasAvaliadas = []

    // ── CAMADA 1: MATCH EXATO (modelo + marca) ────────────────────────────────
    camadasAvaliadas.push('MATCH_EXATO')
    const modInputNorm = modeloInput?.toString().trim().toLowerCase() ?? ''
    const fabInputNorm = fabricanteInput?.toString().trim().toLowerCase() ?? ''

    for (const eq of catalogo) {
      const modEqNorm = eq.modelo?.toString().trim().toLowerCase() ?? ''
      const fabEqNorm = _marca(eq).toString().trim().toLowerCase()

      if (modInputNorm && modEqNorm === modInputNorm &&
          fabInputNorm && fabEqNorm === fabInputNorm) {

        const potEqW = _potenciaW(eq)

        // Score 1.0 quando potência também confere (ou dentro da tolerância)
        if (!isNaN(potInputW) && !isNaN(potEqW) &&
            Math.abs(potEqW - potInputW) <= TOLERANCIA_POTENCIA_W) {
          return _resultado({ encontrado: true, status: 'equipamento_encontrado',
            score: 1.0, nivel: 'ALTO', metodo: 'MATCH_EXATO',
            eq, ambiguidades: [], camadasAvaliadas,
            versao_matcher: this.versaoMatcher, auditado_em })
        }

        // [FIX-2] Score 0.97: modelo+marca batem exatamente mas potência não foi fornecida
        if (isNaN(potInputW)) {
          return _resultado({ encontrado: true, status: 'equipamento_encontrado',
            score: 0.97, nivel: 'ALTO', metodo: 'MATCH_EXATO_SEM_POTENCIA',
            eq, ambiguidades: [], camadasAvaliadas,
            versao_matcher: this.versaoMatcher, auditado_em })
        }
      }
    }

    // ── CAMADA 2: MATCH NORMALIZADO POR TOKENS (Dice) ─────────────────────────
    camadasAvaliadas.push('MATCH_NORMALIZADO')
    for (const eq of catalogo) {
      const fabEqTok = this._normalizarParaTokens(_marca(eq))
      const modEqTok = this._normalizarParaTokens(eq.modelo)

      const diceMod = this._calcularDiceTokens(tokensMod, modEqTok)
      const diceFab = this._calcularDiceTokens(tokensFab, fabEqTok)

      // Score composto: modelo vale 70%, marca vale 30%
      const scoreComposto = (diceMod * 0.7) + (diceFab * 0.3)

      if (diceMod >= LIMIAR_NORMALIZADO) {
        candidatos.push({ eq, score: scoreComposto, metodo: 'MATCH_NORMALIZADO' })
      }
    }

    // ── CAMADA 3: FUZZY MATCHING (modelo, limiar relaxado) ────────────────────
    if (candidatos.length === 0) {
      camadasAvaliadas.push('FUZZY_MATCHING')
      for (const eq of catalogo) {
        const modEqTok = this._normalizarParaTokens(eq.modelo)
        const scoreFuzzy = this._calcularDiceTokens(tokensMod, modEqTok)

        if (scoreFuzzy >= LIMIAR_FUZZY) {
          // Penalização explícita: incerteza estrutural por modelo-only
          candidatos.push({ eq, score: scoreFuzzy * PENALIDADE_FUZZY, metodo: 'FUZZY_MATCHING' })
        }
      }
    }

    // ── CAMADA 4: MATCH MARCA + POTÊNCIA (sem modelo confiável) ──────────────
    if (candidatos.length === 0 && tokensFab.length > 0 && !isNaN(potInputW)) {
      camadasAvaliadas.push('MATCH_MARCA_POTENCIA')
      for (const eq of catalogo) {
        const fabEqTok = this._normalizarParaTokens(_marca(eq))
        const diceFab  = this._calcularDiceTokens(tokensFab, fabEqTok)
        const potEqW   = _potenciaW(eq)

        if (diceFab >= LIMIAR_MARCA_POTENCIA &&
            !isNaN(potEqW) &&
            Math.abs(potEqW - potInputW) <= TOLERANCIA_POTENCIA_W) {
          candidatos.push({ eq, score: 0.40, metodo: 'MATCH_MARCA_POTENCIA' })
        }
      }
    }

    // ── CAMADA 5: MATCH APENAS POTÊNCIA (nunca aprova automaticamente) ────────
    if (candidatos.length === 0 && !isNaN(potInputW)) {
      camadasAvaliadas.push('MATCH_APENAS_POTENCIA')
      for (const eq of catalogo) {
        const potEqW = _potenciaW(eq)
        if (!isNaN(potEqW) && Math.abs(potEqW - potInputW) <= TOLERANCIA_POTENCIA_W) {
          candidatos.push({ eq, score: 0.05, metodo: 'MATCH_APENAS_POTENCIA' })
        }
      }
    }

    // ── Nenhum candidato ──────────────────────────────────────────────────────
    if (candidatos.length === 0) {
      return _resultado({ encontrado: false, status: 'datasheet_necessario',
        score: 0.0, nivel: 'BAIXO', metodo: 'NENHUM',
        eq: null, ambiguidades: [], camadasAvaliadas,
        versao_matcher: this.versaoMatcher, auditado_em })
    }

    // ── Ordenação determinística: score desc, modelo asc (desempate lexicográfico) ──
    candidatos.sort((a, b) =>
      b.score - a.score || a.eq.modelo.localeCompare(b.eq.modelo)
    )

    const top = candidatos[0]

    // ── Regra de segurança: potência-only → ambíguo obrigatório ──────────────
    if (top.metodo === 'MATCH_APENAS_POTENCIA') {
      return _resultado({ encontrado: false, status: 'equipamento_ambiguo',
        score: 0.05, nivel: 'BAIXO', metodo: 'MATCH_APENAS_POTENCIA',
        eq: null,
        ambiguidades: candidatos.slice(0, 5).map(_resumoAmbiguidade),
        camadasAvaliadas,
        versao_matcher: this.versaoMatcher, auditado_em })
    }

    // ── Detecção de ambiguidade por proximidade de família ────────────────────
    const conflitos = candidatos.filter(c =>
      c.eq.modelo !== top.eq.modelo &&
      (top.score - c.score) < LIMIAR_AMBIGUIDADE
    )

    if (conflitos.length > 0) {
      return _resultado({ encontrado: false, status: 'equipamento_ambiguo',
        score: top.score, nivel: 'MEDIO', metodo: top.metodo,
        eq: top.eq,
        ambiguidades: candidatos.map(_resumoAmbiguidade),
        camadasAvaliadas,
        versao_matcher: this.versaoMatcher, auditado_em })
    }

    // ── Resultado único confirmado ────────────────────────────────────────────
    const nivel = top.score >= 0.85 ? 'ALTO' : top.score >= 0.50 ? 'MEDIO' : 'BAIXO'

    return _resultado({ encontrado: true, status: 'equipamento_encontrado',
      score: top.score, nivel, metodo: top.metodo,
      eq: top.eq, ambiguidades: [], camadasAvaliadas,
      versao_matcher: this.versaoMatcher, auditado_em })
  }
}

// ─── Helpers de montagem de resultado ────────────────────────────────────────

function _resultado({ encontrado, status, score, nivel, metodo, eq, ambiguidades, camadasAvaliadas, versao_matcher, auditado_em }) {
  return {
    encontrado,
    status,                                                       // 'equipamento_encontrado' | 'equipamento_ambiguo' | 'datasheet_necessario'
    score_match:            parseFloat(score.toFixed(3)),
    nivel_confianca:        nivel,                                // 'ALTO' | 'MEDIO' | 'BAIXO'
    metodo_match:           metodo,
    tipo_equipamento:       eq?.tipoEquipamento ?? null,
    fabricante_normalizado: eq ? _marca(eq) : null,
    modelo_normalizado:     eq?.modelo        ?? null,
    equipamento_id:         eq?.id            ?? null,
    potencia_w:             eq ? _potenciaW(eq) : null,           // sempre em W
    // Objeto completo do catálogo — evita segundo lookup no DatasheetPipelineService
    // null quando não encontrado (status ≠ equipamento_encontrado)
    dados_catalogados:      eq ?? null,
    ambiguidades,
    camadas_avaliadas:      camadasAvaliadas,
    versao_matcher,
    auditado_em,
  }
}

function _resumoAmbiguidade(c) {
  return {
    id:         c.eq.id ?? null,
    fabricante: _marca(c.eq),
    modelo:     c.eq.modelo,
    potencia_w: _potenciaW(c.eq),
    score:      parseFloat(c.score.toFixed(3)),
  }
}

// ─── Helper de parsing de potência de entrada ────────────────────────────────

/**
 * Converte a potência de entrada para Watts.
 * Aceita: número, "550", "550W", "550wp", "5kW", "5.5kw"
 */
function _parsePotenciaInputW(raw) {
  if (raw === null || raw === undefined || raw === '') return NaN
  if (typeof raw === 'number') return raw
  const str = raw.toString().trim()
  const kw = str.match(/^(\d+(?:[.,]\d+)?)\s*kw/i)
  if (kw) return parseFloat(kw[1].replace(',', '.')) * 1000
  const w = str.match(/^(\d+(?:[.,]\d+)?)\s*(?:w|wp)\b/i)
  if (w) return parseFloat(w[1].replace(',', '.'))
  const num = parseFloat(str.replace(',', '.'))
  return isNaN(num) ? NaN : num
}

// ─── Instância singleton (compatibilidade com callers que fazem import default) ──

export default new EquipamentoMatcherService()
