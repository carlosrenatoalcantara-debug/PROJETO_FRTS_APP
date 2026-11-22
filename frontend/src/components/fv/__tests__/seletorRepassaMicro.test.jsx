import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

/** O objeto entregue ao E7 precisa carregar o lado CC do micro (regressão do 240fc95). */
vi.mock('../../../services/catalogoEngenhariaApi', () => ({
  buscarEquipamentosEngenharia: vi.fn().mockResolvedValue([{ _id: 'x' }]),
  registrarFallback: vi.fn(),
}))
vi.mock('../../../services/catalogoFlags', () => ({ obterFlags: vi.fn().mockResolvedValue({}) }))
vi.mock('../../../hooks/usePermissao', () => ({ usePermissao: () => ({ perfil: 'admin', anonimo: false }) }))
vi.mock('../../../utils/catalogoEngenhariaAdapter', () => ({
  agruparPaineis: () => ({}),
  agruparInversores: () => ({ micro: { MarcaTeste: { monofasico: [{
    id: 'm1', modelo: 'MICRO-X', potenciaKW: 2, nMppts: 2, garantia: 10, precoUnitario: 0,
    utilizavel_em_projeto: true, _fonte: 'catalogo', _micro: { entradas: 4, modulos_por_entrada: 1 },
  }] } } }),
}))

import SeletorInversores from '../SeletorInversores'

describe('SeletorInversores', () => {
  it('repassa _micro do catálogo ao selecionar', async () => {
    const onSelecionar = vi.fn()
    render(<SeletorInversores onSelecionar={onSelecionar} />)
    fireEvent.click(await screen.findByRole('button', { name: /microinversor/i }))
    fireEvent.click(await screen.findByRole('button', { name: /MarcaTeste/ }))
    fireEvent.click(await screen.findByRole('radio', { name: /Monof/ }))
    fireEvent.click(await screen.findByText('MICRO-X'))
    expect(onSelecionar).toHaveBeenCalledTimes(1)
    expect(onSelecionar.mock.calls[0][0]._micro).toEqual({ entradas: 4, modulos_por_entrada: 1 })
  })
})
