/**
 * ModalNovoMaterial.jsx — FEATURE-002 ITEM 5.
 *
 * Cadastro RÁPIDO de material no Cadastro de Materiais (SSOT). Respeita o TEMPLATE
 * de categoria: renderiza os atributos de IDENTIDADE obrigatórios (bitola, tipo…) e
 * grava via API de materiais (a descrição é derivada no backend). Retorna o material
 * criado para seleção automática no orçamento. Nunca cria item "solto" no orçamento.
 */
import { useState, useEffect, useMemo } from 'react'
import { X, PackagePlus } from 'lucide-react'
import { criarMaterial, listarTemplates } from '../../services/materiaisApi'

const UNIDADES = ['un', 'm', 'barra', 'rolo', 'jogo', 'par', 'cento', 'kg', 'm2', 'L', 'cx', 'pc']
const NOME_CAT = {
  cabos: 'Cabos', protecao_eletrica: 'Proteção elétrica', quadros_barramentos: 'Quadros e barramentos',
  conexoes_infraestrutura: 'Conexões e infraestrutura', fixacao: 'Fixação',
}

export default function ModalNovoMaterial({ descricaoInicial = '', onClose, onCriado }) {
  const [templates, setTemplates] = useState([])
  const [categoria, setCategoria] = useState('cabos')
  const [unidade, setUnidade] = useState('un')
  const [preco, setPreco] = useState('')
  const [attrs, setAttrs] = useState({})     // { chave: valor }
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    listarTemplates().then((ts) => setTemplates(ts || [])).catch(() => setTemplates([]))
  }, [])

  const categorias = useMemo(() => {
    const chaves = (templates.length ? templates.map((t) => t.chave) : Object.keys(NOME_CAT))
    return [...new Set(chaves)]
  }, [templates])

  // Atributos de identidade obrigatórios da categoria selecionada.
  const identidade = useMemo(() => {
    const t = templates.find((x) => x.chave === categoria)
    const ats = (t?.atributos || []).filter((a) => a.identidade && (a.obrigatorio ?? true))
    return ats
  }, [templates, categoria])

  // Prefill do primeiro atributo textual com o que o usuário digitou na busca.
  useEffect(() => {
    if (!identidade.length) { setAttrs({}); return }
    const primeiro = identidade[0]
    setAttrs((prev) => {
      const base = {}
      for (const a of identidade) base[a.chave] = prev[a.chave] ?? ''
      if (descricaoInicial && (primeiro.tipo === 'string' || primeiro.tipo === 'text' || !primeiro.tipo) && !base[primeiro.chave]) {
        base[primeiro.chave] = descricaoInicial
      }
      return base
    })
  }, [identidade, descricaoInicial])

  const setAttr = (chave, valor) => setAttrs((p) => ({ ...p, [chave]: valor }))

  const salvar = async () => {
    const faltando = identidade.filter((a) => attrs[a.chave] === '' || attrs[a.chave] == null)
    if (faltando.length) { setErro(`Preencha: ${faltando.map((a) => a.chave).join(', ')}`); return }
    try {
      setSalvando(true); setErro(null)
      const especificacoes = identidade.map((a) => ({ chave: a.chave, valor: String(attrs[a.chave]) }))
      const resp = await criarMaterial({
        categoria,
        classe: 'commodity',
        unidade,
        especificacoes,
        ...(preco !== '' ? { precoReferencia: { valor: Number(preco) || 0 } } : {}),
      })
      const novo = resp?.material || resp
      onCriado?.(novo)
    } catch (e) {
      setErro(e.message || 'Falha ao cadastrar material.')
    } finally {
      setSalvando(false)
    }
  }

  const inputAttr = (a) => {
    const numeric = a.tipo === 'number' || a.tipo === 'int'
    return (
      <div key={a.chave}>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          {a.chave}{a.unidade ? ` (${a.unidade})` : ''}
        </label>
        <input
          type={numeric ? 'number' : 'text'}
          value={attrs[a.chave] ?? ''}
          onChange={(e) => setAttr(a.chave, e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white">
          <h3 className="flex items-center gap-2 font-semibold text-slate-900">
            <PackagePlus size={18} className="text-emerald-600" /> Cadastrar novo material
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
            Gravado no <strong>Cadastro de Materiais</strong> (fonte única) e selecionado automaticamente no orçamento.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Categoria</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white">
                {categorias.map((c) => <option key={c} value={c}>{NOME_CAT[c] || c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Unidade</label>
              <select value={unidade} onChange={(e) => setUnidade(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white">
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {identidade.length === 0 ? (
            <p className="text-[11px] text-slate-400">Carregando atributos da categoria…</p>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Identificação do material</p>
              {identidade.map(inputAttr)}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Preço de referência (R$) — opcional</label>
            <input type="number" step="0.01" min="0" value={preco} onChange={(e) => setPreco(e.target.value)}
              placeholder="0,00"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          {erro && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{erro}</p>}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-200 bg-slate-50 sticky bottom-0">
          <button onClick={onClose} disabled={salvando}
            className="text-sm px-3 py-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300">Cancelar</button>
          <button onClick={salvar} disabled={salvando || identidade.length === 0}
            className="text-sm px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
            {salvando ? 'Cadastrando…' : 'Cadastrar e selecionar'}
          </button>
        </div>
      </div>
    </div>
  )
}
