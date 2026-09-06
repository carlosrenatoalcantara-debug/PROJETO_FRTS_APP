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

// ─── Fonte única das regras elétricas (FV-DOM-025) ───────────────────────────
//
// As fórmulas normativas deixaram de viver aqui. Este service passou a ser
// ADAPTER: resolve clima, valida entradas, compõe as primitivas canônicas e
// traduz o resultado em diagnósticos. Nenhuma correção térmica é escrita neste
// arquivo — a FV-DOM-023 mediu três implementações discordando entre si, e esta
// era uma delas.
import {
  TEMP_STC_C,
  NOCT_PADRAO_C,
  FATOR_ISC_NBR16690,
  correnteProjeto,
} from '@fortesolar/fv-shared/engenharia/normativa'
// F1: a classificação de corrente CC é uma implementação só, no domínio — este
// service e o wizard legado a consomem, em vez de cada um ter a sua.
import { classificarCorrenteCC } from '@fortesolar/fv-shared/engenharia/classificacao-corrente-cc'
// F2: tensao e oversizing seguem o mesmo caminho da corrente — uma
// implementacao no dominio, consumida pelo motor e pelo wizard legado.
import { classificarTensaoCC, MARGEM_ATENCAO_TENSAO } from '@fortesolar/fv-shared/engenharia/classificacao-tensao-cc'
import { classificarOversizing, LIMITE_CRITICO_CC_CA } from '@fortesolar/fv-shared/engenharia/classificacao-oversizing'

// ─── Constantes normativas ────────────────────────────────────────────────────

/** Limite oversizing CC/CA → WARNING */
/**
 * Vocabulário de classificação, único no sistema.
 *
 * `ok_parcial` existe para não empatar dois estados diferentes: um arranjo sem
 * nenhuma ressalva e um arranjo que passou em tudo o que era avaliável mas teve
 * critério sem dado. Chamar os dois de `ok` é como a ausência de limite de
 * curto-circuito virava aprovação silenciosa.
 */
export const STATUS_CRITERIO = Object.freeze({
  OK:           'ok',
  OK_PARCIAL:   'ok_parcial',
  ATENCAO:      'atencao',
  INCOMPATIVEL: 'incompativel',
  NAO_AVALIADO: 'nao_avaliado',
})

/**
 * F2 — os limites deixaram de ser declarados aqui. Cada número passou a morar
 * junto da regra que o usa, no domínio, e este módulo apenas o reexporta para
 * quem já o consumia (`optimizerArranjoFVService`, painéis, testes).
 *
 * `OVERSIZING_LIMITE_WARNING` (1,30×) sumiu por não ter dono: era um default de
 * fabricante que nenhum fabricante declarou. Ver `classificacaoOversizing`.
 */
const OVERSIZING_LIMITE_ERRO = LIMITE_CRITICO_CC_CA

/** Margem de atenção para Voc e Vmpp próximos do limite (5 %) — do domínio. */
const VOC_MARGEM_ATENCAO_PCT  = MARGEM_ATENCAO_TENSAO
const MPPT_MARGEM_ATENCAO_PCT = MARGEM_ATENCAO_TENSAO

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

// FV-DOM-025 (Q4): `normalizarCoefTemp` e `tCelula` viviam aqui, duplicando o
// que `fv-shared/engenharia/normativa` já fazia. Foram substituídas por
// `coefParaFracao` e `temperaturaCelula`, importadas no topo. A heurística de
// unidade é a MESMA (|coef| > 0,1 → %/°C), agora num ponto só do sistema.
//
// Única mudança de comportamento: o NOCT padrão passou de 45 para 44 °C — Q5,
// alinhado ao canônico. Afeta apenas módulos que não declaram NOCT.

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
  /**
   * Critérios que NÃO puderam ser avaliados por falta de dado declarado.
   * Terceiro estado, ao lado de erro e aviso: sem ele, "não sei" viraria "ok" —
   * que é exatamente o que a ausência do limite de curto-circuito produzia.
   */
  const naoAvaliados = []

  // ── 3. Extrai parâmetros normalizados ───────────────────────────────────────

  const {
    voc, vmpp, isc, impp, potencia_w,
    coef_temp_voc:  _coefVoc,
    coef_temp_vmpp: _coefVmpp,
    temp_noct = NOCT_PADRAO_C,   // Q5 (FV-DOM-024): 44 °C canônico, era 45
  } = dados_eletricos_modulo

  const {
    tensao_max_entrada,
    mppt_min,
    mppt_max,
    /**
     * Limite de corrente de TRABALHO da entrada MPPT (`corrente_max_por_mppt`
     * no SSOT). É o quanto a entrada opera continuamente — NÃO é o limite de
     * curto-circuito, e a distinção é o objeto desta correção.
     */
    corrente_max_mppt,
    /**
     * Limite de corrente de CURTO-CIRCUITO da entrada (`corrente_isc_max` no
     * SSOT). Grandeza diferente da anterior e declarada separadamente pelo
     * fabricante: dos 19 inversores do catálogo que declaram as duas, os 19
     * têm valores diferentes (ex.: Kehua SP13000-B2 → trabalho 13 A, curto
     * 16,9 A). Ausente ⇒ o critério de curto fica `nao_avaliado`; nunca se
     * substitui um limite pelo outro.
     */
    corrente_isc_max_mppt,
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

  // F2: a conversão de unidade (Q4) e o fallback de `coef_temp_vmpp` (Q2)
  // passaram para `classificarTensaoCC`, que recebe os coeficientes crus.

  // Limites do inversor (para o output). F2: `null` quando o catálogo não
  // declara o limite do fabricante — sem default, o critério vira `nao_avaliado`.
  const limiteOversizing = oversizing_max_fabricante ?? null

  const limites = {
    tensao_max_inversor: tensao_max_entrada,
    faixa_mppt_min:      mppt_min,
    faixa_mppt_max:      mppt_max,
    corrente_max_mppt,
    corrente_isc_max_mppt: corrente_isc_max_mppt ?? null,
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
  // VERIFICAÇÕES 1 e 2 — tensão CC (Voc no frio e janela MPPT)
  // ════════════════════════════════════════════════════════════════════════════
  //
  // F2: a REGRA de tensão mora em `classificarTensaoCC`, no domínio, e é a mesma
  // função que o wizard consome no navegador. Aqui o service só decide qual
  // mensagem emitir para cada veredito — não recompara limites.
  //
  // No frio, o Voc AUMENTA porque coef_temp_voc < 0 e ΔT < 0 → produto positivo.
  // T_cel_frio ≈ T_amb_min: no frio, sem sol, sem aquecimento por NOCT.
  // No calor, Vmpp CAI, e o pior caso do piso do MPPT usa temperatura de célula.
  //
  const tensao = classificarTensaoCC({
    voc, vmpp, coefTempVoc: _coefVoc, coefTempVmpp: _coefVmpp,
    tempNoct: temp_noct, modulosPorString: modulos_por_string,
    tensaoMaxEntrada: tensao_max_entrada, mpptMin: mppt_min, mpptMax: mppt_max,
    tMin: t_min, tMax: t_max,
  })

  const {
    voc_corrigido_frio, vmpp_corrigido_frio, vmpp_corrigido_quente,
    voc_string_max, vmpp_string_frio, vmpp_string_quente,
    t_cel_max, delta_frio: deltaT_frio, delta_quente: deltaT_quente,
  } = tensao.tensoes

  // Warning: próximo ao limite (dentro da margem de 5%)
  if (tensao.voc.status === STATUS_CRITERIO.ATENCAO) {
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
  if (tensao.voc.status === STATUS_CRITERIO.INCOMPATIVEL) {
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

  // Janela MPPT — dois cenários independentes, ambos já classificados acima:
  //  a) Frio → Vmpp alto → risco de ultrapassar MPPT_max (string longa demais)
  //  b) Quente → Vmpp baixo → risco de cair abaixo de MPPT_min (string curta)
  //
  // a) String longa demais (Vmpp_frio > MPPT_max)
  if (tensao.mppt_max.status === STATUS_CRITERIO.INCOMPATIVEL) {
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
  } else if (tensao.mppt_max.status === STATUS_CRITERIO.ATENCAO) {
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
  if (tensao.mppt_min.status === STATUS_CRITERIO.INCOMPATIVEL) {
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
  // ── QUATRO GRANDEZAS, QUATRO PAPÉIS ─────────────────────────────────────────
  //
  // A versão anterior comparava UMA corrente contra UM limite e reprovava:
  //
  //     Isc × 1,25 > corrente_max_mppt  →  CORRENTE_ISC_EXCEDIDA (crítico)
  //
  // Duas coisas diferentes estavam do mesmo lado dessa conta. `Isc × 1,25` é a
  // corrente de PROJETO da NBR 16690 §5.2 — a que o CONDUTOR e a proteção têm
  // de suportar. `corrente_max_mppt` é a corrente de TRABALHO da entrada. E o
  // limite que de fato diz se a entrada aguenta o módulo é um terceiro campo,
  // `corrente_isc_max`, que o fabricante declara à parte — dos 19 inversores do
  // catálogo que declaram os dois, os 19 têm valores diferentes.
  //
  // Resultado: módulos eram reprovados por ultrapassar um limite que não é o
  // limite deles. A separação abaixo é a correção, e cada comparação passou a
  // ter o par certo:
  //
  //   isc_operacao  = Isc × strings          × corrente_isc_max_mppt   → ERRO
  //   impp_total    = Impp × strings         × corrente_max_mppt       → ATENÇÃO
  //   isc_total     = Isc × strings × 1,25   × corrente_max_mppt       → ATENÇÃO
  //
  // O fator 1,25 NÃO foi removido: ele continua sendo a corrente de projeto que
  // dimensiona cabo e proteção (`selecionarCabo`, `correnteProjeto`) e continua
  // reportado em `calculos.isc_total`. O que mudou é que ele deixou de ser o
  // critério de reprovação contra o limite errado.
  //
  // F1: a classificação em si saiu daqui e virou `classificarCorrenteCC`, no
  // domínio — o wizard legado precisa do MESMO veredito por MPPT, no navegador,
  // e repetir as comparações lá foi o que produziu dois vereditos divergentes.
  // Este bloco continua sendo o dono das MENSAGENS; a decisão vem de lá.
  const corrente = classificarCorrenteCC({
    isc, impp, strings: strings_paralelo,
    limiteTrabalho: corrente_max_mppt, limiteCurto: corrente_isc_max_mppt,
  })
  const isc_operacao = corrente.curto_circuito.isc_operacao
  const isc_total    = corrente.projeto_normativa.isc_total
  const impp_total   = corrente.operacao.impp_total

  const temLimiteCurto = corrente.curto_circuito.limite_a !== null

  // ── Limite ABSOLUTO: curto-circuito. Único critério de corrente que reprova ──
  if (corrente.curto_circuito.status === STATUS_CRITERIO.INCOMPATIVEL) {
    const excesso = r(isc_operacao - corrente_isc_max_mppt, 3)
    erros.push({
      codigo:           'CORRENTE_ISC_EXCEDIDA',
      severidade:       'critico',
      nivel:            'critico',
      mensagem:         `CORRENTE DE CURTO-CIRCUITO EXCEDIDA: Isc do arranjo (${isc_operacao} A = ` +
                        `${isc} A × ${strings_paralelo} string(s)) excede a corrente máxima de ` +
                        `curto-circuito declarada pelo fabricante (${corrente_isc_max_mppt} A) em ` +
                        `${excesso} A. Limite absoluto da entrada — reduza strings em paralelo ` +
                        `ou escolha outro módulo.`,
      explicacao_curta: 'Isc do módulo excede o limite de curto-circuito do inversor.',
      valores:          { isc_operacao, corrente_isc_max_mppt, excesso_a: excesso,
                          strings_paralelo, isc_modulo: isc },
    })
  }

  // ── Corrente de OPERAÇÃO acima do limite de trabalho: atenção, não bloqueio ──
  if (corrente.operacao.status === STATUS_CRITERIO.ATENCAO) {
    warnings.push({
      codigo:           'CORRENTE_IMPP_ELEVADA',
      severidade:       'alerta',
      nivel:            'atencao',
      mensagem:         `A corrente de operação do módulo (Impp ${impp_total} A = ${impp} A × ` +
                        `${strings_paralelo} string(s)) excede a corrente máxima de entrada ` +
                        `declarada pelo fabricante para a entrada (${corrente_max_mppt} A). O inversor ` +
                        `limitará a corrente e haverá perda de geração nos picos; não é ` +
                        `impedimento elétrico. Monitore a temperatura dos condutores.`,
      explicacao_curta: 'Corrente de operação acima da corrente máxima de trabalho.',
      valores:          { impp_total, impp_modulo: impp, corrente_max_mppt,
                          excesso_a: r(impp_total - corrente_max_mppt, 3), strings_paralelo },
    })
  }

  // ── Corrente de PROJETO acima do limite de trabalho: informação normativa ────
  // Era exatamente esta comparação que reprovava. Continua sendo feita e dita,
  // porque dimensiona condutor e proteção — mas não decide compatibilidade.
  if (corrente.projeto_normativa.acima_do_trabalho === true) {
    warnings.push({
      codigo:           'CORRENTE_PROJETO_ACIMA_DO_TRABALHO',
      severidade:       'alerta',
      nivel:            'atencao',
      mensagem:         `Corrente de projeto (${isc_total} A = ${isc} A × ${strings_paralelo} ` +
                        `string(s) × ${FATOR_ISC_NBR16690}, NBR 16690 §5.2) acima da corrente ` +
                        `máxima de trabalho da entrada (${corrente_max_mppt} A). É a corrente que ` +
                        `o CONDUTOR e a proteção devem suportar, não um limite do inversor — ` +
                        `dimensione cabo e proteção por ela.`,
      explicacao_curta: 'Corrente de projeto normativa acima da corrente de trabalho.',
      valores:          { isc_total, corrente_max_mppt, isc_modulo: isc,
                          fator_seguranca: FATOR_ISC_NBR16690, norma: 'NBR 16690 §5.2' },
    })
  }

  // ── Sem limite de curto declarado: o critério não é avaliado, e isso é dito ──
  if (!temLimiteCurto) {
    naoAvaliados.push({
      criterio:  'corrente_curto_circuito',
      motivo:    'O catálogo não declara `corrente_isc_max` para este inversor. ' +
                 'Sem o limite de curto-circuito, o critério não é avaliado — a ' +
                 'corrente de trabalho NÃO é usada no lugar dele.',
      valores:   { isc_operacao, isc_modulo: isc, strings_paralelo },
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

  // F2: a regra mora em `classificarOversizing`, no domínio, e distingue o teto
  // de SEGURANÇA do sistema (1,50×) do limite do FABRICANTE (`oversizing_max`).
  // Sem o segundo, o critério fica `nao_avaliado` — nenhum limite é assumido.
  const oversizing = classificarOversizing({
    potenciaCcKwp: potencia_cc_total,
    potenciaCaKw:  potencia_ca_kw,
    limiteFabricante: limiteOversizing,
  })
  const fator_oversizing = oversizing.fator

  if (oversizing.status === STATUS_CRITERIO.INCOMPATIVEL) {
    erros.push({
      codigo:           'OVERSIZING_CRITICO',
      severidade:       'critico',
      nivel:            'critico',
      mensagem:         `OVERSIZING EXCESSIVO: Fator CC/CA (${fator_oversizing.toFixed(2)}×) excede ` +
                        `o limite crítico de ${LIMITE_CRITICO_CC_CA.toFixed(2)}×. ` +
                        `Risco de sobrecarga e dano ao inversor.`,
      explicacao_curta: 'Proporção CC/CA excessiva — risco de sobrecarga térmica no inversor.',
      valores:          { fator_oversizing, limite_critico: LIMITE_CRITICO_CC_CA,
                          potencia_cc_kwp: potencia_cc_total, potencia_ca_kw },
    })
  } else if (oversizing.status === STATUS_CRITERIO.ATENCAO) {
    warnings.push({
      codigo:           'OVERSIZING_ELEVADO',
      severidade:       'alerta',
      nivel:            'atencao',
      mensagem:         `Oversizing CC/CA (${fator_oversizing.toFixed(2)}×) acima de ` +
                        `${(oversizing.limite_fabricante * 100).toFixed(0)}%. Verifique aceite do fabricante.`,
      explicacao_curta: 'Oversizing acima do recomendado — verificar aceite do fabricante.',
      valores:          { fator_oversizing, limite_recomendado: oversizing.limite_fabricante,
                          potencia_cc_kwp: potencia_cc_total, potencia_ca_kw },
    })
  } else if (oversizing.status === STATUS_CRITERIO.NAO_AVALIADO) {
    naoAvaliados.push({
      criterio: 'oversizing_fabricante',
      motivo:   oversizing.motivo,
      valores:  { fator_oversizing, limite_critico: LIMITE_CRITICO_CC_CA,
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
  const margem_oversizing_percentual = fator_oversizing === null
    ? null : r((fator_oversizing / OVERSIZING_LIMITE_ERRO) * 100, 2)

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

    // Verificação 3 — Correntes. Três números distintos, nomeados:
    //   `isc_operacao` Isc × strings          — comparado ao limite de CURTO
    //   `isc_total`    Isc × strings × 1,25   — corrente de PROJETO (condutor)
    //   `impp_total`   Impp × strings         — corrente de OPERAÇÃO
    isc_operacao,
    isc_total,
    isc_fator_seguranca: FATOR_ISC_NBR16690,
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

  /**
   * Classificação de corrente, por critério e com os valores medidos à vista.
   * A UX não precisa reconstruir nada nem interpretar códigos.
   */
  const avaliacao_corrente = {
    operacao: corrente_max_mppt == null || !isFinite(corrente_max_mppt)
      ? { status: STATUS_CRITERIO.NAO_AVALIADO, impp_total, limite_a: null,
          motivo: 'O catálogo não declara a corrente máxima de trabalho da entrada.' }
      : { status: impp_total > corrente_max_mppt ? STATUS_CRITERIO.ATENCAO : STATUS_CRITERIO.OK,
          impp_total, limite_a: corrente_max_mppt,
          margem_a: r(corrente_max_mppt - impp_total, 3), motivo: null },
    curto_circuito: !temLimiteCurto
      ? { status: STATUS_CRITERIO.NAO_AVALIADO, isc_operacao, limite_a: null,
          motivo: 'O catálogo não declara `corrente_isc_max` para este inversor.' }
      : { status: isc_operacao > corrente_isc_max_mppt
            ? STATUS_CRITERIO.INCOMPATIVEL : STATUS_CRITERIO.OK,
          isc_operacao, limite_a: corrente_isc_max_mppt,
          margem_a: r(corrente_isc_max_mppt - isc_operacao, 3), motivo: null },
    projeto_normativa: {
      isc_total, fator: FATOR_ISC_NBR16690, norma: 'NBR 16690 §5.2',
      limite_trabalho_a: corrente_max_mppt ?? null,
      acima_do_trabalho: corrente_max_mppt != null && isFinite(corrente_max_mppt)
        ? isc_total > corrente_max_mppt : null,
      // Explicitamente NÃO é critério de compatibilidade.
      decide_compatibilidade: false,
    },
  }

  /**
   * `status` é aditivo: `compativel` continua sendo `erros.length === 0`, e
   * nenhum consumidor existente muda de comportamento. O que ele acrescenta é a
   * distinção entre "passou limpo" e "passou com condição técnica relevante",
   * que antes se perdia porque avisos e erros caíam no mesmo booleano.
   */
  const status = erros.length > 0
    ? STATUS_CRITERIO.INCOMPATIVEL
    : warnings.length > 0
      ? STATUS_CRITERIO.ATENCAO
      : naoAvaliados.length > 0
        ? STATUS_CRITERIO.OK_PARCIAL
        : STATUS_CRITERIO.OK

  return {
    compativel: erros.length === 0,
    status,
    avaliacao_corrente,
    nao_avaliados: naoAvaliados,
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
  OVERSIZING_LIMITE_ERRO,
  MPPT_MARGEM_ATENCAO_PCT,
  VOC_MARGEM_ATENCAO_PCT,
})
