import { describe, it, expect } from 'vitest'
import { resumoTecnicoArranjo } from '../agregarArranjosFV.js'

describe('resumoTecnicoArranjo — micro', () => {
  const cat = (esp) => ({ modulos: [{ _id: 'M', especificacoes: { potencia_wp: 620, voc: 55 } }], inversores: [{ _id: 'I', especificacoes: esp }] })
  const arranjo = (qtdInv) => ({ paineis: [{ equipamento_id: 'M', quantidade: 16, potencia_w: 620 }], inversores: [{ equipamento_id: 'I', quantidade: qtdInv, potencia_kw: 2 }] })

  it('capacidade = entradas × módulos/entrada × micros: 16 módulos em 4 micros de 4 não alerta', () => {
    const r = resumoTecnicoArranjo(arranjo(4), cat({ potencia_kw: 2, n_mppts: 2, tipo_topologia: 'MICRO', entradas: 4, modulos_por_entrada: 1 }))
    expect(r.avisos.find((a) => /sem inversor/.test(a.msg))).toBeUndefined()
    expect(r.oversizing).toBe(1.24)
  })

  it('micros a menos que o necessário alertam de verdade', () => {
    const r = resumoTecnicoArranjo(arranjo(2), cat({ potencia_kw: 2, n_mppts: 2, tipo_topologia: 'MICRO', entradas: 4, modulos_por_entrada: 1 }))
    expect(r.avisos.some((a) => /8 módulo\(s\) sem inversor/.test(a.msg))).toBe(true)
  })

  it('micro sem entradas no catálogo: nada presumido, sem falso alarme', () => {
    const r = resumoTecnicoArranjo(arranjo(4), cat({ potencia_kw: 2, n_mppts: 2, tipo_topologia: 'MICRO' }))
    expect(r.avisos.find((a) => /sem inversor/.test(a.msg))).toBeUndefined()
  })
})
