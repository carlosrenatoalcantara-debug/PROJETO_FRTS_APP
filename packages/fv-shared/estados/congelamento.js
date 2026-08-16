/**
 * congelamento.js — CONTRATO ÚNICO de congelamento do Projeto FV.
 *
 * FV-DOM-002A (Parte A). Antes desta sprint, a pergunta "este projeto está
 * congelado?" era respondida em 17 lugares diferentes, cada um reimplementando
 * `['CONGELADO','HOMOLOGADO'].includes(governanca.freeze_status)` — e nenhum
 * deles sabia da existência do Baseline.
 *
 * ── Regra canônica ───────────────────────────────────────────────────────────
 *
 *     Um Projeto FV está CONGELADO ⟺ existe Orçamento APROVADO
 *                                   ∧ existe Baseline VÁLIDA
 *
 * Uma coisa só define o congelamento: o contrato. Não o estado de um campo, não
 * a presença de um snapshot, não a assinatura comercial. Tudo o mais é derivado.
 *
 * ── Cláusula de compatibilidade (temporária) ─────────────────────────────────
 * Projetos anteriores à FV-DOM-001 têm `freeze_status: CONGELADO|HOMOLOGADO` e
 * NENHUM agregado — nunca passaram por Orçamento/Baseline. Aplicar a regra
 * canônica sozinha os DESCONGELARIA, reabrindo contratos já fechados. Por isso
 * o legado também congela, com motivo próprio e rastreável.
 *
 * A cláusula sai quando o backfill de Cotacao/Orcamento/Baseline for concluído
 * (responsabilidade do LME, ADR-022). Até lá, `motivo` distingue os dois casos e
 * `precisaBackfill` permite contá-los.
 *
 * Puro e determinístico: sem I/O, sem Mongoose, sem Express.
 */

export const MOTIVO_CONGELAMENTO = Object.freeze({
  /** Regra canônica: orçamento aprovado + baseline válida. */
  CONTRATO:            'CONTRATO',
  /** Compatibilidade: `governanca.freeze_status` legado, sem agregados. */
  LEGADO_FREEZE:       'LEGADO_FREEZE',
  /** Compatibilidade: workflow comercial ASSINADO, sem agregados. */
  LEGADO_ASSINATURA:   'LEGADO_ASSINATURA',
  /** Aprovado sem baseline: estado incompleto — NÃO congela (falha segura). */
  APROVADO_SEM_BASELINE: 'APROVADO_SEM_BASELINE',
  /** Não congelado. */
  ABERTO:              'ABERTO',
})

/** Valores de `freeze_status` que congelavam no modelo legado. */
const FREEZE_LEGADO_TRAVA = ['CONGELADO', 'HOMOLOGADO']
/** Valores de `workflow_status` que congelavam no modelo legado. */
const WORKFLOW_LEGADO_TRAVA = ['ASSINADO', 'IMPLANTACAO', 'CONCLUIDO']

/**
 * Decide o congelamento a partir de fatos já resolvidos.
 *
 * @param {object} f
 * @param {boolean} f.orcamentoAprovado  há orçamento em APROVADO?
 * @param {boolean} f.baselineValida     há Baseline e sua integridade confere?
 * @param {string}  [f.freeze_status]    `governanca.freeze_status` (legado)
 * @param {string}  [f.workflow_status]  `governanca.comercial.workflow_status` (legado)
 * @returns {{ congelado: boolean, motivo: string, canonico: boolean, precisaBackfill: boolean, detalhe: string }}
 */
export function avaliarCongelamento({
  orcamentoAprovado = false,
  baselineValida = false,
  freeze_status = null,
  workflow_status = null,
} = {}) {
  // 1) Regra canônica — tem precedência sobre qualquer sinal legado.
  if (orcamentoAprovado && baselineValida) {
    return {
      congelado: true,
      motivo: MOTIVO_CONGELAMENTO.CONTRATO,
      canonico: true,
      precisaBackfill: false,
      detalhe: 'Orçamento aprovado com Baseline válida.',
    }
  }

  // 2) Aprovado sem baseline: estado incompleto (falha no congelamento). NÃO
  //    congela — é o mesmo modo seguro adotado no Gate: sem baseline, nada
  //    avança. Reportado com motivo próprio para ser detectável.
  if (orcamentoAprovado && !baselineValida) {
    return {
      congelado: false,
      motivo: MOTIVO_CONGELAMENTO.APROVADO_SEM_BASELINE,
      canonico: true,
      precisaBackfill: false,
      detalhe: 'Orçamento aprovado sem Baseline válida — contrato incompleto.',
    }
  }

  // 3) Compatibilidade — some após o backfill.
  if (FREEZE_LEGADO_TRAVA.includes(freeze_status)) {
    return {
      congelado: true,
      motivo: MOTIVO_CONGELAMENTO.LEGADO_FREEZE,
      canonico: false,
      precisaBackfill: true,
      detalhe: `Projeto legado com freeze_status=${freeze_status} e sem agregados.`,
    }
  }
  if (WORKFLOW_LEGADO_TRAVA.includes(workflow_status)) {
    return {
      congelado: true,
      motivo: MOTIVO_CONGELAMENTO.LEGADO_ASSINATURA,
      canonico: false,
      precisaBackfill: true,
      detalhe: `Projeto legado com workflow_status=${workflow_status} e sem agregados.`,
    }
  }

  return {
    congelado: false,
    motivo: MOTIVO_CONGELAMENTO.ABERTO,
    canonico: true,
    precisaBackfill: false,
    detalhe: 'Sem contrato fechado — projeto editável.',
  }
}

/** Atalho booleano. Use `avaliarCongelamento` quando precisar do motivo. */
export function estaCongelado(fatos) {
  return avaliarCongelamento(fatos).congelado
}

/**
 * Porta ÚNICA para consumidores SÍNCRONOS que já têm o projeto em mãos.
 *
 * A regra canônica depende de I/O (orçamento e baseline vivem em coleções
 * próprias). Quem já resolveu isso anexa a decisão em `projeto.congelamento` —
 * `resolverCongelamento` no backend faz exatamente isso. Quem não resolveu cai
 * nos campos legados do próprio documento.
 *
 * O ponto é que NENHUM consumidor volte a escrever
 * `['CONGELADO','HOMOLOGADO'].includes(...)` por conta própria.
 */
export function congelamentoDoProjeto(projeto) {
  if (projeto?.congelamento?.motivo) return projeto.congelamento
  return avaliarCongelamento({
    orcamentoAprovado: !!projeto?.congelamento?.orcamentoAprovado,
    baselineValida:    !!projeto?.congelamento?.baselineValida,
    freeze_status:     projeto?.governanca?.freeze_status ?? null,
    workflow_status:   projeto?.governanca?.comercial?.workflow_status ?? null,
  })
}

/** Booleano direto a partir do projeto. */
export function projetoEstaCongelado(projeto) {
  return congelamentoDoProjeto(projeto).congelado
}

/**
 * `freeze_status` DERIVADO do contrato — para consumidores que ainda leem o
 * vocabulário antigo. Não persiste nada.
 */
export function freezeStatusDerivado(fatos, freezeStatusLegado = null) {
  const r = avaliarCongelamento(fatos)
  if (!r.congelado) return freezeStatusLegado || 'RASCUNHO'
  // HOMOLOGADO é informação da fase de homologação, não do contrato — se o
  // legado já dizia HOMOLOGADO, preserva-se; senão o contrato produz CONGELADO.
  return freezeStatusLegado === 'HOMOLOGADO' ? 'HOMOLOGADO' : 'CONGELADO'
}
