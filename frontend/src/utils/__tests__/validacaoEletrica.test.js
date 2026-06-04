import { describe, it, expect } from 'vitest'
import { validarPlausibilidadeInversor, resumirPlausibilidade } from '../../../../backend/src/ai/validacaoEletricaInversor.js'

/**
 * P1-INV-HARDEN-01 — validação elétrica (apenas SINALIZA, não corrige).
 */
describe('validação elétrica de plausibilidade', () => {
  it('inversor coerente → sem alertas', () => {
    const ok = { potencia_kw: 5, potencia_maxima_kw: 5.5, tensao_ac: 380, corrente_ac_saida: 8.3,
      tensao_mppt_min: 160, tensao_mppt_max: 1000, tensao_max_entrada: 1100,
      corrente_max_por_mppt: 25, corrente_isc_max: 32, eficiencia_maxima: 98.4, fases: 3 }
    expect(validarPlausibilidadeInversor(ok)).toEqual([])
  })

  it('MPPT min ≥ max → crítico', () => {
    const a = validarPlausibilidadeInversor({ tensao_mppt_min: 900, tensao_mppt_max: 200 })
    expect(a.some(x => x.severidade === 'critico' && x.campo === 'tensao_mppt_min')).toBe(true)
  })

  it('MPPT max > tensão máx CC → alto', () => {
    const a = validarPlausibilidadeInversor({ tensao_mppt_max: 1100, tensao_max_entrada: 1000 })
    expect(a.some(x => x.campo === 'tensao_mppt_max')).toBe(true)
  })

  it('eficiência > 100% → alto', () => {
    const a = validarPlausibilidadeInversor({ eficiencia_maxima: 130 })
    expect(a.some(x => x.campo === 'eficiencia_maxima')).toBe(true)
  })

  it('Isc < corrente máx MPPT → médio', () => {
    const a = validarPlausibilidadeInversor({ corrente_max_por_mppt: 30, corrente_isc_max: 20 })
    expect(a.some(x => x.campo === 'corrente_isc_max')).toBe(true)
  })

  it('corrente CA absurda → médio (sinaliza, não corrige)', () => {
    // P=5kW, V=380, 3∅ → ~7.6A. Declarar 50A é incoerente.
    const a = validarPlausibilidadeInversor({ potencia_kw: 5, tensao_ac: 380, corrente_ac_saida: 50, fases: 3 })
    expect(a.some(x => x.campo === 'corrente_ac_saida')).toBe(true)
  })

  it('tensão FASE (220) em trifásico NÃO gera falso-positivo', () => {
    const a = validarPlausibilidadeInversor({ potencia_kw: 5, tensao_ac: 220, corrente_ac_saida: 8.3, fases: 3 })
    expect(a.some(x => x.campo === 'corrente_ac_saida')).toBe(false)
  })

  it('resumirPlausibilidade conta críticos', () => {
    const r = resumirPlausibilidade({ tensao_mppt_min: 900, tensao_mppt_max: 200 })
    expect(r.ok).toBe(false)
    expect(r.criticos).toBeGreaterThanOrEqual(1)
  })
})
