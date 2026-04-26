export function dimensionarBESS(req, res) {
  try {
    const {
      carga_kw,
      horas_backup,
      consumo_mensal_kwh = 1000,
      tarifa_energia = 0.95,
      modo = 'economia',
      inflacao_energia = 0.08,
      anos_simulacao = 25
    } = req.body

    if (!carga_kw || Number(carga_kw) <= 0)
      return res.status(400).json({ erro: 'Campo "carga_kw" obrigatório e deve ser > 0.' })

    if (!horas_backup || Number(horas_backup) <= 0)
      return res.status(400).json({ erro: 'Campo "horas_backup" obrigatório e deve ser > 0.' })

    const cargaKW = Number(carga_kw)
    const horasBackup = Number(horas_backup)
    const consumoMensalKWh = Number(consumo_mensal_kwh)
    const tarifaEnergia = Number(tarifa_energia)
    const inflacaoEnergia = Number(inflacao_energia)
    const anosSimulacao = Number(anos_simulacao)

    // Capacidade e especificações da bateria
    const capacidadeKWh = +((cargaKW * horasBackup) / 0.8).toFixed(2)
    const potenciaKW = +cargaKW.toFixed(2)
    const autonomiaHoras = +horasBackup.toFixed(1)

    // Custos estimados
    const custoBateriaKWh = modo === 'backup' ? 1500 : 1200 // R$ por kWh
    const custoInverssorKWh = 600 // R$ por kW
    const custoBPS = 2000 // Battery Protecting System

    const investimentoBateria = Math.round(capacidadeKWh * custoBateriaKWh)
    const investimentoInversor = Math.round(potenciaKW * custoInverssorKWh)
    const investimentoTotal = investimentoBateria + investimentoInversor + custoBPS

    // Economia anual sem bateria
    const economiaAnualSemBateria = Math.round(consumoMensalKWh * 12 * tarifaEnergia * 0.2)

    // Economia anual com bateria (30% de redução + economia de demanda)
    const economiaAnualComBateria = Math.round(consumoMensalKWh * 12 * tarifaEnergia * 0.4)

    // Payback
    const paybackSemBateria = economiaAnualSemBateria > 0 ? Math.round(0 / economiaAnualSemBateria) : 0
    const paybackComBateria = economiaAnualComBateria > 0 ? Math.round(investimentoTotal / economiaAnualComBateria) : 999

    // Fluxo de caixa ao longo de 25 anos
    const fluxoCaixaSemBateria = []
    const fluxoCaixaComBateria = []

    for (let ano = 0; ano <= anosSimulacao; ano++) {
      const tarifaInflacionada = tarifaEnergia * Math.pow(1 + inflacaoEnergia, ano)
      const economiaAnoSemBateria = consumoMensalKWh * 12 * tarifaInflacionada * 0.2
      const economiaAnoComBateria = consumoMensalKWh * 12 * tarifaInflacionada * 0.4

      const saldoSemBateria = ano === 0 ? 0 : (fluxoCaixaSemBateria[ano - 1]?.saldo || 0) + economiaAnoSemBateria
      const saldoComBateria = ano === 0 ? -investimentoTotal : (fluxoCaixaComBateria[ano - 1]?.saldo || -investimentoTotal) + economiaAnoComBateria

      fluxoCaixaSemBateria.push({ ano, economia: Math.round(economiaAnoSemBateria), saldo: Math.round(saldoSemBateria) })
      fluxoCaixaComBateria.push({ ano, economia: Math.round(economiaAnoComBateria), saldo: Math.round(saldoComBateria) })
    }

    // Comparação
    const diferencaInvestimento = investimentoTotal
    const diferencaPayback = paybackComBateria - paybackSemBateria
    const saldoFinal25AnosSemBateria = fluxoCaixaSemBateria[25]?.saldo || 0
    const saldoFinal25AnosComBateria = fluxoCaixaComBateria[25]?.saldo || 0
    const diferencaSaldo25Anos = saldoFinal25AnosComBateria - saldoFinal25AnosSemBateria

    let recomendacao = 'Bateria não é rentável no cenário atual'
    let recomendacaoCor = 'vermelha'

    if (paybackComBateria < 10) {
      recomendacao = 'Bateria altamente recomendada! Payback rápido.'
      recomendacaoCor = 'verde'
    } else if (paybackComBateria < 15) {
      recomendacao = 'Bateria é uma boa opção com retorno moderado.'
      recomendacaoCor = 'amarela'
    } else if (diferencaSaldo25Anos > 0) {
      recomendacao = 'Bateria vale a pena no longo prazo.'
      recomendacaoCor = 'verde'
    }

    res.json({
      cenario_sem_bateria: {
        investimento: 0,
        payback: 0,
        economia_anual: economiaAnualSemBateria,
        fluxo_caixa_25_anos: saldoFinal25AnosSemBateria
      },
      cenario_com_bateria: {
        investimento: investimentoTotal,
        capacidade_kwh: capacidadeKWh,
        autonomia: autonomiaHoras,
        payback: paybackComBateria,
        economia_anual: economiaAnualComBateria,
        fluxo_caixa_25_anos: saldoFinal25AnosComBateria
      },
      comparacao: {
        diferenca_investimento: diferencaInvestimento,
        diferenca_payback: diferencaPayback,
        diferenca_economia_anual: economiaAnualComBateria - economiaAnualSemBateria,
        diferenca_saldo_25_anos: diferencaSaldo25Anos,
        recomendacao,
        recomendacao_cor: recomendacaoCor
      },
      fluxo_caixa: {
        sem_bateria: fluxoCaixaSemBateria,
        com_bateria: fluxoCaixaComBateria
      },
      modo
    })
  } catch (e) {
    res.status(500).json({ erro: e.message })
  }
}
