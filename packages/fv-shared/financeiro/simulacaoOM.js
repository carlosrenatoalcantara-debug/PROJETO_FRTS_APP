/**
 * simulacaoOM.js — simulação financeira com O&M — FV-DOM-011.
 *
 * ── Origem ───────────────────────────────────────────────────────────────────
 * Extraído VERBATIM do corpo de `simularFinanceiro` em
 * `backend/src/controllers/financeiroController.js` (`POST /api/financeiro/simular`,
 * consumido por `pages/SimulacaoFinanceira.jsx`). Fórmulas, defaults, ordem das
 * operações, arredondamentos e nomes de campo vieram intactos — a equivalência é
 * verificada em `financeiroRestante.check.js` contra o `git HEAD`.
 *
 * A TIR que o controller definia era CÓPIA LITERAL da de `fluxo-caixa`
 * (verificada caractere a caractere): agora ele importa a compartilhada.
 *
 * ── Por que fica separado dos motores já consolidados ────────────────────────
 * É o único caminho do sistema que modela:
 *
 *   • O&M — 1 % do investimento ao ano, corrigido pela inflação;
 *   • crescimento de consumo — 2 % a.a.;
 *   • fator de cenário — economia × 0,2 (sem bateria) ou × 1,5 (com bateria).
 *
 * O fator de cenário não tem justificativa no código e faz o mesmo projeto valer
 * payback de 14 ou 3 anos (FV-DOM-010, R13). **Preservado como está** — mexer
 * nele é decisão de negócio, não de arquitetura.
 *
 * Puro: sem I/O, sem Express, sem `req`/`res`.
 */
import { calcularTIR } from './fluxoCaixa.js'

/**
 * Simula o fluxo de caixa com O&M e crescimento de consumo.
 *
 * Recebe valores já numéricos e validados pelo chamador — a validação de
 * `investimento` continua no controller, para preservar o contrato HTTP (400).
 *
 * @returns {{ payback, tir, vpl, economia_total_25anos, fluxo_caixa, tipo_cenario, parametros }}
 */
export function simularFinanceiroComOM({
  inv,
  consumoBase,
  tarifaBase,
  crescimento,
  inflacao,
  taxa,
  tipo_cenario = 'sem_bateria',
  periodos,
}) {
  // ── construir fluxo de caixa com O&M ──────────────────────────────────
  const fluxos = [-inv]
  const fluxoCaixa = []
  let saldoAcumulado = -inv
  let saldoDescontado = -inv
  let paybackSimples = null
  let economiaTotal = 0

  const custoOMAnual = inv * 0.01 // 1% do investimento por ano

  for (let ano = 1; ano <= periodos; ano++) {
    // Crescimento de consumo
    const consumoAno = consumoBase * Math.pow(1 + crescimento, ano - 1)

    // Inflação de tarifa
    const tarifaAno = tarifaBase * Math.pow(1 + inflacao, ano - 1)

    // Economia de energia
    let economia = consumoAno * 12 * tarifaAno

    // Ajuste por tipo de cenário
    if (tipo_cenario === 'com_bateria') {
      economia *= 1.5 // 50% mais economia com bateria
    } else {
      economia *= 0.2 // 20% economia sem bateria
    }

    // Subtrair custos de O&M
    const custoOM = custoOMAnual * Math.pow(1 + inflacao, ano - 1)
    const fluxoLiquido = economia - custoOM

    saldoAcumulado += fluxoLiquido
    economiaTotal += fluxoLiquido

    const vp = fluxoLiquido / Math.pow(1 + taxa, ano)
    saldoDescontado += vp

    if (saldoAcumulado >= 0 && !paybackSimples) {
      paybackSimples = ano
    }

    fluxos.push(fluxoLiquido)
    fluxoCaixa.push({
      ano,
      consumo_kwh: Math.round(consumoAno * 12),
      tarifa: +tarifaAno.toFixed(2),
      economia_bruta: +economia.toFixed(2),
      custo_om: +custoOM.toFixed(2),
      fluxo_liquido: +fluxoLiquido.toFixed(2),
      saldoAcumulado: +saldoAcumulado.toFixed(2),
      valorPresente: +vp.toFixed(2),
      saldoDescontado: +saldoDescontado.toFixed(2),
    })
  }

  const tir = calcularTIR(fluxos)
  const vpl = saldoDescontado

  return {
    payback: paybackSimples ?? `> ${periodos}`,
    tir: +(tir * 100).toFixed(2),
    vpl: +vpl.toFixed(2),
    economia_total_25anos: +economiaTotal.toFixed(2),
    fluxo_caixa: fluxoCaixa,
    tipo_cenario,
    parametros: {
      investimento: inv,
      consumo_kwh_mes: consumoBase,
      tarifa_inicial: tarifaBase,
      crescimento_consumo: +(crescimento * 100).toFixed(2),
      inflacao_energia: +(inflacao * 100).toFixed(2),
      custo_om_anual_pct: 1,
    }
  }
}
