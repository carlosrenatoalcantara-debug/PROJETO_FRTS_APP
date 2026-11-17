import { describe, it, expect } from 'vitest'
import { resolverCresesb, temSerieMensal } from '../irradianciaCresesb'
import { obterIrradianciaCity } from '../../data/irradianciaRN'

describe('obterIrradianciaCity — só casamento exato', () => {
  it('cidade da tabela, sem acento e sem caixa', () => {
    expect(obterIrradianciaCity('Parnamirim', 'RN')).toBe(5.4)
    expect(obterIrradianciaCity('SAO GONCALO DO AMARANTE', 'rn')).toBe(5.38)
    expect(obterIrradianciaCity('Caicó', 'RN')).toBe(5.62)
  })
  it('NÃO herda o valor de outra cidade por prefixo (Parelhas ≠ Parnamirim)', () => {
    expect(obterIrradianciaCity('Parelhas', 'RN')).toBeNull()
    expect(obterIrradianciaCity('Natalândia', 'RN')).toBeNull()
  })
  it('fora do RN ou sem cidade: null', () => {
    expect(obterIrradianciaCity('Natal', 'SP')).toBeNull()
    expect(obterIrradianciaCity('', 'RN')).toBeNull()
    expect(obterIrradianciaCity(null, 'RN')).toBeNull()
  })
})

describe('resolverCresesb — valor e origem coerentes', () => {
  it('cidade da tabela vence a média do estado, e a origem diz isso', () => {
    const r = resolverCresesb({ cidade: 'Parnamirim', uf: 'RN', mediaEstado: 5.9 })
    expect(r.valor).toBe(5.4)
    expect(r.origem).toBe('cidade')
    expect(r.rotulo).toMatch(/Parnamirim/)
  })
  it('cidade fora da tabela usa a média do estado e diz "estado"', () => {
    const r = resolverCresesb({ cidade: 'Parelhas', uf: 'RN', mediaEstado: 5.9 })
    expect(r).toMatchObject({ valor: 5.9, origem: 'estado' })
    expect(r.rotulo).toMatch(/estado RN/)
  })
  it('sem nenhum dado: null, nunca um número inventado', () => {
    expect(resolverCresesb({ cidade: 'X', uf: 'SP' })).toMatchObject({ valor: null, origem: null })
    expect(resolverCresesb()).toMatchObject({ valor: null })
  })
})

describe('temSerieMensal', () => {
  const mes = (vals) => vals.map((valor, i) => ({ mes: `m${i}`, valor }))
  it('12 valores distintos = série real', () => {
    expect(temSerieMensal(mes([6, 6.2, 5.9, 5.5, 5, 4.6, 4.7, 5.3, 6, 6.3, 6.4, 6.1]))).toBe(true)
  })
  it('12 valores IDÊNTICOS = série fabricada, não é série', () => {
    expect(temSerieMensal(mes(Array(12).fill(5.4)))).toBe(false)
  })
  it('null, tamanho errado ou valor inválido', () => {
    expect(temSerieMensal(null)).toBe(false)
    expect(temSerieMensal(mes([1, 2, 3]))).toBe(false)
    expect(temSerieMensal(mes([...Array(11).fill(5), null]))).toBe(false)
  })
})
