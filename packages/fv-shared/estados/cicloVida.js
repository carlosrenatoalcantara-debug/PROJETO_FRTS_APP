/**
 * cicloVida.js — FONTE ÚNICA do ciclo de vida (`status` na raiz do Projeto FV).
 *
 * FV-UX-006 (F3.1). O vocabulário e os mapeamentos viviam em
 * backend/src/utils/statusLifecycle.js; os metadados de apresentação eram uma
 * lista paralela em frontend/src/utils/projetosFiltro.js (BADGES_STATUS), com o
 * mesmo conjunto de chaves mantido à mão.
 *
 * O modelo persiste em minúsculas e tem 2 valores legados sem representação na
 * UI (`em_simulacao`, `dimensionado`) — por isso os dois mapas são assimétricos.
 *
 * Puro e determinístico. Sem I/O, sem framework.
 */

/** Estados do ciclo de vida em exibição, com metadados. */
// Ordem das propriedades preservada do original (projetosFiltro.BADGES_STATUS)
// para que a serialização continue byte-idêntica.
export const ESTADOS_CICLO = Object.freeze({
  RASCUNHO:   { icone: '🟡', cor: 'bg-amber-100 text-amber-800',   label: 'Rascunho' },
  EM_ANALISE: { icone: '🟠', cor: 'bg-orange-100 text-orange-800', label: 'Em análise' },
  PROPOSTA:   { icone: '🔵', cor: 'bg-blue-100 text-blue-800',     label: 'Proposta' },
  APROVADO:   { icone: '🟢', cor: 'bg-emerald-100 text-emerald-800', label: 'Aprovado' },
  EXECUCAO:   { icone: '⚙️', cor: 'bg-sky-100 text-sky-800',       label: 'Execução' },
  CONCLUIDO:  { icone: '✅', cor: 'bg-emerald-100 text-emerald-800', label: 'Concluído' },
  PERDIDO:    { icone: '🔴', cor: 'bg-red-100 text-red-800',       label: 'Perdido' },
  CANCELADO:  { icone: '⛔', cor: 'bg-red-100 text-red-800',       label: 'Cancelado' },
  ARQUIVADO:  { icone: '📦', cor: 'bg-slate-200 text-slate-700',   label: 'Arquivado' },
})

/** Ciclo canônico em UPPERCASE (exibição). */
export const STATUS = Object.freeze(Object.keys(ESTADOS_CICLO))

/** Exibição → valor persistido no model. */
const MAPA_LOWER = Object.freeze({
  RASCUNHO: 'rascunho', EM_ANALISE: 'em_analise', PROPOSTA: 'proposta',
  APROVADO: 'aprovado', EXECUCAO: 'em_execucao', CONCLUIDO: 'concluido',
  PERDIDO: 'perdido', CANCELADO: 'cancelado', ARQUIVADO: 'arquivado',
})

/** Valor do model → exibição. Inclui apelidos legados sem UI própria. */
const MAPA_UPPER = Object.freeze({
  rascunho: 'RASCUNHO', em_simulacao: 'RASCUNHO', em_analise: 'EM_ANALISE',
  dimensionado: 'EM_ANALISE', proposta: 'PROPOSTA', aprovado: 'APROVADO',
  em_execucao: 'EXECUCAO', concluido: 'CONCLUIDO', perdido: 'PERDIDO',
  cancelado: 'CANCELADO', arquivado: 'ARQUIVADO',
})

/**
 * Exibição → valor do model. Devolve `null` quando desconhecido.
 *
 * FV-UX-005 (F3.2 / defeito I-1): ANTES caía em `'rascunho'`, o que transformava
 * qualquer entrada inválida numa gravação silenciosa — um projeto `concluido`
 * voltava a `rascunho` sem erro. Cabe ao chamador rejeitar o `null`.
 */
export function paraModel(displayStatus) {
  return MAPA_LOWER[displayStatus] ?? null
}

/** O valor de exibição corresponde a um status do ciclo de vida? */
export function ehStatusValido(displayStatus) {
  return Object.prototype.hasOwnProperty.call(MAPA_LOWER, displayStatus)
}

/**
 * Valor do model → exibição. Mantém o fallback `'RASCUNHO'`: aqui a entrada vem
 * do banco (inclusive documentos legados sem status), não do usuário — degradar
 * na leitura é seguro, degradar na escrita não é.
 */
export function paraDisplay(modelStatus) {
  return MAPA_UPPER[modelStatus] || 'RASCUNHO'
}

/** Metadados de apresentação de um status de exibição. */
export function badgeDe(statusDisplay) {
  return ESTADOS_CICLO[statusDisplay] || ESTADOS_CICLO.RASCUNHO
}
