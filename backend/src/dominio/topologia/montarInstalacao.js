/**
 * montarInstalacao.js — S4C-1 (ADR-019, Etapa 1)
 *
 * TRADUTOR OFICIAL: converte a INTENÇÃO capturada pelo frontend
 * (`TopologiaMPPTEditor`: entradas → strings → módulos) no modelo canônico
 * `PayloadInstalacao` aceito por POST /api/instalacoes.
 *
 * É a ÚNICA implementação da tradução. Reutiliza `montarGerador`/`montarString`
 * — não duplica nenhuma regra estrutural.
 *
 * PURO: sem I/O, sem banco, sem HTTP, sem mongoose, sem catálogo, sem React.
 * NÃO distribui módulos (política de engenharia é ADR-020). Apenas traduz.
 *
 * ── Contrato de entrada ────────────────────────────────────────────────────
 * IntencaoTopologia {
 *   local_ref: any | null
 *   geradores: [{
 *     inversor: { _id, especificacoes:{ n_mppts, ... } },  // doc do Catálogo já
 *     apelido?: string | null                              // resolvido pelo FE
 *     modulo_ref: any                                      // modelo padrão
 *     superficie_id: any                                   // superfície padrão
 *     otimizador_ref?: any | null
 *     topologia: [ { entradas: [ { strings: [ {
 *       modulos: number,
 *       modulo_ref?: any,        // override → composição heterogênea
 *       superficie_id?: any      // override → múltiplas faces
 *     } ] } ] } ]                // length === n_mppts do Catálogo (INV-03)
 *   }]
 * }
 *
 * NOTA DE CONTRATO (ADR-019 §4): a intenção carrega o DOC do inversor, não só
 * `inversor_ref`. Sem isso o tradutor precisaria consultar o Catálogo para saber
 * `n_mppts` — o que violaria a pureza. O FE já possui o doc selecionado.
 */

import { montarGerador, montarString, contarMpptsInversor } from './montarGerador.js'

export class ErroIntencaoInvalida extends Error {
  constructor(erros) {
    super('Intenção de topologia inválida: ' + erros.join(' | '))
    this.name = 'ErroIntencaoInvalida'
    this.erros = erros
  }
}

const ehInteiroPositivo = (v) => Number.isFinite(Number(v)) && Number(v) > 0

/**
 * Valida a intenção sem lançar. Não valida engenharia elétrica nem existência
 * de referências (isso é do InstalacaoService, que tem I/O).
 * @returns {string[]} erros; [] = válida
 */
export function validarIntencao(intencao) {
  const erros = []
  const i = intencao || {}
  const geradores = Array.isArray(i.geradores) ? i.geradores : null

  if (!geradores) { erros.push('intencao.geradores deve ser um array'); return erros }
  if (geradores.length === 0) erros.push('intencao.geradores: ao menos 1 gerador é obrigatório')

  geradores.forEach((g, gi) => {
    const tag = `gerador[${gi}]`
    if (!g || typeof g !== 'object') { erros.push(`${tag}: deve ser um objeto`); return }

    // Inversor + INV-03 (nº de MPPTs vem do Catálogo, nunca do usuário)
    const nMppts = contarMpptsInversor(g.inversor)
    if (!g.inversor) erros.push(`${tag}: inversor (doc do Catálogo) é obrigatório`)
    else if (!nMppts) erros.push(`${tag}: inversor sem n_mppts no Catálogo`)

    if (g.modulo_ref == null) erros.push(`${tag}: modulo_ref padrão é obrigatório`)
    if (g.superficie_id == null) erros.push(`${tag}: superficie_id padrão é obrigatório`)

    const topologia = Array.isArray(g.topologia) ? g.topologia : null
    if (!topologia) { erros.push(`${tag}.topologia: deve ser um array`); return }
    if (nMppts && topologia.length !== nMppts) {
      erros.push(`${tag}.topologia: ${topologia.length} MPPT(s) ≠ ${nMppts} do Catálogo (INV-03)`)
    }

    topologia.forEach((mppt, mi) => {
      const entradas = Array.isArray(mppt?.entradas) ? mppt.entradas : null
      if (!entradas) { erros.push(`${tag}.mppt[${mi}].entradas: deve ser um array`); return }
      entradas.forEach((entrada, ei) => {
        const strings = Array.isArray(entrada?.strings) ? entrada.strings : null
        if (!strings) { erros.push(`${tag}.mppt[${mi}].entrada[${ei}].strings: deve ser um array`); return }
        strings.forEach((s, si) => {
          const stag = `${tag}.mppt[${mi}].entrada[${ei}].string[${si}]`
          const m = Number(s?.modulos)
          if (!Number.isFinite(m) || m < 0) erros.push(`${stag}: modulos deve ser número ≥ 0`)
        })
      })
    })
  })

  return erros
}

/**
 * Resumo derivado da intenção (para UI). Nunca persistido.
 * @returns {{ modulos:number, strings:number, mpptsUsados:number, geradores:number }}
 */
export function resumoIntencao(intencao) {
  let modulos = 0, strings = 0, mpptsUsados = 0
  const geradores = Array.isArray(intencao?.geradores) ? intencao.geradores : []
  for (const g of geradores) {
    for (const mppt of (g?.topologia || [])) {
      let usado = false
      for (const entrada of (mppt?.entradas || [])) {
        for (const s of (entrada?.strings || [])) {
          const m = Number(s?.modulos)
          if (ehInteiroPositivo(m)) { modulos += m; strings++; usado = true }
        }
      }
      if (usado) mpptsUsados++
    }
  }
  return { modulos, strings, mpptsUsados, geradores: geradores.length }
}

/**
 * Traduz a intenção em PayloadInstalacao (shape de POST /api/instalacoes).
 * Strings com `modulos <= 0` são DESCARTADAS (entrada vazia é legítima).
 * @throws {ErroIntencaoInvalida}
 */
export function montarInstalacao(intencao) {
  const erros = validarIntencao(intencao)
  if (erros.length) throw new ErroIntencaoInvalida(erros)

  const geradores = intencao.geradores.map((g) => {
    // Esqueleto + MPPTs materializados do Catálogo (reuso — INV-03 preservada).
    const gerador = montarGerador(g.inversor, { apelido: g.apelido ?? null })

    g.topologia.forEach((mppt, mi) => {
      let indice_entrada = 0
      for (const entrada of (mppt.entradas || [])) {
        indice_entrada++
        for (const s of (entrada.strings || [])) {
          const quantidade = Number(s?.modulos)
          if (!ehInteiroPositivo(quantidade)) continue   // string vazia → descartada

          // Reuso: validação estrutural (composição ≥1, quantidade >0, superfície)
          // permanece dentro de montarString — não é reimplementada aqui.
          gerador.mppts[mi].strings.push(montarString({
            indice_entrada,
            composicao: [{ modulo_ref: s.modulo_ref ?? g.modulo_ref, quantidade }],
            superficie_id: s.superficie_id ?? g.superficie_id,
            otimizador_ref: s.otimizador_ref ?? g.otimizador_ref ?? null,
          }))
        }
      }
    })

    return gerador
  })

  return { local_ref: intencao.local_ref ?? null, geradores }
}

export default { montarInstalacao, validarIntencao, resumoIntencao, ErroIntencaoInvalida }
