/**
 * projetosFiltro.js — Sprint 8.4.1
 * Helpers PUROS de filtragem e badges para a lista de projetos FV.
 * Usa `status_display`, `legacy` e `excluido` devolvidos pelo backend.
 */

export const FILTROS_LISTA = [
  'todos', 'ativos', 'RASCUNHO', 'PROPOSTA', 'APROVADO', 'PERDIDO', 'ARQUIVADO', 'legados', 'lixeira',
]

/**
 * Filtra a lista de projetos pelo `filtro` selecionado na UI.
 * Regras:
 *  - lixeira: só excluídos
 *  - demais: excluídos nunca aparecem (defesa em profundidade)
 *  - ativos: tudo que não é ARQUIVADO
 *  - legados: legacy=true
 *  - status_display em UPPERCASE: filtro direto pelo nome do status
 */
export function filtrarProjetos(lista, filtro = 'todos') {
  if (!Array.isArray(lista)) return []
  return lista.filter((p) => {
    const status = p.status_display || 'RASCUNHO'
    if (filtro === 'lixeira') return p.excluido === true
    if (p.excluido) return false
    if (filtro === 'todos') return true
    if (filtro === 'ativos') return status !== 'ARQUIVADO'
    if (filtro === 'legados') return p.legacy === true
    return status === filtro
  })
}

// Badge visual por status canônico — emoji + classes tailwind utilitárias.
export const BADGES_STATUS = {
  RASCUNHO:   { icone: '🟡', cor: 'bg-amber-100 text-amber-800',   label: 'Rascunho' },
  EM_ANALISE: { icone: '🟠', cor: 'bg-orange-100 text-orange-800', label: 'Em análise' },
  PROPOSTA:   { icone: '🔵', cor: 'bg-blue-100 text-blue-800',     label: 'Proposta' },
  APROVADO:   { icone: '🟢', cor: 'bg-emerald-100 text-emerald-800', label: 'Aprovado' },
  EXECUCAO:   { icone: '⚙️', cor: 'bg-sky-100 text-sky-800',       label: 'Execução' },
  CONCLUIDO:  { icone: '✅', cor: 'bg-emerald-100 text-emerald-800', label: 'Concluído' },
  PERDIDO:    { icone: '🔴', cor: 'bg-red-100 text-red-800',       label: 'Perdido' },
  CANCELADO:  { icone: '⛔', cor: 'bg-red-100 text-red-800',       label: 'Cancelado' },
  ARQUIVADO:  { icone: '📦', cor: 'bg-slate-200 text-slate-700',   label: 'Arquivado' },
}
export function badgeDe(statusDisplay) {
  return BADGES_STATUS[statusDisplay] || BADGES_STATUS.RASCUNHO
}
