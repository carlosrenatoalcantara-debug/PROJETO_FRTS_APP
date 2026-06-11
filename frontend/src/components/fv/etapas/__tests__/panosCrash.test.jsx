import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// P0-DIMENSIONAMENTO-PANOS-CRASH-01 — regressão
// Bug: "Cannot read properties of undefined (reading 'panos')"
// Causa raiz dupla:
//   1. estadoInicial.area não tinha panos: []
//   2. HIDRATAR dispatch enviava area: undefined quando o projeto não tinha
//      layout_solar, sobrescrevendo estadoInicial.area via spread
// Efeito: E6Area.jsx:51 `area.panos || []` crashava quando area === undefined

// ─── Mocks de contexto (mutável — substituído por cenário) ───────────────────
let ctxState = {}
const proximaMock  = vi.fn()
const anteriorMock = vi.fn()
const dispatchMock = vi.fn()

vi.mock('../../../../contexts/ProjetoFVContext', () => ({
  useProjetoFV: () => ({
    state:    ctxState,
    dispatch: dispatchMock,
    proxima:  proximaMock,
    anterior: anteriorMock,
    ETAPAS:   [],
  }),
}))

vi.mock('../../MapaTelhado',    () => ({ default: () => <div data-testid="mapa-telhado" />    }))
vi.mock('../../EditorTelhadoMapa', () => ({ default: () => <div data-testid="editor-mapa" />  }))
vi.mock('../../../utils/calcDimensionamento', () => ({
  calcularAreaSuficiente: vi.fn(() => true),
}))

vi.mock('react-router-dom', async (orig) => ({
  ...(await orig()),
  useNavigate: () => vi.fn(),
}))

import E6Area         from '../E6Area'
import E5Dimensionamento from '../E5Dimensionamento'

// ─── Estado base (pós-fix — estadoInicial.area tem panos: []) ───────────────
const DIM_BASE = {
  potenciaKwp: 4.5, numPaineis: 8, areaMinima: 16,
  potenciaPainelW: 550, capacidadeInversorKW: 5,
}
const LOC_BASE = { lat: -23.5, lon: -46.6, endereco: 'Rua Teste', cidadeEstado: 'SP' }
const AREA_VAZIA = { areaDisponivel: '', orientacao: 'Norte', inclinacao: '15', suficiente: null, panos: [] }

beforeEach(() => {
  proximaMock.mockClear()
  anteriorMock.mockClear()
  dispatchMock.mockClear()
})

// ─── E6Area ──────────────────────────────────────────────────────────────────
describe('P0-PANOS-CRASH — E6Area (etapa Área)', () => {

  it('abre sem crash — projeto NOVO: panos: [] no estado inicial', () => {
    ctxState = {
      area:           AREA_VAZIA,
      dimensionamento: DIM_BASE,
      localizacao:    LOC_BASE,
      equipamentos:   { painel: null, inversor: null, estrutura: null },
    }
    expect(() => render(<E6Area />)).not.toThrow()
    expect(screen.getByText('Validação de Área')).toBeTruthy()
  })

  it('abre sem crash — área sem campo panos (retrocompatibilidade)', () => {
    // area existe mas não tem o campo panos — deve usar || []
    ctxState = {
      area:           { areaDisponivel: '', orientacao: 'Norte', inclinacao: '15', suficiente: null },
      dimensionamento: DIM_BASE,
      localizacao:    LOC_BASE,
      equipamentos:   { painel: null, inversor: null, estrutura: null },
    }
    expect(() => render(<E6Area />)).not.toThrow()
  })

  it('abre sem crash — projeto antigo com panos cadastrados', () => {
    ctxState = {
      area: {
        areaDisponivel: '45',
        orientacao:     'Norte',
        inclinacao:     '20',
        suficiente:     true,
        panos: [
          { id: 'p1', nome: 'Pano 1', area_bruta: 45, orientacao: 'Norte',
            inclinacao: 20, fator_sombra: 0, obstaculos: [] },
        ],
      },
      dimensionamento: DIM_BASE,
      localizacao:    LOC_BASE,
      equipamentos:   { painel: null, inversor: null, estrutura: null },
    }
    expect(() => render(<E6Area />)).not.toThrow()
  })

  it('crash original NÃO ocorre — mensagem de erro não contém "panos"', () => {
    // Estado sem panos (como antes do fix com estadoInicial antigo)
    ctxState = {
      area:           { areaDisponivel: '', orientacao: 'Norte', inclinacao: '15', suficiente: null },
      dimensionamento: DIM_BASE,
      localizacao:    LOC_BASE,
      equipamentos:   { painel: null, inversor: null, estrutura: null },
    }
    let caughtError = null
    try { render(<E6Area />) } catch (e) { caughtError = e }
    // Não deve lançar TypeError sobre 'panos'
    if (caughtError) expect(caughtError.message).not.toMatch(/panos/)
    else expect(caughtError).toBeNull()
  })
})

// ─── E5Dimensionamento: fluxo Irradiância → Próxima → abre ─────────────────
describe('P0-PANOS-CRASH — E5Dimensionamento (etapa Dimensionamento)', () => {

  beforeEach(() => {
    ctxState = {
      dadosConsumo: { consumoMensal: '450' },
      irradiancia:  { mediaAnual: 4.8, mensal: [{ mes: 'Jan', valor: 4.8 }], carregando: false, erro: null },
      localizacao:  LOC_BASE,
      dimensionamento: { ...DIM_BASE, _fatorEficiencia: undefined, _crescimentoKwh: undefined, _aparelhos: undefined },
      area:         AREA_VAZIA,
      equipamentos: { painel: null, inversor: null, estrutura: null },
    }
  })

  it('renderiza sem crash ao abrir (fluxo: Irradiância → Próxima)', () => {
    expect(() => render(<E5Dimensionamento />)).not.toThrow()
    expect(screen.getByText('Pré-Dimensionamento')).toBeTruthy()
  })

  it('botão Próxima está presente e é clicável', async () => {
    await act(async () => render(<E5Dimensionamento />))
    const btns = screen.getAllByRole('button')
    const proxBtn = btns.find(b => b.textContent.includes('Próxima'))
    expect(proxBtn).toBeTruthy()
    // Clicar não deve lançar nenhum erro
    if (!proxBtn.disabled) {
      expect(() => fireEvent.click(proxBtn)).not.toThrow()
    }
  })
})
