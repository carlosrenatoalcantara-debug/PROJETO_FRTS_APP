/**
 * contratoContentTypeApi.check.js — API-JSON-QA.
 *
 * `enforceJsonContentType` é montado GLOBALMENTE por `setupSecurityHeaders` e
 * vale para as 192 rotas POST/PUT/PATCH do sistema — FV, EV, catálogo, CRM,
 * clientes, autenticação. A F-UNIF-415 mexeu nele para corrigir o unifilar, e
 * esta auditoria verificou o efeito no resto.
 *
 * ── O que a auditoria mediu, contra o servidor real ─────────────────────────
 * Endpoints de AÇÃO, que se resolvem por `:id` e não recebem payload:
 *
 *   unifilar/gerar      sem corpo 200 · {} 200 · text/plain 415
 *   duplicar            sem corpo 201 · {} 201 · text/plain 415
 *   financeiro/calcular sem corpo 200 · {} 200 · text/plain 415
 *
 * Endpoints com body OBRIGATÓRIO, um por módulo:
 *
 *   auth/login · clientes · crm/leads · equipamentos · projetos-ev ·
 *   projetos-fv    sem corpo 400 · {} 400 · JSON 400 · inválido 400 · texto 415
 *   materiais      sem corpo 422 · {} 422 · JSON 422 · inválido 400 · texto 415
 *
 * Nenhum 500, nenhum 2xx indevido. Sem corpo passou a devolver o MESMO código
 * que `{}` — o erro de validação do contrato real, no lugar de um 415 que
 * falava de mídia inexistente. Autenticação (401), autorização (404 fora do
 * escopo, 400 em id malformado), rate limiting e multipart seguem intactos.
 *
 * ── A regra que este check trava ────────────────────────────────────────────
 *   Content-Type é obrigatório quando EXISTE corpo.
 *   Content-Type não é exigido quando NÃO existe corpo.
 *
 * A segunda metade é a nova; a primeira é a que não pode se perder junto.
 *
 *   node backend/src/dominio/__checks__/contratoContentTypeApi.check.js
 */
import path from 'node:path'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { enforceJsonContentType } from '../../security/security-headers.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

const req = (metodo, headers = {}) => {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
  return { method: metodo, get: (n) => h[String(n).toLowerCase()] }
}
function rodar(r) {
  let out = null
  const res = { status(c) { out = { status: c, corpo: null }; return this },
    json(b) { if (out) out.corpo = b; return this } }
  enforceJsonContentType(r, res, () => { out = { status: 'next' } })
  return out
}

secao('1 · Sem corpo: o cabeçalho que descreve o corpo não é exigido')
ok(rodar(req('POST')).status === 'next', 'POST sem `Content-Length` e sem `Content-Type`')
ok(rodar(req('POST', { 'content-length': '0' })).status === 'next', 'POST com `Content-Length: 0`')
for (const m of ['PUT', 'PATCH']) {
  ok(rodar(req(m)).status === 'next', `${m} sem corpo`)
}

secao('2 · Com corpo: a exigência CONTINUA — é o que não pode se perder')
ok(rodar(req('POST', { 'content-length': '9' })).status === 415,
  'corpo sem `Content-Type` é recusado')
ok(rodar(req('POST', { 'content-length': '9', 'content-type': 'text/plain' })).status === 415,
  '`text/plain` é recusado')
ok(rodar(req('POST', { 'content-length': '9', 'content-type': 'text/html' })).status === 415,
  '`text/html` é recusado')
ok(rodar(req('POST', { 'transfer-encoding': 'chunked' })).status === 415,
  'corpo em chunks sem tipo é recusado — a mensagem declara ter corpo')
for (const tipo of ['application/json', 'multipart/form-data; boundary=x',
  'application/x-www-form-urlencoded']) {
  ok(rodar(req('POST', { 'content-length': '9', 'content-type': tipo })).status === 'next',
    `\`${tipo.split(';')[0]}\` continua aceito`)
}

secao('3 · O 415 global tem um dono só')
const arquivos = []
const anda = (d) => { for (const n of readdirSync(d)) { const p = path.join(d, n)
  if (statSync(p).isDirectory()) { if (n === '__checks__' || n === '__tests__') continue; anda(p) }
  else if (n.endsWith('.js')) arquivos.push(p) } }
anda(path.resolve(RAIZ, 'backend/src'))
const produtores = arquivos.filter((a) => /status\(\s*415\s*\)/.test(readFileSync(a, 'utf8')))
ok(produtores.length === 1 && path.basename(produtores[0]) === 'security-headers.js',
  `único produtor de 415: ${produtores.map((p) => path.basename(p)).join(', ') || '(nenhum)'}`)

secao('4 · O middleware continua montado — a regra não vira letra morta')
const headers = readFileSync(path.resolve(RAIZ, 'backend/src/security/security-headers.js'), 'utf8')
const setup = headers.slice(headers.indexOf('export const setupSecurityHeaders'))
ok(/app\.use\(enforceJsonContentType\)/.test(setup),
  '`setupSecurityHeaders` aplica `enforceJsonContentType`')
const server = readFileSync(path.resolve(RAIZ, 'backend/src/server.js'), 'utf8')
ok(/setupSecurityHeaders\(/.test(server), 'e `server.js` chama `setupSecurityHeaders`')

secao('5 · A exceção é por AUSÊNCIA de corpo, não por rota')
// Só o CÓDIGO: o comentário do middleware cita `unifilar/gerar` como exemplo do
// caso que motivou a exceção, e citar não é privilegiar.
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const src = semComentarios(
  headers.slice(headers.indexOf('function temCorpo'), headers.indexOf('export const requestSizeLimit')))
ok(/transfer-encoding/.test(src) && /content-length/.test(src),
  'a decisão usa os cabeçalhos que declaram corpo (RFC 9110 §8.6)')
ok(!/unifilar|projetos-fv|req\.path|req\.originalUrl|req\.url/.test(src),
  'e não há exceção por caminho — nenhuma rota foi privilegiada')

secao('6 · Os métodos sem corpo semântico nunca foram afetados')
for (const m of ['GET', 'DELETE', 'HEAD', 'OPTIONS']) {
  ok(rodar(req(m, { 'content-length': '9', 'content-type': 'text/plain' })).status === 'next',
    `${m} passa mesmo com corpo mal tipado — o middleware não o cobre`)
}

console.log(falhas === 0
  ? '\nOK — Content-Type exigido quando há corpo; dispensado quando não há.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
