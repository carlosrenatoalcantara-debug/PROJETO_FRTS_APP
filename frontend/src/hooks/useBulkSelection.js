import { useState, useCallback } from 'react'

/**
 * useBulkSelection — seleção múltipla genérica para qualquer lista de itens.
 *
 * @param {Array} items - lista atual (página ou resultado filtrado)
 * @param {Function} getId - extrai o ID do item (default: item => item._id)
 */
export function useBulkSelection(items = [], getId = item => item._id) {
  const [selectedIds, setSelectedIds] = useState(new Set())

  const isSelected = useCallback(id => selectedIds.has(String(id)), [selectedIds])

  const toggleItem = useCallback(id => {
    const key = String(id)
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelectedIds(prev => {
      const allIds = items.map(item => String(getId(item)))
      const allSelected = allIds.every(id => prev.has(id))
      if (allSelected) {
        const next = new Set(prev)
        allIds.forEach(id => next.delete(id))
        return next
      } else {
        const next = new Set(prev)
        allIds.forEach(id => next.add(id))
        return next
      }
    })
  }, [items, getId])

  const clearAll = useCallback(() => setSelectedIds(new Set()), [])

  const isAllSelected = items.length > 0 && items.every(item => selectedIds.has(String(getId(item))))
  const isIndeterminate = selectedIds.size > 0 && !isAllSelected && items.some(item => selectedIds.has(String(getId(item))))
  const count = selectedIds.size
  const selectedArray = [...selectedIds]

  return {
    selectedIds,
    selectedArray,
    count,
    isSelected,
    toggleItem,
    toggleAll,
    clearAll,
    isAllSelected,
    isIndeterminate,
  }
}
