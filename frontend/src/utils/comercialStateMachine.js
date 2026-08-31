/**
 * comercialStateMachine.js — Sprint 4.3
 *
 * FV-UX-006 (F3.1): a máquina de estados comercial (estados, transições, status
 * jurídico) deixou de ser definida aqui — vive em
 * @fortesolar/fv-shared/estados/workflow-comercial, a mesma fonte que o backend
 * usa para validar server-side. Antes eram duas cópias manuais "espelhadas".
 *
 * Este arquivo reexporta sob os nomes históricos e guarda o que não é máquina de
 * estados: política de margem e perfis comerciais.
 */
export {
  ESTADOS_COMERCIAIS as ESTADOS,
  TRANSICOES_COMERCIAL as TRANSICOES,
  ESTADOS_CONGELADOS,
  ESTADOS_TERMINAIS,
  STATUS_JURIDICO,
  getEstadoConfig,
  transicoesValidas,
  validarTransicaoComercial as validarTransicao,
  estaCongelado,
  getStatusJuridicoConfig,
  statusJuridicoDeEstado,
} from '@fortesolar/fv-shared/estados/workflow-comercial'

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
