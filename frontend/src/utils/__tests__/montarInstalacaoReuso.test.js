import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * S4C-1 — testes 9 e 10 da ADR-019: PROVA de reutilização.
 * Mocka o módulo da fábrica e assere que o tradutor DELEGA (não reimplementa).
 */

vi.mock('../../../../backend/src/dominio/topologia/montarGerador.js', async (importOriginal) => {
  const real = await importOriginal()
  return {
    ...real,
    montarGerador: vi.fn(real.montarGerador),
    montarString: vi.fn(real.montarString),
    contarMpptsInversor: vi.fn(real.contarMpptsInversor),
  }
})

const fabrica = await import('../../../../backend/src/dominio/topologia/montarGerador.js')
const { montarInstalacao } = await import('../../../../backend/src/dominio/topologia/montarInstalacao.js')

const INV_2MPPT = { _id: 'inv-2', especificacoes: { n_mppts: 2 } }
const intencao = {
  geradores: [{
    inversor: INV_2MPPT, modulo_ref: 'mod-a', superficie_id: 'sup-1',
    topologia: [
      { entradas: [{ strings: [{ modulos: 12 }, { modulos: 12 }] }] },
      { entradas: [{ strings: [{ modulos: 8 }] }] },
    ],
  }],
}

beforeEach(() => vi.clearAllMocks())

describe('9. montarGerador foi reutilizado', () => {
  it('é chamado uma vez por gerador, com o doc do inversor', () => {
    montarInstalacao(intencao)
    expect(fabrica.montarGerador).toHaveBeenCalledTimes(1)
    expect(fabrica.montarGerador).toHaveBeenCalledWith(INV_2MPPT, { apelido: null })
  })
  it('MPPTs vêm da fábrica (INV-03 não reimplementada)', () => {
    montarInstalacao(intencao)
    expect(fabrica.contarMpptsInversor).toHaveBeenCalled()
  })
})

describe('10. montarString foi reutilizado', () => {
  it('é chamado uma vez por string não-vazia', () => {
    montarInstalacao(intencao)
    expect(fabrica.montarString).toHaveBeenCalledTimes(3)
  })
  it('recebe composição/superfície já traduzidas', () => {
    montarInstalacao(intencao)
    expect(fabrica.montarString).toHaveBeenNthCalledWith(1, {
      indice_entrada: 1,
      composicao: [{ modulo_ref: 'mod-a', quantidade: 12 }],
      superficie_id: 'sup-1',
      otimizador_ref: null,
    })
  })
  it('NÃO é chamado para string vazia (descartada antes)', () => {
    montarInstalacao({ geradores: [{
      inversor: { _id: 'i', especificacoes: { n_mppts: 1 } },
      modulo_ref: 'm', superficie_id: 's',
      topologia: [{ entradas: [{ strings: [{ modulos: 0 }] }] }],
    }] })
    expect(fabrica.montarString).not.toHaveBeenCalled()
  })
})
