import { describe, it, expect } from 'vitest'
import { precisaOCR } from '../../../../backend/src/ai/ocr.js'
import { InternalAdapter } from '../../../../backend/src/ai/adapters/internalAdapter.js'
import { extrairSpecsTecnicas } from '../../../../backend/src/ai/parserTecnicoInversor.js'
import { extrairFabricanteModelo } from '../../../../backend/src/utils/catalogo/fabricanteModeloFallback.js'
import kehua from '../../../../backend/src/ai/__fixtures__/golden/kehua_spi_ocr.json'
import solis from '../../../../backend/src/ai/__fixtures__/golden/solis_30k_ocr.json'

/**
 * P1-INV-OCR-01 — detecção texto/imagem + proveniência do OCR.
 * (O OCR real — mupdf + tesseract — é validado por script sobre PDFs imagem;
 *  estes testes cobrem a lógica CI-safe sem rodar WASM/Tesseract.)
 */

describe('FASE 1/3 — detecção: PDF imagem precisa de OCR', () => {
  it('texto vazio / minúsculo → precisaOCR = true', () => {
    expect(precisaOCR('')).toBe(true)
    expect(precisaOCR('   ')).toBe(true)
    expect(precisaOCR('28 chars apenas isso aqui x')).toBe(true)  // PDF imagem típico
  })
  it('texto com camada real → precisaOCR = false', () => {
    expect(precisaOCR('x'.repeat(2000))).toBe(false)
  })
})

describe('FASE 5 — proveniência: dado de OCR é 🟡 (inferido_alta), não 🟢', () => {
  it('origemTexto=ocr → todos os campos da variante marcados inferido_alta', async () => {
    const ad = new InternalAdapter()
    // texto "OCR" de um fabricante conhecido (Goodwe) — sem pdfBuffer → parser de texto.
    const texto = 'GoodWe GW20KT-DT\nMax. Efficiency 98.6%\nNo. of MPPT 2\nMax. DC Input Voltage (V) 1000'
    const raw = await ad._chamar({ textoOCR: texto, origemTexto: 'ocr', tipoEsperado: 'inversor' })
    const v = raw.variantes[0]
    expect(v).toBeTruthy()
    const niveis = new Set(Object.values(v._status || {}))
    expect(niveis.size).toBeGreaterThan(0)
    for (const n of niveis) expect(n).toBe('inferido_alta')   // 🟡 OCR
  })

  it('PDF texto (sem origemTexto=ocr) → NÃO marca tudo como OCR', async () => {
    const ad = new InternalAdapter()
    const texto = 'GoodWe GW20KT-DT\nMax. Efficiency 98.6%\nNo. of MPPT 2'
    const raw = await ad._chamar({ textoOCR: texto, tipoEsperado: 'inversor' })
    const v = raw.variantes[0]
    // single-model sem OCR → _status undefined (presença = 🟢 na UI por padrão)
    expect(v._status).toBeUndefined()
  })
})

describe('FASE 4/6 — texto OCR REAL (fixtures) deixa de ser zero e o parser recupera', () => {
  it('Kehua: PDF imagem (28 chars) → OCR ~2800 chars; modelos SPI recuperados', () => {
    expect(kehua.pdf_chars).toBeLessThan(120)             // PDF imagem (zero útil)
    expect(kehua.ocr_chars).toBeGreaterThan(1000)         // OCR recuperou texto
    expect(kehua.texto).toMatch(/SPI\s*\d{2}K/i)          // série de modelos Kehua
    const esp = extrairSpecsTecnicas(kehua.texto, null)
    expect(Object.keys(esp).length).toBeGreaterThanOrEqual(3) // recuperação mensurável
  })
  it('Solis 30K: OCR → fabricante=Solis + ≥6 campos do parser', () => {
    expect(solis.pdf_chars).toBeLessThan(120)
    expect(solis.ocr_chars).toBeGreaterThan(1000)
    expect(extrairFabricanteModelo(solis.texto).fabricante).toBe('Solis')
    const esp = extrairSpecsTecnicas(solis.texto, null)
    expect(esp.potencia_kw).toBe(30)
    expect(esp.eficiencia_maxima).toBeGreaterThanOrEqual(98)
    expect(Object.keys(esp).length).toBeGreaterThanOrEqual(6)
  })
})
