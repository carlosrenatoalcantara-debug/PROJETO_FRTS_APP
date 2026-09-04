/**
 * arranjosMicro.js — composição de ARRANJOS de microinversores — Sprint E.
 *
 * ── O que faltava ───────────────────────────────────────────────────────────
 * A FV-DOM-031 fechou o nível de baixo: `microinversor → entradas → módulos`,
 * com `distribuirEntreMicros` e `distribuirEntreEntradas` já canônicos. O que
 * não existia era o nível de CIMA: os micros não ficam soltos, eles se agrupam
 * em ramais CA (aqui chamados ARRANJOS, no vocabulário da Sprint E) e esses
 * ramais se repartem entre as fases da instalação.
 *
 * Este módulo é esse nível, e só ele. Não recalcula módulos por micro — chama o
 * motor da FV-DOM-031. Não classifica topologia, não valida oversizing, não
 * escolhe equipamento.
 *
 *   quantidade de micros ─┬─ regra do fabricante ──▶ arranjos [3,3,1]
 *                         └─ fases da instalação ──▶ L1 / L2 / L3
 *
 * ── Duas aritméticas diferentes, de propósito ───────────────────────────────
 * Módulos entre micros é EQUILÍBRIO (`_equilibrar`, FV-DOM-031B): 23 em 6 micros
 * dá 4/4/4/4/4/3, porque o veredito de oversizing olha o mais carregado e uma
 * desigualdade gratuita reprovaria arranjo viável.
 *
 * Micros entre arranjos é ENCHER: 7 micros com limite 3 dá 3+3+1, não 3+2+2. O
 * limite é de fábrica e não há prêmio por equilibrar abaixo dele; o que existe é
 * custo por ramal a mais. Encher minimiza a quantidade de ramais, que é o que a
 * instalação paga. São regras distintas porque otimizam coisas distintas.
 *
 * ── Nada é assumido ─────────────────────────────────────────────────────────
 * Sem regra de agrupamento (nem no catálogo, nem na tabela de fabricante) NÃO há
 * arranjos: `arranjos: null` e a lacuna nomeada. Um default aqui produziria uma
 * distribuição de aparência válida sobre um número inventado — que é o defeito
 * que a Sprint E existe para não cometer.
 *
 * Puro: sem I/O, sem React, sem dependência de node.
 */
import { capacidadeDoMicro, distribuirEntreMicros, distribuirEntreEntradas } from './microinversores.js'
import { regraDeArranjoMicro } from './regrasMicroFabricante.js'

/** Identidade permanente dos condutores vivos — mesmo vocabulário do ProjetoEV. */
export const FASES_VIVAS = Object.freeze(['L1', 'L2', 'L3'])

/**
 * POLÍTICA DE FORMAÇÃO DE ARRANJOS — Sprint E2, §4.
 *
 * A Sprint E mediu o caso que forçou esta decisão: 6 micros Deye numa
 * instalação trifásica formam 2 arranjos (3+3) e deixam L3 sem nenhum micro.
 *
 * Duas estratégias foram comparadas:
 *
 *   A — MÍNIMO DE RAMAIS (implementada)
 *       Encher cada arranjo até o limite do fabricante. 6 → 3+3.
 *       Consequência: com menos arranjos que fases, sobra fase vazia.
 *       Custo: nenhum ramal a mais. Desequilíbrio: declarado, não corrigido.
 *
 *   B — DIVIDIR PARA OCUPAR AS FASES (NÃO implementada)
 *       Repartir os mesmos 6 micros em 3 arranjos de 2, um por fase.
 *       O limite do fabricante é um MÁXIMO, então 2 por arranjo é permitido —
 *       B não viola nenhuma regra declarada.
 *       Custo: um ramal a mais (cabo tronco, disjuntor, ocupação de quadro).
 *
 * ── Por que A, e por que B fica bloqueada ───────────────────────────────────
 * Escolher B exige afirmar que equilibrar fases vale mais do que um ramal
 * adicional — e, para isso, um limite declarado de desequilíbrio aceitável.
 * Esse limite NÃO existe no sistema para FV. O único que existe é
 * `EV_TRIFASICO_DESBALANÇO` (10 %), do domínio de veículos elétricos: aplicá-lo
 * a microinversores seria fazer exatamente o que a disciplina de fabricante
 * proíbe um nível acima — importar a regra de outro domínio por conveniência.
 *
 * Então A é mantida por ser a política do sistema até aqui, agora NOMEADA e
 * documentada em vez de emergente; e B fica registrada como bloqueio à espera
 * de uma premissa declarada. O que muda na E2 não é o resultado: é que a fase
 * vazia passa a ser um campo próprio (`fases_sem_arranjo`) em vez de um zero
 * que o leitor precisa notar sozinho.
 */
export const POLITICA_ARRANJOS = Object.freeze({
  id: 'minimo_de_ramais',
  rotulo: 'Mínimo de ramais',
  descricao:
    'Cada arranjo é preenchido até o limite do fabricante. Com menos arranjos ' +
    'do que fases, uma fase pode ficar sem nenhum microinversor — o que é ' +
    'declarado, nunca corrigido em silêncio.',
  alternativa_nao_implementada: {
    id: 'ocupar_todas_as_fases',
    motivo:
      'Exige um limite declarado de desequilíbrio aceitável para FV, que não ' +
      'existe no sistema. O limite de 10 % existente é do domínio EV e não se ' +
      'aplica aqui.',
  },
})

/** Inteiro > 0 ou `null`. Vazio, zero e negativo são ausência. */
function _int(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  const i = Math.trunc(n)
  return i > 0 ? i : null
}

/**
 * Número de fases a partir do rótulo que a etapa Projeto grava
 * (`fatura_extracao.tipo_ligacao`). Insensível a acento, como o restante do
 * sistema — `Monofásico` em NFD já custou uma lacuna falsa na Sprint D1.
 * @returns {1|2|3|null}
 */
export function fasesDaInstalacao(rotulo) {
  const s = String(rotulo ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  if (!s) return null
  if (s.includes('trifas')) return 3
  if (s.includes('bifas')) return 2
  if (s.includes('monofas')) return 1
  const n = _int(rotulo)
  return n === 1 || n === 2 || n === 3 ? n : null
}

/**
 * Agrupa `quantidade` microinversores em arranjos de no máximo `maxPorArranjo`.
 *
 * Determinístico e por ENCHIMENTO (ver cabeçalho): 6→[3,3], 7→[3,3,1], 8→[3,3,2].
 * @returns {number[]|null} micros em cada arranjo, na ordem. `null` sem dados.
 */
export function agruparMicrosEmArranjos(quantidade, maxPorArranjo) {
  const q = _int(quantidade)
  const max = _int(maxPorArranjo)
  if (q === null || max === null) return null
  const grupos = []
  let restante = q
  while (restante > 0) {
    const n = Math.min(max, restante)
    grupos.push(n)
    restante -= n
  }
  return grupos
}

/**
 * Reparte os arranjos entre as fases vivas da instalação.
 *
 * Guloso e estável: cada arranjo, na ordem, vai para a fase com MENOS
 * microinversores até aqui; empate resolve pelo menor índice de fase. Rodar duas
 * vezes com a mesma entrada dá a mesma saída — é o que a Sprint E pede por
 * "distribuir a diferença de forma determinística".
 *
 * Monofásico (`nFases === 1`) devolve `null`: não existe balanceamento entre uma
 * fase só, e fabricar `L1` para tudo seria uma coluna vazia na tela.
 *
 * O RESÍDUO nunca é escondido: `desequilibrio` é a diferença entre a fase mais
 * carregada e a menos carregada, em microinversores.
 *
 * @param {number[]} arranjos  micros em cada arranjo
 * @param {number} nFases      1, 2 ou 3
 */
export function balancearFases(arranjos, nFases) {
  const n = _int(nFases)
  if (!Array.isArray(arranjos) || arranjos.length === 0 || n === null || n < 2) return null

  const fases = FASES_VIVAS.slice(0, n)
  const carga = fases.map(() => 0)
  const atribuicao = arranjos.map((micros) => {
    let alvo = 0
    for (let i = 1; i < carga.length; i += 1) if (carga[i] < carga[alvo]) alvo = i
    carga[alvo] += _int(micros) ?? 0
    return fases[alvo]
  })

  const porFase = {}
  fases.forEach((f, i) => { porFase[f] = carga[i] })

  return {
    fases,
    atribuicao,
    por_fase: porFase,
    desequilibrio: Math.max(...carga) - Math.min(...carga),
    equilibrado: Math.max(...carga) - Math.min(...carga) === 0,
    /**
     * Fases que não receberam nenhum arranjo — Sprint E2, §5.
     *
     * Antes isto era um `0` dentro de `por_fase` que o leitor tinha de notar.
     * Uma fase viva SEM geração é qualitativamente diferente de uma fase com
     * menos micros que a vizinha, e a política que a produz (`POLITICA_ARRANJOS`)
     * é uma escolha — então ganha campo próprio, para que nenhuma tela precise
     * inferir a situação comparando números.
     */
    fases_sem_arranjo: fases.filter((f) => porFase[f] === 0),
    politica: POLITICA_ARRANJOS.id,
  }
}

/**
 * Plano completo de UM modelo de microinversor: quantos módulos em cada micro,
 * quais micros em cada arranjo, e qual fase cada arranjo ocupa.
 *
 * É a função que a UX chama. Tudo o que ela devolve é DERIVADO das entradas —
 * não há estado aqui, e chamar duas vezes com a mesma entrada dá o mesmo plano.
 *
 * @param {Object} p
 * @param {number} p.modulos            módulos atribuídos a este modelo
 * @param {number} p.quantidade         quantos microinversores
 * @param {Object} p.micro              { entradas, modulos_por_entrada, fabricante,
 *                                        max_por_cabo_tronco }
 * @param {string|number} [p.fases]     rótulo da ligação ou número de fases
 */
export function planejarMicros({ modulos = null, quantidade = null, micro = {}, fases = null } = {}) {
  const lacunas = []
  const avisos = []

  const nMod = _int(modulos)
  const nMicro = _int(quantidade)
  const capacidade = capacidadeDoMicro(micro)
  const nFases = fasesDaInstalacao(fases)

  if (nMicro === null) lacunas.push('quantidade de microinversores')
  if (nMod === null) lacunas.push('módulos atribuídos ao modelo')
  if (capacidade === null) lacunas.push('entradas / módulos por entrada no catálogo')
  if (nFases === null) lacunas.push('fases da instalação — etapa Projeto')

  // ── Nível de baixo: módulos por micro e por entrada (FV-DOM-031) ──────────
  const distribuicao = distribuirEntreMicros(nMod, nMicro, capacidade)
  const entradasUsadas = distribuicao === null ? null : distribuicao.map(
    (m) => distribuirEntreEntradas(m, micro?.entradas, micro?.modulos_por_entrada))

  // ── Nível de cima: agrupamento em arranjos, pela regra do fabricante ──────
  const regra = regraDeArranjoMicro(micro)
  if (regra.fonte === null) {
    lacunas.push('limite de microinversores por arranjo — não declarado pelo catálogo nem pelo fabricante')
  }

  const tamanhos = agruparMicrosEmArranjos(nMicro, regra.max_por_cabo_tronco)
  const balanceamento = tamanhos === null ? null : balancearFases(tamanhos, nFases)

  /**
   * Cada arranjo com os ÍNDICES (1..N) dos micros que estão nele. Índice, e não
   * cópia dos dados do micro: o micro já está descrito em `micros[]`, e duplicar
   * ficha técnica aqui criaria a segunda fonte que a Sprint E proíbe.
   */
  let arranjos = null
  if (tamanhos !== null) {
    let proximo = 1
    arranjos = tamanhos.map((n, i) => {
      const indices = Array.from({ length: n }, () => proximo++)
      return {
        indice: i + 1,
        micros: indices,
        fase: balanceamento ? balanceamento.atribuicao[i] : null,
        modulos: distribuicao === null
          ? null
          : indices.reduce((s, k) => s + (distribuicao[k - 1] ?? 0), 0),
      }
    })
  }

  if (balanceamento && !balanceamento.equilibrado) {
    avisos.push(
      `Fases desequilibradas em ${balanceamento.desequilibrio} microinversor(es): ` +
      balanceamento.fases.map((f) => `${f} ${balanceamento.por_fase[f]}`).join(' · ') +
      '. A quantidade não é divisível pelo número de fases.',
    )
  }
  if (balanceamento && balanceamento.fases_sem_arranjo.length > 0) {
    avisos.push(
      `${balanceamento.fases_sem_arranjo.join(' e ')} sem nenhum microinversor: ` +
      `${tamanhos.length} arranjo(s) para ${nFases} fases, pela política ` +
      `"${POLITICA_ARRANJOS.rotulo}". Dividir os mesmos micros em mais arranjos ` +
      'ocuparia todas as fases ao custo de um ramal a mais — decisão não ' +
      'automatizada por falta de limite declarado de desequilíbrio.',
    )
  }
  if (nFases === 1 && nMicro !== null) {
    avisos.push('Instalação monofásica: não há balanceamento entre fases a definir.')
  }
  // A desigualdade de MÓDULOS entre micros não é avisada aqui de propósito:
  // `avaliarModeloMicro` (FV-DOM-031) já a emite, e repetir a mesma informação
  // com outra redação na mesma tela é como um sistema perde credibilidade.

  return {
    rotulo: micro?.rotulo ?? null,
    quantidade_micros: nMicro,
    modulos: nMod,
    capacidade_por_micro: capacidade,
    /**
     * Sprint E2, §2 — de ONDE veio a capacidade.
     *
     * A auditoria mediu que NENHUM dos micros do catálogo declara `entradas` ou
     * `modulos_por_entrada`. O operador pode informá-los na tela, e isso é
     * legítimo — mas o resultado não pode se apresentar como dado de catálogo.
     * `procedencia` carrega essa distinção até a UX; quem chama declara a
     * origem, e a ausência de declaração vira `desconhecida`, nunca `ssot`.
     */
    procedencia_capacidade: capacidade === null ? null : (micro?.origem ?? 'desconhecida'),
    distribuicao,
    entradas_por_micro_usadas: entradasUsadas,
    regra,
    arranjos,
    politica: POLITICA_ARRANJOS,
    fases: nFases === null ? null : {
      n: nFases,
      rotulo: nFases === 3 ? 'Trifásico' : nFases === 2 ? 'Bifásico' : 'Monofásico',
      ...(balanceamento ?? {
        fases: null, atribuicao: null, por_fase: null, desequilibrio: null,
        equilibrado: null, fases_sem_arranjo: null, politica: null,
      }),
    },
    lacunas,
    avisos,
    completo: lacunas.length === 0,
  }
}

/**
 * Plano da COMPOSIÇÃO INTEIRA — vários modelos de micro — Sprint E2, §6.
 *
 * ── O que a E2 encontrou ────────────────────────────────────────────────────
 * `micros[]` já é por modelo desde a FV-DOM-031, e `arranjos[]` mora dentro de
 * cada modelo — a estrutura NÃO assume homogeneidade. O defeito estava um nível
 * acima: `planejarMicros` era chamado uma vez por modelo, isoladamente, e cada
 * chamada começava a repartir fases do zero. Dois modelos com 3 micros cada numa
 * instalação trifásica produziam L1 ← modelo A e L1 ← modelo B: a fase mais
 * carregada do sistema, com cada modelo se declarando perfeitamente equilibrado.
 *
 * ── A menor alteração que corrige ───────────────────────────────────────────
 * Capacidade, regra de fabricante e agrupamento continuam POR MODELO — é onde
 * eles pertencem, e modelos com entradas ou limites diferentes seguem tratados
 * individualmente. O que passa a ser global é só o balanceamento: os arranjos de
 * todos os modelos entram numa fila única e são repartidos entre as fases de uma
 * vez. Nenhuma abstração nova, nenhuma mudança de schema.
 *
 * A ordem da fila é a ordem dos modelos na composição — determinística e
 * estável, como exige o §5.
 *
 * @param {Object} p
 * @param {Array} p.modelos  [{ modulos, quantidade, micro }] — `micro` traz
 *                           `rotulo`, `entradas`, `modulos_por_entrada`,
 *                           `fabricante`, `max_por_cabo_tronco`, `origem`
 * @param {string|number} [p.fases]
 */
export function planejarComposicaoMicro({ modelos = [], fases = null } = {}) {
  const nFases = fasesDaInstalacao(fases)

  // 1) Cada modelo forma os SEUS arranjos com a SUA regra e a SUA capacidade.
  const planos = modelos.map((m) => planejarMicros({
    modulos: m?.modulos, quantidade: m?.quantidade, micro: m?.micro, fases,
  }))

  // 2) Os arranjos de todos os modelos entram numa fila única para o balanceamento.
  const fila = []
  planos.forEach((p, iModelo) => {
    (p.arranjos ?? []).forEach((a) => fila.push({ iModelo, arranjo: a }))
  })

  const balanceamento = fila.length === 0 ? null
    : balancearFases(fila.map((f) => f.arranjo.micros.length), nFases)

  // 3) A fase de cada arranjo passa a ser a da fila global.
  if (balanceamento) {
    fila.forEach((f, i) => { f.arranjo.fase = balanceamento.atribuicao[i] })
  } else {
    fila.forEach((f) => { f.arranjo.fase = null })
  }

  // 4) Os avisos de fase do plano individual deixam de valer: quem sabe do
  //    equilíbrio é a composição. Os demais avisos (monofásico, lacunas) ficam.
  const avisosDeFase = /desequilibradas|sem nenhum microinversor/i
  planos.forEach((p) => {
    p.avisos = p.avisos.filter((a) => !avisosDeFase.test(a))
    if (p.fases) {
      p.fases = {
        ...p.fases,
        fases: balanceamento?.fases ?? null,
        atribuicao: null,   // a atribuição vive na composição, não no modelo
        por_fase: null, desequilibrio: null, equilibrado: null, fases_sem_arranjo: null,
      }
    }
  })

  const avisos = []
  if (balanceamento && !balanceamento.equilibrado) {
    avisos.push(
      `Fases desequilibradas em ${balanceamento.desequilibrio} microinversor(es): ` +
      balanceamento.fases.map((f) => `${f} ${balanceamento.por_fase[f]}`).join(' · ') + '.',
    )
  }
  if (balanceamento && balanceamento.fases_sem_arranjo.length > 0) {
    avisos.push(
      `${balanceamento.fases_sem_arranjo.join(' e ')} sem nenhum microinversor: ` +
      `${fila.length} arranjo(s) para ${nFases} fases, pela política ` +
      `"${POLITICA_ARRANJOS.rotulo}".`,
    )
  }
  if (nFases === 1 && fila.length > 0) {
    avisos.push('Instalação monofásica: não há balanceamento entre fases a definir.')
  }

  // Modelos com capacidades ou regras diferentes: dito, nunca uniformizado.
  const capacidades = new Set(planos.map((p) => p.capacidade_por_micro).filter((c) => c !== null))
  if (capacidades.size > 1) {
    avisos.push(
      `Modelos com capacidades diferentes na mesma composição: ` +
      planos.filter((p) => p.capacidade_por_micro !== null)
        .map((p) => `${p.rotulo ?? '—'} ${p.capacidade_por_micro} módulo(s)/micro`).join(' · ') +
      '. Cada um é distribuído pela sua própria capacidade.',
    )
  }
  const limites = new Set(planos.map((p) => p.regra.max_por_cabo_tronco).filter((n) => n !== null))
  if (limites.size > 1 || planos.some((p) => p.regra.fonte === null) && limites.size > 0) {
    avisos.push(
      'Modelos com regras de arranjo diferentes: ' +
      planos.map((p) => `${p.rotulo ?? '—'} ${p.regra.max_por_cabo_tronco ?? 'sem regra'}`).join(' · ') +
      '. Nenhum modelo herda a regra do outro.',
    )
  }

  return {
    por_modelo: planos,
    fases: nFases === null ? null : {
      n: nFases,
      rotulo: nFases === 3 ? 'Trifásico' : nFases === 2 ? 'Bifásico' : 'Monofásico',
      ...(balanceamento ?? {
        fases: null, atribuicao: null, por_fase: null, desequilibrio: null,
        equilibrado: null, fases_sem_arranjo: null, politica: null,
      }),
    },
    politica: POLITICA_ARRANJOS,
    quantidade_micros: planos.reduce((s, p) => s + (p.quantidade_micros ?? 0), 0),
    total_arranjos: fila.length,
    homogenea: capacidades.size <= 1 && limites.size <= 1,
    lacunas: [...new Set(planos.flatMap((p) => p.lacunas))],
    avisos,
    completo: planos.length > 0 && planos.every((p) => p.completo),
  }
}

/**
 * O plano persistido ainda descreve a configuração atual?
 *
 * A Sprint E proíbe estado obsoleto em silêncio (§20). O que persiste é o
 * agrupamento e a fase; o que pode mudar embaixo dele é a quantidade de micros,
 * o modelo (e com ele a regra) e as fases da instalação. Esta função compara o
 * que está gravado com o que o plano vigente produz e diz o que divergiu.
 *
 * @returns {{obsoleto:boolean, motivos:string[]}}
 */
export function planoObsoleto(persistido, plano) {
  const motivos = []
  if (!Array.isArray(persistido) || persistido.length === 0) return { obsoleto: false, motivos }

  const gravadoMicros = persistido.reduce((s, a) => s + (a?.micros?.length ?? 0), 0)
  if (plano?.quantidade_micros !== null && gravadoMicros !== plano?.quantidade_micros) {
    motivos.push(
      `o agrupamento salvo cobre ${gravadoMicros} microinversor(es) e a configuração atual tem ` +
      `${plano.quantidade_micros}`)
  }

  if (Array.isArray(plano?.arranjos)) {
    if (plano.arranjos.length !== persistido.length) {
      motivos.push(`a regra vigente forma ${plano.arranjos.length} arranjo(s) e há ${persistido.length} salvo(s)`)
    } else {
      const fasesSalvas = persistido.map((a) => a?.fase ?? null).join(',')
      const fasesPlano = plano.arranjos.map((a) => a.fase ?? null).join(',')
      if (fasesSalvas !== fasesPlano) motivos.push('a atribuição de fases mudou')
    }
  } else if (plano?.regra?.fonte === null) {
    motivos.push('o modelo atual não tem limite de microinversores por arranjo declarado')
  }

  return { obsoleto: motivos.length > 0, motivos }
}

export default {
  FASES_VIVAS, POLITICA_ARRANJOS, fasesDaInstalacao, agruparMicrosEmArranjos,
  balancearFases, planejarMicros, planejarComposicaoMicro, planoObsoleto,
}
