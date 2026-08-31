import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * FV-UX-030 — estrutura da instalação.
 *
 * O que estes testes protegem:
 *  1. os seis tipos são oferecidos e persistem em `equipamentos.estrutura.tipo`,
 *     campo que já existia — nenhum schema novo;
 *  2. "Outro" sem descrição não salva (regra 8);
 *  3. salvar → recarregar → editar mantém o dado íntegro (regra 7);
 *  4. ausência de estrutura é lacuna declarada, não erro nem default;
 *  5. salvar a estrutura NÃO apaga a composição de módulos e inversores —
 *     a etapa `equipamentos` substitui o subdocumento inteiro no servidor;
 *  6. e o inverso: salvar a composição não apaga a estrutura;
 *  7. nada de dimensionamento, engenharia elétrica ou preço é tocado.
 */

const salvarEtapa = vi.fn()
const listarCatalogo = vi.fn()

vi.mock('../api/agregadosFvApi', () => ({
  listarCatalogo: (...a) => listarCatalogo(...a),
  validarCompatibilidadeEletrica: vi.fn(),
}))

const M650 = {
  _id: 'm1', tipo: 'modulo', fabricante: 'Znshine', modelo: 'ZXM7-UHLD144-650/M',
  especificacoes: { potencia_w: 650, voc_v: 45.5, isc_a: 18.35, vmpp_v: 38.1, impp_a: 17.06 },
}
const INV15 = {
  _id: 'i1', tipo: 'inversor', fabricante: 'Sungrow', modelo: 'SG15RT',
  especificacoes: { potencia: 15, fases: 3, tensao_max_entrada: 1000, tensao_mppt_min: 200,
    tensao_mppt_max: 850, corrente_max_por_mppt: 25, n_mppts: 3 },
}

/** Projeto com composição já gravada em `arranjos[]` (fonte canônica, FV-UX-029). */
const COMPOSTO = {
  _id: 'p1', nome: 'P',
  fatura_extracao: { tipo_ligacao: 'Trifásico' },
  dimensionamento: { num_paineis: 24, potencia_kwp: 15.6 },
  engenharia_eletrica: { arranjo: { mppts: [{ mppt: 1, strings_paralelo: 2, modulos_por_string: 12 }] } },
  equipamentos: {
    paineis: [{ id: 'm1', marca: 'Znshine', modelo: 'ZXM7-UHLD144-650/M', potencia_w: 650, quantidade: 24, equipamento_id: 'm1' }],
    inversor: { id: 'i1', marca: 'Sungrow', modelo: 'SG15RT', potencia_kw: 15, tipo: 'string', fases: 3, equipamento_id: 'i1' },
    estrutura: { tipo: '', descricao: '' },
  },
  arranjos: [{
    id: 'principal', rotulo: 'Arranjo principal', tipo: 'principal',
    paineis: [{ id: 'm1', marca: 'Znshine', modelo: 'ZXM7-UHLD144-650/M', potencia_w: 650, quantidade: 24, equipamento_id: 'm1' }],
    inversores: [{ id: 'i1', marca: 'Sungrow', modelo: 'SG15RT', potencia_kw: 15, tipo: 'string', fases: 3, quantidade: 1, equipamento_id: 'i1' }],
  }],
}

let projetoAtual = COMPOSTO
vi.mock('../providers/ProjetoProvider', () => ({
  useProjeto: () => ({
    projetoId: 'p1', projeto: projetoAtual, carregando: false, erro: null,
    recarregar: vi.fn(), acoes: { salvarEtapa },
  }),
}))

import EtapaEstrutura from '../paginas/etapas/EtapaEstrutura'
import EtapaEquipamentos from '../paginas/etapas/EtapaEquipamentos'
import {
  TIPOS_ESTRUTURA, TIPO_OUTRO, estruturaVazia, daEquipamentos, exigeDescricao,
  paraEquipamentos, resumoDaOpcao, rotuloDaEstrutura, tipoForaDaLista, validarEstrutura,
} from '../estrutura'
import { ETAPAS_FLUXO, etapaPorChave, vizinhas } from '../fluxo'

const clone = (o) => JSON.parse(JSON.stringify(o))
/** Última gravação daquela etapa — o teste 18 salva duas vezes. */
const etapa = (nome) => salvarEtapa.mock.calls.filter(([e]) => e === nome).at(-1)?.[1]
const escolher = (rotulo) => fireEvent.click(screen.getByLabelText(rotulo))
const descrever = (v) => fireEvent.change(screen.getByLabelText('Descrição da estrutura'), { target: { value: v } })
const botaoSalvar = () => screen.getByText(/Salvar estrutura|Salvando…/)

beforeEach(() => {
  vi.clearAllMocks()
  projetoAtual = clone(COMPOSTO)
  listarCatalogo.mockImplementation((t) =>
    Promise.resolve({ equipamentos: t === 'modulo' ? [M650] : [INV15] }))
  salvarEtapa.mockResolvedValue(undefined)
})

// ═══ 1 · Modelo puro ════════════════════════════════════════════════════════
describe('FV-UX-030 · modelo da estrutura', () => {
  it('1 · oferece exatamente os seis tipos da sprint', () => {
    expect(TIPOS_ESTRUTURA.map((t) => t.rotulo)).toEqual([
      'Telhado fibrocimento', 'Telhado cerâmico', 'Telhado metálico',
      'Solo', 'Laje', 'Outro',
    ])
  })

  it('2 · o valor persistido é o rótulo do wizard legado, não um slug', () => {
    // `memorialDescritivoService` imprime `estrutura.tipo` direto no documento.
    expect(TIPOS_ESTRUTURA.map((t) => t.valor)).toEqual([
      'Fibrocimento', 'Cerâmico', 'Metálico', 'Solo', 'Laje', 'Outro',
    ])
  })

  it('3 · ausência é vazio — nunca um tipo assumido', () => {
    expect(estruturaVazia()).toEqual({ tipo: '', descricao: '' })
    expect(daEquipamentos(null)).toEqual({ tipo: '', descricao: '' })
    expect(daEquipamentos({})).toEqual({ tipo: '', descricao: '' })
    expect(daEquipamentos({ estrutura: {} })).toEqual({ tipo: '', descricao: '' })
  })

  it('4 · leitura de ida e volta preserva o que foi gravado', () => {
    const lido = daEquipamentos({ estrutura: { tipo: 'Laje', descricao: 'lastro' } })
    expect(lido).toEqual({ tipo: 'Laje', descricao: 'lastro' })
    expect(paraEquipamentos(lido).estrutura).toEqual({ tipo: 'Laje', descricao: 'lastro' })
  })

  it('5 · "Outro" é o único tipo que exige descrição', () => {
    for (const { valor } of TIPOS_ESTRUTURA) {
      expect(exigeDescricao(valor)).toBe(valor === TIPO_OUTRO)
    }
  })

  it('6 · validação: "Outro" sem descrição é erro; com descrição é válida', () => {
    const sem = validarEstrutura({ tipo: 'Outro', descricao: '   ' })
    expect(sem.valida).toBe(false)
    expect(sem.erros[0]).toMatch(/Outro.*exige descrição/i)

    const com = validarEstrutura({ tipo: 'Outro', descricao: 'trapézio sobre mezanino' })
    expect(com.valida).toBe(true)
    expect(com.erros).toEqual([])
  })

  it('7 · ausência de estrutura é LACUNA declarada, não erro', () => {
    const v = validarEstrutura(estruturaVazia())
    expect(v.valida).toBe(true)
    expect(v.informada).toBe(false)
    expect(v.lacunas).toEqual(['estrutura não informada'])
  })

  it('8 · cada tipo da lista valida sozinho, sem descrição', () => {
    for (const { valor } of TIPOS_ESTRUTURA.filter((t) => t.valor !== TIPO_OUTRO)) {
      const v = validarEstrutura({ tipo: valor, descricao: '' })
      expect(v.valida).toBe(true)
      expect(v.informada).toBe(true)
      expect(v.lacunas).toEqual([])
    }
  })

  it('9 · valor legado fora da lista é preservado, não reclassificado', () => {
    expect(tipoForaDaLista('Mini Trilho')).toBe(true)
    expect(tipoForaDaLista('Laje')).toBe(false)
    expect(tipoForaDaLista('')).toBe(false)
    expect(rotuloDaEstrutura('Mini Trilho')).toBe('Mini Trilho')
    expect(rotuloDaEstrutura('Fibrocimento')).toBe('Telhado fibrocimento')
    expect(rotuloDaEstrutura('')).toBe(null)
    // validar não converte nada
    expect(validarEstrutura({ tipo: 'Mini Trilho' }).valida).toBe(true)
  })

  it('10 · paraEquipamentos preserva paineis e inversor — não os apaga', () => {
    const payload = paraEquipamentos({ tipo: 'Laje', descricao: '' }, COMPOSTO.equipamentos)
    expect(payload.paineis).toEqual(COMPOSTO.equipamentos.paineis)
    expect(payload.inversor).toEqual(COMPOSTO.equipamentos.inversor)
    expect(payload.estrutura).toEqual({ tipo: 'Laje', descricao: '' })
  })

  it('11 · limpar a estrutura escreve vazio — o $set precisa de um valor', () => {
    const payload = paraEquipamentos(estruturaVazia(), { estrutura: { tipo: 'Laje' } })
    expect(payload.estrutura).toEqual({ tipo: '', descricao: '' })
  })

  it('12 · resumo da opção: segmento sem fato é omitido, nunca preenchido', () => {
    const composicao = {
      paineis: [{ marca: 'Znshine', modelo: 'ZXM7', potencia_w: 650 }],
      inversores: [{ marca: 'Sungrow', modelo: 'SG15RT', tipo: 'string' }],
    }
    expect(resumoDaOpcao({ composicao, estrutura: { tipo: 'Fibrocimento' } }))
      .toBe('Opção 01 · String · Znshine ZXM7 650 W · Sungrow SG15RT · Estrutura: Fibrocimento')
    expect(resumoDaOpcao({ composicao })).toBe('Opção 01 · String · Znshine ZXM7 650 W · Sungrow SG15RT')
    expect(resumoDaOpcao({})).toBe('Opção 01')
  })
})

// ═══ 2 · A etapa no fluxo ═══════════════════════════════════════════════════
describe('FV-UX-030 · lugar no fluxo', () => {
  it('13 · Equipamentos → Estrutura, e MPPT continua depois', () => {
    expect(vizinhas('equipamentos').proxima).toBe('estrutura')
    expect(etapaPorChave('estrutura')).toMatchObject({ rotulo: 'Estrutura', agregado: 'ProjetoFV' })
    const chaves = ETAPAS_FLUXO.map((e) => e.chave)
    expect(chaves.indexOf('estrutura')).toBeGreaterThan(chaves.indexOf('equipamentos'))
    expect(chaves.indexOf('estrutura')).toBeLessThan(chaves.indexOf('mppt'))
    expect(chaves.indexOf('estrutura')).toBeLessThan(chaves.indexOf('orcamentos'))
  })
})

// ═══ 3 · A tela ═════════════════════════════════════════════════════════════
describe('FV-UX-030 · etapa de estrutura', () => {
  it('14 · cada um dos seis tipos é selecionável e persiste seu valor', async () => {
    for (const { valor, rotulo } of TIPOS_ESTRUTURA) {
      vi.clearAllMocks()
      salvarEtapa.mockResolvedValue(undefined)
      projetoAtual = clone(COMPOSTO)
      const { unmount } = render(<EtapaEstrutura />)
      escolher(rotulo)
      if (valor === TIPO_OUTRO) descrever('estrutura especial')
      fireEvent.click(botaoSalvar())
      await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
      expect(etapa('equipamentos').estrutura.tipo).toBe(valor)
      unmount()
    }
  })

  it('15 · "Outro" sem descrição não salva; com descrição salva', async () => {
    render(<EtapaEstrutura />)
    escolher('Outro')
    expect(botaoSalvar().disabled).toBe(true)
    expect(screen.getByRole('alert').textContent).toMatch(/exige descrição/i)

    descrever('trapézio sobre mezanino')
    expect(botaoSalvar().disabled).toBe(false)
    fireEvent.click(botaoSalvar())
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    expect(etapa('equipamentos').estrutura)
      .toEqual({ tipo: 'Outro', descricao: 'trapézio sobre mezanino' })
  })

  it('16 · salvar escreve UMA etapa — `equipamentos` — e nenhuma outra', async () => {
    render(<EtapaEstrutura />)
    escolher('Telhado metálico')
    fireEvent.click(botaoSalvar())
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    expect(salvarEtapa.mock.calls.map(([e]) => e)).toEqual(['equipamentos'])
  })

  it('17 · salvar NÃO apaga a composição de módulos e inversores', async () => {
    render(<EtapaEstrutura />)
    escolher('Telhado cerâmico')
    fireEvent.click(botaoSalvar())
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())

    const enviado = etapa('equipamentos')
    expect(enviado.paineis).toEqual(COMPOSTO.equipamentos.paineis)
    expect(enviado.inversor).toEqual(COMPOSTO.equipamentos.inversor)
  })

  it('18 · reload traz o que foi salvo, e a edição parte dele', async () => {
    // salva
    const { unmount } = render(<EtapaEstrutura />)
    escolher('Laje')
    descrever('lastro de concreto')
    fireEvent.click(botaoSalvar())
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    const gravado = etapa('equipamentos')
    unmount()

    // recarrega com o que o servidor guardaria
    projetoAtual = { ...clone(COMPOSTO), equipamentos: gravado }
    render(<EtapaEstrutura />)
    expect(screen.getByLabelText('Laje').checked).toBe(true)
    expect(screen.getByLabelText('Descrição da estrutura').value).toBe('lastro de concreto')
    expect(botaoSalvar().disabled).toBe(true)   // nada alterado ainda

    // edita
    escolher('Solo')
    fireEvent.click(botaoSalvar())
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalledTimes(2))
    expect(etapa('equipamentos').estrutura)
      .toEqual({ tipo: 'Solo', descricao: 'lastro de concreto' })
  })

  it('19 · sem estrutura: lacuna declarada, nenhum tipo pré-marcado', () => {
    render(<EtapaEstrutura />)
    for (const { rotulo } of TIPOS_ESTRUTURA) {
      expect(screen.getByLabelText(rotulo).checked).toBe(false)
    }
    expect(screen.getByText(/Estrutura não informada/i)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBe(null)
  })

  it('20 · valor legado fora da lista é exibido e preservado', () => {
    projetoAtual = {
      ...clone(COMPOSTO),
      equipamentos: { ...clone(COMPOSTO.equipamentos), estrutura: { tipo: 'Mini Trilho', descricao: '' } },
    }
    render(<EtapaEstrutura />)
    for (const { rotulo } of TIPOS_ESTRUTURA) {
      expect(screen.getByLabelText(rotulo).checked).toBe(false)
    }
    expect(screen.getByText(/não consta/i)).toBeTruthy()
    expect(botaoSalvar().disabled).toBe(true)   // nada foi alterado sozinho
  })

  it('21 · o resumo da opção mostra a composição e a estrutura escolhida', () => {
    render(<EtapaEstrutura />)
    expect(screen.getByTestId('resumo-opcao').textContent)
      .toBe('Opção 01 · String · Znshine ZXM7-UHLD144-650/M 650 W · Sungrow SG15RT')
    escolher('Telhado fibrocimento')
    expect(screen.getByTestId('resumo-opcao').textContent)
      .toBe('Opção 01 · String · Znshine ZXM7-UHLD144-650/M 650 W · Sungrow SG15RT · Estrutura: Fibrocimento')
  })

  it('22 · não toca dimensionamento, engenharia elétrica nem preço', async () => {
    render(<EtapaEstrutura />)
    escolher('Solo')
    fireEvent.click(botaoSalvar())
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())

    const enviado = etapa('equipamentos')
    expect(Object.keys(enviado).sort()).toEqual(['estrutura', 'inversor', 'paineis'])
    for (const proibida of ['dimensionamento', 'engenharia_eletrica', 'orcamento', 'arranjos']) {
      expect(etapa(proibida)).toBe(undefined)
    }
    expect(projetoAtual.dimensionamento).toEqual(COMPOSTO.dimensionamento)
    expect(projetoAtual.engenharia_eletrica).toEqual(COMPOSTO.engenharia_eletrica)
  })
})

// ═══ 4 · O caminho inverso ══════════════════════════════════════════════════
describe('FV-UX-030 · a composição não apaga a estrutura', () => {
  it('23 · salvar equipamentos preserva `estrutura` já gravada', async () => {
    projetoAtual = {
      ...clone(COMPOSTO),
      equipamentos: { ...clone(COMPOSTO.equipamentos), estrutura: { tipo: 'Fibrocimento', descricao: 'gancho' } },
    }
    render(<EtapaEquipamentos />)
    await waitFor(() => expect(screen.getByLabelText('Módulo').disabled).toBe(false))

    fireEvent.change(screen.getByLabelText('Quantidade do módulo 1'), { target: { value: '30' } })
    fireEvent.click(screen.getByText('Salvar composição'))
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalledWith('equipamentos', expect.anything()))

    expect(etapa('equipamentos').estrutura).toEqual({ tipo: 'Fibrocimento', descricao: 'gancho' })
  })
})
