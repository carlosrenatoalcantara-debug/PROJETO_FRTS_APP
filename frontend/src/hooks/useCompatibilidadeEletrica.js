/**
 * useCompatibilidadeEletrica.js — S2.11.1
 *
 * Hook React que chama POST /api/engenharia/compatibilidade-eletrica
 * e devolve o resultado em tempo real à medida que os parâmetros mudam.
 *
 * ── Características ──────────────────────────────────────────────────────────
 *  ✔ Debounce 500 ms — evita chamadas em cascata a cada tecla
 *  ✔ AbortController — cancela a requisição anterior antes da nova (race-free)
 *  ✔ loading state — feedback visual imediato
 *  ✔ Erro separado de resultado — nunca mistura estado de falha com payload
 *  ✔ Não chama a API se os inputs mínimos não estiverem presentes
 *
 * ── Parâmetros ───────────────────────────────────────────────────────────────
 *  @param {object}      dadosModulo    Parâmetros elétricos do módulo FV
 *  @param {object}      dadosInversor  Parâmetros elétricos do inversor
 *  @param {object}      arranjo        { quantidade_modulos_por_string, quantidade_strings_paralelo }
 *  @param {object|null} clima          { temperatura_min_historica_c, temperatura_max_historica_c, ... }
 *
 * ── Retorno ──────────────────────────────────────────────────────────────────
 *  { resultado, carregando, erro }
 *   resultado  — payload de analisarCompatibilidade() ou null
 *   carregando — boolean (true entre request e response)
 *   erro       — string de erro ou null
 */

import { useState, useEffect, useRef } from 'react'

const DEBOUNCE_MS  = 500
const API_ENDPOINT = '/api/engenharia/compatibilidade-eletrica'

/**
 * Verifica se o payload mínimo está presente e tem tipos corretos.
 * Evita disparo de chamada API com dados incompletos.
 */
function inputsValidos(dadosModulo, dadosInversor, arranjo) {
  if (!dadosModulo  || typeof dadosModulo  !== 'object') return false
  if (!dadosInversor || typeof dadosInversor !== 'object') return false
  if (!arranjo       || typeof arranjo       !== 'object') return false

  const m = dadosModulo
  const i = dadosInversor
  const a = arranjo

  const ok = (v) => v != null && isFinite(Number(v)) && Number(v) > 0
  const okNum = (v) => v != null && isFinite(Number(v))

  return (
    ok(m.voc) && ok(m.vmpp) && ok(m.isc) && ok(m.impp) && ok(m.potencia_w) && okNum(m.coef_temp_voc) &&
    ok(i.tensao_max_entrada) && ok(i.mppt_min) && ok(i.mppt_max) &&
    ok(i.corrente_max_mppt) && ok(i.potencia_ca_kw) &&
    ok(a.quantidade_modulos_por_string) && ok(a.quantidade_strings_paralelo)
  )
}

export function useCompatibilidadeEletrica(dadosModulo, dadosInversor, arranjo, clima) {
  const [resultado,  setResultado]  = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro,       setErro]       = useState(null)

  // Referência para o AbortController atual (cancelamento da req. anterior)
  const abortRef   = useRef(null)
  // Referência para o timer de debounce
  const timerRef   = useRef(null)
  // ID sequencial para detectar respostas fora de ordem
  const requestIdRef = useRef(0)

  useEffect(() => {
    // Limpa timer anterior (debounce)
    if (timerRef.current) clearTimeout(timerRef.current)

    // Se inputs insuficientes → limpa resultado mas não dispara API
    if (!inputsValidos(dadosModulo, dadosInversor, arranjo)) {
      setResultado(null)
      setCarregando(false)
      setErro(null)
      return
    }

    // Marca carregando imediatamente (feedback visual antes do debounce terminar)
    setCarregando(true)
    setErro(null)

    timerRef.current = setTimeout(async () => {
      // Cancela requisição em andamento (AbortController)
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      // ID desta requisição — descarta respostas mais antigas
      const thisId = ++requestIdRef.current

      try {
        const resp = await fetch(API_ENDPOINT, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          signal:  controller.signal,
          body: JSON.stringify({
            dados_eletricos_modulo:   dadosModulo,
            dados_eletricos_inversor: dadosInversor,
            arranjo_proposto:         arranjo,
            dados_climaticos_regiao:  clima ?? null,
          }),
        })

        // Resposta desatualizada (requisição mais nova já foi disparada)
        if (thisId !== requestIdRef.current) return

        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}))
          throw new Error(body.erro ?? `HTTP ${resp.status}`)
        }

        const dados = await resp.json()

        // Descarta se não for a resposta mais recente
        if (thisId !== requestIdRef.current) return

        setResultado(dados)
        setErro(null)
      } catch (err) {
        if (err.name === 'AbortError') return  // cancelamento intencional — silencioso
        if (thisId !== requestIdRef.current) return

        setResultado(null)
        setErro(err.message ?? 'Erro ao consultar compatibilidade elétrica.')
      } finally {
        if (thisId === requestIdRef.current) {
          setCarregando(false)
        }
      }
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Serializa inputs como strings para comparação estável no useEffect
    JSON.stringify(dadosModulo),
    JSON.stringify(dadosInversor),
    JSON.stringify(arranjo),
    JSON.stringify(clima),
  ])

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      if (timerRef.current)  clearTimeout(timerRef.current)
      if (abortRef.current)  abortRef.current.abort()
    }
  }, [])

  return { resultado, carregando, erro }
}
