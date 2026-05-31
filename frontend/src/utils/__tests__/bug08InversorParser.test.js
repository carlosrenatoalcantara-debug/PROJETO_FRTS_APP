import { describe, it, expect } from 'vitest'
import {
  extrairFabricanteModelo,
  normalizarIdentificacao,
  ehDefaultLixo,
} from '../../../../backend/src/utils/catalogo/fabricanteModeloFallback.js'

/**
 * BUG-08-REAL-FINAL — reconhecimento de inversores (multi-fabricante).
 *
 * Evidência de produção: Growatt MID25KTL3-X → POST 400 CAMPOS_OBRIGATORIOS
 * (modelo perdido porque o parser não tinha padrão da série MID).
 */

// Trechos representativos de datasheet (o que o OCR extrairia)
const TXT_GROWATT = 'Growatt New Energy\nString Inverter\nMID 25KTL3-X\nMax. AC power 25000W'
const TXT_GOODWE  = 'GoodWe Power Supply\nGW20KT-DT\nRated AC Output Power 20kW'
const TXT_DEYE    = 'Ningbo Deye Inverter Technology\nSUN-75K-G\n75kW Three Phase Inverter'

describe('BUG-08 — parser de inversores (casos de produção)', () => {
  it('Growatt MID25KTL3-X é reconhecido (era o bug)', () => {
    const r = extrairFabricanteModelo(TXT_GROWATT)
    expect(r.fabricante).toBe('Growatt')
    expect(r.modelo).toMatch(/^MID25KTL3-X/i)
  })

  it('Goodwe GW20KT-DT é reconhecido (2 dígitos)', () => {
    const r = extrairFabricanteModelo(TXT_GOODWE)
    expect(r.fabricante).toBe('Goodwe')
    expect(r.modelo).toMatch(/^GW20KT/i)
  })

  it('Deye SUN-75K-G é reconhecido', () => {
    const r = extrairFabricanteModelo(TXT_DEYE)
    expect(r.fabricante).toBe('Deye')
    expect(r.modelo).toMatch(/^SUN-?75K/i)
  })
})

describe('BUG-08 — novos fabricantes suportados', () => {
  const casos = [
    ['SolarEdge', 'SolarEdge Technologies\nSE5000H-RWS\n5kW', /^SE5000H/i],
    ['Sungrow',   'Sungrow Power\nSG110CX\nstring inverter', /^SG110CX/i],
    ['Fronius',   'Fronius International\nSymo 12.5-3-M', /^Symo12\.5/i],
    ['Solis',     'Ginlong Solis\nRHI-5K-48ES', /^RHI-5K/i],
    ['Huawei',    'Huawei Technologies\nSUN2000-100KTL-H1', /^SUN2000-100KTL/i],
    ['Chint',     'Chint Power Systems\nCPS SCA50KTL-DO', /^CPSSCA50KTL/i],
    ['WEG',       'WEG Solar inversor\nSIW500H-ST', /^SIW500H/i],
  ]
  it.each(casos)('%s reconhecido', (fab, txt, re) => {
    const r = extrairFabricanteModelo(txt)
    expect(r.fabricante.toLowerCase()).toContain(fab.toLowerCase().slice(0, 4))
    expect(r.modelo).toMatch(re)
  })
})

describe('BUG-08 — normalizarIdentificacao (garante 3 campos antes do POST)', () => {
  it('Growatt: IA sem modelo → recupera via regex → ok', () => {
    // Simula IA que achou fabricante mas perdeu o modelo
    const dados = { tipo: 'inversor', fabricante: 'Growatt', modelo: null }
    const r = normalizarIdentificacao(dados, TXT_GROWATT, 'inversor')
    expect(r.ok).toBe(true)
    expect(r.tipo).toBe('inversor')
    expect(r.fabricante).toBe('Growatt')
    expect(r.modelo).toMatch(/^MID25KTL3-X/i)
    expect(r.faltando).toHaveLength(0)
  })

  it('IA devolve "Inversor" lixo como modelo → tratado como ausente e recuperado', () => {
    const dados = { tipo: 'inversor', fabricante: 'Deye', modelo: 'Inversor' }
    expect(ehDefaultLixo('Inversor', 'modelo')).toBe(true)
    const r = normalizarIdentificacao(dados, TXT_DEYE, 'inversor')
    expect(r.ok).toBe(true)
    expect(r.modelo).toMatch(/^SUN-?75K/i)
  })

  it('sem texto e sem dados → NÃO ok, lista campos faltantes (bloqueia POST)', () => {
    const r = normalizarIdentificacao({ tipo: 'inversor' }, '', 'inversor')
    expect(r.ok).toBe(false)
    expect(r.faltando).toEqual(expect.arrayContaining(['fabricante', 'modelo']))
  })

  it('tipo ausente entra em faltando', () => {
    const r = normalizarIdentificacao({ fabricante: 'Growatt', modelo: 'MID25KTL3-X' }, '', null)
    expect(r.ok).toBe(false)
    expect(r.faltando).toContain('tipo')
  })
})
