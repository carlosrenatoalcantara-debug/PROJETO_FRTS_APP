import { describe, it, expect } from 'vitest'
import { obterTopologiaState, resumoTopologiaArranjo, validarAlocacao } from '../obterTopologiaState'
import { agregarTotaisArranjos, resumoTecnicoArranjo, validarAlocacao as validarAlocacaoLegado } from '../agregarArranjosFV'

/**
 * S4B — adapter frontend é ponto único de leitura da topologia.
 * Garante BYTE-IDENTIDADE com o agregador legado (delega 100% a Arranjo hoje).
 */

const state = {
  equipamentos: { painel: { potencia_w: 550 }, inversor: { modelo: 'MIN-10' }, quantidadeModulos: 24 },
  arranjos: [
    { rotulo: 'Arranjo B', paineis: [{ quantidade: 12, potencia_w: 555 }], inversores: [{ quantidade: 1 }] },
  ],
  dimensionamento: { numPaineis: 24 },
}

const arranjo = { paineis: [{ quantidade: 20, potencia_w: 550, modelo: 'CS-550' }], inversores: [{ quantidade: 1, potencia_kw: 10, modelo: 'MIN-10' }] }
const catalogo = { modulos: [], inversores: [] }

describe('obterTopologiaState — byte-idêntico ao agregador legado', () => {
  it('totais idênticos', () => {
    expect(obterTopologiaState(state)).toEqual(agregarTotaisArranjos(state))
  })
  it('resumo por arranjo idêntico', () => {
    expect(resumoTopologiaArranjo(arranjo, catalogo)).toEqual(resumoTecnicoArranjo(arranjo, catalogo))
  })
  it('validarAlocacao reexportado idêntico', () => {
    expect(validarAlocacao(24, [{ capacidadeModulos: 30, quantidade: 1 }]))
      .toEqual(validarAlocacaoLegado(24, [{ capacidadeModulos: 30, quantidade: 1 }]))
  })
  it('estado vazio não quebra', () => {
    expect(() => obterTopologiaState({})).not.toThrow()
    expect(obterTopologiaState({})).toEqual(agregarTotaisArranjos({}))
  })
})
