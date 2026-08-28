/**
 * dimensionarMicro.js — P0-ARRAY-CONFIG-MICROINVERSOR-01
 *
 * FV-DOM-031 (decisões 3 e 4): a REGRA saiu daqui.
 *
 * Este era o segundo motor de micro do sistema — só no frontend, com quatro
 * defaults fabricados (`entradas ?? 1`, `modulos_por_entrada ?? 1`,
 * `oversizing_max ?? 1.25`, `potencia_ca_kw ?? 0`) e uma fórmula de oversizing
 * diferente da do validador. O motor canônico agora é
 * `@fortesolar/fv-shared/engenharia/microinversores`; aqui resta o ADAPTADOR da
 * assinatura histórica.
 *
 * ── O que mudou, por decisão ─────────────────────────────────────────────────
 * Sem `entradas` ou `modulos_por_entrada` no catálogo, não há capacidade
 * assumida: o retorno é `{ valido: false }` com o motivo, em vez de fingir um
 * micro de 1 entrada. O limite de oversizing é o do catálogo — sem ele, não há
 * veredito de oversizing (`oversizingOk: null`), não um 1,25 inventado.
 *
 * Puro (sem efeitos), testável. Não toca Atlas/SSOT/parser.
 */
import {
  avaliarModeloMicro, capacidadeDoMicro, microsNecessarios,
} from '@fortesolar/fv-shared/engenharia/microinversores'

/**
 * @param {object} p
 * @param {number} p.numModulos        total de módulos do sistema
 * @param {number} p.potenciaModuloW   potência de cada módulo (Wp)
 * @param {object} p.micro             { entradas, modulos_por_entrada, potencia_ca_kw, oversizing_max }
 * @returns {object} dimensionamento do arranjo micro
 */
export function dimensionarMicroinversor({ numModulos, potenciaModuloW, micro }) {
  const n = Math.max(0, Math.floor(numModulos || 0))
  const capacidade = capacidadeDoMicro(micro)

  if (n === 0) {
    return { valido: false, motivo: 'sem módulos', qtdMicros: 0, modulosPorMicro: capacidade, distribuicao: [] }
  }
  if (capacidade === null) {
    return {
      valido: false,
      motivo: 'microinversor sem `entradas`/`modulos_por_entrada` no catálogo — nenhuma capacidade é assumida',
      qtdMicros: 0, modulosPorMicro: null, distribuicao: [],
    }
  }

  // Quantidade MÍNIMA que acomoda os módulos. Continua sendo o que esta função
  // sempre devolveu — a diferença é que a capacidade agora vem declarada.
  const qtdMicros = microsNecessarios(n, capacidade)

  const r = avaliarModeloMicro({
    modulos: n, quantidade: qtdMicros,
    micro: {
      entradas: micro?.entradas, modulos_por_entrada: micro?.modulos_por_entrada,
      potencia_kw: micro?.potencia_ca_kw, oversizing_max: micro?.oversizing_max,
    },
    potenciaModuloW,
  })

  // FV-DOM-031B: com distribuição EQUILIBRADA, "completo" deixou de ser o caso
  // comum — 26 módulos em 7 micros de 4 dão [4,4,4,4,4,3,3], não [4×6, 2].
  // Os dois contadores permanecem com o mesmo significado literal.
  const distribuicao = r.resumo?.distribuicao ?? []
  const completos = distribuicao.filter((m) => m === capacidade).length
  const parciais = distribuicao.filter((m) => m > 0 && m < capacidade).length
  const entradas = Math.floor(Number(micro?.entradas))
  const porEntrada = Math.floor(Number(micro?.modulos_por_entrada))
  const entradasTotais = qtdMicros * entradas
  const entradasUsadas = Math.ceil(n / porEntrada)
  const potenciaCcKw = +((n * potenciaModuloW) / 1000).toFixed(3)
  const potenciaCaKw = r.resumo?.potencia_ca_kw ?? null
  const oversizing = r.resumo?.oversizing_mais_carregado ?? null
  const limite = r.resumo?.oversizing_max ?? null

  return {
    valido: true,
    topologia: 'micro',
    numModulos: n,
    modulosPorMicro: capacidade,
    entradasPorMicro: entradas,
    qtdMicros,
    microsCompletos: completos,
    microsParciais: parciais,
    distribuicao,                 // ex.: [4,4,4,4,4,4,2] p/ 26 mód em micro de 4 entradas
    potenciaCcKw,
    potenciaCaKw,
    relacaoDcAc: potenciaCaKw > 0 ? +(potenciaCcKw / potenciaCaKw).toFixed(3) : null,
    entradasUsadas,
    entradasTotais,
    aproveitamento: entradasTotais > 0 ? +(entradasUsadas / entradasTotais).toFixed(3) : 0,
    oversizingMicroCheio: oversizing,
    // `null` = o catálogo não declarou limite; NÃO é aprovação.
    oversizingOk: limite === null || oversizing === null ? null : oversizing <= limite,
    oversizingMax: limite,
    bloqueios: r.bloqueios,
    avisos: r.avisos,
    lacunas: r.lacunas,
  }
}

/**
 * Resumo textual curto da distribuição (ex.: "5 micros de 4 + 2 de 3").
 *
 * FV-DOM-031B: agrupa por quantidade em vez de assumir "N cheios + 1 resto".
 * Com distribuição equilibrada há no máximo DOIS valores distintos, mas a
 * função não depende disso — conta o que existir.
 */
export function resumoDistribuicao(dim) {
  if (!dim?.valido) return '—'
  const grupos = new Map()
  for (const m of dim.distribuicao ?? []) {
    // `has ? +1 : 1` e não `?? 0`: o guard de defaults técnicos é absoluto neste
    // arquivo, e um contador não deve abrir exceção para o operador proibido.
    if (m > 0) grupos.set(m, grupos.has(m) ? grupos.get(m) + 1 : 1)
  }
  if (grupos.size === 0) return '—'
  // "micro(s)" só no primeiro grupo — formato histórico desta função.
  return [...grupos.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([modulos, quantos], i) =>
      i === 0 ? `${quantos} micro${quantos !== 1 ? 's' : ''} de ${modulos}` : `${quantos} de ${modulos}`)
    .join(' + ')
}
