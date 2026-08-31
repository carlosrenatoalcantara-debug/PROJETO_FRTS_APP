import { createContext, useContext, useMemo, useCallback } from 'react'
import { useProjeto } from './ProjetoProvider'
import {
  obterResumoBeneficiarias, criarBeneficiaria, atualizarBeneficiaria,
  removerBeneficiaria, importarBeneficiariasLote,
} from '../api/agregadosFvApi'
import { usarRecurso } from './usarRecurso'

/**
 * BeneficiariasProvider — agregado `UnidadeBeneficiaria` — FV-UX-015.
 *
 * Lê `GET /:id/beneficiarias/resumo`, que já devolve a lista, o rateio
 * consolidado e as modalidades GD aceitas — tudo calculado no servidor.
 *
 * ── Nenhuma regra de rateio aqui ─────────────────────────────────────────────
 * A soma dos percentuais, o limite de 100% e as modalidades válidas são do
 * domínio (`beneficiariaRateio`, em @fortesolar/fv-shared). Recalcular no
 * cliente criaria uma segunda verdade — o defeito que a FV-UX-004 mapeou.
 *
 * O `rateio` exibido é o que o servidor respondeu, sem reinterpretação.
 */

const Ctx = createContext(null)

export function BeneficiariasProvider({ children }) {
  const { projetoId } = useProjeto()
  const { dados, carregando, erro, recarregar } = usarRecurso(obterResumoBeneficiarias, projetoId)

  const executar = useCallback(async (fn, ...args) => {
    const r = await fn(projetoId, ...args)
    recarregar()
    return r
  }, [projetoId, recarregar])

  const acoes = useMemo(() => ({
    criar:     (d) => executar(criarBeneficiaria, d),
    atualizar: (id, d) => executar(atualizarBeneficiaria, id, d),
    remover:   (id) => executar(removerBeneficiaria, id),
    importar:  (lista, substituir) => executar(importarBeneficiariasLote, lista, substituir),
  }), [executar])

  const valor = useMemo(() => ({
    lista: dados?.beneficiarias ?? [],
    total: dados?.total ?? 0,
    ativas: dados?.ativas ?? 0,
    /** Validação do rateio — vem pronta do servidor. */
    rateio: dados?.rateio ?? null,
    modalidades: dados?.modalidades ?? [],
    acoes,
    carregando,
    erro,
    recarregar,
  }), [dados, acoes, carregando, erro, recarregar])

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useBeneficiarias() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useBeneficiarias precisa estar dentro de BeneficiariasProvider')
  return ctx
}
