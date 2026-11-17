import { describe, it, expect } from 'vitest'
import { montarConsultasEndereco, formatarCep } from '../utils/consultaEndereco'

// Endereço fictício. Antes só rua+número ia para a busca.
const cad = { endereco: 'Rua das Palmeiras, 100', cidade: 'Parnamirim', uf: 'RN', cep: '59140000' }

describe('montarConsultasEndereco', () => {
  it('junta rua + número + cidade + UF + CEP', () => {
    expect(montarConsultasEndereco(cad)[0]).toBe('Rua das Palmeiras, 100, Parnamirim, RN, 59140-000')
  })
  it('traz alternativas mais amplas: CEP+cidade+UF e cidade+UF', () => {
    expect(montarConsultasEndereco(cad).slice(1)).toEqual(['59140-000, Parnamirim, RN', 'Parnamirim, RN'])
  })
  it('não repete o que o endereço já tem (sem "Natal, Natal")', () => {
    const q = montarConsultasEndereco({ endereco: 'Rua A, 5, Natal, RN', cidade: 'Natal', uf: 'RN' })[0]
    expect(q).toBe('Rua A, 5, Natal, RN')
  })
  it('compara sem acento nem maiúscula', () => {
    expect(montarConsultasEndereco({ endereco: 'Rua B, 1, são josé', cidade: 'São José', uf: 'SC' })[0])
      .toBe('Rua B, 1, são josé, SC')
  })
  it('só cidade/UF ainda gera busca; nada gera lista vazia', () => {
    expect(montarConsultasEndereco({ cidade: 'Natal', uf: 'RN' })).toEqual(['Natal, RN'])
    expect(montarConsultasEndereco({})).toEqual([])
    expect(montarConsultasEndereco()).toEqual([])
  })
  it('CEP inválido é ignorado', () => {
    expect(formatarCep('123')).toBe('')
    expect(montarConsultasEndereco({ endereco: 'Rua C, 2', cep: '123' })).toEqual(['Rua C, 2'])
  })
})
