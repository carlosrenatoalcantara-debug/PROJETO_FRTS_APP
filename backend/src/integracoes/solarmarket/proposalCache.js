/**
 * proposalCache.js — P0-SOLARMARKET-CACHE-BATCH-01
 *
 * Cache LOCAL e PERSISTENTE das respostas de `GET /projects/:id/proposals`.
 * Elimina a re-busca (~1,1 s/chamada × 642 ≈ 12 min) em execuções repetidas de dry-run/import.
 *
 * Características:
 *  - Persistente em disco (JSON por project_id) — sobrevive entre processos.
 *  - TTL configurável (default 7 dias).
 *  - Chave = project_id (1 arquivo por projeto).
 *  - Invalidação manual (`limparCache`) e force-refresh (opção `forceRefresh`).
 *  - 100% local: NÃO grava no Atlas, NÃO altera o SolarMarket.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync, rmSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const CACHE_DIR = resolve(__dirname, '../../../.cache/solarmarket/proposals')
const TTL_PADRAO_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias

function _garantirDir() { if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true }) }
function _arquivo(projetoId) { return join(CACHE_DIR, `${String(projetoId).replace(/[^\w.-]/g, '_')}.json`) }

/**
 * Lê a proposta do cache se válida (dentro do TTL). Retorna null se ausente/expirada/force.
 * @returns {object|null} { proposta, cachedEm } ou null
 */
export function lerCache(projetoId, { ttlMs = TTL_PADRAO_MS, forceRefresh = false } = {}) {
  if (forceRefresh) return null
  const f = _arquivo(projetoId)
  if (!existsSync(f)) return null
  try {
    const env = JSON.parse(readFileSync(f, 'utf8'))
    if (Date.now() - new Date(env.cachedEm).getTime() > ttlMs) return null // expirado
    return env.proposta
  } catch { return null }
}

/** Grava a resposta de /proposals no cache (envelopada com timestamp). */
export function gravarCache(projetoId, proposta) {
  _garantirDir()
  writeFileSync(_arquivo(projetoId), JSON.stringify({ projetoId, cachedEm: new Date().toISOString(), proposta }))
}

/** Informações de uso: nº de propostas e bytes consumidos. */
export function infoCache() {
  if (!existsSync(CACHE_DIR)) return { arquivos: 0, bytes: 0, dir: CACHE_DIR }
  const files = readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'))
  const bytes = files.reduce((s, f) => s + statSync(join(CACHE_DIR, f)).size, 0)
  return { arquivos: files.length, bytes, mb: +(bytes / 1024 / 1024).toFixed(2), dir: CACHE_DIR }
}

/** Invalidação manual — remove todo o cache de propostas. */
export function limparCache() {
  if (existsSync(CACHE_DIR)) rmSync(CACHE_DIR, { recursive: true, force: true })
  return { limpo: true }
}

/**
 * Busca a proposta usando cache (fallback para o fetcher). `fetcher(projetoId)` deve retornar a
 * resposta de /proposals (somente leitura). Grava no cache em caso de miss.
 * @returns {{ proposta: object|null, fonte: 'cache'|'api' }}
 */
export async function obterProposta(projetoId, fetcher, opts = {}) {
  const cacheado = lerCache(projetoId, opts)
  if (cacheado !== null) return { proposta: cacheado, fonte: 'cache' }
  const proposta = await fetcher(projetoId)
  if (proposta != null) gravarCache(projetoId, proposta)
  return { proposta, fonte: 'api' }
}
