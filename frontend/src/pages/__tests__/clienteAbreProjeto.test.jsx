import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// P0-PROJETO-OPEN-BUG-01 — regressão: clicar num projeto na ficha do cliente
// deve navegar para a tela de detalhes. A causa-raiz do bug era a linha <tr>
// estilizada como clicável (cursor-pointer) SEM onClick → clique não navegava.
// Vale igualmente para projetos nativos e importados (mesmo _id ObjectId).
//
// FV-UX-014: o DESTINO dos projetos FV mudou de `/projetos-fv/:id` (wizard) para
// `/fv/projetos/:id` (UX canônica). A intenção protegida por este teste continua
// a mesma — clicar precisa navegar; só o destino acompanhou a migração.
// Projetos EV não mudaram.

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig()),
  useNavigate: () => navigateMock,
  useParams: () => ({ clienteId: 'cli-1' }),
}))

import ClienteGerenciamento from '../ClienteGerenciamento'

const fvNativo = { _id: 'fv-native-1', nome: 'Projeto Nativo FV', createdAt: '2025-01-01', status: 'rascunho' }
const fvImportado = {
  _id: 'fv-import-1', nome: 'Projeto Importado FV', createdAt: '2024-08-14', status: 'shell_importado',
  origem: { tipo: 'import_solarmarket', id_externo: '100' },
}
const evProj = { _id: 'ev-1', nome: 'Projeto EV', createdAt: '2025-02-01', status: 'rascunho' }

beforeEach(() => {
  navigateMock.mockClear()
  global.fetch = vi.fn((url) => {
    let data
    if (url.includes('/api/clientes/')) data = { _id: 'cli-1', nome: 'Cliente Teste', email: 'x@y.com' }
    else if (url.includes('/api/projetos-fv/cliente/')) data = [fvNativo, fvImportado]
    else if (url.includes('/api/projetos-ev/cliente/')) data = [evProj]
    else data = {}
    return Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
  })
})

async function rowOf(nome) {
  const cell = await screen.findByText(nome)
  return cell.closest('tr')
}

describe('P0-PROJETO-OPEN-BUG-01 — ficha do cliente abre projetos', () => {
  it('abre projeto FV NATIVO ao clicar na linha', async () => {
    render(<ClienteGerenciamento />)
    fireEvent.click(await rowOf('Projeto Nativo FV'))
    expect(navigateMock).toHaveBeenCalledWith('/fv/projetos/fv-native-1')
  })

  it('abre projeto FV IMPORTADO (SolarMarket) ao clicar na linha', async () => {
    render(<ClienteGerenciamento />)
    fireEvent.click(await rowOf('Projeto Importado FV'))
    expect(navigateMock).toHaveBeenCalledWith('/fv/projetos/fv-import-1')
  })

  it('abre projeto EV ao clicar na linha', async () => {
    render(<ClienteGerenciamento />)
    fireEvent.click(await rowOf('Projeto EV'))
    expect(navigateMock).toHaveBeenCalledWith('/projetos-ev/ev-1')
  })

  it('navega usando o _id real (rota compatível com /fv/projetos/:id)', async () => {
    render(<ClienteGerenciamento />)
    fireEvent.click(await rowOf('Projeto Importado FV'))
    const destino = navigateMock.mock.calls[0][0]
    expect(destino).toMatch(/^\/fv\/projetos\/[\w-]+$/)
    expect(destino).toContain(fvImportado._id)
  })

  it('abre o projeto pelo teclado (Enter) — acessibilidade', async () => {
    render(<ClienteGerenciamento />)
    fireEvent.keyDown(await rowOf('Projeto Nativo FV'), { key: 'Enter' })
    expect(navigateMock).toHaveBeenCalledWith('/fv/projetos/fv-native-1')
  })
})
