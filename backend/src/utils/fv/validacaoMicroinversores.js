/**
 * validacaoMicroinversores.js — P1-03 (Sprint P0-FV-STABILITY)
 *
 * Validação física MÍNIMA para arranjos com microinversores. Helper puro
 * (sem I/O, sem dependências) importável tanto pelo backend quanto pelos
 * testes/Front via caminho relativo.
 *
 * Motivação (bug reproduzido): "20 módulos / 5 microinversores" era ACEITO.
 * Cada microinversor tem um número finito de entradas DC (módulos). Se os
 * módulos não couberem nas entradas dos micros, a configuração é fisicamente
 * impossível e DEVE ser bloqueada.
 *
 * Regras (todas físicas, sem heurística de mercado):
 *  1. Sanidade: numModulos>=1, numMicros>=1, entradasPorMicro>=1.
 *  2. Capacidade de entradas: numModulos <= numMicros * entradasPorMicro.
 *     (não há onde plugar módulos sobrando) — BLOQUEIO.
 *  3. Limite do fabricante por micro (se informado): ceil(numModulos/numMicros)
 *     <= maxModulosPorMicro — BLOQUEIO.
 *  4. Sem micro ocioso: numMicros <= numModulos (micro sem nenhum módulo) — BLOQUEIO.
 *  5. Oversizing CC/CA por micro: potenciaCC_por_micro / potenciaMicroCA_W
 *     <= oversizingMax — BLOQUEIO acima do limite duro; AVISO acima do ideal.
 *  6. Distribuição desbalanceada (não divisível) — AVISO.
 *
 * @param {Object} p
 * @param {number} p.numModulos             total de módulos do arranjo
 * @param {number} p.numMicros              quantidade de microinversores
 * @param {number} p.entradasPorMicro       entradas DC (módulos) por micro (nMppts * entradas_por_mppt)
 * @param {number} [p.potenciaModuloW]      potência nominal por módulo (Wp)
 * @param {number} [p.potenciaMicroCA_W]    potência CA nominal por micro (W)
 * @param {number} [p.oversizingMax=1.5]    fator máximo CC/CA por micro
 * @param {number} [p.maxModulosPorMicro]   limite duro do fabricante (opcional)
 * @returns {{ valido: boolean, bloqueios: string[], avisos: string[], resumo: Object }}
 */
export function validarMicroinversores({
  numModulos,
  numMicros,
  entradasPorMicro,
  potenciaModuloW = null,
  potenciaMicroCA_W = null,
  oversizingMax = 1.5,
  maxModulosPorMicro = null,
} = {}) {
  const bloqueios = []
  const avisos = []

  const nMod = Number(numModulos)
  const nMicro = Number(numMicros)
  const entradas = Number(entradasPorMicro)

  // 1. Sanidade dos inteiros físicos
  if (!Number.isFinite(nMod) || nMod < 1) {
    bloqueios.push('Quantidade de módulos inválida (deve ser ≥ 1).')
  }
  if (!Number.isFinite(nMicro) || nMicro < 1) {
    bloqueios.push('Quantidade de microinversores inválida (deve ser ≥ 1).')
  }
  if (!Number.isFinite(entradas) || entradas < 1) {
    bloqueios.push('Entradas por microinversor inválidas (deve ser ≥ 1).')
  }

  // Sem inteiros válidos não há como prosseguir com as regras físicas.
  if (bloqueios.length > 0) {
    return { valido: false, bloqueios, avisos, resumo: { numModulos: nMod, numMicros: nMicro, entradasPorMicro: entradas } }
  }

  const capacidadeEntradas = nMicro * entradas
  const modulosPorMicroMedio = nMod / nMicro
  const modulosPorMicroMax = Math.ceil(nMod / nMicro)

  // 2. Capacidade de entradas (o caso "20 módulos / 5 micros / 1 entrada")
  if (nMod > capacidadeEntradas) {
    bloqueios.push(
      `${nMod} módulos excedem a capacidade física de ${capacidadeEntradas} entradas ` +
      `(${nMicro} microinversores × ${entradas} entrada(s) cada). ` +
      `Aumente o nº de microinversores ou reduza os módulos.`
    )
  }

  // 3. Limite duro do fabricante por micro
  if (maxModulosPorMicro != null && Number.isFinite(Number(maxModulosPorMicro))) {
    if (modulosPorMicroMax > Number(maxModulosPorMicro)) {
      bloqueios.push(
        `${modulosPorMicroMax} módulos por microinversor excedem o limite do fabricante ` +
        `(${maxModulosPorMicro} módulos/micro).`
      )
    }
  }

  // 4. Micro ocioso (mais micros que módulos)
  if (nMicro > nMod) {
    bloqueios.push(
      `${nMicro} microinversores para ${nMod} módulos: há microinversor(es) sem nenhum módulo conectado.`
    )
  }

  // 5. Oversizing CC/CA por micro
  if (potenciaModuloW != null && potenciaMicroCA_W != null) {
    const pmW = Number(potenciaModuloW)
    const pcaW = Number(potenciaMicroCA_W)
    if (Number.isFinite(pmW) && pmW > 0 && Number.isFinite(pcaW) && pcaW > 0) {
      const potenciaCCporMicro = modulosPorMicroMedio * pmW
      const ratio = potenciaCCporMicro / pcaW
      if (ratio > oversizingMax) {
        bloqueios.push(
          `Oversizing CC/CA por microinversor de ${ratio.toFixed(2)}× excede o máximo ` +
          `permitido (${oversizingMax.toFixed(2)}×). Reduza módulos por micro ou use micro de maior potência.`
        )
      } else if (ratio > 1.3) {
        avisos.push(
          `Oversizing CC/CA por microinversor de ${ratio.toFixed(2)}× está acima do ideal (1,30×), ` +
          `mas dentro do limite (${oversizingMax.toFixed(2)}×).`
        )
      }
    }
  }

  // 6. Distribuição desbalanceada
  if (nMod % nMicro !== 0) {
    avisos.push(
      `Distribuição desbalanceada: ${nMod} módulos não dividem igualmente entre ${nMicro} microinversores ` +
      `(${Math.floor(nMod / nMicro)}–${modulosPorMicroMax} módulos por micro).`
    )
  }

  return {
    valido: bloqueios.length === 0,
    bloqueios,
    avisos,
    resumo: {
      numModulos: nMod,
      numMicros: nMicro,
      entradasPorMicro: entradas,
      capacidadeEntradas,
      modulosPorMicroMax,
      potenciaTotalCC_W: potenciaModuloW != null ? nMod * Number(potenciaModuloW) : null,
    },
  }
}

export default validarMicroinversores
