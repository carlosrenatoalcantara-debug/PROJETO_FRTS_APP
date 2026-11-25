import { useState } from 'react'
import Card from '../ui/Card'
import Button from '../ui/Button'

/**
 * Exclusão de equipamento com confirmação NA PÁGINA. O `confirm()` do navegador
 * é bloqueado em alguns ambientes (devolve "não" sem perguntar) e a resposta de
 * erro do servidor era ignorada: o botão parecia não fazer nada.
 */
export default function ConfirmarExclusao({ equipamento, onFechar, onExcluido }) {
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState(null)

  async function excluir() {
    setExcluindo(true)
    setErro(null)
    try {
      const res = await fetch(`/api/equipamentos/${equipamento._id}`, { method: 'DELETE' })
      const corpo = await res.json().catch(() => null)
      if (!res.ok) throw new Error(corpo?.erro || `Erro ${res.status} ao excluir.`)
      onExcluido()
    } catch (e) {
      setErro(e.message || 'Erro ao excluir.')
      setExcluindo(false)
    }
  }

  return (
    <div role="dialog" aria-label="Confirmar exclusão" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md p-5">
        <h2 className="font-bold text-slate-900">Excluir equipamento?</h2>
        <p className="mt-2 text-sm text-slate-600">
          {equipamento.fabricante} — {equipamento.modelo}. A exclusão não pode ser desfeita.
        </p>
        {erro && <p role="alert" className="mt-3 text-sm text-red-600">{erro}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <Button onClick={onFechar} variante="secundario">Cancelar</Button>
          <Button onClick={excluir} variante="perigo" disabled={excluindo}>{excluindo ? 'Excluindo…' : 'Excluir'}</Button>
        </div>
      </Card>
    </div>
  )
}
