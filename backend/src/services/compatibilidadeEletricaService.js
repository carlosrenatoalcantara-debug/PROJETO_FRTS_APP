/**
 * compatibilidadeEletricaService.js — S2.10.1 rev. clima dinâmico + S2.11 diagnósticos
 *
 * Motor de compatibilidade elétrica fotovoltaica com adaptação climática por região.
 *
 * ── Responsabilidade ────────────────────────────────────────────────────────
 * Validar matematicamente se uma combinação de:
 *   módulo + inversor + arranjo elétrico + clima local
 * é eletricamente segura.
 *
 * ── Garantias arquiteturais ──────────────────────────────────────────────────
 *  ✔ 100% read-only — zero escrita em banco, zero I/O externo
 *  ✔ Zero side-effects — função pura, saída determinística
 *  ✔ Zero acoplamento — sem mongoose, express, controller, frontend
 *  ✔ Additive only — não altera nenhum módulo existente
 *  ✔ Stateless — nenhum estado global mutável
 *  ✔ Nunca quebra — fallback climático conservador se dados ausentes/inválidos
 *
 * ── Estrutura de diagnósticos (S2.11) ────────────────────────────────────────
 * Todos os objetos em erros[] e warnings[] seguem o contrato:
 *   {
 *     codigo:          string   — identificador único do diagnóstico
 *     severidade:      'critico' | 'alerta' | 'recomendacao'
 *     nivel:           string   — mantido para retrocompatibilidade
 *     mensagem:        string   — descrição técnica completa
 *     explicacao_curta: string  — frase curta para painel visual
 *     valores:         object   — dados numéricos do cálculo
 *   }
 *
 * ── Física aplicada ─────────────────────────────────────────────────────────
 * Normas seguidas:
 *  - IEC 61215:  Módulos FV — coeficientes térmicos e condições de teste
 *  - IEC 62109-1: Segurança de conversores FV (dimensionamento CC)
 *  - NBR 16690:  Instalações elétricas de sistemas FV — ABNT, Brasil
 *
 * Temperatura de célula em campo — modelo NOCT (IEC 61215 §11.6):
 *   T_cel = T_amb + (NOCT − 20°C) × (G_campo / G_NOCT_ref)
 *   G_NOCT_ref = 800 W/m²;  a G = 1000 W/m² (STC):
 *   → T_cel = T_amb + (NOCT − 20) × 1.25
 *
 * Correção térmica de tensão (linear, IEC 61215):
 *   V_corr(T) = V_STC × [1 + α × (T_cel − T_STC)]
 *   T_STC = 25 °C
 *
 * Estratégia de temperatura — pior caso por grandeza:
 *   Voc_max  → T_cel mínima ≈ T_amb_min  (frio → Voc sobe → risco sobretensão)
 *   Vmpp_min → T_cel máxima via NOCT       (calor → Vmpp cai → risco MPPT_min)
 */

// ─── Constantes normativas ────────────────────────────────────────────────────

/** Temperatura STC (Standard Test Conditions) — °C */
const TEMP_STC_C = 25

/** Irradiância de referência NOCT — W/m² */
const G_NOCT_REF = 800

/** Irradiância STC — W/m² */
const G_STC = 1000

/** Limite oversizing CC/CA → WARNING */
const OVERSIZING_LIMITE_WARNING = 1.30

/** Limite oversizing CC/CA → ERRO CRÍTICO */
const OVERSIZING_LIMITE_ERRO = 1.50

/** Margem de atenção para Voc próximo do limite (5%) */
const VOC_MARGEM_ATENCAO_PCT = 0.05

/** Margem de atenção para Vmpp próximo do limite MPPT (5%) */
const MPPT_MARGEM_ATENCAO_PCT = 0.05

// ─── Fallback climático conservador ──────────────────────────────────────────
/**
 * Fallback normativo brasileiro.
 * Usado quando `dados_climaticos_regiao` está ausente, incompleto ou inválido.
 *
 * Valores conservadores:
 *  - Tmin = 10 °C → cobre a maioria das regiões sul/sudeste no inverno
 *  - Tmax = 40 °C → cobre o nordeste e interior no verão
 *
 * Garante que o motor NUNCA quebra e SEMPRE usa validação segura.
 */
export const CLIMA_FALLBACK_BRASIL = Object.freeze({
  temperatura_min_historica_c: 10,
  temperatura_max_historica_c: 40,
  cidade:  null,
  uf:      null,
  fonte:   'fallback_normativo_br',
})

// ─── Helpers matemáticos ──────────────────────────────────────────────────────

/**
 * Arredonda para N casas decimais.
 * @param {number} v
 * @param {number} [n=3]
 */
function r(v, n = 3) {
  const f = 10 ** n
  return Math.round(v * f) / f
}

/**
 * Normaliza coeficiente de temperatura para fração/°C.
 *
 * Datasheets reportam em duas formas:
 *  a) %/°C  → ex: -0.28  (−0.28% por grau) → dividir por 100
 *  b) 1/°C  → ex: -0.0028 (fração absoluta) → usar direto
 *
 * Heurística: |coef| > 0.1 → assumir %/°C.
 *
 * @param {number} coef
 * @returns {number} coef em 1/°C
 */
function normalizarCoefTemp(coef) {
  return Math.abs(coef) > 0.1 ? coef / 100 : coef
}

/**
 * Calcula temperatura de célula em campo pelo modelo NOCT.
 *
 * @param {number} t_amb   Temperatura ambiente (°C)
 * @param {number} noct    NOCT do módulo (°C), default 45
 * @returns {number}       Temperatura de célula (°C)
 */
function tCelula(t_amb, noct = 45) {
  return t_amb + (noct - 20) * (G_STC / G_NOCT_REF)
}

// ─── Validação e normalização do clima ───────────────────────────────────────

/**
 * Valida e normaliza os dados climáticos da região.
 * Retorna o clima a ser usado e um flag indicando se foi necessário fallback.
 *
 * Um clima é considerado inválido/incompleto quando:
 *  - O objeto está ausente ou não é um objeto
 *  - temperatura_min_historica_c ou temperatura_max_historica_c ausente / não-finito
 *  - min >= max (fisicamente impossível)
 *  - Valores fora do intervalo razoável para o Brasil (-30 °C a 55 °C)
 *
 * @param {object|null|undefined} dadosClimaticos
 * @returns {{ clima: object, usou_fallback: boolean, motivo_fallback: string|null }}
 */
function resolverClima(dadosClimaticos) {
  const d = dadosClimaticos

  const invalido = (motivo) => ({
    clima: { ...CLIMA_FALLBACK_BRASIL },
    usou_fallback:   true,
    motivo_fallback: motivo,
  })

  if (!d || typeof d !== 'object' || Array.isArray(d)) {
    return invalido('dados_climaticos_regiao ausente ou não é um objeto')
  }

  const min = d.temperatura_min_historica_c
  const max = d.temperatura_max_historica_c

  if (min === undefined || min === null || !isFinite(min)) {
    return invalido('temperatura_min_historica_c ausente ou inválida')
  }
  if (max === undefined || max === null || !isFinite(max)) {
    return invalido('temperatura_max_historica_c ausente ou inválida')
  }
  if (min >= max) {
    return invalido(`temperatura_min (${min}) deve ser menor que temperatura_max (${max})`)
  }
  if (min < -30 || max > 55) {
    return invalido(`temperaturas fora do intervalo razoável para o Brasil (${min}–${max} °C)`)
  }

  return {
    clima: {
      temperatura_min_historica_c: min,
      temperatura_max_historica_c: max,
      cidade: d.cidade   || null,
      uf:     d.uf       || null,
      fonte:  'dados_regiao',
    },
    usou_fallback:   false,
    motivo_fallback: null,
  }
}

// ─── Validação de inputs elétricos ───────────────────────────────────────────

/**
 * Valida parâmetros elétricos obrigatórios.
 * @returns {string[]} Lista de problemas (vazio = ok)
 */
function validarInputsEletricos(modulo, inversor, arranjo) {
  const problemas = []

  const pos = (obj, nome, campos) => {
    for (const c of campos) {
      const v = obj?.[c]
      if (v === undefined || v === null || !isFinite(v) || v <= 0) {
        problemas.push(`${nome}.${c} deve ser número positivo (recebido: ${v})`)
      }
    }
  }
  const num = (obj, nome, campos) => {
    for (const c of campos) {
      const v = obj?.[c]
      if (v === undefined || v === null || !isFinite(v)) {
        problemas.push(`${nome}.${c} deve ser número finito (recebido: ${v})`)
      }
    }
  }

  pos(modulo,  'dados_eletricos_modulo',   ['voc', 'vmpp', 'isc', 'impp', 'potencia_w'])
  num(modulo,  'dados_eletricos_modulo',   ['coef_temp_voc'])
  pos(inversor,'dados_eletricos_inversor', ['tensao_max_entrada', 'mppt_min', 'mppt_max',
                                             'corrente_max_mppt', 'potencia_ca_kw'])
  pos(arranjo, 'arranjo_proposto',         ['quantidade_modulos_por_string',
                                             'quantidade_strings_paralelo'])

  if (modulo && modulo.vmpp >= modulo.voc) {
    problemas.push('dados_eletricos_modulo.vmpp deve ser menor que voc (relação física)')
  }
  if (inversor && inversor.mppt_min >= inversor.mppt_max) {
    problemas.push('dados_eletricos_inversor.mppt_min deve ser menor que mppt_max')
  }

  return problemas
}

// ─── Motor principal ──────────────────────────────────────────────────────────

/**
 * Analisa a compatibilidade elétrica de uma combinação FV com clima regional.
 *
 * Realiza 4 verificações em cascata, usando o pior caso de temperatura para cada:
 *  1. Sobretensão Voc (T_min → Voc máximo → risco inversor)
 *  2. Janela MPPT    (T_min → Vmpp_frio_max; T_max+NOCT → Vmpp_quente_min)
 *  3. Correntes      (Isc × strings paralelas ≤ corrente_max_MPPT)
 *  4. Oversizing     (P_CC / P_CA ≤ limites normativos)
 *
 * Se dados climáticos estiverem ausentes/inválidos, aplica CLIMA_FALLBACK_BRASIL
 * automaticamente (Tmin=10°C, Tmax=40°C) para garantir validação conservadora.
 *
 * @param {object} params
 * @param {ModuloEletrico}    params.dados_eletricos_modulo
 * @param {InversorEletrico}  params.dados_eletricos_inversor
 * @param {ArranjoConfig}     params.arranjo_proposto
 * @param {ClimaRegiao}       params.dados_climaticos_regiao
 * @returns {ResultadoCompatibilidade}
 *
 * @typedef {object} ModuloEletrico
 * @property {number}  voc              Tensão circuito aberto STC (V)
 * @property {number}  vmpp             Tensão máx. potência STC (V)
 * @property {number}  isc              Corrente curto-circuito STC (A)
 * @property {number}  impp             Corrente máx. potência STC (A)
 * @property {number}  potencia_w       Potência pico STC (W)
 * @property {number}  coef_temp_voc    Coef. temp. Voc (%/°C ou 1/°C)
 * @property {number}  [coef_temp_vmpp] Coef. temp. Vmpp — default: coef_temp_voc
 * @property {number}  [temp_noct]      NOCT do módulo (°C) — default: 45
 *
 * @typedef {object} InversorEletrico
 * @property {number}  tensao_max_entrada     Tensão CC máxima (V)
 * @property {number}  mppt_min               Tensão mínima MPPT (V)
 * @property {number}  mppt_max               Tensão máxima MPPT (V)
 * @property {number}  corrente_max_mppt      Corrente máxima por MPPT (A)
 * @property {number}  [corrente_max_entrada] Corrente CC total máxima (A)
 * @property {number}  potencia_ca_kw         Potência CA nominal (kW)
 * @property {number}  [oversizing_max_fabricante] Oversizing máx. fabricante
 *
 * @typedef {object} ArranjoConfig
 * @property {number}  quantidade_modulos_por_string  Módulos em série por string
 * @property {number}  quantidade_strings_paralelo    Strings em paralelo (por MPPT)
 * @property {number}  [num_mppt_usados]              MPPTs utilizados — default: 1
 *
 * @typedef {object} ClimaRegiao
 * @property {number}  temperatura_min_historica_c
 * @property {number}  temperatura_max_historica_c
 * @property {string}  [cidade]
 * @property {string}  [uf]
 *
 * @typedef {object} ResultadoCompatibilidade
 * @property {boolean}          compativel
 * @property {Diagnostico[]}    warnings
 * @property {Diagnostico[]}    erros
 * @property {object}           limites
 * @property {object}           calculos
 * @property {object}           clima_utilizado
 *
 * @typedef {object} Diagnostico
 * @property {string}  codigo
 * @property {string}  severidade    'critico' | 'alerta' | 'recomendacao'
 * @property {string}  nivel         retrocompatibilidade
 * @property {string}  mensagem
 * @property {string}  explicacao_curta
 * @property {object}  valores
 */
export function analisarCompatibilidade({
  dados_eletricos_modulo,
  dados_eletricos_inversor,
  arranjo_proposto,
  dados_climaticos_regiao,
}) {

  // ── 1. Resolve clima (com fallback automático) ──────────────────────────────
  const { clima, usou_fallback, motivo_fallback } = resolverClima(dados_climaticos_regiao)

  // ── 2. Valida inputs elétricos ──────────────────────────────────────────────
  const inputProblemas = validarInputsEletricos(
    dados_eletricos_modulo,
    dados_eletricos_inversor,
    arranjo_proposto,
  )

  if (inputProblemas.length > 0) {
    return {
      compativel: false,
      warnings:   [],
      erros: [{
        codigo:           'INPUT_INVALIDO',
        severidade:       'critico',
        nivel:            'critico',
        mensagem:         `Parâmetros elétricos inválidos: ${inputProblemas.join('; ')}`,
        explicacao_curta: 'Parâmetros elétricos ausentes ou inválidos impedem a análise.',
        valores:          { problemas: inputProblemas },
      }],
      limites:  {},
      calculos: {},
      clima_utilizado: {
        ...clima,
        usou_fallback,
        motivo_fallback,
      },
    }
  }

  const erros    = []
  const warnings = []

  // ── 3. Extrai parâmetros normalizados ───────────────────────────────────────

  const {
    voc, vmpp, isc, impp, potencia_w,
    coef_temp_voc:  _coefVoc,
    coef_temp_vmpp: _coefVmpp,
    temp_noct = 45,
  } = dados_eletricos_modulo

  const {
    tensao_max_entrada,
    mppt_min,
    mppt_max,
    corrente_max_mppt,
    corrente_max_entrada,
    potencia_ca_kw,
    oversizing_max_fabricante,
  } = dados_eletricos_inversor

  const {
    quantidade_modulos_por_string: modulos_por_string,
    quantidade_strings_paralelo:   strings_paralelo,
    num_mppt_usados = 1,
  } = arranjo_proposto

  const { temperatura_min_historica_c: t_min, temperatura_max_historica_c: t_max } = clima

  // Normaliza coeficientes para fração/°C
  const coefVoc  = normalizarCoefTemp(_coefVoc)
  const coefVmpp = _coefVmpp !== undefined ? normalizarCoefTemp(_coefVmpp) : coefVoc

  // Limites do inversor (para o output)
  const limiteOversizing = oversizing_max_fabricante ?? OVERSIZING_LIMITE_WARNING

  const limites = {
    tensao_max_inversor: tensao_max_entrada,
    faixa_mppt_min:      mppt_min,
    faixa_mppt_max:      mppt_max,
    corrente_max_mppt,
    oversizing_max:      limiteOversizing,
  }

  // ── Warning global se usou fallback climático ───────────────────────────────
  if (usou_fallback) {
    warnings.push({
      codigo:           'CLIMA_FALLBACK_APLICADO',
      severidade:       'recomendacao',
      nivel:            'atencao',
      mensagem:         `Dados climáticos ausentes ou inválidos. Usando fallback conservador nacional ` +
                        `(Tmin=${CLIMA_FALLBACK_BRASIL.temperatura_min_historica_c}°C / ` +
                        `Tmax=${CLIMA_FALLBACK_BRASIL.temperatura_max_historica_c}°C). ` +
                        `Motivo: ${motivo_fallback}`,
      explicacao_curta: 'Sem dados climáticos locais — usando temperaturas conservadoras nacionais.',
      valores:          {
        motivo: motivo_fallback,
        fallback_tmin: CLIMA_FALLBACK_BRASIL.temperatura_min_historica_c,
        fallback_tmax: CLIMA_FALLBACK_BRASIL.temperatura_max_historica_c,
      },
    })
  }

  // ════════════════════════════════════════════════════════════════════════════
  // VERIFICAÇÃO 1 — Correção térmica do Voc
  // ════════════════════════════════════════════════════════════════════════════
  //
  // No frio, o Voc AUMENTA porque coef_temp_voc < 0 e ΔT < 0 → produto positivo.
  // T_cel_frio ≈ T_amb_min: no frio, sem sol, sem aquecimento por NOCT.
  // Este é o pior caso de TENSÃO — determina se o inversor será destruído.
  //
  const deltaT_frio        = t_min - TEMP_STC_C
  const voc_corrigido_frio = r(voc * (1 + coefVoc * deltaT_frio))
  const voc_string_max     = r(voc_corrigido_frio * modulos_por_string, 2)

  // Warning: próximo ao limite (dentro da margem de 5%)
  if (voc_string_max <= tensao_max_entrada &&
      voc_string_max > tensao_max_entrada * (1 - VOC_MARGEM_ATENCAO_PCT)) {
    const margem_pct = r(((tensao_max_entrada - voc_string_max) / tensao_max_entrada) * 100, 1)
    warnings.push({
      codigo:           'VOC_PROXIMO_LIMITE',
      severidade:       'alerta',
      nivel:            'atencao',
      mensagem:         `Voc do string no frio (${voc_string_max} V) está a apenas ${margem_pct}% ` +
                        `abaixo do limite CC máximo do inversor (${tensao_max_entrada} V). ` +
                        `Considere reduzir 1 módulo por string.`,
      explicacao_curta: 'Tensão do string no frio muito próxima ao limite CC do inversor.',
      valores:          { voc_string_max, tensao_max_entrada, margem_pct, t_min },
    })
  }

  // Erro crítico: ultrapassou o limite absoluto
  if (voc_string_max > tensao_max_entrada) {
    const excesso = r(voc_string_max - tensao_max_entrada, 2)
    erros.push({
      codigo:           'SOBRETENSAO_VOC',
      severidade:       'critico',
      nivel:            'critico',
      mensagem:         `SOBRETENSÃO CRÍTICA: Voc do string no frio (${voc_string_max} V) excede ` +
                        `a tensão máxima CC do inversor (${tensao_max_entrada} V) em ${excesso} V. ` +
                        `Risco de destruição imediata do inversor. Reduza módulos por string.`,
      explicacao_curta: 'O frio extremo eleva a tensão Voc acima do limite CC do inversor.',
      valores:          {
        voc_string_max, tensao_max_entrada, excesso_v: excesso,
        modulos_por_string, t_min, voc_corrigido_frio,
      },
    })
  }

  // ════════════════════════════════════════════════════════════════════════════
  // VERIFICAÇÃO 2 — Janela MPPT
  // ════════════════════════════════════════════════════════════════════════════
  //
  // Dois cenários independentes:
  //  a) Frio → Vmpp alto → risco de ultrapassar MPPT_max (string longa demais)
  //  b) Quente → Vmpp baixo → risco de cair abaixo de MPPT_min (string curta)
  //
  // Para (b), usa temperatura de célula real com modelo NOCT — mais conservador.
  //
  const t_cel_max      = tCelula(t_max, temp_noct)
  const deltaT_quente  = t_cel_max - TEMP_STC_C

  const vmpp_corrigido_frio   = r(vmpp * (1 + coefVmpp * deltaT_frio))
  const vmpp_corrigido_quente = r(vmpp * (1 + coefVmpp * deltaT_quente))
  const vmpp_string_frio      = r(vmpp_corrigido_frio   * modulos_por_string, 2)
  const vmpp_string_quente    = r(vmpp_corrigido_quente * modulos_por_string, 2)

  // a) String longa demais (Vmpp_frio > MPPT_max)
  if (vmpp_string_frio > mppt_max) {
    const excesso = r(vmpp_string_frio - mppt_max, 2)
    erros.push({
      codigo:           'MPPT_STRING_LONGA',
      severidade:       'critico',
      nivel:            'critico',
      mensagem:         `STRING LONGA DEMAIS: Vmpp no frio (${vmpp_string_frio} V) excede ` +
                        `o limite máximo de MPPT (${mppt_max} V) em ${excesso} V. ` +
                        `Inversor não rastreará potência máxima em dias frios. Reduza módulos.`,
      explicacao_curta: 'String longa demais: Vmpp no frio ultrapassa o teto do MPPT.',
      valores:          { vmpp_string_frio, mppt_max, excesso_v: excesso, t_min, vmpp_corrigido_frio },
    })
  } else if (vmpp_string_frio > mppt_max * (1 - MPPT_MARGEM_ATENCAO_PCT)) {
    const margem_pct = r(((mppt_max - vmpp_string_frio) / mppt_max) * 100, 1)
    warnings.push({
      codigo:           'MPPT_MARGEM_FRIO_PEQUENA',
      severidade:       'alerta',
      nivel:            'atencao',
      mensagem:         `Vmpp do string no frio (${vmpp_string_frio} V) a apenas ${margem_pct}% ` +
                        `do limite MPPT máximo (${mppt_max} V).`,
      explicacao_curta: 'Vmpp no frio muito próximo ao teto do MPPT — margem pequena.',
      valores:          { vmpp_string_frio, mppt_max, margem_pct },
    })
  }

  // b) String curta demais (Vmpp_quente < MPPT_min)
  if (vmpp_string_quente < mppt_min) {
    const deficit = r(mppt_min - vmpp_string_quente, 2)
    erros.push({
      codigo:           'MPPT_STRING_CURTA',
      severidade:       'critico',
      nivel:            'critico',
      mensagem:         `STRING CURTA DEMAIS: Vmpp no calor (${vmpp_string_quente} V) está ` +
                        `${deficit} V abaixo do mínimo de MPPT (${mppt_min} V). ` +
                        `Inversor não iniciará ou perderá rastreamento em dias quentes. ` +
                        `Aumente módulos por string.`,
      explicacao_curta: 'String curta demais: Vmpp no calor cai abaixo do piso do MPPT.',
      valores:          { vmpp_string_quente, mppt_min, deficit_v: deficit,
                          t_max, t_cel_max: r(t_cel_max, 1), vmpp_corrigido_quente },
    })
  }

  // ════════════════════════════════════════════════════════════════════════════
  // VERIFICAÇÃO 3 — Correntes (strings em paralelo)
  // ════════════════════════════════════════════════════════════════════════════
  //
  // Módulos em série: a corrente não se soma (Isc_string = Isc_modulo)
  // Strings em paralelo: correntes se somam
  // corrente_max_mppt é o limite por MPPT — verificamos por MPPT (strings_paralelo)
  //
  const isc_total  = r(isc  * strings_paralelo)
  const impp_total = r(impp * strings_paralelo)

  if (isc_total > corrente_max_mppt) {
    const excesso = r(isc_total - corrente_max_mppt, 3)
    erros.push({
      codigo:           'CORRENTE_ISC_EXCEDIDA',
      severidade:       'critico',
      nivel:            'critico',
      mensagem:         `CORRENTE EXCEDIDA: Isc total (${isc_total} A) excede ` +
                        `a corrente máxima de entrada MPPT (${corrente_max_mppt} A) em ${excesso} A. ` +
                        `Risco de destruição do MPPT. Reduza strings em paralelo.`,
      explicacao_curta: 'Corrente de curto-circuito total excede o limite do MPPT.',
      valores:          { isc_total, corrente_max_mppt, excesso_a: excesso,
                          strings_paralelo, isc_modulo: isc },
    })
  } else if (impp_total > corrente_max_mppt) {
    warnings.push({
      codigo:           'CORRENTE_IMPP_ELEVADA',
      severidade:       'alerta',
      nivel:            'atencao',
      mensagem:         `Impp total (${impp_total} A) excede a corrente máxima MPPT (${corrente_max_mppt} A). ` +
                        `Isc (${isc_total} A) está no limite. Monitore temperatura dos condutores.`,
      explicacao_curta: 'Corrente de operação próxima ao limite do MPPT — monitorar condutores.',
      valores:          { impp_total, isc_total, corrente_max_mppt },
    })
  }

  // Corrente total de entrada (se o inversor especificou)
  if (corrente_max_entrada != null && isFinite(corrente_max_entrada)) {
    const isc_sistema = r(isc * strings_paralelo * num_mppt_usados)
    if (isc_sistema > corrente_max_entrada) {
      erros.push({
        codigo:           'CORRENTE_ENTRADA_TOTAL_EXCEDIDA',
        severidade:       'critico',
        nivel:            'critico',
        mensagem:         `Isc total do sistema (${isc_sistema} A) excede ` +
                          `a corrente máxima total de entrada (${corrente_max_entrada} A).`,
        explicacao_curta: 'Corrente total do sistema excede o limite de entrada do inversor.',
        valores:          { isc_sistema, corrente_max_entrada },
      })
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // VERIFICAÇÃO 4 — Oversizing CC/CA
  // ════════════════════════════════════════════════════════════════════════════
  //
  // Oversizing ideal: inversor opera mais horas próximo de Pnom.
  // Oversizing excessivo: clipping severo, sobrecarga térmica, dano ao conversor.
  //
  const total_strings     = strings_paralelo * num_mppt_usados
  const total_modulos     = modulos_por_string * total_strings
  const potencia_cc_total = r((potencia_w * total_modulos) / 1000, 3)  // kWp
  const fator_oversizing  = r(potencia_cc_total / potencia_ca_kw, 4)

  if (fator_oversizing > OVERSIZING_LIMITE_ERRO) {
    erros.push({
      codigo:           'OVERSIZING_CRITICO',
      severidade:       'critico',
      nivel:            'critico',
      mensagem:         `OVERSIZING EXCESSIVO: Fator CC/CA (${fator_oversizing.toFixed(2)}×) excede ` +
                        `o limite crítico de ${OVERSIZING_LIMITE_ERRO.toFixed(2)}×. ` +
                        `Risco de sobrecarga e dano ao inversor.`,
      explicacao_curta: 'Proporção CC/CA excessiva — risco de sobrecarga térmica no inversor.',
      valores:          { fator_oversizing, limite_critico: OVERSIZING_LIMITE_ERRO,
                          potencia_cc_kwp: potencia_cc_total, potencia_ca_kw },
    })
  } else if (fator_oversizing > limiteOversizing) {
    warnings.push({
      codigo:           'OVERSIZING_ELEVADO',
      severidade:       'alerta',
      nivel:            'atencao',
      mensagem:         `Oversizing CC/CA (${fator_oversizing.toFixed(2)}×) acima de ` +
                        `${(limiteOversizing * 100).toFixed(0)}%. Verifique aceite do fabricante.`,
      explicacao_curta: 'Oversizing acima do recomendado — verificar aceite do fabricante.',
      valores:          { fator_oversizing, limite_recomendado: limiteOversizing,
                          potencia_cc_kwp: potencia_cc_total, potencia_ca_kw },
    })
  }

  // ── S2.11: Margens percentuais para o painel visual ─────────────────────────
  //
  // Cada margem representa o quanto do limite máximo já está sendo utilizado.
  // Valores > 100 % indicam violação do limite.
  //
  //  tensao:      (Voc_string_max / tensao_max_inversor) × 100
  //  mppt_max:    (Vmpp_string_frio / mppt_max) × 100
  //  mppt_min:    (mppt_min / Vmpp_string_quente) × 100  — > 100 → string curta
  //  oversizing:  (fator_oversizing / OVERSIZING_LIMITE_ERRO) × 100
  //
  const margem_tensao_percentual     = r((voc_string_max / tensao_max_entrada) * 100, 2)
  const margem_mppt_max_percentual   = r((vmpp_string_frio / mppt_max) * 100, 2)
  const margem_mppt_min_percentual   = r((mppt_min / vmpp_string_quente) * 100, 2)
  const margem_oversizing_percentual = r((fator_oversizing / OVERSIZING_LIMITE_ERRO) * 100, 2)

  // ── Resultado ───────────────────────────────────────────────────────────────

  const calculos = {
    // Verificação 1 — Voc
    voc_corrigido_frio,
    voc_string_max,
    delta_temp_frio_c:      r(deltaT_frio, 2),

    // Verificação 2 — MPPT
    vmpp_corrigido_quente,
    vmpp_corrigido_frio,
    vmpp_string_frio,
    vmpp_string_quente,
    t_cel_max_c:            r(t_cel_max, 1),
    delta_temp_quente_c:    r(deltaT_quente, 2),

    // Verificação 3 — Correntes
    isc_total,
    impp_total,

    // Verificação 4 — Oversizing
    potencia_cc_total,
    fator_oversizing,

    // Contexto
    total_modulos,
    total_strings,

    // S2.11 — Margens percentuais para o painel visual
    margem_tensao_percentual,
    margem_mppt_max_percentual,
    margem_mppt_min_percentual,
    margem_oversizing_percentual,
  }

  return {
    compativel: erros.length === 0,
    warnings,
    erros,
    limites,
    calculos,
    clima_utilizado: {
      temperatura_min_c: t_min,
      temperatura_max_c: t_max,
      cidade:            clima.cidade,
      uf:                clima.uf,
      fonte:             clima.fonte,
      usou_fallback,
      ...(motivo_fallback ? { motivo_fallback } : {}),
    },
  }
}

// ─── Exports auxiliares ───────────────────────────────────────────────────────

export const CONSTANTES = Object.freeze({
  TEMP_STC_C,
  OVERSIZING_LIMITE_WARNING,
  OVERSIZING_LIMITE_ERRO,
  MPPT_MARGEM_ATENCAO_PCT,
  VOC_MARGEM_ATENCAO_PCT,
})
