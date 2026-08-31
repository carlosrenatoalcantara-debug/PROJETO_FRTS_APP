import { useEffect, useState } from 'react'
import { useProjetos } from '../providers/ProjetosProvider'
import { listarClientes } from '../api/agregadosFvApi'

/**
 * FormNovoProjeto — cria um Projeto FV — FV-UX-014.
 *
 * Substitui `/projetos-fv/novo` como caminho de criação. O wizard antigo abria
 * um funil de 9 passos para criar o projeto; aqui a criação é o que sempre foi
 * no domínio — **um cliente e um nome**. O resto (cotação, orçamento, contrato)
 * é o fluxo canônico, não pré-requisito para existir.
 *
 * Nenhuma regra vive aqui: obrigatoriedade de `clienteId`/`nome` e o carimbo de
 * tenant são do servidor. O erro exibido é o do domínio, sem reinterpretação.
 */
export default function FormNovoProjeto({ aoCriar }) {
  const { acoes } = useProjetos()
  const [aberto, setAberto] = useState(false)
  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState('')
  const [nome, setNome] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  const [erroClientes, setErroClientes] = useState(null)

  useEffect(() => {
    if (!aberto) return
    let vivo = true
    listarClientes()
      .then((r) => { if (vivo) setClientes(Array.isArray(r) ? r : (r?.data ?? [])) })
      .catch((e) => { if (vivo) setErroClientes(e.message) })
    return () => { vivo = false }
  }, [aberto])

  async function enviar(ev) {
    ev.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      const criado = await acoes.criar({ clienteId, nome: nome.trim() })
      setAberto(false)
      setNome(''); setClienteId('')
      aoCriar?.(criado?._id ?? null)
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
        className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
      >
        Novo projeto
      </button>
    )
  }

  return (
    <form onSubmit={enviar} className="rounded border border-slate-300 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Novo projeto FV</h3>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-slate-600">Cliente</span>
          <select
            value={clienteId} onChange={(e) => setClienteId(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          >
            <option value="">— selecione —</option>
            {clientes.map((c) => (
              <option key={c._id} value={c._id}>
                {c.nome}{c.cidade ? ` · ${c.cidade}` : ''}
              </option>
            ))}
          </select>
          {erroClientes && (
            <span className="mt-1 block text-xs text-amber-700">
              Não foi possível carregar clientes: {erroClientes}
            </span>
          )}
        </label>

        <label className="text-sm">
          <span className="text-slate-600">Nome do projeto</span>
          <input
            value={nome} onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Residencial 5 kWp"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
      </div>

      {erro && <p role="alert" className="mt-3 text-xs text-red-600">{erro}</p>}

      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={enviando}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400">
          {enviando ? 'Criando…' : 'Criar projeto'}
        </button>
        <button type="button" onClick={() => { setAberto(false); setErro(null) }}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
          Cancelar
        </button>
      </div>
    </form>
  )
}
