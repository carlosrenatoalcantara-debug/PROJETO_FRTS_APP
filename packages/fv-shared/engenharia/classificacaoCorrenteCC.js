/**
 * classificacaoCorrenteCC.js — classificação canônica de corrente CC — F1.
 *
 * ── Por que este arquivo existe ──────────────────────────────────────────────
 * A regra que separa corrente de OPERAÇÃO, corrente de CURTO e corrente de
 * PROJETO nasceu dentro de `analisarCompatibilidade`, no backend. O wizard
 * legado precisa do MESMO veredito por MPPT, no navegador, para pintar cada
 * cartão — e uma chamada HTTP por MPPT não é caminho.
 *
 * A saída fácil seria repetir as três comparações no React. Foi exatamente o que
 * a auditoria encontrou lá (`correnteProjeto(...) > corrente_max_mppt`, em três
 * lugares), e o resultado foi o sistema dando dois vereditos diferentes para a
 * mesma pergunta depois que o motor foi corrigido.
 *
 * Então a regra sai de dentro do service e vira função pura aqui. Não é um
 * segundo motor: é a MESMA implementação, agora chamável dos dois lados.
 * `analisarCompatibilidade` passou a consumi-la e nada mais a reescreve.
 *
 * ── As três grandezas, e o que cada uma decide ───────────────────────────────
 *   Impp × strings   × limite de TRABALHO   → ATENÇÃO      (limita geração)
 *   Isc  × strings   × limite de CURTO      → INCOMPATÍVEL (limite absoluto)
 *   Isc  × strings × 1,25 × limite de TRAB. → ATENÇÃO      (dimensiona condutor)
 *
 * O fator 1,25 é a corrente de projeto da NBR 16690 §5.2 — a que o CABO e a
 * proteção têm de suportar. Ele nunca decide compatibilidade: era essa confusão
 * que reprovava módulo por ultrapassar um limite que não é o dele.
 *
 * ── Ausência não vira aprovação ──────────────────────────────────────────────
 * Sem limite de curto declarado, o critério absoluto é `nao_avaliado` — e o
 * limite de trabalho NÃO entra no lugar dele. Sem Impp, a operação é
 * `nao_avaliado` — e Isc NÃO o substitui.
 *
 * Puro: sem I/O, sem React, sem dependência de node.
 */
import { correnteProjeto, FATOR_ISC_NBR16690 } from './engenhariaNormativa.js'

/**
 * Vocabulário de classificação. Espelha `STATUS_CRITERIO` do service, que passou
 * a reexportá-lo — um nome só para o mesmo conceito.
 */
export const STATUS_CORRENTE = Object.freeze({
  OK:           'ok',
  ATENCAO:      'atencao',
  INCOMPATIVEL: 'incompativel',
  NAO_AVALIADO: 'nao_avaliado',
})

function _num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Arredonda para 3 casas — mesma precisão que o service já usava. */
const _r = (v) => Math.round(v * 1000) / 1000

/**
 * Classifica a corrente CC de um agrupamento (uma entrada MPPT, ou uma string).
 *
 * @param {Object} p
 * @param {number} p.isc            Isc do módulo em STC (A)
 * @param {number} p.impp           Impp do módulo em STC (A)
 * @param {number} [p.strings]      strings em paralelo neste agrupamento
 * @param {number} p.limiteTrabalho `corrente_max_por_mppt` do catálogo (A)
 * @param {number} p.limiteCurto    `corrente_isc_max` do catálogo (A)
 * @returns {{operacao, curto_circuito, projeto_normativa, status}}
 */
export function classificarCorrenteCC({
  isc = null, impp = null, strings = 1, limiteTrabalho = null, limiteCurto = null,
} = {}) {
  const vIsc = _num(isc)
  const vImpp = _num(impp)
  const n = _num(strings) ?? 1
  const lTrab = _num(limiteTrabalho)
  const lCurto = _num(limiteCurto)

  const isc_operacao = vIsc === null ? null : _r(vIsc * n)
  const impp_total = vImpp === null ? null : _r(vImpp * n)
  const isc_projeto = vIsc === null ? null : _r(correnteProjeto(vIsc, n))

  // ── Curto-circuito: o único critério que reprova ──────────────────────────
  const curto = isc_operacao === null || lCurto === null
    ? {
        status: STATUS_CORRENTE.NAO_AVALIADO,
        isc_operacao, limite_a: lCurto, margem_a: null,
        motivo: lCurto === null
          ? 'O catálogo não declara `corrente_isc_max` para este inversor. Sem o '
            + 'limite de curto-circuito, o critério não é avaliado — a corrente de '
            + 'trabalho NÃO é usada no lugar dele.'
          : 'Sem Isc do módulo não há como avaliar o curto-circuito.',
      }
    : {
        status: isc_operacao > lCurto ? STATUS_CORRENTE.INCOMPATIVEL : STATUS_CORRENTE.OK,
        isc_operacao, limite_a: lCurto, margem_a: _r(lCurto - isc_operacao),
        motivo: null,
      }

  // ── Operação: excesso é condição técnica, não impedimento ─────────────────
  const operacao = impp_total === null || lTrab === null
    ? {
        status: STATUS_CORRENTE.NAO_AVALIADO,
        impp_total, limite_a: lTrab, margem_a: null,
        motivo: impp_total === null
          ? 'O módulo não declara `impp`; a corrente de curto-circuito não '
            + 'substitui a de operação.'
          : 'O catálogo não declara a corrente máxima de trabalho da entrada.',
      }
    : {
        status: impp_total > lTrab ? STATUS_CORRENTE.ATENCAO : STATUS_CORRENTE.OK,
        impp_total, limite_a: lTrab, margem_a: _r(lTrab - impp_total),
        motivo: null,
      }

  // ── Projeto normativa: informação de dimensionamento, nunca veredito ──────
  const projeto = {
    isc_total: isc_projeto,
    fator: FATOR_ISC_NBR16690,
    norma: 'NBR 16690 §5.2',
    limite_trabalho_a: lTrab,
    acima_do_trabalho: isc_projeto === null || lTrab === null ? null : isc_projeto > lTrab,
    decide_compatibilidade: false,
  }

  const status = curto.status === STATUS_CORRENTE.INCOMPATIVEL
    ? STATUS_CORRENTE.INCOMPATIVEL
    : operacao.status === STATUS_CORRENTE.ATENCAO || projeto.acima_do_trabalho === true
      ? STATUS_CORRENTE.ATENCAO
      : curto.status === STATUS_CORRENTE.NAO_AVALIADO
        || operacao.status === STATUS_CORRENTE.NAO_AVALIADO
        ? STATUS_CORRENTE.NAO_AVALIADO
        : STATUS_CORRENTE.OK

  return { operacao, curto_circuito: curto, projeto_normativa: projeto, status }
}

export default { STATUS_CORRENTE, classificarCorrenteCC }
