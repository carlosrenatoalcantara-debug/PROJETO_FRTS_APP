import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { divergenciasDaComposicao, recalcularPelaComposicao } from '../microinversores'

/**
 * Defeito relatado em 2026-11-25: 24 módulos e 6 micros na composição, mas a
 * topologia distribuía 1 módulo — o número do dimensionamento, feito com HSP de
 * teste, vencia a composição; e a distribuição errada, uma vez salva, ficava.
 */
const MICRO = {
  _id: 'h1', tipo: 'inversor', fabricante: 'Hoymiles Power Electronics Inc.', modelo: 'HMS-2250DW-4T (240V)',
  especificacoes: { potencia: 2.25, fases: 1, topologia: 'micro', entradas: 4, modulos_por_entrada: 1 },
}
const PAINEL = { _id: 'm1', tipo: 'modulo', fabricante: 'Ronma', modelo: 'RM-620W', especificacoes: { potencia_w: 620 } }
const COMPOSTO = { equipamento_id: 'h1', id: 'h1', marca: MICRO.fabricante, modelo: MICRO.modelo, tipo: 'micro', quantidade: 6 }
const PAINEIS = [{ id: 'm1', equipamento_id: 'm1', marca: 'Ronma', modelo: 'RM-620W', potencia_w: 620, quantidade: 24 }]
const SALVA_ERRADA = [{
  equipamento_id: 'h1', marca: MICRO.fabricante, modelo: MICRO.modelo, quantidade: 6,
  entradas_por_micro: 4, modulos_por_entrada: 1, distribuicao: [1, 0, 0, 0, 0, 0],
}]
const projeto = (micros, extra = {}) => ({
  _id: 'p1', nome: 'P', dimensionamento: { num_paineis: 1 }, localizacao: { estado: 'RN' },
  fatura_extracao: { tipo_ligacao: 'Trifásico 380V' },
  equipamentos: { paineis: PAINEIS, inversor: COMPOSTO },
  arranjos: [{ id: 'principal', tipo: 'principal', topologia: 'micro', paineis: PAINEIS, inversores: [COMPOSTO],
    ...(micros ? { configuracao_eletrica: { micros } } : {}), ...extra }],
})

const { salvarEtapa, listarCatalogo } = vi.hoisted(() => ({ salvarEtapa: vi.fn(), listarCatalogo: vi.fn() }))
let atual = null
vi.mock('../providers/ProjetoProvider', () => ({
  useProjeto: () => ({ projetoId: 'p1', projeto: atual, carregando: false, erro: null,
    recarregar: vi.fn(), acoes: { salvarEtapa } }),
}))
vi.mock('../api/agregadosFvApi', async (orig) => ({ ...(await orig()), listarCatalogo }))
const { default: EtapaMppt } = await import('../paginas/etapas/EtapaMppt')

const montar = async (p) => {
  atual = p
  render(<EtapaMppt naComposicao />)
  await screen.findByLabelText('Módulos do modelo 1')
  await screen.findByText(/calculada pelo SSOT/)
}
const porMicro = () => [1, 2, 3, 4, 5, 6].map((k) => screen.getByLabelText(`Micro ${k}`).textContent.match(/(\d+) módulo/)[1])

beforeEach(() => {
  salvarEtapa.mockReset().mockResolvedValue({})
  listarCatalogo.mockReset().mockImplementation(async (tipo) => ({
    equipamentos: tipo === 'inversor' ? [MICRO] : tipo === 'modulo' ? [PAINEL] : [] }))
})

describe('a composição manda na topologia de micros', () => {
  it('24 módulos em 6 micros de 4 entradas → 4 em cada, mesmo com dimensionamento = 1', async () => {
    await montar(projeto())
    expect(porMicro()).toEqual(['4', '4', '4', '4', '4', '4'])
    expect(screen.getByText('24 de 24')).toBeTruthy()
    expect(screen.queryByText(/Usar \d+ microinversor/)).toBeNull()
    expect(screen.queryByLabelText('Topologia desatualizada')).toBeNull()
  })

  it('capacidade por micro e total não se confundem', async () => {
    await montar(projeto())
    expect(screen.getByText(/Capacidade 4 módulo\(s\) por micro/)).toBeTruthy()
    expect(screen.getByText('24 módulos')).toBeTruthy()
  })

  it('trifásico sem regra de ramal não vira "uma única fase viva"', async () => {
    await montar(projeto())
    expect(screen.queryByText(/uma única fase viva/)).toBeNull()
    expect(screen.getByText(/Instalação com 3 fases vivas/)).toBeTruthy()
  })

  it('topologia salva com 1 módulo: avisa, não troca sozinha, recalcula num clique e grava 4 por micro', async () => {
    await montar(projeto(SALVA_ERRADA))
    expect(screen.getByLabelText('Topologia desatualizada').textContent)
      .toContain('1 módulo(s) distribuído(s) e 24 na composição')
    expect(porMicro()).toEqual(['1', '0', '0', '0', '0', '0'])
    expect(salvarEtapa).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Recalcular pela composição'))
    expect(porMicro()).toEqual(['4', '4', '4', '4', '4', '4'])
    expect(salvarEtapa).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Salvar topologia'))
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalledTimes(1))
    const [etapa, corpo] = salvarEtapa.mock.calls[0]
    expect(etapa).toBe('arranjos')
    expect(corpo.lista[0].configuracao_eletrica.micros[0].distribuicao).toEqual([4, 4, 4, 4, 4, 4])
  })

  it('sem composição de módulos, o dimensionamento ainda responde', async () => {
    const p = projeto(null, { paineis: [] })
    p.equipamentos.paineis = []
    p.dimensionamento.num_paineis = 8
    await montar(p)
    expect(screen.getByText('8 de 8')).toBeTruthy()
  })
})

describe('divergências e recálculo (puros)', () => {
  it('aponta modelo trocado nos dois sentidos', () => {
    const d = divergenciasDaComposicao([{ equipamento_id: 'x', modelo: 'Velho', quantidade: 6, modulos: 24 }], [COMPOSTO], 24)
    expect(d.join(' ')).toContain('Velho não está na composição')
    expect(d.join(' ')).toContain('HMS-2250DW-4T (240V) está na composição e não aqui')
  })

  it('mantém entradas informadas na tela quando o catálogo não declara', () => {
    const semEnvelope = { ...MICRO, especificacoes: { potencia: 2.25, fases: 1, topologia: 'micro' } }
    const antes = [{ equipamento_id: 'h1', quantidade: 6, entradas_por_micro: 4, modulos_por_entrada: 1, modulos: 1 }]
    expect(recalcularPelaComposicao(antes, [COMPOSTO], [semEnvelope], 24)[0].modulos).toBe(24)
    expect(recalcularPelaComposicao([], [COMPOSTO], [semEnvelope], 24)[0].modulos).toBe(null)
  })

  it('nunca atribui além da capacidade nem além do total', () => {
    const dois = [{ ...COMPOSTO, quantidade: 2 }]
    expect(recalcularPelaComposicao([], dois, [MICRO], 24)[0].modulos).toBe(8)
    expect(recalcularPelaComposicao([], dois, [MICRO], null)[0].modulos).toBe(0)
  })
})
