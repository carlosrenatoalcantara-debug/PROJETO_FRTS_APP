/**
 * validacaoMicroinversores.js — P1-03 (Sprint P0-FV-STABILITY)
 *
 * FV-DOM-031 (decisões 3 e 4): a REGRA saiu daqui.
 *
 * A auditoria mediu veredito oposto em 4 dos 13 micros do catálogo entre este
 * validador e `dimensionarMicroinversor`: fórmulas diferentes (média × micro
 * mais carregado) e limites diferentes (`?? 1.5` × `?? 1.25`), ambos fabricados.
 * O motor canônico é `engenharia/microinversores.js`. Este arquivo é o
 * ADAPTADOR da assinatura histórica sobre ele — sem regra própria.
 *
 * ── O que MUDOU de comportamento, por decisão ────────────────────────────────
 *  • O oversizing é medido no micro MAIS CARREGADO, não na média.
 *  • O limite é o DECLARADO (`oversizingMax`). Sem limite declarado não há
 *    veredito: sai AVISO com o valor medido, não bloqueio contra 1,5 inventado.
 *    Quem quer bloqueio passa o `oversizing_max` do catálogo.
 *
 * ── O que NÃO mudou ──────────────────────────────────────────────────────────
 * Assinatura, formato de retorno, `resumo.*` e o vocabulário das mensagens.
 *
 * @param {Object} p
 * @param {number} p.numModulos             total de módulos do arranjo
 * @param {number} p.numMicros              quantidade de microinversores
 * @param {number} p.entradasPorMicro       entradas DC (módulos) por micro
 * @param {number} [p.potenciaModuloW]      potência nominal por módulo (Wp)
 * @param {number} [p.potenciaMicroCA_W]    potência CA nominal por micro (W)
 * @param {number} [p.oversizingMax]        limite CC/CA do CATÁLOGO. Sem ele, sem veredito.
 * @param {number} [p.maxModulosPorMicro]   limite duro do fabricante (opcional)
 * @returns {{ valido: boolean, bloqueios: string[], avisos: string[], resumo: Object }}
 */
import { avaliarModeloMicro, microsNecessarios } from '../../engenharia/microinversores.js'

export function validarMicroinversores({
  numModulos,
  numMicros,
  entradasPorMicro,
  potenciaModuloW = null,
  potenciaMicroCA_W = null,
  oversizingMax = null,
  maxModulosPorMicro = null,
} = {}) {
  const nMod = Number(numModulos)
  const nMicro = Number(numMicros)
  const entradas = Number(entradasPorMicro)

  // Nesta assinatura histórica, `entradasPorMicro` JÁ É a capacidade em módulos
  // — o parâmetro sempre significou "entradas DC (módulos) por micro".
  const r = avaliarModeloMicro({
    modulos: numModulos,
    quantidade: numMicros,
    micro: {
      entradas: entradasPorMicro,
      modulos_por_entrada: 1,
      potencia_kw: potenciaMicroCA_W == null ? null : Number(potenciaMicroCA_W) / 1000,
      oversizing_max: oversizingMax,
    },
    potenciaModuloW,
  })

  const bloqueios = [...r.bloqueios]
  // Vocabulário histórico: o motor diz "desigual", esta API sempre disse
  // "desbalanceada". Tradução, não regra.
  const avisos = r.avisos.map((a) => a.replace(/Distribuição desigual/, 'Distribuição desbalanceada'))

  // Limite DURO do fabricante por micro — constraint próprio desta API, que o
  // motor canônico não tem porque não vem do envelope elétrico.
  const modulosPorMicroMax = Number.isFinite(nMod) && Number.isFinite(nMicro) && nMicro > 0
    ? Math.ceil(nMod / nMicro) : null
  if (maxModulosPorMicro != null && Number.isFinite(Number(maxModulosPorMicro)) && modulosPorMicroMax != null) {
    if (modulosPorMicroMax > Number(maxModulosPorMicro)) {
      bloqueios.push(
        `${modulosPorMicroMax} módulos por microinversor excedem o limite do fabricante ` +
        `(${maxModulosPorMicro} módulos/micro).`,
      )
    }
  }

  // Mensagens de sanidade no vocabulário histórico.
  const sane = []
  if (!Number.isFinite(nMod) || nMod < 1) sane.push('Quantidade de módulos inválida (deve ser ≥ 1).')
  if (!Number.isFinite(nMicro) || nMicro < 1) sane.push('Quantidade de microinversores inválida (deve ser ≥ 1).')
  if (!Number.isFinite(entradas) || entradas < 1) sane.push('Entradas por microinversor inválidas (deve ser ≥ 1).')
  if (sane.length > 0) {
    return {
      valido: false, bloqueios: sane, avisos: [],
      resumo: { numModulos: nMod, numMicros: nMicro, entradasPorMicro: entradas },
    }
  }

  return {
    valido: bloqueios.length === 0,
    bloqueios,
    avisos,
    resumo: {
      numModulos: nMod,
      numMicros: nMicro,
      entradasPorMicro: entradas,
      capacidadeEntradas: nMicro * entradas,
      modulosPorMicroMax,
      potenciaTotalCC_W: potenciaModuloW != null ? nMod * Number(potenciaModuloW) : null,
      // FV-DOM-031: o que o motor canônico passou a informar.
      distribuicao: r.resumo?.distribuicao ?? null,
      modulos_no_mais_carregado: r.resumo?.modulos_no_mais_carregado ?? null,
      oversizing_mais_carregado: r.resumo?.oversizing_mais_carregado ?? null,
      micros_necessarios: microsNecessarios(numModulos, entradas),
    },
  }
}

export default validarMicroinversores
