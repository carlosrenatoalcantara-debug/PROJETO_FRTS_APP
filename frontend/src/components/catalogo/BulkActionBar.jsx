import { useState } from 'react'
import { Trash2, CheckCircle, RefreshCw, Download, Tag, X, AlertTriangle, Loader } from 'lucide-react'

const API_URL = ''

/**
 * BulkActionBar — barra de ações em lote genérica.
 *
 * Aparece quando count > 0. Toda ação destrutiva passa por confirmação.
 * Chama /api/admin/catalogo/bulk/* com { tipo, ids }.
 *
 * @param {string}   tipo         - tipo do catálogo (ex: 'modulo')
 * @param {number}   count        - quantidade selecionada
 * @param {string[]} ids          - array de IDs selecionados
 * @param {Function} onClear      - limpa seleção
 * @param {Function} onSuccess    - callback pós-operação bem-sucedida (ex: recarregar lista)
 */
export default function BulkActionBar({ tipo, count, ids, onClear, onSuccess }) {
  const [confirmacao, setConfirmacao] = useState(null)  // { acao, label }
  const [executando, setExecutando] = useState(false)
  const [feedback, setFeedback] = useState(null)  // { tipo: 'ok'|'erro', msg }

  if (count === 0) return null

  const tipoLabel = {
    modulo: 'módulo',
    inversor: 'inversor',
    carregador_ev: 'carregador',
    bateria: 'bateria',
  }[tipo] || 'equipamento'
  const tipoPlural = count === 1 ? tipoLabel : `${tipoLabel}s`

  async function executarAcao(acao, body = {}) {
    setExecutando(true)
    setFeedback(null)
    try {
      const res = await fetch(`${API_URL}/api/admin/catalogo/bulk/${acao}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, ids, ...body }),
      })
      const data = await res.json()
      if (!res.ok || !data.sucesso) throw new Error(data.erro || 'Erro desconhecido')
      setFeedback({ tipo: 'ok', msg: mensagemSucesso(acao, data) })
      onSuccess && onSuccess(acao, data)
      setTimeout(() => { setFeedback(null); onClear() }, 2200)
    } catch (err) {
      setFeedback({ tipo: 'erro', msg: err.message })
    } finally {
      setExecutando(false)
      setConfirmacao(null)
    }
  }

  function mensagemSucesso(acao, data) {
    if (acao === 'delete')           return `${data.deletados} ${tipoPlural} excluído${count > 1 ? 's' : ''}`
    if (acao === 'validate')         return `${data.atualizados} ${tipoPlural} validado${count > 1 ? 's' : ''}`
    if (acao === 'recalculate-score') return `Score recalculado para ${data.processados} ${tipoPlural}`
    if (acao === 'status')           return `Status alterado para ${data.atualizados} ${tipoPlural}`
    if (acao === 'export')           return `${data.total} ${tipoPlural} exportado${count > 1 ? 's' : ''}`
    return 'Concluído'
  }

  async function handleExportar() {
    setExecutando(true)
    setFeedback(null)
    try {
      const res = await fetch(`${API_URL}/api/admin/catalogo/bulk/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, ids }),
      })
      if (!res.ok) throw new Error('Erro na exportação')
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data.equipamentos, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `catalogo_${tipo}_${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      setFeedback({ tipo: 'ok', msg: `${data.total} ${tipoPlural} exportado${count > 1 ? 's' : ''}` })
      setTimeout(() => setFeedback(null), 2200)
    } catch (err) {
      setFeedback({ tipo: 'erro', msg: err.message })
    } finally {
      setExecutando(false)
    }
  }

  // ── modal de confirmação ──────────────────────────────────────────────────

  if (confirmacao) {
    const isDelete = confirmacao.acao === 'delete'
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle size={22} className="text-red-500 shrink-0" />
            <h3 className="font-bold text-slate-900 text-lg">Confirmar operação</h3>
          </div>
          <p className="text-slate-700 text-sm mb-6">
            {isDelete
              ? <>Tem certeza que deseja <strong>excluir definitivamente {count} {tipoPlural}</strong>? Esta ação não pode ser desfeita.</>
              : <>Confirmar <strong>{confirmacao.label.toLowerCase()}</strong> de {count} {tipoPlural}?</>
            }
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmacao(null)}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => executarAcao(confirmacao.acao, confirmacao.body)}
              disabled={executando}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white inline-flex items-center justify-center gap-2 ${isDelete ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50`}
            >
              {executando && <Loader size={14} className="animate-spin" />}
              {isDelete ? 'Excluir definitivamente' : confirmacao.label}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── barra principal ───────────────────────────────────────────────────────

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-3xl px-4">
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-3 flex-wrap">

        {/* Contador */}
        <span className="font-semibold text-sm shrink-0">
          {count} {tipoPlural} selecionado{count > 1 ? 's' : ''}
        </span>

        <div className="h-5 w-px bg-slate-600 shrink-0" />

        {/* Feedback inline */}
        {feedback && (
          <span className={`text-sm font-medium ${feedback.tipo === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
            {feedback.tipo === 'ok' ? '✓ ' : '✗ '}{feedback.msg}
          </span>
        )}

        {/* Ações */}
        {!feedback && (
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <AcaoBtn
              icone={CheckCircle}
              label="Validar"
              onClick={() => setConfirmacao({ acao: 'validate', label: 'Validar' })}
              disabled={executando}
              cor="text-emerald-400 hover:bg-slate-700"
            />
            <AcaoBtn
              icone={RefreshCw}
              label="Recalcular Score"
              onClick={() => setConfirmacao({ acao: 'recalculate-score', label: 'Recalcular Score' })}
              disabled={executando}
              cor="text-sky-400 hover:bg-slate-700"
            />
            <AcaoBtn
              icone={Tag}
              label="Alterar Status"
              onClick={() => setConfirmacao({ acao: 'status', label: 'Alterar Status', body: { novo_status: 'aprovado' } })}
              disabled={executando}
              cor="text-amber-400 hover:bg-slate-700"
            />
            <AcaoBtn
              icone={Download}
              label="Exportar"
              onClick={handleExportar}
              disabled={executando}
              cor="text-violet-400 hover:bg-slate-700"
            />
            <AcaoBtn
              icone={Trash2}
              label="Excluir"
              onClick={() => setConfirmacao({ acao: 'delete', label: 'Excluir' })}
              disabled={executando}
              cor="text-red-400 hover:bg-red-900/30"
            />
          </div>
        )}

        {/* Cancelar seleção */}
        <button
          onClick={onClear}
          className="ml-auto p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white shrink-0"
          title="Cancelar seleção"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

function AcaoBtn({ icone: Icone, label, onClick, disabled, cor }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${cor}`}
    >
      <Icone size={13} />
      {label}
    </button>
  )
}
