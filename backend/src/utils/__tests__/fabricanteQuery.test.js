import { describe, it, expect } from 'vitest'
import { queryFabricante, ehDoFabricante } from '../fabricanteQuery.js'

describe('P1-NORMALIZE — busca por fabricante (bruto|canônico|alias)', () => {
  it('monta $or cobrindo fabricante, fabricante_canonico e aliases', () => {
    const q = queryFabricante('OSDA')
    expect(q.$or).toHaveLength(3)
    expect(q.$or.map(o => Object.keys(o)[0])).toEqual(['fabricante', 'fabricante_canonico', 'aliases'])
    expect(q.$or[0].fabricante.$regex).toBe('OSDA')
  })
  it('exato usa ^...$', () => {
    expect(queryFabricante('Trina', true).$or[0].fabricante.$regex).toBe('^Trina$')
  })
  it('termo vazio → filtro vazio', () => { expect(queryFabricante('')).toEqual({}) })
  it('escapa regex perigoso', () => { expect(queryFabricante('A+B').$or[0].fabricante.$regex).toBe('A\\+B') })
  it('ehDoFabricante casa canônico e alias', () => {
    const eq = { fabricante: 'OSDA Solar', fabricante_canonico: 'OSDA', aliases: ['OSDA Solar', 'Osda'] }
    expect(ehDoFabricante(eq, 'OSDA')).toBe(true)
    expect(ehDoFabricante(eq, 'osda solar')).toBe(true)
    expect(ehDoFabricante(eq, 'Jinko')).toBe(false)
  })
})
