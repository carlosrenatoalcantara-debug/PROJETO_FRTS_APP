import { describe, it, expect } from 'vitest'
import { dimensionarMicroinversor, resumoDistribuicao } from '../dimensionarMicro.js'
import { classificarTopologia, TOPOLOGIAS } from '../topologiaInversor.js'

const micro = (entradas, caKw, ovr = 1.25) => ({ entradas, modulos_por_entrada: 1, potencia_ca_kw: caKw, oversizing_max: ovr })

describe('FASE 4 — motor de dimensionamento de microinversor (sem string/MPPT)', () => {
  it('26 módulos / micro 4 entradas (HMS-2000) → 7 micros, 6 completos + 1 parcial', () => {
    const d = dimensionarMicroinversor({ numModulos: 26, potenciaModuloW: 590, micro: micro(4, 2.0) })
    expect(d.qtdMicros).toBe(7)
    expect(d.microsCompletos).toBe(6)
    expect(d.microsParciais).toBe(1)
    expect(d.distribuicao).toEqual([4, 4, 4, 4, 4, 4, 2])
    expect(d.modulosPorMicro).toBe(4)
  })
  it('26 módulos / micro 2 entradas (HMS-500) → 13 micros, 2 módulos por micro', () => {
    const d = dimensionarMicroinversor({ numModulos: 26, potenciaModuloW: 590, micro: micro(2, 0.5) })
    expect(d.qtdMicros).toBe(13)
    expect(d.modulosPorMicro).toBe(2)
    expect(d.microsParciais).toBe(0)
  })
  it('DC/AC e oversizing por micro (26×590W, HMS-2000 2kW)', () => {
    const d = dimensionarMicroinversor({ numModulos: 26, potenciaModuloW: 590, micro: micro(4, 2.0) })
    expect(d.potenciaCcKw).toBeCloseTo(15.34, 2)
    expect(d.potenciaCaKw).toBeCloseTo(14.0, 2)        // 7 × 2.0
    expect(d.relacaoDcAc).toBeCloseTo(1.096, 2)
    expect(d.oversizingMicroCheio).toBeCloseTo(1.18, 2) // 4×590/2000
    expect(d.oversizingOk).toBe(true)
  })
  it('casos FASE 6 — quantidade de micros (micro 4 entradas)', () => {
    const q = n => dimensionarMicroinversor({ numModulos: n, potenciaModuloW: 590, micro: micro(4, 2.0) }).qtdMicros
    expect(q(8)).toBe(2)
    expect(q(12)).toBe(3)
    expect(q(26)).toBe(7)
    expect(q(74)).toBe(19)   // 18×4=72 + 2
    expect(q(128)).toBe(32)  // 128/4 exato
  })
  it('Enphase (1 entrada) → 1 micro por módulo', () => {
    const d = dimensionarMicroinversor({ numModulos: 8, potenciaModuloW: 550, micro: micro(1, 0.384) })
    expect(d.qtdMicros).toBe(8)
    expect(d.distribuicao).toEqual([1, 1, 1, 1, 1, 1, 1, 1])
  })
  it('NÃO produz nenhum conceito de string/MPPT', () => {
    const d = dimensionarMicroinversor({ numModulos: 26, potenciaModuloW: 590, micro: micro(4, 2.0) })
    expect(d).not.toHaveProperty('modulosPorString')
    expect(d).not.toHaveProperty('numStrings')
    expect(d).not.toHaveProperty('mppts')
    expect(d.topologia).toBe('micro')
  })
  it('resumoDistribuicao legível', () => {
    const d = dimensionarMicroinversor({ numModulos: 26, potenciaModuloW: 590, micro: micro(4, 2.0) })
    expect(resumoDistribuicao(d)).toBe('6 micros de 4 + 1 de 2')
  })
})

describe('FASE 2 — classificação explícita de topologia', () => {
  const inv = (fabricante, modelo) => ({ fabricante, modelo })
  it('microinversores → micro', () => {
    expect(classificarTopologia(inv('Hoymiles', 'HMS-2000-4T'))).toBe(TOPOLOGIAS.MICRO)
    expect(classificarTopologia(inv('APsystems', 'QS1'))).toBe(TOPOLOGIAS.MICRO)
    expect(classificarTopologia(inv('TSUN', 'TSOL-MS2000'))).toBe(TOPOLOGIAS.MICRO)
    expect(classificarTopologia(inv('Enphase', 'IQ8'))).toBe(TOPOLOGIAS.MICRO)
    expect(classificarTopologia(inv('Deye', 'DEYE MICRO INVERSOR SUN-M2000'))).toBe(TOPOLOGIAS.MICRO)
  })
  it('inversores string Deye NÃO viram micro', () => {
    expect(classificarTopologia(inv('Deye', 'SUN-5K-G'))).toBe(TOPOLOGIAS.STRING)
    expect(classificarTopologia(inv('Deye', 'SUN2000G-US-220'))).toBe(TOPOLOGIAS.STRING)
  })
  it('otimizador (SolarEdge) → otimizador', () => {
    expect(classificarTopologia(inv('SolarEdge', 'SE20.1K'))).toBe(TOPOLOGIAS.OTIMIZADOR)
  })
  it('inversores string comuns → string', () => {
    expect(classificarTopologia(inv('Growatt', 'MID 25KTL3-X'))).toBe(TOPOLOGIAS.STRING)
    expect(classificarTopologia(inv('Kehua', 'SPI 30K-B'))).toBe(TOPOLOGIAS.STRING)
  })
  it('campo topologia explícito tem prioridade absoluta', () => {
    expect(classificarTopologia(inv('X', 'Y'), { topologia: 'micro' })).toBe(TOPOLOGIAS.MICRO)
    expect(classificarTopologia({ ...inv('Hoymiles', 'HMS-2000'), topologia: 'string' })).toBe(TOPOLOGIAS.STRING)
  })
})
