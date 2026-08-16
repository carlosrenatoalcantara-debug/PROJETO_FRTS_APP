import { useState } from 'react'

/**
 * BotaoAcao — dispara uma ação de escrita do domínio.
 *
 * Trata os três estados da chamada: em curso, erro e sucesso. O erro exibido é
 * a MENSAGEM DO SERVIDOR — a UI não reinterpreta código de domínio nem decide se
 * a ação era permitida.
 */
export default function BotaoAcao({ onAcao, children, variante = 'primario', confirmar = null }) {
  const [emCurso, setEmCurso] = useState(false)
  const [erro, setErro] = useState(null)

  async function executar() {
    if (confirmar && !window.confirm(confirmar)) return
    setEmCurso(true)
    setErro(null)
    try {
      await onAcao()
    } catch (e) {
      // `e.codigo` vem do domínio (ex.: ORCAMENTO_TRAVADO, TRANSICAO_INVALIDA).
      setErro(e.codigo ? `${e.message} (${e.codigo})` : e.message)
    } finally {
      setEmCurso(false)
    }
  }

  const estilo = variante === 'primario'
    ? 'bg-slate-900 text-white hover:bg-slate-700 disabled:bg-slate-400'
    : 'border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:text-slate-400'

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={executar}
        disabled={emCurso}
        className={`rounded px-3 py-1.5 text-sm font-medium transition ${estilo}`}
      >
        {emCurso ? 'Processando…' : children}
      </button>
      {erro && <span role="alert" className="max-w-xs text-xs text-red-600">{erro}</span>}
    </span>
  )
}
