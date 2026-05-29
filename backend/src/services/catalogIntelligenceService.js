/**
 * catalogIntelligenceService.js — Sprint 8.0
 *
 * PIPELINE CENTRAL de inteligência do catálogo. Orquestra as fontes na ordem
 * obrigatória, SEM parsers concorrentes (reaproveita serviços existentes):
 *
 *   1. SolarMarket (dados oficiais)   → solarMarketCatalogService
 *   2. Gemini multimodal              → geminiDatasheetAnalyzer (extrairComGemini)
 *   3. OCR atual                      → documentOCRService (fallback do pipeline)
 *   4. Correção manual                → fonte 'Manual' (aplicada na edição)
 *
 * Cada campo resultante carrega { valor, fonte, confianca }. NÃO aprova
 * automaticamente — devolve para revisão humana.
 */
import { buscarEquipamento as buscarSolarMarket } from './solarMarketCatalogService.js'
import { analisarDatasheet, CAMPOS_ESPERADOS } from './geminiDatasheetAnalyzer.js'

const PRIORIDADE_FONTE = { SolarMarket: 4, Manual: 5, Gemini: 3, 'Gemini (cache)': 3, OCR: 2 }

function mesclarCampo(atual, novo) {
  if (!atual) return novo
  // Prioridade por fonte; empate → maior confiança
  const pa = PRIORIDADE_FONTE[atual.fonte] || 0
  const pn = PRIORIDADE_FONTE[novo.fonte] || 0
  if (pn > pa) return novo
  if (pn === pa && (novo.confianca || 0) > (atual.confianca || 0)) return novo
  return atual
}

/**
 * Ingestão inteligente de um datasheet (ou consulta por fabricante/modelo).
 *
 * @param {object} p
 * @param {Buffer} [p.buffer]   datasheet PDF/imagem
 * @param {string} [p.tipo]     'modulo'|'inversor'|'carregador_ev'|'auto'
 * @param {string} [p.fabricante]
 * @param {string} [p.modelo]
 * @returns {Promise<{ tipo, campos, faltantes, fontes_usadas, confianca_global }>}
 */
export async function ingerir({ buffer = null, tipo = 'auto', fabricante = null, modelo = null } = {}) {
  const campos = {}
  const fontesUsadas = []

  // 1) SolarMarket (oficial) — camada isolada, pode retornar null
  try {
    const sm = await buscarSolarMarket({ fabricante, modelo, tipo })
    if (sm?.campos) {
      for (const [k, v] of Object.entries(sm.campos)) campos[k] = mesclarCampo(campos[k], v)
      fontesUsadas.push('SolarMarket')
    }
  } catch { /* ignora — segue para Gemini */ }

  // 2) Gemini multimodal (+ 3) OCR já é fallback interno do extrator)
  let tipoFinal = tipo
  if (buffer) {
    try {
      const g = await analisarDatasheet(buffer, tipo)
      tipoFinal = g.tipo || tipo
      for (const [k, v] of Object.entries(g.campos)) campos[k] = mesclarCampo(campos[k], v)
      fontesUsadas.push(g.cache_hit ? 'Gemini (cache)' : 'Gemini')
    } catch (e) {
      // 3) OCR puro como fallback final seria chamado aqui (documentOCRService),
      //    mas o extrator Gemini já incorpora OCR/visão. Mantemos o erro registrado.
      campos._erro_extracao = { valor: e.message, fonte: 'sistema', confianca: 0 }
    }
  }

  // Campos esperados ausentes (para destacar na revisão humana)
  const esperados = CAMPOS_ESPERADOS[tipoFinal] || CAMPOS_ESPERADOS.modulo
  const faltantes = esperados.filter((c) => !campos[c] || campos[c].valor == null)

  const confs = Object.values(campos).map((c) => c.confianca).filter((n) => Number.isFinite(n) && n > 0)
  const confianca_global = confs.length ? +(confs.reduce((s, x) => s + x, 0) / confs.length).toFixed(2) : 0

  return { tipo: tipoFinal, campos, faltantes, fontes_usadas: fontesUsadas, confianca_global }
}

export default { ingerir }
