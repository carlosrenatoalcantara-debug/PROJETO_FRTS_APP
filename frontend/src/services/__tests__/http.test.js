/**
 * http.test.js — camada HTTP única
 *
 * Garante que o Authorization é injetado nas chamadas à API desta aplicação
 * e NUNCA em hosts de terceiros — inclusive os que também usam caminho /api/.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  apiFetch, apiJson, ErroHttp, obterToken, ehApiDaAplicacao, comCredencial,
  instalarInterceptorHttp, removerInterceptorHttp,
} from '../http.js'

const TOKEN = 'jwt-de-teste'

function authDe(init) {
  if (!init?.headers) return null
  const h = init.headers instanceof Headers ? init.headers : new Headers(init.headers)
  return h.get('Authorization')
}

let fetchSpy

beforeEach(() => {
  localStorage.clear()
  removerInterceptorHttp()
  fetchSpy = vi.fn(async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }))
  globalThis.fetch = fetchSpy
})

afterEach(() => {
  removerInterceptorHttp()
  localStorage.clear()
})

// ─── Token ───────────────────────────────────────────────────────────────────

describe('obterToken', () => {
  it('lê accessToken (mecanismo oficial)', () => {
    localStorage.setItem('accessToken', TOKEN)
    expect(obterToken()).toBe(TOKEN)
  })

  it('cai para a chave legada "token"', () => {
    localStorage.setItem('token', 'legado')
    expect(obterToken()).toBe('legado')
  })

  it('prefere accessToken quando ambos existem', () => {
    localStorage.setItem('token', 'legado')
    localStorage.setItem('accessToken', TOKEN)
    expect(obterToken()).toBe(TOKEN)
  })

  it('devolve null sem token', () => {
    expect(obterToken()).toBeNull()
  })
})

// ─── Regra de origem ─────────────────────────────────────────────────────────

describe('ehApiDaAplicacao', () => {
  it('aceita caminho relativo /api/', () => {
    expect(ehApiDaAplicacao('/api/admin/catalogo/qualidade-relatorio')).toBe(true)
  })

  it('aceita URL absoluta da própria origem', () => {
    expect(ehApiDaAplicacao(`${window.location.origin}/api/ativos/projeto/1`)).toBe(true)
  })

  it('REJEITA host externo que também usa /api/ (NASA POWER)', () => {
    expect(ehApiDaAplicacao('https://power.larc.nasa.gov/api/temporal/daily/point')).toBe(false)
  })

  it('rejeita demais hosts de terceiros', () => {
    for (const u of [
      'https://api.anthropic.com/v1/messages',
      'https://api.openai.com/v1/chat/completions',
      'https://generativelanguage.googleapis.com/v1beta/models',
      'https://nominatim.openstreetmap.org/search',
    ]) {
      expect(ehApiDaAplicacao(u)).toBe(false)
    }
  })

  it('rejeita caminho da própria origem fora de /api/', () => {
    expect(ehApiDaAplicacao('/assets/logo.png')).toBe(false)
  })
})

// ─── Injeção ─────────────────────────────────────────────────────────────────

describe('injeção de Authorization', () => {
  it('injeta nas chamadas à API quando há token', async () => {
    localStorage.setItem('accessToken', TOKEN)
    await apiFetch('/api/admin/catalogo/qualidade-relatorio')
    expect(authDe(fetchSpy.mock.calls[0][1])).toBe(`Bearer ${TOKEN}`)
  })

  it('NÃO injeta em host de terceiro com caminho /api/', async () => {
    localStorage.setItem('accessToken', TOKEN)
    await apiFetch('https://power.larc.nasa.gov/api/temporal/daily/point')
    expect(authDe(fetchSpy.mock.calls[0][1])).toBeNull()
  })

  it('não injeta quando não há token (chamada segue igual)', async () => {
    await apiFetch('/api/ativos/projeto/1')
    expect(authDe(fetchSpy.mock.calls[0][1])).toBeNull()
  })

  it('não injeta em caminho público de login', async () => {
    localStorage.setItem('accessToken', TOKEN)
    await apiFetch('/api/auth/login', { method: 'POST' })
    expect(authDe(fetchSpy.mock.calls[0][1])).toBeNull()
  })

  it('preserva Authorization já definido pelo chamador', async () => {
    localStorage.setItem('accessToken', TOKEN)
    await apiFetch('/api/integrations/keys', { headers: { Authorization: 'Bearer proprio' } })
    expect(authDe(fetchSpy.mock.calls[0][1])).toBe('Bearer proprio')
  })

  it('preserva method, body e demais headers', async () => {
    localStorage.setItem('accessToken', TOKEN)
    await apiFetch('/api/admin/catalogo/bulk/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [1] }),
    })
    const init = fetchSpy.mock.calls[0][1]
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"ids":[1]}')
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json')
    expect(authDe(init)).toBe(`Bearer ${TOKEN}`)
  })

  it('comCredencial devolve o init original quando não se aplica', () => {
    const init = { method: 'GET' }
    expect(comCredencial('https://api.openai.com/v1/x', init)).toBe(init)
  })
})

// ─── Interceptor global ──────────────────────────────────────────────────────

describe('instalarInterceptorHttp', () => {
  it('faz um fetch existente (não migrado) enviar Authorization', async () => {
    localStorage.setItem('accessToken', TOKEN)
    instalarInterceptorHttp()

    // Chamada no formato usado hoje pelas páginas — sem headers.
    await fetch('/api/admin/catalogo/qualidade-relatorio')

    expect(authDe(fetchSpy.mock.calls[0][1])).toBe(`Bearer ${TOKEN}`)
  })

  it('não afeta host de terceiro', async () => {
    localStorage.setItem('accessToken', TOKEN)
    instalarInterceptorHttp()
    await fetch('https://power.larc.nasa.gov/api/temporal/daily/point')
    expect(authDe(fetchSpy.mock.calls[0][1])).toBeNull()
  })

  it('é idempotente (não reempacota)', () => {
    expect(instalarInterceptorHttp()).toBe(true)
    expect(instalarInterceptorHttp()).toBe(false)
  })

  it('apiFetch não injeta duas vezes com o interceptor ativo', async () => {
    localStorage.setItem('accessToken', TOKEN)
    instalarInterceptorHttp()
    await apiFetch('/api/ativos/projeto/1')
    const h = new Headers(fetchSpy.mock.calls[0][1].headers)
    expect(h.get('Authorization')).toBe(`Bearer ${TOKEN}`)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('remover restaura o fetch original', async () => {
    instalarInterceptorHttp()
    removerInterceptorHttp()
    expect(globalThis.fetch).toBe(fetchSpy)
  })

  it('marca o fetch instalado', () => {
    instalarInterceptorHttp()
    expect(globalThis.fetch.__forteSolarInterceptor).toBe(true)
  })

  it('bloqueia reinstalação após reavaliação do módulo (estado de módulo perdido)', async () => {
    instalarInterceptorHttp()
    const wrapper = globalThis.fetch

    // Reavaliação do módulo: `fetchOriginal` volta a null, mas o fetch global
    // continua sendo o interceptor já instalado.
    vi.resetModules()
    const recarregado = await import('../http.js')

    expect(recarregado.instalarInterceptorHttp()).toBe(false)
    expect(globalThis.fetch).toBe(wrapper)      // não reempacotou
  })

  it('após reavaliação, uma chamada continua com injeção única', async () => {
    localStorage.setItem('accessToken', TOKEN)
    instalarInterceptorHttp()

    vi.resetModules()
    const recarregado = await import('../http.js')
    recarregado.instalarInterceptorHttp()

    await fetch('/api/ativos/projeto/1')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(authDe(fetchSpy.mock.calls[0][1])).toBe(`Bearer ${TOKEN}`)
  })

  it('remover e reinstalar volta a funcionar (marcador não persiste no nativo)', () => {
    expect(instalarInterceptorHttp()).toBe(true)
    removerInterceptorHttp()
    expect(globalThis.fetch).toBe(fetchSpy)
    expect(globalThis.fetch.__forteSolarInterceptor).toBeUndefined()
    expect(instalarInterceptorHttp()).toBe(true)
  })
})

// ─── Erro uniforme ───────────────────────────────────────────────────────────

describe('apiJson', () => {
  it('devolve o corpo em caso de sucesso', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ sucesso: true, total: 3 }), {
      status: 200, headers: { 'content-type': 'application/json' },
    }))
    await expect(apiJson('/api/x')).resolves.toEqual({ sucesso: true, total: 3 })
  })

  it('lança ErroHttp com status e código em 401', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ erro: 'Autenticação obrigatória.', codigo: 'NAO_AUTENTICADO' }), {
      status: 401, headers: { 'content-type': 'application/json' },
    }))
    await expect(apiJson('/api/x')).rejects.toMatchObject({
      name: 'ErroHttp', status: 401, codigo: 'NAO_AUTENTICADO',
    })
  })

  it('lança ErroHttp com TENANT_AUSENTE em 403', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ erro: 'Token sem organização', codigo: 'TENANT_AUSENTE' }), {
      status: 403, headers: { 'content-type': 'application/json' },
    }))
    const erro = await apiJson('/api/x').catch((e) => e)
    expect(erro).toBeInstanceOf(ErroHttp)
    expect(erro.codigo).toBe('TENANT_AUSENTE')
  })
})

// ─── Renovação da sessão (defeito de 2026-11-25) ─────────────────────────────

describe('renovação', () => {
  const resposta = (status, corpo = {}) => new Response(JSON.stringify(corpo), {
    status, headers: { 'content-type': 'application/json' },
  })
  /** API que só aceita o token "novo" e renova com refresh válido. */
  const servidor = () => vi.fn(async (input, init) => {
    if (String(input).includes('/api/auth/refresh')) return resposta(200, { accessToken: 'novo' })
    return resposta(authDe(init) === 'Bearer novo' ? 200 : 401)
  })
  const refreshes = (f) => f.mock.calls.filter(([u]) => String(u).includes('/refresh')).length

  it('a repetição leva o token NOVO mesmo quando o chamador mandou o vencido', async () => {
    localStorage.setItem('accessToken', 'vencido')
    localStorage.setItem('refreshToken', 'r')
    globalThis.fetch = servidor()
    const res = await apiFetch('/api/auth/verify', { headers: { Authorization: 'Bearer vencido', 'X-A': '1' } })
    expect(res.status).toBe(200)
    expect(localStorage.getItem('accessToken')).toBe('novo')
  })

  it('sem access token mas com refresh token, renova em vez de ficar em 401', async () => {
    localStorage.setItem('refreshToken', 'r')
    const f = servidor()
    globalThis.fetch = f
    expect((await apiFetch('/api/equipamentos')).status).toBe(200)
    expect(refreshes(f)).toBe(1)
  })

  it('anônimo não tenta renovar', async () => {
    const f = servidor()
    globalThis.fetch = f
    expect((await apiFetch('/api/equipamentos')).status).toBe(401)
    expect(refreshes(f)).toBe(0)
  })
})
