/**
 * autenticacaoRotasIA.check.js — as rotas que leem arquivo e chamam IA eram
 * anônimas (2026-11-25): /api/datasheet, /api/fatura, /api/faturas,
 * /api/carregadores-ev e /api/ai.
 *
 * Trava três coisas: o `server.js` monta cada uma protegida; os routers reais
 * recusam anônimo ANTES de ler o arquivo; e todo chamador do frontend leva o
 * token. Nenhuma requisição daqui chega a um provedor de IA nem ao banco.
 *
 *   node backend/src/dominio/__checks__/autenticacaoRotasIA.check.js
 */
import http from 'node:http'
import path from 'node:path'
import crypto from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import express from 'express'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
let falhas = 0
function ok(cond, nome) {
  if (!cond) falhas++
  console.log(`${cond ? '  ok   ' : '  FALHA'} ${nome}`)
}

const ALVOS = [
  { base: '/api/datasheet', variavel: 'rotasDatasheet', arquivo: 'datasheet', modulo: 'catalogo', minimo: 7 },
  { base: '/api/fatura', variavel: 'rotasFatura', arquivo: 'fatura', modulo: 'fv', minimo: 2 },
  { base: '/api/faturas', variavel: 'rotasFaturasInteligente', arquivo: 'faturasInteligente', modulo: 'fv', org: true, minimo: 8 },
  { base: '/api/carregadores-ev', variavel: 'rotasCarregadoresEV', arquivo: 'carregadoresEV', modulo: 'catalogo', minimo: 10 },
  { base: '/api/ai', variavel: 'rotasAI', arquivo: 'ai', modulo: 'configuracoes', minimo: 3 },
]

// ── server.js ───────────────────────────────────────────────────────────────
{
  const linhas = readFileSync(path.join(RAIZ, 'backend/src/server.js'), 'utf8').split(/\r?\n/)
  const ativa = (l) => !/^\s*(\/\/|\*|\/\*)/.test(l)
  const decodifica = linhas.findIndex((l) => ativa(l) && l.includes('app.use(decodificarUsuario)'))
  for (const { base, variavel, modulo, org } of ALVOS) {
    const montagens = linhas.map((l, i) => [l, i])
      .filter(([l]) => ativa(l) && (new RegExp(`\\b${variavel}\\b`).test(l) || l.includes(`'${base}'`)) && l.includes('app.use('))
    const esperado = new RegExp(`app\\.use\\('${base}',\\s*protegerModulo\\('${modulo}'\\),\\s*${org ? 'exigirOrganizacao,\\s*' : ''}${variavel}\\)`)
    ok(montagens.length === 1 && esperado.test(montagens[0][0]) && decodifica >= 0 && montagens[0][1] > decodifica,
      `server.js: ${base} uma vez só, com protegerModulo('${modulo}')${org ? ' + exigirOrganizacao' : ''}`)
  }
}

// ── Routers reais ───────────────────────────────────────────────────────────
// Segredos só deste processo: nada do .env entra aqui.
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex')
process.env.JWT_REFRESH_SECRET = crypto.randomBytes(48).toString('hex')
for (const k of Object.keys(process.env)) if (/GEMINI|GOOGLE_API|ANTHROPIC|CLAUDE_API|OPENAI/i.test(k)) delete process.env[k]

const { decodificarUsuario, protegerModulo, exigirOrganizacao } = await import('../../middleware/rbacMiddleware.js')
const { default: JWTService } = await import('../../security/jwt.js')
const { default: errorHandler } = await import('../../middleware/errorHandler.js')
const { LIMITE_DATASHEET_MB } = await import('../../middleware/uploadDatasheet.js')
const jwt = new JWTService()
const token = (role, empresa_id = 'empresa-check') =>
  jwt.generateTokenPair({ id: 'check', email: 'check@local.test', role, empresa_id }).accessToken

const app = express()
app.use(express.json())
app.use(decodificarUsuario)
for (const a of ALVOS) {
  a.router = (await import(`../../routes/${a.arquivo}.js`)).default
  app.use(a.base, protegerModulo(a.modulo), ...(a.org ? [exigirOrganizacao] : []), a.router)
}
app.use(errorHandler)
const servidor = http.createServer(app)
await new Promise((pronto) => servidor.listen(0, '127.0.0.1', pronto))
const origemApi = `http://127.0.0.1:${servidor.address().port}`
const chamar = async (metodo, rota, { auth, body } = {}) => {
  const headers = auth ? { Authorization: `Bearer ${auth}` } : {}
  if (typeof body === 'string') headers['Content-Type'] = 'application/json'
  const r = await fetch(origemApi + rota, { method: metodo, headers, body })
  return { status: r.status, json: await r.json().catch(() => null) }
}
const arquivo = (campo, bytes) => {
  const fd = new FormData()
  fd.append(campo, new Blob([Buffer.alloc(bytes)], { type: 'application/pdf' }), 'a.pdf')
  return fd
}
const ACIMA = LIMITE_DATASHEET_MB * 1024 * 1024 + 1

// As rotas saem do próprio router: rota nova entra no check sem ninguém lembrar.
for (const { base, router, minimo } of ALVOS) {
  const rotas = router.stack.filter((c) => c.route)
    .flatMap((c) => Object.keys(c.route.methods).map((m) => [m.toUpperCase(), c.route.path]))
  const abertas = []
  for (const [metodo, rota] of rotas) {
    const r = await chamar(metodo, base + rota)
    const i = await chamar(metodo, base + rota, { auth: 'nao.e.token' })
    if (r.status !== 401 || r.json?.codigo !== 'NAO_AUTENTICADO' || i.status !== 401) abertas.push(`${metodo} ${rota}`)
  }
  ok(rotas.length >= minimo && abertas.length === 0, `${base}: ${rotas.length} rotas, 401 sem token e com token inválido${abertas.length ? ` — abertas: ${abertas.join(', ')}` : ''}`)
}

// Arquivo acima do limite sem token: 401, e não 413 — o multer não chegou a ler.
const UPLOADS = [
  ['/api/datasheet/extrair-multi', 'pdf'], ['/api/datasheet/extrair-datasheet', 'pdf'],
  ['/api/fatura/extrair', 'fatura'], ['/api/fatura/debug', 'fatura'], ['/api/faturas/analisar', 'pdf'],
]
for (const [rota, campo] of UPLOADS) {
  const r = await chamar('POST', rota, { body: arquivo(campo, ACIMA) })
  ok(r.status === 401, `anônimo com arquivo acima do limite em ${rota}: 401`)
}

// Perfis. Corpo vazio: o 400 vem do controller e prova que passou sem acionar IA.
const CATALOGO = ['administrador', 'diretor', 'engenheiro']
const FV = [...CATALOGO, 'tecnico', 'comercial']
const TODOS = [...FV, 'financeiro', 'visualizador']
const ESCRITA = [
  ['/api/datasheet/extrair-multi', () => new FormData(), CATALOGO],
  ['/api/datasheet/extrair-datasheet', () => new FormData(), CATALOGO],
  ['/api/carregadores-ev/upload-datasheet', () => '{}', CATALOGO],
  ['/api/fatura/extrair', () => new FormData(), FV],
  ['/api/faturas/analisar', () => new FormData(), FV],
]
for (const [rota, corpo, podem] of ESCRITA) {
  const errados = []
  for (const perfil of TODOS) {
    const { status } = await chamar('POST', rota, { auth: token(perfil), body: corpo() })
    if (status !== (podem.includes(perfil) ? 400 : 403)) errados.push(`${perfil}=${status}`)
  }
  ok(errados.length === 0, `${rota}: passam ${podem.length} perfis, os outros 403${errados.length ? ` — ${errados.join(', ')}` : ''}`)
}
{
  const id = '0'.repeat(24)
  const negados = await Promise.all(TODOS.slice(1).map((p) => chamar('DELETE', `/api/carregadores-ev/${id}`, { auth: token(p) })))
  ok(negados.every((r) => r.status === 403), 'excluir carregador: só administrador')
  const ping = await Promise.all(TODOS.slice(1).map((p) => chamar('POST', '/api/ai/ping', { auth: token(p) })))
  ok(ping.every((r) => r.status === 403), 'sondagem paga de IA: só administrador')
  const saude = await chamar('GET', '/api/ai/health', { auth: token('engenheiro') })
  ok(saude.status === 200, 'saúde da IA: leitura para quem vê configurações')
  const semOrg = await chamar('POST', '/api/faturas/analisar', { auth: token('engenheiro', null), body: new FormData() })
  ok(semOrg.status === 403 && semOrg.json?.codigo === 'TENANT_AUSENTE', 'fatura com revisão exige organização')
  const dup = await chamar('GET', '/api/datasheet/verificar-duplicata', { auth: token('visualizador') })
  ok(dup.status === 200 && dup.json?.duplicata === false, 'leitura do catálogo segue aberta a qualquer perfil autenticado')
}
for (const rota of ['/api/fatura/extrair', '/api/fatura/debug']) {
  const r = await chamar('POST', rota, { auth: token('engenheiro'), body: arquivo('fatura', ACIMA) })
  ok(r.status === 413 && /arquivo passa de 25 MB/.test(r.json?.erro || ''), `${rota}: acima do limite é 413 com mensagem`)
}
{
  const r = await chamar('POST', '/api/fatura/extrair', { auth: token('engenheiro'), body: arquivo('pdf', 10) })
  ok(r.status === 400 && /"fatura"/.test(r.json?.erro || ''), 'conta no campo errado: 400 com o nome certo')
}
servidor.closeAllConnections()
servidor.close()

// ── Chamadores do frontend ──────────────────────────────────────────────────
{
  const src = path.join(RAIZ, 'frontend/src')
  const origem = 'https://app.local.test'
  globalThis.window = { location: { href: `${origem}/equipamentos`, origin: origem } }
  globalThis.localStorage = { getItem: (k) => (k === 'accessToken' ? 'TOKEN' : null), setItem() {}, removeItem() {} }
  const { comCredencial } = await import(pathToFileURL(path.join(src, 'services/http.js')).href)

  // Qualquer literal com a rota, e não só `fetch('...')`: há URL guardada em variável.
  const LITERAL = /([`'"])([^`'"\n]*\/api\/(?:datasheet|faturas?|carregadores-ev|ai)(?![\w-])[^`'"\n]*)\1/g
  const porRota = {}
  const semToken = []
  let total = 0
  for (const f of readdirSync(src, { recursive: true }).map(String)) {
    if (!/\.(jsx?|tsx?)$/.test(f) || /__tests__/.test(f)) continue
    const texto = readFileSync(path.join(src, f), 'utf8')
    const achados = [...texto.matchAll(LITERAL)]
    if (achados.length && /XMLHttpRequest|axios|sendBeacon|EventSource/.test(texto)) semToken.push(`${f} (não usa fetch)`)
    // API_URL é local e literal: se alguém apontar para outra origem, o
    // interceptor não anexa o token e a linha abaixo acusa.
    const apiUrl = texto.match(/const API_URL\s*=\s*(['"])(.*?)\1/)?.[2] ?? 'https://desconhecida.local.test'
    for (const [, , url] of achados) {
      total++
      const real = url.replace('${API_URL}', apiUrl).replace(/\$\{[^}]*\}/g, 'x')
      const corpo = new FormData()
      const init = comCredencial(real, { method: 'POST', headers: { 'X-Outro': '1' }, body: corpo })
      const h = new Headers(init.headers)
      if (h.get('Authorization') !== 'Bearer TOKEN' || h.get('X-Outro') !== '1' || h.has('Content-Type') || init.body !== corpo) semToken.push(`${f}: ${url}`)
      const base = real.match(/\/api\/([\w-]+)/)[1]
      porRota[base] = (porRota[base] || 0) + 1
    }
  }
  console.log('        chamadas por rota:', JSON.stringify(porRota))
  ok(porRota.datasheet >= 4 && porRota.fatura >= 3 && porRota.faturas >= 7 && porRota['carregadores-ev'] >= 4, `${total} chamadas encontradas no frontend`)
  ok(semToken.length === 0, `todas levam o token, sem mexer no corpo nem nos outros headers${semToken.length ? ` — ${semToken.join('; ')}` : ''}`)

  const main = readFileSync(path.join(src, 'main.jsx'), 'utf8')
  const instala = main.search(/^instalarInterceptorHttp\(\)/m)
  ok(instala >= 0 && instala < main.indexOf('createRoot('), 'interceptor instalado antes de renderizar')
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo ok')
process.exit(falhas ? 1 : 0)
