import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * Eficiência padrão configurável (docs/DECISAO_FLUXO_FV_2026-11.md, passo 3).
 * Operador: "80% (138 kWh/kWp) é muito otimista — quero poder pré-salvar 75%".
 *
 *  - configurar 75% → projeto NOVO nasce em 75% (geração 5,77 × 30 × 0,75);
 *  - projeto já salvo mantém o valor dele;
 *  - sem configuração: 80%, dito como "padrão do sistema".
 * Dados fictícios.
 */
let ctxState
const dispatchMock = vi.fn()
vi.mock('../../../../contexts/ProjetoFVContext', () => ({
  useProjetoFV: () => ({ state: ctxState, dispatch: dispatchMock, proxima: vi.fn(), anterior: vi.fn(), ETAPAS: [] }),
}))
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => vi.fn() }))

const eficienciaPadraoConfigurada = vi.fn()
vi.mock('../../../../services/fvPadroesApi', () => ({
  eficienciaPadraoConfigurada: (...a) => eficienciaPadraoConfigurada(...a),
}))

import E5Dimensionamento from '../E5Dimensionamento'

const base = (dim = {}) => ({
  dadosConsumo: { consumoMensal: '400' },
  irradiancia: { mediaAnual: 5.77 },
  localizacao: { cidadeEstado: 'Natal, RN' },
  dimensionamento: { potenciaPainelW: 550, ...dim },
})
const slider = () => document.querySelector('input[type="range"]')

beforeEach(() => {
  dispatchMock.mockClear()
  eficienciaPadraoConfigurada.mockReset()
})

describe('E5 — eficiência inicial', () => {
  it('padrão configurado em 75%: projeto novo nasce em 75% e diz a origem', async () => {
    eficienciaPadraoConfigurada.mockResolvedValue(0.75)
    ctxState = base()
    render(<E5Dimensionamento />)
    await waitFor(() => expect(slider().value).toBe('75'))
    expect(screen.getByTestId('origem-eficiencia').textContent).toMatch(/padrão da empresa/)
    // 5,77 × 30 × 0,75 = 129,8 kWh/kWp·mês (era 138,5 com 80%)
    expect(screen.getAllByText(/129[.,]8/).length).toBeGreaterThan(0)
  })

  it('sem configuração: 80% e rotulado "padrão do sistema"', async () => {
    eficienciaPadraoConfigurada.mockResolvedValue(null)
    ctxState = base()
    render(<E5Dimensionamento />)
    await waitFor(() => expect(eficienciaPadraoConfigurada).toHaveBeenCalled())
    expect(slider().value).toBe('80')
    expect(screen.getByTestId('origem-eficiencia').textContent).toMatch(/padrão do sistema/)
  })

  it('falha ao ler a configuração cai no padrão do sistema, sem quebrar', async () => {
    eficienciaPadraoConfigurada.mockResolvedValue(null) // o serviço já absorve o erro de rede
    ctxState = base()
    expect(() => render(<E5Dimensionamento />)).not.toThrow()
    await waitFor(() => expect(slider().value).toBe('80'))
  })

  it('projeto JÁ SALVO mantém o valor dele e nem consulta o padrão', async () => {
    eficienciaPadraoConfigurada.mockResolvedValue(0.75)
    ctxState = base({ _fatorEficiencia: 0.9 })
    render(<E5Dimensionamento />)
    expect(slider().value).toBe('90')
    expect(eficienciaPadraoConfigurada).not.toHaveBeenCalled()
    expect(screen.queryByTestId('origem-eficiencia')).toBeNull()
  })

  it('o operador continua ajustando por projeto; o ajuste não é sobrescrito pelo padrão', async () => {
    let entrega
    eficienciaPadraoConfigurada.mockReturnValue(new Promise((r) => { entrega = r }))
    ctxState = base()
    render(<E5Dimensionamento />)
    fireEvent.change(slider(), { target: { value: '85' } })
    entrega(0.75) // a configuração chega DEPOIS de o operador mexer
    await Promise.resolve(); await Promise.resolve()
    expect(slider().value).toBe('85')
    expect(screen.queryByTestId('origem-eficiencia')).toBeNull()
  })

  it('o controle aceita a faixa configurável inteira (50–100)', async () => {
    eficienciaPadraoConfigurada.mockResolvedValue(0.55)
    ctxState = base()
    render(<E5Dimensionamento />)
    await waitFor(() => expect(slider().value).toBe('55'))
    expect(slider().min).toBe('50')
  })
})
