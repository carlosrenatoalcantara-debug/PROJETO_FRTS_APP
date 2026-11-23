import { describe, it, expect } from 'vitest'
import { sugerirMPPTs, totalDoArranjo } from '../sugerirStrings'

describe('sugerirMPPTs — respeita a quantidade definida', () => {
  it('16 módulos em 2 MPPTs = 2 × 8 (não 3 × 6 = 18)', () => {
    const m = sugerirMPPTs(16, 2)
    expect(totalDoArranjo(m)).toBe(16)
    expect(m).toEqual([{ numStrings: 1, modulosPorString: 8 }, { numStrings: 1, modulosPorString: 8 }])
  })

  it('16 módulos em 3 MPPTs também fecha 16', () => {
    expect(totalDoArranjo(sugerirMPPTs(16, 3))).toBe(16)
  })

  it('17 (primo) em 2 MPPTs: 9 + 8, cada tamanho no seu MPPT', () => {
    const m = sugerirMPPTs(17, 2)
    expect(totalDoArranjo(m)).toBe(17)
    for (const x of m) expect(x.modulosPorString).toBeGreaterThanOrEqual(6)
  })

  it('exato para 6..60 com 2 MPPTs', () => {
    for (let n = 6; n <= 60; n++) expect(totalDoArranjo(sugerirMPPTs(n, 2))).toBe(n)
  })

  it('1 MPPT e quantidade sem divisão possível: o mais próximo, sem estourar a faixa', () => {
    const m = sugerirMPPTs(17, 1)
    expect(Math.abs(totalDoArranjo(m) - 17)).toBe(1)
    expect(m[0].modulosPorString).toBeLessThanOrEqual(14)
  })

  it('menos de 6 módulos: uma string só', () => {
    expect(sugerirMPPTs(4, 2)).toEqual([{ numStrings: 1, modulosPorString: 4 }, { numStrings: 0, modulosPorString: 4 }])
  })

  it('entrada inválida mantém o formato antigo', () => {
    expect(sugerirMPPTs(0, 2)).toEqual([{ numStrings: 1, modulosPorString: 8 }])
  })
})
