import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// docs/DECISAO_FLUXO_FV_2026-11.md — "Novo" na ficha do cliente cria o projeto
// no fluxo canônico com o cliente FIXO e abre /fv/projetos/:id. Regressão do
// bf03005, que mandava para o wizard legado /projetos-fv/novo.

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig()),
  useNavigate: () => navigateMock,
  useParams: () => ({ clienteId: 'cli-1' }),
}))

const criarProjetoMock = vi.fn()
const listarClientesMock = vi.fn()
vi.mock('../../fv/api/agregadosFvApi', async (orig) => ({
  ...(await orig()),
  criarProjeto: (...a) => criarProjetoMock(...a),
  listarClientes: (...a) => listarClientesMock(...a),
}))

import ClienteGerenciamento from '../ClienteGerenciamento'

beforeEach(() => {
  navigateMock.mockClear()
  criarProjetoMock.mockReset().mockResolvedValue({ _id: 'novo-fv-1' })
  listarClientesMock.mockReset().mockResolvedValue([])
  global.fetch = vi.fn((url) => {
    let data
    if (url.includes('/api/clientes/')) data = { _id: 'cli-1', nome: 'Cliente Teste' }
    else if (url.includes('/api/projetos-fv/cliente/')) data = []
    else if (url.includes('/api/projetos-ev/cliente/')) data = []
    else data = {}
    return Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
  })
})

async function abrirFormFv() {
  render(<ClienteGerenciamento />)
  const titulo = await screen.findByText(/Projetos FV \(/)
  const novo = titulo.parentElement.querySelector('button')
  fireEvent.click(novo)
  return screen.findByText('Novo projeto FV')
}

describe('Ficha do cliente → novo projeto FV no fluxo canônico', () => {
  it('não navega para o wizard legado ao clicar em Novo', async () => {
    await abrirFormFv()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('formulário vem com o cliente fixo: sem seletor e sem buscar clientes', async () => {
    await abrirFormFv()
    expect(screen.queryByText('— selecione —')).toBeNull()
    expect(listarClientesMock).not.toHaveBeenCalled()
  })

  it('cria com o clienteId da ficha e abre /fv/projetos/:id', async () => {
    await abrirFormFv()
    fireEvent.change(screen.getByPlaceholderText(/Residencial/), { target: { value: 'Residencial teste' } })
    fireEvent.click(screen.getByText('Criar projeto'))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/fv/projetos/novo-fv-1'))
    expect(criarProjetoMock).toHaveBeenCalledWith({ clienteId: 'cli-1', nome: 'Residencial teste' })
  })

  it('cancelar fecha o formulário sem criar', async () => {
    await abrirFormFv()
    fireEvent.click(screen.getByText('Cancelar'))
    await waitFor(() => expect(screen.queryByText('Novo projeto FV')).toBeNull())
    expect(criarProjetoMock).not.toHaveBeenCalled()
  })
})
