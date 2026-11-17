import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { precoExibivel } from '../../../utils/precoExibivel'

/**
 * Card de módulo/inversor mostrava "≈ R$ 0/un" quando o catálogo não tem preço.
 * Preço ausente = nada na tela. Dados fictícios.
 */
vi.mock('../../../services/catalogoEngenhariaApi', () => ({
  buscarEquipamentosEngenharia: vi.fn().mockResolvedValue([{ _id: 'x' }]),
  registrarFallback: vi.fn(),
}))
vi.mock('../../../services/catalogoFlags', () => ({ obterFlags: vi.fn().mockResolvedValue({}) }))
vi.mock('../../../hooks/usePermissao', () => ({ usePermissao: () => ({ perfil: 'admin', anonimo: false }) }))

const painel = (modelo, precoUnitario) => ({
  id: modelo, marca: 'MarcaTeste', modelo, potenciaW: 620, tecnologia: 'N-type', bifacial: false,
  eficiencia: 22, voc: 50, vmpp: 42, isc: 14, imp: 13, garantiaProduto: 12, garantiaPerformance: 25,
  percentualPerformance: 87, precoUnitario, utilizavel_em_projeto: true,
})
const inversor = (modelo, precoUnitario) => ({
  id: modelo, modelo, potenciaKW: 5, nMppts: 2, garantia: 10, precoUnitario, utilizavel_em_projeto: true,
})
vi.mock('../../../utils/catalogoEngenhariaAdapter', () => ({
  agruparPaineis: () => ({ MarcaTeste: [painel('SEM-PRECO-0', 0), painel('SEM-PRECO-NULL', null), painel('COM-PRECO', 410)] }),
  agruparInversores: () => ({ string: { MarcaTeste: { monofasico: [inversor('INV-ZERO', 0), inversor('INV-NULL', null), inversor('INV-COM', 5500)] } } }),
}))

import SeletorPaineis from '../SeletorPaineis'
import SeletorInversores from '../SeletorInversores'

describe('precoExibivel', () => {
  it('só número finito > 0', () => {
    expect(precoExibivel(410)).toBe(410)
    expect(precoExibivel('410')).toBe(410)
    for (const v of [0, null, undefined, '', 'abc', NaN, -5]) expect(precoExibivel(v)).toBeNull()
  })
})

describe('cards sem preço', () => {
  it('módulos: só o que tem preço mostra "≈ R$"; nunca "R$ 0"', async () => {
    render(<SeletorPaineis onSelecionar={vi.fn()} />)
    await screen.findByText('COM-PRECO')
    expect(screen.getAllByTestId('preco-painel')).toHaveLength(1)
    expect(document.body.textContent).toMatch(/≈ R\$ 410\/un/)
    expect(document.body.textContent).not.toMatch(/R\$ 0/)
    expect(screen.getByText('SEM-PRECO-0')).toBeTruthy()   // o card continua aparecendo
  })

  it('inversores: idem', async () => {
    render(<SeletorInversores onSelecionar={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /string/i }))
    fireEvent.click(await screen.findByRole('button', { name: /MarcaTeste/ }))
    fireEvent.click(await screen.findByRole('radio', { name: /Monof/ }))
    await screen.findByText('INV-COM')
    await waitFor(() => expect(screen.getAllByTestId('preco-inversor')).toHaveLength(1))
    expect(document.body.textContent).not.toMatch(/R\$ 0/)
    expect(screen.getByText('INV-ZERO')).toBeTruthy()
  })
})
