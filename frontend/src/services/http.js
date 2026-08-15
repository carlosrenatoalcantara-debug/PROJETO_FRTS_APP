/**
 * http.js — camada HTTP única da aplicação.
 *
 * Motivo: o backend passou de fail-open para fail-closed (M-4). Toda chamada a
 * router protegido precisa de `Authorization`. Existem 226 chamadas `fetch` em
 * 85 arquivos — injetar o header manualmente em cada uma é inviável e frágil.
 *
 * Esta camada resolve isso em um único ponto e de duas formas complementares:
 *
 *   1. `apiFetch` — ponto de entrada explícito para código novo.
 *   2. `instalarInterceptorHttp()` — instalado uma vez no bootstrap, faz o
 *      `window.fetch` existente passar pela mesma injeção. Nenhuma das chamadas
 *      atuais precisa ser reescrita.
 *
 * ─── Regra de injeção: por ORIGEM, nunca por caminho ────────────────────────
 *
 * A aplicação consome APIs de terceiros que também usam caminho `/api/`
 * (ex.: https://power.larc.nasa.gov/api/temporal/...). Decidir pelo caminho
 * vazaria o JWT do usuário para hosts externos.
 *
 * O token só é anexado quando a origem do destino é a própria aplicação ou a
 * origem de `VITE_API_URL`, E o caminho começa com `/api/`.
 */

// Origem da API quando `VITE_API_URL` é absoluta (produção usa
// https://fortesolar.com.br/api). Vazio/relativo ⇒ mesma origem da página.
const ORIGEM_API = (() => {
  const bruta = import.meta.env?.VITE_API_URL || ''
  if (!bruta || bruta.startsWith('/')) return null
  try {
    return new URL(bruta).origin
  } catch {
    return null
  }
})()

/** Caminhos públicos: não devem carregar credencial do usuário. */
const CAMINHOS_PUBLICOS = [
  '/api/auth/login',
  '/api/auth/reset',
  '/api/auth/redefinir',
]

/**
 * Token do mecanismo oficial da aplicação (o mesmo que o AuthContext usa:
 * `accessToken`, com fallback para a chave legada `token`).
 * @returns {string|null}
 */
export function obterToken() {
  try {
    return localStorage.getItem('accessToken') || localStorage.getItem('token') || null
  } catch {
    // localStorage indisponível (SSR, modo restrito): segue sem credencial.
    return null
  }
}

/** Extrai a URL de um input de fetch (string, URL ou Request). */
function urlDoInput(input) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  if (input && typeof input.url === 'string') return input.url
  return ''
}

/**
 * O destino é a API desta aplicação?
 * @param {string} url
 * @returns {boolean}
 */
export function ehApiDaAplicacao(url) {
  if (!url) return false
  let alvo
  try {
    // Base resolve URLs relativas ("/api/x") contra a página atual.
    alvo = new URL(url, typeof window !== 'undefined' ? window.location.href : 'http://localhost')
  } catch {
    return false
  }

  const origemPagina = typeof window !== 'undefined' ? window.location.origin : null
  const origemPermitida = alvo.origin === origemPagina || (ORIGEM_API !== null && alvo.origin === ORIGEM_API)
  if (!origemPermitida) return false

  return alvo.pathname.startsWith('/api/')
}

/** Caminho público (login/reset) — nunca recebe credencial. */
function ehCaminhoPublico(url) {
  try {
    const alvo = new URL(url, typeof window !== 'undefined' ? window.location.href : 'http://localhost')
    return CAMINHOS_PUBLICOS.some((p) => alvo.pathname.startsWith(p))
  } catch {
    return false
  }
}

/** Já existe Authorization nas opções ou no Request? */
function jaTemAuthorization(input, init) {
  const h = init?.headers
  if (h) {
    if (typeof Headers !== 'undefined' && h instanceof Headers) {
      if (h.has('Authorization') || h.has('authorization')) return true
    } else if (Array.isArray(h)) {
      if (h.some(([k]) => String(k).toLowerCase() === 'authorization')) return true
    } else if (typeof h === 'object') {
      if (Object.keys(h).some((k) => k.toLowerCase() === 'authorization')) return true
    }
  }
  if (input && typeof input.headers?.has === 'function' && input.headers.has('Authorization')) return true
  return false
}

/**
 * Devolve as opções com Authorization injetado, quando aplicável.
 * Preserva integralmente headers, body, method e demais campos.
 *
 * @param {RequestInfo|URL} input
 * @param {RequestInit} [init]
 * @returns {RequestInit|undefined} init original quando nada muda
 */
export function comCredencial(input, init) {
  const url = urlDoInput(input)
  if (!ehApiDaAplicacao(url)) return init
  if (ehCaminhoPublico(url)) return init
  if (jaTemAuthorization(input, init)) return init

  const token = obterToken()
  if (!token) return init

  const headers = new Headers(init?.headers || (input && input.headers) || undefined)
  headers.set('Authorization', `Bearer ${token}`)
  return { ...(init || {}), headers }
}

/**
 * Ponto de entrada HTTP da aplicação. Assinatura e retorno idênticos a `fetch`
 * — devolve `Response`, sem alterar o comportamento de quem consome.
 *
 * @param {RequestInfo|URL} input
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
export function apiFetch(input, init) {
  const alvo = fetchOriginal || globalThis.fetch
  return alvo.call(globalThis, input, comCredencial(input, init))
}

/**
 * Erro uniforme para consumidores que preferem exceção a checagem de `res.ok`.
 */
export class ErroHttp extends Error {
  constructor(mensagem, { status, codigo, corpo } = {}) {
    super(mensagem)
    this.name = 'ErroHttp'
    this.status = status ?? null
    this.codigo = codigo ?? null
    this.corpo = corpo ?? null
  }
}

/**
 * Variante que devolve JSON e lança `ErroHttp` em falha. Uso opcional — as
 * chamadas existentes seguem usando `apiFetch`/`fetch` e checando `res.ok`.
 *
 * @param {RequestInfo|URL} input
 * @param {RequestInit} [init]
 * @returns {Promise<any>}
 */
export async function apiJson(input, init) {
  const res = await apiFetch(input, init)
  const corpo = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ErroHttp(corpo?.erro || corpo?.error || `HTTP ${res.status}`, {
      status: res.status,
      codigo: corpo?.codigo || null,
      corpo,
    })
  }
  return corpo
}

// ─── Interceptor global ──────────────────────────────────────────────────────

let fetchOriginal = null

/**
 * Faz o `window.fetch` da aplicação passar pela injeção de credencial.
 * Idempotente: chamadas repetidas não reempacotam o fetch.
 *
 * Chamadas a hosts externos permanecem intocadas (regra de origem).
 *
 * @returns {boolean} true se instalou agora
 */
export function instalarInterceptorHttp() {
  if (typeof globalThis.fetch !== 'function') return false
  if (fetchOriginal) return false
  // O estado de módulo não sobrevive a uma reavaliação (HMR, módulo em dois
  // chunks). O marcador vive no próprio fetch global e sobrevive: sem esta
  // checagem, reinstalaríamos sobre um interceptor já ativo.
  if (globalThis.fetch.__forteSolarInterceptor) return false

  // Guarda a referência exata para que `remover` restaure o mesmo objeto.
  // A invocação usa `.call(globalThis, …)` — fetch destacado do contexto
  // global lança "Illegal invocation" no navegador.
  fetchOriginal = globalThis.fetch
  const interceptado = (input, init) => fetchOriginal.call(globalThis, input, comCredencial(input, init))
  interceptado.__forteSolarInterceptor = true
  globalThis.fetch = interceptado
  return true
}

/** Restaura o fetch original. Usado por testes. */
export function removerInterceptorHttp() {
  if (!fetchOriginal) return false
  globalThis.fetch = fetchOriginal
  fetchOriginal = null
  return true
}
