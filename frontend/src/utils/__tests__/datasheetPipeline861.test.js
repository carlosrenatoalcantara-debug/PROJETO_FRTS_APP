import { describe, it, expect } from 'vitest'
import {
  extrairFabricanteModelo, ehDefaultLixo, FABRICANTES_RECONHECIDOS,
} from '../../../../backend/src/utils/catalogo/fabricanteModeloFallback.js'
import { auditarPipeline, auditarTextoOCR, FALHAS } from '../../../../backend/src/utils/catalogo/pipelineAuditor.js'

/**
 * Sprint 8.6.1 — Auditoria Completa do Pipeline de Datasheet.
 *
 * Causa raiz (encontrada): ModalNovoInversor.jsx linhas 87-88 escrevia LITERAL
 *   fabricante: dados.fabricante || 'Desconhecido'
 *   modelo:     dados.modelo     || 'Inversor'
 * quando o Claude/Gemini falhava → equipamento ficava com nome lixo no Mongo.
 *
 * Esta suíte testa os 3 mecanismos da correção:
 *   1) Regex fallback (Deye/Solis/Growatt + outros)
 *   2) Detector de "default lixo" (ehDefaultLixo)
 *   3) Auditor estágio-a-estágio (classificação exata da falha)
 */

describe('S8.6.1 — regex fallback Deye/Solis/Growatt', () => {
  // 1) Deye SUN-30K (problema reportado pelo usuário)
  it('extrai Deye SUN-30K-G04 do texto bruto', () => {
    const texto = 'Deye Inverter Manual\nModel: SUN-30K-G04\nString Inverter for 3-Phase Grid'
    const r = extrairFabricanteModelo(texto)
    expect(r.fabricante).toBe('Deye')
    expect(r.modelo).toBe('SUN-30K-G04')
    expect(r.confianca).toBeGreaterThan(0.7)
  })

  it('extrai Deye SUN-50K variante simplificada', () => {
    const texto = 'NingBo Deye Inverter Technology\nProduct: SUN-50K-G03'
    const r = extrairFabricanteModelo(texto)
    expect(r.fabricante).toBe('Deye')
    expect(r.modelo).toMatch(/SUN-?50K/)
  })

  // 2) Solis RHI-50K
  it('extrai Solis (Ginlong) RHI-50K-HV', () => {
    const texto = 'Ginlong Solis Technical Datasheet\nModel: RHI-50K-HV-5G'
    const r = extrairFabricanteModelo(texto)
    expect(r.fabricante).toBe('Solis')
    expect(r.modelo).toMatch(/RHI-50K/)
  })

  // 3) Growatt MIC1000TL-X
  it('extrai Growatt MIC1000TL-X', () => {
    const texto = 'Growatt New Energy\nMIC 1000TL-X Microinverter\nMaximum efficiency 96.8%'
    const r = extrairFabricanteModelo(texto)
    expect(r.fabricante).toBe('Growatt')
    expect(r.modelo).toMatch(/MIC.*1000TL-X/i)
  })

  // 4) Modelo órfão (PDF sem nome do fabricante explícito)
  it('detecta SUN-30K como Deye mesmo sem alias explícito', () => {
    const texto = '...especificações técnicas... Model SUN-30K-G05 ...'
    const r = extrairFabricanteModelo(texto)
    expect(r.fabricante).toBe('Deye')
    expect(r.modelo).toMatch(/SUN-?30K/)
    expect(r.padrao_usado).toMatch(/orfao/)
  })

  // 5) PDF vazio / texto inútil → não inventa nada
  it('não inventa fabricante para texto vazio', () => {
    expect(extrairFabricanteModelo('').fabricante).toBeNull()
    expect(extrairFabricanteModelo('xyz').fabricante).toBeNull()
    expect(extrairFabricanteModelo(null).fabricante).toBeNull()
  })

  // 6) Lista de fabricantes reconhecidos cobre o ecossistema BR
  it('reconhece fabricantes BR principais', () => {
    expect(FABRICANTES_RECONHECIDOS).toEqual(
      expect.arrayContaining(['Deye', 'Solis', 'Growatt', 'Sungrow', 'Goodwe', 'Canadian Solar'])
    )
  })
})

describe('S8.6.1 — detector de default lixo', () => {
  // 7) "Desconhecido" / "Inversor" são defaults lixo — bloqueia persistência
  it('ehDefaultLixo identifica defaults que não devem persistir', () => {
    expect(ehDefaultLixo('Desconhecido', 'fabricante')).toBe(true)
    expect(ehDefaultLixo('Inversor', 'modelo')).toBe(true)
    expect(ehDefaultLixo('Painel', 'modelo')).toBe(true)
    expect(ehDefaultLixo('Modulo', 'modelo')).toBe(true)
    expect(ehDefaultLixo('N/A', 'fabricante')).toBe(true)
    expect(ehDefaultLixo('?', 'fabricante')).toBe(true)
    expect(ehDefaultLixo(null, 'fabricante')).toBe(true)
    expect(ehDefaultLixo('', 'fabricante')).toBe(true)
  })

  // 8) Valores reais NÃO são marcados como lixo
  it('aceita valores reais (Deye, SUN-30K-G04, Canadian Solar)', () => {
    expect(ehDefaultLixo('Deye', 'fabricante')).toBe(false)
    expect(ehDefaultLixo('SUN-30K-G04', 'modelo')).toBe(false)
    expect(ehDefaultLixo('Canadian Solar', 'fabricante')).toBe(false)
    expect(ehDefaultLixo('CS6W-550MS', 'modelo')).toBe(false)
  })
})

describe('S8.6.1 — auditor de pipeline (classificação exata da falha)', () => {
  // 9) OCR sem texto = OCR_FALHOU
  it('OCR vazio → OCR_FALHOU', () => {
    const r = auditarPipeline({ ocr: { ok: false, texto: '', erro: 'PDF vazio' } })
    expect(r.falha).toBe(FALHAS.OCR_FALHOU)
    expect(r.etapa).toBe('OCR')
  })

  // 10) Gemini falhou + regex acha Deye → GEMINI_FALHOU com sugestão
  it('Gemini falha + regex encontra Deye → GEMINI_FALHOU com fallback', () => {
    const r = auditarPipeline({
      ocr: { ok: true, texto: 'Deye Inverter SUN-30K-G04 Datasheet ' + 'x'.repeat(50) },
      gemini: { ok: false, erro: 'API rate limit' },
    })
    expect(r.falha).toBe(FALHAS.GEMINI_FALHOU)
    expect(r.fallback_aplicado.fabricante).toBe('Deye')
    expect(r.fallback_aplicado.modelo).toMatch(/SUN-?30K/)
    expect(r.sugestao).toMatch(/Aceitar/)
  })

  // 11) Gemini OK + fabricante "Desconhecido" → VALIDACAO_FALHOU
  it('Gemini retorna defaults lixo → VALIDACAO_FALHOU', () => {
    const r = auditarPipeline({
      ocr: { ok: true, texto: 'Some valid text here from a PDF datasheet ' + 'x'.repeat(50) },
      gemini: {
        ok: true,
        raw: '{"fabricante":"Desconhecido","modelo":"Inversor"}',
        json: { fabricante: 'Desconhecido', modelo: 'Inversor' },
      },
    })
    expect(r.falha).toBe(FALHAS.VALIDACAO_FALHOU)
    expect(r.etapa).toBe('VALIDACAO')
  })

  // 12) Pipeline OK
  it('pipeline completo com Deye 30kW → OK', () => {
    const r = auditarPipeline({
      ocr: { ok: true, texto: 'Deye SUN-30K-G04 ' + 'x'.repeat(100) },
      gemini: {
        ok: true,
        raw: '{"fabricante":"Deye","modelo":"SUN-30K-G04"}',
        json: { fabricante: 'Deye', modelo: 'SUN-30K-G04', tipo: 'inversor' },
      },
      mongo: { ok: true, _id: 'abc123' },
    })
    expect(r.falha).toBe(FALHAS.OK)
    expect(r.etapa).toBe('OK')
    expect(r.evidencia.fabricante).toBe('Deye')
  })
})

describe('S8.6.1 — auditarTextoOCR (helper para a tela de diagnóstico)', () => {
  // 13) Auditoria a partir só do texto + resposta Gemini opcional
  it('audita texto OCR com Gemini sucesso', () => {
    const r = auditarTextoOCR(
      'Deye SUN-30K-G04 Datasheet ' + 'x'.repeat(100),
      { fabricante: 'Deye', modelo: 'SUN-30K-G04' }
    )
    expect(r.falha).toBe(FALHAS.OK)
  })

  it('audita texto OCR sem Gemini (mostra GEMINI_FALHOU mesmo)', () => {
    const r = auditarTextoOCR('Deye SUN-30K-G04 ' + 'x'.repeat(100))
    expect(r.falha).toBe(FALHAS.GEMINI_FALHOU)
    expect(r.fallback_aplicado.fabricante).toBe('Deye')
  })
})
