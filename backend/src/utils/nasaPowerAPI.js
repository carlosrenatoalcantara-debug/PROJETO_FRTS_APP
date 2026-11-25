/**
 * Irradiância do local via NASA POWER.
 *
 * 2026-11-24 — correção: a versão anterior pedia `ALLSKY_KT` no endpoint
 * mensal com `start=202301` (a API exige ano, `2023`, e devolvia 422), lia
 * `properties.monthly` (a chave real é `properties.parameter`) e convertia o
 * índice de claridade em HSP com `KT × 10`, que não é física. Resultado: toda
 * consulta caía no fallback do servidor.
 *
 * Agora: climatologia de longo prazo de `ALLSKY_SFC_SW_DWN` — irradiação
 * global horizontal em kWh/m²·dia, que é numericamente o HSP. É o mesmo
 * parâmetro que `engenhariaController` já usa.
 */
const TIMEOUT = 10000
const URL_CLIMATOLOGIA = 'https://power.larc.nasa.gov/api/temporal/climatology/point'
const MESES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const DIAS_NO_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
// Faixa física plausível de GHI média diária na Terra; fora disso é dado ruim.
const HSP_MIN = 0.5
const HSP_MAX = 9

const valido = (v) => typeof v === 'number' && Number.isFinite(v) && v >= HSP_MIN && v <= HSP_MAX

/**
 * Extrai HSP de uma resposta da climatologia. Puro — exportado para teste.
 * Devolve null quando a resposta não traz os 12 meses válidos.
 */
export function hspDaClimatologia(json) {
  const serie = json?.properties?.parameter?.ALLSKY_SFC_SW_DWN
  if (!serie) return null
  const mensal = MESES.map((m) => serie[m])
  if (!mensal.every(valido)) return null

  const anualKwhM2 = mensal.reduce((soma, v, i) => soma + v * DIAS_NO_MES[i], 0)
  const hspDia = valido(serie.ANN) ? serie.ANN : anualKwhM2 / 365
  return {
    hsp_dia: +hspDia.toFixed(2),
    hsp_anual: +anualKwhM2.toFixed(2),
    hsp_mensal: Object.fromEntries(MESES.map((m, i) => [m, +mensal[i].toFixed(2)])),
  }
}

export async function obterIrradianciaLocal(latitude, longitude) {
  const lat = Number(latitude)
  const lon = Number(longitude)
  // `!latitude` rejeitava a coordenada 0; aqui só se rejeita o que não é número.
  if (latitude == null || longitude == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT)
  try {
    const url = new URL(URL_CLIMATOLOGIA)
    url.searchParams.set('parameters', 'ALLSKY_SFC_SW_DWN')
    url.searchParams.set('community', 'RE')
    url.searchParams.set('longitude', String(lon))
    url.searchParams.set('latitude', String(lat))
    url.searchParams.set('format', 'JSON')

    const res = await fetch(url.toString(), { signal: controller.signal })
    if (!res.ok) {
      console.warn(`NASA POWER API error: ${res.status}`)
      return null
    }

    const hsp = hspDaClimatologia(await res.json())
    if (!hsp) {
      console.warn('NASA POWER: resposta sem ALLSKY_SFC_SW_DWN válido')
      return null
    }

    return {
      ...hsp,
      latitude: lat,
      longitude: lon,
      parametro: 'ALLSKY_SFC_SW_DWN (climatologia)',
      data_calculo: new Date().toISOString(),
    }
  } catch (err) {
    console.error('Erro ao consultar NASA POWER:', err.message)
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

export function calcularGeracaoComIrradiancia(potenciaKWp, hsp, perdas = 0.85) {
  // geracao_mensal = potencia × hsp × 30 × eficiência (`perdas` aqui é o fator
  // de desempenho, 0,85 = 15% de perdas — nome histórico mantido).
  const geracaoMensal = potenciaKWp * hsp * 30 * perdas
  const geracaoAnual = geracaoMensal * 12

  return {
    mensal: parseFloat(geracaoMensal.toFixed(2)),
    anual: parseFloat(geracaoAnual.toFixed(2)),
  }
}
