import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * Modal "Novo Cliente" a partir da fatura. Dados fictícios — nenhuma fatura real.
 */
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => vi.fn() }))
vi.mock('../../components/ui/Dropzone', () => ({
  default: ({ onArquivo }) => (
    <button type="button" onClick={() => onArquivo(new File(['%PDF-1.4'], 'fatura.pdf', { type: 'application/pdf' }))}>
      enviar-fatura
    </button>
  ),
}))

import Clientes from '../Clientes'

let extracao
let chamadas
beforeEach(() => {
  chamadas = []
  global.fetch = vi.fn((url, init = {}) => {
    chamadas.push({ url: String(url), init })
    const ok = (data) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) })
    if (String(url).includes('/api/fatura/extrair')) return ok(extracao)
    if (String(url).endsWith('/api/clientes') && init.method === 'POST') return ok({ _id: 'cli-novo', nome: 'FULANO DE TAL TESTE', email: 'fulano@exemplo.test', cidade: 'Natal' })
    if (String(url).includes('/contas')) return ok({ _id: 'conta-1' })
    return ok([])
  })
})

async function lerFatura() {
  render(<Clientes />)
  fireEvent.click(await screen.findByText('Novo Cliente'))
  fireEvent.click(screen.getByText('enviar-fatura'))
  await screen.findByDisplayValue('FULANO DE TAL TESTE')
}

describe('CPF mascarado na conta', () => {
  it('não preenche o CPF e avisa para completar', async () => {
    extracao = { nome: 'FULANO DE TAL TESTE', cpfCnpj: null, cpfCnpjMascarado: '123.4**.***-**', numeroCliente: '001.234.567-89' }
    await lerFatura()
    expect(screen.getByText(/CPF mascarado \(123\.4\*\*\.\*\*\*-\*\*\)/)).toBeTruthy()
    expect(screen.queryByDisplayValue('123.4**.***-**')).toBeNull()
  })

  it('CPF completo é preenchido e não há aviso', async () => {
    extracao = { nome: 'FULANO DE TAL TESTE', cpfCnpj: '111.222.333-44', cpfCnpjMascarado: null }
    await lerFatura()
    expect(screen.getByDisplayValue('111.222.333-44')).toBeTruthy()
    expect(screen.queryByText(/CPF mascarado/)).toBeNull()
  })
})

describe('UC lida da fatura', () => {
  it('preenche "Número do cliente / UC"', async () => {
    extracao = { nome: 'FULANO DE TAL TESTE', numeroCliente: '001.234.567-89' }
    await lerFatura()
    expect(screen.getByDisplayValue('001.234.567-89')).toBeTruthy()
  })
})

describe('conta lida no cadastro fica anexada ao cliente', () => {
  async function salvar() {
    extracao = { nome: 'FULANO DE TAL TESTE', cpfCnpj: '111.222.333-44' }
    await lerFatura()
    fireEvent.change(document.querySelector('input[name="email"]'), { target: { name: 'email', value: 'fulano@exemplo.test' } })
    fireEvent.submit(document.querySelector('input[name="email"]').closest('form'))
  }

  it('depois de criar o cliente, guarda os DADOS lidos (não o arquivo) em /api/clientes/<id>/contas', async () => {
    await salvar()
    await waitFor(() => expect(chamadas.some((c) => c.url.endsWith('/api/clientes/cli-novo/contas'))).toBe(true))
    const envio = chamadas.find((c) => c.url.endsWith('/api/clientes/cli-novo/contas'))
    expect(envio.init.method).toBe('POST')
    expect(typeof envio.init.body).toBe('string')   // JSON, nunca FormData/arquivo
    expect(JSON.parse(envio.init.body).dados).toMatchObject({ nome: 'FULANO DE TAL TESTE', cpfCnpj: '111.222.333-44' })
    const iCriar = chamadas.findIndex((c) => c.url.endsWith('/api/clientes') && c.init.method === 'POST')
    expect(iCriar).toBeGreaterThanOrEqual(0)
    expect(chamadas.indexOf(envio)).toBeGreaterThan(iCriar)
  })

  it('guarda falhou: cliente continua criado e o operador é avisado', async () => {
    const original = global.fetch
    global.fetch = vi.fn((url, init) => (String(url).includes('/contas')
      ? Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ mensagem: 'Não há dados da conta para guardar.' }) })
      : original(url, init)))
    const alerta = vi.spyOn(window, 'alert').mockImplementation(() => {})
    await salvar()
    await waitFor(() => expect(alerta).toHaveBeenCalledWith(expect.stringMatching(/Cliente criado, mas os dados da conta não foram guardados: Não há dados da conta para guardar/)))
    alerta.mockRestore()
  })
})
