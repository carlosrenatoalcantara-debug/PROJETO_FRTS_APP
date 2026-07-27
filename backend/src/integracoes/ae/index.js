/**
 * index.js — Composição da integração AE
 *
 * Único lugar que decide QUAL adaptador atende ao contrato IAEProvider.
 * Nem o orquestrador nem as rotas conhecem essa escolha.
 *
 * Configuração (variáveis de ambiente):
 *   AE_PROVIDER    'local' (padrão quando AE_LIBRARY_DIR existe) | 'http'
 *   AE_LIBRARY_DIR caminho da biblioteca do AE em disco
 *   AE_URL         base da API pública do AE (adaptador HTTP)
 *   AE_TIMEOUT_MS  timeout das chamadas HTTP (padrão 15000)
 *
 * Sem configuração, a integração fica desligada: `providerConfigurado()`
 * devolve false e a rota responde 501 em vez de falhar de forma obscura.
 */

import { criarAeLocalFolderProvider } from './aeLocalFolderProvider.js'
import { criarAeHttpProvider } from './aeHttpProvider.js'

export { assertProvider, resolverFamilia, FAMILIAS_AE } from './IAEProvider.js'
export { criarAeLocalFolderProvider } from './aeLocalFolderProvider.js'
export { criarAeHttpProvider } from './aeHttpProvider.js'
export {
  compararVersao, mesmaVersao, avaliarAtualizacao, NAO_COMPARAVEL,
} from './knowledgeVersion.js'

/** A integração está configurada? */
export function providerConfigurado(env = process.env) {
  return Boolean(env.AE_LIBRARY_DIR || env.AE_URL)
}

/**
 * Cria o provider conforme a configuração vigente.
 *
 * @param {object} [env=process.env]
 * @returns {object} implementação de IAEProvider
 * @throws {Error} quando a integração não está configurada
 */
export function criarProviderAE(env = process.env) {
  const tipo = env.AE_PROVIDER || (env.AE_LIBRARY_DIR ? 'local' : env.AE_URL ? 'http' : null)

  if (tipo === 'local') {
    if (!env.AE_LIBRARY_DIR) {
      throw new Error('AE_PROVIDER=local exige AE_LIBRARY_DIR.')
    }
    return criarAeLocalFolderProvider({ raiz: env.AE_LIBRARY_DIR })
  }

  if (tipo === 'http') {
    if (!env.AE_URL) {
      throw new Error('AE_PROVIDER=http exige AE_URL.')
    }
    return criarAeHttpProvider({
      baseUrl: env.AE_URL,
      timeoutMs: Number.parseInt(env.AE_TIMEOUT_MS, 10) || undefined,
    })
  }

  const e = new Error('Integração AE não configurada (defina AE_LIBRARY_DIR).')
  e.code = 'AE_NAO_CONFIGURADO'
  throw e
}
