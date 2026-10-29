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

// ─── Renovação do access token ───────────────────────────────────────────────
//
// O access token vale 15 minutos e o refresh token vale 7 dias. Sem renovar, o
// usuário era expulso a cada 15 minutos mesmo com sessão válida. A renovação
// acontece aqui, no mesmo ponto único por onde toda chamada já passa.

/** Promessa de renovação em curso — várias chamadas em 401 compartilham uma só. */
let renovacaoEmCurso = null

/** Lê o refresh token guardado no login. */
function obterRefreshToken() {
  try {
    return localStorage.getItem('refreshToken') || null
  } catch {
    return null
  }
}

/** Apaga as credenciais: a sessão acabou de verdade. */
function limparSessao() {
  try {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
  } catch { /* localStorage indisponível */ }
}

/**
 * Troca o refresh token por um access token novo. Devolve o token novo, ou null
 * quando não há refresh token ou o backend o recusa (aí a sessão acabou mesmo).
 *
 * @returns {Promise<string|null>}
 */
export function renovarAccessToken() {
  if (renovacaoEmCurso) return renovacaoEmCurso

  renovacaoEmCurso = (async () => {
    const refreshToken = obterRefreshToken()
    if (!refreshToken) return null

    const alvo = fetchOriginal || globalThis.fetch
    try {
      const res = await alvo.call(globalThis, '/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      if (!res.ok) {
        limparSessao()
        return null
      }
      const corpo = await res.json().catch(() => null)
      const novo = corpo?.accessToken || null
      if (!novo) {
        limparSessao()
        return null
      }
      try { localStorage.setItem('accessToken', novo) } catch { /* idem */ }
      return novo
    } catch {
      // Falha de rede não é sessão expirada — não apaga nada.
      return null
    } finally {
      renovacaoEmCurso = null
    }
  })()

  return renovacaoEmCurso
}

/** A requisição pode ser repetida? Um body já consumido não pode. */
function podeRepetir(input, init) {
  if (input instanceof Request) return false
  const body = init?.body
  if (!body) return true
  // ReadableStream e Blob em streaming não sobrevivem a um segundo envio.
  return typeof body === 'string' || body instanceof URLSearchParams || body instanceof FormData
}

/**
 * Executa a requisição e, num 401 de rota protegida desta API, renova o token
 * uma única vez e repete. Qualquer outro desfecho passa intacto.
 */
async function enviarComRenovacao(input, init) {
  const alvo = fetchOriginal || globalThis.fetch
  const res = await alvo.call(globalThis, input, comCredencial(input, init))

  if (res.status !== 401) return res

  const url = urlDoInput(input)
  if (!ehApiDaAplicacao(url) || ehCaminhoPublico(url)) return res
  if (url.includes('/api/auth/refresh')) return res
  if (!podeRepetir(input, init)) return res
  if (!obterToken()) return res

  const novo = await renovarAccessToken()
  if (!novo) return res

  return alvo.call(globalThis, input, comCredencial(input, init))
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
  return enviarComRenovacao(input, init)
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
  const interceptado = (input, init) => enviarComRenovacao(input, init)
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
