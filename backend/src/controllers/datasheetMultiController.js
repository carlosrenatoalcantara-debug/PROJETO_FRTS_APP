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
    const health = orch.health_snapshot()

    // ── P0-AI-01-FINAL: INSTRUMENTAÇÃO ─────────────────────────────────────────
    // Registra no log (Railway) a evidência decisiva de QUEM venceu e POR QUE os
    // outros providers foram pulados/falharam — sem expor segredos.
    const specs0 = r.itens?.[0]?.especificacoes || {}
    const erroPorProvider = {}
    for (const t of (r.tentativas || [])) {
      if (t && (t.motivo || t.pulado)) erroPorProvider[t.provider] = t.motivo || t.pulado
    }
    console.log('════════ [extrair-multi] DIAGNÓSTICO ════════')
    console.log('[extrair-multi] provider_vencedor=%s total=%d ocr_chars=%d', r.provider, r.total, textoOCR.length)
    console.log('[extrair-multi] tentativas=%s', JSON.stringify(r.tentativas))
    console.log('[extrair-multi] erros_por_provider=%s', JSON.stringify(erroPorProvider))
    console.log('[extrair-multi] breakers=%s', JSON.stringify(health.map(h => ({ p: h.provider, status: h.status, breaker: h.estadoBreaker, ultimoErro: h.ultimoErro }))))
    console.log('[extrair-multi] specs0_keys=%s qualidade0=%s', JSON.stringify(Object.keys(specs0)), JSON.stringify(r.itens?.[0]?.qualidade?.score ?? null))
    console.log('═════════════════════════════════════════════')

    res.json({
      ok: r.ok,
      provider: r.provider,
      total: r.total,
      itens: r.itens,
      preenchimentoAssistido: r.preenchimentoAssistido,
      tentativas: r.tentativas,
      // P0-AI-01-FINAL: evidência de runtime exposta na própria resposta
      _diagnostico: {
        provider_vencedor: r.provider,
        erros_por_provider: erroPorProvider,
        breakers: health,
        specs0_keys: Object.keys(specs0),
        ocr_chars: textoOCR.length,
      },
    })
  } catch (err) {
    console.error('❌ Erro em extrair-multi:', err)
    res.status(500).json({ ok: false, erro: err.message })
  }
}
