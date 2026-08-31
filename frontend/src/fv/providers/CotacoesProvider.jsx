import { createContext, useContext, useMemo, useCallback } from 'react'
import { useProjeto } from './ProjetoProvider'
import { useOrcamentos } from './OrcamentosProvider'
import { listarCotacoes, criarCotacao } from '../api/agregadosFvApi'
import { usarRecurso } from './usarRecurso'

/**
 * CotacoesProvider — agregado `Cotacao` — FV-API-001.
 *
 * Lê `GET /api/projetos-fv/:id/cotacoes`. A lista é COMPLETA: o domínio permite
 * qualquer quantidade de cotações por projeto (string, micro, híbrido, BESS) e
 * a API entrega todas.
 *
 * `origem` marca qual delas deu origem ao orçamento vigente (M-1).
 */

const Ctx = createContext(null)

export function CotacoesProvider({ children }) {
  const { projetoId } = useProjeto()
  const { vigente } = useOrcamentos()
  const { dados, carregando, erro, recarregar } = usarRecurso(listarCotacoes, projetoId)

  /** Cria uma cotação e recarrega a lista. A validação é do domínio. */
  const criar = useCallback(async (dados) => {
    const r = await criarCotacao(projetoId, dados)
    recarregar()
    return r
  }, [projetoId, recarregar])

  const valor = useMemo(() => {
    const lista = dados?.cotacoes ?? []
    const refOrigem = vigente?.cotacao_ref ?? null
    return {
      lista,
      total: dados?.total ?? 0,
      refOrigem,
      origem: lista.find((c) => String(c._id) === String(refOrigem)) ?? null,
      existeCotacao: lista.length > 0,
      acoes: { criar },
      carregando,
      erro,
      recarregar,
    }
  }, [dados, vigente, carregando, erro, recarregar, criar])

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useCotacoes() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCotacoes precisa estar dentro de CotacoesProvider')
  return ctx
}
