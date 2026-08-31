// ── Simulação financeira avançada ─────────────────────────────────────────
//
// FV-DOM-011: o motor foi extraído VERBATIM para
// @fortesolar/fv-shared/financeiro/simulacao-om, e a `calcularTIR` local — que
// era CÓPIA LITERAL da de fluxo-caixa — deixou de existir.
//
// Este controller virou adapter fino: lê o corpo, valida, delega e responde. O
// contrato HTTP (defaults do body, 400 e 500) está preservado exatamente.
import { simularFinanceiroComOM } from '@fortesolar/fv-shared/financeiro/simulacao-om'

export function simularFinanceiro(req, res) {
  try {
    const {
      investimento,
      consumo_kwh_mes = 1000,
      tarifa_energia = 0.95,
      crescimento_consumo_anual = 0.02,
      inflacao_energia = 0.08,
      taxa_desconto = 0.10,
      tipo_cenario = 'sem_bateria',
      anos = 25,
    } = req.body

    if (!investimento || Number(investimento) <= 0)
      return res.status(400).json({ erro: 'Campo "investimento" obrigatório e deve ser > 0.' })

    res.json(simularFinanceiroComOM({
      inv: Number(investimento),
      consumoBase: Number(consumo_kwh_mes),
      tarifaBase: Number(tarifa_energia),
      crescimento: Number(crescimento_consumo_anual),
      inflacao: Number(inflacao_energia),
      taxa: Number(taxa_desconto),
      tipo_cenario,
      periodos: Number(anos),
    }))
  } catch (e) {
    res.status(500).json({ erro: e.message })
  }
}
