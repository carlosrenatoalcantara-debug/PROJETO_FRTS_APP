/**
 * aiConfig.js — AI-ARCH-01 (FASE 2)
 *
 * Configuração de PROVIDERS (não de segredos). O banco/sistema pode persistir
 * APENAS: { provider, enabled, priority } (+ status/métricas de runtime). As
 * CHAVES nunca passam por aqui — vêm exclusivamente de aiKeys (Railway env).
 *
 * Ordem padrão da cascata (FASE 5): Gemini → Claude → GPT → Interno.
 */

export const CONFIG_PADRAO = [
  { provider: 'gemini',   enabled: true,  priority: 1 },
  { provider: 'claude',   enabled: true,  priority: 2 },
  { provider: 'openai',   enabled: true,  priority: 3 },
  { provider: 'internal', enabled: true,  priority: 99 }, // sempre por último
]

/**
 * Ordena/filtra a config. `internal` é sempre incluído por último, mesmo que
 * ausente, para garantir a rede de segurança da cascata.
 * @param {Array} [config]
 * @returns {Array<{provider:string, enabled:boolean, priority:number}>}
 */
export function ordenarProviders(config = CONFIG_PADRAO) {
  const lista = Array.isArray(config) && config.length ? [...config] : [...CONFIG_PADRAO]
  if (!lista.some(c => c.provider === 'internal')) {
    lista.push({ provider: 'internal', enabled: true, priority: 99 })
  }
  return lista
    .filter(c => c.enabled !== false)
    .sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50))
}
