/**
 * MaterialAutocomplete.jsx — FEATURE-002 ITEM 4/5.
 *
 * Busca inteligente no Cadastro de Materiais (SSOT). NÃO permite digitação livre:
 * o material do orçamento SEMPRE vem de uma seleção do catálogo. Se não existir,
 * oferece "Cadastrar novo material" (ITEM 5).
 */
import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, PackagePlus, Check, AlertTriangle } from 'lucide-react'
import { filtrarMateriais } from '../../utils/buscaMateriais'

const brl = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function materialParaLinha(m = {}) {
  return {
    descricao: m.descricao || '',
    unidade: m.unidade || 'un',
    preco_unitario: Number(m?.precoReferencia?.valor) || 0,
    categoria: m.categoria || '',
    material_id: m._id || null,
    nao_cadastrado: false,
  }
}

export default function MaterialAutocomplete({ catalogo = [], value, onSelecionar, onCadastrarNovo }) {
  const [q, setQ] = useState('')
  const [aberto, setAberto] = useState(false)
  const [foco, setFoco] = useState(0)
  const ref = useRef(null)
  const temDescricao = !!value?.descricao
  const doCatalogo = !!value?.material_id
  const naoCadastrado = temDescricao && !doCatalogo

  const resultados = useMemo(() => filtrarMateriais(catalogo, q, 12), [catalogo, q])

  useEffect(() => {
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  const escolher = (m) => {
    onSelecionar?.(materialParaLinha(m))
    setQ(''); setAberto(false)
  }

  return (
    <div className="relative" ref={ref}>
      {temDescricao && !aberto ? (
        <button type="button" onClick={() => { setAberto(true); setQ('') }}
          title={naoCadastrado ? 'Fora do catálogo — clique para selecionar/cadastrar' : 'Do catálogo — clique para trocar'}
          className={`w-full flex items-center gap-1.5 text-left border rounded px-2 py-1 text-xs hover:border-blue-300 ${naoCadastrado ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}`}>
          {naoCadastrado
            ? <AlertTriangle size={11} className="text-amber-600 flex-shrink-0" />
            : <Check size={11} className="text-emerald-600 flex-shrink-0" />}
          <span className="truncate">{value.descricao}</span>
        </button>
      ) : (
        <div className="flex items-center gap-1 border border-slate-300 rounded px-2 py-1 focus-within:ring-1 focus-within:ring-blue-400">
          <Search size={12} className="text-slate-400 flex-shrink-0" />
          <input
            value={q}
            autoFocus={aberto}
            onChange={(e) => { setQ(e.target.value); setAberto(true); setFoco(0) }}
            onFocus={() => setAberto(true)}
            placeholder="Buscar no catálogo (ex.: cabo 10, eletroduto 3/4)…"
            className="w-full text-xs focus:outline-none bg-transparent"
          />
        </div>
      )}

      {aberto && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
          {resultados.length === 0 ? (
            <div className="p-2 text-xs text-slate-500">
              Nenhum material encontrado{q ? ` para "${q}"` : ''}.
            </div>
          ) : (
            resultados.map((m, i) => (
              <button key={m._id || i} type="button" onClick={() => escolher(m)}
                className={`w-full text-left px-2 py-1.5 flex items-center justify-between gap-2 text-xs hover:bg-blue-50 ${i === foco ? 'bg-blue-50' : ''}`}>
                <span className="truncate">
                  <span className="text-slate-800">{m.descricao}</span>
                  <span className="text-slate-400 ml-1">· {m.categoria}</span>
                </span>
                <span className="text-slate-400 font-mono flex-shrink-0">
                  {m?.precoReferencia?.valor ? brl(m.precoReferencia.valor) : '—'}/{m.unidade || 'un'}
                </span>
              </button>
            ))
          )}
          {/* ITEM 5 — cadastrar novo material (SSOT) */}
          <button type="button" onClick={() => { setAberto(false); onCadastrarNovo?.(q) }}
            className="w-full text-left px-2 py-1.5 border-t border-slate-100 text-xs text-emerald-700 hover:bg-emerald-50 inline-flex items-center gap-1.5 font-medium">
            <PackagePlus size={12} /> Cadastrar novo material{q ? `: "${q}"` : ''}
          </button>
        </div>
      )}
    </div>
  )
}
