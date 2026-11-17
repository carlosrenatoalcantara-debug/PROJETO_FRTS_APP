import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const buscarFvPadroes = vi.fn()
const salvarFvPadroes = vi.fn()
vi.mock('../../../services/fvPadroesApi', () => ({
  buscarFvPadroes: (...a) => buscarFvPadroes(...a),
  salvarFvPadroes: (...a) => salvarFvPadroes(...a),
}))

import FvPadroesConfig from '../FvPadroesConfig'

const campo = () => screen.getByLabelText('Eficiência padrão do sistema (%)')

beforeEach(() => {
  buscarFvPadroes.mockReset().mockResolvedValue({ eficiencia_padrao: null })
  salvarFvPadroes.mockReset().mockResolvedValue({})
})

describe('Configurações — eficiência padrão do FV', () => {
  it('sem configuração: placeholder 80 e texto "padrão do sistema"', async () => {
    render(<FvPadroesConfig />)
    await waitFor(() => expect(campo().disabled).toBe(false))
    expect(campo().value).toBe('')
    expect(campo().placeholder).toBe('80')
    expect(screen.getByText(/Nenhum padrão configurado: o sistema usa 80%/)).toBeTruthy()
  })

  it('salva 75% como 0,75', async () => {
    render(<FvPadroesConfig />)
    await waitFor(() => expect(campo().disabled).toBe(false))
    fireEvent.change(campo(), { target: { value: '75' } })
    fireEvent.click(screen.getByText('Salvar'))
    await waitFor(() => expect(salvarFvPadroes).toHaveBeenCalledWith({ eficiencia_padrao: 0.75 }))
    expect(await screen.findByText('Padrão salvo.')).toBeTruthy()
  })

  it('valor fora de 50–100 bloqueia o salvamento e explica', async () => {
    render(<FvPadroesConfig />)
    await waitFor(() => expect(campo().disabled).toBe(false))
    fireEvent.change(campo(), { target: { value: '120' } })
    expect(screen.getByRole('alert').textContent).toMatch(/entre 50 e 100/)
    expect(screen.getByText('Salvar').disabled).toBe(true)
  })

  it('carrega o valor configurado e permite voltar ao padrão do sistema (null)', async () => {
    buscarFvPadroes.mockResolvedValue({ eficiencia_padrao: 0.75 })
    render(<FvPadroesConfig />)
    await waitFor(() => expect(campo().value).toBe('75'))
    fireEvent.click(screen.getByText('Voltar ao padrão do sistema'))
    await waitFor(() => expect(salvarFvPadroes).toHaveBeenCalledWith({ eficiencia_padrao: null }))
    await waitFor(() => expect(campo().value).toBe(''))
  })

  it('erro do servidor aparece na tela', async () => {
    salvarFvPadroes.mockRejectedValue(new Error('eficiencia_padrao deve ser um número entre 0.5 e 1'))
    render(<FvPadroesConfig />)
    await waitFor(() => expect(campo().disabled).toBe(false))
    fireEvent.change(campo(), { target: { value: '60' } })
    fireEvent.click(screen.getByText('Salvar'))
    expect((await screen.findByRole('alert')).textContent).toMatch(/entre 0.5 e 1/)
  })
})
