/**
 * comercialStateMachine.js — Sprint 4.3
 *
 * Máquina de estados do workflow comercial. Define transições válidas,
 * estados terminais, mapeamento para status jurídico e políticas de margem.
 *
 * Substitui o "status solto" da S4.2 por um grafo de transições auditável.
 * Pura e determinística — espelhada no backend para validação server-side.
 */

// ─── Estados ──────────────────────────────────────────────────────────────────
export const ESTADOS = {
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
}

// ─── Transições permitidas ──────────────────────────────────────────────────────
// Após ASSINADO, retroceder exige NOVA REVISÃO (não é transição direta).
export const TRANSICOES = {
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
}

export const ESTADOS_CONGELADOS = ['ASSINADO', 'IMPLANTACAO', 'CONCLUIDO']
export const ESTADOS_TERMINAIS = ['CONCLUIDO', 'CANCELADO']

export function getEstadoConfig(estado) {
  return ESTADOS[estado] || ESTADOS.RASCUNHO
}

export function transicoesValidas(estado) {
  return TRANSICOES[estado] || []
}

/**
 * Valida uma transição de estado.
 * @returns {{ ok: boolean, motivo?: string, requer_revisao?: boolean }}
 */
export function validarTransicao(de, para) {
  if (de === para) return { ok: false, motivo: 'Estado de origem e destino iguais.' }
  if (!ESTADOS[para]) return { ok: false, motivo: `Estado destino "${para}" inválido.` }

  const permitidas = transicoesValidas(de)
  if (permitidas.includes(para)) return { ok: true }

  // Regressão após congelamento exige revisão
  if (ESTADOS_CONGELADOS.includes(de) && (ESTADOS[para]?.ordem ?? 0) < (ESTADOS[de]?.ordem ?? 0)) {
    return { ok: false, requer_revisao: true, motivo: `Projeto ${de}: retroceder para ${para} exige nova revisão comercial.` }
  }

  return { ok: false, motivo: `Transição ${de} → ${para} não permitida.` }
}

export function estaCongelado(estado) {
  return ESTADOS_CONGELADOS.includes(estado)
}

// ─── Status jurídico (separado do operacional) ───────────────────────────────────
export const STATUS_JURIDICO = {
  PENDENTE_ASSINATURA: { label: 'Pendente assinatura', cor: 'amarelo' },
  ASSINADO:            { label: 'Assinado',            cor: 'verde' },
  EXPIRADO:            { label: 'Expirado',            cor: 'laranja' },
  CANCELADO:           { label: 'Cancelado',           cor: 'vermelho' },
  EM_REVISAO:          { label: 'Em revisão',          cor: 'azul' },
}

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

// ─── Proteção de margem ───────────────────────────────────────────────────────────
/**
 * Avalia a margem líquida contra políticas. Bloqueia venda destrutiva.
 * @returns {{ nivel: 'ok'|'alerta'|'bloqueio', mensagem: string|null, pode_prosseguir: boolean }}
 */
export function avaliarMargem({ margemLiquidaPct, margemMinima = 8, margemAlerta = 12, margemBloqueio = 0 }) {
  if (margemLiquidaPct == null) return { nivel: 'ok', mensagem: null, pode_prosseguir: true }
  const m = Number(margemLiquidaPct)
  if (m < margemBloqueio) {
    return { nivel: 'bloqueio', pode_prosseguir: false, mensagem: `Margem ${m}% abaixo do limite de bloqueio (${margemBloqueio}%). Venda destrutiva impedida.` }
  }
  if (m < margemMinima) {
    return { nivel: 'bloqueio', pode_prosseguir: false, mensagem: `Margem ${m}% abaixo da mínima (${margemMinima}%). Requer aprovação gerencial para prosseguir.` }
  }
  if (m < margemAlerta) {
    return { nivel: 'alerta', pode_prosseguir: true, mensagem: `Margem ${m}% abaixo do alerta (${margemAlerta}%). Atenção à rentabilidade.` }
  }
  return { nivel: 'ok', pode_prosseguir: true, mensagem: null }
}

// ─── Permissões comerciais (estrutura — auth completo virá depois) ───────────────
export const PERFIS = {
  vendedor:      { label: 'Vendedor',      pode: ['editar_proposta', 'enviar_cliente', 'coletar_assinatura'] },
  engenheiro:    { label: 'Engenheiro',    pode: ['editar_tecnico', 'congelar_tecnico'] },
  gerente:       { label: 'Gerente',       pode: ['aprovar_desconto', 'aprovar_margem', 'aprovar_excecao'] },
  administrador: { label: 'Administrador', pode: ['*'] },
}

export function perfilPode(perfil, acao) {
  const p = PERFIS[perfil]
  if (!p) return false
  return p.pode.includes('*') || p.pode.includes(acao)
}
