import { calcularFluxoCaixa } from '@fortesolar/fv-shared/financeiro/fluxo-caixa'
import { PAINEIS } from '../data/catalogoPaineis.js'
import { analisarCompatibilidade } from '../services/compatibilidadeEletricaService.js'
import { otimizarArranjoFV } from '../services/optimizerArranjoFVService.js'

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
//
// FV-DOM-009: `calcularTIR` e `calcularFluxoCaixa` foram extraídas VERBATIM para
// @fortesolar/fv-shared/financeiro/fluxo-caixa. Nenhuma fórmula, default ou nome
// de campo mudou — o motor apenas deixou de ser anônimo dentro deste controller,
// e `projetoController` parou de manter uma cópia literal da TIR.

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

// ── S2.11.1 — Motor de compatibilidade elétrica (read-only, sem efeitos colaterais) ──

/**
 * POST /api/engenharia/compatibilidade-eletrica
 *
 * Executa a análise de compatibilidade elétrica FV usando o motor puro
 * `compatibilidadeEletricaService`. Zero persistência, zero side-effects.
 *
 * Body esperado:
 *   dados_eletricos_modulo    — parâmetros elétricos do módulo FV
 *   dados_eletricos_inversor  — parâmetros elétricos do inversor
 *   arranjo_proposto          — quantidade módulos/string e strings paralelo
 *   dados_climaticos_regiao   — Tmin/Tmax históricos (opcional — fallback automático)
 *
 * Erros de validação → 400
 * Erros internos     → 500
 */
export async function analisarCompatibilidadeEletrica(req, res) {
  try {
    const {
      dados_eletricos_modulo,
      dados_eletricos_inversor,
      arranjo_proposto,
      dados_climaticos_regiao,
    } = req.body

    // Validação mínima de presença dos objetos obrigatórios
    if (!dados_eletricos_modulo || typeof dados_eletricos_modulo !== 'object') {
      return res.status(400).json({ erro: 'dados_eletricos_modulo é obrigatório e deve ser um objeto.' })
    }
    if (!dados_eletricos_inversor || typeof dados_eletricos_inversor !== 'object') {
      return res.status(400).json({ erro: 'dados_eletricos_inversor é obrigatório e deve ser um objeto.' })
    }
    if (!arranjo_proposto || typeof arranjo_proposto !== 'object') {
      return res.status(400).json({ erro: 'arranjo_proposto é obrigatório e deve ser um objeto.' })
    }

    // Motor puro — sem I/O, sem banco, determinístico
    const resultado = analisarCompatibilidade({
      dados_eletricos_modulo,
      dados_eletricos_inversor,
      arranjo_proposto,
      dados_climaticos_regiao: dados_climaticos_regiao ?? null,
    })

    // Sempre 200 — mesmo quando compativel=false (é resultado, não erro HTTP)
    return res.status(200).json(resultado)

  } catch (err) {
    console.error('[compatibilidade-eletrica] Erro interno:', err.message)
    return res.status(500).json({
      erro:    'Erro interno ao processar compatibilidade elétrica.',
      detalhe: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    })
  }
}

// ── S2.12 — Optimizer determinístico de arranjo FV (read-only, Grid Search) ──

/**
 * POST /api/engenharia/optimizer-arranjo
 *
 * Executa o Grid Search determinístico para encontrar o melhor par
 * (módulos_por_string × strings_paralelo). 100% read-only — zero persistência,
 * zero LLM, zero side-effects.
 *
 * Body esperado:
 *   dados_eletricos_modulo    — parâmetros elétricos do módulo FV (obrigatório)
 *   dados_eletricos_inversor  — parâmetros elétricos do inversor  (obrigatório)
 *   dados_climaticos_regiao   — Tmin/Tmax históricos (opcional — fallback automático)
 *   restricoes                — limites do grid (opcional — defaults aplicados)
 *
 * Saída: { melhor_configuracao, configuracoes_validas[10], configuracoes_descartadas, resumo_estatistico }
 */
export async function otimizarArranjoHandler(req, res) {
  try {
    const {
      dados_eletricos_modulo,
      dados_eletricos_inversor,
      dados_climaticos_regiao,
      restricoes,
    } = req.body

    // Validação mínima de presença dos objetos obrigatórios
    if (!dados_eletricos_modulo || typeof dados_eletricos_modulo !== 'object') {
      return res.status(400).json({ erro: 'dados_eletricos_modulo é obrigatório e deve ser um objeto.' })
    }
    if (!dados_eletricos_inversor || typeof dados_eletricos_inversor !== 'object') {
      return res.status(400).json({ erro: 'dados_eletricos_inversor é obrigatório e deve ser um objeto.' })
    }

    // Serviço puro — determinístico, sem I/O, sem banco
    const resultado = otimizarArranjoFV({
      dados_eletricos_modulo,
      dados_eletricos_inversor,
      dados_climaticos_regiao: dados_climaticos_regiao ?? null,
      restricoes:              restricoes ?? {},
    })

    console.log(
      `[optimizer-arranjo] ${resultado.resumo_estatistico.total_testadas} combinações ` +
      `testadas em ${resultado.resumo_estatistico.tempo_execucao_ms}ms — ` +
      `${resultado.resumo_estatistico.total_validas} válidas`
    )

    // Sempre 200 — resultado vazio também é resultado válido
    return res.status(200).json(resultado)

  } catch (err) {
    console.error('[optimizer-arranjo] Erro interno:', err.message)
    return res.status(500).json({
      erro:    'Erro interno ao executar optimizer de arranjo FV.',
      detalhe: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    })
  }
}
