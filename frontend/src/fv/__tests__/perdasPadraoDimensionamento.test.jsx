import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * Canônico: o padrão de eficiência da empresa vira o valor INICIAL das perdas
 * (75% de eficiência → 25% de perdas). Sem configuração, o campo segue vazio —
 * o sistema não impõe um valor a quem não pediu. Dados fictícios.
 */
const eficienciaPadraoConfigurada = vi.fn()
vi.mock('../../services/fvPadroesApi', () => ({
  eficienciaPadraoConfigurada: (...a) => eficienciaPadraoConfigurada(...a),
}))
vi.mock('../api/agregadosFvApi', async (orig) => ({
  ...(await orig()),
  consultarIrradiancia: vi.fn().mockResolvedValue({ sucesso: true, hsp_dia: 5.5, fonte: 'nasa-power' }),
  calcularDimensionamento: vi.fn(),
}))

const PROJETO = {
  _id: 'p1', nome: 'Projeto', clienteId: { nome: 'Cliente' },
  localizacao: { cidade: 'Natal', estado: 'RN', latitude: -5.79, longitude: -35.2, irradiancia_kwh_kwp_dia: 5.5 },
  fatura_extracao: { consumo_mensal_kwh: 400 },
}
vi.mock('../providers/ProjetoProvider', () => ({
  useProjeto: () => ({
    projetoId: 'p1', projeto: PROJETO, carregando: false, erro: null,
    recarregar: vi.fn(), acoes: { salvarEtapa: vi.fn() },
  }),
}))
import EtapaDimensionamento from '../paginas/etapas/EtapaDimensionamento'

beforeEach(() => { eficienciaPadraoConfigurada.mockReset() })

describe('perdas iniciais a partir da eficiência padrão', () => {
  it('padrão 75% → perdas nascem em 25, com a origem dita', async () => {
    eficienciaPadraoConfigurada.mockResolvedValue(0.75)
    render(<EtapaDimensionamento />)
    await waitFor(() => expect(screen.getByLabelText('Perdas totais (%)').value).toBe('25'))
    expect(screen.getByText(/padrão da empresa \(Configurações\) — eficiência de 75%/)).toBeTruthy()
  })

  it('sem configuração: perdas vazias, nada imposto', async () => {
    eficienciaPadraoConfigurada.mockResolvedValue(null)
    render(<EtapaDimensionamento />)
    await waitFor(() => expect(eficienciaPadraoConfigurada).toHaveBeenCalled())
    expect(screen.getByLabelText('Perdas totais (%)').value).toBe('')
    expect(screen.queryByText(/Valor inicial/)).toBeNull()
  })

  it('o operador altera por projeto e o rótulo de origem some', async () => {
    eficienciaPadraoConfigurada.mockResolvedValue(0.75)
    render(<EtapaDimensionamento />)
    await waitFor(() => expect(screen.getByLabelText('Perdas totais (%)').value).toBe('25'))
    fireEvent.change(screen.getByLabelText('Perdas totais (%)'), { target: { value: '18' } })
    expect(screen.getByLabelText('Perdas totais (%)').value).toBe('18')
    expect(screen.queryByText(/Valor inicial/)).toBeNull()
  })
})
