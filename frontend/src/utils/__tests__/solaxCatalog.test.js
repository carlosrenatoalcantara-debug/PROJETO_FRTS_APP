import { describe, it, expect } from 'vitest'
import { extrairFabricanteModelo, ehDefaultLixo, FABRICANTES_RECONHECIDOS } from '../../../../backend/src/utils/catalogo/fabricanteModeloFallback.js'

/**
 * P1-SOLAX-CATALOG-01 — integração do fabricante SolaX (por FAMÍLIA, não por modelo).
 * Padrão semântico: X<fase>-<FAMÍLIA>-<potência>[-variante], gated pelo alias "solax".
 */

describe('1. Reconhecimento de fabricante (SolaX / Solax / SOLAX)', () => {
  for (const grafia of ['SolaX', 'Solax', 'SOLAX', 'solax']) {
    it(`grafia "${grafia}" → fabricante=SolaX`, () => {
      const r = extrairFabricanteModelo(`${grafia} Power Inverter X1-SPT-10K Residential`)
      expect(r.fabricante).toBe('SolaX')
      expect(r.modelo).toBe('X1-SPT-10K')
    })
  }
})

describe('2. Reconhecimento de FAMÍLIA (4 famílias dos datasheets)', () => {
  const CASOS = [
    ['SolaX X1-SPT-12K datasheet', 'X1-SPT-12K'],
    ['SolaX X3-HYBRID-10.0-M ficha', 'X3-HYBRID-10.0-M'],
    ['SolaX X3-Huge-15.0-LV series', 'X3-HUGE-15.0-LV'],
    ['SolaX X3-ULT-30K three-phase', 'X3-ULT-30K'],
    ['SolaX X3-ULT-19.9K', 'X3-ULT-19.9K'],
  ]
  for (const [texto, modelo] of CASOS) {
    it(`${modelo}`, () => {
      const r = extrairFabricanteModelo(texto)
      expect(r.fabricante).toBe('SolaX')
      expect(r.modelo).toBe(modelo)
    })
  }
})

describe('3. Generalização — modelos FUTUROS cobertos sem novo código', () => {
  const FUTUROS = [
    'X1-SPT-15K',     // mesma família, potência nova
    'X3-ULT-50K',     // potência inédita
    'X3-ULT-99.9K',   // potência inédita decimal
    'X3-HYBRID-20.0-D', // potência nova
    'X3-BOOST-8K',    // família futura (fallback de família)
    'X3-MEGA-125K',   // família futura
  ]
  for (const m of FUTUROS) {
    it(`futuro: ${m} reconhecido`, () => {
      const r = extrairFabricanteModelo(`SolaX ${m} novo lançamento`)
      expect(r.fabricante).toBe('SolaX')
      expect(r.modelo).toBeTruthy()
    })
  }
})

describe('4. Risco de colisão — X1/X3 SEM alias "solax" não vira SolaX', () => {
  it('texto com X3-ULT-30K mas SEM "solax" → não identifica SolaX', () => {
    const r = extrairFabricanteModelo('Generic inverter model X3-ULT-30K spec sheet')
    expect(r.fabricante).not.toBe('SolaX')
  })
})

describe('5. Persistência em lote — item SolaX passa na guarda', () => {
  it('fabricante+modelo válidos → não é default-lixo, persistível', () => {
    const r = extrairFabricanteModelo('SolaX X3-ULT-25K')
    expect(r.fabricante && r.modelo).toBeTruthy()
    const bloqueado = ehDefaultLixo(r.fabricante, 'fabricante') && ehDefaultLixo(r.modelo, 'modelo')
    expect(bloqueado).toBe(false)         // criarInversoresLote NÃO rejeita
    expect(ehDefaultLixo(r.fabricante, 'fabricante')).toBe(false) // fabricante presente
  })
})

describe('6. Regressão — fabricantes existentes intactos', () => {
  const CASOS = [
    ['GoodWe GW25K-DT', 'Goodwe'],
    ['Sungrow SG110CX-P2', 'Sungrow'],
    ['Deye SUN-23K-G04-LV', 'Deye'],
    ['Huawei SUN2000-100KTL-M2', 'Huawei'],
    ['Solis S6-GR1P5K', 'Solis'],
    ['SAJ R5-8K-S2', 'SAJ'],
    ['Hoymiles HMS-2000DW-4T', 'Hoymiles'],
    ['TSUN TSOL-MX3000D', 'TSUN'],
  ]
  for (const [texto, fab] of CASOS) {
    it(`${fab} ainda reconhecido`, () => {
      expect(extrairFabricanteModelo(texto).fabricante).toBe(fab)
    })
  }
  it('SolaX consta em FABRICANTES_RECONHECIDOS', () => {
    expect(FABRICANTES_RECONHECIDOS).toContain('SolaX')
  })
})
