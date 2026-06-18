import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

/**
 * P1-CENTRAL-HOMOLOGACAO-MVP
 * Campo de dado com botão de cópia individual + seção agrupada com "Copiar tudo".
 * Objetivo: facilitar o preenchimento manual dos portais das concessionárias
 * (sem automação — apenas copy/paste assistido).
 */

function valorTexto(valor) {
  if (valor == null || valor === '' || Number.isNaN(valor)) return '—'
  return String(valor)
}

export function CampoCopiavel({ rotulo, valor }) {
  const [copiado, setCopiado] = useState(false)
  const texto = valorTexto(valor)
  const vazio = texto === '—'

  function copiar() {
    if (vazio) return
    navigator.clipboard?.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{rotulo}</p>
        <p className="text-sm text-slate-900 break-words">{texto}</p>
      </div>
      <button
        onClick={copiar}
        disabled={vazio}
        className="shrink-0 p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:hover:bg-transparent"
        title={vazio ? 'Sem dado' : 'Copiar'}
      >
        {copiado ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
      </button>
    </div>
  )
}

/**
 * Seção de dados copiáveis. `campos` = [{ rotulo, valor }].
 * Cabeçalho traz botão "Copiar seção" que junta rótulo: valor de cada campo preenchido.
 */
export function SecaoDados({ titulo, icone: Icone, campos = [] }) {
  const [copiado, setCopiado] = useState(false)

  function copiarSecao() {
    const texto = campos
      .filter((c) => valorTexto(c.valor) !== '—')
      .map((c) => `${c.rotulo}: ${valorTexto(c.valor)}`)
      .join('\n')
    if (!texto) return
    navigator.clipboard?.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  return (
    <div className="border border-slate-200 rounded-lg bg-white">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          {Icone && <Icone size={16} className="text-indigo-600" />}
          <h4 className="text-sm font-semibold text-slate-800">{titulo}</h4>
        </div>
        <button
          onClick={copiarSecao}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
        >
          {copiado ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          {copiado ? 'Copiado' : 'Copiar seção'}
        </button>
      </div>
      <div className="px-4 py-1">
        {campos.map((c) => (
          <CampoCopiavel key={c.rotulo} rotulo={c.rotulo} valor={c.valor} />
        ))}
      </div>
    </div>
  )
}

export default CampoCopiavel
