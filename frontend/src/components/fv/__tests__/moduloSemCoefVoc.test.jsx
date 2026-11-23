import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

/**
 * Item 2 — módulo do catálogo sem coeficiente de temperatura do Voc.
 * Antes: a tela quebrava (`vocStr.toFixed` em null). Agora bloqueia com o nome
 * do dado e o link para editar o módulo; nenhum coeficiente é presumido.
 * Dados fictícios.
 */
vi.mock('../../../hooks/useCompatibilidadeEletrica', () => ({
  useCompatibilidadeEletrica: () => ({ resultado: { compativel: true, erros: [], warnings: [], limites: {}, calculos: null, clima_utilizado: null }, carregando: false, erro: null }),
}))

import ConfiguradorArranjoFV from '../ConfiguradorArranjoFV'
import { vocFrio } from '../TopologiaMPPTEditor'

const painel = (extra = {}) => ({ id: 'mod-sem-coef', _fonte: 'catalogo', marca: 'Teste', modelo: 'M-620', potenciaW: 620, voc: 55, vmpp: 46, isc: 14, impp: 13.5, temp_noct: 45, ...extra })
const INVERSOR = {
  id: 'inv-teste', _fonte: 'catalogo', marca: 'Teste', modelo: 'S-10K', potenciaKW: 10, nMppts: 2, fases: 1,
  _eletrico: { tensao_max_entrada: 1100, mppt_min: 140, mppt_max: 1000, corrente_max_mppt: 32, entradas_por_mppt: 2 },
}

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
})
const montar = (p) => render(
  <ConfiguradorArranjoFV painel={p} inversor={INVERSOR} numPaineis={16} uf="RN" projetoId="p1" dispatch={vi.fn()} tipoLigacao="monofasico" onSaveAndNext={() => {}} />,
)

describe('módulo sem coef_temp_voc', () => {
  it('não quebra a tela; bloqueia com o dado que falta e link do catálogo', () => {
    montar(painel({ coef_temp_voc: null }))
    const caixa = screen.getByTestId('modulo-cadastro-incompleto')
    expect(caixa.textContent).toMatch(/Cadastro incompleto: falta coeficiente de temperatura do Voc/)
    expect(caixa.querySelector('a').getAttribute('href')).toBe('/equipamentos/modulos?editar=mod-sem-coef')
    expect(screen.getByText(/Salvar e avançar/).closest('button').disabled).toBe(true)
    expect(screen.getByText(/Salvar configuração/).closest('button').disabled).toBe(true)
  })

  it('não exibe Voc STC rotulado como Voc frio', () => {
    montar(painel({ coef_temp_voc: null }))
    // 8 × 55 V = 440 V seria o STC; não pode aparecer como Voc da string.
    expect(document.body.textContent).not.toMatch(/Voc:440V/)
    expect(document.body.textContent).toMatch(/Voc:—V/)
  })

  it('com coeficiente: sem caixa de cadastro incompleto', () => {
    montar(painel({ coef_temp_voc: -0.25 }))
    expect(screen.queryByTestId('modulo-cadastro-incompleto')).toBeNull()
  })
})

describe('vocFrio do editor de topologia — primitivas canônicas', () => {
  it('sem coeficiente ⇒ null (antes: Voc STC como se fosse o frio)', () => {
    expect(vocFrio(55, null, 10)).toBeNull()
    expect(vocFrio(55, undefined, 10)).toBeNull()
  })
  it('%/°C e fração dão o mesmo resultado (antes: −0,25 lido como fração ⇒ ~4×)', () => {
    const pct = vocFrio(55, -0.25, 10)
    expect(pct).toBeCloseTo(55 * (1 + 0.0025 * 15), 6)
    expect(vocFrio(55, -0.0025, 10)).toBeCloseTo(pct, 6)
  })
})
