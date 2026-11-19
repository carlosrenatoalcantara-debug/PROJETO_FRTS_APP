import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { useEdicaoPorLink } from '../hooks/useEdicaoPorLink'
import { linkEdicaoCatalogo } from '../utils/linkEdicaoCatalogo'

let loc
function Sonda({ itens, carregando = false, abrir }) {
  useEdicaoPorLink({ itens, carregando, abrir })
  loc = useLocation()
  return null
}
const montar = (url, props) => render(<MemoryRouter initialEntries={[url]}><Sonda {...props} /></MemoryRouter>)

beforeEach(() => { global.fetch = vi.fn() })

describe('linkEdicaoCatalogo', () => {
  it('módulo vai para Módulos; inversor e micro para Inversores', () => {
    expect(linkEdicaoCatalogo({ tipo: 'modulo', id: 'a1' })).toBe('/equipamentos/modulos?editar=a1')
    expect(linkEdicaoCatalogo({ tipo: 'inversor', id: 'b2' })).toBe('/equipamentos/inversores?editar=b2')
    expect(linkEdicaoCatalogo({ tipo: 'microinversor', id: 'c3' })).toBe('/equipamentos/inversores?editar=c3')
  })
  it('sem id ou tipo desconhecido não gera link', () => {
    expect(linkEdicaoCatalogo({ tipo: 'modulo' })).toBeNull()
    expect(linkEdicaoCatalogo({ tipo: 'bateria', id: 'x' })).toBeNull()
  })
})

describe('useEdicaoPorLink', () => {
  it('abre o item da lista e limpa o parâmetro', async () => {
    const abrir = vi.fn()
    montar('/equipamentos/inversores?editar=i2', { itens: [{ _id: 'i1' }, { _id: 'i2', modelo: 'X' }], abrir })
    await waitFor(() => expect(abrir).toHaveBeenCalledWith({ _id: 'i2', modelo: 'X' }))
    expect(loc.search).toBe('')
    expect(global.fetch).not.toHaveBeenCalled()
  })
  it('espera a lista carregar', () => {
    const abrir = vi.fn()
    montar('/x?editar=i2', { itens: [], carregando: true, abrir })
    expect(abrir).not.toHaveBeenCalled()
  })
  it('fora da lista: busca pelo id', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ _id: 'z9' }) })
    const abrir = vi.fn()
    montar('/x?editar=z9', { itens: [{ _id: 'i1' }], abrir })
    await waitFor(() => expect(abrir).toHaveBeenCalledWith({ _id: 'z9' }))
    expect(global.fetch).toHaveBeenCalledWith('/api/equipamentos/z9')
  })
  it('sem parâmetro não faz nada', () => {
    const abrir = vi.fn()
    montar('/x', { itens: [{ _id: 'i1' }], abrir })
    expect(abrir).not.toHaveBeenCalled()
  })
})
