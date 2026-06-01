/**
 * geminiAdapter.js — AI-ARCH-01 (FASE 4)
 *
 * Adapter Google/Gemini. Chave via aiKeys (GOOGLE_API_KEY canônico, GEMINI_API_KEY
 * alias legado). Reusa por padrão o extrator unificado já existente.
 */

import { BaseAdapter } from './baseAdapter.js'
import { getGoogleKey } from '../aiKeys.js'

// P0-AI-RUNTIME-CLOSE: alinhado ao modelo REAL da extração
// (datasheetGeminiUnificado.js → 'gemini-2.0-flash'). Antes o health pingava
// 'gemini-1.5-flash' (modelo diferente) → /api/ai/health podia reportar Gemini
// ONLINE enquanto a extração de produção falhava no 2.0-flash. Health passa a
// refletir o mesmo modelo usado na extração.
export const GEMINI_MODELO_PADRAO = 'gemini-2.0-flash'

export class GeminiAdapter extends BaseAdapter {
  /**
   * @param {Object} [opts]
   * @param {(input:Object, key:string)=>Promise<Object>} [opts.extrator]
   *        default: importa dinamicamente extrairComGemini do controller unificado.
   */
  constructor({ extrator = null, modelo = GEMINI_MODELO_PADRAO } = {}) {
    super('gemini')
    this.modelo = modelo
    this._extrator = extrator
  }

  isConfigured() { return !!getGoogleKey() }

  async _chamar(input) {
    if (this._extrator) return this._extrator(input, getGoogleKey())
    // Reuso da lógica unificada existente (SSOT — não duplica prompt).
    const { extrairComGemini } = await import('../../controllers/datasheetGeminiUnificado.js')
    const raw = await extrairComGemini(input?.pdfBuffer, input?.tipoEsperado || 'auto')
    return raw?.dados || raw
  }

  async ping() {
    const key = getGoogleKey()
    if (!key) return { ok: false, motivo: 'GOOGLE_API_KEY não configurada' }
    const inicio = Date.now()
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(key)
      const model = genAI.getGenerativeModel({ model: this.modelo })
      const r = await model.generateContent('ping')
      return { ok: true, latenciaMs: Date.now() - inicio, modelo: this.modelo, resposta: r?.response?.text?.() ?? '' }
    } catch (err) {
      return { ok: false, latenciaMs: Date.now() - inicio, motivo: err?.message || 'erro desconhecido' }
    }
  }
}
