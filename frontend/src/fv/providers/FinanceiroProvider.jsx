import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useProjeto } from './ProjetoProvider'
import { calcularFinanceiro } from '../api/agregadosFvApi'

/**
 * FinanceiroProvider — contrato financeiro V1 — FV-UX-017.
 *
 * Consome `POST /api/projetos-fv/:id/financeiro/calcular` e repassa a resposta
 * INTACTA. Nenhuma fórmula financeira existe deste lado.
 *
 * ── Por que nem um arredondamento ────────────────────────────────────────────
 * O contrato já devolve o payback fracionário (oficial, D1) E o inteiro
 * (secundário). Derivar o segundo aqui criaria uma segunda verdade — a mesma
 * classe de defeito que a FV-DOM-008 mediu em oito motores divergentes.
 *
 * O mesmo vale para TMA (10 % nominal, D2), inflação (obrigatória sem default,
 * D3), degradação e horizonte: são premissas versionadas que chegam prontas.
 *
 * ── Ausência ─────────────────────────────────────────────────────────────────
 * `null` permanece `null`; `lacunas` são repassadas para a tela declarar o que
 * o projeto não forneceu. Zero informado explicitamente continua sendo zero —
 * o provider não confunde ausência com valor.
 */

const Ctx = createContext(null)

export function FinanceiroProvider({ children }) {
  const { projetoId } = useProjeto()
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)

  const calcular = useCallback(async () => {
    if (!projetoId) return
    setCarregando(true)
    setErro(null)
    try {
      setDados(await calcularFinanceiro(projetoId))
    } catch (e) {
      // Mensagem e código vêm do servidor — a UI não os reinterpreta.
      setErro(e.codigo ? `${e.message} (${e.codigo})` : e.message)
      setDados(null)
    } finally {
      setCarregando(false)
    }
  }, [projetoId])

  // Calcular ao abrir a etapa: derivação pura, sem efeito colateral no servidor.
  useEffect(() => { calcular() }, [calcular])

  const financeiro = dados?.financeiro ?? null

  const valor = useMemo(() => ({
    // ── Resultado do contrato, sem reinterpretação ───────────────────────────
    contrato: financeiro,
    payback: financeiro?.payback ?? null,
    paybackDescontado: financeiro?.payback_descontado ?? null,
    vpl: financeiro?.vpl ?? null,
    tir: financeiro?.tir ?? null,
    economia: financeiro?.economia ?? null,
    fluxoCaixa: financeiro?.fluxo_caixa ?? [],
    premissas: financeiro?.premissas ?? null,
    entradas: financeiro?.entradas ?? null,
    proveniencia: financeiro?.proveniencia ?? null,
    /** O que o projeto não forneceu. Nunca preenchido aqui. */
    lacunas: financeiro?.lacunas ?? [],
    regulatorio: financeiro?.regulatorio ?? null,

    // ── Rastreabilidade ──────────────────────────────────────────────────────
    contratoVersao: financeiro?.contrato_versao ?? null,
    premissasVersao: financeiro?.premissas_versao ?? null,
    calculadoEm: financeiro?.calculado_em ?? null,

    carregando,
    erro,
    calcular,
  }), [financeiro, carregando, erro, calcular])

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useFinanceiro() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useFinanceiro precisa estar dentro de FinanceiroProvider')
  return ctx
}
