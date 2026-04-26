import { PAINEIS } from '../data/catalogoPaineis.js'

const MESES_KEYS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MESES_PT   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const DIAS_MES   = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

// ── NASA POWER ────────────────────────────────────────────────────────────────

async function buscarIrradiancia(lat, lon) {
  const url =
    `https://power.larc.nasa.gov/api/temporal/climatology/point` +
    `?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=${lon}&latitude=${lat}&format=JSON`
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'ForteSolar/1.0' },
    signal: AbortSignal.timeout(20000),
  })
  if (!resp.ok) throw new Error(`NASA POWER retornou ${resp.status}`)
  const json = await resp.json()
  return json.properties.parameter.ALLSKY_SFC_SW_DWN
}

// ── Simulação financeira avançada ─────────────────────────────────────────────

function calcularTIR(fluxos) {
  // fluxos[0] = investimento negativo, fluxos[1..n] = entradas
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

function calcularFluxoCaixa({
  custoTotal, economiaAnualBase, inflacaoEnergia = 0.08,
  taxaDesconto = 0.06, degradacaoAnual = 0.005, anos = 25,
}) {
  const fluxos          = [-custoTotal]
  const fluxoAnual      = []
  let saldoAcum         = -custoTotal
  let saldoDescontado   = -custoTotal
  let paybackSimples    = null
  let paybackDescontado = null

  for (let ano = 1; ano <= anos; ano++) {
    const fatorInflacao   = Math.pow(1 + inflacaoEnergia, ano - 1)
    const fatorDegradacao = Math.pow(1 - degradacaoAnual, ano - 1)
    const economia        = economiaAnualBase * fatorInflacao * fatorDegradacao

    saldoAcum += economia
    if (saldoAcum >= 0 && !paybackSimples) paybackSimples = ano

    const vp = economia / Math.pow(1 + taxaDesconto, ano)
    saldoDescontado += vp
    if (saldoDescontado >= 0 && !paybackDescontado) paybackDescontado = ano

    fluxos.push(economia)
    fluxoAnual.push({
      ano,
      economia:          +economia.toFixed(2),
      saldoAcumulado:    +saldoAcum.toFixed(2),
      valorPresente:     +vp.toFixed(2),
      saldoDescontado:   +saldoDescontado.toFixed(2),
    })
  }

  const tir  = calcularTIR(fluxos)
  const vpl  = saldoDescontado
  const roi25= ((fluxos.slice(1).reduce((a, b) => a + b, 0) - custoTotal) / custoTotal) * 100

  return {
    fluxoAnual,
    tir:              +(tir * 100).toFixed(2),
    vpl:              +vpl.toFixed(2),
    paybackSimples:   paybackSimples ?? `> ${anos}`,
    paybackDescontado:paybackDescontado ?? `> ${anos}`,
    roi25Anos:        +roi25.toFixed(1),
    economiaTotal25:  +fluxos.slice(1).reduce((a, b) => a + b, 0).toFixed(2),
  }
}

// ── calcularFV principal ──────────────────────────────────────────────────────

export async function calcularFV(req, res) {
  try {
    const {
      consumoMensal, lat, lon, areaDisponivel,
      tipoSistema     = 'string',
      potenciaPainelW = 550,
      tarifaEnergia   = 0.95,
      inflacaoEnergia = 0.08,
      taxaDesconto    = 0.06,
    } = req.body

    if (!consumoMensal || Number(consumoMensal) <= 0)
      return res.status(400).json({ erro: 'Consumo mensal inválido.' })
    if (lat == null || lon == null || isNaN(Number(lat)) || isNaN(Number(lon)))
      return res.status(400).json({ erro: 'Coordenadas (lat/lon) inválidas.' })

    const kwh    = Number(consumoMensal)
    const pw     = Number(potenciaPainelW)
    const tarifa = Number(tarifaEnergia)
    const area   = areaDisponivel ? Number(areaDisponivel) : null

    // NASA POWER
    const rawIrrad   = await buscarIrradiancia(Number(lat), Number(lon))
    const irradMes   = MESES_KEYS.map(k => rawIrrad[k])
    const irradMedia = irradMes.reduce((a, b) => a + b, 0) / 12

    // Dimensionamento
    const PERDAS        = tipoSistema === 'micro' ? 0.14 : 0.20
    const energiaDiaria = kwh / 30
    const energiaNec    = energiaDiaria / (1 - PERDAS)
    const potKwp        = energiaNec / irradMedia
    const numPaineis    = Math.ceil(potKwp * 1000 / pw)
    const potReal       = (numPaineis * pw) / 1000

    const potInvKw  = tipoSistema === 'micro' ? pw / 1000 : 5
    const numInv    = Math.ceil(potReal / potInvKw)

    // Geração mensal
    const geracaoMes = irradMes.map((irrad, i) =>
      +(potReal * irrad * DIAS_MES[i] * (1 - PERDAS)).toFixed(1)
    )
    const geracaoMediaMensal = +(geracaoMes.reduce((a, b) => a + b, 0) / 12).toFixed(0)
    const geracaoAnual       = +(geracaoMes.reduce((a, b) => a + b, 0)).toFixed(0)
    const pctAtendimento     = Math.min(100, Math.round((geracaoMediaMensal / kwh) * 100))

    // Custo estimado
    const painel         = PAINEIS.find(p => p.pmpp === pw) ?? PAINEIS[0]
    const precoPainel    = painel?.precoUnitario ?? (pw >= 600 ? 980 : pw >= 550 ? 890 : pw >= 450 ? 750 : 660)
    const precoInversor  = tipoSistema === 'micro' ? numPaineis * 850 : numInv * (2500 + potInvKw * 350)
    const instalacao     = potReal * 1500
    const custoTotal     = Math.round(numPaineis * precoPainel + precoInversor + instalacao)

    const economiaAnual  = +(geracaoAnual * tarifa).toFixed(2)
    const economiaMensal = +(economiaAnual / 12).toFixed(2)

    // Área
    const areaNecessaria = +(numPaineis * 2.0).toFixed(1)
    const alertaArea     = area != null ? areaNecessaria > area : false

    // Financeiro avançado
    const financeiro = calcularFluxoCaixa({
      custoTotal,
      economiaAnualBase: economiaAnual,
      inflacaoEnergia:   Number(inflacaoEnergia),
      taxaDesconto:      Number(taxaDesconto),
    })

    res.json({
      entrada: { consumoMensal: kwh, lat: Number(lat), lon: Number(lon), areaDisponivel: area, tipoSistema, potenciaPainelW: pw, tarifaEnergia: tarifa, inflacaoEnergia, taxaDesconto },
      irradiancia: {
        mediaAnual: +irradMedia.toFixed(2),
        mensal: MESES_PT.map((mes, i) => ({ mes, valor: +irradMes[i].toFixed(2) })),
      },
      sistema: {
        potenciaKwp:           +potKwp.toFixed(2),
        potenciaRealKwp:       +potReal.toFixed(2),
        numPaineis,
        numInversores:         numInv,
        tipoInversor:          tipoSistema === 'micro' ? 'Microinversor' : 'Inversor String',
        perdasSistema:         `${(PERDAS * 100).toFixed(0)}%`,
        areaNecessaria,
        alertaArea,
        percentualAtendimento: pctAtendimento,
      },
      geracao: {
        geracaoMediaMensal,
        geracaoAnual,
        mensal: MESES_PT.map((mes, i) => ({
          mes, gerado: geracaoMes[i], consumo: kwh,
        })),
      },
      financeiro: {
        custoTotalEstimado: custoTotal,
        economiaMensal,
        economiaAnual,
        paybackAnos:        financeiro.paybackSimples,
        paybackDescontado:  financeiro.paybackDescontado,
        tir:                financeiro.tir,
        vpl:                financeiro.vpl,
        roi25Anos:          financeiro.roi25Anos,
        economiaTotal25:    financeiro.economiaTotal25,
        tarifaEnergia:      tarifa,
        inflacaoEnergia,
        taxaDesconto,
        fluxoAnual:         financeiro.fluxoAnual,
      },
    })
  } catch (e) {
    const ehNasa = e.message?.toLowerCase().includes('nasa')
    res.status(ehNasa ? 503 : 500).json({
      erro:    e.message ?? 'Erro interno ao calcular',
      detalhe: ehNasa ? 'NASA POWER indisponível. Tente novamente em instantes.' : undefined,
    })
  }
}
