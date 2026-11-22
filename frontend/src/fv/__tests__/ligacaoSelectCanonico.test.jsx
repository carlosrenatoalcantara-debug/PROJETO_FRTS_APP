import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

/** "Trifásico 380V" lido da fatura precisa aparecer no select do projeto. Dados fictícios. */
let projetoAtual
vi.mock('../providers/ProjetoProvider', () => ({
  useProjeto: () => ({ projetoId: 'p1', projeto: projetoAtual, carregando: false, erro: null, recarregar: vi.fn(), acoes: { salvarEtapa: vi.fn() } }),
}))

import EtapaProjeto, { ligacaoDaOpcao } from '../paginas/etapas/EtapaProjeto'

const projeto = (tipo_ligacao) => ({
  _id: 'p1', nome: 'P', clienteId: { nome: 'C' }, tipo_projeto: 'novo', localizacao: null,
  fatura_extracao: { tipo_ligacao }, local_resolvido: {},
})

describe('ligacaoDaOpcao', () => {
  it('casa o texto lido com a opção da lista fechada', () => {
    expect(ligacaoDaOpcao('Trifásico 380V')).toBe('Trifásico')
    expect(ligacaoDaOpcao('TRIFASICO')).toBe('Trifásico')
    expect(ligacaoDaOpcao('monofasico 220 V')).toBe('Monofásico')
    expect(ligacaoDaOpcao('Bifásico')).toBe('Bifásico')
  })
  it('o que não casa (ou é ambíguo) fica em branco', () => {
    expect(ligacaoDaOpcao('')).toBe('')
    expect(ligacaoDaOpcao(null)).toBe('')
    expect(ligacaoDaOpcao('B1 residencial')).toBe('')
  })
})

describe('select "Tipo de ligação"', () => {
  it('mostra Trifásico quando a fatura trouxe "Trifásico 380V"', () => {
    projetoAtual = projeto('Trifásico 380V')
    render(<EtapaProjeto />)
    expect(screen.getByLabelText('Tipo de ligação').value).toBe('Trifásico')
  })
  it('a sugestão de tensão ainda lê o texto gravado ("380V" não se perde na normalização)', () => {
    projetoAtual = { ...projeto('Trifásico 380V'), fatura_extracao: { tipo_ligacao: 'Trifásico 380V', concessionaria: 'Outra Distribuidora' } }
    render(<EtapaProjeto />)
    expect(document.body.textContent).toMatch(/Sugestão 380 V/)
  })
  it('sem dado, continua vazio', () => {
    projetoAtual = projeto(null)
    render(<EtapaProjeto />)
    expect(screen.getByLabelText('Tipo de ligação').value).toBe('')
  })
})
