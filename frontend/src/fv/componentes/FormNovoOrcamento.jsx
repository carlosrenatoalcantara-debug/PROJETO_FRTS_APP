import { useState } from 'react'
import { useCotacoes } from '../providers/CotacoesProvider'
import { useOrcamentos } from '../providers/OrcamentosProvider'

/** Item vazio da grade. */
const ITEM_VAZIO = { descricao: '', tipo: 'material', quantidade: '1', valor_unitario_r: '' }

/** Número finito ou undefined — campo vazio não vira 0. */
function num(v) {
  if (v === '' || v == null) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

/**
 * FormNovoOrcamento — cria um orçamento a partir de uma cotação — FV-UX-012.
 *
 * É AQUI que a cotação é "escolhida": não existe operação de selecionar cotação
 * no domínio — a escolha se materializa no `cotacao_ref` do orçamento (M-1).
 *
 * Nenhuma validação de domínio acontece aqui. Se a cotação for de outro projeto,
 * quem recusa é o `OrcamentoService`.
 *
 * Os TOTAIS não são enviados: são derivados dos itens no servidor (INV-58).
 */
export default function FormNovoOrcamento() {
  const { lista: cotacoes } = useCotacoes()
  const { acoes } = useOrcamentos()
  const [aberto, setAberto] = useState(false)
  const [cotacaoRef, setCotacaoRef] = useState('')
  const [numero, setNumero] = useState('')
  const [itens, setItens] = useState([{ ...ITEM_VAZIO }])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)

  function alterarItem(i, campo, valor) {
    setItens((atual) => atual.map((it, n) => (n === i ? { ...it, [campo]: valor } : it)))
  }

  async function enviar(ev) {
    ev.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      await acoes.criar({
        cotacao_ref: cotacaoRef || undefined,
        numero: numero.trim() || null,
        itens: itens
          .filter((i) => i.descricao.trim())
          .map((i) => ({
            descricao: i.descricao.trim(),
            tipo: i.tipo,
            quantidade: num(i.quantidade) ?? 1,
            valor_unitario_r: num(i.valor_unitario_r) ?? 0,
          })),
      })
      setAberto(false)
      setNumero(''); setCotacaoRef(''); setItens([{ ...ITEM_VAZIO }])
    } catch (e) {
      setErro(e.codigo ? `${e.message} (${e.codigo})` : e.message)
    } finally {
      setEnviando(false)
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        disabled={cotacoes.length === 0}
        title={cotacoes.length === 0 ? 'Crie uma cotação antes — o orçamento deriva dela (M-1)' : undefined}
        className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-300"
      >
        Novo orçamento
      </button>
    )
  }

  return (
    <form onSubmit={enviar} className="rounded border border-slate-300 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Novo orçamento</h3>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-slate-600">Cotação de origem</span>
          <select
            value={cotacaoRef} onChange={(e) => setCotacaoRef(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          >
            <option value="">— selecione —</option>
            {cotacoes.map((c) => (
              <option key={c._id} value={c._id}>{c.rotulo || 'Sem rótulo'} · {c.tecnologia}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Número</span>
          <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="ORC-001"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1" />
        </label>
      </div>

      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Itens</h4>
      <ul className="mt-2 space-y-2">
        {itens.map((it, i) => (
          <li key={i} className="grid grid-cols-[1fr_7rem_5rem_7rem_2rem] gap-2">
            <input value={it.descricao} onChange={(e) => alterarItem(i, 'descricao', e.target.value)}
              placeholder="Descrição" className="rounded border border-slate-300 px-2 py-1 text-sm" />
            <select value={it.tipo} onChange={(e) => alterarItem(i, 'tipo', e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-sm">
              <option value="material">material</option>
              <option value="servico">serviço</option>
            </select>
            <input type="number" min="0" step="any" value={it.quantidade}
              onChange={(e) => alterarItem(i, 'quantidade', e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-sm" />
            <input type="number" min="0" step="any" value={it.valor_unitario_r}
              onChange={(e) => alterarItem(i, 'valor_unitario_r', e.target.value)}
              placeholder="R$" className="rounded border border-slate-300 px-2 py-1 text-sm" />
            <button type="button" onClick={() => setItens((a) => a.filter((_, n) => n !== i))}
              aria-label="Remover item" className="text-slate-400 hover:text-red-600">×</button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setItens((a) => [...a, { ...ITEM_VAZIO }])}
        className="mt-2 text-xs text-slate-600 underline hover:text-slate-900">
        Adicionar item
      </button>

      {erro && <p role="alert" className="mt-3 text-xs text-red-600">{erro}</p>}

      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={enviando}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400">
          {enviando ? 'Criando…' : 'Criar orçamento'}
        </button>
        <button type="button" onClick={() => { setAberto(false); setErro(null) }}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
          Cancelar
        </button>
      </div>
    </form>
  )
}
