import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * "COSERN" lido da fatura precisa chegar ao select da E2 ("COSERN / Neoenergia (RN)").
 * Antes o E1 gravava só `distribuidora` e o select, que lê `concessionaria`, ficava
 * em branco. Dados fictícios.
 */
vi.mock('../../../ui/Dropzone', () => ({
  default: ({ onArquivo }) => (
    <button type="button" onClick={() => onArquivo(new File(['%PDF-1.4'], 'f.pdf', { type: 'application/pdf' }), 'f.pdf')}>enviar</button>
  ),
}))
const dispatchMock = vi.fn()
vi.mock('../../../../contexts/ProjetoFVContext', () => ({
  useProjetoFV: () => ({
    state: { dadosCliente: { nomeCliente: '', telefone: '', email: '' }, arquivo: null, nomeArquivo: '', dadosConsumo: {}, localizacao: {} },
    dispatch: dispatchMock, proxima: vi.fn(), anterior: vi.fn(),
  }),
}))

import E1Upload from '../E1Upload'

let extracao
beforeEach(() => {
  dispatchMock.mockClear()
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(extracao) }))
})

const consumoDespachado = () => dispatchMock.mock.calls.map(([a]) => a).find((a) => a.type === 'SET_CONSUMO')?.payload

async function enviar() {
  render(<E1Upload />)
  fireEvent.click(screen.getByText('enviar'))
  await waitFor(() => expect(consumoDespachado()).toBeTruthy())
  return consumoDespachado()
}

describe('E1 — concessionária extraída', () => {
  it('COSERN identifica a opção da lista', async () => {
    extracao = { consumoKwh: 397, distribuidora: 'COSERN', tipoLigacao: 'Trifásico 380V' }
    const p = await enviar()
    expect(p.distribuidora).toBe('COSERN')
    expect(p.concessionaria).toBe('COSERN / Neoenergia (RN)')
  })

  it('nome desconhecido: nada é chutado (o operador escolhe)', async () => {
    extracao = { consumoKwh: 397, distribuidora: 'Distribuidora Fictícia XYZ' }
    const p = await enviar()
    expect(p.distribuidora).toBe('Distribuidora Fictícia XYZ')
    expect(p).not.toHaveProperty('concessionaria')
  })

  it('nome ambíguo sem UF não é chutado', async () => {
    extracao = { consumoKwh: 397, distribuidora: 'ENEL' }
    expect(await enviar()).not.toHaveProperty('concessionaria')
  })
})
