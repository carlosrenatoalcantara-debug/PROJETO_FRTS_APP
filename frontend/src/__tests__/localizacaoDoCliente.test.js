/**
 * O projeto FV nasce com UF/cidade/CEP/endereço do cadastro do cliente: antes a
 * UF do projeto canônico ficava null. Dados fictícios — nenhum cliente real.
 */
import { describe, it, expect } from 'vitest'
import { localizacaoDoCliente } from '../../../backend/src/dominio/projeto/localizacaoDoCliente.js'

describe('localizacaoDoCliente', () => {
  it('copia os campos presentes, nos nomes de localizacao', () => {
    expect(localizacaoDoCliente({
      estado: 'RN', cidade: 'Natal', cep: '59000-000', endereco_completo: 'Rua Fictícia, 100, Natal, RN',
    })).toEqual({ estado: 'RN', cidade: 'Natal', cep: '59000-000', endereco_completo: 'Rua Fictícia, 100, Natal, RN' })
  })

  it('ausente, vazio ou só espaço é omitido — nunca default', () => {
    expect(localizacaoDoCliente({ estado: '', cidade: '   ', cep: null, endereco_completo: undefined })).toEqual({})
    expect(localizacaoDoCliente({ estado: 'RN' })).toEqual({ estado: 'RN' })
  })

  it('UF: 2 letras, normalizada; por extenso não é convertida (nem adivinhada)', () => {
    expect(localizacaoDoCliente({ estado: ' rn ' }).estado).toBe('RN')
    expect(localizacaoDoCliente({ estado: 'Rio Grande do Norte' })).toEqual({})
    expect(localizacaoDoCliente({ estado: 'R1' })).toEqual({})
  })

  it('coordenadas e geocodificação não vêm do cadastro', () => {
    const r = localizacaoDoCliente({ estado: 'RN', latitude: -5.8, longitude: -35.2 })
    expect(r).not.toHaveProperty('latitude')
    expect(r).not.toHaveProperty('longitude')
  })

  it('entrada inválida devolve vazio', () => {
    for (const v of [null, undefined, 'x', 3]) expect(localizacaoDoCliente(v)).toEqual({})
  })
})
