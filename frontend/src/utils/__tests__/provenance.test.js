import { describe, it, expect } from 'vitest'
import { resolverOrigem, ORIGENS_VALIDAS } from '../../../../backend/src/controllers/equipamentosController.js'

/**
 * P1-CATALOG-PROVENANCE-01 — rastreabilidade de origem na criação.
 * Antes: origem.tipo nunca era setado → hook de qualidade defaultava 'desconhecido' em 100%.
 * Agora: a criação resolve origem.tipo (hint válido OU 'manual'), sem adivinhar.
 */
describe('resolverOrigem — proveniência na criação', () => {
  it('sem hint → fallback "manual" (ação humana no catálogo)', () => {
    expect(resolverOrigem({}).tipo).toBe('manual')
    expect(resolverOrigem({ origem: {} }).tipo).toBe('manual')
  })
  it('hint válido é respeitado (datasheet_pdfparse / datasheet_gemini / import_*)', () => {
    expect(resolverOrigem({ origem: { tipo: 'datasheet_pdfparse' } }).tipo).toBe('datasheet_pdfparse')
    expect(resolverOrigem({ origem: { tipo: 'datasheet_gemini' } }).tipo).toBe('datasheet_gemini')
    expect(resolverOrigem({ origem: { tipo: 'import_solarmarket' } }).tipo).toBe('import_solarmarket')
  })
  it('hint INVÁLIDO (fora do enum) cai no fallback — não grava lixo', () => {
    expect(resolverOrigem({ origem: { tipo: 'ocr' } }).tipo).toBe('manual')          // 'ocr' não é enum
    expect(resolverOrigem({ origem: { tipo: 'qualquer' } }).tipo).toBe('manual')
    expect(resolverOrigem({ origem: { tipo: 'assistida' } }, 'desconhecido').tipo).toBe('desconhecido')
  })
  it('fallback customizado é respeitado', () => {
    expect(resolverOrigem({}, 'import_legado').tipo).toBe('import_legado')
  })
  it('preenche fonte (de origem.fonte ou datasheet_url) e timestamp', () => {
    expect(resolverOrigem({ origem: { fonte: 'meu.pdf' } }).fonte).toBe('meu.pdf')
    expect(resolverOrigem({ datasheet_url: 'http://x/y.pdf' }).fonte).toBe('http://x/y.pdf')
    expect(resolverOrigem({}).em instanceof Date).toBe(true)
  })
  it('todos os valores do enum são aceitos como hint', () => {
    for (const t of ORIGENS_VALIDAS) expect(resolverOrigem({ origem: { tipo: t } }).tipo).toBe(t)
  })
})
