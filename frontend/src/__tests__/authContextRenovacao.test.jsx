import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../context/AuthContext'

function Sonda() {
  const { user, token, loading } = useAuth()
  return <p>{loading ? 'carregando' : `${user?.email ?? 'ninguem'}|${token ?? 'sem'}`}</p>
}
const r = (status, corpo = {}) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })
const api = ({ aceita = 'novo', recusa = 403 } = {}) => vi.fn(async (u, init) => {
  if (String(u).includes('/refresh')) return r(200, { accessToken: 'novo' })
  return new Headers(init?.headers).get('Authorization') === `Bearer ${aceita}` ? r(200, { user: { email: 'a@b' } }) : r(recusa)
})
const montar = () => render(<AuthProvider><Sonda /></AuthProvider>)

beforeEach(() => { localStorage.clear() })

describe('AuthContext — sessão com refresh token válido sobrevive ao recarregar', () => {
  for (const recusa of [401, 403]) {
    it(`access token vencido (${recusa}) é renovado, não descartado`, async () => {
      localStorage.setItem('accessToken', 'vencido'); localStorage.setItem('refreshToken', 'x')
      global.fetch = api({ recusa }); montar()
      await screen.findByText('a@b|novo')
      expect(localStorage.getItem('accessToken')).toBe('novo')
    })
  }
  it('access token já perdido é recuperado', async () => {
    localStorage.setItem('refreshToken', 'x'); global.fetch = api(); montar()
    await screen.findByText('a@b|novo')
  })
  it('conta bloqueada: até o token novo é recusado e a sessão termina, sem laço', async () => {
    localStorage.setItem('accessToken', 'vencido'); localStorage.setItem('refreshToken', 'x')
    global.fetch = api({ aceita: 'nenhum', recusa: 401 }); montar()
    await screen.findByText('ninguem|sem')
    await waitFor(() => expect(localStorage.getItem('refreshToken')).toBe(null))
    expect(global.fetch.mock.calls.length).toBeLessThan(6)
  })
})
