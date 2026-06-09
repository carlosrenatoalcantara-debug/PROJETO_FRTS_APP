import { describe, it, expect } from 'vitest'
import { extrairSpecsModulo, extrairSpecsModuloDeTokens, FAIXAS } from '../../../../backend/src/ai/parserTecnicoModulo.js'
import astronergy from '../../../../backend/src/ai/__fixtures__/golden/mod_astronergy_n5.json'
import znshine from '../../../../backend/src/ai/__fixtures__/golden/mod_znshine_bifacial.json'
import dahPoli from '../../../../backend/src/ai/__fixtures__/golden/mod_dah_poli.json'

/**
 * P0-MODULE-PARSER-01 — primeiro parser funcional de módulos PV.
 * Meta: 0 falso-positivo (na dúvida → null; nunca inventa).
 */

describe('FASE 2 — extração com rótulos STC (texto limpo)', () => {
  const txt = `Maximum Power (Pmax) 440W
Open-circuit Voltage (Voc) 49.0V
Maximum Power Voltage (Vmp) 41.8V
Short-circuit Current (Isc) 11.29A
Maximum Power Current (Imp) 10.52A
Module Efficiency (%) 22.5%
Number of Cells 144
Dimension (L×W×T) 2278x1134x30
Weight 32.1 kg`
  it('extrai os 9 campos corretamente', () => {
    expect(extrairSpecsModulo(txt)).toEqual({
      potencia_wp: 440, voc: 49, vmp: 41.8, isc: 11.29, imp: 10.52,
      eficiencia: 22.5, numero_celulas: 144, dimensoes: '2278x1134x30', peso: 32.1,
    })
  })
})

describe('FASE 3 — 0 falso-positivo (faixa + null na dúvida)', () => {
  it('dimensões GARBLED (90x80x975) → NÃO extrai (fora da faixa de módulo)', () => {
    expect(extrairSpecsModulo('Dimension 90x80x975').dimensoes).toBeUndefined()
    expect(extrairSpecsModulo('Dimension 80x90x100').dimensoes).toBeUndefined()
  })
  it('dimensões válidas de módulo → extrai', () => {
    expect(extrairSpecsModulo('Outer dimensions (L x W x H) 2278 x 1134 x 30 mm').dimensoes).toBe('2278x1134x30')
  })
  it('valores fora de faixa → null (potência 5000W, Voc 9999V, Isc 0.1A)', () => {
    expect(extrairSpecsModulo('Maximum Power (Pmax) 5000W').potencia_wp).toBeUndefined()
    expect(extrairSpecsModulo('Open-circuit Voltage (Voc) 9999V').voc).toBeUndefined()
    expect(extrairSpecsModulo('Short-circuit Current (Isc) 0.1A').isc).toBeUndefined()
  })
  it('nº de células inválido (45, 158 — não divisível por 6) → null', () => {
    expect(extrairSpecsModulo('Number of cells 45').numero_celulas).toBeUndefined()
    expect(extrairSpecsModulo('Number of cells 158').numero_celulas).toBeUndefined()
    expect(extrairSpecsModulo('Number of cells 144').numero_celulas).toBe(144)
  })
  it('texto vazio/sem specs → {} (nunca inventa)', () => {
    expect(extrairSpecsModulo('')).toEqual({})
    expect(extrairSpecsModulo('Texto qualquer sem dados elétricos')).toEqual({})
  })
})

describe('FASE 4 — fixtures golden (datasheets reais, via tokens)', () => {
  it('Astronergy ASTRO-N5: 9/9 campos', () => {
    const e = extrairSpecsModuloDeTokens(astronergy.tokens)
    expect(e).toMatchObject({ potencia_wp: 570, voc: 52, isc: 13.79, vmp: 43.7, imp: 13.04, eficiencia: 22.1, numero_celulas: 144, dimensoes: '2278x1134x30', peso: 32.1 })
  })
  it('ZNShine Bifacial: potência 620, Voc 52, células 144, dimensões 2384x1134x30', () => {
    const e = extrairSpecsModuloDeTokens(znshine.tokens)
    expect(e.potencia_wp).toBe(620); expect(e.voc).toBe(52); expect(e.numero_celulas).toBe(144); expect(e.dimensoes).toBe('2384x1134x30')
  })
  it('DAH POLI: extrai elétricos sem falso-positivo de células (158 rejeitado)', () => {
    const e = extrairSpecsModuloDeTokens(dahPoli.tokens)
    expect(e.potencia_wp).toBeGreaterThanOrEqual(FAIXAS.potencia_wp.min)
    expect(e.numero_celulas).toBeUndefined()   // 158 não é válido → não inventa
  })
  it('todos os valores das fixtures respeitam as faixas físicas', () => {
    for (const fx of [astronergy, znshine, dahPoli]) {
      const e = extrairSpecsModuloDeTokens(fx.tokens)
      for (const [k, f] of Object.entries(FAIXAS)) if (e[k] != null) { expect(e[k]).toBeGreaterThanOrEqual(f.min); expect(e[k]).toBeLessThanOrEqual(f.max) }
    }
  })
})

describe('FASE 3 — seleção de coluna por potência-alvo (multi-potência)', () => {
  // tabela matricial em texto: rótulos PT + 5 colunas (540..560)
  const matricial = `Potência de Pico em Watts-P MAX (Wp) 540 545 550 555 560
Tensão de Circuito Aberto-V OC (V) 46.4 46.6 46.9 47.1 47.2
Tensão Máxima de Potência-V (V) 41.2 41.4 41.6 41.9 42.2
Corrente de Potência Máxima-I MPP (A) 13.12 13.16 13.21 13.25 13.29`
  it('sem alvo → 1ª coluna (540)', () => {
    expect(extrairSpecsModulo(matricial)).toMatchObject({ potencia_wp: 540, voc: 46.4, vmp: 41.2, imp: 13.12 })
  })
  it('alvo=560 → coluna correta (560 / Voc 47.2 / Vmp 42.2 / Imp 13.29)', () => {
    expect(extrairSpecsModulo(matricial, { potenciaAlvo: 560 })).toMatchObject({ potencia_wp: 560, voc: 47.2, vmp: 42.2, imp: 13.29 })
  })
  it('alvo=550 → coluna do meio (550 / Voc 46.9 / Vmp 41.6)', () => {
    expect(extrairSpecsModulo(matricial, { potenciaAlvo: 550 })).toMatchObject({ potencia_wp: 550, voc: 46.9, vmp: 41.6 })
  })
  it('alvo sem coluna correspondente (999W) → cai para a 1ª (não inventa)', () => {
    expect(extrairSpecsModulo(matricial, { potenciaAlvo: 999 }).potencia_wp).toBe(540)
  })
  it('dimensões com separador "." (Trina 2278.1134.30) → válidas', () => {
    expect(extrairSpecsModulo('Dimensões do módulo 2278.1134.30 mm').dimensoes).toBe('2278x1134x30')
  })
})
