/**
 * sugestaoStrings.js — sugestão de strings por inversor da composição (2026-11-25).
 *
 * Ponte entre o catálogo (SSOT) e o motor puro `sugerirDistribuicaoStrings`
 * (fv-shared). Nenhuma regra elétrica mora aqui: só se mapeiam nomes de campo,
 * se dividem os módulos entre as unidades do inversor e se combina o pior
 * status. Ausência de dado vira lacuna — nunca um valor assumido.
 *
 * Puro: sem React, sem I/O.
 */
import { sugerirDistribuicaoStrings } from '@fortesolar/fv-shared/engenharia/distribuicao-strings'
import { calcularTemperaturas } from '@fortesolar/fv-shared/engenharia/normativa'
import {
  eletricoDoModulo, eletricoDoInversor, nMpptsDoInversor, entradasPorMppt,
} from './catalogo'

/** Status combinados, do pior para o melhor. */
export const STATUS_SUGESTAO = Object.freeze({
  SEM_SOLUCAO: 'sem_solucao',
  SEM_DADOS: 'sem_dados',
  PRELIMINAR: 'preliminar',
})
const ORDEM = [STATUS_SUGESTAO.SEM_SOLUCAO, STATUS_SUGESTAO.SEM_DADOS, STATUS_SUGESTAO.PRELIMINAR]

const inteiroPos = (v) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * Clima de projeto — mesma precedência da etapa MPPT (A2, FV-UX-028):
 * Tmin/Tmax medidos em `localizacao` → tabela canônica por UF → nada.
 */
export function climaDoProjeto(projeto) {
  const loc = projeto?.localizacao ?? {}
  const tmin = loc.temperatura_min_historica_c ?? null
  const tmax = loc.temperatura_max_historica_c ?? null
  const uf = projeto?.local_resolvido?.estado ?? loc.estado ?? null
  if (tmin !== null && tmax !== null) {
    return { temperatura_min_historica_c: tmin, temperatura_max_historica_c: tmax, uf, fonte: 'localizacao' }
  }
  if (uf) {
    const t = calcularTemperaturas(uf)
    return { temperatura_min_historica_c: t.tmin, temperatura_max_historica_c: t.tmax, uf, fonte: 'uf' }
  }
  return { temperatura_min_historica_c: tmin, temperatura_max_historica_c: tmax, uf, fonte: null }
}

/** Divide N módulos entre q unidades o mais igual possível: [maiores…, menores…]. */
export function dividirModulos(total, unidades) {
  const n = inteiroPos(total)
  const q = inteiroPos(unidades)
  if (n === null || q === null) return []
  const base = Math.floor(n / q)
  const resto = n % q
  return Array.from({ length: q }, (_, i) => base + (i < resto ? 1 : 0)).filter((x) => x > 0)
}

/** Parâmetros do inversor nos nomes que o motor de distribuição espera. */
function inversorParaMotor(inversorCat) {
  const el = eletricoDoInversor(inversorCat) ?? {}
  const entradas = entradasPorMppt(inversorCat)
  return {
    numero_mppt: nMpptsDoInversor(inversorCat),
    // Catálogo traz uma posição por MPPT. O motor assume MPPTs iguais: usa o
    // MENOR, que nunca promete uma entrada que algum MPPT não tem.
    entradas_por_mppt: entradas ? Math.min(...entradas.map(Number).filter((x) => x > 0)) : null,
    tensao_max_entrada: el.tensao_max_entrada ?? null,
    mppt_min: el.mppt_min ?? null,
    mppt_max: el.mppt_max ?? null,
    corrente_max_por_mppt: el.corrente_max_mppt ?? null,
    corrente_isc_max: el.corrente_isc_max_mppt ?? null,
  }
}

function moduloParaMotor(moduloCat) {
  const m = eletricoDoModulo(moduloCat)
  return {
    voc: m.voc, vmpp: m.vmpp, isc: m.isc, impp: m.impp,
    coef_temp_voc: m.coef_temp_voc, noct: m.temp_noct ?? undefined,
  }
}

/** Texto curto de uma distribuição: "2 MPPT · 2×11 + 1×12". */
export function rotuloDistribuicao(r) {
  if (!r?.resumo) return ''
  const grupos = r.resumo.grupos.map((g) => `${g.strings}×${g.modulos_por_string}`).join(' + ')
  return `${r.mppts.length} MPPT · ${grupos}`
}

/**
 * Sugestão para UM modelo de inversor com `quantidade` unidades, sobre o total
 * de módulos da composição.
 *
 * Devolve `{ status, porUnidade: [{ modulos, resultado }], lacunas }`.
 * `status` é o pior entre as unidades; módulos que não dividem igual geram
 * unidades com 1 módulo a mais, avaliadas uma a uma.
 */
export function sugestaoParaInversor({ inversorCat, moduloCat, totalModulos, quantidade, clima }) {
  if (!inversorCat || !moduloCat) {
    return { status: STATUS_SUGESTAO.SEM_DADOS, porUnidade: [], lacunas: ['Módulo ou inversor fora do catálogo carregado.'] }
  }
  const partes = dividirModulos(totalModulos, quantidade)
  if (partes.length === 0) {
    return { status: STATUS_SUGESTAO.SEM_DADOS, porUnidade: [], lacunas: ['Quantidade de módulos ou de inversores ausente.'] }
  }
  const inversor = inversorParaMotor(inversorCat)
  const modulo = moduloParaMotor(moduloCat)
  const climaMotor = {
    tMin: clima?.temperatura_min_historica_c ?? undefined,
    tMax: clima?.temperatura_max_historica_c ?? undefined,
  }

  const cache = new Map()
  const porUnidade = partes.map((n) => {
    if (!cache.has(n)) {
      cache.set(n, sugerirDistribuicaoStrings({ totalModulos: n, inversor, modulo, clima: climaMotor }))
    }
    return { modulos: n, resultado: cache.get(n) }
  })

  const status = ORDEM.find((s) => porUnidade.some((u) => u.resultado.status === s)) ?? STATUS_SUGESTAO.PRELIMINAR
  const lacunas = [...new Set(porUnidade.flatMap((u) => u.resultado.lacunas ?? []))]
  return { status, porUnidade, lacunas }
}

/**
 * Agrupamento uniforme de uma avaliação: todas as strings de todas as unidades
 * com o mesmo comprimento → `{ modulos_por_string, quantidade_strings }` (total
 * de strings), no formato da configuração preliminar. Senão, `null`.
 */
export function agrupamentoUniforme(avaliacao) {
  if (avaliacao?.status !== STATUS_SUGESTAO.PRELIMINAR) return null
  const grupos = avaliacao.porUnidade.flatMap((u) => u.resultado?.resumo?.grupos ?? [])
  const comprimentos = new Set(grupos.map((g) => g.modulos_por_string))
  if (grupos.length === 0 || comprimentos.size !== 1) return null
  return {
    modulos_por_string: [...comprimentos][0],
    quantidade_strings: grupos.reduce((soma, g) => soma + g.strings, 0),
  }
}

/**
 * Converte a sugestão de UMA unidade no formato editável da etapa MPPT
 * (`topologia.js`): uma entrada física por string. MPPTs livres ficam vazios.
 */
export function topologiaDaSugestao(resultado, nMppts) {
  if (resultado?.status !== STATUS_SUGESTAO.PRELIMINAR) return null
  const total = inteiroPos(nMppts) ?? resultado.mppts.length
  return Array.from({ length: Math.max(total, resultado.mppts.length) }, (_, i) => {
    const m = resultado.mppts[i]
    if (!m) return { entradas: [{ strings: [] }] }
    return {
      entradas: Array.from({ length: m.strings }, () => ({
        strings: [{ modulos: String(m.modulos_por_string) }],
      })),
    }
  })
}

export default {
  STATUS_SUGESTAO, climaDoProjeto, dividirModulos, sugestaoParaInversor,
  rotuloDistribuicao, agrupamentoUniforme, topologiaDaSugestao,
}
