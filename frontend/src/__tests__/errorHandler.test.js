/**
 * errorHandler — contrato da resposta de erro.
 *
 * O defeito que estes testes prendem: o handler emitia só `mensagem`, e as
 * telas que leem `erro`/`error` — o login entre elas — mostravam texto genérico
 * para qualquer falha. A regra é: 4xx diz o que houve, 5xx não vaza interno,
 * e os dois carregam `ref` para ligar a tela ao log.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import errorHandler from '../../../backend/src/middleware/errorHandler.js'

const req = { method: 'POST', originalUrl: '/api/auth/login' }

function resposta() {
  const r = { status_: null, corpo: null }
  r.status = (s) => { r.status_ = s; return r }
  r.json = (c) => { r.corpo = c; return r }
  return r
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('errorHandler · 4xx', () => {
  it('1 · devolve a mensagem nos três campos que a aplicação lê', () => {
    const err = Object.assign(new Error('E-mail ou senha inválidos'), { status: 401 })
    const res = resposta()
    errorHandler(err, req, res)

    expect(res.status_).toBe(401)
    expect(res.corpo.erro).toBe('E-mail ou senha inválidos')
    expect(res.corpo.mensagem).toBe('E-mail ou senha inválidos')
  })

  it('2 · preserva o código quando o erro traz um', () => {
    const err = Object.assign(new Error('Tenant ausente'), { status: 403, codigo: 'TENANT_AUSENTE' })
    const res = resposta()
    errorHandler(err, req, res)
    expect(res.corpo.codigo).toBe('TENANT_AUSENTE')
  })

  it('3 · erro 4xx sem mensagem não vira string vazia', () => {
    const err = Object.assign(new Error(''), { status: 400 })
    const res = resposta()
    errorHandler(err, req, res)
    expect(res.corpo.erro).toBe('Requisição inválida.')
  })
})

describe('errorHandler · 5xx', () => {
  it('4 · NÃO vaza a mensagem interna', () => {
    const err = new Error('MongoServerError: E11000 duplicate key em forte_solar.usuarios')
    const res = resposta()
    errorHandler(err, req, res)

    expect(res.status_).toBe(500)
    expect(res.corpo.erro).toBe('Erro interno do servidor.')
    expect(JSON.stringify(res.corpo)).not.toContain('forte_solar')
    expect(JSON.stringify(res.corpo)).not.toContain('E11000')
  })

  it('5 · marca o código como ERRO_INTERNO quando o erro não traz um', () => {
    const res = resposta()
    errorHandler(new Error('falhou'), req, res)
    expect(res.corpo.codigo).toBe('ERRO_INTERNO')
  })

  it('6 · o ref vai na resposta e no log, para ligar tela e servidor', () => {
    const res = resposta()
    errorHandler(new Error('falhou'), req, res)

    expect(res.corpo.ref).toMatch(/^[0-9a-f]{8}$/)
    const logado = console.error.mock.calls.map((c) => String(c[0])).join('\n')
    expect(logado).toContain(res.corpo.ref)
  })

  it('7 · cada erro recebe um ref próprio', () => {
    const a = resposta(); errorHandler(new Error('x'), req, a)
    const b = resposta(); errorHandler(new Error('x'), req, b)
    expect(a.corpo.ref).not.toBe(b.corpo.ref)
  })
})
