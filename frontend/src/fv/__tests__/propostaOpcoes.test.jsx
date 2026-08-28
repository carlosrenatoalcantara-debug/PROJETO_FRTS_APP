import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * FV-DOM-032 — opções concorrentes da mesma proposta.
 *
 * O que estes testes protegem:
 *  1. a etapa Proposta vem DEPOIS da Aprovação — aceitar é ato separado;
 *  2. sem grupo, a tela explica em vez de inventar opções;
 *  3. criar opção leva o operador para montá-la (ela nasce vazia);
 *  4. o aceite é oferecido enquanto nenhuma opção foi aceita;
 *  5. depois do aceite, a escolhida é marcada e as demais são declaradas
 *     "não escolhidas" — sem sumirem da lista (regras 6 e 9);
 *  6. a tela não reimplementa a regra 8: exibe o erro do servidor.
 *
 * FV-UX-035 acrescenta:
 *  7. o aceite só é OFERECIDO depois que a proposta foi enviada ao cliente;
 *  8. a tela mostra o link do cliente e o que o tracking já registrou.
 */

const listarOpcoes = vi.fn()
const criarOpcao = vi.fn()
const aceitarOpcao = vi.fn()
const enviarProposta = vi.fn()
const obterEnvioDaProposta = vi.fn()
const baixarPdfDaProposta = vi.fn()
const navegar = vi.fn()

vi.mock('../api/agregadosFvApi', () => ({
  listarOpcoes: (...a) => listarOpcoes(...a),
  criarOpcao: (...a) => criarOpcao(...a),
  aceitarOpcao: (...a) => aceitarOpcao(...a),
  enviarProposta: (...a) => enviarProposta(...a),
  obterEnvioDaProposta: (...a) => obterEnvioDaProposta(...a),
  baixarPdfDaProposta: (...a) => baixarPdfDaProposta(...a),
}))
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'p1' }),
  useNavigate: () => navegar,
}))

const PROJETO = { _id: 'p1', nome: 'Proposta X' }
vi.mock('../providers/ProjetoProvider', () => ({
  useProjeto: () => ({
    projetoId: 'p1', projeto: PROJETO, carregando: false, erro: null,
    acoes: { recarregar: vi.fn() },
  }),
}))

import EtapaProposta from '../paginas/etapas/EtapaProposta'
import { ETAPAS_FLUXO, etapaPorChave, vizinhas } from '../fluxo'

const OP1 = { _id: 'p1', nome: 'Proposta X — Opção 01', opcao_rotulo: 'Opção 01',
  opcao_numero: 1, status: 'rascunho', proposta_aceite: { aceita: false },
  dimensionamento: { potencia_kwp: 15.6 } }
const OP2 = { _id: 'p2', nome: 'Proposta X — Opção 02', opcao_rotulo: 'Opção 02',
  opcao_numero: 2, status: 'rascunho', proposta_aceite: { aceita: false } }

const montar = async () => {
  render(<EtapaProposta />)
  await waitFor(() => expect(screen.queryByText('Carregando opções…')).toBe(null))
}

/** Estado de envio: por padrão, a proposta JÁ foi enviada e está vigente. */
const ENVIADA = {
  enviada: true, vigente: true, envios: 1,
  ultimo: { share_id: 'ENVIO-1', token: 'tok123', url: 'http://app/proposta/tok123',
    criado_em: '2026-08-25T12:00:00Z', validade: '2026-09-24T12:00:00Z',
    snapshot_hash: 'abc123', visualizacoes: 0, primeiro_acesso: null, ultimo_acesso: null },
}
const NAO_ENVIADA = { enviada: false, vigente: false, envios: 0, ultimo: null }

beforeEach(() => {
  vi.clearAllMocks()
  listarOpcoes.mockResolvedValue({ proposta_grupo_id: null, opcoes: [], aceita: null })
  obterEnvioDaProposta.mockResolvedValue(ENVIADA)
})

// ═══ 1 · Lugar no fluxo ═════════════════════════════════════════════════════
describe('FV-DOM-032 · lugar no fluxo', () => {
  it('1 · Proposta vem depois da Aprovação', () => {
    const chaves = ETAPAS_FLUXO.map((e) => e.chave)
    expect(chaves.indexOf('proposta')).toBeGreaterThan(chaves.indexOf('aprovacao'))
    expect(vizinhas('aprovacao').proxima).toBe('proposta')
    expect(etapaPorChave('proposta')).toMatchObject({ rotulo: 'Proposta', agregado: 'ProjetoFV' })
  })
})

// ═══ 2 · Sem grupo ══════════════════════════════════════════════════════════
describe('FV-DOM-032 · projeto sem opções', () => {
  it('2 · explica em vez de inventar', async () => {
    await montar()
    expect(screen.getByText(/ainda não faz parte de uma proposta com opções/)).toBeTruthy()
    expect(screen.getByText(/nada técnico é copiado/)).toBeTruthy()
    expect(screen.getByText('Criar nova opção')).toBeTruthy()
  })

  it('3 · criar opção leva o operador para montá-la', async () => {
    criarOpcao.mockResolvedValue({ item: { _id: 'p2' }, opcao_numero: 2 })
    listarOpcoes.mockResolvedValue({ proposta_grupo_id: 'g1', opcoes: [OP1, OP2], aceita: null })
    await montar()
    fireEvent.click(screen.getByText('Criar nova opção'))
    await waitFor(() => expect(criarOpcao).toHaveBeenCalledWith('p1'))
    // A opção nasce vazia — o próximo passo é a composição.
    expect(navegar).toHaveBeenCalledWith('/fv/projetos/p2/equipamentos')
  })
})

// ═══ 3 · Com opções ═════════════════════════════════════════════════════════
describe('FV-DOM-032 · grupo com duas opções', () => {
  beforeEach(() => {
    listarOpcoes.mockResolvedValue({ proposta_grupo_id: 'g1', opcoes: [OP1, OP2], aceita: null })
  })

  it('4 · lista as duas, na ordem, e marca a que está em edição', async () => {
    await montar()
    expect(screen.getByText('Opção 01')).toBeTruthy()
    expect(screen.getByText('Opção 02')).toBeTruthy()
    expect(screen.getByText('(em edição)')).toBeTruthy()
    expect(screen.getByText(/15\.6 kWp/)).toBeTruthy()
  })

  it('5 · oferece o aceite em cada opção enquanto nenhuma foi aceita', async () => {
    await montar()
    expect(screen.getAllByText('Aceitar esta opção')).toHaveLength(2)
  })

  it('6 · aceitar chama o servidor com a opção escolhida', async () => {
    aceitarOpcao.mockResolvedValue({ sucesso: true })
    await montar()
    fireEvent.click(screen.getAllByText('Aceitar esta opção')[1])
    await waitFor(() => expect(aceitarOpcao).toHaveBeenCalledWith('p2'))
    expect(listarOpcoes).toHaveBeenCalledTimes(2)   // relê o grupo
  })

  it('7 · a regra 8 vem do SERVIDOR — a tela só exibe', async () => {
    aceitarOpcao.mockRejectedValue(
      Object.assign(new Error('A proposta já tem uma opção aceita.'), { codigo: 'PROPOSTA_JA_ACEITA' }))
    await montar()
    fireEvent.click(screen.getAllByText('Aceitar esta opção')[0])
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('alert').textContent).toMatch(/já tem uma opção aceita.*PROPOSTA_JA_ACEITA/)
  })
})

// ═══ 4 · Depois do aceite ═══════════════════════════════════════════════════
describe('FV-DOM-032 · depois do aceite', () => {
  const ACEITA = { ...OP2, proposta_aceite: { aceita: true } }
  beforeEach(() => {
    listarOpcoes.mockResolvedValue({ proposta_grupo_id: 'g1', opcoes: [OP1, ACEITA], aceita: ACEITA })
  })

  it('8 · marca a escolhida e declara a outra (regras 6 e 9)', async () => {
    await montar()
    expect(screen.getByText('aceita')).toBeTruthy()
    expect(screen.getByText(/Permanece no histórico, consultável, com a Baseline/)).toBeTruthy()
    // A perdedora NÃO some da lista.
    expect(screen.getByText('Opção 01')).toBeTruthy()
  })

  it('9 · nenhuma outra pode ser aceita — o botão some', async () => {
    await montar()
    expect(screen.queryByText('Aceitar esta opção')).toBe(null)
    expect(screen.getByText(/Proposta aceita na Opção 02/)).toBeTruthy()
  })

  it('10 · a tela declara que aceitar ≠ aprovar orçamento (regra 3)', async () => {
    await montar()
    expect(screen.getByText(/ato separado de aprovar o orçamento/)).toBeTruthy()
  })
})

// ═══ FV-UX-035 · o envio precede o aceite ═══════════════════════════════════
describe('FV-UX-035 · envio da proposta ao cliente', () => {
  it('10 · sem envio, o aceite não é oferecido — o botão fica desabilitado', async () => {
    listarOpcoes.mockResolvedValue({ proposta_grupo_id: 'g1', opcoes: [OP1, OP2], aceita: null })
    obterEnvioDaProposta.mockResolvedValue(NAO_ENVIADA)
    await montar()

    expect(screen.getByText('Proposta ainda não enviada')).toBeTruthy()
    for (const b of screen.getAllByText('Aceitar esta opção')) {
      expect(b.closest('button').disabled).toBe(true)
    }
  })

  it('11 · com envio vigente, o aceite volta a ser oferecido', async () => {
    listarOpcoes.mockResolvedValue({ proposta_grupo_id: 'g1', opcoes: [OP1, OP2], aceita: null })
    await montar()

    expect(screen.getByText('Proposta enviada ao cliente')).toBeTruthy()
    for (const b of screen.getAllByText('Aceitar esta opção')) {
      expect(b.closest('button').disabled).toBe(false)
    }
  })

  it('12 · link expirado bloqueia o aceite e diz por quê', async () => {
    listarOpcoes.mockResolvedValue({ proposta_grupo_id: 'g1', opcoes: [OP1, OP2], aceita: null })
    obterEnvioDaProposta.mockResolvedValue({ ...ENVIADA, vigente: false })
    await montar()

    expect(screen.getByText(/O link expirou/)).toBeTruthy()
    for (const b of screen.getAllByText('Aceitar esta opção')) {
      expect(b.closest('button').disabled).toBe(true)
    }
  })

  it('13 · exibe o link do cliente e o que o tracking registrou', async () => {
    listarOpcoes.mockResolvedValue({ proposta_grupo_id: 'g1', opcoes: [OP1, OP2], aceita: null })
    obterEnvioDaProposta.mockResolvedValue({ ...ENVIADA,
      ultimo: { ...ENVIADA.ultimo, visualizacoes: 3, ultimo_acesso: '2026-08-25T15:00:00Z' } })
    await montar()

    expect(screen.getByText('http://app/proposta/tok123')).toBeTruthy()
    expect(screen.getByText(/Aberto 3×/)).toBeTruthy()
  })

  it('14 · enviar chama o servidor e recarrega o estado', async () => {
    listarOpcoes.mockResolvedValue({ proposta_grupo_id: 'g1', opcoes: [OP1, OP2], aceita: null })
    obterEnvioDaProposta.mockResolvedValue(NAO_ENVIADA)
    enviarProposta.mockResolvedValue({ sucesso: true })
    await montar()

    fireEvent.click(screen.getByText('Enviar ao cliente'))
    await waitFor(() => expect(enviarProposta).toHaveBeenCalledWith('p1', {}))
    // Duas leituras: a da montagem e a de depois do envio.
    await waitFor(() => expect(obterEnvioDaProposta.mock.calls.length).toBe(2))
  })

  it('15 · a tela não decide o envio — só reflete o servidor', async () => {
    // `import.meta.url` não é file: no transform do Vitest — caminho a partir da raiz.
    const fonte = readFileSync(
      resolve(process.cwd(), 'src/fv/paginas/etapas/EtapaProposta.jsx'), 'utf8')
    // Nada de prazo, validade ou token calculados na interface.
    expect(/validade\s*=|calcularValidade|gerarToken/.test(fonte)).toBe(false)
    // O botão de aceite lê o estado que veio do servidor.
    expect(fonte.includes('!envio?.enviada || !envio?.vigente')).toBe(true)
  })
})

// ═══ FV-UX-036 · PDF da proposta por opção ══════════════════════════════════
describe('FV-UX-036 · PDF da proposta', () => {
  let urlCriada
  beforeEach(() => {
    urlCriada = null
    listarOpcoes.mockResolvedValue({ proposta_grupo_id: 'g1', opcoes: [OP1, OP2], aceita: null })
    baixarPdfDaProposta.mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }))
    global.URL.createObjectURL = vi.fn(() => { urlCriada = 'blob:fake'; return urlCriada })
    global.URL.revokeObjectURL = vi.fn()
    window.open = vi.fn(() => ({}))
  })

  it('16 · cada opção oferece o SEU documento, rotulado', async () => {
    await montar()
    expect(screen.getByText('Opção 01 — PDF da proposta')).toBeTruthy()
    expect(screen.getByText('Opção 02 — PDF da proposta')).toBeTruthy()
  })

  it('17 · o botão pede o PDF DAQUELA opção ao backend', async () => {
    await montar()
    fireEvent.click(screen.getByText('Opção 02 — PDF da proposta'))
    await waitFor(() => expect(baixarPdfDaProposta).toHaveBeenCalledWith('p2'))
    expect(baixarPdfDaProposta).not.toHaveBeenCalledWith('p1')
  })

  it('18 · abre o documento numa aba', async () => {
    await montar()
    fireEvent.click(screen.getByText('Opção 01 — PDF da proposta'))
    await waitFor(() => expect(window.open).toHaveBeenCalled())
    expect(global.URL.createObjectURL).toHaveBeenCalled()
  })

  it('19 · o erro REAL do backend chega ao operador', async () => {
    const erro = new Error('Projeto não encontrado')
    erro.codigo = 'NAO_ENCONTRADO'
    baixarPdfDaProposta.mockRejectedValue(erro)
    await montar()
    fireEvent.click(screen.getByText('Opção 01 — PDF da proposta'))
    await waitFor(() =>
      expect(screen.getByText(/Projeto não encontrado \(NAO_ENCONTRADO\)/)).toBeTruthy())
  })

  it('20 · gerar o PDF NÃO aceita a opção (FV-UX-035 intacta)', async () => {
    await montar()
    fireEvent.click(screen.getByText('Opção 01 — PDF da proposta'))
    await waitFor(() => expect(baixarPdfDaProposta).toHaveBeenCalled())
    expect(aceitarOpcao).not.toHaveBeenCalled()
    expect(enviarProposta).not.toHaveBeenCalled()
  })

  it('21 · o PDF continua acessível depois do aceite', async () => {
    listarOpcoes.mockResolvedValue({
      proposta_grupo_id: 'g1',
      opcoes: [OP1, { ...OP2, proposta_aceite: { aceita: true } }],
      aceita: { ...OP2, proposta_aceite: { aceita: true } },
    })
    await montar()
    // O aceite some; o documento das duas permanece.
    expect(screen.queryByText('Aceitar esta opção')).toBe(null)
    expect(screen.getByText('Opção 01 — PDF da proposta')).toBeTruthy()
    expect(screen.getByText('Opção 02 — PDF da proposta')).toBeTruthy()
  })

  it('22 · a tela não monta documento nenhum — só pede', () => {
    const fonte = readFileSync(
      resolve(process.cwd(), 'src/fv/paginas/etapas/EtapaProposta.jsx'), 'utf8')
    expect(/jsPDF|pdfkit/i.test(fonte)).toBe(false)
    expect(fonte.includes('baixarPdfDaProposta')).toBe(true)
  })
})
