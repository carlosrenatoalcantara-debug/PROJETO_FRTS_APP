/**
 * correnteMicro.js — corrente por entrada, por micro e por ramal — Sprint E2.
 *
 * ── Por que este arquivo existe e o que ele NÃO faz ─────────────────────────
 * A Sprint E deixou a corrente de fora, e a E2 pediu que ela fosse avaliada
 * "sem inventar fórmula, reutilizando o motor canônico se ele existir".
 *
 * Ele existe. Toda a física vem de `engenhariaNormativa`:
 *   `correnteProjeto` = Isc × strings × 1,25 (NBR 16690 §5.2, FATOR_ISC_NBR16690)
 * Nada aqui recalcula isso. Este módulo é o CONECTOR entre aquela primitiva e a
 * topologia `microinversor → entradas → módulos`, mais o veredito contra os
 * limites que o catálogo declara.
 *
 * ── A separação que a E2 exige ──────────────────────────────────────────────
 * Corrente é INDEPENDENTE da distribuição de módulos. Um plano de arranjos
 * perfeitamente distribuído pode ter corrente não avaliada, e vice-versa. Por
 * isso são dois módulos e dois resultados — nunca um veredito só.
 *
 * ── Três níveis, três procedências ──────────────────────────────────────────
 *   ENTRADA CC  Isc de projeto do módulo   × limite `corrente_max_por_mppt`
 *   MICRO CA    `corrente_ac_saida`        (declarado, não calculado)
 *   RAMAL CA    micros × corrente do micro × limite: NENHUM no SSOT
 *
 * O ramal é o caso interessante: o VALOR é calculável e é calculado; o LIMITE
 * (ampacidade do cabo tronco, disjuntor) não existe em nenhum campo do catálogo.
 * Então o valor é informado e o veredito é `nao_avaliado`, com o motivo dito.
 * Inventar um limite normativo aqui seria exatamente o que a E2 proíbe.
 *
 * Puro: sem I/O, sem React, sem dependência de node.
 */
import { correnteProjeto, FATOR_ISC_NBR16690 } from './engenhariaNormativa.js'

/** Vereditos possíveis. `nao_avaliado` é resultado legítimo, não erro. */
export const VEREDITO = Object.freeze({
  OK: 'ok',
  /** Excesso de corrente de OPERAÇÃO: condição técnica, não impedimento. */
  ATENCAO: 'atencao',
  /** Violação de limite ABSOLUTO (curto-circuito): impedimento. */
  EXCEDIDA: 'excedida',
  NAO_AVALIADO: 'nao_avaliado',
})

function _num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function _int(v) {
  const n = _num(v)
  if (n === null) return null
  const i = Math.trunc(n)
  return i > 0 ? i : null
}

/**
 * Corrente na ENTRADA CC de um microinversor.
 *
 * Os `modulos_por_entrada` estão em SÉRIE (FV-DOM-031, decisão 5), e série não
 * soma corrente — por isso `strings = 1`. Se um dia o catálogo declarar módulos
 * em paralelo por entrada, é este parâmetro que muda, não a fórmula.
 *
 * @param {Object} p
 * @param {number} p.iscModulo            Isc do módulo em STC (A)
 * @param {number} p.limiteEntrada        `corrente_max_por_mppt` do catálogo (A)
 */
export function correnteDaEntrada({
  iscModulo = null, imppModulo = null, limiteEntrada = null, limiteCurto = null,
} = {}) {
  const isc = _num(iscModulo)
  const impp = _num(imppModulo)
  const limiteTrabalho = _num(limiteEntrada)
  const limiteIsc = _num(limiteCurto)
  const lacunas = []

  // Corrente de PROJETO (NBR 16690 §5.2) — a que o condutor tem de suportar.
  // Informativa aqui: não é limite do equipamento e não reprova nada.
  const projeto = isc === null ? null : +correnteProjeto(isc, 1).toFixed(2)

  // ── Curto-circuito: o único critério ABSOLUTO da entrada ──────────────────
  let curto
  if (isc === null || limiteIsc === null) {
    if (isc === null) lacunas.push('modulo.isc')
    if (limiteIsc === null) lacunas.push('inversor.corrente_isc_max')
    curto = {
      status: VEREDITO.NAO_AVALIADO, corrente_a: isc, limite_a: limiteIsc, margem_a: null,
      motivo: limiteIsc === null
        ? 'Sem `corrente_isc_max` declarada para este microinversor — o limite ' +
          'de trabalho NÃO é usado no lugar dele.'
        : 'Sem Isc do módulo não há como avaliar o curto-circuito.',
    }
  } else {
    const excede = isc > limiteIsc
    curto = {
      status: excede ? VEREDITO.EXCEDIDA : VEREDITO.OK,
      corrente_a: isc, limite_a: limiteIsc, margem_a: +(limiteIsc - isc).toFixed(2),
      motivo: excede
        ? `Isc do módulo (${isc} A) excede a corrente máxima de curto-circuito ` +
          `declarada pelo microinversor (${limiteIsc} A).`
        : null,
    }
  }

  // ── Operação: excesso é ATENÇÃO, nunca impedimento ───────────────────────
  let operacao
  if (impp === null || limiteTrabalho === null) {
    if (impp === null) lacunas.push('modulo.impp')
    if (limiteTrabalho === null) lacunas.push('inversor.corrente_max_por_mppt')
    operacao = {
      status: VEREDITO.NAO_AVALIADO, corrente_a: impp, limite_a: limiteTrabalho, margem_a: null,
      motivo: impp === null
        // §6: sem Impp, NÃO se usa Isc no lugar. A ausência é declarada.
        ? 'O módulo não declara `impp`; a corrente de curto-circuito não substitui a de operação.'
        : 'Sem corrente máxima de trabalho declarada para a entrada.',
    }
  } else {
    const excede = impp > limiteTrabalho
    operacao = {
      status: excede ? VEREDITO.ATENCAO : VEREDITO.OK,
      corrente_a: impp, limite_a: limiteTrabalho,
      margem_a: +(limiteTrabalho - impp).toFixed(2),
      motivo: excede
        ? `A corrente de operação do módulo (Impp ${impp} A) excede a corrente máxima ` +
          `de entrada declarada pelo microinversor (${limiteTrabalho} A). Há limitação ` +
          'de geração nos picos; não é impedimento elétrico.'
        : null,
    }
  }

  const veredito = curto.status === VEREDITO.EXCEDIDA ? VEREDITO.EXCEDIDA
    : operacao.status === VEREDITO.ATENCAO ? VEREDITO.ATENCAO
      : curto.status === VEREDITO.NAO_AVALIADO || operacao.status === VEREDITO.NAO_AVALIADO
        ? VEREDITO.NAO_AVALIADO
        : VEREDITO.OK

  return {
    veredito,
    operacao,
    curto_circuito: curto,
    projeto_normativa: {
      corrente_a: projeto, fator: FATOR_ISC_NBR16690, norma: 'NBR 16690 §5.2',
      limite_trabalho_a: limiteTrabalho,
      acima_do_trabalho: projeto === null || limiteTrabalho === null
        ? null : projeto > limiteTrabalho,
      decide_compatibilidade: false,
    },
    lacunas: [...new Set(lacunas)],
    motivo: curto.motivo ?? operacao.motivo ?? null,
  }
}

/**
 * Corrente CA de UM microinversor. É DECLARADA (`corrente_ac_saida`), não
 * derivada de potência/tensão: derivar exigiria tensão e fator de potência que
 * a maioria dos micros do catálogo não declara, e o resultado pareceria medido.
 */
export function correnteDoMicro({ correnteAcSaida = null } = {}) {
  const i = _num(correnteAcSaida)
  return i === null
    ? {
        veredito: VEREDITO.NAO_AVALIADO, corrente_a: null, lacunas: ['inversor.corrente_ac_saida'],
        // A redação evita repetir o prefixo do aviso de lacunas do envelope
        // ("O catálogo não declara: …"): são duas informações distintas, e na
        // mesma tela elas não podem se confundir.
        motivo: 'Sem `corrente_ac_saida` declarada para este modelo.',
      }
    : { veredito: VEREDITO.OK, corrente_a: i, lacunas: [], motivo: null }
}

/**
 * Corrente CA acumulada de UM RAMAL (arranjo) — N micros no mesmo cabo tronco.
 *
 * O VALOR é calculado. O VEREDITO é sempre `nao_avaliado`, porque o limite do
 * ramal — ampacidade do tronco e disjuntor — não existe em campo nenhum do
 * catálogo. Dizer "ok" sem limite seria afirmar o que não se sabe; a E2 chama
 * isso de mascarar a ausência.
 */
export function correnteDoRamal({ correnteAcSaida = null, micros = null } = {}) {
  const i = _num(correnteAcSaida)
  const n = _int(micros)
  const lacunas = []
  if (i === null) lacunas.push('inversor.corrente_ac_saida')
  if (n === null) lacunas.push('micros no arranjo')

  const corrente = i === null || n === null ? null : +(i * n).toFixed(2)
  return {
    veredito: VEREDITO.NAO_AVALIADO,
    corrente_a: corrente, micros: n, limite_a: null, lacunas,
    motivo: corrente === null
      ? `Sem ${lacunas.join(' e ')} não há corrente de ramal a informar.`
      : 'Valor informado, veredito não emitido: o catálogo não declara limite de ' +
        'corrente para o cabo tronco (ampacidade e disjuntor do ramal).',
  }
}

/**
 * Avaliação de corrente de UM modelo de micro dentro de um plano de arranjos.
 * Devolve os três níveis; cada um com o seu próprio veredito e as suas lacunas.
 *
 * @param {Object} p
 * @param {Object} p.micro     { corrente_max_por_mppt, corrente_ac_saida }
 * @param {number} p.iscModulo
 * @param {number[]} [p.microsPorArranjo] micros em cada ramal (do plano)
 */
export function avaliarCorrenteMicro({
  micro = {}, iscModulo = null, imppModulo = null, microsPorArranjo = null,
} = {}) {
  const entrada = correnteDaEntrada({
    iscModulo,
    imppModulo,
    limiteEntrada: micro?.corrente_max_por_mppt,
    limiteCurto: micro?.corrente_isc_max,
  })
  const unidade = correnteDoMicro({ correnteAcSaida: micro?.corrente_ac_saida })
  const ramais = Array.isArray(microsPorArranjo)
    ? microsPorArranjo.map((n, i) => ({
        arranjo: i + 1,
        ...correnteDoRamal({ correnteAcSaida: micro?.corrente_ac_saida, micros: n }),
      }))
    : null

  const lacunas = [...new Set([
    ...entrada.lacunas, ...unidade.lacunas,
    ...(ramais ?? []).flatMap((r) => r.lacunas),
  ])]

  return {
    entrada,
    micro: unidade,
    ramais,
    lacunas,
    /**
     * Precedência do veredito global: impedimento vence atenção, e atenção
     * vence "não avaliado". O ramal nunca é avaliável hoje (não há limite no
     * SSOT), então o global nunca chega a `ok` — e isso é a informação, não um
     * defeito a esconder. O que mudou é que ATENÇÃO deixou de ser engolida por
     * `nao_avaliado`: excesso de corrente de operação é visível por si.
     */
    veredito: entrada.veredito === VEREDITO.EXCEDIDA
      ? VEREDITO.EXCEDIDA
      : entrada.veredito === VEREDITO.ATENCAO
        ? VEREDITO.ATENCAO
        : VEREDITO.NAO_AVALIADO,
  }
}

export default {
  VEREDITO, correnteDaEntrada, correnteDoMicro, correnteDoRamal, avaliarCorrenteMicro,
}
