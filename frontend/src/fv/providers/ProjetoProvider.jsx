import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { buscarProjeto } from '../api/agregadosFvApi'

/**
 * ProjetoProvider — raiz da nova UX FV — FV-UX-010.
 *
 * Guarda o agregado `ProjetoFV` e nada mais. Os demais agregados têm providers
 * próprios que leem daqui — separação por agregado, não por etapa de wizard.
 *
 * ── Por que não é o ProjetoFVContext ─────────────────────────────────────────
 * O contexto antigo (195 linhas, 16 consumidores) é um reducer cujo shape
 * espelha as etapas do wizard (`dadosCliente`, `dadosConsumo`, `area`,
 * `equipamentos`, `arranjos`…) e que se persiste sozinho em
 * `localStorage['forte_solar_wizard_fv_v3']`, duplicando o estado do servidor.
 *
 * Aqui o servidor é a fonte. Não há reducer, não há localStorage, não há
 * navegação embutida: o estado é o que o backend devolveu, mais o controle de
 * carregamento.
 */

const Ctx = createContext(null)

export function ProjetoProvider({ projetoId, children }) {
  const [projeto, setProjeto] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const recarregar = useCallback(async () => {
    if (!projetoId) { setCarregando(false); return }
    setCarregando(true)
    setErro(null)
    try {
      setProjeto(await buscarProjeto(projetoId))
    } catch (e) {
      setErro(e.message)
      setProjeto(null)
    } finally {
      setCarregando(false)
    }
  }, [projetoId])

  useEffect(() => { recarregar() }, [recarregar])

  const valor = useMemo(() => ({
    projetoId,
    projeto,
    carregando,
    erro,
    recarregar,
  }), [projetoId, projeto, carregando, erro, recarregar])

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useProjeto() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useProjeto precisa estar dentro de ProjetoProvider')
  return ctx
}

/** Acesso opcional — para componentes que podem viver fora do provider. */
export function useProjetoOpcional() {
  return useContext(Ctx)
}
