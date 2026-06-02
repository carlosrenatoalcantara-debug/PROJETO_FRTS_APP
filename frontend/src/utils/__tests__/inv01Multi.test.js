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

// ── P0-INV-02-MAPPER-FIX: compatibilidade Claude + Gemini ─────────────────────
describe('mapearEspecificacoes — compatibilidade Claude + Gemini', () => {
  // Campos técnicos com nomes CURTOS (Claude / datasheetController prompt)
  const VARIANTE_CLAUDE = {
    modelo_variante: 'GW25K-DT', potencia_nominal_kw: 25, potencia_maxima_kw: 27.5,
    tensao_ac_nominal: '380', fases: 3, corrente_ac_saida: 38, thdi: '<3',
    n_mppts: 2, tensao_max_entrada: 1000, tensao_mppt_min: 200, tensao_mppt_max: 850,
    corrente_max_entrada: 30, corrente_isc_max: 40, eficiencia_maxima: 98.4,
    eficiencia_europeia: 98.0, temperatura_operacao: '-30~+60', dimensoes: '520x415x195',
    peso_kg: 30, grau_protecao_ip: 'IP66',
  }
  // Mesmos dados com nomes SUFIXADOS (Gemini / datasheetGeminiUnificado prompt)
  const VARIANTE_GEMINI = {
    modelo_variante: 'GW25K-DT', potencia_nominal_kw: 25, potencia_maxima_kw: 27.5,
    tensao_ac_nominal_v: '380', fases_ac: 3, corrente_ac_saida_a: 38, thdi_pct: '<3',
    n_mppts: 2, tensao_max_entrada_dc_v: 1000, tensao_mppt_min_v: 200, tensao_mppt_max_v: 850,
    corrente_max_entrada_dc_a: 30, corrente_isc_max_a: 40, eficiencia_maxima_pct: 98.4,
    eficiencia_europeia_pct: 98.0, temperatura_operacao_c: '-30~+60', dimensoes_mm: '520x415x195',
    peso_kg: 30, grau_protecao_ip: 'IP66',
  }
  const CHAVES_ESPERADAS = [
    'potencia_kw', 'potencia_maxima_kw', 'tensao_ac', 'fases', 'corrente_ac_saida', 'thdi',
    'n_mppts', 'tensao_max_entrada', 'tensao_mppt_min', 'tensao_mppt_max', 'corrente_max_entrada',
    'corrente_isc_max', 'eficiencia_maxima', 'eficiencia_europeia', 'temperatura_operacao',
    'dimensoes', 'peso_kg', 'grau_protecao_ip',
  ]

  it('payload CLAUDE mapeia todos os campos', () => {
    const esp = mapearEspecificacoes(VARIANTE_CLAUDE)
    for (const k of CHAVES_ESPERADAS) expect(esp, `falta ${k}`).toHaveProperty(k)
  })

  it('payload GEMINI mapeia todos os campos (antes perdia ~13)', () => {
    const esp = mapearEspecificacoes(VARIANTE_GEMINI)
    for (const k of CHAVES_ESPERADAS) expect(esp, `falta ${k}`).toHaveProperty(k)
    // valores específicos que vinham com sufixo do Gemini
    expect(esp.tensao_max_entrada).toBe(1000)
    expect(esp.eficiencia_maxima).toBe(98.4)
    expect(esp.corrente_ac_saida).toBe(38)
    expect(esp.dimensoes).toBe('520x415x195')
    expect(esp.fases).toBe(3)
  })

  it('Claude e Gemini produzem o MESMO conjunto de chaves', () => {
    const kClaude = Object.keys(mapearEspecificacoes(VARIANTE_CLAUDE)).sort()
    const kGemini = Object.keys(mapearEspecificacoes(VARIANTE_GEMINI)).sort()
    expect(kGemini).toEqual(kClaude)
  })

  it('normalizarMulti completo com payload Gemini → especificacoes preenchidas', () => {
    const itens = normalizarMulti({ fabricante: 'Goodwe', tipo: 'inversor', variantes: [VARIANTE_GEMINI] })
    expect(itens).toHaveLength(1)
    expect(Object.keys(itens[0].especificacoes).length).toBeGreaterThanOrEqual(18)
  })
})
