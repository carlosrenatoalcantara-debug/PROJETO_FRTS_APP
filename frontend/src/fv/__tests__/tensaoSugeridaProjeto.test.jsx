import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * Trifásico na COSERN/RN é 380 V. No vídeo de produção a tela mostrava 220 V.
 * No fluxo canônico a tensão derivada é SUGESTÃO: só é gravada se o operador
 * aceitar, e sem regra aplicável nada é assumido. Dados fictícios.
 */
const salvarEtapa = vi.fn()
let projetoAtual
vi.mock('../providers/ProjetoProvider', () => ({
  useProjeto: () => ({
    projetoId: 'p1', projeto: projetoAtual, carregando: false, erro: null,
    recarregar: vi.fn(), acoes: { salvarEtapa },
  }),
}))
import EtapaProjeto from '../paginas/etapas/EtapaProjeto'

const projeto = (fatura, estado = null) => ({
  _id: 'p1', nome: 'Projeto', clienteId: { nome: 'Cliente' }, tipo_projeto: 'novo',
  localizacao: { cidade: 'Natal', estado },
  fatura_extracao: { concessionaria: null, tipo_ligacao: null, tensao_v: null, ...fatura },
})

beforeEach(() => { salvarEtapa.mockReset().mockResolvedValue({}) })

describe('tensão sugerida na etapa Projeto', () => {
  it('trifásico + COSERN: sugere 380 V, sem preencher o campo sozinho', () => {
    projetoAtual = projeto({ concessionaria: 'COSERN', tipo_ligacao: 'Trifásico' })
    render(<EtapaProjeto />)
    expect(screen.getByText(/Sugestão 380 V/)).toBeTruthy()
    expect(screen.getByLabelText('Tensão (V)').value).toBe('')
  })

  it('aceitar a sugestão grava 380 em fatura.tensao_v', async () => {
    projetoAtual = projeto({ concessionaria: 'COSERN', tipo_ligacao: 'Trifásico' })
    render(<EtapaProjeto />)
    fireEvent.click(screen.getByText('Usar 380 V'))
    expect(screen.getByLabelText('Tensão (V)').value).toBe('380')
    fireEvent.click(screen.getByText('Salvar dados técnicos'))
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    expect(salvarEtapa.mock.calls[0][0]).toBe('fatura')
    expect(salvarEtapa.mock.calls[0][1]).toMatchObject({ tensao_v: 380 })
  })

  it('UF RN também deriva 380 para trifásico', () => {
    projetoAtual = projeto({ tipo_ligacao: 'Trifásico' }, 'RN')
    render(<EtapaProjeto />)
    expect(screen.getByText(/Sugestão 380 V/)).toBeTruthy()
  })

  it('sem regra aplicável: não sugere e diz que nada é assumido', () => {
    projetoAtual = projeto({ concessionaria: 'Outra', tipo_ligacao: 'Monofásico' })
    render(<EtapaProjeto />)
    expect(screen.queryByText(/Sugestão/)).toBeNull()
    expect(screen.getByText(/sem regra para derivar/)).toBeTruthy()
  })

  it('tensão já gravada não é sugerida de novo', () => {
    projetoAtual = projeto({ concessionaria: 'COSERN', tipo_ligacao: 'Trifásico', tensao_v: 220 })
    render(<EtapaProjeto />)
    expect(screen.queryByText(/Sugestão/)).toBeNull()
    expect(screen.getByLabelText('Tensão (V)').value).toBe('220')
  })
})
