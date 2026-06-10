import { describe, it, expect } from 'vitest'
import { statusQualidade, utilizavelEmProjeto } from '../qualidadeEquipamento.js'

describe('P1-FALLBACK — status 🟢 REAL / 🟡 INFERIDO / 🔴 INCOMPLETO', () => {
  it('🟢 REAL: módulo com os 5 campos mínimos e sem fallback', () => {
    const eq = { tipo: 'modulo', especificacoes: { potencia_wp: 550, voc: 49.5, isc: 14, vmp: 41, imp: 13.4 } }
    expect(statusQualidade(eq).nivel).toBe('REAL')
    expect(utilizavelEmProjeto(eq)).toBe(true)
  })
  it('🟡 INFERIDO: módulo com fallback conservador → tooltip de revisão', () => {
    const eq = { tipo: 'modulo', fallback: { tipo: 'fallback_conservador' }, especificacoes: { potencia_wp: 550, voc: 51.1, isc: 14.6, vmp: 40.9, imp: 13.4 } }
    const s = statusQualidade(eq)
    expect(s.nivel).toBe('INFERIDO')
    expect(s.icone).toBe('🟡')
    expect(s.tooltip).toMatch(/conservadores.*ausência de datasheet.*revisão/i)
    expect(utilizavelEmProjeto(eq)).toBe(true)
  })
  it('🔴 INCOMPLETO: shell sem dados mínimos', () => {
    const eq = { tipo: 'modulo', especificacoes: { potencia_wp: 550 } }
    expect(statusQualidade(eq).nivel).toBe('INCOMPLETO')
    expect(utilizavelEmProjeto(eq)).toBe(false)
  })
  it('inversor REAL vs INCOMPLETO', () => {
    expect(statusQualidade({ tipo: 'inversor', especificacoes: { potencia_kw: 25, tensao_max_entrada: 1100, n_mppts: 2 } }).nivel).toBe('REAL')
    expect(statusQualidade({ tipo: 'inversor', especificacoes: { potencia_kw: 25 } }).nivel).toBe('INCOMPLETO')
  })
  it('fallback tem prioridade sobre completude (sempre INFERIDO)', () => {
    const eq = { tipo: 'modulo', fallback: { tipo: 'fallback_conservador' }, especificacoes: { potencia_wp: 550, voc: 49, isc: 14, vmp: 41, imp: 13 } }
    expect(statusQualidade(eq).nivel).toBe('INFERIDO')   // não REAL, pois há dado inferido
  })
})
