import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * FV-UX-018 — informar a inflação energética na Cotação.
 *
 * A distinção que estes testes protegem é a de D3: **vazio não é zero**.
 * Campo em branco significa "não informada" e produz lacuna no contrato; `0`
 * digitado é uma premissa legítima que precisa chegar ao servidor como zero.
 * Confundir os dois foi o defeito que a FV-DOM-011B removeu de 18 lugares.
 */

const criarMock = vi.fn()
vi.mock('../providers/CotacoesProvider', () => ({
  useCotacoes: () => ({ acoes: { criar: criarMock } }),
}))

import FormNovaCotacao from '../componentes/FormNovaCotacao'

const abrir = () => {
  render(<FormNovaCotacao />)
  fireEvent.click(screen.getByText('Nova cotação'))
}
const campoInflacao = () => screen.getByLabelText(/Inflação energética/i, { selector: 'input' })
  ?? document.querySelector('input[type=number]')

/** Preenche a inflação e envia; devolve as premissas enviadas. */
async function enviarCom(valor) {
  abrir()
  const inputs = document.querySelectorAll('input[type=number]')
  const alvo = inputs[inputs.length - 1]   // inflação é o último numérico
  if (valor !== null) fireEvent.change(alvo, { target: { value: valor } })
  fireEvent.click(screen.getByText('Criar cotação'))
  await waitFor(() => expect(criarMock).toHaveBeenCalled())
  return criarMock.mock.calls[0][0].premissas
}

describe('FV-UX-018 · inflação energética na Cotação', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    criarMock.mockResolvedValue({ cotacao: { _id: 'c1' } })
  })

  it('1 · campo vazio NÃO envia zero — envia ausência', async () => {
    const premissas = await enviarCom(null)
    expect(premissas.inflacao_energia_aa_pct).toBeUndefined()
    expect(premissas.inflacao_energia_aa_pct).not.toBe(0)
  })

  it('2 · zero digitado é preservado como zero', async () => {
    const premissas = await enviarCom('0')
    expect(premissas.inflacao_energia_aa_pct).toBe(0)
  })

  it('3 · seis é enviado como 6', async () => {
    const premissas = await enviarCom('6')
    expect(premissas.inflacao_energia_aa_pct).toBe(6)
  })

  it('3b · decimal preservado', async () => {
    const premissas = await enviarCom('6.5')
    expect(premissas.inflacao_energia_aa_pct).toBe(6.5)
  })

  it('· o campo traz a ajuda pedida', () => {
    abrir()
    expect(document.body.textContent).toContain(
      'Inflação energética anual considerada neste cenário. Informe 0% se não considerar reajuste.',
    )
  })

  it('· nenhum valor é sugerido — o campo nasce vazio', () => {
    abrir()
    const inputs = [...document.querySelectorAll('input[type=number]')]
    expect(inputs[inputs.length - 1].value).toBe('')
  })
})

describe('FV-UX-018 · sem cálculo, sem default, sem consulta externa', () => {
  const ler = async (rel) => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    return readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), rel), 'utf8')
  }

  it('5 · nenhuma fórmula financeira no formulário nem na etapa', async () => {
    const fontes = [
      await ler('../componentes/FormNovaCotacao.jsx'),
      await ler('../paginas/etapas/EtapaCotacao.jsx'),
    ].join('\n')
    for (const proibido of [
      'Math.pow', 'calcularRetorno', 'calcularTIR', 'calcularVPL',
      '@fortesolar/fv-shared/financeiro', 'financeiroEngine',
    ]) {
      expect(fontes.includes(proibido), `encontrou \`${proibido}\``).toBe(false)
    }
  })

  it('6 · nenhum default de inflação', async () => {
    const form = await ler('../componentes/FormNovaCotacao.jsx')
    for (const p of ['?? 6', '|| 6', '?? 8', '|| 8', "useState('6')", "useState('8')"]) {
      expect(form.includes(p), `encontrou \`${p}\``).toBe(false)
    }
    // O estado inicial é string vazia — nunca um número.
    expect(/const \[inflacao, setInflacao\] = useState\(''\)/.test(form)).toBe(true)
  })

  it('7 · nenhuma consulta externa (ANEEL ou outra)', async () => {
    const form = await ler('../componentes/FormNovaCotacao.jsx')
    for (const p of ['fetch(', 'aneel', 'ANEEL', 'axios', 'IPCA', 'ipca']) {
      expect(form.includes(p), `encontrou \`${p}\``).toBe(false)
    }
  })

  it('8 · a Cotação continua sendo a fonte — premissa vai dentro de `premissas`', async () => {
    const form = await ler('../componentes/FormNovaCotacao.jsx')
    const i = form.indexOf('premissas: {')
    const bloco = form.slice(i, form.indexOf('}', form.indexOf('inflacao_energia_aa_pct', i)))
    expect(bloco.includes('inflacao_energia_aa_pct: num(inflacao)')).toBe(true)
  })

  it('4 · valor persistido reaparece na listagem — inclusive 0 %', async () => {
    const etapa = await ler('../paginas/etapas/EtapaCotacao.jsx')
    expect(etapa.includes('p.inflacao_energia_aa_pct != null')).toBe(true)
    // O filtro precisa comparar com null: `.filter(([, v]) => v)` descartaria
    // a linha quando o texto fosse gerado a partir de 0.
    expect(etapa.includes('.filter(([, v]) => v != null)')).toBe(true)
  })
})
