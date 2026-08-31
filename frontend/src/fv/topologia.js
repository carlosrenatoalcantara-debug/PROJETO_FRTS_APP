/**
 * topologia.js — modelo de edição da topologia MPPT — FV-UX-026.
 *
 * Modelo A (FV-DOM-023/024): `mppts[]` é ENTRADA AUTORAL do projetista. Este
 * módulo não decide distribuição alguma — apenas converte entre a forma que o
 * editor manipula e a forma que o schema já persiste, e soma o que foi digitado.
 *
 * ── O que este arquivo NÃO contém ────────────────────────────────────────────
 * Nenhuma fórmula elétrica. Nenhuma correção térmica, nenhum limite, nenhum
 * fator de segurança. Voc, Vmpp, Isc e oversizing vêm do validador canônico no
 * servidor. Aqui só há contagem de módulos.
 *
 * ── A forma persistida ───────────────────────────────────────────────────────
 * `engenharia_eletrica.arranjo.mppts[]` guarda, por MPPT, a topologia REAL
 * (`entradas[].strings[].modulos`) e um RESUMO derivado dela
 * (`strings_paralelo`, `modulos_por_string`, `total_modulos`), que é o que o
 * adapter do unifilar lê.
 *
 * A derivação do resumo segue a convenção JÁ persistida por projetos
 * existentes: `strings_paralelo` conta as strings com módulos, e
 * `modulos_por_string` é o MAIOR valor entre elas. O maior, e não a média, para
 * que a Voc calculada a partir do resumo continue sendo a do pior caso.
 * Mudar essa convenção faria registros novos e antigos serem lidos de formas
 * diferentes pelo mesmo unifilar.
 *
 * Puro: sem React, sem I/O.
 */

/** Inteiro ≥ 0 ou `null`. Campo vazio é ausência, nunca 0. */
export function inteiro(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null
}

/** MPPT vazio: uma entrada, nenhuma string. Nada é sugerido. */
export function mpptVazio() {
  return { entradas: [{ strings: [] }] }
}

/**
 * Topologia inicial para um inversor com N MPPTs.
 * Cria os MPPTs VAZIOS — a distribuição é do projetista.
 */
export function topologiaVazia(nMppts) {
  const n = inteiro(nMppts)
  return Array.from({ length: n && n > 0 ? n : 1 }, () => mpptVazio())
}

/** Strings com módulos declarados (> 0). Strings em branco não contam. */
function stringsComModulos(mppt) {
  return (mppt?.entradas ?? [])
    .flatMap((e) => e?.strings ?? [])
    .map((s) => inteiro(s?.modulos))
    .filter((m) => m !== null && m > 0)
}

/** Total de módulos de um MPPT. */
export function totalDoMppt(mppt) {
  return stringsComModulos(mppt).reduce((a, b) => a + b, 0)
}

/** Total distribuído em toda a topologia. */
export function totalDistribuido(topologia) {
  return (topologia ?? []).reduce((s, m) => s + totalDoMppt(m), 0)
}

/**
 * Módulos ainda não distribuídos.
 * `null` quando a quantidade total não foi informada — ausência, não zero.
 */
export function naoDistribuidos(topologia, totalDisponivel) {
  const total = inteiro(totalDisponivel)
  if (total === null) return null
  return total - totalDistribuido(topologia)
}

/** O MPPT tem alguma string com módulos? */
export function mpptUtilizado(mppt) {
  return stringsComModulos(mppt).length > 0
}

/**
 * Editor → forma persistida (`arranjo.mppts[]`).
 *
 * MPPTs sem nenhuma string com módulos entram com resumo zerado: o schema
 * aceita MPPT parcialmente utilizado, e apagá-lo esconderia a intenção do
 * projetista de deixá-lo livre.
 */
export function paraArranjoPersistido(topologia, nMpptsDoInversor) {
  const mppts = (topologia ?? []).map((m, i) => {
    const strings = stringsComModulos(m)
    return {
      mppt: i + 1,
      strings_paralelo: strings.length,
      modulos_por_string: strings.length ? Math.max(...strings) : 0,
      total_modulos: strings.reduce((a, b) => a + b, 0),
      entradas: (m?.entradas ?? []).map((e, ei) => ({
        entrada: ei + 1,
        strings: (e?.strings ?? []).map((s) => ({ modulos: inteiro(s?.modulos) ?? 0 })),
      })),
    }
  })
  const usados = mppts.filter((m) => m.strings_paralelo > 0)
  // Os campos legados descrevem o PIOR CASO entre os MPPTs — é o que os leitores
  // antigos esperam encontrar ali.
  const pior = usados.reduce(
    (max, m) => (m.modulos_por_string > (max?.modulos_por_string ?? -1) ? m : max), null)
  return {
    quantidade_modulos_por_string: pior?.modulos_por_string ?? 0,
    quantidade_strings_paralelo: pior?.strings_paralelo ?? 0,
    total_modulos: mppts.reduce((s, m) => s + m.total_modulos, 0),
    num_mppts_usados: inteiro(nMpptsDoInversor) ?? mppts.length,
    mppts,
  }
}

/**
 * Forma persistida → editor.
 *
 * Projetos gravados antes da topologia detalhada só têm o resumo por MPPT. Nesse
 * caso, reconstrói-se `strings_paralelo` strings de `modulos_por_string` módulos
 * numa única entrada — a leitura mais fiel possível do que foi registrado.
 */
export function daArranjoPersistido(arranjo) {
  const lista = Array.isArray(arranjo?.mppts) ? arranjo.mppts : []
  if (lista.length === 0) return null
  return lista.map((m) => {
    if (Array.isArray(m?.entradas) && m.entradas.length > 0) {
      return {
        entradas: m.entradas.map((e) => ({
          strings: (e?.strings ?? []).map((s) => ({ modulos: String(inteiro(s?.modulos) ?? '') })),
        })),
      }
    }
    const n = inteiro(m?.strings_paralelo) ?? 0
    const mods = inteiro(m?.modulos_por_string) ?? 0
    return {
      entradas: [{ strings: Array.from({ length: n }, () => ({ modulos: String(mods) })) }],
    }
  })
}

/**
 * Arranjo por MPPT para o validador canônico.
 *
 * O contrato de `POST /api/engenharia/compatibilidade-eletrica` descreve UM
 * arranjo uniforme. Voc, Vmpp e Isc são grandezas POR MPPT, então cada MPPT é
 * submetido na sua própria chamada, com `num_mppt_usados: 1`.
 *
 * `modulos_por_string` é o maior da string do MPPT — o pior caso de tensão.
 */
export function arranjoParaValidacao(mppt) {
  const strings = stringsComModulos(mppt)
  if (strings.length === 0) return null
  return {
    quantidade_modulos_por_string: Math.max(...strings),
    quantidade_strings_paralelo: strings.length,
    num_mppt_usados: 1,
  }
}

/** A topologia tem MPPTs com configurações diferentes entre si? */
export function topologiaDesigual(topologia) {
  const usados = (topologia ?? []).filter(mpptUtilizado).map((m) => {
    const s = stringsComModulos(m)
    return `${s.length}x${Math.max(...s)}`
  })
  return new Set(usados).size > 1
}
