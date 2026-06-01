/**
 * claudeAdapter.js — AI-ARCH-01 (FASE 4)
 *
 * Adapter Anthropic/Claude. Chave EXCLUSIVAMENTE via aiKeys (Railway env).
 * `extrator` é injetável para reuso da lógica existente e para testes.
 */

import { BaseAdapter } from './baseAdapter.js'
import { getAnthropicKey } from '../aiKeys.js'

export const CLAUDE_MODELO_PADRAO = 'claude-3-5-sonnet-20241022'

export class ClaudeAdapter extends BaseAdapter {
  /**
   * @param {Object} [opts]
   * @param {string} [opts.modelo]
   * @param {(input:Object, key:string, modelo:string)=>Promise<Object>} [opts.extrator]
   *        função real de extração (injeção p/ reuso/testes)
   */
  constructor({ modelo = CLAUDE_MODELO_PADRAO, extrator = null } = {}) {
    super('claude')
    this.modelo = modelo
    this._extrator = extrator
  }

  isConfigured() { return !!getAnthropicKey() }

  async _chamar(input) {
    const key = getAnthropicKey()
    if (this._extrator) return this._extrator(input, key, this.modelo)
    // Sem extrator injetado: ainda não migramos a extração pesada para cá.
    // Falha explícita para a cascata seguir ao próximo provider.
    throw new Error('ClaudeAdapter sem extrator injetado (use o pipeline legado ou injete um extrator)')
  }

  /** Health check barato: valida autenticação com um prompt mínimo. */
  async ping() {
    const key = getAnthropicKey()
    if (!key) return { ok: false, motivo: 'ANTHROPIC_API_KEY não configurada' }
    const inicio = Date.now()
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey: key })
      const msg = await client.messages.create({
        model: this.modelo,
        max_tokens: 8,
        messages: [{ role: 'user', content: 'ping' }],
      })
      return { ok: true, latenciaMs: Date.now() - inicio, modelo: this.modelo, resposta: msg?.content?.[0]?.text ?? '' }
    } catch (err) {
      return { ok: false, latenciaMs: Date.now() - inicio, status: err?.status ?? null, motivo: _motivoClaude(err) }
    }
  }
}

function _motivoClaude(err) {
  if (err?.status === 401) return 'Chave inválida ou sem permissão (401)'
  if (err?.status === 429) return 'Rate limit (429)'
  if (err?.status === 529) return 'Serviço sobrecarregado (529)'
  return err?.message || 'erro desconhecido'
}
