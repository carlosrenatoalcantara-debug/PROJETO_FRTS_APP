/**
 * Extração determinística de fatura (caminho PDF) — fixtures SINTÉTICAS.
 * Nenhum dado real: ver backend/src/dominio/fatura/__fixtures__/faturasSinteticas.js.
 */
import { describe, it, expect } from 'vitest'
import { extrairDadosDoTexto } from '../../../backend/src/dominio/fatura/textoFatura.js'
import {
  FATURA_COSERN_NOVA, FATURA_COSERN_LEGADA,
} from '../../../backend/src/dominio/fatura/__fixtures__/faturasSinteticas.js'

describe('refator sem mudança de comportamento — campos que já funcionavam', () => {
  const d = extrairDadosDoTexto(FATURA_COSERN_NOVA)
  it('nome, endereço, CEP, cidade, UF', () => {
    expect(d.nome).toBe('FULANO DE TAL TESTE')
    expect(d.endereco).toBe('RUA DOS TESTES 100 BAIRRO FICTICIO')
    expect(d.cep).toBe('59000-000')
    expect(d.cidade).toBe('CIDADE TESTE')
    expect(d.estado).toBe('RN')
  })
  it('classificação, subgrupo, ligação trifásica 380', () => {
    expect(d.classificacao).toBe('B1')
    expect(d.subgrupo).toBe('Residencial')
    expect(d.tipoLigacao).toBe('Trifásico 380V')
  })
})
