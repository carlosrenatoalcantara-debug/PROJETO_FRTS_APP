import { describe, it, expect } from 'vitest'
import { calcularDelta, filtroEmailUnico, apenasAtivos } from '../../../../backend/src/utils/gestaoDelta.js'

/**
 * Sprint 8.3.1 — testes obrigatórios da gestão corporativa CRUD.
 */
describe('S8.3.1 — gestão corporativa CRUD', () => {
  // 1) Auditoria inteligente: só registra o que mudou (delta, não objeto inteiro).
  it('calcularDelta registra apenas campos alterados no formato {antes,depois}', () => {
    const antes = { nome: 'João', telefone: '111', cargo: 'Comercial' }
    const delta = calcularDelta(antes, { nome: 'João', telefone: '222', cargo: 'Comercial' })
    expect(delta).toEqual({ telefone: { antes: '111', depois: '222' } })
    expect(delta.nome).toBeUndefined()
    expect(delta.cargo).toBeUndefined()
  })

  // 2) Sem mudanças → delta vazio (não gera evento de auditoria).
  it('calcularDelta devolve objeto vazio quando nada muda', () => {
    expect(calcularDelta({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toEqual({})
  })

  // 3) Validação de e-mail: filtro NÃO bloqueia o próprio usuário (email igual E _id diferente).
  it('filtroEmailUnico exclui o próprio _id e normaliza e-mail', () => {
    const f = filtroEmailUnico('Fulano@Email.com', 'abc123')
    expect(f).toEqual({ email: 'fulano@email.com', _id: { $ne: 'abc123' } })
  })

  // 4) Integridade histórica: seletores de novo projeto só enxergam ativos.
  it('apenasAtivos filtra entidades inativas (ativo=false) preservando ativo=true/undefined', () => {
    const lista = [
      { _id: '1', ativo: true },
      { _id: '2', ativo: false },
      { _id: '3' }, // legado sem campo → tratado como ativo
    ]
    expect(apenasAtivos(lista).map((x) => x._id)).toEqual(['1', '3'])
  })

  // 5) Toggle de status (ativar/inativar) é capturado como delta booleano auditável.
  it('calcularDelta captura mudança de status ativo true→false', () => {
    const delta = calcularDelta({ ativo: true }, { ativo: false })
    expect(delta.ativo).toEqual({ antes: true, depois: false })
  })
})
