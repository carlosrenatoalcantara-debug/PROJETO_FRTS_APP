/**
 * datasheetMultiController.js — P0-INV-01C
 *
 * Extração MULTI-MODELO via AIOrchestrator (1 PDF → N modelos). Endpoint NOVO,
 * não toca o /extrair-datasheet legado (zero regressão).
 *
 *   POST /api/datasheet/extrair-multi  (multipart: pdf)
 *   → { ok, provider, total, itens:[{fabricante,modelo,tipo,especificacoes,qualidade}], ... }
 */

import { PDFParse } from 'pdf-parse'
import { getOrchestrator } from '../ai/index.js'

export async function extrairDatasheetMulti(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, erro: 'Arquivo PDF não fornecido' })
    }
    const pdfBuffer = req.file.buffer

    // OCR (mesmo motor do fluxo legado) — alimenta o motor interno da cascata.
    let textoOCR = ''
    try {
      const parser = new PDFParse({ data: pdfBuffer })
      const tr = await parser.getText()
      await parser.destroy()
      textoOCR = (tr?.text || '').toString()
    } catch (e) {
      console.warn('[extrair-multi] OCR falhou:', e.message)
    }

    const orch = getOrchestrator()
    const r = await orch.extrairMulti({ pdfBuffer, textoOCR, tipoEsperado: 'inversor' })

    res.json({
      ok: r.ok,
      provider: r.provider,
      total: r.total,
      itens: r.itens,
      preenchimentoAssistido: r.preenchimentoAssistido,
      tentativas: r.tentativas,
    })
  } catch (err) {
    console.error('❌ Erro em extrair-multi:', err)
    res.status(500).json({ ok: false, erro: err.message })
  }
}
