import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * Ficha do cliente — contas de energia. A conta é guardada como DADOS (lida do
 * arquivo, que é descartado) e dela saem um .json e um .md. Dados fictícios.
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
  contasServidor = [{ _id: 'k1', nome: 'conta-out.pdf', createdAt: '2026-10-01T00:00:00Z', tem_arquivo: true, tem_dados: false }]
  global.fetch = vi.fn((url, init = {}) => {
    const u = String(url)
    chamadas.push({ url: u, init })
    if (u.endsWith('/api/clientes/c1')) return resp({ _id: 'c1', nome: 'Cliente Teste' })
    if (u.endsWith('/api/fatura/extrair')) return resp({ numeroCliente: '001.234.567-89', distribuidora: 'COSERN', consumoKwh: 384 })
    if (u.endsWith('/api/clientes/c1/contas') && init.method === 'POST') {
      return resp({ _id: 'k2', nome: 'Conta UC 001.234.567-89', distribuidora: 'COSERN', numero_cliente: '001.234.567-89', createdAt: '2026-11-01T00:00:00Z', tem_dados: true, tem_arquivo: false }, true, 201)
    }
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

  it('anexar LÊ a conta e guarda só os dados — o arquivo nunca vai para /contas', async () => {
    render(<ClienteGerenciamento />)
    await screen.findByText('conta-out.pdf')
    fireEvent.change(screen.getByLabelText('Arquivo da conta de energia'), { target: { files: [arquivo()] } })
    expect(await screen.findByText(/Conta UC 001\.234\.567-89 · COSERN/)).toBeTruthy()
    const leitura = chamadas.find((c) => c.url.endsWith('/api/fatura/extrair'))
    expect(leitura.init.body.get('fatura').name).toBe('conta-nov.pdf')
    const envio = chamadas.find((c) => c.init.method === 'POST' && c.url.endsWith('/api/clientes/c1/contas'))
    expect(typeof envio.init.body).toBe('string')
    expect(JSON.parse(envio.init.body)).toEqual({ dados: { numeroCliente: '001.234.567-89', distribuidora: 'COSERN', consumoKwh: 384 } })
  })

  it('conta de dados oferece .json e .md; conta antiga continua abrindo o arquivo original', async () => {
    contasServidor.push({ _id: 'k3', nome: 'Conta UC 9', numero_cliente: '9', createdAt: '2026-11-02T00:00:00Z', tem_dados: true, tem_arquivo: false })
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})   // sem navegação real do jsdom
    render(<ClienteGerenciamento />)
    await screen.findByText('conta-out.pdf')
    expect(screen.getByText(/arquivo original \(anterior\)/)).toBeTruthy()
    fireEvent.click(screen.getByText('Baixar .json'))
    fireEvent.click(screen.getByText('Baixar .md'))
    await waitFor(() => expect(chamadas.some((c) => c.url.endsWith('/api/clientes/c1/contas/k3/dados.json'))).toBe(true))
    expect(chamadas.some((c) => c.url.endsWith('/api/clientes/c1/contas/k3/dados.md'))).toBe(true)
  })

  it('erro do servidor aparece e nada entra na lista', async () => {
    global.fetch.mockImplementation((url, init = {}) => {
      const u = String(url)
      if (u.endsWith('/api/clientes/c1')) return resp({ _id: 'c1', nome: 'Cliente Teste' })
      if (u.endsWith('/api/fatura/extrair')) return resp({ erro: 'Erro ao extrair dados da fatura' }, false, 500)
      if (u.endsWith('/contas')) return resp([])
      return resp([])
    })
    render(<ClienteGerenciamento />)
    await screen.findByText('Nenhuma conta anexada')
    fireEvent.change(screen.getByLabelText('Arquivo da conta de energia'), { target: { files: [arquivo()] } })
    expect((await screen.findByRole('alert')).textContent).toMatch(/extrair dados da fatura/)
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
