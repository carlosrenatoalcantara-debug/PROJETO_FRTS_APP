import { describe, it, expect } from 'vitest'
import { avisoRascunho } from '../utils/avisoRascunho'

describe('avisoRascunho', () => {
  it('etapa 1: nunca mostra nada', () => {
    expect(avisoRascunho({ etapa: 1 })).toBeNull()
    expect(avisoRascunho({ etapa: 1, clienteId: 'c1' })).toBeNull()
  })
  it('com ?clienteId= (cliente cadastrado) e sem projeto ainda: sem aviso', () => {
    expect(avisoRascunho({ etapa: 2, clienteId: 'c1' })).toBeNull()
    expect(avisoRascunho({ etapa: 3, clienteId: 'c1' })).toBeNull()
  })
  it('sem cliente cadastrado: avisa pelo motivo certo (falta o cliente, não "concluir a etapa 2")', () => {
    const a = avisoRascunho({ etapa: 3 })
    expect(a.tipo).toBe('aviso')
    expect(a.texto).toMatch(/não está ligado a um cliente cadastrado/)
    expect(a.texto).not.toMatch(/conclua a Etapa 2/i)
  })
  it('projeto salvo: confirma o autosave', () => {
    expect(avisoRascunho({ etapa: 4, projetoId: 'p1' })).toEqual({ tipo: 'salvo' })
    expect(avisoRascunho({ etapa: 4, projetoId: 'p1', clienteId: 'c1' })).toEqual({ tipo: 'salvo' })
  })
})
