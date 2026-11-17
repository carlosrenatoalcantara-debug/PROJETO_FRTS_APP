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

export const ROTULO_ORIGEM_EFICIENCIA = {
  configurado: 'padrão da empresa (Configurações)',
  padrao_sistema: 'padrão do sistema — nenhum padrão configurado',
}
