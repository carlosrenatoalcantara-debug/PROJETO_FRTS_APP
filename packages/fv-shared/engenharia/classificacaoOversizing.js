/**
 * classificacaoOversizing.js — classificação canônica da relação CC/CA — F2.
 *
 * ── Duas grandezas com o mesmo nome ─────────────────────────────────────────
 * "Oversizing" cobria dois limites diferentes, e a distinção importa tanto
 * quanto a que a F1 fez entre corrente de trabalho e de curto:
 *
 *   LIMITE DE SEGURANÇA   1,50× — teto declarado pelo SISTEMA, acima do qual o
 *                         arranjo é recusado. Não é dado de fabricante; é
 *                         critério nosso, e está nomeado como tal.
 *   LIMITE DO FABRICANTE  `oversizing_max` do catálogo — acima dele há clipping
 *                         previsto pelo fabricante. É dado de CADASTRO.
 *
 * ── O que a auditoria da F2 mediu ───────────────────────────────────────────
 * `oversizing_max_fabricante ?? 1.30`: dos 39 inversores do catálogo real,
 * ZERO declaram `oversizing_max`. O `?? 1.30` fabricava o limite do fabricante
 * em 100% dos casos, e todo aviso `OVERSIZING_ELEVADO` já emitido foi contra um
 * número inventado.
 *
 * Aqui a ausência vira `nao_avaliado`, como em corrente. O teto de 1,50×
 * permanece — ele não depende de cadastro nenhum e é o que impede o absurdo.
 *
 * Puro: sem I/O, sem React, sem dependência de node.
 */

export const STATUS_OVERSIZING = Object.freeze({
  OK:           'ok',
  ATENCAO:      'atencao',
  INCOMPATIVEL: 'incompativel',
  NAO_AVALIADO: 'nao_avaliado',
})

/**
 * Teto de segurança do SISTEMA para a relação CC/CA. Não é dado de fabricante:
 * é o limite acima do qual recusamos o arranjo independentemente do modelo.
 */
export const LIMITE_CRITICO_CC_CA = 1.50

/**
 * Abaixo disto o inversor está subdimensionado em relação ao gerador — ou, mais
 * exatamente, o gerador é pequeno para o inversor. É observação de projeto, não
 * critério de compatibilidade: nunca reprova e nunca vira atenção elétrica.
 */
export const RELACAO_MINIMA_TIPICA = 1.0

function _num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const _r = (v, n = 3) => { const f = 10 ** n; return Math.round(v * f) / f }

/**
 * Classifica a relação CC/CA de um arranjo.
 *
 * @param {Object} p
 * @param {number} p.potenciaCcKwp     potência CC instalada (kWp)
 * @param {number} p.potenciaCaKw      potência nominal CA do inversor (kW)
 * @param {number} [p.limiteFabricante] `oversizing_max` do catálogo, se houver
 */
export function classificarOversizing({
  potenciaCcKwp = null, potenciaCaKw = null, limiteFabricante = null,
} = {}) {
  const cc = _num(potenciaCcKwp)
  const ca = _num(potenciaCaKw)
  const limite = _num(limiteFabricante)

  if (cc === null || ca === null || ca <= 0) {
    return {
      status: STATUS_OVERSIZING.NAO_AVALIADO,
      fator: null, limite_critico: LIMITE_CRITICO_CC_CA, limite_fabricante: limite,
      subdimensionado: null,
      motivo: 'Sem potência CC ou CA não há relação a calcular.',
    }
  }

  const fator = _r(cc / ca)

  // 1) Teto de segurança do sistema — independe de cadastro.
  if (fator > LIMITE_CRITICO_CC_CA) {
    return {
      status: STATUS_OVERSIZING.INCOMPATIVEL,
      fator, limite_critico: LIMITE_CRITICO_CC_CA, limite_fabricante: limite,
      subdimensionado: false,
      motivo: `Relação CC/CA de ${fator.toFixed(2)}× excede o limite de segurança `
        + `de ${LIMITE_CRITICO_CC_CA.toFixed(2)}× adotado pelo sistema.`,
    }
  }

  // 2) Limite do FABRICANTE — só existe se o catálogo o declarar.
  if (limite === null) {
    return {
      status: STATUS_OVERSIZING.NAO_AVALIADO,
      fator, limite_critico: LIMITE_CRITICO_CC_CA, limite_fabricante: null,
      subdimensionado: fator < RELACAO_MINIMA_TIPICA,
      motivo: 'O catálogo não declara `oversizing_max` para este inversor. '
        + 'Abaixo do limite de segurança e sem limite de fabricante, o critério '
        + 'não é avaliado — nenhum limite é assumido no lugar dele.',
    }
  }

  return {
    status: fator > limite ? STATUS_OVERSIZING.ATENCAO : STATUS_OVERSIZING.OK,
    fator, limite_critico: LIMITE_CRITICO_CC_CA, limite_fabricante: limite,
    subdimensionado: fator < RELACAO_MINIMA_TIPICA,
    motivo: fator > limite
      ? `Relação CC/CA de ${fator.toFixed(2)}× acima do limite de ${limite.toFixed(2)}× `
        + 'declarado pelo fabricante. Haverá clipping nos horários de pico; não é '
        + 'impedimento elétrico.'
      : null,
  }
}

export default {
  STATUS_OVERSIZING, LIMITE_CRITICO_CC_CA, RELACAO_MINIMA_TIPICA, classificarOversizing,
}
