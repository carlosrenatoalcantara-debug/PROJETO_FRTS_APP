const TIMEOUT = 10000

export async function obterIrradianciaLocal(latitude, longitude) {
  if (!latitude || !longitude) {
    return null
  }

  try {
    const url = new URL('https://power.larc.nasa.gov/api/temporal/monthly/point')
    url.searchParams.set('parameters', 'ALLSKY_KT')
    url.searchParams.set('community', 'RE')
    url.searchParams.set('longitude', longitude)
    url.searchParams.set('latitude', latitude)
    url.searchParams.set('start', 202301)
    url.searchParams.set('end', 202312)
    url.searchParams.set('format', 'json')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT)

    const res = await fetch(url.toString(), {
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      console.warn(`NASA POWER API error: ${res.status}`)
      return null
    }

    const dados = await res.json()

    // Extrai clearness index (KT) mensal e calcula HSP médio
    const kt_mensal = dados.properties?.monthly?.ALLSKY_KT
    if (!kt_mensal) {
      console.warn('NASA POWER: sem dados ALLSKY_KT')
      return null
    }

    // Converte KT (clearness index) para irradiância em kWh/m²/dia
    // KT = GHI / (extraterrestre) ≈ 1367 W/m² × cos(zenith)
    // Aproximação: GHI ≈ KT × 5 (para céu limpo)
    const valores = Object.values(kt_mensal)
    const kt_medio = valores.reduce((a, b) => a + b, 0) / valores.length

    // Irradiância diária aproximada em kWh/m²/dia
    // KT típico 0.5 → irradiância 5.0 kWh/m²/dia
    const hsp_dia = kt_medio * 10

    return {
      hsp_dia: parseFloat(hsp_dia.toFixed(2)),
      hsp_anual: parseFloat((hsp_dia * 365).toFixed(2)),
      latitude,
      longitude,
      kt_medio: parseFloat(kt_medio.toFixed(3)),
      data_calculo: new Date().toISOString(),
    }
  } catch (err) {
    console.error('Erro ao consultar NASA POWER:', err.message)
    return null
  }
}

export function calcularGeracaoComIrradiancia(potenciaKWp, hsp, perdas = 0.85) {
  // geracao_mensal = potencia × hsp × 30 × (1 - perdas)
  const geracaoMensal = potenciaKWp * hsp * 30 * perdas
  const geracaoAnual = geracaoMensal * 12

  return {
    mensal: parseFloat(geracaoMensal.toFixed(2)),
    anual: parseFloat(geracaoAnual.toFixed(2)),
  }
}
