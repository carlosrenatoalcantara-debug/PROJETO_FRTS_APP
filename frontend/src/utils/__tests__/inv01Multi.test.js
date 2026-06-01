import { describe, it, expect } from 'vitest'
import { normalizarMulti, mapearEspecificacoes } from '../../../../backend/src/ai/normalizarMulti.js'
import { expandirModelosInversor, rawMultiDeTexto } from '../../../../backend/src/ai/serieInversor.js'
import { AIOrchestrator } from '../../../../backend/src/ai/AIOrchestrator.js'

/** P0-INV-01A — 1 PDF → N modelos. */

// Resultado bruto estilo IA (Claude) para a série Growatt MID (3 modelos)
const RAW_GROWATT_MID = {
  fabricante: 'Growatt',
  modelo: 'MID15KTL3-X',
  tipo: 'inversor',
  subtipo: 'string',
  variantes: [
    { modelo_variante: 'MID15KTL3-X', potencia_nominal_kw: 15, n_mppts: 2, tensao_max_entrada: 1100, eficiencia_maxima: 98.4, peso_kg: 25 },
    { modelo_variante: 'MID20KTL3-X', potencia_nominal_kw: 20, n_mppts: 2, tensao_max_entrada: 1100, eficiencia_maxima: 98.6, peso_kg: 27 },
    { modelo_variante: 'MID25KTL3-X', potencia_nominal_kw: 25, n_mppts: 2, tensao_max_entrada: 1100, eficiencia_maxima: 98.6, peso_kg: 27 },
  ],
}

const RAW_GOODWE_DT = {
  fabricante: 'Goodwe', modelo: 'GW17K-DT', tipo: 'inversor',
  variantes: [
    { modelo_variante: 'GW17K-DT', potencia_nominal_kw: 17, n_mppts: 2 },
    { modelo_variante: 'GW20K-DT', potencia_nominal_kw: 20, n_mppts: 2 },
    { modelo_variante: 'GW25K-DT', potencia_nominal_kw: 25, n_mppts: 2 },
  ],
}

describe('normalizarMulti (1 PDF → N equipamentos)', () => {
  it('Growatt MID: 3 variantes → 3 itens com specs próprias', () => {
    const itens = normalizarMulti(RAW_GROWATT_MID)
    expect(itens).toHaveLength(3)
    expect(itens.map(i => i.modelo)).toEqual(['MID15KTL3-X', 'MID20KTL3-X', 'MID25KTL3-X'])
    expect(itens[0].fabricante).toBe('Growatt')
    expect(itens[0].especificacoes.potencia_kw).toBe(15)
    expect(itens[2].especificacoes.potencia_kw).toBe(25)
    expect(itens[1].especificacoes.eficiencia_maxima).toBe(98.6)
  })

  it('Goodwe DT: 3 variantes → 3 itens', () => {
    const itens = normalizarMulti(RAW_GOODWE_DT)
    expect(itens.map(i => i.modelo)).toEqual(['GW17K-DT', 'GW20K-DT', 'GW25K-DT'])
  })

  it('dedup intra-PDF por fabricante+modelo', () => {
    const itens = normalizarMulti({
      fabricante: 'Growatt', tipo: 'inversor',
      variantes: [{ modelo_variante: 'MID25KTL3-X' }, { modelo_variante: 'MID25KTL3-X' }],
    })
    expect(itens).toHaveLength(1)
  })

  it('fallback: sem variantes mas com modelo de topo → 1 item', () => {
    const itens = normalizarMulti({ fabricante: 'Deye', modelo: 'SUN-75K-G', tipo: 'inversor', variantes: [] })
    expect(itens).toHaveLength(1)
    expect(itens[0].modelo).toBe('SUN-75K-G')
  })

  it('módulo (não-inversor) → 1 equipamento', () => {
    const itens = normalizarMulti({ fabricante: 'Jinko', modelo: 'JKM550M', tipo: 'modulo', variantes: [{ potenciaW: 550 }] })
    expect(itens).toHaveLength(1)
    expect(itens[0].tipo).toBe('modulo')
  })

  it('mapearEspecificacoes só inclui chaves presentes', () => {
    const esp = mapearEspecificacoes({ potencia_nominal_kw: 20, n_mppts: null })
    expect(esp).toHaveProperty('potencia_kw', 20)
    expect(esp).not.toHaveProperty('n_mppts')
  })
})

describe('expandirModelosInversor (caminho de texto, sem IA)', () => {
  it('faixa: "Growatt MID 15-20-25KTL3-X" → 3 modelos', () => {
    const r = expandirModelosInversor('Growatt String Inverter MID 15-20-25KTL3-X três fases')
    expect(r.fabricante).toBe('Growatt')
    expect(r.modelos).toEqual(expect.arrayContaining(['MID15KTL3-X', 'MID20KTL3-X', 'MID25KTL3-X']))
  })

  it('faixa Goodwe: "GoodWe GW 17/20/25K-DT" → 3 modelos', () => {
    const r = expandirModelosInversor('GoodWe DT Series GW 17/20/25K-DT')
    expect(r.modelos).toEqual(expect.arrayContaining(['GW17K-DT', 'GW20K-DT', 'GW25K-DT']))
  })

  it('lista explícita: coleta todos os MID (não só o primeiro)', () => {
    const txt = 'Growatt Datasheet\nMID15KTL3-X ... MID20KTL3-X ... MID25KTL3-X'
    const r = expandirModelosInversor(txt)
    expect(r.modelos).toEqual(expect.arrayContaining(['MID15KTL3-X', 'MID20KTL3-X', 'MID25KTL3-X']))
  })

  it('rawMultiDeTexto produz variantes consumíveis por normalizarMulti', () => {
    const raw = rawMultiDeTexto('Growatt MID 15-20-25KTL3-X')
    const itens = normalizarMulti(raw)
    expect(itens.length).toBeGreaterThanOrEqual(3)
    expect(itens.every(i => i.tipo === 'inversor')).toBe(true)
  })
})

// ── AIOrchestrator.extrairMulti com adapter fake ──────────────────────────────
class FakeAdapter {
  constructor(nome, b = {}) { this.nome = nome; this.b = b }
  isConfigured() { return this.b.configured !== false }
  async extract() {
    if (this.b.throw) throw new Error(this.b.throw)
    // simula o que baseAdapter._normalizar produz: variantesRaw no _meta
    return {
      fabricante: this.b.fabricante, modelo: this.b.modelo, tipo: 'inversor',
      especificacoes: {}, _meta: { provider: this.nome, variantesRaw: this.b.variantes || [] },
    }
  }
}

describe('AIOrchestrator.extrairMulti (INV-01C)', () => {
  it('provider com 3 variantes → 3 itens', async () => {
    const o = new AIOrchestrator({
      now: () => 0,
      adapters: {
        gemini: new FakeAdapter('gemini', {
          fabricante: 'Growatt', modelo: 'MID15KTL3-X',
          variantes: [
            { modelo_variante: 'MID15KTL3-X', potencia_nominal_kw: 15 },
            { modelo_variante: 'MID20KTL3-X', potencia_nominal_kw: 20 },
            { modelo_variante: 'MID25KTL3-X', potencia_nominal_kw: 25 },
          ],
        }),
        internal: new FakeAdapter('internal', { fabricante: null, modelo: null }),
      },
    })
    const r = await o.extrairMulti({ textoOCR: 'x' })
    expect(r.ok).toBe(true)
    expect(r.total).toBe(3)
    expect(r.itens.map(i => i.modelo)).toEqual(['MID15KTL3-X', 'MID20KTL3-X', 'MID25KTL3-X'])
    expect(r.itens[0]).toHaveProperty('qualidade')
  })
})
