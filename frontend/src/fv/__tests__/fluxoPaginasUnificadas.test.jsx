/**
 * Páginas compostas (2026-11-22): Cadastro reúne Projeto + Dimensionamento +
 * Beneficiárias; Equipamentos reúne Estrutura + composição + Topologia.
 */
import { describe, it, expect } from 'vitest'
import {
  etapasRaizDoGrupo, subEtapasDe, secoesDe, paginaDaEtapa, etapaPorChave,
} from '../fluxo'

describe('fluxo · páginas compostas', () => {
  it('1 · "Projeto" virou "Cadastro" e é a única raiz do grupo origem', () => {
    expect(etapaPorChave('projeto').rotulo).toBe('Cadastro')
    expect(etapasRaizDoGrupo('origem').map((e) => e.chave)).toEqual(['projeto'])
    expect(secoesDe('projeto').map((e) => e.chave)).toEqual(['dimensionamento', 'beneficiarias'])
  })

  it('2 · comercial: Equipamentos e Cotações/Opções lado a lado; seções fora da nav', () => {
    const raiz = etapasRaizDoGrupo('comercial').map((e) => e.chave)
    expect(raiz.slice(0, 2)).toEqual(['equipamentos', 'cotacao'])
    expect(raiz).not.toContain('mppt')
    expect(raiz).not.toContain('estrutura')
    expect(subEtapasDe('equipamentos')).toEqual([])
    expect(secoesDe('equipamentos').map((e) => e.chave)).toEqual(['mppt', 'estrutura'])
  })

  it('3 · rota de seção aponta para a página do pai', () => {
    expect(paginaDaEtapa('dimensionamento')).toBe('projeto')
    expect(paginaDaEtapa('mppt')).toBe('equipamentos')
    expect(paginaDaEtapa('cotacao')).toBe('cotacao')
    expect(paginaDaEtapa('inexistente')).toBe(null)
  })
})
