import { describe, it, expect } from 'vitest'
import { limitesEfetivosCarregador } from '../../pages/NovaPropostaEV.jsx'

// BUG-021.5: limitação de operação do carregador — potência/corrente efetivas de
// dimensionamento. Sem limitação = nominal; com limitação, converte o valor
// configurado (kW OU A) no par coerente e nunca ultrapassa o nominal.
describe('BUG-021.5 — limitesEfetivosCarregador', () => {
  const arredonda = (n) => Math.round(Number(n) * 10) / 10

  it('sem limitação → devolve os valores nominais', () => {
    const r = limitesEfetivosCarregador({ habilitado: false }, 22, 32, 380, 3)
    expect(r).toEqual({ potencia_kw: 22, corrente_a: 32, limitado: false })
  })

  it('limitação por POTÊNCIA (tri) → corrente derivada por P = √3·V·I·fp', () => {
    const r = limitesEfetivosCarregador({ habilitado: true, modo: 'potencia', potencia_max_kw: 7 }, 22, 32, 380, 3)
    expect(r.limitado).toBe(true)
    expect(r.potencia_kw).toBe(7)
    expect(arredonda(r.corrente_a)).toBe(11.2) // 7000/(380·1,732·0,95)
  })

  it('limitação por CORRENTE (mono) → potência derivada por P = V·I·fp', () => {
    const r = limitesEfetivosCarregador({ habilitado: true, modo: 'corrente', corrente_max_a: 20 }, 7, 32, 220, 1)
    expect(r.limitado).toBe(true)
    expect(r.corrente_a).toBe(20)
    expect(arredonda(r.potencia_kw)).toBe(4.2) // 220·20·0,95/1000
  })

  it('nunca ultrapassa o nominal (limite > nominal → usa nominal)', () => {
    const r = limitesEfetivosCarregador({ habilitado: true, modo: 'corrente', corrente_max_a: 100 }, 7, 32, 220, 1)
    expect(r.corrente_a).toBe(32)
  })

  it('habilitado mas sem valor configurado → cai para nominal', () => {
    const r = limitesEfetivosCarregador({ habilitado: true, modo: 'corrente', corrente_max_a: null }, 7, 32, 220, 1)
    expect(r.limitado).toBe(false)
    expect(r.corrente_a).toBe(32)
  })
})
