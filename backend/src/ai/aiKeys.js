/**
 * aiKeys.js — AI-ARCH-01 (FASE 2 + FASE 9)
 *
 * FONTE ÚNICA de credenciais de IA. Lê EXCLUSIVAMENTE de variáveis de ambiente
 * (Railway). NUNCA de MongoDB, coleções, config do sistema ou arquivos versionados.
 *
 * FASE 9 — canonização de nomes (elimina ambiguidade):
 *   - Anthropic/Claude  → canônico: ANTHROPIC_API_KEY
 *                         legado/typo: ANTROPIC_API_KEY (sem H) — NÃO usar
 *   - Google/Gemini     → canônico: GOOGLE_API_KEY
 *                         alias aceito (legado): GEMINI_API_KEY
 *   - OpenAI/GPT        → canônico: OPENAI_API_KEY
 *
 * PURO em relação a I/O (só lê process.env). Sem dependências.
 */

/** Lê uma env var sem expor o valor; retorna string ou null. */
function _env(nome) {
  const v = process.env[nome]
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/** Mascarar um segredo para logs/diagnóstico (nunca expõe o valor). */
export function mascarar(chave) {
  if (!chave) return null
  const s = String(chave)
  if (s.length <= 8) return '***'
  return `${s.slice(0, 4)}…${s.slice(-2)} (len=${s.length})`
}

export function getAnthropicKey() {
  return _env('ANTHROPIC_API_KEY')
}

export function getGoogleKey() {
  // GOOGLE_API_KEY é o canônico; GEMINI_API_KEY é alias legado aceito.
  return _env('GOOGLE_API_KEY') || _env('GEMINI_API_KEY')
}

export function getOpenAIKey() {
  return _env('OPENAI_API_KEY')
}

/**
 * Diagnóstico de configuração de chaves — para FASE 9 e Health Monitor.
 * Não expõe valores; apenas presença + avisos de ambiguidade.
 * @returns {{providers:Object, ambiguidades:string[], orfas:string[]}}
 */
export function diagnosticarChaves() {
  const ambiguidades = []
  const orfas = []

  // FASE 9: detectar a variável com typo (sem H) — órfã, ninguém lê.
  if (_env('ANTROPIC_API_KEY')) {
    orfas.push('ANTROPIC_API_KEY (sem H) está definida mas NÃO é lida por nenhum código — remover para evitar confusão.')
  }
  // Duplicidade Google/Gemini
  if (_env('GOOGLE_API_KEY') && _env('GEMINI_API_KEY')) {
    ambiguidades.push('GOOGLE_API_KEY e GEMINI_API_KEY ambas definidas — padronizar em GOOGLE_API_KEY (canônico).')
  }

  return {
    providers: {
      anthropic: { canonica: 'ANTHROPIC_API_KEY', configurada: !!getAnthropicKey(), mascara: mascarar(getAnthropicKey()) },
      google:    { canonica: 'GOOGLE_API_KEY', alias_legado: 'GEMINI_API_KEY', configurada: !!getGoogleKey(), mascara: mascarar(getGoogleKey()) },
      openai:    { canonica: 'OPENAI_API_KEY', configurada: !!getOpenAIKey(), mascara: mascarar(getOpenAIKey()) },
    },
    ambiguidades,
    orfas,
  }
}
