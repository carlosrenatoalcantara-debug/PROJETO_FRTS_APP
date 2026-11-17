import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/** Etapa de localização: busca sozinha com o cadastro e explica quando falha. Endereço fictício. */
let ctxState
const dispatchMock = vi.fn()
vi.mock('../../../../contexts/ProjetoFVContext', () => ({
  useProjetoFV: () => ({ state: ctxState, dispatch: dispatchMock, proxima: vi.fn(), anterior: vi.fn() }),
}))
const geocodificar = vi.fn()
vi.mock('../../../../services/geocodingApi', () => ({ geocodificarEndereco: (...a) => geocodificar(...a) }))

import E3Localizacao from '../E3Localizacao'

const estado = (loc = {}) => ({
  localizacao: { endereco: 'Rua das Palmeiras, 100', cidade: 'Parnamirim', uf: 'RN', cep: '59140000', lat: null, lon: null, ...loc },
})
const ACHOU = { lat: -5.9, lon: -35.2, enderecoFormatado: 'Rua das Palmeiras, Parnamirim, RN, Brasil', cidadeEstado: 'Parnamirim - Rio Grande do Norte' }

beforeEach(() => { dispatchMock.mockClear(); geocodificar.mockReset() })

describe('E3 — busca automática com o cadastro', () => {
  it('ao entrar, consulta com rua + número + cidade + UF + CEP', async () => {
    geocodificar.mockResolvedValue(ACHOU)
    ctxState = estado()
    render(<E3Localizacao />)
    await waitFor(() => expect(geocodificar).toHaveBeenCalledWith('Rua das Palmeiras, 100, Parnamirim, RN, 59140-000'))
    await waitFor(() => expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_LOCALIZACAO', payload: expect.objectContaining({ lat: -5.9, lon: -35.2 }) })))
  })

  it('se a consulta completa falha, tenta CEP+cidade e depois cidade', async () => {
    geocodificar.mockResolvedValueOnce(null).mockResolvedValueOnce(ACHOU)
    ctxState = estado()
    render(<E3Localizacao />)
    await waitFor(() => expect(geocodificar).toHaveBeenCalledTimes(2))
    expect(geocodificar.mock.calls[1][0]).toBe('59140-000, Parnamirim, RN')
  })

  it('nada encontrado: mostra o motivo, mantém o campo editável e não quebra', async () => {
    geocodificar.mockResolvedValue(null)
    ctxState = estado()
    render(<E3Localizacao />)
    expect((await screen.findByText(/Busca automática sem resultado\. Não encontrei/)).textContent).toMatch(/coordenadas manualmente/)
    expect(screen.getByPlaceholderText(/Rua das Flores/).disabled).toBe(false)
  })

  it('sem endereço nem cidade no cadastro: não consulta sozinho', () => {
    ctxState = estado({ endereco: '', cidade: '', uf: null, cep: '' })
    render(<E3Localizacao />)
    expect(geocodificar).not.toHaveBeenCalled()
  })

  it('já com coordenadas: não consulta de novo', () => {
    ctxState = estado({ lat: -5.9, lon: -35.2 })
    render(<E3Localizacao />)
    expect(geocodificar).not.toHaveBeenCalled()
  })

  it('o botão Buscar também usa o cadastro completo', async () => {
    geocodificar.mockResolvedValue(ACHOU)
    ctxState = estado({ lat: -1, lon: -1 })
    render(<E3Localizacao />)
    fireEvent.click(screen.getByText('Buscar'))
    await waitFor(() => expect(geocodificar).toHaveBeenCalledWith('Rua das Palmeiras, 100, Parnamirim, RN, 59140-000'))
  })
})
