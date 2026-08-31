import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

/**
 * FV-UX-017 — a etapa Financeiro é CLIENTE do contrato V1.
 *
 * O que estes testes protegem: a tela não pode desenvolver uma segunda verdade
 * financeira. A FV-DOM-008 mediu oito motores divergindo — payback de 2,2 a 14
 * anos para o mesmo projeto — e a causa em todos foi a mesma: cada superfície
 * calculando por conta própria.
 */

const calcularFinanceiroMock = vi.fn()
vi.mock('../api/agregadosFvApi', () => ({
  calcularFinanceiro: (...a) => calcularFinanceiroMock(...a),
}))

vi.mock('../providers/ProjetoProvider', () => ({
  useProjeto: () => ({ projetoId: 'p1', projeto: { _id: 'p1' } }),
}))

import { FinanceiroProvider } from '../providers/FinanceiroProvider'
import EtapaFinanceiro from '../paginas/etapas/EtapaFinanceiro'

/** Resposta canônica completa — projeto saudável. */
const RESPOSTA = {
  projeto: { _id: 'p1' },
  financeiro: {
    contrato_versao: '1.0.0',
    premissas_versao: 'v1-2026-08',
    calculado_em: '2026-08-16T12:00:00.000Z',
    premissas: {
      versao: 'v1-2026-08',
      horizonte_anos: 25,
      degradacao_aa_pct: 0.5,
      taxa_desconto_aa_pct: 10,
      natureza_taxa: 'nominal',
      convencao_payback: 'fracionario',
      inflacao_energia_aa_pct: 8,
      reajuste_tarifa_aa_pct: null,
      tarifa_kwh: 0.98,
    },
    entradas: { investimento_r: 80000, geracao_anual_kwh: 18000, potencia_wp: 14300, consumo_anual_kwh: 16000 },
    fluxo_caixa: [
      { ano: 1, economia_r: 17640, valor_presente_r: 16036.36 },
      { ano: 2, economia_r: 18956.61, valor_presente_r: 15666.62 },
    ],
    payback: { anos: 4.05, convencao: 'fracionario', dentro_horizonte: true, anos_inteiro: 5 },
    payback_descontado: { anos: 5.24, dentro_horizonte: true },
    vpl: { valor_r: 227213.92, taxa_aa_pct: 10 },
    tir: { valor_aa_pct: 29.29, convergiu: true, motivo: 'ok', intervalo_busca: [-0.95, 2] },
    economia: { anual_1ano_r: 17640, horizonte_r: 1192204.71, roi_pct: 1390.26 },
    regulatorio: { aplicavel: false, motivo: 'D5_PENDENTE', cenario_oficial: null },
    proveniencia: { investimento_r: 'orcamento.total_r', inflacao_energia_aa_pct: 'projeto.premissas_financeiras' },
    lacunas: [],
  },
}

const montar = () => render(
  <FinanceiroProvider>
    <EtapaFinanceiro />
  </FinanceiroProvider>,
)

describe('FV-UX-017 · Financeiro na nova UX', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    calcularFinanceiroMock.mockResolvedValue(RESPOSTA)
  })

  it('1 · chama somente o endpoint canônico, com o id do projeto', async () => {
    montar()
    await waitFor(() => expect(calcularFinanceiroMock).toHaveBeenCalledWith('p1'))
    expect(calcularFinanceiroMock).toHaveBeenCalledTimes(1)
  })

  it('3 · payback exibido é o recebido — fracionário oficial + inteiro secundário', async () => {
    montar()
    await screen.findByText('4.05 anos')
    expect(screen.getByText(/5º ano/)).toBeTruthy()
    expect(screen.getByText(/convenção fracionario/)).toBeTruthy()
  })

  it('4 · VPL exibido é o recebido, com a TMA declarada', async () => {
    montar()
    await screen.findByText(/227\.214|227\.213/)
    expect(screen.getByText(/TMA 10% a\.a\. nominal/)).toBeTruthy()
  })

  it('5 · TIR só aparece quando convergiu', async () => {
    montar()
    await screen.findByText('29.29% a.a.')
  })

  it('5b · TIR que NÃO convergiu vira "—" com o motivo do servidor', async () => {
    calcularFinanceiroMock.mockResolvedValue({
      ...RESPOSTA,
      financeiro: {
        ...RESPOSTA.financeiro,
        tir: { valor_aa_pct: null, convergiu: false, motivo: 'fora_do_intervalo', intervalo_busca: [-0.95, 2] },
      },
    })
    montar()
    await screen.findByText(/não convergiu: fora_do_intervalo/)
    expect(document.body.textContent).not.toContain('29.29')
  })

  it('5c · valor saturado NÃO é apresentado como resultado', async () => {
    // O motor do backend pode devolver o teto da busca com convergiu:false.
    // A tela não pode exibi-lo como se fosse a TIR.
    calcularFinanceiroMock.mockResolvedValue({
      ...RESPOSTA,
      financeiro: {
        ...RESPOSTA.financeiro,
        tir: { valor_aa_pct: 1000, convergiu: false, motivo: 'fora_do_intervalo', intervalo_busca: [-0.99, 10] },
      },
    })
    montar()
    await screen.findByText(/não convergiu/)
    expect(document.body.textContent).not.toContain('1000% a.a.')
  })

  it('6 · inflação ausente vira lacuna nomeada, e os dependentes ficam "—"', async () => {
    calcularFinanceiroMock.mockResolvedValue({
      ...RESPOSTA,
      financeiro: {
        ...RESPOSTA.financeiro,
        premissas: { ...RESPOSTA.financeiro.premissas, inflacao_energia_aa_pct: null },
        payback: { anos: null, convencao: 'fracionario', dentro_horizonte: false, anos_inteiro: null },
        payback_descontado: null,
        vpl: null,
        tir: { valor_aa_pct: null, convergiu: false, motivo: 'entradas_ausentes', intervalo_busca: null },
        economia: null,
        lacunas: ['inflacao_energia_aa_pct'],
      },
    })
    montar()
    await screen.findByText(/1 dado\(s\) ausente\(s\)/)
    // O rótulo aparece DUAS vezes de propósito: na lista de lacunas e na tabela
    // de premissas. As duas leituras importam ao usuário.
    expect(screen.getAllByText('Inflação energética').length).toBe(2)
    expect(document.body.textContent).toContain('Nenhum valor foi assumido')
    expect(screen.getByText('não informada')).toBeTruthy()
  })

  it('7 · zero explícito permanece zero — não vira "—" nem lacuna', async () => {
    calcularFinanceiroMock.mockResolvedValue({
      ...RESPOSTA,
      financeiro: {
        ...RESPOSTA.financeiro,
        premissas: { ...RESPOSTA.financeiro.premissas, inflacao_energia_aa_pct: 0 },
        economia: { anual_1ano_r: 0, horizonte_r: 0, roi_pct: 0 },
        lacunas: [],
      },
    })
    montar()
    await screen.findByText('0% a.a.')
    expect(document.body.textContent).not.toContain('dado(s) ausente(s)')
    expect(screen.getByText('0%')).toBeTruthy()   // ROI zero exibido como zero
  })

  it('9 · TMA exibida é 10 % nominal', async () => {
    montar()
    await screen.findByText('10% a.a. nominal')
  })

  it('10 · versões e proveniência preservadas', async () => {
    montar()
    await screen.findByText(/Contrato 1\.0\.0 · premissas v1-2026-08/)
    fireEvent.click(screen.getByText(/de onde veio cada dado/))
    expect(screen.getByText('orcamento.total_r')).toBeTruthy()
  })

  it('11 · erro do servidor é propagado sem reinterpretação', async () => {
    const e = new Error('Projeto não encontrado')
    e.codigo = 'PROJETO_INEXISTENTE'
    calcularFinanceiroMock.mockRejectedValue(e)
    montar()
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain('Projeto não encontrado')
    expect(alerta.textContent).toContain('PROJETO_INEXISTENTE')
  })

  it('· declara que o resultado é do estado atual, não congelado', async () => {
    montar()
    await screen.findByText('4.05 anos')
    expect(document.body.textContent).toContain('estado atual')
    expect(document.body.textContent).toContain('baseline contratual é outro fato')
  })

  it('· D5 pendente é declarada, não interpretada', async () => {
    montar()
    await screen.findByText(/D5_PENDENTE/)
  })
})

describe('FV-UX-017 · nenhum cálculo financeiro no cliente', () => {
  it('2 · fonte da tela e do provider não contêm fórmula financeira', async () => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const aqui = path.dirname(fileURLToPath(import.meta.url))

    const fontes = [
      readFileSync(path.resolve(aqui, '../paginas/etapas/EtapaFinanceiro.jsx'), 'utf8'),
      readFileSync(path.resolve(aqui, '../providers/FinanceiroProvider.jsx'), 'utf8'),
    ].join('\n')

    // Operadores de capitalização e derivação — nenhum cabe numa tela que só
    // apresenta. `fluxoCaixa` NÃO entra aqui: é o nome da variável que recebe a
    // série pronta do servidor, não o motor homônimo.
    for (const proibido of [
      'Math.pow', 'Math.ceil', 'Math.floor', 'Math.sqrt',
      'calcularRetorno', 'calcularTIR(', 'calcularVPL', 'calcularPayback',
      'calcularFinanceiroCompleto', 'calcularContratoV1',
      // Importar qualquer motor do pacote seria uma segunda verdade.
      "@fortesolar/fv-shared/financeiro",
      'financeiroEngine', 'regulatorioBR', 'dimensionamentoRetorno',
      'taxa_desconto_aa_pct / 100', '/ 100)', '* 12', '/ 12',
    ]) {
      expect(fontes.includes(proibido), `encontrou \`${proibido}\``).toBe(false)
    }
  })

  it('8 · nenhum fallback financeiro artificial', async () => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const aqui = path.dirname(fileURLToPath(import.meta.url))
    const fontes = [
      readFileSync(path.resolve(aqui, '../paginas/etapas/EtapaFinanceiro.jsx'), 'utf8'),
      readFileSync(path.resolve(aqui, '../providers/FinanceiroProvider.jsx'), 'utf8'),
    ].join('\n')

    // Nenhum `?? <número>` nem `|| <número>` sobre indicador financeiro.
    expect(/\?\?\s*\d/.test(fontes), 'encontrou `?? <número>`').toBe(false)
    expect(/\|\|\s*\d/.test(fontes), 'encontrou `|| <número>`').toBe(false)
  })
})
