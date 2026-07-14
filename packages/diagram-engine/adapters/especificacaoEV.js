/**
 * especificacaoEV.js — BUG-021 FASE 2: ESPECIFICAÇÃO EXECUTIVA (fonte única da verdade).
 *
 * A partir daqui, Memorial, Unifilar, Lista de Materiais e PDFs leem os COMPONENTES e
 * CONDUTORES EXCLUSIVAMENTE desta estrutura — nunca mais direto do Motor. O Motor de
 * Engenharia (calculos_nbr) continua responsável só pelo DIMENSIONAMENTO INICIAL: ele
 * SEMEIA a especificação (derivarEspecificacaoEV), mas depois o operador é o dono dela.
 *
 * Retrocompat: projeto sem `especificacao` usa o derivador como FALLBACK (especificacaoDoProjeto).
 * Na primeira gravação o backend materializa a estrutura (migração transparente).
 *
 * Módulo NEUTRO de dados (sem desenho) — não toca no DiagramEngine (build/layout/svg).
 */

// Nº de fases do CIRCUITO do carregador (não do imóvel). numero_fases → tipo → 1.
function fasesCircuito(carregador = {}) {
  const n = Number(carregador.numero_fases)
  if (n === 3 || n === 1) return n
  if (/tri/i.test(String(carregador.tipo || ''))) return 3
  if (/mono/i.test(String(carregador.tipo || ''))) return 1
  return 1
}

// Identidade PERMANENTE dos condutores (BUG-021.3). Nunca texto livre.
function idsCondutores(nf) {
  return nf >= 3
    ? [['L1', 'fase_l1'], ['L2', 'fase_l2'], ['L3', 'fase_l3'], ['N', 'neutro'], ['PE', 'terra']]
    : [['L1', 'fase'], ['N', 'neutro'], ['PE', 'terra']]
}

/**
 * Deriva a especificação executiva a partir do dimensionamento do Motor (calculos_nbr)
 * + carregador. É o SEED inicial e o FALLBACK para projetos sem estrutura salva.
 */
export function derivarEspecificacaoEV({ calculos = {}, carregador = {}, comprimento_cabo_m } = {}) {
  const nf = fasesCircuito(carregador)
  const polos = nf >= 3 ? 4 : 2
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null)
  const disjA = num(calculos.disjuntor_a) ?? num(carregador.corrente_entrada_a)
  const bitola = num(calculos.bitola_cabo_mm2)
  const comp = num(comprimento_cabo_m) ?? num(calculos.comprimento_cabo_m)

  return {
    versao: 1,
    fases: nf,
    // BUG-021.4: componentes obrigatórios, especificados SÓ por atributos técnicos
    // (sem fabricante/modelo). A quantidade de DPS é determinística por fases (021.1).
    componentes: {
      disjuntor: { corrente_a: disjA, curva: 'C', polos },
      idr:       { corrente_a: disjA, sensibilidade_ma: num(calculos.dr_ma) ?? 30, tipo: 'A', polos },
      dps:       { classe: 'II', tensao_v: num(calculos.dps_kv) ?? 275, imax_ka: 45, polos: 1 },
    },
    // BUG-021.3: condutores estruturados com identidade fixa; operador edita só bitola/comprimento.
    condutores: idsCondutores(nf).map(([id, papel]) => ({ id, papel, bitola_mm2: bitola, comprimento_m: comp })),
  }
}

// Valida se uma estrutura salva é utilizável (tem componentes e condutores íntegros).
function especificacaoValida(e) {
  return !!(e && e.componentes && e.componentes.disjuntor && Array.isArray(e.condutores) && e.condutores.length
    && e.condutores.every(c => c && c.id))
}

/**
 * Fonte única para leitura: devolve a `especificacao` salva no projeto quando íntegra;
 * senão, deriva do Motor (fallback retrocompatível). TODOS os consumidores usam isto.
 */
export function especificacaoDoProjeto(projeto = {}) {
  if (especificacaoValida(projeto.especificacao)) return projeto.especificacao
  return derivarEspecificacaoEV({
    calculos: projeto.calculos_nbr || {},
    carregador: (projeto.carregadores && projeto.carregadores[0]) || {},
    comprimento_cabo_m: projeto.comprimento_cabo_m,
  })
}

// Quantidade de DPS = 1 por condutor vivo (fase(s)+neutro): mono=2, tri=4 (BUG-021.1).
export function quantidadeDPS(especificacao) {
  return (Number(especificacao?.fases) >= 3) ? 4 : 2
}

// Bitola "principal" (dos condutores vivos) — usada onde só cabe um valor (ex.: unifilar).
export function bitolaPrincipal(especificacao) {
  const vivo = especificacao?.condutores?.find(c => c.id !== 'PE')
  return vivo?.bitola_mm2 ?? especificacao?.condutores?.[0]?.bitola_mm2 ?? null
}
