/**
 * workflowComercial.js — FONTE ÚNICA da máquina de estados comercial do Projeto FV.
 *
 * FV-UX-006 (F3.1). Antes existiam TRÊS definições desta mesma máquina:
 *   1. backend/src/controllers/projetosFVController.js  (WORKFLOW_COMERCIAL,
 *      TRANSICOES_COMERCIAL, ORDEM_COMERCIAL, CONGELADOS_COMERCIAL)
 *   2. frontend/src/utils/comercialStateMachine.js      (ESTADOS, TRANSICOES, …)
 *   3. frontend/src/utils/comercialGovernanca.js        (WORKFLOW_COMERCIAL_CONFIG)
 *
 * A terceira estava DIVERGENTE: só 6 dos 11 estados, `ordem` diferente e
 * `APROVADO` em outra cor. Este módulo consolida a definição completa (1 e 2, que
 * eram idênticas) e passa a alimentar também a 3.
 *
 * Puro e determinístico. Sem I/O, sem framework.
 */

/** Estados do workflow comercial, com metadados de apresentação. */
export const ESTADOS_COMERCIAIS = Object.freeze({
  RASCUNHO:           { label: 'RASCUNHO',           cor: 'cinza',    ordem: 1 },
  EM_ANALISE:         { label: 'EM ANÁLISE',         cor: 'cinza',    ordem: 2 },
  NEGOCIACAO:         { label: 'NEGOCIAÇÃO',         cor: 'amarelo',  ordem: 3 },
  AGUARDANDO_CLIENTE: { label: 'AGUARDANDO CLIENTE', cor: 'azul',     ordem: 4 },
  APROVADO:           { label: 'APROVADO',           cor: 'azul',     ordem: 5 },
  ASSINADO:           { label: 'ASSINADO',           cor: 'verde',    ordem: 6 },
  IMPLANTACAO:        { label: 'IMPLANTAÇÃO',        cor: 'verde',    ordem: 7 },
  CONCLUIDO:          { label: 'CONCLUÍDO',          cor: 'verde',    ordem: 8 },
  // Especiais (terminais ou de saída)
  REPROVADO:          { label: 'REPROVADO',          cor: 'vermelho', ordem: 99 },
  CANCELADO:          { label: 'CANCELADO',          cor: 'vermelho', ordem: 99 },
  EXPIRADO:           { label: 'EXPIRADO',           cor: 'laranja',  ordem: 99 },
})

/** Vocabulário — nomes dos estados, na ordem de declaração. */
export const WORKFLOW_COMERCIAL = Object.freeze(Object.keys(ESTADOS_COMERCIAIS))

/** Ordem numérica por estado (usada para detectar regressão). */
export const ORDEM_COMERCIAL = Object.freeze(
  Object.fromEntries(Object.entries(ESTADOS_COMERCIAIS).map(([k, v]) => [k, v.ordem])),
)

/**
 * Transições permitidas.
 * Após ASSINADO, retroceder exige NOVA REVISÃO — não é transição direta.
 */
export const TRANSICOES_COMERCIAL = Object.freeze({
  RASCUNHO:           ['EM_ANALISE', 'CANCELADO'],
  EM_ANALISE:         ['NEGOCIACAO', 'AGUARDANDO_CLIENTE', 'REPROVADO', 'CANCELADO'],
  NEGOCIACAO:         ['AGUARDANDO_CLIENTE', 'APROVADO', 'REPROVADO', 'CANCELADO'],
  AGUARDANDO_CLIENTE: ['APROVADO', 'NEGOCIACAO', 'REPROVADO', 'EXPIRADO', 'CANCELADO'],
  APROVADO:           ['ASSINADO', 'NEGOCIACAO', 'CANCELADO', 'EXPIRADO'],
  ASSINADO:           ['IMPLANTACAO', 'CANCELADO'],          // sem regressão direta
  IMPLANTACAO:        ['CONCLUIDO', 'CANCELADO'],
  CONCLUIDO:          [],                                     // terminal
  REPROVADO:          ['EM_ANALISE'],                         // reabre análise
  CANCELADO:          [],                                     // terminal
  EXPIRADO:           ['EM_ANALISE'],                         // re-cotação
})

export const ESTADOS_CONGELADOS = Object.freeze(['ASSINADO', 'IMPLANTACAO', 'CONCLUIDO'])
export const ESTADOS_TERMINAIS = Object.freeze(['CONCLUIDO', 'CANCELADO'])

export function getEstadoConfig(estado) {
  return ESTADOS_COMERCIAIS[estado] || ESTADOS_COMERCIAIS.RASCUNHO
}

export function transicoesValidas(estado) {
  return TRANSICOES_COMERCIAL[estado] || []
}

export function estaCongelado(estado) {
  return ESTADOS_CONGELADOS.includes(estado)
}

export function ehEstadoComercialValido(estado) {
  return Object.prototype.hasOwnProperty.call(ESTADOS_COMERCIAIS, estado)
}

/**
 * Valida uma transição de estado comercial.
 * @returns {{ ok: boolean, motivo?: string, requer_revisao?: boolean }}
 */
export function validarTransicaoComercial(de, para) {
  if (de === para) return { ok: false, motivo: 'Estado de origem e destino iguais.' }
  if (!ehEstadoComercialValido(para)) return { ok: false, motivo: `Estado "${para}" inválido.` }

  if (transicoesValidas(de).includes(para)) return { ok: true }

  // Regressão após congelamento exige revisão.
  if (ESTADOS_CONGELADOS.includes(de) && (ORDEM_COMERCIAL[para] ?? 0) < (ORDEM_COMERCIAL[de] ?? 0)) {
    return { ok: false, requer_revisao: true, motivo: `${de}: retroceder para ${para} exige nova revisão comercial.` }
  }

  return { ok: false, motivo: `Transição ${de} → ${para} não permitida.` }
}

// ─── Status jurídico (derivado do estado operacional) ─────────────────────────

export const STATUS_JURIDICO = Object.freeze({
  PENDENTE_ASSINATURA: { label: 'Pendente assinatura', cor: 'amarelo' },
  ASSINADO:            { label: 'Assinado',            cor: 'verde' },
  EXPIRADO:            { label: 'Expirado',            cor: 'laranja' },
  CANCELADO:           { label: 'Cancelado',           cor: 'vermelho' },
  EM_REVISAO:          { label: 'Em revisão',          cor: 'azul' },
})

export function getStatusJuridicoConfig(s) {
  return STATUS_JURIDICO[s] || STATUS_JURIDICO.PENDENTE_ASSINATURA
}

/** Deriva o status jurídico a partir do estado operacional. */
export function statusJuridicoDeEstado(estado) {
  switch (estado) {
    case 'ASSINADO':
    case 'IMPLANTACAO':
    case 'CONCLUIDO':  return 'ASSINADO'
    case 'CANCELADO':  return 'CANCELADO'
    case 'EXPIRADO':   return 'EXPIRADO'
    case 'REPROVADO':  return 'EM_REVISAO'
    default:           return 'PENDENTE_ASSINATURA'
  }
}
