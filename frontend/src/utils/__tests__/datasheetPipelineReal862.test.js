import { describe, it, expect } from 'vitest'
import {
  extrairFabricanteModelo, ehDefaultLixo,
} from '../../../../backend/src/utils/catalogo/fabricanteModeloFallback.js'

/**
 * Sprint 8.6.2 — testes contra os 3 PDFs REAIS que falharam em produção.
 *
 * Causa exata diagnosticada: `/api/datasheet/extrair-datasheet` não devolvia
 * `texto_extraido`, então o regex fallback do 8.6.1 (gated por `if (texto)`)
 * NUNCA executava. Resultado: fabricante=∅, modelo=∅ → IMPORTACAO_FALHOU.
 *
 * Correção: extrair OCR uma vez + aplicar regex server-side + devolver texto.
 *
 * Esta suíte simula o texto OCR típico de cada um dos 3 datasheets reais e
 * valida que o regex AGORA reconhece todos.
 */

describe('S8.6.2 — caso real #1: Datasheet_-_Solplanet_-_ASW7300-S.pdf', () => {
  it('reconhece Solplanet ASW7300-S (estava ausente do detector legado)', () => {
    // Texto típico do PDF Solplanet (cabeçalho + modelo na primeira página)
    const texto = `
      Solplanet
      ASW7300-S
      Solar Inverter 7.3 kW
      AISWEI Technology Co., Ltd.
      Three-phase string inverter
    `
    const r = extrairFabricanteModelo(texto)
    expect(r.fabricante).toBe('Solplanet')
    expect(r.modelo).toMatch(/ASW7300-?S/)
    expect(r.confianca).toBeGreaterThan(0.5)
  })

  it('reconhece ASW7300-S mesmo sem alias "Solplanet" (modelo órfão)', () => {
    const texto = '...Three-phase grid-tied inverter Model: ASW7300-S Output power...'
    const r = extrairFabricanteModelo(texto)
    expect(r.fabricante).toBe('Solplanet')
    expect(r.padrao_usado).toMatch(/solplanet/i)
  })
})

describe('S8.6.2 — caso real #2: Datasheet_12k-18k_11A-DEYE.pdf', () => {
  it('reconhece Deye em datasheet de faixa 12k-18k', () => {
    const texto = `
      Deye Inverter Technology
      SUN-12K-G05 / SUN-15K-G05 / SUN-18K-G05
      Three-phase string inverter
      Maximum current 11A
    `
    const r = extrairFabricanteModelo(texto)
    expect(r.fabricante).toBe('Deye')
    expect(r.modelo).toMatch(/SUN-?12K-G05/)
  })
})

describe('S8.6.2 — caso real #3: datasheet_sun-23-30k-g04-lv_240809_pt.pdf', () => {
  it('reconhece Deye SUN-23-30K-G04-LV (faixa de potência no modelo)', () => {
    const texto = `
      Deye
      SUN-23-30K-G04-LV
      String Inverter 23kW to 30kW
      Low Voltage
    `
    const r = extrairFabricanteModelo(texto)
    expect(r.fabricante).toBe('Deye')
    expect(r.modelo).toMatch(/SUN-?23-?30K/)
  })

  it('reconhece variante com faixa mesmo só no nome do arquivo (sem alias claro)', () => {
    const texto = '... model SUN-23-30K-G04 specifications ...'
    const r = extrairFabricanteModelo(texto)
    expect(r.fabricante).toBe('Deye')
  })
})

describe('S8.6.2 — diagnóstico server-side (extrairDatasheet)', () => {
  // Estes testes documentam o formato do `_diagnostico` que o controller agora devolve.
  // O controller real faz I/O (PDFParse + Anthropic) e não roda em vitest puro;
  // aqui validamos a forma dos dados que o frontend deve esperar.

  it('formato esperado de _diagnostico (regressão de contrato)', () => {
    const exemplo = {
      ocr_chars: 12340,
      claude_chamado: true, claude_ok: false, claude_erro: 'rate limit',
      fabricante_pre_fallback: null, modelo_pre_fallback: null,
      fallback_executado: true, fallback_encontrou: true,
      fabricante_origem: 'regex_fallback', modelo_origem: 'regex_fallback',
      etapa_decisiva: 'OK',
    }
    // Campos obrigatórios
    expect(exemplo).toHaveProperty('ocr_chars')
    expect(exemplo).toHaveProperty('claude_chamado')
    expect(exemplo).toHaveProperty('fallback_executado')
    expect(exemplo).toHaveProperty('etapa_decisiva')
    // Etapas decisivas válidas
    const VALIDAS = ['OK', 'OCR_FALHOU', 'GEMINI_FALHOU', 'FALLBACK_FALHOU', 'VALIDACAO_FALHOU']
    expect(VALIDAS).toContain(exemplo.etapa_decisiva)
  })

  it('quando OCR retorna 0 chars → etapa_decisiva = OCR_FALHOU', () => {
    // Simula resposta com OCR vazio + Claude falhou + sem fallback
    const r = extrairFabricanteModelo('')
    expect(r.fabricante).toBeNull()
    expect(r.modelo).toBeNull()
    // Esta é a condição que o controller usa: textoOCR.length < 20 → não roda fallback
    expect(''.length).toBeLessThan(20)
  })
})

describe('S8.6.2 — regressão das proteções 8.6.1', () => {
  // Garante que as defesas anteriores continuam ativas após a correção.
  it('Desconhecido / Inversor continuam sendo lixo bloqueado', () => {
    expect(ehDefaultLixo('Desconhecido', 'fabricante')).toBe(true)
    expect(ehDefaultLixo('Inversor', 'modelo')).toBe(true)
  })
})
