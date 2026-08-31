import { createContext, useContext, useMemo, useCallback } from 'react'
import { useProjeto } from './ProjetoProvider'
import { obterBaseline, obterGate } from '../api/agregadosFvApi'
import { usarRecurso } from './usarRecurso'

/**
 * ContratoProvider — Baseline + Gate — FV-UX-011.
 *
 * ── Zero cálculo local ───────────────────────────────────────────────────────
 * Este provider NÃO decide nada. Ele repassa o que a API canônica respondeu:
 *
 *   GET /:id/baseline → `baseline`, `integra`
 *   GET /:id/gate     → `fases[fase].liberado`, `autoritativo`
 *
 * Histórico: na FV-UX-010 a decisão era calculada no cliente (não havia
 * endpoint); na FV-API-001 passou a ser lida, mas o provider ainda reduzia as
 * fases a um booleano `congelado`. Essa redução saiu — quem precisa saber sobre
 * uma fase consulta aquela fase, com `liberadaPara(fase)`.
 *
 * Inventar um "congelado" agregado no cliente seria reintroduzir a decisão local
 * que a FV-UX-004 identificou como defeito (17 reimplementações do mesmo
 * booleano espalhadas pela base).
 */

const Ctx = createContext(null)

export function ContratoProvider({ children }) {
  const { projetoId } = useProjeto()
  const bl = usarRecurso(obterBaseline, projetoId)
  const gt = usarRecurso(obterGate, projetoId)

  const fases = gt.dados?.fases ?? {}

  /** Decisão do servidor para uma fase. `null` = ainda não respondida. */
  const liberadaPara = useCallback(
    (fase) => fases[fase]?.liberado ?? null,
    [fases],
  )

  /** Motivo do bloqueio de uma fase, direto da API. */
  const motivoDe = useCallback(
    (fase) => fases[fase]?.motivo ?? null,
    [fases],
  )

  const valor = useMemo(() => {
    const baseline = bl.dados?.baseline ?? null
    return {
      // ── Baseline (GET /:id/baseline) ──────────────────────────────────────
      baseline,
      baselineRef: baseline?._id ?? null,
      temBaseline: !!baseline,
      /** Verificada NO SERVIDOR — o cliente não recalcula hash. */
      baselineIntegra: bl.dados?.integra ?? null,
      conteudo: baseline?.conteudo ?? null,

      // ── Gate (GET /:id/gate) ──────────────────────────────────────────────
      fases,
      liberadaPara,
      motivoDe,
      /** `true` quando a resposta veio do endpoint autoritativo. */
      gateAutoritativo: !!gt.dados?.autoritativo,

      carregando: bl.carregando || gt.carregando,
      erro: bl.erro || gt.erro,
      recarregar: () => { bl.recarregar(); gt.recarregar() },
    }
  }, [bl, gt, fases, liberadaPara, motivoDe])

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useContrato() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useContrato precisa estar dentro de ContratoProvider')
  return ctx
}
