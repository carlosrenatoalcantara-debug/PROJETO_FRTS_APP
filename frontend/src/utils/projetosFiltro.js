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

// FV-UX-006 (F3.1): os badges eram uma lista paralela cujo conjunto de chaves era
// mantido à mão em sincronia com o vocabulário do ciclo de vida no backend.
// Agora ambos saem da fonte única.
export {
  ESTADOS_CICLO as BADGES_STATUS,
  badgeDe,
} from '@fortesolar/fv-shared/estados/ciclo-vida'
