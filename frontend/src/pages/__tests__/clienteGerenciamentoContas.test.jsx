import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * Ficha do cliente — contas de energia. Antes o "Anexar" era um setTimeout em
 * estado local: nada gravava e a lista nascia vazia a cada visita. Dados fictícios.
 */
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig()),
  useParams: () => ({ clienteId: 'c1' }),
  useNavigate: () => vi.fn(),
}))
vi.mock('../../fv/componentes/FormNovoProjeto', () => ({ default: () => null }))

import ClienteGerenciamento from '../ClienteGerenciamento'

let chamadas, contasServidor
const resp = (data, ok = true, status = 200) => Promise.resolve({ ok, status, json: () => Promise.resolve(data), blob: () => Promise.resolve(new Blob(['x'])) })

beforeEach(() => {
  chamadas = []
  contasServidor = [{ _id: 'k1', nome: 'conta-out.pdf', createdAt: '2026-10-01T00:00:00Z' }]
  global.fetch = vi.fn((url, init = {}) => {
    const u = String(url)
    chamadas.push({ url: u, init })
    if (u.endsWith('/api/clientes/c1')) return resp({ _id: 'c1', nome: 'Cliente Teste' })
    if (u.endsWith('/api/clientes/c1/contas') && init.method === 'POST') return resp({ _id: 'k2', nome: 'conta-nov.pdf', createdAt: '2026-11-01T00:00:00Z' })
    if (u.endsWith('/api/clientes/c1/contas')) return resp(contasServidor)
    if (u.includes('/api/clientes/c1/contas/k1') && init.method === 'DELETE') return resp({}, true, 204)
    return resp([])
  })
})

const arquivo = (tipo = 'application/pdf', nome = 'conta-nov.pdf') => new File(['%PDF-1.4'], nome, { type: tipo })

describe('contas de energia na ficha do cliente', () => {
  it('carrega as contas gravadas no servidor', async () => {
    render(<ClienteGerenciamento />)
    expect(await screen.findByText('conta-out.pdf')).toBeTruthy()
  })

  it('anexar envia o arquivo de verdade e a conta aparece na lista', async () => {
    render(<ClienteGerenciamento />)
    await screen.findByText('conta-out.pdf')
    fireEvent.change(screen.getByLabelText('Arquivo da conta de energia'), { target: { files: [arquivo()] } })
    expect(await screen.findByText('conta-nov.pdf')).toBeTruthy()
    const envio = chamadas.find((c) => c.init.method === 'POST')
    expect(envio.url).toMatch(/\/api\/clientes\/c1\/contas$/)
    expect(envio.init.body.get('conta').name).toBe('conta-nov.pdf')
  })

  it('erro do servidor aparece e nada entra na lista', async () => {
    global.fetch.mockImplementation((url, init = {}) => {
      const u = String(url)
      if (u.endsWith('/api/clientes/c1')) return resp({ _id: 'c1', nome: 'Cliente Teste' })
      if (u.endsWith('/contas') && init.method === 'POST') return resp({ mensagem: 'A conta precisa ser PDF ou imagem (JPG, PNG, WEBP).' }, false, 415)
      if (u.endsWith('/contas')) return resp([])
      return resp([])
    })
    render(<ClienteGerenciamento />)
    await screen.findByText('Nenhuma conta anexada')
    fireEvent.change(screen.getByLabelText('Arquivo da conta de energia'), { target: { files: [arquivo()] } })
    expect((await screen.findByRole('alert')).textContent).toMatch(/PDF ou imagem/)
    expect(screen.getByText('Nenhuma conta anexada')).toBeTruthy()
  })

  it('excluir chama o DELETE e só tira da lista se o servidor confirmar', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ClienteGerenciamento />)
    await screen.findByText('conta-out.pdf')
    fireEvent.click(screen.getByTitle('Deletar'))
    await waitFor(() => expect(screen.queryByText('conta-out.pdf')).toBeNull())
    expect(chamadas.some((c) => c.init.method === 'DELETE' && c.url.endsWith('/api/clientes/c1/contas/k1'))).toBe(true)
    window.confirm.mockRestore()
  })
})
