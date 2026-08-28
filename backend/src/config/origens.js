/**
 * origens.js — fonte única da origem pública e da allowlist de CORS — FV-INFRA-058.
 *
 * ── O que este módulo substitui ─────────────────────────────────────────────
 * Havia três leituras concorrentes da mesma ideia, cada uma com o próprio
 * fallback de desenvolvimento:
 *
 *   EnvioPropostaService.js:45   APP_URL                  || 'http://localhost:5173'
 *   routes/gestao.js:16          APP_URL || FRONTEND_URL  || 'http://localhost:5173'
 *   security-headers.js:76       FRONTEND_URL             || 'http://localhost:5173'
 *
 * Definir só uma das variáveis deixava a outra metade quebrada em silêncio. E o
 * `.env.example` saía inconsistente consigo mesmo: `FRONTEND_URL=…:3000` ao lado
 * de `APP_URL=…:5173`.
 *
 * A FV-QA-056 mediu a consequência: rodando com o Vite na 5175 (5173 e 5174
 * ocupadas) e sem `APP_URL`, a proposta enviada ao cliente saiu apontando para
 * `http://localhost:5173/proposta/…` — um endereço que não existia.
 *
 * ── O CORS que existia ──────────────────────────────────────────────────────
 * `server.js:139` aceitava qualquer origem cujo texto CONTIVESSE `localhost`:
 *
 *   origin.includes('localhost')
 *
 * Com `credentials: true`, isso libera `https://localhost.dominio-malicioso.com`
 * a ler respostas autenticadas. Aqui a comparação passa a ser de origem exata,
 * contra um conjunto — nunca substring, nunca regex.
 *
 * ── Fail-closed ─────────────────────────────────────────────────────────────
 * Em `staging` e `production`, `APP_URL` é OBRIGATÓRIA: sem ela o processo não
 * sobe. É deliberado. A alternativa — cair em `localhost` — foi exatamente o
 * defeito medido, e num ambiente publicado ela mandaria ao cliente um link
 * inválido em vez de falhar na inicialização, onde alguém vê.
 *
 * Nenhum valor secreto passa por aqui: só origens HTTP.
 */

/** `development` | `staging` | `production`. `APP_AMBIENTE` tem precedência. */
export function ambiente() {
  const a = (process.env.APP_AMBIENTE || process.env.NODE_ENV || 'development').trim().toLowerCase()
  return a === 'production' || a === 'staging' ? a : 'development'
}

export const ehPublicado = () => ambiente() !== 'development'

/** Origens locais aceitas em desenvolvimento. Lista fechada — não é padrão de texto. */
const LOCAIS_DEV = Object.freeze([
  'http://localhost:5173', 'http://127.0.0.1:5173',
  'http://localhost:5174', 'http://127.0.0.1:5174',
  'http://localhost:5175', 'http://127.0.0.1:5175',
  'http://localhost:3000', 'http://127.0.0.1:3000',
])

export class ErroConfiguracaoOrigem extends Error {
  constructor(msg) {
    super(msg)
    this.name = 'ErroConfiguracaoOrigem'
    this.codigo = 'ORIGEM_NAO_CONFIGURADA'
  }
}

/**
 * Normaliza para origem canônica (`https://host[:porta]`), sem caminho nem barra
 * final. Devolve `null` quando não é uma URL http(s) utilizável — nunca uma
 * string aproximada.
 */
export function normalizarOrigem(bruta) {
  if (typeof bruta !== 'string' || bruta.trim() === '') return null
  try {
    const u = new URL(bruta.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.origin
  } catch {
    return null
  }
}

/**
 * A origem pública do frontend — a partir da qual nascem os links enviados ao
 * cliente. `FRONTEND_URL` é aceita como alias legado para não quebrar ambientes
 * que já a definiram, e é a ÚNICA compatibilidade preservada.
 *
 * @throws {ErroConfiguracaoOrigem} em staging/produção sem configuração.
 */
export function origemPublica() {
  const configurada = normalizarOrigem(process.env.APP_URL)
    ?? normalizarOrigem(process.env.FRONTEND_URL)

  if (configurada) return configurada

  if (ehPublicado()) {
    throw new ErroConfiguracaoOrigem(
      `APP_URL é obrigatória em ${ambiente()}. Sem ela, links enviados ao cliente `
      + 'apontariam para localhost. Defina APP_URL com a origem pública do frontend '
      + '(ex.: https://staging.exemplo.com).',
    )
  }
  // Desenvolvimento: valor explícito, o mesmo que o Vite usa por padrão.
  return 'http://localhost:5173'
}

/** Monta uma URL pública a partir da origem única. `caminho` começa com `/`. */
export function urlPublica(caminho = '/') {
  const c = String(caminho).startsWith('/') ? caminho : `/${caminho}`
  return `${origemPublica()}${c}`
}

/**
 * Allowlist de CORS: a origem pública mais o que `CORS_ORIGENS` declarar
 * (separadas por vírgula). Em desenvolvimento, mais as portas locais conhecidas.
 *
 * Entradas ilegíveis são DESCARTADAS, não aproximadas.
 * @returns {Set<string>} origens exatas
 */
export function origensPermitidas() {
  const set = new Set()
  set.add(origemPublica())

  for (const parte of String(process.env.CORS_ORIGENS || '').split(',')) {
    const o = normalizarOrigem(parte)
    if (o) set.add(o)
  }

  if (!ehPublicado()) for (const o of LOCAIS_DEV) set.add(o)

  return set
}

/**
 * A origem pode receber resposta com credencial?
 *
 * `undefined` (requisição sem cabeçalho `Origin` — curl, health check, mesma
 * origem) é permitido: não há navegador para proteger. Qualquer outra coisa é
 * comparada por igualdade exata contra a allowlist.
 */
export function origemPermitida(origem, permitidas = origensPermitidas()) {
  if (origem === undefined || origem === null || origem === '') return true
  const o = normalizarOrigem(origem)
  return o !== null && permitidas.has(o)
}

/**
 * Opções de CORS para o Express. Calcula a allowlist a cada requisição para que
 * um ambiente possa ser reconfigurado sem reiniciar — e para que os testes não
 * dependam da ordem de import.
 */
export function opcoesCors({ aoRecusar = null } = {}) {
  return {
    origin(origem, callback) {
      const ok = origemPermitida(origem)
      if (!ok && aoRecusar) aoRecusar(origem)
      callback(null, ok)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200,
  }
}

/** Resumo para log de inicialização. Não contém segredo. */
export function resumoOrigens() {
  return {
    ambiente: ambiente(),
    origem_publica: origemPublica(),
    cors_permitidas: [...origensPermitidas()],
  }
}

export default {
  ambiente, ehPublicado, origemPublica, urlPublica,
  origensPermitidas, origemPermitida, opcoesCors, normalizarOrigem,
  resumoOrigens, ErroConfiguracaoOrigem,
}
