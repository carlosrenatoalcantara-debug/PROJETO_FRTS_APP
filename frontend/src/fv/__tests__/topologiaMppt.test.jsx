import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * FV-UX-026 — editor de topologia MPPT.
 *
 * O que estes testes protegem:
 *
 *  1. `mppts[]` é AUTORAL — nada é distribuído automaticamente, nenhum MPPT
 *     nasce preenchido, nenhuma quantidade de módulos é sugerida;
 *  2. nenhum cálculo elétrico vive no cliente — Voc, Vmpp, Isc e diagnósticos
 *     vêm do validador canônico, uma chamada POR MPPT;
 *  3. erro elétrico bloqueante impede salvar;
 *  4. o que é gravado tem o shape que o schema e o unifilar já esperam.
 */

const salvarEtapa = vi.fn()
const listarCatalogo = vi.fn()
const validar = vi.fn()

vi.mock('../api/agregadosFvApi', () => ({
  listarCatalogo: (...a) => listarCatalogo(...a),
  validarCompatibilidadeEletrica: (...a) => validar(...a),
}))

const MODULO = {
  _id: 'm1', tipo: 'modulo', fabricante: 'DAH', modelo: 'DHN-550',
  especificacoes: { potencia_w: 550, voc_v: 49.9, isc_a: 14, vmpp_v: 41.8, impp_a: 13.2,
    coef_temp_voc_pct_c: -0.27, noct_c: 44 },
}
const INVERSOR = {
  _id: 'i1', tipo: 'inversor', fabricante: 'Sungrow', modelo: 'SG20RT',
  especificacoes: { potencia: 20, fases: 3, tensao_max_entrada: 1000, tensao_mppt_min: 200,
    tensao_mppt_max: 850, corrente_max_por_mppt: 25, n_mppts: 2, strings_por_mppt: 2 },
}

const OK_VALIDACAO = {
  compativel: true, erros: [], warnings: [],
  calculos: { voc_string_max: 616.58, vmpp_string_quente: 443.36, isc_total: 17.5 },
  clima_utilizado: { temperatura_min_historica_c: 14, temperatura_max_historica_c: 38,
    fonte: 'informado', usou_fallback: false },
}

const PROJETO = {
  _id: 'p1', nome: 'Projeto',
  equipamentos: {
    paineis: [{ id: 'm1', marca: 'DAH', modelo: 'DHN-550', potencia_w: 550, quantidade: 24, equipamento_id: 'm1' }],
    inversor: { id: 'i1', marca: 'Sungrow', modelo: 'SG20RT', potencia_kw: 20, equipamento_id: 'i1' },
  },
  dimensionamento: { num_paineis: 24 },
  localizacao: { cidade: 'Natal', estado: 'RN', temperatura_min_historica_c: 14, temperatura_max_historica_c: 38 },
  local_resolvido: { cidade: 'Natal', estado: 'RN' },
  engenharia_eletrica: null,
}

let projetoAtual = PROJETO
vi.mock('../providers/ProjetoProvider', () => ({
  useProjeto: () => ({
    projetoId: 'p1', projeto: projetoAtual, carregando: false, erro: null,
    recarregar: vi.fn(), acoes: { salvarEtapa },
  }),
}))

import EtapaMppt from '../paginas/etapas/EtapaMppt'

/**
 * O botão "+ MPPT" aparece assim que há equipamentos, ANTES de o catálogo
 * responder — esperar por ele deixava o teste correr com a topologia ainda
 * nula. A condição certa é o primeiro cartão de MPPT, que só existe depois de
 * o catálogo informar quantos MPPTs o inversor tem.
 */
const montar = async () => {
  render(<EtapaMppt />)
  await screen.findByText(/MPPT 1/)
}
const campo = (mppt, entrada, str) =>
  screen.getByLabelText(`MPPT ${mppt} entrada ${entrada} string ${str} módulos`)
const digitar = (m, e, s, v) => fireEvent.change(campo(m, e, s), { target: { value: v } })
const clicar = (texto, n = 0) => fireEvent.click(screen.getAllByText(texto)[n])
const enviado = () => salvarEtapa.mock.calls.find(([e]) => e === 'engenharia_eletrica')?.[1]

describe('FV-UX-026 · topologia autoral', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    projetoAtual = PROJETO
    listarCatalogo.mockImplementation((t) =>
      Promise.resolve({ equipamentos: t === 'modulo' ? [MODULO] : [INVERSOR] }))
    validar.mockResolvedValue(OK_VALIDACAO)
    salvarEtapa.mockResolvedValue(undefined)
  })

  it('1 · nasce com os MPPTs do inversor, todos VAZIOS', async () => {
    await montar()
    expect(screen.getByText(/MPPT 1/)).toBeTruthy()
    expect(screen.getByText(/MPPT 2/)).toBeTruthy()
    expect(screen.getAllByText(/— livre/).length).toBe(2)
    expect(screen.queryByLabelText(/string 1 módulos/)).toBeNull()
    expect(document.body.textContent).toContain('0 módulo(s)')
  })

  it('2 · nada é distribuído automaticamente: 24 módulos ficam por distribuir', async () => {
    await montar()
    expect(document.body.textContent).toContain('24 módulo(s)')
  })

  it('3 · criar entrada e string, e informar módulos', async () => {
    await montar()
    clicar('+ string', 0)
    digitar(1, 1, 1, '12')
    expect(campo(1, 1, 1).value).toBe('12')
    expect(document.body.textContent).toContain('12 módulo(s)')
  })

  it('4 · soma por MPPT e total distribuído', async () => {
    await montar()
    clicar('+ string', 0); digitar(1, 1, 1, '10')
    clicar('+ string', 0); digitar(1, 1, 2, '2')
    clicar('+ string', 1); digitar(2, 1, 1, '12')
    // MPPT1 = 12, MPPT2 = 12, total 24, restantes 0
    expect(document.body.textContent).toContain('0 módulo(s)')
  })

  it('5 · entrada física adicional', async () => {
    await montar()
    clicar('+ entrada física', 0)
    expect(screen.getByText('Entrada 2')).toBeTruthy()
    clicar('+ string', 1)
    digitar(1, 2, 1, '8')
    expect(campo(1, 2, 1).value).toBe('8')
  })

  it('6 · adicionar e remover MPPT', async () => {
    await montar()
    clicar('+ MPPT')
    expect(screen.getByText(/MPPT 3/)).toBeTruthy()
    clicar('remover MPPT', 2)
    expect(screen.queryByText(/MPPT 3/)).toBeNull()
  })

  it('7 · string em branco é ausência, não zero', async () => {
    await montar()
    clicar('+ string', 0)
    // Sem digitar nada: o MPPT continua livre e nada é somado.
    expect(screen.getAllByText(/— livre/).length).toBe(2)
    expect(document.body.textContent).toContain('24 módulo(s)')
  })

  it('7b · zero explícito não conta como string utilizada', async () => {
    await montar()
    clicar('+ string', 0)
    digitar(1, 1, 1, '0')
    expect(document.body.textContent).toContain('24 módulo(s)')
  })
})

describe('FV-UX-026 · validação canônica', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    projetoAtual = PROJETO
    listarCatalogo.mockImplementation((t) =>
      Promise.resolve({ equipamentos: t === 'modulo' ? [MODULO] : [INVERSOR] }))
    validar.mockResolvedValue(OK_VALIDACAO)
    salvarEtapa.mockResolvedValue(undefined)
  })

  const montarComTopologia = async () => {
    await montar()
    clicar('+ string', 0); digitar(1, 1, 1, '12')
    clicar('+ string', 1); digitar(2, 1, 1, '12')
  }

  it('8 · uma chamada POR MPPT, ao endpoint canônico', async () => {
    await montarComTopologia()
    clicar('Validar arranjo')
    await waitFor(() => expect(validar).toHaveBeenCalledTimes(2))
    const corpo = validar.mock.calls[0][0]
    expect(corpo.arranjo_proposto).toEqual({
      quantidade_modulos_por_string: 12, quantidade_strings_paralelo: 1, num_mppt_usados: 1,
    })
    expect(corpo.dados_eletricos_modulo.voc).toBe(49.9)
    expect(corpo.dados_eletricos_modulo.coef_temp_voc).toBe(-0.27)   // %/°C — Q4
    expect(corpo.dados_eletricos_inversor.corrente_max_mppt).toBe(25)
    expect(corpo.dados_climaticos_regiao.temperatura_min_historica_c).toBe(14)
  })

  it('9 · MPPT vazio não é enviado para validação', async () => {
    await montar()
    clicar('+ string', 0); digitar(1, 1, 1, '12')
    clicar('Validar arranjo')
    await waitFor(() => expect(validar).toHaveBeenCalled())
    expect(validar).toHaveBeenCalledTimes(1)
  })

  it('10 · diagnósticos do servidor são exibidos por MPPT', async () => {
    validar.mockResolvedValue({
      ...OK_VALIDACAO, compativel: false,
      erros: [{ codigo: 'CORRENTE_ISC_EXCEDIDA', severidade: 'critico',
        mensagem: 'CORRENTE EXCEDIDA: Isc de projeto (35 A) excede…' }],
    })
    await montarComTopologia()
    clicar('Validar arranjo')
    await screen.findAllByText(/CORRENTE EXCEDIDA/)
    expect(screen.getAllByText(/CORRENTE EXCEDIDA/).length).toBe(2)
  })

  it('11 · erro bloqueante impede salvar', async () => {
    validar.mockResolvedValue({
      ...OK_VALIDACAO, compativel: false,
      erros: [{ codigo: 'VOC_EXCEDIDA_CRITICA', severidade: 'critico', mensagem: 'SOBRETENSÃO' }],
    })
    await montarComTopologia()
    clicar('Validar arranjo')
    await screen.findAllByText(/SOBRETENSÃO/)
    expect(screen.getByText('Salvar topologia').disabled).toBe(true)
    expect(document.body.textContent).toContain('Corrija os erros elétricos')
    clicar('Salvar topologia')
    expect(salvarEtapa).not.toHaveBeenCalled()
  })

  it('11b · aviso não-bloqueante permite salvar', async () => {
    validar.mockResolvedValue({
      ...OK_VALIDACAO,
      warnings: [{ codigo: 'VOC_PROXIMO_LIMITE', severidade: 'alerta', mensagem: 'perto do limite' }],
    })
    await montarComTopologia()
    clicar('Validar arranjo')
    await screen.findAllByText(/perto do limite/)
    expect(screen.getByText('Salvar topologia').disabled).toBe(false)
  })

  it('12 · não salva antes de validar', async () => {
    await montarComTopologia()
    expect(screen.getByText('Salvar topologia').disabled).toBe(true)
  })

  it('13 · editar a topologia invalida o resultado anterior', async () => {
    await montarComTopologia()
    clicar('Validar arranjo')
    await waitFor(() => expect(screen.getByText('Salvar topologia').disabled).toBe(false))
    digitar(1, 1, 1, '13')
    expect(screen.getByText('Salvar topologia').disabled).toBe(true)
  })

  it('14 · erro do servidor é propagado sem reinterpretação', async () => {
    const e = new Error('Parâmetros elétricos inválidos')
    e.codigo = 'INPUT_INVALIDO'
    validar.mockRejectedValue(e)
    await montarComTopologia()
    clicar('Validar arranjo')
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain('INPUT_INVALIDO')
  })
})

describe('FV-UX-026 · persistência e reload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    projetoAtual = PROJETO
    listarCatalogo.mockImplementation((t) =>
      Promise.resolve({ equipamentos: t === 'modulo' ? [MODULO] : [INVERSOR] }))
    validar.mockResolvedValue(OK_VALIDACAO)
    salvarEtapa.mockResolvedValue(undefined)
  })

  it('15 · grava pela etapa `engenharia_eletrica`, no shape do schema', async () => {
    await montar()
    clicar('+ string', 0); digitar(1, 1, 1, '12')
    clicar('+ string', 1); digitar(2, 1, 1, '12')
    clicar('Validar arranjo')
    await waitFor(() => expect(screen.getByText('Salvar topologia').disabled).toBe(false))
    clicar('Salvar topologia')
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())

    expect(salvarEtapa.mock.calls.map(([e]) => e)).toEqual(['engenharia_eletrica'])
    const d = enviado()
    expect(d.arranjo.mppts).toHaveLength(2)
    expect(d.arranjo.mppts[0]).toEqual({
      mppt: 1, strings_paralelo: 1, modulos_por_string: 12, total_modulos: 12,
      entradas: [{ entrada: 1, strings: [{ modulos: 12 }] }],
    })
    expect(d.arranjo.total_modulos).toBe(24)
    expect(d.arranjo.num_mppts_usados).toBe(2)
    // Resumo legado do pior caso — é o que os leitores antigos esperam.
    expect(d.arranjo.quantidade_modulos_por_string).toBe(12)
    expect(d.arranjo.quantidade_strings_paralelo).toBe(1)
  })

  it('16 · MPPT desigual é preservado como desigual', async () => {
    await montar()
    clicar('+ string', 0); digitar(1, 1, 1, '10')
    clicar('+ string', 0); digitar(1, 1, 2, '10')
    clicar('+ string', 1); digitar(2, 1, 1, '4')
    clicar('Validar arranjo')
    await waitFor(() => expect(screen.getByText('Salvar topologia').disabled).toBe(false))
    clicar('Salvar topologia')
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    const m = enviado().arranjo.mppts
    expect(m[0]).toMatchObject({ strings_paralelo: 2, modulos_por_string: 10, total_modulos: 20 })
    expect(m[1]).toMatchObject({ strings_paralelo: 1, modulos_por_string: 4, total_modulos: 4 })
  })

  it('16b · topologia desigual declara o oversizing como pendente', async () => {
    await montar()
    clicar('+ string', 0); digitar(1, 1, 1, '10')
    clicar('+ string', 1); digitar(2, 1, 1, '14')
    expect(document.body.textContent).toContain('oversizing CC/CA do inversor inteiro não é avaliado')
  })

  it('17 · reload traz a topologia persistida', async () => {
    projetoAtual = {
      ...PROJETO,
      engenharia_eletrica: {
        arranjo: {
          num_mppts_usados: 2, total_modulos: 24,
          mppts: [
            { mppt: 1, strings_paralelo: 1, modulos_por_string: 12, total_modulos: 12,
              entradas: [{ entrada: 1, strings: [{ modulos: 12 }] }] },
            { mppt: 2, strings_paralelo: 2, modulos_por_string: 6, total_modulos: 12,
              entradas: [{ entrada: 1, strings: [{ modulos: 6 }, { modulos: 6 }] }] },
          ],
        },
      },
    }
    await montar()
    expect(campo(1, 1, 1).value).toBe('12')
    expect(campo(2, 1, 1).value).toBe('6')
    expect(campo(2, 1, 2).value).toBe('6')
    expect(document.body.textContent).toContain('0 módulo(s)')
  })

  it('17b · registro legado sem `entradas[]` é reconstruído do resumo', async () => {
    projetoAtual = {
      ...PROJETO,
      engenharia_eletrica: {
        arranjo: { num_mppts_usados: 1, mppts: [{ mppt: 1, strings_paralelo: 2, modulos_por_string: 9 }] },
      },
    }
    await montar()
    expect(campo(1, 1, 1).value).toBe('9')
    expect(campo(1, 1, 2).value).toBe('9')
  })

  it('18 · erro ao salvar é propagado', async () => {
    const e = new Error('Projeto congelado')
    e.codigo = 'PROJETO_CONGELADO'
    salvarEtapa.mockRejectedValue(e)
    await montar()
    clicar('+ string', 0); digitar(1, 1, 1, '12')
    clicar('Validar arranjo')
    await waitFor(() => expect(screen.getByText('Salvar topologia').disabled).toBe(false))
    clicar('Salvar topologia')
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain('PROJETO_CONGELADO')
  })

  it('19 · nenhum indicador financeiro é gravado', async () => {
    await montar()
    clicar('+ string', 0); digitar(1, 1, 1, '12')
    clicar('Validar arranjo')
    await waitFor(() => expect(screen.getByText('Salvar topologia').disabled).toBe(false))
    clicar('Salvar topologia')
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    const bruto = JSON.stringify(enviado())
    for (const p of ['payback', 'vpl', 'tir', 'economia', 'custo']) {
      expect(bruto.toLowerCase().includes(p), `gravou \`${p}\``).toBe(false)
    }
  })
})

describe('FV-UX-026 · estados incompletos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validar.mockResolvedValue(OK_VALIDACAO)
    salvarEtapa.mockResolvedValue(undefined)
    listarCatalogo.mockImplementation((t) =>
      Promise.resolve({ equipamentos: t === 'modulo' ? [MODULO] : [INVERSOR] }))
  })

  it('20 · sem equipamentos, a etapa manda voltar', async () => {
    projetoAtual = { ...PROJETO, equipamentos: { paineis: [], inversor: {} } }
    render(<EtapaMppt />)
    await screen.findByText(/Selecione módulo e inversor/)
    expect(screen.queryByText('+ MPPT')).toBeNull()
  })

  it('21 · catálogo sem dados elétricos vira lacuna, não default', async () => {
    listarCatalogo.mockImplementation((t) => Promise.resolve({
      equipamentos: t === 'modulo'
        ? [{ ...MODULO, especificacoes: { potencia_w: 550 } }]
        : [INVERSOR],
    }))
    projetoAtual = PROJETO
    await montar()
    expect(document.body.textContent).toContain('não declara')
    expect(document.body.textContent).toContain('modulo.voc')
    expect(screen.getByText('Validar arranjo').disabled).toBe(true)
  })

  it('22 · sem quantidade do dimensionamento, "não distribuídos" é ausência', async () => {
    projetoAtual = {
      ...PROJETO, dimensionamento: null,
      equipamentos: { ...PROJETO.equipamentos,
        paineis: [{ ...PROJETO.equipamentos.paineis[0], quantidade: null }] },
    }
    await montar()
    expect(document.body.textContent).toContain('quantidade total não informada')
  })
})

describe('FV-UX-026 · nenhum cálculo elétrico no cliente', () => {
  const ler = async (rel) => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    return readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), rel), 'utf8')
  }
  const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('23 · nenhuma fórmula elétrica na etapa nem no modelo', async () => {
    const fontes = semComentarios(await ler('../paginas/etapas/EtapaMppt.jsx'))
      + semComentarios(await ler('../topologia.js'))
    // `@fortesolar/fv-shared` saiu desta lista na FV-UX-028 (A2): a etapa passou
    // a CONSUMIR `calcularTemperaturas` do pacote canônico. Proibir o import
    // proibiria justamente o comportamento correto — o que continua proibido é
    // reescrever fórmula, e é o que as entradas abaixo verificam.
    for (const p of ['Math.pow', 'fatorTermico', 'temperaturaCelula', 'correnteProjeto',
      'coefParaFracao', '1.25', 'voc *', 'vmpp *', 'isc *',
      'oversizing =', 'tensao_max_entrada >', 'TEMPERATURAS_UF', 'tmin:', 'tmax:']) {
      expect(fontes.includes(p), `encontrou \`${p}\``).toBe(false)
    }
  })

  it('23b · A2 — a única importação do pacote é a tabela climática canônica', async () => {
    const fonte = await ler('../paginas/etapas/EtapaMppt.jsx')
    const imports = fonte.split('\n').filter((l) => l.includes('@fortesolar/fv-shared'))
    expect(imports).toHaveLength(1)
    expect(imports[0]).toContain('calcularTemperaturas')
    expect(imports[0]).toContain('engenharia/normativa')
  })

  it('24 · nenhuma distribuição automática — `sugerirMPPTs` não existe aqui', async () => {
    // Sem comentários: a etapa CITA `/api/dimensionamento/strings` justamente
    // para explicar por que não o usa. Citar não é usar.
    const fontes = semComentarios(await ler('../paginas/etapas/EtapaMppt.jsx'))
      + semComentarios(await ler('../topologia.js'))
    for (const p of ['sugerirMPPTs', 'autoConfigurar', 'Math.ceil(numPaineis',
      '/api/dimensionamento/strings', 'montarStrings']) {
      expect(fontes.includes(p), `encontrou \`${p}\``).toBe(false)
    }
  })

  it('25 · nenhum default técnico', async () => {
    const fonte = semComentarios(await ler('../topologia.js'))
      + semComentarios(await ler('../paginas/etapas/EtapaMppt.jsx'))
    for (const p of ['?? 8', '|| 8', '?? 6', '|| 6', '?? 14', '|| 14', '?? 2,', '?? 550']) {
      expect(fonte.includes(p), `encontrou \`${p}\``).toBe(false)
    }
  })

  it('26 · sem HTTP direto e sem cópia do agregado', async () => {
    const fonte = await ler('../paginas/etapas/EtapaMppt.jsx')
    for (const p of ['fetch(', 'apiFetch', 'axios', 'createContext', 'localStorage', 'buscarProjeto']) {
      expect(fonte.includes(p), `encontrou \`${p}\``).toBe(false)
    }
    expect(fonte.includes('acoes.salvarEtapa')).toBe(true)
    expect(fonte.includes('validarCompatibilidadeEletrica')).toBe(true)
  })

  it('27 · a API usa a rota canônica existente', async () => {
    const api = await ler('../api/agregadosFvApi.js')
    expect(api.includes("'/api/engenharia/compatibilidade-eletrica'")).toBe(true)
    expect(api.includes('/api/dimensionamento/strings')).toBe(false)
  })
})
