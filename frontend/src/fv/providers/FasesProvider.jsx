import { createContext, useContext, useMemo } from 'react'
import { useProjeto } from './ProjetoProvider'
import { listarFases } from '../api/agregadosFvApi'
import { usarRecurso } from './usarRecurso'

/**
 * FasesProvider — fases paralelas Engenharia ∥ Homologação — FV-API-001.
 *
 * Lê `GET /api/projetos-fv/:id/fases`.
 *
 * `concluida` chega `null` do servidor — e permanece `null` aqui. Não existe
 * agregado que registre a conclusão de uma fase (FV-DOM-006); tratar `null`
 * como `false` afirmaria que a fase não concluiu, o que ninguém sabe.
 */

const Ctx = createContext(null)

export function FasesProvider({ children }) {
  const { projetoId } = useProjeto()
  const { dados, carregando, erro, recarregar } = usarRecurso(listarFases, projetoId)

  const valor = useMemo(() => ({
    lista: dados?.fases ?? [],
    total: dados?.total ?? 0,
    /** `null` = indeterminável enquanto não houver agregado de fase. */
    ambasConcluidas: dados?.ambas_concluidas ?? null,
    carregando,
    erro,
    recarregar,
  }), [dados, carregando, erro, recarregar])

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useFases() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useFases precisa estar dentro de FasesProvider')
  return ctx
}
