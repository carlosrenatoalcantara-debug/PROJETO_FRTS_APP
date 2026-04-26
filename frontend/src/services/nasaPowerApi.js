const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const CHAVES_NASA = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

export async function consultarIrradiancia(lat, lon) {
  const url = new URL('https://power.larc.nasa.gov/api/temporal/climatology/point')
  url.searchParams.set('parameters', 'ALLSKY_SFC_SW_DWN')
  url.searchParams.set('community', 'RE')
  url.searchParams.set('longitude', lon)
  url.searchParams.set('latitude', lat)
  url.searchParams.set('format', 'JSON')

  const resp = await fetch(url.toString())
  if (!resp.ok) throw new Error(`Erro NASA POWER: ${resp.status}`)

  const json = await resp.json()
  const raw  = json.properties.parameter.ALLSKY_SFC_SW_DWN

  const mensal = CHAVES_NASA.map((chave, i) => ({
    mes:     MESES[i],
    valor:   raw[chave],
  }))

  const mediaAnual = +(mensal.reduce((s, m) => s + m.valor, 0) / 12).toFixed(2)

  return { mensal, mediaAnual }
}
