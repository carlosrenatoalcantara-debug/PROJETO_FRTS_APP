/**
 * dimensionarMicro.js — P0-ARRAY-CONFIG-MICROINVERSOR-01
 *
 * Motor de dimensionamento ESPECÍFICO para microinversores.
 * NÃO usa conceito de string/MPPT/strings-paralelas — o micro tem N entradas CC e cada
 * módulo conecta a uma entrada. O dimensionamento é por ENTRADAS, não por string.
 *
 * Pura (sem efeitos), testável. Não toca Atlas/SSOT/parser.
 */

/**
 * @param {object} p
 * @param {number} p.numModulos        total de módulos do sistema
 * @param {number} p.potenciaModuloW   potência de cada módulo (Wp)
 * @param {object} p.micro             { entradas, modulos_por_entrada?, potencia_ca_kw, oversizing_max? }
 * @returns {object} dimensionamento completo do arranjo micro
 */
export function dimensionarMicroinversor({ numModulos, potenciaModuloW, micro }) {
  const entradas = Math.max(1, Math.floor(micro?.entradas ?? 1))
  const modPorEntrada = Math.max(1, Math.floor(micro?.modulos_por_entrada ?? 1))
  const modulosPorMicro = entradas * modPorEntrada       // capacidade máxima de um micro
  const potCaMicroKw = micro?.potencia_ca_kw ?? 0
  const oversizingMax = micro?.oversizing_max ?? 1.25

  const n = Math.max(0, Math.floor(numModulos || 0))
  if (n === 0 || modulosPorMicro === 0) {
    return { valido: false, motivo: 'sem módulos ou micro inválido', qtdMicros: 0, modulosPorMicro, distribuicao: [] }
  }

  // 1) Quantidade de micros = teto(módulos / capacidade por micro)
  const qtdMicros = Math.ceil(n / modulosPorMicro)

  // 2) Distribuição FILL-BASED: micros completos + 1 parcial com a sobra
  const completos = Math.floor(n / modulosPorMicro)
  const resto = n - completos * modulosPorMicro
  const distribuicao = []
  for (let i = 0; i < completos; i++) distribuicao.push(modulosPorMicro)
  if (resto > 0) distribuicao.push(resto)
  const microsCompletos = completos
  const microsParciais = resto > 0 ? 1 : 0

  // 3) Potências e relação DC/AC
  const potenciaCcKw = +(n * potenciaModuloW / 1000).toFixed(3)
  const potenciaCaKw = +(qtdMicros * potCaMicroKw).toFixed(3)
  const dcac = potenciaCaKw > 0 ? +(potenciaCcKw / potenciaCaKw).toFixed(3) : null

  // 4) Aproveitamento das entradas
  const entradasTotais = qtdMicros * entradas
  const entradasUsadas = Math.ceil(n / modPorEntrada)
  const aproveitamento = entradasTotais > 0 ? +(entradasUsadas / entradasTotais).toFixed(3) : 0

  // 5) Oversizing por micro mais carregado (módulos no micro × potência / potência CA do micro)
  const maxModNumMicro = distribuicao.length ? Math.max(...distribuicao) : 0
  const dcacMicroCheio = potCaMicroKw > 0 ? +((maxModNumMicro * potenciaModuloW / 1000) / potCaMicroKw).toFixed(3) : null
  const oversizingOk = dcacMicroCheio == null ? true : dcacMicroCheio <= oversizingMax + 1e-9

  return {
    valido: true,
    topologia: 'micro',
    numModulos: n,
    modulosPorMicro,
    entradasPorMicro: entradas,
    qtdMicros,
    microsCompletos,
    microsParciais,
    distribuicao,                 // ex.: [4,4,4,4,4,4,2] p/ 26 mód em micro de 4 entradas
    potenciaCcKw,
    potenciaCaKw,
    relacaoDcAc: dcac,
    entradasUsadas,
    entradasTotais,
    aproveitamento,               // 0..1
    oversizingMicroCheio: dcacMicroCheio,
    oversizingOk,
  }
}

/** Resumo textual curto da distribuição (ex.: "6 micros de 4 + 1 de 2"). */
export function resumoDistribuicao(dim) {
  if (!dim?.valido) return '—'
  const { microsCompletos, modulosPorMicro, microsParciais, distribuicao } = dim
  const parcial = microsParciais ? ` + 1 de ${distribuicao[distribuicao.length - 1]}` : ''
  return `${microsCompletos} micro${microsCompletos !== 1 ? 's' : ''} de ${modulosPorMicro}${parcial}`
}
