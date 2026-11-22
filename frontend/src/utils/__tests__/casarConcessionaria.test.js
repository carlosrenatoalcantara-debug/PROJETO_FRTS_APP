import { describe, it, expect } from 'vitest'
import { casarConcessionaria, OPCOES_CONCESSIONARIA } from '../../data/concessionariasWizard'

describe('casarConcessionaria — nome lido → opção da lista', () => {
  it('COSERN (o caso do wizard) vira "COSERN / Neoenergia (RN)"', () => {
    expect(casarConcessionaria('COSERN')).toBe('COSERN / Neoenergia (RN)')
    expect(casarConcessionaria('Cosern - Cia Energética do RN')).toBe('COSERN / Neoenergia (RN)')
    expect(casarConcessionaria('  cosern ')).toBe('COSERN / Neoenergia (RN)')
  })
  it('opção exata e acentos', () => {
    expect(casarConcessionaria('COSERN / Neoenergia (RN)')).toBe('COSERN / Neoenergia (RN)')
    expect(casarConcessionaria('equatorial para')).toBe('Equatorial Pará (PA)')
  })
  it('a marca mais específica vence', () => {
    expect(casarConcessionaria('CPFL Paulista')).toBe('CPFL Paulista (SP)')
    expect(casarConcessionaria('CPFL Piratininga S/A')).toBe('CPFL Piratininga (SP)')
  })
  it('nome só com a 1ª palavra: a UF desempata, sem UF não chuta', () => {
    expect(casarConcessionaria('ENEL', 'CE')).toBe('Enel Ceará (CE)')
    expect(casarConcessionaria('ENEL', 'RJ')).toBe('Enel Rio (RJ)')
    expect(casarConcessionaria('ENEL')).toBeNull()
    expect(casarConcessionaria('CPFL')).toBeNull()
  })
  it('desconhecido ou vazio fica null; genéricas não são auto-escolhidas', () => {
    expect(casarConcessionaria('Distribuidora Fictícia XYZ')).toBeNull()
    expect(casarConcessionaria('')).toBeNull()
    expect(casarConcessionaria(null)).toBeNull()
    expect(casarConcessionaria('Outra')).toBe('Outra')   // só se o texto lido for a própria opção
  })
  it('todo resultado é uma opção real da lista', () => {
    for (const n of ['COSERN', 'CELPE', 'Light', 'COPEL', 'CEMIG']) {
      const r = casarConcessionaria(n)
      if (r) expect(OPCOES_CONCESSIONARIA).toContain(r)
    }
  })
})
