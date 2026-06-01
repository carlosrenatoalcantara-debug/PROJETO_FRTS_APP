/**
 * index.js — AI-ARCH-01
 *
 * Fábrica + singleton do AIOrchestrator com os adapters reais. Ponto de entrada
 * único para o resto do backend importar a camada de IA.
 */

import { AIOrchestrator } from './AIOrchestrator.js'
import { GeminiAdapter } from './adapters/geminiAdapter.js'
import { ClaudeAdapter } from './adapters/claudeAdapter.js'
import { OpenAIAdapter } from './adapters/openaiAdapter.js'
import { InternalAdapter } from './adapters/internalAdapter.js'
import { CONFIG_PADRAO } from './aiConfig.js'

/**
 * Cria um orchestrator com os adapters padrão. Aceita extratores injetados para
 * reuso de lógica existente (ex.: Claude do pipeline legado) e para testes.
 * @param {Object} [opts]
 * @param {Object} [opts.extratores] { gemini?, claude?, openai? }
 * @param {Array}  [opts.config]
 */
export function criarOrchestrator({ extratores = {}, config = CONFIG_PADRAO } = {}) {
  const adapters = {
    gemini:   new GeminiAdapter({ extrator: extratores.gemini || null }),
    claude:   new ClaudeAdapter({ extrator: extratores.claude || null }),
    openai:   new OpenAIAdapter({ extrator: extratores.openai || null }),
    internal: new InternalAdapter(),
  }
  return new AIOrchestrator({ adapters, config })
}

let _singleton = null
/** Orchestrator compartilhado do processo. */
export function getOrchestrator() {
  if (!_singleton) _singleton = criarOrchestrator()
  return _singleton
}

export { AIOrchestrator } from './AIOrchestrator.js'
