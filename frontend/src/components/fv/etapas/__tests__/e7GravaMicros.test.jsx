import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * Item 3 (opção A) — o E7 grava o fato canônico do micro
 * (`arranjos[].configuracao_eletrica.micros[]`) ao avançar. Dados fictícios.
 */
const salvarArranjos = vi.fn(() => Promise.resolve({}))
vi.mock('../../../../services/projetoFVApi', () => ({ salvarArranjos: (...a) => salvarArranjos(...a) }))

let estado
const proxima = vi.fn()
vi.mock('../../../../contexts/ProjetoFVContext', () => ({
  useProjetoFV: () => ({ state: estado, dispatch: vi.fn(), proxima, anterior: vi.fn() }),
}))

// Filhos pesados (buscam catálogo) não interessam a este teste.

vi.mock('../../SeletorPaineis', () => ({ default: () => null }))
vi.mock('../../SeletorInversores', () => ({ default: () => null }))
vi.mock('../../SeletorEstrutura', () => ({ default: () => null }))
vi.mock('../../ConfiguradorArranjoFV', () => ({ default: () => null }))
vi.mock('../../GerenciadorArranjos', () => ({ default: () => null }))
vi.mock('../../ResumoTecnicoArranjo', () => ({ default: () => null }))
vi.mock('../../SugestaoTopologiaReferencia', () => ({ default: () => null }))

import E7Equipamentos from '../E7Equipamentos'

const PAINEL = { id: '64b0000000000000000000aa', marca: 'Teste', modelo: 'M-620', potenciaW: 620 }
const MICRO = { id: '64b000000000000000000001', marca: 'Teste', modelo: 'MICRO-2K', potenciaKW: 2, tipo: 'micro', _micro: { entradas: 4, modulos_por_entrada: 1 } }

beforeEach(() => {
  salvarArranjos.mockClear()
  global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve(null) }))
  estado = {
    projetoId: 'p1', tipoProjeto: 'novo', arranjos: [],
    equipamentos: { painel: PAINEL, inversor: MICRO, estrutura: { id: 'est1' }, quantidadeModulos: 16, quantidadeMicros: null },
    dimensionamento: { numPaineis: 16 }, localizacao: {}, area: {},
    dadosConsumo: { tipoLigacao: 'monofasico' },
  }
})

describe('E7 — micro', () => {
  it('ao avançar, o arranjo primário leva topologia micro e micros[] com a distribuição', async () => {
    render(<E7Equipamentos />)
    fireEvent.click(screen.getByText(/Próxima/))
    await waitFor(() => expect(salvarArranjos).toHaveBeenCalled())
    const [, lista] = salvarArranjos.mock.calls[0]
    const primario = lista.find((a) => a.tipo === 'principal')
    expect(primario.topologia).toBe('micro')
    expect(primario.inversores[0].quantidade).toBe(4)
    expect(primario.configuracao_eletrica.micros).toEqual([expect.objectContaining({
      equipamento_id: '64b000000000000000000001', quantidade: 4,
      entradas_por_micro: 4, modulos_por_entrada: 1, distribuicao: [4, 4, 4, 4],
    })])
  })

  it('inversor string: arranjo sem micros[] (como antes)', async () => {
    estado.equipamentos.inversor = { id: '64b000000000000000000002', marca: 'Teste', modelo: 'S-10K', potenciaKW: 10 }
    render(<E7Equipamentos />)
    fireEvent.click(screen.getByText(/Próxima/))
    await waitFor(() => expect(salvarArranjos).toHaveBeenCalled())
    const primario = salvarArranjos.mock.calls[0][1].find((a) => a.tipo === 'principal')
    expect(primario.configuracao_eletrica).toBeUndefined()
    expect(primario.topologia).toBeUndefined()
  })
})
