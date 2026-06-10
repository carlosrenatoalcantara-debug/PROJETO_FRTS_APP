import { describe, it, expect } from 'vitest'
import { descricaoTopologia, topologiaDoProjeto } from '../descricaoTopologia.js'
import { gerarMemorialCalculo } from '../../data/templatesHomologacao.js'

describe('P1-MICRO-DOCS — descrição por topologia', () => {
  it('micro: tipo microinversor, sem string box CC', () => {
    const t = descricaoTopologia('micro', { qtd_microinversores: 7, modulos_por_micro: 4 })
    expect(t.tipoInversor).toMatch(/Microinversor/i)
    expect(t.usaString).toBe(false)
    expect(t.protecoes.join(' ')).toMatch(/Sem string box/i)
    expect(t.protecoes.join(' ')).not.toMatch(/fusíveis por string/i)
    expect(t.resumoArranjo).toMatch(/7 microinversor/i)
  })
  it('string: tipo String com string box CC', () => {
    const t = descricaoTopologia('string')
    expect(t.tipoInversor).toMatch(/String \(on-grid/i)
    expect(t.usaString).toBe(true)
    expect(t.protecoes.join(' ')).toMatch(/String box CC.*fusíveis por string/i)
  })
  it('otimizador: string com otimizador por módulo', () => {
    const t = descricaoTopologia('otimizador')
    expect(t.tipoInversor).toMatch(/otimizador/i)
  })
  it('topologiaDoProjeto: campo persistido tem prioridade; senão classifica pelo modelo', () => {
    expect(topologiaDoProjeto({ topologia: 'micro' })).toBe('micro')
    expect(topologiaDoProjeto({ inversor: { fabricante: 'Hoymiles', modelo: 'HMS-2000-4T' } })).toBe('micro')
    expect(topologiaDoProjeto({ inversor: { fabricante: 'Growatt', modelo: 'MID 25KTL3-X' } })).toBe('string')
  })
})

describe('P1-MICRO-DOCS — memorial reflete a topologia', () => {
  const base = {
    equipamentos: { painel: { marca: 'Jinko', modelo: 'JKM550', potenciaW: 550 }, inversor: { marca: 'Hoymiles', modelo: 'HMS-2000-4T', potenciaKW: 2 } },
    dimensionamento: { numPaineis: 26, numInversores: 7 },
  }
  it('memorial MICRO: contém "Microinversor" e NÃO "String box CC com fusíveis por string"', () => {
    const m = gerarMemorialCalculo({ ...base, topologia: 'micro', micro: { qtd_microinversores: 7, modulos_por_micro: 4 } })
    expect(m).toMatch(/Microinversor/i)
    expect(m).not.toMatch(/String box CC\s+: Com fusíveis por string/i)
    expect(m).toMatch(/7 unidade\(s\)/)   // qtd de micros, não de inversores string
  })
  it('memorial STRING (Growatt): mantém "String (on-grid" e string box', () => {
    const m = gerarMemorialCalculo({ equipamentos: { ...base.equipamentos, inversor: { marca: 'Growatt', modelo: 'MID 25KTL3-X', potenciaKW: 25 } }, dimensionamento: { numPaineis: 40, numInversores: 1 } })
    expect(m).toMatch(/String \(on-grid/i)
    expect(m).toMatch(/fusíveis por string/i)
  })
})
