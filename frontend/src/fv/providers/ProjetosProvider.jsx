import { createContext, useContext, useMemo, useCallback } from 'react'
import { listarProjetos, criarProjeto } from '../api/agregadosFvApi'
import { usarRecurso } from './usarRecurso'

/**
 * ProjetosProvider — listagem e criação do módulo FV — FV-UX-014.
 *
 * Entrada do módulo. Consome `GET /api/projetos-fv` e `POST /api/projetos-fv`
 * — sem `ProjetoFVContext`, sem `projetoFVApi`, sem `localStorage`.
 *
 * A criação é DELEGADA: `clienteId` e `nome` obrigatórios são validados pelo
 * controller, e o tenant é carimbado no servidor a partir do JWT. Nada disso é
 * decidido aqui.
 */

const Ctx = createContext(null)
/** Chave constante — a listagem não é parametrizada por projeto. */
const TODOS = 'todos'

const carregar = () => listarProjetos()

/** A resposta é array ou envelope, conforme o modo de armazenamento do backend. */
function normalizar(dados) {
  if (Array.isArray(dados)) return dados
  return dados?.projetos ?? dados?.data ?? []
}

export function ProjetosProvider({ children }) {
  const { dados, carregando, erro, recarregar } = usarRecurso(carregar, TODOS)

  const criar = useCallback(async (novo) => {
    const criado = await criarProjeto(novo)
    recarregar()
    return criado
  }, [recarregar])

  const valor = useMemo(() => {
    const lista = normalizar(dados)
    return { lista, total: lista.length, acoes: { criar }, carregando, erro, recarregar }
  }, [dados, carregando, erro, recarregar, criar])

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useProjetos() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useProjetos precisa estar dentro de ProjetosProvider')
  return ctx
}
