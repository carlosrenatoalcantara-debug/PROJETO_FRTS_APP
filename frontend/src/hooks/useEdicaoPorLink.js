import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Abre o modal de edição do equipamento indicado em `?editar=<id>`.
 * Procura na lista já carregada; se não estiver (busca/paginação), pede
 * /api/equipamentos/<id>. Depois de abrir, tira o parâmetro da URL para
 * fechar o modal não reabri-lo.
 */
export function useEdicaoPorLink({ itens, carregando, abrir }) {
  const [params, setParams] = useSearchParams()
  const id = params.get('editar')
  const feito = useRef(null)

  useEffect(() => {
    if (!id || carregando || feito.current === id) return
    feito.current = id
    let cancelado = false
    const limpar = () => {
      const p = new URLSearchParams(params)
      p.delete('editar')
      setParams(p, { replace: true })
    }
    const item = (itens || []).find((i) => String(i?._id) === id)
    if (item) { abrir(item); limpar(); return }
    ;(async () => {
      try {
        const res = await fetch(`/api/equipamentos/${encodeURIComponent(id)}`)
        if (!res.ok) throw new Error(String(res.status))
        const eq = await res.json()
        if (!cancelado) abrir(eq)
      } catch {
        if (!cancelado) window.alert('Equipamento do link não encontrado no catálogo.')
      } finally {
        if (!cancelado) limpar()
      }
    })()
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, carregando, itens])
}
