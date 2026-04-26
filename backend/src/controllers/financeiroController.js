// ── Cálculo de TIR via bisseção ────────────────────────────────────────────

function calcularTIR(fluxos) {
  let low = -0.99, high = 10.0
  for (let i = 0; i < 300; i++) {
    const mid = (low + high) / 2
    let npv = 0
    for (let t = 0; t < fluxos.length; t++) {
      npv += fluxos[t] / Math.pow(1 + mid, t)
    }
    if (Math.abs(npv) < 0.5) return mid
    npv > 0 ? (low = mid) : (high = mid)
  }
  return (low + high) / 2
}

// ── Simulação financeira avançada ─────────────────────────────────────────

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

    const inv = Number(investimento)
    const consumoBase = Number(consumo_kwh_mes)
    const tarifaBase = Number(tarifa_energia)
    const crescimento = Number(crescimento_consumo_anual)
    const inflacao = Number(inflacao_energia)
    const taxa = Number(taxa_desconto)
    const periodos = Number(anos)

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

    res.json({
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
    })
  } catch (e) {
    res.status(500).json({ erro: e.message })
  }
}
