/**
 * Sugestão de strings por MPPT a partir da QUANTIDADE de módulos definida em E7.
 *
 * Conveniência de UI (não é regra elétrica — quem valida é `validarArranjo`
 * e o motor). Antes arredondava para cima: 16 módulos viravam 3 × 6 = 18 e o
 * configurador devolvia 18 ao campo. Agora procura, nesta ordem:
 *   1. um tamanho de string único que divida a quantidade (16 = 2 × 8);
 *   2. com 2+ MPPTs, dois tamanhos vizinhos em MPPTs separados (17 = 9 + 8);
 *   3. o arranjo mais próximo — e a diferença fica visível, o campo não muda.
 */
export const MIN_POR_STRING = 6
export const MAX_POR_STRING = 14

function repartir(numStrings, modulosPorString, slots) {
  const base = Math.floor(numStrings / slots)
  const resto = numStrings - base * slots
  return Array.from({ length: slots }, (_, i) => ({
    numStrings: base + (i < resto ? 1 : 0),
    modulosPorString,
  }))
}

export function totalDoArranjo(mppts) {
  return (mppts || []).reduce((s, m) => s + (m.numStrings || 0) * (m.modulosPorString || 0), 0)
}

export function sugerirMPPTs(numPaineis, nMppts) {
  const n = Math.floor(Number(numPaineis))
  const slots = Math.floor(Number(nMppts))
  if (!(n > 0) || !(slots > 0)) return [{ numStrings: 1, modulosPorString: 8 }]

  // Abaixo do mínimo de uma string: uma string só, com tudo.
  if (n < MIN_POR_STRING) return repartir(1, n, slots)

  const alvo = Math.min(MAX_POR_STRING, Math.max(MIN_POR_STRING, Math.ceil(n / slots / 1.5)))
  const tamanhos = []
  for (let s = MIN_POR_STRING; s <= MAX_POR_STRING; s++) tamanhos.push(s)
  tamanhos.sort((a, b) => Math.abs(a - alvo) - Math.abs(b - alvo) || b - a)

  // 1) tamanho único exato
  for (const s of tamanhos) {
    if (n % s === 0) return repartir(n / s, s, slots)
  }

  // 2) dois tamanhos (q e q+1), cada um em seus MPPTs — strings em paralelo
  //    no mesmo MPPT precisam ter o mesmo tamanho.
  if (slots >= 2) {
    const opcoes = []
    for (let S = Math.ceil(n / MAX_POR_STRING); S <= Math.floor(n / MIN_POR_STRING); S++) {
      const q = Math.floor(n / S)
      const r = n - q * S
      if (r === 0 || q < MIN_POR_STRING || q + 1 > MAX_POR_STRING) continue
      opcoes.push({ S, q, r })
    }
    opcoes.sort((a, b) => Math.abs(n / a.S - alvo) - Math.abs(n / b.S - alvo))
    const o = opcoes[0]
    if (o) {
      const k = Math.min(slots - 1, Math.max(1, Math.round(slots * o.r / o.S)))
      return [...repartir(o.r, o.q + 1, k), ...repartir(o.S - o.r, o.q, slots - k)]
    }
  }

  // 3) o mais próximo possível (empate: o que não passa da quantidade)
  let melhor = null
  for (let S = 1; S <= Math.ceil(n / MIN_POR_STRING); S++) {
    for (const s of [Math.floor(n / S), Math.ceil(n / S)]) {
      if (s < MIN_POR_STRING || s > MAX_POR_STRING) continue
      const dif = S * s - n
      const pior = melhor && (Math.abs(dif) > Math.abs(melhor.dif) || (Math.abs(dif) === Math.abs(melhor.dif) && dif >= melhor.dif))
      if (!melhor || !pior) melhor = { S, s, dif }
    }
  }
  if (melhor) return repartir(melhor.S, melhor.s, slots)
  return repartir(Math.ceil(n / alvo), alvo, slots)
}
