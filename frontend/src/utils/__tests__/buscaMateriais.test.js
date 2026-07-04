import { describe, it, expect } from 'vitest'
import { filtrarMateriais, expandirTermo, normalizar } from '../buscaMateriais'

const cat = [
  { descricao: 'Cabo 6 mm²', categoria: 'cabos' },
  { descricao: 'Cabo 10 mm²', categoria: 'cabos' },
  { descricao: 'Cabo 16 mm²', categoria: 'cabos' },
  { descricao: 'Cabo PP 3x2,5', categoria: 'cabos' },
  { descricao: 'Eletroduto 25 mm', categoria: 'conexoes_infraestrutura', especificacoes: [{ chave: 'bitola', valor: '25mm' }] },
  { descricao: 'Eletroduto 32 mm', categoria: 'conexoes_infraestrutura' },
  { descricao: 'Disjuntor 40A', categoria: 'protecao_eletrica', sinonimos: ['breaker'] },
]

describe('FEATURE-002 ITEM 4 — busca inteligente de materiais', () => {
  it('busca por nome parcial (cabo)', () => {
    const r = filtrarMateriais(cat, 'cabo').map((m) => m.descricao)
    expect(r).toContain('Cabo 6 mm²')
    expect(r).toContain('Cabo 16 mm²')
    expect(r).not.toContain('Disjuntor 40A')
  })

  it('busca por categoria e por sinônimo', () => {
    expect(filtrarMateriais(cat, 'protecao').map((m) => m.descricao)).toContain('Disjuntor 40A')
    expect(filtrarMateriais(cat, 'breaker').map((m) => m.descricao)).toContain('Disjuntor 40A')
  })

  it('polegada → mm: "3/4" encontra "25 mm"', () => {
    expect(expandirTermo('3/4')).toContain('25')
    const r = filtrarMateriais(cat, 'eletroduto 3/4').map((m) => m.descricao)
    expect(r).toContain('Eletroduto 25 mm')
  })

  it('mm → polegada: "25mm" expande para "3/4"', () => {
    expect(expandirTermo('25mm')).toContain('3/4')
  })

  it('ignora acentos e caixa', () => {
    expect(normalizar('Eletroduto 3/4"')).toBe('eletroduto 3/4')
    expect(filtrarMateriais(cat, 'ELETRODUTO').length).toBe(2)
  })

  it('query vazia retorna a lista (limitada)', () => {
    expect(filtrarMateriais(cat, '').length).toBe(cat.length)
  })
})
