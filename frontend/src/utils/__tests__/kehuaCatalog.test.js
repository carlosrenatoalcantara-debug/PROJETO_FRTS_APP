import { describe, it, expect } from 'vitest'
import { extrairFabricanteModelo } from '../../../../backend/src/utils/catalogo/fabricanteModeloFallback.js'
import { extrairSpecsTecnicas } from '../../../../backend/src/ai/parserTecnicoInversor.js'
import { montarMatriz } from '../../../../backend/src/ai/parserMatricial.js'
import residential from '../../../../backend/src/ai/__fixtures__/golden/kehua_spi_residential.json'
import commercial from '../../../../backend/src/ai/__fixtures__/golden/kehua_spi_commercial.json'
import utility from '../../../../backend/src/ai/__fixtures__/golden/kehua_spi_utility.json'

/**
 * P0-KEHUA-CATALOG-01 — Kehua como fabricante de primeira classe.
 * Fixtures reais congeladas (OCR de imagem + tokens posicionais de PDF texto),
 * cobrindo as 3 famílias: residential / commercial / utility.
 */

// ── FASE 2 — reconhecimento de FABRICANTE + FAMÍLIA (sem hardcode por modelo) ─
describe('FASE 2 — Kehua reconhecido por família SPI (variações de grafia)', () => {
  it('alias "Kehua" + modelo SPI → fabricante=Kehua', () => {
    const r = extrairFabricanteModelo('Kehua Digital Energy\nSPI8K-B X2')
    expect(r.fabricante).toBe('Kehua')
    expect(r.modelo).toMatch(/^SPI8K/i)
  })
  it('família SPI sem a palavra "Kehua" no corpo → órfão recupera Kehua', () => {
    const r = extrairFabricanteModelo('Three-phase On-grid String Inverter\nItems SPI15K-B X2 SPI17K-B X2')
    expect(r.fabricante).toBe('Kehua')
  })
  it.each([
    'SPI15K-B', 'SPI 15K-B', 'SPI15K B', 'SPI-15K-B', 'SPI50K-B X2', 'SPI6000-B2',
  ])('variação de grafia "%s" → Kehua', (txt) => {
    expect(extrairFabricanteModelo('Kehua\n' + txt).fabricante).toBe('Kehua')
  })
  it('OCR que lê "SPI"→"SP1" (SP13000-B2) ainda mapeia Kehua', () => {
    expect(extrairFabricanteModelo('SP13000-B2/SP15000-B2/SP16000-B2').fabricante).toBe('Kehua')
  })
})

// ── FASE 5 — GOLDEN residential (OCR de imagem) ──────────────────────────────
describe('GOLDEN · Kehua residential SPI6000-B2 (PDF imagem → OCR)', () => {
  it('PDF imagem (≈32 chars) recuperado por OCR (>1000 chars)', () => {
    expect(residential.pdf_chars).toBeLessThan(120)
    expect(residential.ocr_chars).toBeGreaterThan(1000)
  })
  it('fabricante=Kehua mesmo com OCR ruidoso', () => {
    expect(extrairFabricanteModelo(residential.texto).fabricante).toBe('Kehua')
  })
  it('parser recupera potência, IP, dimensões e peso do OCR ruidoso', () => {
    const esp = extrairSpecsTecnicas(residential.texto, null)
    expect(esp.potencia_kw).toBe(6)
    expect(esp.grau_protecao_ip).toBe('IP65')           // OCR "Grau IP P65"
    expect(esp.dimensoes).toBe('360x420x125')           // OCR "360%x420%125 mm"
    expect(esp.peso_kg).toBe(11.5)
    expect(esp.n_mppts).toBe(2)
  })
})

// ── FASE 5 — GOLDEN commercial (matricial, 5 modelos distintos) ──────────────
describe('GOLDEN · Kehua commercial SPI15~25K-B X2 (matricial, 5 modelos)', () => {
  const m = montarMatriz(commercial.tokens, [])
  it('detecta os 5 modelos da série', () => {
    expect(m.modelos).toEqual(['SPI15K-B X2', 'SPI17K-B X2', 'SPI20K-B X2', 'SPI23K-B X2', 'SPI25K-B X2'])
  })
  it('potência nominal distinta por coluna: 15/17/20/23/25', () => {
    expect(m.modelos.map(x => m.porModelo[x].especificacoes.potencia_kw)).toEqual([15, 17, 20, 23, 25])
  })
  it('corrente por MPPT, MPPTs, IP e eficiência preenchidos', () => {
    const e = m.porModelo['SPI20K-B X2'].especificacoes
    expect(e.corrente_max_por_mppt).toBe(30)
    expect(e.n_mppts).toBe(2)
    expect(e.eficiencia_maxima).toBe(98.6)
    expect(e.tensao_max_entrada).toBe(1100)
    expect(e.peso_kg).toBe(17)
    expect(e.dimensoes).toMatch(/460\*420\*182/)
  })
})

// ── FASE 5 — GOLDEN utility (matricial, célula mesclada compartilhada) ───────
describe('GOLDEN · Kehua utility SPI50-60K-B X2 (matricial, 2 modelos)', () => {
  const m = montarMatriz(utility.tokens, [])
  it('detecta SPI50K-B X2 / SPI60K-B X2', () => {
    expect(m.modelos).toEqual(['SPI50K-B X2', 'SPI60K-B X2'])
  })
  it('potência 50/60 e n_mppts 4/5 distintos por coluna', () => {
    expect(m.modelos.map(x => m.porModelo[x].especificacoes.potencia_kw)).toEqual([50, 60])
    expect(m.modelos.map(x => m.porModelo[x].especificacoes.n_mppts)).toEqual([4, 5])
  })
  it('corrente por MPPT (40A) recuperada de CÉLULA MESCLADA centralizada → compartilhada', () => {
    expect(m.porModelo['SPI50K-B X2'].especificacoes.corrente_max_por_mppt).toBe(40)
    expect(m.porModelo['SPI60K-B X2'].especificacoes.corrente_max_por_mppt).toBe(40)
  })
})

// ── corrente_isc_max: AUSENTE de fábrica nos datasheets Kehua (não é falha) ──
describe('Kehua não publica Isc por MPPT → campo legitimamente ausente (não inventar)', () => {
  it('commercial: corrente_isc_max ausente em todos os modelos', () => {
    const m = montarMatriz(commercial.tokens, [])
    for (const mod of m.modelos) expect(m.porModelo[mod].especificacoes.corrente_isc_max).toBeUndefined()
  })
})
