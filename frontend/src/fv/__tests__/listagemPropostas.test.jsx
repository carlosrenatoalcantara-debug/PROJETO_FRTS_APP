import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

/**
 * FV-UX-033 — listagem agrupada por proposta.
 *
 * O que estes testes protegem:
 *  1. o agrupamento é por `proposta_grupo_id` — nunca por `projeto_origem_id`;
 *  2. projeto que não é opção continua aparecendo como antes;
 *  3. `opcao_numero`/`opcao_rotulo` são preservados: excluir uma irmã não
 *     renumera nem renomeia as outras;
 *  4. agrupar não reordena a listagem;
 *  5. a situação (orçamento, Baseline, Gate) vem do servidor — "não sei" é um
 *     estado distinto de "não há";
 *  6. só a opção aceita é destacada como escolhida;
 *  7. dá para entrar direto em cada opção.
 */

const listarOpcoes = vi.fn()
vi.mock('../api/agregadosFvApi', () => ({
  listarOpcoes: (...a) => listarOpcoes(...a),
  listarProjetos: vi.fn(),
  criarProjeto: vi.fn(),
}))
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...r }) => <a href={to} {...r}>{children}</a>,
  useNavigate: () => vi.fn(),
}))

import CartaoProposta from '../componentes/CartaoProposta'
import {
  agruparPropostas, ehOpcao, resumoDaListagem, rotuloDaOpcao, rotuloDoGate, situacaoDaOpcao,
} from '../propostas'

const cliente = { nome: 'Cliente X' }
const opcao = (n, extra = {}) => ({
  _id: `o${n}`, nome: `Proposta — Opção 0${n}`, tipo_projeto: 'opcao',
  proposta_grupo_id: 'g1', opcao_numero: n, opcao_rotulo: `Opção 0${n}`,
  status: 'rascunho', clienteId: cliente,
  proposta_aceite: { aceita: false }, dimensionamento: { potencia_kwp: 15.6 },
  ...extra,
})
const avulso = { _id: 'p9', nome: 'Projeto solto', tipo_projeto: 'novo', status: 'rascunho', clienteId: cliente }

beforeEach(() => {
  vi.clearAllMocks()
  listarOpcoes.mockResolvedValue({ opcoes: [] })
})

// ═══ 1 · O modelo puro ══════════════════════════════════════════════════════
describe('FV-UX-033 · agrupamento', () => {
  it('1 · é opção só com as DUAS marcas', () => {
    expect(ehOpcao(opcao(1))).toBe(true)
    expect(ehOpcao({ tipo_projeto: 'opcao' })).toBe(false)          // sem grupo
    expect(ehOpcao({ proposta_grupo_id: 'g1' })).toBe(false)        // sem tipo
    expect(ehOpcao(avulso)).toBe(false)
    expect(ehOpcao({ tipo_projeto: 'ampliacao', projeto_origem_id: 'x' })).toBe(false)
  })

  it('2 · agrupa por `proposta_grupo_id`, e ampliação NÃO entra', () => {
    const ampliacao = { _id: 'a1', tipo_projeto: 'ampliacao', projeto_origem_id: 'o1', status: 'rascunho' }
    const e = agruparPropostas([opcao(1), avulso, opcao(2), ampliacao])
    expect(e.map((x) => x.tipo)).toEqual(['proposta', 'projeto', 'projeto'])
    expect(e[0].opcoes).toHaveLength(2)
    expect(e[1].projeto._id).toBe('p9')
    expect(e[2].projeto._id).toBe('a1')   // ampliação segue como projeto avulso
  })

  it('3 · agrupar NÃO reordena: a proposta fica na posição da primeira opção', () => {
    const e = agruparPropostas([avulso, opcao(2), opcao(1)])
    expect(e.map((x) => x.tipo)).toEqual(['projeto', 'proposta'])
    // dentro da proposta, a ordem é a do NÚMERO
    expect(e[1].opcoes.map((o) => o.opcao_numero)).toEqual([1, 2])
  })

  it('4 · dois grupos diferentes não se misturam', () => {
    const outra = { ...opcao(1), _id: 'z1', proposta_grupo_id: 'g2' }
    const e = agruparPropostas([opcao(1), outra])
    expect(e).toHaveLength(2)
    expect(e[0].proposta_grupo_id).toBe('g1')
    expect(e[1].proposta_grupo_id).toBe('g2')
  })

  it('5 · marca a aceita e conta o grupo', () => {
    const e = agruparPropostas([opcao(1), opcao(2, { proposta_aceite: { aceita: true } })])
    expect(e[0].aceita.opcao_numero).toBe(2)
    expect(e[0].total).toBe(2)
    expect(resumoDaListagem(e)).toEqual({ propostas: 1, opcoes: 2, projetos: 0 })
  })

  it('6 · rótulo e número sobrevivem à exclusão de uma irmã (item 7)', () => {
    // A Opção 01 sumiu da listagem; a 02 continua sendo a 02.
    const e = agruparPropostas([opcao(2), opcao(3)])
    expect(e[0].opcoes.map(rotuloDaOpcao)).toEqual(['Opção 02', 'Opção 03'])
    // Sem rótulo gravado, deriva do número — nunca da posição na lista.
    expect(rotuloDaOpcao({ opcao_numero: 7 })).toBe('Opção 07')
    expect(rotuloDaOpcao({})).toBe('Opção')
  })

  it('7 · opção sozinha continua sendo proposta, não vira projeto avulso', () => {
    const e = agruparPropostas([opcao(1)])
    expect(e[0].tipo).toBe('proposta')
    expect(e[0].total).toBe(1)
  })

  it('8 · lista vazia não quebra', () => {
    expect(agruparPropostas([])).toEqual([])
    expect(agruparPropostas(undefined)).toEqual([])
    expect(resumoDaListagem(undefined)).toEqual({ propostas: 0, opcoes: 0, projetos: 0 })
  })
})

// ═══ 2 · Situação ═══════════════════════════════════════════════════════════
describe('FV-UX-033 · situação da opção', () => {
  it('9 · sem detalhe, "não sei" ≠ "não há"', () => {
    const s = situacaoDaOpcao(opcao(1), null)
    expect(s.orcamento).toBe(undefined)
    expect(s.baseline).toBe(undefined)
    expect(s.gate).toBe(undefined)
    expect(rotuloDoGate(undefined).texto).toBe('—')
  })

  it('10 · com detalhe, cada campo vem do servidor', () => {
    const s = situacaoDaOpcao(opcao(1), {
      orcamento: { estado: 'APROVADO' }, baseline: { hash: 'abc' },
      gate: { liberado: false, motivo: 'OPCAO_NAO_ESCOLHIDA' },
      topologia: 'micro', inversor: 'HMS-2000-4T', estrutura: 'Fibrocimento',
    })
    expect(s.orcamento).toBe('APROVADO')
    expect(s.baseline).toBe(true)
    expect(s.topologia).toBe('micro')
    expect(rotuloDoGate(s.gate)).toEqual({ texto: 'bloqueado', tom: 'bloqueado' })
  })

  it('11 · sem orçamento é diferente de sem detalhe', () => {
    const s = situacaoDaOpcao(opcao(1), { orcamento: null, baseline: null, gate: null })
    expect(s.orcamento).toBe(null)
    expect(s.baseline).toBe(false)
  })

  it('12 · todos os motivos do gate têm rótulo', () => {
    for (const [motivo, esperado] of [
      ['SEM_BASELINE', 'sem Baseline'],
      ['BASELINE_CORROMPIDA', 'Baseline corrompida'],
      ['PROPOSTA_SEM_ACEITE', 'aguarda aceite'],
      // O Gate não repete o selo da opção: "não escolhida" é o SELO, "bloqueado"
      // é o Gate. Duas leituras diferentes na mesma linha.
      ['OPCAO_NAO_ESCOLHIDA', 'bloqueado'],
    ]) {
      expect(rotuloDoGate({ liberado: false, motivo }).texto).toBe(esperado)
    }
    expect(rotuloDoGate({ liberado: true })).toEqual({ texto: 'liberado', tom: 'ok' })
  })
})

// ═══ 3 · O cartão ═══════════════════════════════════════════════════════════
describe('FV-UX-033 · cartão da proposta', () => {
  const grupo = (aceitaN = null) => agruparPropostas([
    opcao(1), opcao(2, aceitaN === 2 ? { proposta_aceite: { aceita: true } } : {}),
  ])[0]

  it('13 · mostra a proposta, o cliente e as opções', async () => {
    render(<CartaoProposta proposta={grupo()} />)
    expect(screen.getByText(/Proposta — Cliente X/)).toBeTruthy()
    expect(screen.getByText(/2 opção\(ões\).*nenhuma aceita ainda/)).toBeTruthy()
    expect(screen.getByText('Opção 01')).toBeTruthy()
    expect(screen.getByText('Opção 02')).toBeTruthy()
  })

  it('14 · cada opção entra direto no fluxo canônico (item 10)', async () => {
    render(<CartaoProposta proposta={grupo()} />)
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(links).toContain('/fv/projetos/o1')
    expect(links).toContain('/fv/projetos/o2')
  })

  it('15 · busca a situação UMA vez por proposta', async () => {
    render(<CartaoProposta proposta={grupo()} />)
    await waitFor(() => expect(listarOpcoes).toHaveBeenCalledTimes(1))
    expect(listarOpcoes).toHaveBeenCalledWith('o1')
  })

  it('16 · exibe orçamento, Baseline e Gate quando o servidor responde (item 8)', async () => {
    listarOpcoes.mockResolvedValue({ opcoes: [
      { _id: 'o1', orcamento: { estado: 'APROVADO' }, baseline: { hash: 'a' },
        gate: { liberado: false, motivo: 'OPCAO_NAO_ESCOLHIDA' },
        topologia: 'string', inversor: 'SG15RT', estrutura: 'Fibrocimento' },
      { _id: 'o2', orcamento: { estado: 'APROVADO' }, baseline: { hash: 'b' },
        gate: { liberado: true }, topologia: 'micro', inversor: 'HMS-2000-4T' },
    ] })
    render(<CartaoProposta proposta={grupo(2)} />)
    await waitFor(() => expect(screen.getByText('liberado')).toBeTruthy())
    // O SELO da opção perdedora e o RÓTULO do gate são textos distintos.
    expect(screen.getByText('não escolhida')).toBeTruthy()
    expect(screen.getByText('bloqueado')).toBeTruthy()
    expect(screen.getAllByText('APROVADO')).toHaveLength(2)
    expect(screen.getAllByText('congelada')).toHaveLength(2)
    expect(screen.getByText(/SG15RT/)).toBeTruthy()
    expect(screen.getByText(/HMS-2000-4T/)).toBeTruthy()
    expect(screen.getByText(/Microinversor/)).toBeTruthy()
  })

  it('17 · só a aceita é destacada como escolhida (item 9)', async () => {
    render(<CartaoProposta proposta={grupo(2)} />)
    expect(screen.getByText('escolhida')).toBeTruthy()
    expect(screen.getAllByText('escolhida')).toHaveLength(1)
    expect(screen.getByText(/aceita: Opção 02/)).toBeTruthy()
  })

  it('18 · falha ao buscar a situação não derruba a proposta', async () => {
    listarOpcoes.mockRejectedValue(new Error('rede caiu'))
    render(<CartaoProposta proposta={grupo()} />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    // As opções continuam listadas e clicáveis.
    expect(screen.getByText('Opção 01')).toBeTruthy()
    expect(screen.getAllByRole('link').length).toBeGreaterThan(0)
  })
})
