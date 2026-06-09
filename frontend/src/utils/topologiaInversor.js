/**
 * topologiaInversor.js — P0-ARRAY-CONFIG-MICROINVERSOR-01
 *
 * Classificação EXPLÍCITA da topologia do inversor — sem heurística oculta.
 * Ordem de precedência (documentada):
 *   1. campo `topologia` explícito (no equipamento ou nos dados elétricos do catálogo);
 *   2. padrões de modelo/fabricante claros (micro / otimizador);
 *   3. default = 'string'.
 *
 * NÃO altera SSOT/Atlas — apenas LÊ o inversor para classificar.
 */

export const TOPOLOGIAS = { STRING: 'string', MICRO: 'micro', OTIMIZADOR: 'otimizador' }

// Padrões de MICROINVERSOR (fabricante/modelo). Conservador — só marca micro com sinal claro.
const RE_MICRO = /(HOYMILES|\bHMS-?\d|\bHMT-?\d|APSYSTEMS|AP\s?SYSTEMS|\bDS3\b|\bQS1\b|\bQT2\b|ENPHASE|\bIQ[ ]?[78]\b|TSUN|TSOL|NEP\b|\bBDM-?\d|MICRO\s*INVERSOR|MICROINVERSOR|MICRO-?INVERTER)/i
// Padrões de OTIMIZADOR (SolarEdge + power optimizer)
const RE_OTIM = /(SOLAREDGE|SOLAR\s?EDGE|POWER\s*OPTIMIZER|OTIMIZADOR|HD-?WAVE|\bSE\d{2,}|\bP\d{3,}\b)/i
// Deye MICRO: modelos "SUN-M…" / "…MI…" (string Deye é "SUN-5K-G", "SUN2000G…" → NÃO micro)
const RE_DEYE_MICRO = /(SUN-?M\d|SUN\d{3,4}-?\d?-?MI|MICRO)/i

/**
 * @param {object} inversor      equipamento selecionado (fabricante, modelo, id, topologia?, tipo?)
 * @param {object} [eletricoInv] dados elétricos do catálogo (pode ter topologia + entradas)
 * @returns {'string'|'micro'|'otimizador'}
 */
export function classificarTopologia(inversor, eletricoInv) {
  // 1) campo explícito tem prioridade absoluta
  const explicito = eletricoInv?.topologia ?? inversor?.topologia
  if (explicito && Object.values(TOPOLOGIAS).includes(explicito)) return explicito

  const txt = `${inversor?.fabricante ?? ''} ${inversor?.modelo ?? ''} ${inversor?.nome ?? ''} ${inversor?.id ?? ''}`

  // 2) padrões explícitos
  const ehDeye = /DEYE/i.test(txt)
  if (RE_MICRO.test(txt) || (ehDeye && RE_DEYE_MICRO.test(txt) && /MICRO/i.test(txt))) return TOPOLOGIAS.MICRO
  if (RE_OTIM.test(txt)) return TOPOLOGIAS.OTIMIZADOR

  // 3) default
  return TOPOLOGIAS.STRING
}

export const ehMicro = (inv, el) => classificarTopologia(inv, el) === TOPOLOGIAS.MICRO
export const ehOtimizador = (inv, el) => classificarTopologia(inv, el) === TOPOLOGIAS.OTIMIZADOR
export const ehString = (inv, el) => classificarTopologia(inv, el) === TOPOLOGIAS.STRING
