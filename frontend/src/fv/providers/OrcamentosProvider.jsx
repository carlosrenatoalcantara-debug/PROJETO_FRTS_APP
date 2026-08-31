import { createContext, useContext, useMemo, useCallback } from 'react'
import { useProjeto } from './ProjetoProvider'
import {
  listarOrcamentos, obterOrcamentoVigente,
  criarOrcamento, atualizarOrcamento,
  emitirOrcamento, aprovarOrcamento, rejeitarOrcamento, cancelarOrcamento,
} from '../api/agregadosFvApi'
import { usarRecurso } from './usarRecurso'

/**
 * OrcamentosProvider — agregado `Orcamento` — FV-UX-011.
 *
 * Consome DOIS endpoints canônicos, cada um com sua responsabilidade:
 *   GET /:id/orcamentos          → lista completa (histórico incluído)
 *   GET /:id/orcamentos/vigente  → qual vale hoje
 *
 * O vigente NÃO é deduzido da lista. A regra ("o aprovado manda; senão o mais
 * recente em elaboração") é do domínio e já está no `OrcamentoService`;
 * reimplementá-la aqui criaria uma segunda verdade.
 *
 * `historico` = os que não são o vigente. Isso é recorte de apresentação, não
 * regra: nenhum orçamento é descartado (INV-ORC-2).
 */

const Ctx = createContext(null)

export function OrcamentosProvider({ children }) {
  const { projetoId } = useProjeto()
  const todos = usarRecurso(listarOrcamentos, projetoId)
  const vig = usarRecurso(obterOrcamentoVigente, projetoId)

  /**
   * Ações de escrita — FV-API-002.
   *
   * Cada uma delega ao endpoint e recarrega os dados. Nenhuma decide se a
   * operação é permitida: quem valida estado, unicidade e congelamento é o
   * domínio. Erros chegam com `codigo` e são repassados a quem chamou.
   */
  const recarregarAmbos = useCallback(() => { todos.recarregar(); vig.recarregar() }, [todos, vig])

  const executar = useCallback(async (fn, ...args) => {
    const r = await fn(projetoId, ...args)
    recarregarAmbos()
    return r
  }, [projetoId, recarregarAmbos])

  const acoes = useMemo(() => ({
    criar:    (dados) => executar(criarOrcamento, dados),
    editar:   (orcamentoId, dados) => executar(atualizarOrcamento, orcamentoId, dados),
    emitir:   (orcamentoId) => executar(emitirOrcamento, orcamentoId),
    aprovar:  (orcamentoId) => executar(aprovarOrcamento, orcamentoId),
    rejeitar: (orcamentoId, motivo) => executar(rejeitarOrcamento, orcamentoId, { motivo }),
    cancelar: (orcamentoId, motivo) => executar(cancelarOrcamento, orcamentoId, { motivo }),
  }), [executar])

  const valor = useMemo(() => {
    const lista = todos.dados?.orcamentos ?? []
    const aprovadoRef = todos.dados?.aprovado_ref ?? null
    const vigente = vig.dados?.orcamento ?? null

    return {
      lista,
      total: todos.dados?.total ?? 0,
      /** Do endpoint dedicado — não deduzido da lista. */
      vigente,
      aprovado: lista.find((o) => String(o._id) === String(aprovadoRef)) ?? null,
      aprovadoRef,
      /** Tudo que não é o vigente. Nada é descartado. */
      historico: lista.filter((o) => String(o._id) !== String(vigente?._id)),
      estado: vigente?.estado ?? null,
      totais: vigente?.totais ?? null,
      temOrcamento: lista.length > 0,
      acoes,
      carregando: todos.carregando || vig.carregando,
      erro: todos.erro || vig.erro,
      recarregar: recarregarAmbos,
    }
  }, [todos, vig, acoes, recarregarAmbos])

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useOrcamentos() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useOrcamentos precisa estar dentro de OrcamentosProvider')
  return ctx
}
