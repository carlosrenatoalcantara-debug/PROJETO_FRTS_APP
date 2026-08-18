import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * FV-UX-018 — entrada técnica do projeto na nova UX.
 *
 * O que estes testes protegem, em ordem de importância:
 *
 *  1. a tela grava pela operação que JÁ EXISTE (`PUT /:id/etapa`), com as etapas
 *     da lista fechada do servidor — não por uma rota nova;
 *  2. campo em branco é AUSÊNCIA e `0` é zero — a confusão entre os dois foi o
 *     defeito que a FV-DOM-011B removeu de 18 lugares;
 *  3. a UF vai sobre uma cópia da `localizacao` devolvida pelo servidor, porque
 *     o handler substitui o subdocumento inteiro. Mandar só `{estado}` apagaria
 *     Tmin/Tmax — os dois campos que decidem a Voc_max das strings;
 *  4. nada é calculado, sugerido ou completado do lado do cliente.
 */

const salvarEtapa = vi.fn()
const recarregar = vi.fn()

/** Projeto devolvido pelo servidor. `localizacao` vem com o que NÃO pode sumir. */
const PROJETO = {
  _id: 'p1',
  nome: 'Projeto E2E',
  clienteId: { nome: 'Cliente Teste' },
  tipo_projeto: 'novo',
  localizacao: {
    cidade: 'Natal',
    estado: null,
    latitude: -5.79,
    longitude: -35.2,
    temperatura_min_historica_c: 18,
    temperatura_max_historica_c: 34,
    geocoding_origem: 'usuario_manual',
  },
  fatura_extracao: {
    concessionaria: null,
    tipo_ligacao: null,
    tensao_v: null,
    consumo_mensal_kwh: null,
    valor_kwh: null,
  },
  local_resolvido: { cidade: 'Natal', estado: null },
}

let projetoAtual = PROJETO
vi.mock('../providers/ProjetoProvider', () => ({
  useProjeto: () => ({
    projetoId: 'p1',
    projeto: projetoAtual,
    carregando: false,
    erro: null,
    recarregar,
    acoes: { salvarEtapa },
  }),
}))

import EtapaProjeto from '../paginas/etapas/EtapaProjeto'

const campo = (rotulo) => screen.getByLabelText(rotulo)
const preencher = (rotulo, valor) => fireEvent.change(campo(rotulo), { target: { value: valor } })
const salvar = () => fireEvent.click(screen.getByText('Salvar dados técnicos'))

/** Chamadas agrupadas por etapa: `{ fatura: dados, localizacao: dados }`. */
const porEtapa = () =>
  Object.fromEntries(salvarEtapa.mock.calls.map(([etapa, dados]) => [etapa, dados]))

describe('FV-UX-018 · gravação pela operação existente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    projetoAtual = PROJETO
    salvarEtapa.mockResolvedValue(undefined)
  })

  it('1 · usa somente as etapas `fatura` e `localizacao` — nenhuma inventada', async () => {
    render(<EtapaProjeto />)
    preencher('Consumo (kWh/mês)', '1500')
    preencher('UF', 'RN')
    salvar()
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalledTimes(2))
    expect(salvarEtapa.mock.calls.map(([e]) => e).sort()).toEqual(['fatura', 'localizacao'])
  })

  it('2 · envia SOMENTE os campos alterados', async () => {
    render(<EtapaProjeto />)
    preencher('Tensão (V)', '380')
    salvar()
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    const { fatura, localizacao } = porEtapa()
    expect(fatura).toEqual({ tensao_v: 380 })
    // Nada mudou na localização — a etapa nem é chamada.
    expect(localizacao).toBeUndefined()
  })

  it('3 · zero digitado chega como zero, não como ausência', async () => {
    render(<EtapaProjeto />)
    preencher('Tarifa da fatura (R$/kWh)', '0')
    preencher('Consumo (kWh/mês)', '0')
    salvar()
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    expect(porEtapa().fatura).toEqual({ valor_kwh: 0, consumo_mensal_kwh: 0 })
  })

  it('4 · campo limpo vira null — ausência explícita, nunca 0', async () => {
    projetoAtual = {
      ...PROJETO,
      fatura_extracao: { ...PROJETO.fatura_extracao, consumo_mensal_kwh: 1500 },
    }
    render(<EtapaProjeto />)
    expect(campo('Consumo (kWh/mês)').value).toBe('1500')
    preencher('Consumo (kWh/mês)', '')
    salvar()
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    expect(porEtapa().fatura).toEqual({ consumo_mensal_kwh: null })
    expect(porEtapa().fatura.consumo_mensal_kwh).not.toBe(0)
  })

  it('5 · a UF preserva o restante da `localizacao` — o handler substitui o subdoc', async () => {
    render(<EtapaProjeto />)
    preencher('UF', 'RN')
    salvar()
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    const loc = porEtapa().localizacao
    expect(loc.estado).toBe('RN')
    expect(loc.latitude).toBe(-5.79)
    expect(loc.temperatura_min_historica_c).toBe(18)
    expect(loc.temperatura_max_historica_c).toBe(34)
    expect(loc.geocoding_origem).toBe('usuario_manual')
  })

  it('6 · os valores persistidos aparecem carregados', () => {
    projetoAtual = {
      ...PROJETO,
      localizacao: { ...PROJETO.localizacao, estado: 'RN' },
      fatura_extracao: {
        concessionaria: 'NEOENERGIA COSERN', tipo_ligacao: 'Trifásico',
        tensao_v: 380, consumo_mensal_kwh: 1500, valor_kwh: 0.98,
      },
    }
    render(<EtapaProjeto />)
    expect(campo('Concessionária').value).toBe('NEOENERGIA COSERN')
    expect(campo('Tipo de ligação').value).toBe('Trifásico')
    expect(campo('Tensão (V)').value).toBe('380')
    expect(campo('Consumo (kWh/mês)').value).toBe('1500')
    expect(campo('Tarifa da fatura (R$/kWh)').value).toBe('0.98')
    expect(campo('UF').value).toBe('RN')
  })

  it('6b · zero persistido é exibido como 0 — não como campo vazio', () => {
    projetoAtual = {
      ...PROJETO,
      fatura_extracao: { ...PROJETO.fatura_extracao, valor_kwh: 0 },
    }
    render(<EtapaProjeto />)
    expect(campo('Tarifa da fatura (R$/kWh)').value).toBe('0')
  })

  it('7 · nada é sugerido — projeto sem dados nasce com todos os campos vazios', () => {
    render(<EtapaProjeto />)
    for (const r of ['Consumo (kWh/mês)', 'Tarifa da fatura (R$/kWh)', 'Tensão (V)',
      'Concessionária', 'Tipo de ligação', 'UF']) {
      expect(campo(r).value, r).toBe('')
    }
  })

  it('8 · sem alteração, o botão não envia nada', () => {
    render(<EtapaProjeto />)
    expect(screen.getByText('Salvar dados técnicos').disabled).toBe(true)
    salvar()
    expect(salvarEtapa).not.toHaveBeenCalled()
  })

  it('9 · erro do servidor é exibido sem reinterpretação', async () => {
    const e = new Error('Projeto congelado — alteração de "fatura" bloqueada.')
    e.codigo = 'PROJETO_CONGELADO'
    salvarEtapa.mockRejectedValue(e)
    render(<EtapaProjeto />)
    preencher('Tensão (V)', '220')
    salvar()
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain('Projeto congelado')
    expect(alerta.textContent).toContain('PROJETO_CONGELADO')
  })

  it('10 · o salvamento relê o servidor — a resposta do PUT não vira estado', async () => {
    render(<EtapaProjeto />)
    preencher('Tensão (V)', '220')
    salvar()
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    // `salvarEtapa` do provider já encadeia o recarregar; o teste garante que a
    // tela não mantém rascunho próprio depois de salvar.
    await waitFor(() => expect(screen.getByText('Salvar dados técnicos').disabled).toBe(true))
  })

  it('11 · distribuidora da importação é declarada, não silenciada', () => {
    projetoAtual = { ...PROJETO, distribuidora: 'ENEL SP' }
    render(<EtapaProjeto />)
    expect(document.body.textContent).toContain('ENEL SP')
    expect(document.body.textContent).toContain('precedência')
  })
})

describe('FV-UX-018 · nenhum cálculo e nenhuma fonte nova no cliente', () => {
  const ler = async (rel) => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    return readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), rel), 'utf8')
  }

  it('12 · nenhuma fórmula de engenharia ou financeira na etapa', async () => {
    const fonte = await ler('../paginas/etapas/EtapaProjeto.jsx')
    for (const proibido of [
      'Math.pow', 'Math.sqrt', 'calcularVPL', 'calcularTIR', 'calcularRetorno',
      'dimensionar', 'engenhariaNormativa', '@fortesolar/fv-shared',
      'potencia_kwp =', 'geracao_anual',
    ]) {
      expect(fonte.includes(proibido), `encontrou \`${proibido}\``).toBe(false)
    }
  })

  it('13 · nenhum default técnico — sem `?? 220`, `|| 127` e afins', async () => {
    const semComentarios = (await ler('../paginas/etapas/EtapaProjeto.jsx'))
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const p of ['?? 220', '|| 220', '?? 127', '|| 127', '?? 380', '|| 380',
      "useState('220')", "useState('Monofásico')", '?? 1500', '|| 1500']) {
      expect(semComentarios.includes(p), `encontrou \`${p}\``).toBe(false)
    }
  })

  it('14 · grava só por `salvarEtapa` — nenhuma chamada HTTP direta', async () => {
    const fonte = await ler('../paginas/etapas/EtapaProjeto.jsx')
    for (const p of ['fetch(', 'apiFetch', 'axios', "method: 'PUT'", "method: 'POST'"]) {
      expect(fonte.includes(p), `encontrou \`${p}\``).toBe(false)
    }
    expect(fonte.includes('acoes.salvarEtapa')).toBe(true)
  })

  it('15 · o cliente da API usa a rota existente `/etapa`, sem inventar outra', async () => {
    const api = await ler('../api/agregadosFvApi.js')
    expect(api.includes('${base(projetoId)}/etapa')).toBe(true)
    expect(api.includes('/dados-tecnicos')).toBe(false)
    expect(api.includes('/tecnico')).toBe(false)
  })

  it('16 · o estado do projeto não é duplicado — a etapa lê do ProjetoProvider', async () => {
    const fonte = await ler('../paginas/etapas/EtapaProjeto.jsx')
    expect(fonte.includes('useProjeto')).toBe(true)
    // Nenhum provider ou cache paralelo do agregado.
    expect(fonte.includes('createContext')).toBe(false)
    expect(fonte.includes('localStorage')).toBe(false)
    expect(fonte.includes('buscarProjeto')).toBe(false)
  })
})
