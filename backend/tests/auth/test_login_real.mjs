/**
 * test_login_real.mjs — autenticação real em /api/auth/login
 *
 * Cobre a correção do handler que aceitava dois usuários fixos no código e
 * nunca consultava o MongoDB, emitindo sempre `empresa_id: null` — o que fazia
 * toda rota TENANT responder 403 TENANT_AUSENTE.
 *
 * Execução:
 *   node --experimental-test-module-mocks tests/auth/test_login_real.mjs
 *
 * Sem banco e sem rede: o model User e a conexão mongoose são substituídos por
 * dublês. Nenhuma credencial real aparece aqui — as senhas usadas são fixtures.
 */
import { test, describe, mock } from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET ??= 'segredo-de-teste-nao-usado-em-producao'
process.env.JWT_REFRESH_SECRET ??= 'segredo-refresh-de-teste'

const EMPRESA = '6a19926f1d6212f21bf7b5fe'
const SENHA_OK = 'SenhaDeFixture#2026'
const SENHA_CURTA = 'abc123'            // não cumpre a política de complexidade
const HASH_OK = bcrypt.hashSync(SENHA_OK, 4)
const HASH_CURTA = bcrypt.hashSync(SENHA_CURTA, 4)

/** Constrói um documento de usuário no formato que o handler consome. */
function usuario({ email, hash = HASH_OK, ativo = true, empresa_id = EMPRESA, perfil = 'administrador' }) {
  return {
    _id: { toString: () => '6a19a94d43d1555edfa8c3d1' },
    email, nome: 'Fixture', perfil, ativo, empresa_id,
    senha_hash: hash,
    compararSenha: async (s) => bcrypt.compare(s, hash),
    save: async () => {},
  }
}

let bancoDeUsuarios = []
let readyState = 1

mock.module('mongoose', {
  defaultExport: { connection: { get readyState() { return readyState } } },
})
mock.module(new URL('../../src/models/User.js', import.meta.url).href, {
  defaultExport: {
    findOne: async (filtro) => bancoDeUsuarios.find(u => u.email === filtro.email) || null,
  },
})
mock.module(new URL('../../src/services/mailService.js', import.meta.url).href, {
  namedExports: { hashToken: (t) => t },
})

const { default: router } = await import('../../src/routes/auth-security.js')

/** Invoca POST /login diretamente na camada do router, sem subir servidor. */
async function postLogin(body) {
  const camada = router.stack.find(l => l.route?.path === '/login' && l.route.methods.post)
  assert.ok(camada, 'rota POST /login não encontrada')
  // pula o rate limiter; o alvo do teste é o handler final
  const handler = camada.route.stack.at(-1).handle

  const req = { body, ip: '127.0.0.1', get: () => 'test-agent', headers: {} }
  let resposta = null
  const res = {
    status(c) { this._status = c; return this },
    json(payload) { resposta = { status: this._status ?? 200, body: payload }; return this },
  }
  await handler(req, res, (err) => { if (err) throw err })
  return resposta
}

describe('POST /api/auth/login — autenticação real', () => {
  test('1. usuário real + senha correta → 200 com par de tokens', async () => {
    bancoDeUsuarios = [usuario({ email: 'real@fixture.test' })]
    const r = await postLogin({ email: 'real@fixture.test', password: SENHA_OK })
    assert.equal(r.status, 200)
    assert.equal(r.body.success, true)
    assert.ok(r.body.accessToken, 'accessToken ausente')
    assert.ok(r.body.refreshToken, 'refreshToken ausente')
    assert.equal(r.body.user.email, 'real@fixture.test')
    assert.equal(r.body.user.role, 'administrador')
  })

  test('2. senha incorreta → 401 INVALID_CREDENTIALS', async () => {
    bancoDeUsuarios = [usuario({ email: 'real@fixture.test' })]
    const r = await postLogin({ email: 'real@fixture.test', password: 'OutraSenha#2026' })
    assert.equal(r.status, 401)
    assert.equal(r.body.code, 'INVALID_CREDENTIALS')
    assert.ok(!r.body.accessToken)
  })

  test('3. usuário inexistente → 401 com a MESMA resposta (sem enumeração)', async () => {
    bancoDeUsuarios = []
    const r = await postLogin({ email: 'naoexiste@fixture.test', password: SENHA_OK })
    assert.equal(r.status, 401)
    assert.equal(r.body.code, 'INVALID_CREDENTIALS')
    assert.equal(r.body.error, 'Credenciais inválidas')
  })

  test('4. usuário inativo → 401 mesmo com senha correta', async () => {
    bancoDeUsuarios = [usuario({ email: 'inativo@fixture.test', ativo: false })]
    const r = await postLogin({ email: 'inativo@fixture.test', password: SENHA_OK })
    assert.equal(r.status, 401)
    assert.equal(r.body.code, 'INVALID_CREDENTIALS')
  })

  test('5. JWT carrega empresa_id do usuário (não null)', async () => {
    bancoDeUsuarios = [usuario({ email: 'real@fixture.test' })]
    const r = await postLogin({ email: 'real@fixture.test', password: SENHA_OK })
    const claims = jwt.verify(r.body.accessToken, process.env.JWT_SECRET)
    assert.equal(claims.empresa_id, EMPRESA)
    assert.equal(claims.role, 'administrador')
    assert.ok(claims.sub, 'sub ausente — decodificarUsuario lê d.sub para req.auth.id')
    assert.equal(claims.email, 'real@fixture.test')
  })

  test('6. token resultante satisfaz exigirOrganizacao (sem TENANT_AUSENTE)', async () => {
    bancoDeUsuarios = [usuario({ email: 'real@fixture.test' })]
    const r = await postLogin({ email: 'real@fixture.test', password: SENHA_OK })
    const { decodificarUsuario, exigirOrganizacao } = await import('../../src/middleware/rbacMiddleware.js')

    const req = { headers: { authorization: `Bearer ${r.body.accessToken}` } }
    decodificarUsuario(req, {}, () => {})
    assert.equal(String(req.auth.empresa_id), EMPRESA)
    assert.equal(req.auth.perfil, 'administrador')

    let liberou = false, negou = null
    exigirOrganizacao(req, {
      status(c) { this._s = c; return this },
      json(b) { negou = { status: this._s, body: b } },
    }, () => { liberou = true })
    assert.equal(negou, null, `exigirOrganizacao negou: ${JSON.stringify(negou)}`)
    assert.equal(liberou, true)

    // e o escopo aplicado à query é o tenant do usuário
    const { aplicarEscopo } = await import('../../src/dominio/tenancy/index.js')
    assert.equal(String(aplicarEscopo({}, req).empresa_id), EMPRESA)
  })

  test('7. usuário sem empresa_id → recusado (403 TENANT_AUSENTE), sem token', async () => {
    bancoDeUsuarios = [usuario({ email: 'semorg@fixture.test', empresa_id: null })]
    const r = await postLogin({ email: 'semorg@fixture.test', password: SENHA_OK })
    assert.equal(r.status, 403)
    assert.equal(r.body.code, 'TENANT_AUSENTE')
    assert.ok(!r.body.accessToken, 'não deve emitir token sem organização')
  })

  test('8. credenciais demo antigas → recusadas', async () => {
    bancoDeUsuarios = []
    for (const [email, password] of [
      ['demo@fortesolar.com.br', 'DemoPass123!'],
      ['admin@fortesolar.com.br', 'AdminPass123!'],
    ]) {
      const r = await postLogin({ email, password })
      assert.equal(r.status, 401, `${email} ainda autentica`)
      assert.ok(!r.body.accessToken, `${email} ainda recebe token`)
    }
  })

  test('9. senha correta fora da política de complexidade → login permitido', async () => {
    // Regressão: validar força da senha no LOGIN rejeitava com 400 a senha
    // correta de usuários cadastrados antes da política, sem tocar o banco.
    bancoDeUsuarios = [usuario({ email: 'legado@fixture.test', hash: HASH_CURTA })]
    const r = await postLogin({ email: 'legado@fixture.test', password: SENHA_CURTA })
    assert.equal(r.status, 200)
    assert.ok(r.body.accessToken)
  })

  test('10. banco indisponível → 503, nunca autentica por fallback', async () => {
    readyState = 0
    bancoDeUsuarios = [usuario({ email: 'real@fixture.test' })]
    const r = await postLogin({ email: 'real@fixture.test', password: SENHA_OK })
    readyState = 1
    assert.equal(r.status, 503)
    assert.equal(r.body.code, 'DB_OFFLINE')
    assert.ok(!r.body.accessToken)
  })

  test('11. entrada inválida → 400 sem consultar o banco', async () => {
    bancoDeUsuarios = []
    const r = await postLogin({ email: 'nao-e-email', password: SENHA_OK })
    assert.equal(r.status, 400)
    assert.equal(r.body.code, 'INVALID_INPUT')
  })

  test('12. refresh preserva empresa_id do access token', async () => {
    bancoDeUsuarios = [usuario({ email: 'real@fixture.test' })]
    const login = await postLogin({ email: 'real@fixture.test', password: SENHA_OK })

    const camada = router.stack.find(l => l.route?.path === '/refresh' && l.route.methods.post)
    const handler = camada.route.stack.at(-1).handle
    let out = null
    await handler(
      { body: { refreshToken: login.body.refreshToken }, ip: '127.0.0.1', get: () => 'test' },
      { status(c) { this._s = c; return this }, json(b) { out = { status: this._s ?? 200, body: b } } },
    )
    assert.equal(out.status, 200)
    const claims = jwt.verify(out.body.accessToken, process.env.JWT_SECRET)
    assert.equal(claims.empresa_id, EMPRESA)
  })
})
