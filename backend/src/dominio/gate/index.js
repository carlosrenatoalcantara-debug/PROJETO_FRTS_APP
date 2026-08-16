/**
 * gate/ — Gate de Bifurcação — FV-DOM-001 (Fase 1 do fluxo canônico).
 *
 * No fluxo canônico, Engenharia e Homologação só existem DEPOIS da aprovação:
 *
 *     … → Orçamento → Aprovação → [GATE] → ⑂ Engenharia ∥ Homologação
 *
 * Hoje as duas são acessíveis a qualquer momento (divergência DIV-7 da auditoria
 * FV-UX-001). Este módulo é a regra que fecha essa porta.
 *
 * ── Onde a regra vive ────────────────────────────────────────────────────────
 * "Não utilizar validações apenas na interface."
 *
 * Por isso o gate é DOMÍNIO PURO — sem I/O, sem Mongoose, sem Express. Recebe o
 * Baseline já carregado e decide. Quem consome (serviço, controller, futuro
 * middleware) não reimplementa a decisão: chama `exigirBaseline` e propaga o
 * erro. A interface pode espelhar o resultado para dar boa experiência, nunca
 * para substituí-lo.
 *
 * Nesta sprint o gate NÃO implementa Engenharia nem Homologação — apenas as
 * bloqueia enquanto não houver Baseline válida.
 */

import { verificarIntegridade } from '../baseline/congelarOrcamento.js'

/** Fases que o gate protege. */
export const FASES_BIFURCACAO = Object.freeze(['engenharia', 'homologacao'])

/** Motivos de bloqueio — vocabulário estável para o cliente da API. */
export const MOTIVOS_GATE = Object.freeze({
  SEM_BASELINE:        'SEM_BASELINE',
  BASELINE_CORROMPIDA: 'BASELINE_CORROMPIDA',
  FASE_DESCONHECIDA:   'FASE_DESCONHECIDA',
})

export class ErroGate extends Error {
  constructor(motivo, mensagem) {
    super(mensagem)
    this.name = 'ErroGate'
    this.codigo = motivo
    this.status = motivo === MOTIVOS_GATE.FASE_DESCONHECIDA ? 400 : 409
  }
}

/**
 * Avalia o gate. PURO — não lança, apenas decide.
 *
 * @param {object} args
 * @param {string} args.fase       'engenharia' | 'homologacao'
 * @param {object|null} args.baseline  Baseline do projeto (plano ou documento), ou null
 * @returns {{ liberado: boolean, motivo?: string, mensagem?: string }}
 */
export function avaliarGate({ fase, baseline }) {
  if (!FASES_BIFURCACAO.includes(fase)) {
    return {
      liberado: false,
      motivo: MOTIVOS_GATE.FASE_DESCONHECIDA,
      mensagem: `Fase "${fase}" não é protegida pelo gate. Esperado: ${FASES_BIFURCACAO.join(' | ')}.`,
    }
  }

  if (!baseline) {
    return {
      liberado: false,
      motivo: MOTIVOS_GATE.SEM_BASELINE,
      mensagem: `${fase} exige Baseline Contratual. Aprove um orçamento antes de prosseguir.`,
    }
  }

  // Uma baseline adulterada é pior que a ausência dela: destravaria as fases
  // seguintes sobre um contrato que não é o que foi aprovado.
  if (!verificarIntegridade(baseline)) {
    return {
      liberado: false,
      motivo: MOTIVOS_GATE.BASELINE_CORROMPIDA,
      mensagem: `Baseline do projeto falhou na verificação de integridade — ${fase} bloqueada.`,
    }
  }

  return { liberado: true }
}

/**
 * Mesma decisão de `avaliarGate`, em forma imperativa: lança `ErroGate` quando
 * bloqueado. É o ponto que serviços e controllers devem chamar.
 */
export function exigirBaseline({ fase, baseline }) {
  const r = avaliarGate({ fase, baseline })
  if (!r.liberado) throw new ErroGate(r.motivo, r.mensagem)
  return true
}

export { verificarIntegridade }
