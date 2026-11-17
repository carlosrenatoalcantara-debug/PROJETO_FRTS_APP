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

describe('UC — número da unidade consumidora', () => {
  it('formato ATUAL: rótulo "NÚMERO DA UNIDADE CONSUMIDORA" + NNN.NNN.NNN-NN na linha seguinte', () => {
    expect(extrairDadosDoTexto(FATURA_COSERN_NOVA).numeroCliente).toBe('001.234.567-89')
  })
  it('formato LEGADO: "CÓDIGO DO CLIENTE" + só dígitos', () => {
    expect(extrairDadosDoTexto(FATURA_COSERN_LEGADA).numeroCliente).toBe('7012345678')
  })
  it('rótulo e valor na mesma linha', () => {
    const t = 'NÚMERO DA UNIDADE CONSUMIDORA: 009.876.543-21\nOUTRA LINHA'
    expect(extrairDadosDoTexto(t).numeroCliente).toBe('009.876.543-21')
  })
  it('armadilhas: sem o rótulo, débito em conta / medidor / chave / nota NÃO viram UC', () => {
    const semUc = FATURA_COSERN_NOVA
      .replace('NÚMERO DA UNIDADE CONSUMIDORA\n001.234.567-89\n', '')
    expect(extrairDadosDoTexto(semUc).numeroCliente).toBeNull()
  })
  it('rótulo presente mas valor fora do formato: não aceita qualquer número', () => {
    const t = 'NÚMERO DA UNIDADE CONSUMIDORA\n987654321\n'
    expect(extrairDadosDoTexto(t).numeroCliente).toBeNull()
  })
})
