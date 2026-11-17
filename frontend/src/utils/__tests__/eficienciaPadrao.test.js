import { describe, it, expect } from 'vitest'
import {
  resolverEficienciaPadrao, perdasPctDaEficiencia, EFICIENCIA_FALLBACK,
} from '../eficienciaPadrao'

describe('resolverEficienciaPadrao', () => {
  it('valor configurado dentro da faixa vence, com origem "configurado"', () => {
    expect(resolverEficienciaPadrao(0.75)).toEqual({ valor: 0.75, origem: 'configurado' })
    expect(resolverEficienciaPadrao(0.5).origem).toBe('configurado')
    expect(resolverEficienciaPadrao(1).origem).toBe('configurado')
  })
  it('sem configuração (ou inválida) cai em 0,80, declarado "padrao_sistema"', () => {
    for (const v of [null, undefined, NaN, 0.3, 1.2, '0.75']) {
      expect(resolverEficienciaPadrao(v)).toEqual({ valor: EFICIENCIA_FALLBACK, origem: 'padrao_sistema' })
    }
    expect(EFICIENCIA_FALLBACK).toBe(0.8)
  })
  it('perdas equivalentes: 0,75 → 25%, 0,8 → 20%', () => {
    expect(perdasPctDaEficiencia(0.75)).toBe(25)
    expect(perdasPctDaEficiencia(0.8)).toBe(20)
  })
})
