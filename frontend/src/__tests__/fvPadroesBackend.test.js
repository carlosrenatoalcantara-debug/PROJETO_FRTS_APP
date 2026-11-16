import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  validarFvPadroes, EFICIENCIA_FALLBACK, EFICIENCIA_MIN, EFICIENCIA_MAX,
} from '../../../backend/src/dominio/empresa/fvPadroes.js'

describe('validarFvPadroes — eficiência padrão 0,50–1,00', () => {
  it('aceita valores dentro da faixa, inclusive os limites', () => {
    for (const v of [0.5, 0.75, 0.8, 1]) expect(validarFvPadroes({ eficiencia_padrao: v }).ok).toBe(true)
  })
  it('recusa fora da faixa, com mensagem que explica (75 em vez de 0,75)', () => {
    for (const v of [0.49, 1.01, 75, 0, -1]) {
      const r = validarFvPadroes({ eficiencia_padrao: v })
      expect(r.ok).toBe(false)
      expect(r.erro).toMatch(/entre 0.5 e 1/)
    }
  })
  it('recusa não numérico (texto, NaN, array)', () => {
    for (const v of ['0.75', NaN, [0.75], {}, true]) expect(validarFvPadroes({ eficiencia_padrao: v }).ok).toBe(false)
  })
  it('null limpa a configuração (volta ao padrão do sistema)', () => {
    expect(validarFvPadroes({ eficiencia_padrao: null }).ok).toBe(true)
  })
  it('grupo ausente é válido (PUT de outro grupo); grupo não objeto não é', () => {
    expect(validarFvPadroes(undefined).ok).toBe(true)
    expect(validarFvPadroes('x').ok).toBe(false)
    expect(validarFvPadroes(null).ok).toBe(false)
    expect(validarFvPadroes([]).ok).toBe(false)
  })
  it('fallback do sistema continua 0,80 e está dentro da faixa', () => {
    expect(EFICIENCIA_FALLBACK).toBe(0.8)
    expect(EFICIENCIA_FALLBACK).toBeGreaterThanOrEqual(EFICIENCIA_MIN)
    expect(EFICIENCIA_FALLBACK).toBeLessThanOrEqual(EFICIENCIA_MAX)
  })
})

describe('rota /api/empresa', () => {
  // Caminho por variável: com literal, o Vite reescreve `new URL(..., import.meta.url)` como asset.
  const lerRota = (rel = '../../../backend/src/routes/empresa.js') =>
    readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
  it('valida antes de gravar e responde 400 com código', () => {
    const rota = lerRota()
    expect(rota).toMatch(/validarFvPadroes\(req\.body\.fv_padroes\)/)
    expect(rota).toMatch(/status\(400\)[^\n]*FV_PADROES_INVALIDO/)
    expect(rota.indexOf('validarFvPadroes(')).toBeLessThan(rota.indexOf('findOneAndUpdate'))
  })
  it('o grupo está na lista de grupos aceitos (merge raso preserva os demais)', () => {
    const rota = lerRota()
    expect(rota).toMatch(/GRUPOS = \[[^\]]*'fv_padroes'/)
  })
})
