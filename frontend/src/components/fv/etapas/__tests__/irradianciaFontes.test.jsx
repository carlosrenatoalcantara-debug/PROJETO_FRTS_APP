import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * Vídeo de produção (15/11/2026): NASA POWER e INPE/CRESESB mostravam valores
 * idênticos; o cabeçalho dizia "via NASA" com o rádio em INPE; o gráfico mensal
 * saía achatado e o CRESESB fabricava 12 meses iguais. Local fictício (Parnamirim/RN).
 */
let ctxState
const dispatchMock = vi.fn()
vi.mock('../../../../contexts/ProjetoFVContext', () => ({
  useProjetoFV: () => ({ state: ctxState, dispatch: dispatchMock, proxima: vi.fn(), anterior: vi.fn() }),
}))
vi.mock('../../../../contexts/EmpresaContext', () => ({
  useEmpresa: () => ({ empresa: { forcaFallbackIrradiancia: false, estadoPrincipal: 'RN' } }),
}))
const consultarIrradiancia = vi.fn()
vi.mock('../../../../services/nasaPowerApi', () => ({
  consultarIrradiancia: (...a) => consultarIrradiancia(...a),
}))

import E4Irradiancia from '../E4Irradiancia'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const SERIE_NASA = [6.4, 6.3, 6.0, 5.6, 5.1, 4.8, 4.9, 5.5, 6.2, 6.6, 6.7, 6.5]
const serie = (vals) => vals.map((valor, i) => ({ mes: MESES[i], valor }))

const estado = (irr = {}, loc = {}) => ({
  localizacao: { lat: -5.9, lon: -35.2, uf: 'RN', cidadeEstado: 'Parnamirim, RN', ...loc },
  irradiancia: { mensal: null, mediaAnual: null, carregando: false, erro: null, fonte: null, ...irr },
})
const radio = (nome) => screen.getByRole('radio', { name: new RegExp(nome) })
const ultimoPayload = () => dispatchMock.mock.calls.at(-1)[0].payload

beforeEach(() => {
  dispatchMock.mockClear()
  consultarIrradiancia.mockReset().mockResolvedValue({ mensal: serie(SERIE_NASA), mediaAnual: 5.77 })
})

describe('trocar a fonte REAPLICA a fonte', () => {
  it('clicar em INPE/CRESESB aplica a média da cidade na hora (5,40 ≠ NASA 5,77)', () => {
    ctxState = estado({ mensal: serie(SERIE_NASA), mediaAnual: 5.77, fonte: 'nasa' })
    render(<E4Irradiancia />)
    fireEvent.click(radio('INPE'))
    expect(ultimoPayload()).toMatchObject({ fonte: 'cresesb', mediaAnual: 5.4, mensal: null })
  })

  it('clicar em NASA POWER reconsulta com as coordenadas do projeto', async () => {
    ctxState = estado({ mediaAnual: 5.4, fonte: 'cresesb' })
    render(<E4Irradiancia />)
    fireEvent.click(radio('NASA'))
    await waitFor(() => expect(consultarIrradiancia).toHaveBeenCalledWith(-5.9, -35.2))
    await waitFor(() => expect(ultimoPayload()).toMatchObject({ fonte: 'nasa', mediaAnual: 5.77 }))
  })

  it('NASA sem coordenadas: diz o motivo e não consulta', () => {
    ctxState = estado({ mediaAnual: 5.4, fonte: 'cresesb' }, { lat: null, lon: null })
    render(<E4Irradiancia />)
    fireEvent.click(radio('NASA'))
    expect(consultarIrradiancia).not.toHaveBeenCalled()
    expect(screen.getByText(/Localização sem coordenadas/)).toBeTruthy()
  })

  it('NASA indisponível: aplica CRESESB, avisa e move o rádio junto', async () => {
    consultarIrradiancia.mockRejectedValue(new Error('Erro NASA POWER: 503'))
    ctxState = estado({ mediaAnual: 5.4, fonte: 'cresesb' })
    render(<E4Irradiancia />)
    fireEvent.click(radio('NASA'))
    await waitFor(() => expect(screen.getByText(/Aplicada a média INPE\/CRESESB no lugar/)).toBeTruthy())
    expect(ultimoPayload()).toMatchObject({ fonte: 'cresesb', mediaAnual: 5.4 })
    expect(radio('INPE').getAttribute('aria-checked')).toBe('true')
  })
})

describe('cabeçalho e card mostram a fonte APLICADA, não a marcada', () => {
  it('estado aplicado = NASA, usuário marca INPE: o cabeçalho continua NASA até a aplicação chegar', () => {
    ctxState = estado({ mensal: serie(SERIE_NASA), mediaAnual: 5.77, fonte: 'nasa' })
    render(<E4Irradiancia />)
    fireEvent.click(radio('INPE')) // o dispatch é mock: o estado aplicado não muda
    expect(screen.getByTestId('fonte-aplicada').textContent).toBe('NASA POWER')
  })

  it('aplicada = CRESESB: cabeçalho e card dizem INPE/CRESESB e a origem do número', () => {
    ctxState = estado({ mediaAnual: 5.4, fonte: 'cresesb' })
    render(<E4Irradiancia />)
    expect(screen.getByTestId('fonte-aplicada').textContent).toBe('INPE/CRESESB')
    expect(screen.getByTestId('origem-irradiancia').textContent).toMatch(/Parnamirim \(tabela CRESESB\)/)
  })

  it('projeto reaberto sem fonte registrada: diz "não registrada", não chuta NASA', () => {
    ctxState = estado({ mediaAnual: 5.5, fonte: null })
    render(<E4Irradiancia />)
    expect(screen.getByTestId('fonte-aplicada').textContent).toBe('fonte não registrada')
    expect(screen.getByTestId('origem-irradiancia').textContent).toMatch(/Origem não registrada/)
  })

  it('projeto reaberto com média gravada NÃO reconsulta sozinho', () => {
    ctxState = estado({ mediaAnual: 5.5, fonte: 'nasa' })
    render(<E4Irradiancia />)
    expect(consultarIrradiancia).not.toHaveBeenCalled()
    expect(dispatchMock).not.toHaveBeenCalled()
  })
})

describe('números coerentes (um valor, uma origem)', () => {
  it('o texto do seletor mostra o valor que será aplicado (cidade), sem o 5,9 do estado', () => {
    ctxState = estado({ mediaAnual: 5.4, fonte: 'cresesb' })
    render(<E4Irradiancia />)
    fireEvent.click(radio('INPE'))
    const texto = document.body.textContent
    expect(texto).toMatch(/Parnamirim \(tabela CRESESB\): 5\.4 kWh/)
    expect(texto).not.toMatch(/5\.9/)
  })

  it('cidade fora da tabela: usa a média do estado e DIZ que é do estado', () => {
    ctxState = estado({ mediaAnual: 5.9, fonte: 'cresesb' }, { cidadeEstado: 'Parelhas, RN' })
    render(<E4Irradiancia />)
    expect(screen.getByTestId('origem-irradiancia').textContent).toMatch(/média territorial do estado RN/)
  })
})

describe('série mensal só quando existe', () => {
  it('CRESESB (mensal null): nenhuma barra, aviso explícito e "Próxima" liberado', () => {
    ctxState = estado({ mensal: null, mediaAnual: 5.4, fonte: 'cresesb' })
    render(<E4Irradiancia />)
    expect(screen.queryByTestId('grafico-mensal')).toBeNull()
    expect(screen.getByTestId('sem-serie-mensal')).toBeTruthy()
    expect(screen.getByText(/Próxima/).closest('button').disabled).toBe(false)
  })

  it('série fabricada (12 valores iguais, projeto antigo) também não vira gráfico', () => {
    ctxState = estado({ mensal: serie(Array(12).fill(5.4)), mediaAnual: 5.4, fonte: 'cresesb' })
    render(<E4Irradiancia />)
    expect(screen.queryByTestId('grafico-mensal')).toBeNull()
    expect(screen.getByTestId('sem-serie-mensal')).toBeTruthy()
  })

  it('sem nenhuma média aplicada: "Próxima" travado', () => {
    ctxState = estado({}, { lat: null, lon: null })
    render(<E4Irradiancia />)
    expect(screen.getByText(/Próxima/).closest('button').disabled).toBe(true)
  })
})

describe('altura das barras', () => {
  it('NASA: 12 barras com alturas proporcionais e contêiner de altura definida', () => {
    ctxState = estado({ mensal: serie(SERIE_NASA), mediaAnual: 5.77, fonte: 'nasa' })
    render(<E4Irradiancia />)
    const barras = screen.getAllByTestId('barra-mensal')
    expect(barras).toHaveLength(12)
    const pct = barras.map((b) => parseFloat(b.style.height))
    // 6,7 → 83,75%; 4,8 → 60%: proporcional, não achatado em minHeight.
    expect(Math.max(...pct)).toBeCloseTo(83.75, 1)
    expect(Math.min(...pct)).toBeCloseTo(60, 1)
    expect(barras.every((b) => b.style.minHeight === '')).toBe(true)
    // O contêiner tem altura definida (h-32) e a trilha da barra ocupa o resto (flex-1).
    expect(screen.getByTestId('grafico-mensal').className).toMatch(/\bh-32\b/)
    expect(barras[0].parentElement.className).toMatch(/\bflex-1\b/)
  })
})

describe('consumidores da série mensal toleram "só média"', () => {
  it('o PDF comercial não indexa irradiancia.mensal sem proteção (mensal pode ser null)', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const rel = '../../../../utils/gerarPdfComercial.js'
    const fonte = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
    expect(fonte).not.toMatch(/irradiancia\.mensal\[/)
    expect(fonte).toMatch(/irradiancia\.mensal\?\.\[i\]/)
  })
})
