/**
 * orcamento.js — máquina de estados do Orçamento (FV-DOM-001).
 *
 * Fonte única, no mesmo lugar das demais máquinas do Projeto FV (F3.1).
 * Pura e determinística: sem I/O, sem Mongoose, sem Express.
 *
 * O Orçamento é a PROPOSTA COMERCIAL derivada de uma Cotação. Um projeto tem N
 * orçamentos; nenhum substitui outro. Só um chega a APROVADO — e, ao chegar,
 * congela (M-2) e origina o Baseline.
 */

export const ESTADOS_ORCAMENTO = Object.freeze({
  RASCUNHO:  { label: 'Rascunho',  cor: 'cinza',    ordem: 1, descricao: 'Em elaboração — conteúdo editável.' },
  EMITIDO:   { label: 'Emitido',   cor: 'azul',     ordem: 2, descricao: 'Enviado ao cliente — conteúdo travado.' },
  APROVADO:  { label: 'Aprovado',  cor: 'verde',    ordem: 3, descricao: 'Aceito pelo cliente — originou o Baseline.' },
  REJEITADO: { label: 'Rejeitado', cor: 'vermelho', ordem: 99, descricao: 'Recusado pelo cliente.' },
  CANCELADO: { label: 'Cancelado', cor: 'vermelho', ordem: 99, descricao: 'Retirado pela empresa.' },
})

/** Vocabulário canônico. Alimenta o enum do schema e os guards do serviço. */
export const ORCAMENTO_STATUS = Object.freeze(Object.keys(ESTADOS_ORCAMENTO))

/**
 * Transições permitidas.
 *
 * APROVADO é TERMINAL: aprovar congela o orçamento e gera o Baseline (M-2).
 * Reabrir não existe — a saída é emitir um NOVO orçamento, preservando o
 * histórico. REJEITADO/CANCELADO também são terminais pelo mesmo motivo.
 */
export const TRANSICOES_ORCAMENTO = Object.freeze({
  RASCUNHO:  ['EMITIDO', 'CANCELADO'],
  EMITIDO:   ['APROVADO', 'REJEITADO', 'CANCELADO'],
  APROVADO:  [],
  REJEITADO: [],
  CANCELADO: [],
})

/** Estados em que o conteúdo do orçamento não pode mais ser alterado. */
export const ORCAMENTO_CONTEUDO_TRAVADO = Object.freeze(['EMITIDO', 'APROVADO', 'REJEITADO', 'CANCELADO'])

/** Estados terminais — nenhuma transição de saída. */
export const ORCAMENTO_TERMINAIS = Object.freeze(['APROVADO', 'REJEITADO', 'CANCELADO'])

export function ehEstadoOrcamentoValido(estado) {
  return Object.prototype.hasOwnProperty.call(ESTADOS_ORCAMENTO, estado)
}

export function getEstadoOrcamentoConfig(estado) {
  return ESTADOS_ORCAMENTO[estado] || ESTADOS_ORCAMENTO.RASCUNHO
}

export function transicoesOrcamentoValidas(estado) {
  return TRANSICOES_ORCAMENTO[estado] || []
}

/** O conteúdo do orçamento está travado neste estado? */
export function conteudoTravado(estado) {
  return ORCAMENTO_CONTEUDO_TRAVADO.includes(estado)
}

export function ehTerminal(estado) {
  return ORCAMENTO_TERMINAIS.includes(estado)
}

/**
 * Valida uma transição de estado do Orçamento.
 * @returns {{ ok: boolean, motivo?: string }}
 */
export function validarTransicaoOrcamento(de, para) {
  if (!ehEstadoOrcamentoValido(de))   return { ok: false, motivo: `Estado de origem "${de}" inválido.` }
  if (!ehEstadoOrcamentoValido(para)) return { ok: false, motivo: `Estado "${para}" inválido.` }
  if (de === para) return { ok: false, motivo: 'Estado de origem e destino iguais.' }
  if (transicoesOrcamentoValidas(de).includes(para)) return { ok: true }
  if (ehTerminal(de)) {
    return { ok: false, motivo: `${de} é terminal — emita um NOVO orçamento em vez de reabrir este.` }
  }
  return { ok: false, motivo: `Transição ${de} → ${para} não permitida.` }
}
