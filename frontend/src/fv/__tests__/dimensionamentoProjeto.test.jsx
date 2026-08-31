import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * FV-UX-020 — dimensionamento na nova UX.
 *
 * O que estes testes protegem:
 *
 *  1. o cálculo roda no SERVIDOR, pelo motor existente — nenhuma fórmula aqui;
 *  2. o bloco financeiro que o motor devolve junto (payback, VPL, TIR, economia,
 *     custo) é DESCARTADO. A FV-DOM-008 mediu oito motores divergindo; deixar
 *     este entrar na tela recriaria a segunda verdade que o contrato V1 fechou;
 *  3. nenhuma premissa de engenharia é sugerida — HSP, perdas e margem são
 *     entradas obrigatórias, e vão sempre explícitas para o motor, senão os
 *     defaults internos dele decidiriam sozinhos;
 *  4. `num_strings` e `num_inversores` continuam sem fonte e sem invenção.
 */

const salvarEtapa = vi.fn()
const calcularDimensionamento = vi.fn()

vi.mock('../api/agregadosFvApi', () => ({
  calcularDimensionamento: (...a) => calcularDimensionamento(...a),
}))

/** Resposta real do motor: técnico + financeiro no mesmo objeto. */
const RESPOSTA = {
  sucesso: true,
  input_normalizado: {
    consumo_mensal_kwh: 1500, cidade: 'Natal', estado: 'RN',
    irradiancia_kwh_m2_dia: 5.42, perdas_pct: 18, margem_pct: 10,
    tarifa_kwh: 0.85, pot_modulo_w: 550, custo_kwp_instalado_r: 4200, tipo_sistema: 'string',
  },
  resultado: {
    potencia_kwp: 12.35, geracao_mensal_kwh: 1646.5, geracao_anual_kwh: 19758,
    geracao_25anos_kwh: 463000, qtd_modulos_estimada: 23, area_ocupacao_m2: 77.28,
    // Bloco do motor ANTIGO — nada disto pode aparecer nem ser gravado.
    custo_total_r: 51870, economia_anual_r: 16794.3, economia_25anos_r: 900000,
    payback_anos: 3.1, vpl_r: 250000, tir_aa: 0.42, tipo_sistema: 'string',
  },
  metadados: { versao_motor: '1.0.0', calculado_em: '2026-08-17T10:00:00.000Z', anos_projeto: 25 },
}

const PROJETO = {
  _id: 'p1',
  nome: 'Projeto E2E',
  fatura_extracao: { consumo_mensal_kwh: 1500 },
  equipamentos: { paineis: [{ potencia_w: 550, quantidade: 23 }], inversor: {} },
  localizacao: { cidade: 'Natal', estado: 'RN', irradiancia_kwh_kwp_dia: null },
  local_resolvido: { cidade: 'Natal', estado: 'RN' },
  dimensionamento: null,
}

let projetoAtual = PROJETO
vi.mock('../providers/ProjetoProvider', () => ({
  useProjeto: () => ({
    projetoId: 'p1', projeto: projetoAtual, carregando: false, erro: null,
    recarregar: vi.fn(), acoes: { salvarEtapa },
  }),
}))

import EtapaDimensionamento from '../paginas/etapas/EtapaDimensionamento'

const preencher = (rotulo, valor) =>
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } })
const premissasPadrao = () => {
  preencher('HSP (kWh/m²·dia)', '5.42')
  preencher('Perdas totais (%)', '18')
  preencher('Margem de sobredimensionamento (%)', '10')
}
const calcular = () => fireEvent.click(screen.getByText('Calcular dimensionamento'))
const salvar = () => fireEvent.click(screen.getByText('Salvar dimensionamento'))
const enviado = () => salvarEtapa.mock.calls.find(([e]) => e === 'dimensionamento')?.[1]

describe('FV-UX-020 · o cálculo é do servidor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    projetoAtual = PROJETO
    calcularDimensionamento.mockResolvedValue(RESPOSTA)
    salvarEtapa.mockResolvedValue(undefined)
  })

  it('1 · chama o motor existente com entradas e premissas explícitas', async () => {
    render(<EtapaDimensionamento />)
    premissasPadrao()
    calcular()
    await waitFor(() => expect(calcularDimensionamento).toHaveBeenCalled())
    expect(calcularDimensionamento).toHaveBeenCalledWith({
      consumo_mensal_kwh: 1500, pot_modulo_w: 550, cidade: 'Natal', estado: 'RN',
      irradiancia_kwh_m2_dia: 5.42, perdas_pct: 18, margem_pct: 10,
    })
  })

  it('2 · as três premissas vão sempre — o default interno do motor não decide', async () => {
    render(<EtapaDimensionamento />)
    premissasPadrao()
    calcular()
    await waitFor(() => expect(calcularDimensionamento).toHaveBeenCalled())
    const corpo = calcularDimensionamento.mock.calls[0][0]
    for (const p of ['irradiancia_kwh_m2_dia', 'perdas_pct', 'margem_pct']) {
      expect(corpo[p], p).not.toBeUndefined()
      expect(corpo[p], p).not.toBeNull()
    }
  })

  it('3 · nenhuma premissa é sugerida — os campos nascem vazios', () => {
    render(<EtapaDimensionamento />)
    for (const r of ['HSP (kWh/m²·dia)', 'Perdas totais (%)', 'Margem de sobredimensionamento (%)']) {
      expect(screen.getByLabelText(r).value, r).toBe('')
    }
  })

  it('3b · HSP já persistido no projeto é leitura, não sugestão', () => {
    projetoAtual = { ...PROJETO, localizacao: { ...PROJETO.localizacao, irradiancia_kwh_kwp_dia: 5.42 } }
    render(<EtapaDimensionamento />)
    expect(screen.getByLabelText('HSP (kWh/m²·dia)').value).toBe('5.42')
  })

  it('4 · sem as três premissas, não calcula', () => {
    render(<EtapaDimensionamento />)
    preencher('HSP (kWh/m²·dia)', '5.42')
    expect(screen.getByText('Calcular dimensionamento').disabled).toBe(true)
    calcular()
    expect(calcularDimensionamento).not.toHaveBeenCalled()
  })

  it('5 · entrada ausente de etapa anterior bloqueia e diz qual é', () => {
    projetoAtual = { ...PROJETO, equipamentos: { paineis: [], inversor: {} } }
    render(<EtapaDimensionamento />)
    premissasPadrao()
    expect(document.body.textContent).toContain('Potência do módulo')
    expect(screen.getByText('Calcular dimensionamento').disabled).toBe(true)
  })
})

describe('FV-UX-020 · o financeiro do motor é descartado', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    projetoAtual = PROJETO
    calcularDimensionamento.mockResolvedValue(RESPOSTA)
    salvarEtapa.mockResolvedValue(undefined)
  })

  it('6 · nenhum indicador financeiro do motor aparece na tela', async () => {
    render(<EtapaDimensionamento />)
    premissasPadrao()
    calcular()
    await screen.findByText('12.35 kWp')
    for (const proibido of ['3.1', '250000', '51870', '16794', '900000', '0.42']) {
      expect(document.body.textContent.includes(proibido), `exibiu \`${proibido}\``).toBe(false)
    }
    expect(document.body.textContent).toContain('contrato V1')
  })

  it('7 · nenhum indicador financeiro é gravado', async () => {
    render(<EtapaDimensionamento />)
    premissasPadrao()
    calcular()
    await screen.findByText('12.35 kWp')
    salvar()
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    const d = enviado()
    for (const campo of ['payback_anos', 'vpl_r', 'tir_aa', 'custo_total_r',
      'economia_anual_r', 'economia_25anos_r']) {
      expect(d[campo], campo).toBeUndefined()
    }
  })

  it('8 · grava exatamente os campos técnicos do schema', async () => {
    render(<EtapaDimensionamento />)
    premissasPadrao()
    calcular()
    await screen.findByText('12.35 kWp')
    salvar()
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    expect(salvarEtapa.mock.calls.map(([e]) => e)).toEqual(['dimensionamento'])
    expect(enviado()).toEqual({
      potencia_kwp: 12.35, geracao_mensal_kwh: 1646.5, geracao_anual_kwh: 19758,
      num_paineis: 23, area_total_m2: 77.28,
      metodo: 'automatico', calculado_em: '2026-08-17T10:00:00.000Z',
    })
  })

  it('9 · strings e inversores não são inventados', async () => {
    render(<EtapaDimensionamento />)
    premissasPadrao()
    calcular()
    await screen.findByText('12.35 kWp')
    salvar()
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    expect(enviado().num_strings).toBeUndefined()
    expect(enviado().num_inversores).toBeUndefined()
    expect(document.body.textContent).toContain('Strings e inversores continuam pendentes')
  })

  it('10 · o que o motor não produz e já estava gravado não é apagado', async () => {
    projetoAtual = {
      ...PROJETO,
      dimensionamento: { num_strings: 3, num_inversores: 1, performance_ratio: 0.8, potencia_kwp: 9 },
    }
    render(<EtapaDimensionamento />)
    premissasPadrao()
    calcular()
    await screen.findByText('12.35 kWp')
    salvar()
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    const d = enviado()
    expect(d.num_strings).toBe(3)
    expect(d.num_inversores).toBe(1)
    expect(d.performance_ratio).toBe(0.8)
    expect(d.potencia_kwp).toBe(12.35)   // este, sim, foi recalculado
  })
})

describe('FV-UX-020 · leitura, proveniência e erros', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    projetoAtual = PROJETO
    calcularDimensionamento.mockResolvedValue(RESPOSTA)
    salvarEtapa.mockResolvedValue(undefined)
  })

  it('11 · o dimensionamento persistido é exibido no reload', () => {
    projetoAtual = {
      ...PROJETO,
      dimensionamento: { potencia_kwp: 12.35, geracao_anual_kwh: 19758, num_paineis: 23, num_strings: null },
    }
    render(<EtapaDimensionamento />)
    expect(document.body.textContent).toContain('19758 kWh')
    expect(document.body.textContent).toContain('12.35 kWp')
  })

  it('12 · a proveniência de cada entrada é declarada', () => {
    render(<EtapaDimensionamento />)
    expect(document.body.textContent).toContain('fatura_extracao.consumo_mensal_kwh')
    expect(document.body.textContent).toContain('equipamentos.paineis[0].potencia_w')
  })

  it('13 · as premissas efetivamente usadas voltam declaradas', async () => {
    render(<EtapaDimensionamento />)
    premissasPadrao()
    calcular()
    await screen.findByText('12.35 kWp')
    expect(document.body.textContent).toContain('HSP 5.42')
    expect(document.body.textContent).toContain('perdas 18%')
    expect(document.body.textContent).toContain('módulo de 550 W')
  })

  it('14 · erro do servidor é propagado sem reinterpretação', async () => {
    const e = new Error('consumo_mensal_kwh é obrigatório e deve ser > 0')
    e.codigo = 'INPUT_INVALIDO'
    calcularDimensionamento.mockRejectedValue(e)
    render(<EtapaDimensionamento />)
    premissasPadrao()
    calcular()
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain('INPUT_INVALIDO')
  })

  it('15 · erro ao salvar é propagado', async () => {
    const e = new Error('Projeto congelado — alteração de "dimensionamento" bloqueada.')
    e.codigo = 'PROJETO_CONGELADO'
    salvarEtapa.mockRejectedValue(e)
    render(<EtapaDimensionamento />)
    premissasPadrao()
    calcular()
    await screen.findByText('12.35 kWp')
    salvar()
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain('PROJETO_CONGELADO')
  })
})

describe('FV-UX-020 · nenhuma fórmula no cliente', () => {
  const ler = async (rel) => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    return readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), rel), 'utf8')
  }
  const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('16 · nenhuma fórmula de dimensionamento nem financeira', async () => {
    const fonte = semComentarios(await ler('../paginas/etapas/EtapaDimensionamento.jsx'))
    for (const p of ['Math.pow', 'Math.ceil', 'Math.floor', 'Math.sqrt',
      'dimensionarFV', 'calcularPotenciaKwp', 'calcularGeracao', 'calcularVPL', 'calcularTIR',
      'calcularPayback', '@fortesolar/fv-shared', '* 30', '* 12', '/ 1000']) {
      expect(fonte.includes(p), `encontrou \`${p}\``).toBe(false)
    }
  })

  it('17 · nenhum default de premissa', async () => {
    const fonte = semComentarios(await ler('../paginas/etapas/EtapaDimensionamento.jsx'))
    for (const p of ['?? 18', '|| 18', '?? 10', '|| 10', '?? 5.0', '|| 5.0', '?? 5.55',
      '?? 550', '|| 550', '?? 0.8', "useState('18')", "useState('10')"]) {
      expect(fonte.includes(p), `encontrou \`${p}\``).toBe(false)
    }
    expect(fonte.includes("perdas_pct: ''")).toBe(true)
    expect(fonte.includes("margem_pct: ''")).toBe(true)
  })

  it('18 · nenhuma chamada HTTP direta e nenhuma cópia do agregado', async () => {
    const fonte = await ler('../paginas/etapas/EtapaDimensionamento.jsx')
    for (const p of ['fetch(', 'apiFetch', 'axios', 'createContext', 'localStorage', 'buscarProjeto']) {
      expect(fonte.includes(p), `encontrou \`${p}\``).toBe(false)
    }
    expect(fonte.includes('acoes.salvarEtapa')).toBe(true)
  })

  it('19 · o cliente da API usa a rota existente do motor', async () => {
    const api = await ler('../api/agregadosFvApi.js')
    expect(api.includes("'/api/dimensionamento/calcular'")).toBe(true)
    expect(api.includes('/api/dimensionamento/strings')).toBe(false)   // stringing é MPPT
  })
})
