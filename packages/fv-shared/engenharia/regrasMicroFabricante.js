/**
 * regrasMicroFabricante.js — regras de ARRANJO de microinversores — Sprint E.
 *
 * ── O problema que este arquivo resolve ──────────────────────────────────────
 * Quantos microinversores podem ficar no MESMO ramal CA não é física geral: é
 * limite de fábrica, e cada fabricante declara o seu. A auditoria da Sprint E
 * mediu que o SSOT NÃO carrega esse dado hoje — `dicionarioInversor` conhece
 * `entradas` e `modulos_por_entrada` (FV-DOM-031, decisão 2), mas nada sobre
 * agrupamento em ramais, e nenhum dos 13 micros do catálogo o declara.
 *
 * Sem esse número não há como formar arranjos. As duas saídas erradas seriam:
 *   • inventar um default (3, 4, o que for) — a Sprint E proíbe explicitamente;
 *   • aplicar a regra de um fabricante aos outros — proibido pelo mesmo motivo.
 *
 * A saída correta é DECLARAR a lacuna. Este arquivo é a terceira via: uma tabela
 * de regras EXPLICITAMENTE autoradas, com procedência, que valem SÓ para o
 * fabricante que nomeiam. O que não estiver aqui nem no catálogo não tem regra —
 * e isso é dito, não preenchido.
 *
 * ── Precedência ─────────────────────────────────────────────────────────────
 *   1. `max_por_cabo_tronco` declarado no CATÁLOGO para aquele modelo (SSOT);
 *   2. tabela abaixo, casada pelo FABRICANTE do modelo selecionado;
 *   3. nenhuma — `fonte: null`, e quem chama declara a lacuna.
 *
 * O catálogo vence a tabela: o dado do modelo é mais específico que o do
 * fabricante, e é ele que a SSOT passa a aceitar (campo novo no dicionário).
 * Quando o catálogo passar a declarar o campo para os micros Deye, esta entrada
 * deixa de ser consultada sozinha — sem alterar código.
 *
 * Puro: sem I/O, sem React, sem dependência de node.
 */

/**
 * Regras autoradas, por fabricante. Chave = token do fabricante em minúsculas,
 * sem acento. `procedencia` é obrigatória: regra sem origem declarada não entra.
 */
export const REGRAS_MICRO_POR_FABRICANTE = Object.freeze({
  deye: Object.freeze({
    fabricante: 'Deye',
    max_por_cabo_tronco: 3,
    procedencia:
      'Limite de fábrica do ecossistema Deye: no máximo 3 microinversores ' +
      'em série no mesmo ramal CA.',
  }),
})

/**
 * Tokens do nome do fabricante, minúsculos e sem acento.
 * `\p{M}` (marca combinante) remove os diacríticos que o NFD separou — mesma
 * intenção do `[̀-ͯ]` usado no resto do pacote, escrito em ASCII puro
 * para não depender de caracteres combinantes no próprio código-fonte.
 */
function _tokens(fabricante) {
  return String(fabricante ?? '')
    .normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/** Inteiro > 0 ou `null`. Vazio, zero e negativo são ausência. */
function _int(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  const i = Math.trunc(n)
  return i > 0 ? i : null
}

/**
 * A regra de agrupamento aplicável a UM modelo de microinversor.
 *
 * Casamento por TOKEN exato, não por substring: `'Deye'` e `'DEYE SOLAR'`
 * casam, `'Deyeco'` não. Substring faria um fabricante herdar a regra do outro
 * por coincidência de grafia — exatamente o que a Sprint E proíbe.
 *
 * @param {Object} micro { fabricante, max_por_cabo_tronco }
 * @returns {{max_por_cabo_tronco:number|null, fonte:'catalogo'|'fabricante'|null,
 *            fabricante:string|null, procedencia:string|null}}
 */
export function regraDeArranjoMicro(micro = {}) {
  const doCatalogo = _int(micro?.max_por_cabo_tronco)
  if (doCatalogo !== null) {
    return {
      max_por_cabo_tronco: doCatalogo,
      fonte: 'catalogo',
      fabricante: micro?.fabricante ?? null,
      procedencia: 'Declarado no catálogo para este modelo.',
    }
  }

  for (const t of _tokens(micro?.fabricante)) {
    const regra = REGRAS_MICRO_POR_FABRICANTE[t]
    if (regra) {
      return {
        max_por_cabo_tronco: regra.max_por_cabo_tronco,
        fonte: 'fabricante',
        fabricante: regra.fabricante,
        procedencia: regra.procedencia,
      }
    }
  }

  return {
    max_por_cabo_tronco: null,
    fonte: null,
    fabricante: micro?.fabricante ?? null,
    procedencia: null,
  }
}

/** Há regra aplicável? Pergunta que a UX faz para decidir o que mostrar. */
export const temRegraDeArranjo = (micro) => regraDeArranjoMicro(micro).fonte !== null
