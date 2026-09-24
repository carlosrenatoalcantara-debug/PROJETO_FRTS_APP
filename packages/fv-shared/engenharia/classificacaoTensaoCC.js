/**
 * classificacaoTensaoCC.js — classificação canônica de tensão CC — F2.
 *
 * ── Por que este arquivo existe ──────────────────────────────────────────────
 * Mesmo motivo do `classificacaoCorrenteCC` (F1): a regra nasceu dentro de
 * `analisarCompatibilidade`, no backend, e o wizard legado precisa do MESMO
 * veredito POR MPPT, no navegador. Uma chamada HTTP por MPPT não é caminho, e
 * repetir as comparações no React foi o que produziu dois vereditos divergentes
 * para corrente. A regra sai do service e vira função pura aqui; o service
 * delega e o wizard consome a mesma função.
 *
 * Não é um segundo motor: é a MESMA implementação, agora chamável dos dois lados.
 *
 * ── As três comparações, e o que cada uma decide ─────────────────────────────
 *   Voc no FRIO      × tensão máxima de entrada → INCOMPATÍVEL (destrói o inversor)
 *   Vmpp no FRIO     × MPPT máximo              → INCOMPATÍVEL (string longa demais)
 *   Vmpp no QUENTE   × MPPT mínimo              → INCOMPATÍVEL (string curta demais)
 *
 * Cada uma tem margem de ATENÇÃO a 5 %, que é onde a string ainda passa mas sem
 * folga para o pior ano.
 *
 * ── Frio e quente não são intercambiáveis ────────────────────────────────────
 * Voc e Vmpp SOBEM no frio e CAEM no calor. Por isso o teto (tensão máxima,
 * MPPT máximo) se verifica no FRIO e o piso (MPPT mínimo) no QUENTE. Comparar o
 * Vmpp quente contra o MPPT máximo — como o wizard fazia — nunca acusa a string
 * longa: o valor quente é o menor dos dois, e passa sempre.
 *
 * Toda a física vem de `engenhariaNormativa`. Nada aqui recalcula correção
 * térmica: `fatorTermico`, `temperaturaCelula` e `coefParaFracao` são as
 * primitivas, e a conversão de unidade acontece num ponto só do sistema.
 *
 * Puro: sem I/O, sem React, sem dependência de node.
 */
import {
  TEMP_STC_C, NOCT_PADRAO_C, coefParaFracao, fatorTermico, temperaturaCelula,
} from './engenhariaNormativa.js'

/** Mesmo vocabulário de `classificacaoCorrenteCC` — um nome só por conceito. */
export const STATUS_TENSAO = Object.freeze({
  OK:           'ok',
  ATENCAO:      'atencao',
  INCOMPATIVEL: 'incompativel',
  NAO_AVALIADO: 'nao_avaliado',
})

/** Margem de atenção, em fração — a mesma que o service já aplicava. */
export const MARGEM_ATENCAO_TENSAO = 0.05

function _num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const _r = (v, n = 2) => { const f = 10 ** n; return Math.round(v * f) / f }

/**
 * Tensões da string nas duas condições extremas.
 * Devolve `null` em cada grandeza que não puder ser calculada — nunca um zero.
 */
export function tensoesDaString({
  voc = null, vmpp = null, coefTempVoc = null, coefTempVmpp = undefined,
  tempNoct = NOCT_PADRAO_C, modulosPorString = null, tMin = null, tMax = null,
} = {}) {
  const nVoc = _num(voc)
  const nVmpp = _num(vmpp)
  const n = _num(modulosPorString)
  const tmin = _num(tMin)
  const tmax = _num(tMax)
  const noct = _num(tempNoct) ?? NOCT_PADRAO_C

  // Q4: a conversão de unidade acontece na FRONTEIRA, pela primitiva canônica.
  // Q2: sem coeficiente próprio de Vmpp, o de Voc vale — provisório e declarado.
  const coefVoc = coefTempVoc === null || coefTempVoc === undefined
    ? null : coefParaFracao(coefTempVoc)
  const coefVmpp = coefTempVmpp !== undefined && coefTempVmpp !== null
    ? coefParaFracao(coefTempVmpp) : coefVoc

  if (coefVoc === null || n === null || tmin === null || tmax === null) {
    return {
      voc_string_max: null, vmpp_string_frio: null, vmpp_string_quente: null,
      t_cel_max: null, delta_frio: null,
    }
  }

  const tCelMax = temperaturaCelula(tmax, noct)
  // Valores POR MÓDULO, corrigidos — o consumidor os expõe em `calculos`.
  const vocCorrigidoFrio = nVoc === null ? null : _r(nVoc * fatorTermico(coefVoc, tmin), 3)
  const vmppCorrigidoFrio = nVmpp === null ? null : _r(nVmpp * fatorTermico(coefVmpp, tmin), 3)
  const vmppCorrigidoQuente = nVmpp === null ? null : _r(nVmpp * fatorTermico(coefVmpp, tCelMax), 3)

  return {
    voc_corrigido_frio: vocCorrigidoFrio,
    vmpp_corrigido_frio: vmppCorrigidoFrio,
    vmpp_corrigido_quente: vmppCorrigidoQuente,
    voc_string_max: vocCorrigidoFrio === null ? null : _r(vocCorrigidoFrio * n),
    vmpp_string_frio: vmppCorrigidoFrio === null ? null : _r(vmppCorrigidoFrio * n),
    vmpp_string_quente: vmppCorrigidoQuente === null ? null : _r(vmppCorrigidoQuente * n),
    t_cel_max: _r(tCelMax, 1),
    delta_frio: _r(tmin - TEMP_STC_C, 2),
    delta_quente: _r(tCelMax - TEMP_STC_C, 2),
  }
}

/** Um critério: valor medido contra um teto, com margem de atenção. */
function _contraTeto(valor, limite, rotuloLacuna) {
  if (valor === null || limite === null) {
    return {
      status: STATUS_TENSAO.NAO_AVALIADO, valor_v: valor, limite_v: limite,
      margem_v: null, motivo: `Sem ${rotuloLacuna} não há como avaliar este critério.`,
    }
  }
  if (valor > limite) {
    return {
      status: STATUS_TENSAO.INCOMPATIVEL, valor_v: valor, limite_v: limite,
      margem_v: _r(limite - valor), motivo: null,
    }
  }
  const status = valor > limite * (1 - MARGEM_ATENCAO_TENSAO)
    ? STATUS_TENSAO.ATENCAO : STATUS_TENSAO.OK
  return { status, valor_v: valor, limite_v: limite, margem_v: _r(limite - valor), motivo: null }
}

/** Um critério: valor medido contra um piso, com margem de atenção. */
function _contraPiso(valor, limite, rotuloLacuna) {
  if (valor === null || limite === null) {
    return {
      status: STATUS_TENSAO.NAO_AVALIADO, valor_v: valor, limite_v: limite,
      margem_v: null, motivo: `Sem ${rotuloLacuna} não há como avaliar este critério.`,
    }
  }
  if (valor < limite) {
    return {
      status: STATUS_TENSAO.INCOMPATIVEL, valor_v: valor, limite_v: limite,
      margem_v: _r(valor - limite), motivo: null,
    }
  }
  const status = valor < limite * (1 + MARGEM_ATENCAO_TENSAO)
    ? STATUS_TENSAO.ATENCAO : STATUS_TENSAO.OK
  return { status, valor_v: valor, limite_v: limite, margem_v: _r(valor - limite), motivo: null }
}

/**
 * Classifica a tensão CC de UMA string (ou de uma entrada MPPT).
 *
 * @param {Object} p  módulo, envelope do inversor, agrupamento e clima
 * @returns {{voc, mppt_max, mppt_min, tensoes, status}}
 */
export function classificarTensaoCC({
  voc = null, vmpp = null, coefTempVoc = null, coefTempVmpp = undefined,
  tempNoct = NOCT_PADRAO_C, modulosPorString = null,
  tensaoMaxEntrada = null, mpptMin = null, mpptMax = null,
  tMin = null, tMax = null,
} = {}) {
  const tensoes = tensoesDaString({
    voc, vmpp, coefTempVoc, coefTempVmpp, tempNoct, modulosPorString, tMin, tMax,
  })

  // Teto de tensão: pior caso é o FRIO.
  const criterioVoc = _contraTeto(
    tensoes.voc_string_max, _num(tensaoMaxEntrada), 'Voc do módulo ou tensão máxima do inversor')
  // Teto de MPPT: pior caso é o FRIO — o Vmpp sobe quando esfria.
  const criterioMpptMax = _contraTeto(
    tensoes.vmpp_string_frio, _num(mpptMax), 'Vmpp do módulo ou MPPT máximo do inversor')
  // Piso de MPPT: pior caso é o QUENTE — o Vmpp cai com a temperatura de célula.
  const criterioMpptMin = _contraPiso(
    tensoes.vmpp_string_quente, _num(mpptMin), 'Vmpp do módulo ou MPPT mínimo do inversor')

  const criterios = [criterioVoc, criterioMpptMax, criterioMpptMin]
  const status = criterios.some((c) => c.status === STATUS_TENSAO.INCOMPATIVEL)
    ? STATUS_TENSAO.INCOMPATIVEL
    : criterios.some((c) => c.status === STATUS_TENSAO.ATENCAO)
      ? STATUS_TENSAO.ATENCAO
      : criterios.some((c) => c.status === STATUS_TENSAO.NAO_AVALIADO)
        ? STATUS_TENSAO.NAO_AVALIADO
        : STATUS_TENSAO.OK

  return { voc: criterioVoc, mppt_max: criterioMpptMax, mppt_min: criterioMpptMin, tensoes, status }
}

export default {
  STATUS_TENSAO, MARGEM_ATENCAO_TENSAO, tensoesDaString, classificarTensaoCC,
}
