import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

/**
 * Item 3 — a quantidade de módulos é de E7. O configurador monta as strings
 * a partir dela e nunca a devolve ao campo. Equipamentos fictícios.
 */
vi.mock('../../../hooks/useCompatibilidadeEletrica', () => ({
  useCompatibilidadeEletrica: () => ({ resultado: null, carregando: false, erro: null }),
}))

import ConfiguradorArranjoFV from '../ConfiguradorArranjoFV'

const PAINEL = { id: 'mod-teste', _fonte: 'catalogo', marca: 'Teste', modelo: 'M-620', potenciaW: 620, voc: 55, vmpp: 46, isc: 14, impp: 13.5, coef_temp_voc: -0.25, temp_noct: 45 }
const INVERSOR = {
  id: 'inv-teste', _fonte: 'catalogo', marca: 'Teste', modelo: 'S-10K', potenciaKW: 10, nMppts: 2, fases: 1,
  _eletrico: { tensao_max_entrada: 1100, mppt_min: 140, mppt_max: 1000, corrente_max_mppt: 32, entradas_por_mppt: 2 },
}

let dispatch
beforeEach(() => {
  dispatch = vi.fn()
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
})

const props = (numPaineis) => ({ painel: PAINEL, inversor: INVERSOR, numPaineis, uf: 'RN', projetoId: 'p1', dispatch, tipoLigacao: 'monofasico' })
const totalNaTela = () => Number(screen.getByText('Total configurado').parentElement.querySelector('span').textContent)

describe('quantidade de módulos — fonte única em E7', () => {
  it('16 módulos montam 16 nas strings (antes viravam 18)', () => {
    render(<ConfiguradorArranjoFV {...props(16)} />)
    expect(totalNaTela()).toBe(16)
    expect(screen.queryByTestId('divergencia-qtd')).toBeNull()
  })

  it('o configurador não escreve a quantidade de volta no contexto', () => {
    render(<ConfiguradorArranjoFV {...props(16)} />)
    const tipos = dispatch.mock.calls.map(([a]) => a.payload?.tipo ?? Object.keys(a.payload || {}).join(','))
    expect(tipos).not.toContain('quantidadeModulos')
    for (const [a] of dispatch.mock.calls) {
      if (a.type === 'SET_DIMENSIONAMENTO') {
        expect(a.payload).not.toHaveProperty('numPaineis')
        expect(a.payload).not.toHaveProperty('potenciaRealKwp')
      }
    }
  })

  it('mudar a quantidade em E7 refaz as strings', () => {
    const { rerender } = render(<ConfiguradorArranjoFV {...props(16)} />)
    rerender(<ConfiguradorArranjoFV {...props(18)} />)
    expect(totalNaTela()).toBe(18)
    rerender(<ConfiguradorArranjoFV {...props(17)} />)
    expect(totalNaTela()).toBe(17)
  })
})
