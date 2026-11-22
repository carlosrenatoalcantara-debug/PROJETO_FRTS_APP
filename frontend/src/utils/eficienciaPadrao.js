/**
 * eficienciaPadrao — padrão de eficiência do FV para projeto NOVO.
 *
 * Espelha a faixa/fallback de backend/src/dominio/empresa/fvPadroes.js (o
 * backend é quem valida; aqui só se resolve o que mostrar e usar).
 *
 * Origem sempre declarada: 'configurado' (a empresa definiu em Configurações)
 * ou 'padrao_sistema' (ninguém configurou → 0,80). A tela nunca finge que um
 * valor do sistema foi escolha de alguém.
 */
export const EFICIENCIA_FALLBACK = 0.8
export const EFICIENCIA_MIN = 0.5
export const EFICIENCIA_MAX = 1

/** @param {number|null|undefined} configurada @returns {{valor:number, origem:'configurado'|'padrao_sistema'}} */
export function resolverEficienciaPadrao(configurada) {
  const n = typeof configurada === 'number' ? configurada : NaN
  if (Number.isFinite(n) && n >= EFICIENCIA_MIN && n <= EFICIENCIA_MAX) {
    return { valor: n, origem: 'configurado' }
  }
  return { valor: EFICIENCIA_FALLBACK, origem: 'padrao_sistema' }
}

/** Perdas totais (%) equivalentes a uma eficiência: 0,75 → 25. */
export const perdasPctDaEficiencia = (ef) => +(100 - ef * 100).toFixed(2)

/**
 * Eficiência efetivamente usada num cálculo, com a origem declarada.
 *
 * `perdasUsadas` é o que o motor normalizou; `perdasPadrao` é o padrão da
 * empresa (null se não configurado). Igual ao padrão → 'configurado'; qualquer
 * outro valor foi digitado → 'manual'. Perdas inválidas não geram número.
 *
 * @returns {{performance_ratio:number|null, performance_ratio_origem:'configurado'|'manual'|null}}
 */
export function eficienciaUsada(perdasUsadas, perdasPadrao) {
  const p = typeof perdasUsadas === 'number' ? perdasUsadas : Number(perdasUsadas)
  if (perdasUsadas == null || perdasUsadas === '' || !Number.isFinite(p) || p < 0 || p >= 100) {
    return { performance_ratio: null, performance_ratio_origem: null }
  }
  const performance_ratio = +((100 - p) / 100).toFixed(4)
  const padrao = typeof perdasPadrao === 'number' && Number.isFinite(perdasPadrao) ? perdasPadrao : null
  const origem = padrao !== null && Math.abs(padrao - p) < 1e-9 ? 'configurado' : 'manual'
  return { performance_ratio, performance_ratio_origem: origem }
}

export const ROTULO_ORIGEM_EFICIENCIA = {
  manual: 'ajustado neste projeto',
  configurado: 'padrão da empresa (Configurações)',
  padrao_sistema: 'padrão do sistema — nenhum padrão configurado',
}
