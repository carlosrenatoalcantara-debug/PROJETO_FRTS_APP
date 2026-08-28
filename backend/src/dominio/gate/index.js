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
  // FV-DOM-032 — opções concorrentes da mesma proposta.
  PROPOSTA_SEM_ACEITE: 'PROPOSTA_SEM_ACEITE',
  OPCAO_NAO_ESCOLHIDA: 'OPCAO_NAO_ESCOLHIDA',
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
export function avaliarGate({ fase, baseline, opcao = null }) {
  if (!FASES_BIFURCACAO.includes(fase)) {
    return {
      liberado: false,
      motivo: MOTIVOS_GATE.FASE_DESCONHECIDA,
      mensagem: `Fase "${fase}" não é protegida pelo gate. Esperado: ${FASES_BIFURCACAO.join(' | ')}.`,
    }
  }

  /**
   * FV-DOM-032 (regras 5, 7 e 9) — o filtro das opções vem ANTES da Baseline.
   *
   * A ordem importa. Uma opção não escolhida PODE ter Baseline íntegra: a regra
   * 7 manda preservá-la, imutável. O que ela não pode é atravessar o Gate. Se a
   * Baseline fosse avaliada primeiro, uma opção perdedora com contrato válido
   * receberia `liberado: true` antes de qualquer um perguntar se ela foi
   * escolhida.
   *
   * `opcao` é `null` em projeto que não participa de proposta com opções — e aí
   * este bloco não faz nada, e o gate decide exatamente como decidia antes.
   */
  if (opcao) {
    if (!opcao.aceita && opcao.grupo_tem_aceita) {
      return {
        liberado: false,
        motivo: MOTIVOS_GATE.OPCAO_NAO_ESCOLHIDA,
        mensagem: `${opcao.rotulo ?? 'Esta opção'} não foi a escolhida da proposta. ` +
          'Permanece no histórico e continua consultável, mas não avança para ' +
          `${fase}. A Baseline dela, se existir, segue íntegra e imutável.`,
      }
    }
    if (!opcao.aceita) {
      return {
        liberado: false,
        motivo: MOTIVOS_GATE.PROPOSTA_SEM_ACEITE,
        mensagem: `A proposta tem ${opcao.total_opcoes ?? 'várias'} opções e nenhuma foi aceita. ` +
          `Aceitar uma opção é ato separado da aprovação do orçamento — ${fase} bloqueada até lá.`,
      }
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
export function exigirBaseline({ fase, baseline, opcao = null }) {
  const r = avaliarGate({ fase, baseline, opcao })
  if (!r.liberado) throw new ErroGate(r.motivo, r.mensagem)
  return true
}

/**
 * Estado da OPÇÃO para o gate, derivado das irmãs do grupo — FV-DOM-032.
 *
 * Puro: recebe o projeto e as irmãs já carregadas, devolve o que `avaliarGate`
 * precisa. `null` quando o projeto não participa de proposta com opções, para
 * que o gate siga o caminho de sempre.
 *
 * @param {object} projeto  o ProjetoFV avaliado
 * @param {Array}  irmas    todos os projetos do mesmo `proposta_grupo_id` (inclui ele)
 */
export function estadoDaOpcao(projeto, irmas = []) {
  if (!projeto?.proposta_grupo_id) return null
  const grupo = irmas.filter((p) => String(p?.proposta_grupo_id) === String(projeto.proposta_grupo_id))
  // Um grupo de uma opção só não é uma escolha — não bloqueia nada.
  if (grupo.length < 2) return null
  return {
    aceita: projeto?.proposta_aceite?.aceita === true,
    grupo_tem_aceita: grupo.some((p) => p?.proposta_aceite?.aceita === true),
    rotulo: projeto?.opcao_rotulo ?? null,
    total_opcoes: grupo.length,
  }
}

export { verificarIntegridade }
