/**
 * contratoHttpUnifilar.check.js — F-UNIF-415.
 *
 * ── O defeito ───────────────────────────────────────────────────────────────
 * `POST /api/projetos-fv/:id/unifilar/gerar` respondia 415 quando o cliente
 * mandava a requisição sem corpo — que é o caso natural, já que o endpoint
 * identifica tudo de que precisa pela URL e não recebe parâmetro nenhum.
 *
 * A origem era `enforceJsonContentType`, middleware GLOBAL montado por
 * `setupSecurityHeaders`: ele exigia um `Content-Type` aceito em todo
 * POST/PUT/PATCH, houvesse corpo ou não. Como `Content-Type` descreve o CORPO
 * da mensagem, um POST vazio não tem o que declarar — e o frontend passou a
 * mandar `{}` com `application/json` só para satisfazer a checagem.
 *
 * ── O contrato, verificado aqui ─────────────────────────────────────────────
 *   sem corpo                     → passa (não há corpo a tipar)
 *   corpo JSON                    → exige `application/json`, como antes
 *   corpo com tipo não suportado  → 415, como antes
 *   corpo chunked sem tipo        → 415: a mensagem declara que TEM corpo
 *
 * Este check exercita o middleware diretamente, sem subir servidor nem banco —
 * ele é função pura de `(req, res, next)`.
 *
 *   node backend/src/dominio/__checks__/contratoHttpUnifilar.check.js
 */
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { enforceJsonContentType } from '../../security/security-headers.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

/** Requisição de mentira, com só o que o middleware lê. */
function req(metodo, headers = {}) {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
  return { method: metodo, get: (nome) => h[String(nome).toLowerCase()] }
}

/** Roda o middleware e devolve o que ele fez: `next` ou um status. */
function rodar(requisicao) {
  let resultado = null
  const res = {
    status(codigo) { resultado = { status: codigo, corpo: null }; return this },
    json(corpo) { if (resultado) resultado.corpo = corpo; return this },
  }
  enforceJsonContentType(requisicao, res, () => { resultado = { status: 'next' } })
  return resultado
}

secao('1 · POST sem corpo — o caso que produzia o 415')
ok(rodar(req('POST')).status === 'next',
  'sem `Content-Length` e sem `Content-Type` passa')
ok(rodar(req('POST', { 'content-length': '0' })).status === 'next',
  '`Content-Length: 0` também passa — é um POST vazio')

secao('2 · Corpo presente continua exigindo tipo suportado')
for (const tipo of ['application/json', 'application/json; charset=utf-8',
  'multipart/form-data; boundary=x', 'application/x-www-form-urlencoded']) {
  ok(rodar(req('POST', { 'content-length': '2', 'content-type': tipo })).status === 'next',
    `corpo com \`${tipo.split(';')[0]}\` passa`)
}
const recusado = rodar(req('POST', { 'content-length': '2', 'content-type': 'text/plain' }))
ok(recusado.status === 415, 'corpo `text/plain` continua 415')
ok(recusado.corpo?.code === 'UNSUPPORTED_MEDIA_TYPE', 'e o código do erro é preservado')
ok(rodar(req('POST', { 'content-length': '2' })).status === 415,
  'corpo SEM `Content-Type` continua 415 — há o que tipar e não foi tipado')

secao('3 · A exceção é estreita: `chunked` declara corpo')
ok(rodar(req('POST', { 'transfer-encoding': 'chunked' })).status === 415,
  'corpo em chunks sem tipo é recusado, mesmo sem `Content-Length`')
ok(rodar(req('POST', { 'transfer-encoding': 'chunked', 'content-type': 'application/json' })).status === 'next',
  'e passa quando o tipo vem declarado')

secao('4 · Os outros métodos seguem a mesma regra')
for (const metodo of ['PUT', 'PATCH']) {
  ok(rodar(req(metodo)).status === 'next', `${metodo} sem corpo passa`)
  ok(rodar(req(metodo, { 'content-length': '5', 'content-type': 'text/plain' })).status === 415,
    `${metodo} com corpo mal tipado é recusado`)
}
ok(rodar(req('GET')).status === 'next', 'GET nunca foi afetado')
ok(rodar(req('DELETE')).status === 'next', 'DELETE idem')

secao('5 · A rota continua POST e continua protegida')
const rotas = readFileSync(path.resolve(RAIZ, 'backend/src/routes/projetosFV.js'), 'utf8')
ok(/router\.post\('\/:id\/unifilar\/gerar'/.test(rotas),
  'a URL pública não mudou e o verbo continua POST')
const controller = readFileSync(
  path.resolve(RAIZ, 'backend/src/controllers/projetosFVController.js'), 'utf8')
const corpoGerar = controller.slice(controller.indexOf('export const gerarUnifilarProjeto'),
  controller.indexOf('export const gerarUnifilarProjeto') + 2500)
ok(/aplicarEscopo\(/.test(corpoGerar), 'o escopo de tenant continua aplicado')
ok(/isValid\(id\)/.test(corpoGerar), 'e o id continua validado')

secao('6 · Os clientes deixaram de mandar corpo de mentira')
for (const rel of ['frontend/src/components/fv/UnifilarFV.jsx',
  'frontend/src/fv/api/agregadosFvApi.js']) {
  const src = readFileSync(path.resolve(RAIZ, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  // A chamada e o seu `body` ficam no mesmo statement: recorta do início da
  // linha que menciona a rota até o fechamento dela, sem invadir a função ao
  // lado — foi o que produziu um falso positivo na primeira versão.
  const linhas = src.split('\n')
  const i = linhas.findIndex((l) => l.includes('unifilar/gerar'))
  const trecho = linhas.slice(i, i + 4).join('\n')
  ok(!/body:\s*'\{\}'|body:\s*json\(\{\}\)/.test(trecho),
    `${path.basename(rel)}: sem \`{}\` artificial`)
}

console.log(falhas === 0
  ? '\nOK — POST sem corpo é aceito, e corpo mal tipado continua recusado.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
