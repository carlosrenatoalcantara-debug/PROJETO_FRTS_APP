import { describe, it, expect } from 'vitest'
import { filtrarProjetos, badgeDe, BADGES_STATUS, FILTROS_LISTA } from '../projetosFiltro'
import { MOTIVOS_ARQUIVAMENTO } from '../../services/projetosFvLifecycleApi'

/**
 * Sprint 8.4.1 — UX Ciclo de Vida (helpers puros).
 * Os endpoints HTTP são exercitados pelos testes da 8.4 (statusLifecycle); aqui
 * cobrimos só a camada de UI/filtragem/visual.
 */
const dados = [
  { _id: '1', nome: 'Rascunho A',  status_display: 'RASCUNHO' },
  { _id: '2', nome: 'Proposta',    status_display: 'PROPOSTA' },
  { _id: '3', nome: 'Aprovado',    status_display: 'APROVADO' },
  { _id: '4', nome: 'Arquivado',   status_display: 'ARQUIVADO' },
  { _id: '5', nome: 'Perdido',     status_display: 'PERDIDO' },
  { _id: '6', nome: 'Legado',      status_display: 'RASCUNHO', legacy: true },
  { _id: '7', nome: 'Excluído',    status_display: 'RASCUNHO', excluido: true },
]

describe('S8.4.1 — filtros da lista de projetos', () => {
  // 1) Filtro por status_display canônico (PROPOSTA / APROVADO).
  it('filtra por status_display direto', () => {
    expect(filtrarProjetos(dados, 'PROPOSTA').map((p) => p._id)).toEqual(['2'])
    expect(filtrarProjetos(dados, 'APROVADO').map((p) => p._id)).toEqual(['3'])
  })

  // 2) "Ativos" = tudo exceto ARQUIVADO e excluídos.
  it('filtro ativos exclui arquivados e excluídos', () => {
    const ativos = filtrarProjetos(dados, 'ativos').map((p) => p._id)
    expect(ativos).not.toContain('4') // ARQUIVADO
    expect(ativos).not.toContain('7') // excluído
    expect(ativos).toEqual(expect.arrayContaining(['1', '2', '3', '5', '6']))
  })

  // 3) "Legados" só lista projetos com flag legacy=true.
  it('filtro legados lista só legacy=true', () => {
    expect(filtrarProjetos(dados, 'legados').map((p) => p._id)).toEqual(['6'])
  })

  // 4) "Lixeira" lista APENAS excluído=true (e nada mais).
  it('filtro lixeira lista somente excluidos', () => {
    expect(filtrarProjetos(dados, 'lixeira').map((p) => p._id)).toEqual(['7'])
  })

  // 5) Defesa em profundidade: filtros normais nunca expõem excluídos.
  it('filtros normais escondem excluídos (defesa em profundidade)', () => {
    expect(filtrarProjetos(dados, 'todos').some((p) => p.excluido)).toBe(false)
    expect(filtrarProjetos(dados, 'RASCUNHO').some((p) => p.excluido)).toBe(false)
  })
})

describe('S8.4.1 — badges visuais', () => {
  // 6) Cada status canônico tem badge com ícone e cor; default cai em RASCUNHO.
  it('mapeia status_display para badge correspondente', () => {
    expect(badgeDe('APROVADO').label).toBe('Aprovado')
    expect(badgeDe('ARQUIVADO').icone).toBe('📦')
    expect(badgeDe(undefined)).toBe(BADGES_STATUS.RASCUNHO)
    // todos os 9 status canônicos têm badge
    for (const s of ['RASCUNHO','EM_ANALISE','PROPOSTA','APROVADO','EXECUCAO','CONCLUIDO','PERDIDO','CANCELADO','ARQUIVADO']) {
      expect(BADGES_STATUS[s]).toBeTruthy()
    }
  })
})

describe('S8.4.1 — modal de arquivamento', () => {
  // 7) Motivos do modal espelham os aceitos pelo backend (S8.4).
  it('motivos de arquivamento exigidos pela spec', () => {
    expect(MOTIVOS_ARQUIVAMENTO).toEqual(['Cliente desistiu', 'Duplicado', 'Teste', 'Perdeu venda', 'Outro'])
    expect(FILTROS_LISTA).toContain('lixeira')
    expect(FILTROS_LISTA).toContain('legados')
  })
})
