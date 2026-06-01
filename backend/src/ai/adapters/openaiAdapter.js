/**
 * openaiAdapter.js — AI-ARCH-01 (FASE 4)
 *
 * Adapter OpenAI/GPT. Hoje OPCIONAL: só opera se OPENAI_API_KEY estiver presente.
 * Mantém o contrato do schema interno para entrar na cascata quando habilitado.
 */

import { BaseAdapter } from './baseAdapter.js'
import { getOpenAIKey } from '../aiKeys.js'

export const OPENAI_MODELO_PADRAO = 'gpt-4o-mini'

export class OpenAIAdapter extends BaseAdapter {
  constructor({ modelo = OPENAI_MODELO_PADRAO, extrator = null } = {}) {
    super('openai')
    this.modelo = modelo
    this._extrator = extrator
  }

  isConfigured() { return !!getOpenAIKey() }

  async _chamar(input) {
    const key = getOpenAIKey()
    if (this._extrator) return this._extrator(input, key, this.modelo)
    throw new Error('OpenAIAdapter sem extrator injetado')
  }

  async ping() {
    const key = getOpenAIKey()
    if (!key) return { ok: false, motivo: 'OPENAI_API_KEY não configurada' }
    const inicio = Date.now()
    try {
      const { default: OpenAI } = await import('openai')
      const client = new OpenAI({ apiKey: key })
      await client.chat.completions.create({
        model: this.modelo, max_tokens: 4,
        messages: [{ role: 'user', content: 'ping' }],
      })
      return { ok: true, latenciaMs: Date.now() - inicio, modelo: this.modelo }
    } catch (err) {
      return { ok: false, latenciaMs: Date.now() - inicio, status: err?.status ?? null, motivo: err?.message || 'erro desconhecido' }
    }
  }
}
