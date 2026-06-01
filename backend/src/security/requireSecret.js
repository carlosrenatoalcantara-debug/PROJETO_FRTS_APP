/**
 * requireSecret.js — P0-SEC-HARDENING-FINAL (FASE 1)
 *
 * Fail-closed para segredos obrigatórios. Mesmo padrão de ENCRYPTION_KEY:
 * se o segredo não existir, a aplicação NÃO inicia (lança no carregamento).
 * Proíbe fallback silencioso para valores de desenvolvimento.
 */

/**
 * @param {string} nome  nome da variável de ambiente obrigatória
 * @returns {string} valor (garantido não-vazio)
 * @throws se ausente/vazia
 */
export function requireSecret(nome) {
  const v = process.env[nome]
  if (v == null || String(v).trim() === '') {
    throw new Error(
      `[SEGURANÇA] ${nome} não configurada nas variáveis de ambiente. ` +
      `Aplicação não inicia (fail-closed). Configure ${nome} no Railway.`
    )
  }
  return String(v)
}
