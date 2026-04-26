const PERDAS_SISTEMA = 0.20
const AREA_POR_PAINEL_M2 = 2.0

export function calcularDimensionamento({
  consumoMensal,
  irradianciaMedia,
  potenciaPainelW    = 550,
  capacidadeInversorKW = 5,
}) {
  if (!consumoMensal || !irradianciaMedia) return null

  const energiaDiaria      = consumoMensal / 30
  const energiaNecessaria  = energiaDiaria / (1 - PERDAS_SISTEMA)
  const potenciaKwp        = energiaNecessaria / irradianciaMedia
  const numPaineis         = Math.ceil((potenciaKwp * 1000) / potenciaPainelW)
  const potenciaRealKwp    = (numPaineis * potenciaPainelW) / 1000
  const numInversores      = Math.ceil(potenciaRealKwp / capacidadeInversorKW)
  const areaMinima         = numPaineis * AREA_POR_PAINEL_M2

  return {
    energiaDiaria:    +energiaDiaria.toFixed(2),
    energiaNecessaria:+energiaNecessaria.toFixed(2),
    potenciaKwp:      +potenciaKwp.toFixed(2),
    potenciaRealKwp:  +potenciaRealKwp.toFixed(2),
    numPaineis,
    numInversores,
    areaMinima:       +areaMinima.toFixed(1),
  }
}

export function calcularAreaSuficiente(areaDisponivel, areaMinima) {
  if (!areaDisponivel || !areaMinima) return null
  return parseFloat(areaDisponivel) >= areaMinima
}

export function consumoMedioDosMeses(meses) {
  const vals = meses.map(Number).filter(v => !isNaN(v) && v > 0)
  if (!vals.length) return 0
  return +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(0)
}
