/**
 * topologiaPreliminar.js — configuração elétrica ANTES do inversor — Sprint D0.
 *
 * ── Por que existe ───────────────────────────────────────────────────────────
 * A auditoria da Sprint D mostrou que a topologia detalhada depende do inversor:
 * `inversor → nº de MPPTs → distribuição por MPPT → validação`. Nada disso pode
 * ser definido antes de haver inversor escolhido.
 *
 * O que PODE existir antes é bem menor: o tipo (string ou micro), as fases da
 * instalação, quantos módulos há e — para string — como eles se agrupam em
 * série e em paralelo. É só isso que este módulo representa, e é o suficiente
 * para, na Sprint D, pedir ao domínio a lista de inversores compatíveis.
 *
 * ── Nenhum campo novo no schema ──────────────────────────────────────────────
 * A auditoria do §3 encontrou estrutura persistente para TUDO o que a
 * configuração preliminar precisa. Nada foi acrescentado ao `ProjetoFV`:
 *
 *   tipo (string|micro)      → `arranjos[].topologia`            (enum existente)
 *   fases da instalação      → `fatura_extracao.tipo_ligacao`    (etapa Projeto)
 *   total de módulos         → `arranjos[].paineis[].quantidade` (composição)
 *   módulos por string       → `arranjos[].configuracao_eletrica.quantidade_modulos_por_string`
 *   quantidade de strings    → `arranjos[].configuracao_eletrica.quantidade_strings_paralelo`
 *
 * ── A separação que este arquivo garante ─────────────────────────────────────
 * `configuracao_eletrica` guarda os dois níveis lado a lado. O PRELIMINAR é o
 * que está acima; o DETALHADO é `n_mppts`, `strings_por_mppt`, `mppts[]` e
 * `micros[]` — todos dependentes do inversor. Este módulo lê e escreve APENAS o
 * nível preliminar, e nunca toca no detalhado: é o que impede que um vire o
 * outro por descuido.
 *
 * Puro: sem React, sem I/O, sem regra elétrica. Não valida compatibilidade —
 * isso é do motor canônico (`compatibilidadeEletricaService`), na Sprint D.
 */

/** Tipos que a configuração preliminar distingue. Subconjunto do enum do schema. */
export const TIPOS_TOPOLOGIA = Object.freeze([
  ['string', 'String'],
  ['micro', 'Microinversor'],
])

/** Fases que a instalação pode ter, como a etapa Projeto já as grava. */
export const FASES = Object.freeze(['Monofásico', 'Bifásico', 'Trifásico'])

/** Inteiro > 0 ou `null`. Vazio e zero são ausência — nunca viram número. */
export function inteiroPositivo(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  const i = Math.trunc(n)
  return i > 0 ? i : null
}

/** O arranjo que a UX nova edita. Um por opção, como na composição. */
const arranjoPrincipal = (projeto) =>
  (projeto?.arranjos ?? []).find((a) => a?.tipo === 'principal') ?? null

/** Total de módulos da composição. Soma de quantidades, sem estimar nada. */
export function totalDeModulos(projeto) {
  const a = arranjoPrincipal(projeto)
  const lista = a?.paineis ?? projeto?.equipamentos?.paineis ?? []
  let total = null
  for (const p of lista) {
    const q = inteiroPositivo(p?.quantidade)
    if (q !== null) total = (total === null ? 0 : total) + q
  }
  return total
}

/**
 * Configuração preliminar como está persistida.
 *
 * Ausência é `null` em toda parte — projeto legado sem nada disso lê um objeto
 * de nulos, não um default. Nenhum valor é inferido do inversor.
 */
export function lerPreliminar(projeto) {
  const a = arranjoPrincipal(projeto)
  const c = a?.configuracao_eletrica ?? null
  return {
    tipo: a?.topologia === 'string' || a?.topologia === 'micro' ? a.topologia : null,
    fases: projeto?.fatura_extracao?.tipo_ligacao ?? null,
    total_modulos: totalDeModulos(projeto),
    modulos_por_string: inteiroPositivo(c?.quantidade_modulos_por_string),
    quantidade_strings: inteiroPositivo(c?.quantidade_strings_paralelo),
  }
}

/**
 * O que falta para a configuração estar completa o bastante para, na Sprint D,
 * pedir os inversores compatíveis. Lacunas nomeadas — nunca preenchidas.
 *
 * Micro não usa strings: exigi-las ali seria inventar uma topologia que a
 * FV-DOM-031 já decidiu que não existe (`micro → entradas → módulos`).
 */
export function lacunasPreliminar(cfg) {
  const faltando = []
  if (cfg?.tipo === null || cfg?.tipo === undefined) faltando.push('tipo de topologia')
  if (!cfg?.fases) faltando.push('fases da instalação — etapa Projeto')
  if (cfg?.total_modulos === null) faltando.push('módulos na composição — etapa Equipamentos')
  if (cfg?.tipo === 'string') {
    if (cfg?.modulos_por_string === null) faltando.push('módulos por string')
    if (cfg?.quantidade_strings === null) faltando.push('quantidade de strings')
  }
  return faltando
}

/** A configuração está completa para o próximo passo? */
export const preliminarCompleta = (cfg) => lacunasPreliminar(cfg).length === 0

/**
 * Coerência entre o que a composição tem e o que o agrupamento declara.
 *
 * NÃO é validação elétrica — é aritmética de contagem, a mesma que a tela de
 * composição já faz. Informa a diferença; não corrige e não bloqueia.
 */
export function coerenciaDeModulos(cfg) {
  if (cfg?.tipo !== 'string') return { declarado: null, naComposicao: cfg?.total_modulos ?? null, diferenca: null }
  const mps = cfg?.modulos_por_string
  const qs = cfg?.quantidade_strings
  if (mps === null || qs === null) return { declarado: null, naComposicao: cfg?.total_modulos ?? null, diferenca: null }
  const declarado = mps * qs
  const naComposicao = cfg?.total_modulos ?? null
  return { declarado, naComposicao, diferenca: naComposicao === null ? null : naComposicao - declarado }
}

/**
 * Payload da etapa `arranjos`, preservando tudo o que esta configuração não
 * edita — inclusive a topologia DETALHADA (`mppts`, `micros`, `n_mppts`), que
 * pertence à fase pós-inversor.
 *
 * Recebe o arranjo existente para não apagar composição, fornecedor ou rótulo.
 */
export function paraArranjoPreliminar(cfg, arranjoExistente) {
  const base = arranjoExistente ?? {}
  const cfgExistente = base.configuracao_eletrica ?? {}
  return {
    ...base,
    id: base.id ?? 'principal',
    rotulo: base.rotulo ?? 'Arranjo principal',
    tipo: base.tipo ?? 'principal',
    topologia: cfg?.tipo ?? null,
    configuracao_eletrica: {
      ...cfgExistente,
      quantidade_modulos_por_string: cfg?.tipo === 'string' ? cfg.modulos_por_string : null,
      quantidade_strings_paralelo: cfg?.tipo === 'string' ? cfg.quantidade_strings : null,
    },
  }
}

export default {
  TIPOS_TOPOLOGIA, FASES, inteiroPositivo, totalDeModulos,
  lerPreliminar, lacunasPreliminar, preliminarCompleta,
  coerenciaDeModulos, paraArranjoPreliminar,
}
