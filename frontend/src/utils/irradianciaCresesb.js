/**
 * irradianciaCresesb — o valor INPE/CRESESB que a tela aplica, com a origem.
 *
 * Fonte única: o texto do seletor, o card e o que vai para o estado leem a
 * mesma função, para que o número exibido seja o número aplicado (antes o
 * seletor dizia "média do estado 5,9" enquanto o card aplicava 5,40 da cidade).
 *
 * Não há série mensal CRESESB no sistema — só média anual (cidade ou estado).
 * Puro: sem React, sem I/O.
 */
import { obterIrradianciaCity } from '../data/irradianciaRN'

/**
 * @param {{cidade?: string|null, uf?: string|null, mediaEstado?: number|null}} d
 * @returns {{valor: number|null, origem: 'cidade'|'estado'|null, rotulo: string}}
 */
export function resolverCresesb({ cidade, uf, mediaEstado } = {}) {
  const daCidade = obterIrradianciaCity(cidade, uf)
  if (daCidade !== null) {
    return { valor: daCidade, origem: 'cidade', rotulo: `média anual de ${cidade} (tabela CRESESB)` }
  }
  if (typeof mediaEstado === 'number' && Number.isFinite(mediaEstado)) {
    return { valor: mediaEstado, origem: 'estado', rotulo: `média territorial do estado${uf ? ` ${uf}` : ''}` }
  }
  return { valor: null, origem: null, rotulo: 'sem dado para este local' }
}

/**
 * Há série mensal REAL? Exige 12 valores finitos e NÃO todos iguais: doze
 * valores idênticos são a série fabricada por versões anteriores do `aplicarFallback`.
 */
export function temSerieMensal(mensal) {
  if (!Array.isArray(mensal) || mensal.length !== 12) return false
  const v = mensal.map((m) => m?.valor)
  if (!v.every((x) => typeof x === 'number' && Number.isFinite(x))) return false
  return new Set(v).size > 1
}
