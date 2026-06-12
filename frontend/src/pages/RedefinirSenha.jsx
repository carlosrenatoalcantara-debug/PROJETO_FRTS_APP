/**
 * RedefinirSenha.jsx — P0-AUTH-MAIL-01
 * Página pública alvo do link do e-mail (convite/reset). Consome o token e define a senha.
 */
import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { KeyRound, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

export default function RedefinirSenha() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [estado, setEstado] = useState('idle')   // idle | enviando | ok | erro
  const [msg, setMsg] = useState('')

  async function submeter(e) {
    e.preventDefault()
    setMsg('')
    if (!token) { setEstado('erro'); setMsg('Link inválido: token ausente.'); return }
    if (senha !== confirma) { setEstado('erro'); setMsg('As senhas não coincidem.'); return }
    setEstado('enviando')
    try {
      const res = await fetch('/api/auth/redefinir-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, novaSenha: senha }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setEstado('ok'); setMsg(data.message || 'Senha redefinida com sucesso.')
        setTimeout(() => navigate('/login'), 2500)
      } else {
        setEstado('erro'); setMsg(data.error || 'Não foi possível redefinir a senha.')
      }
    } catch (err) {
      setEstado('erro'); setMsg(err.message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-6 py-4">
          <span className="text-white text-lg font-bold">Forte&nbsp;<span className="text-orange-500">Solar</span></span>
        </div>
        <form onSubmit={submeter} className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-900">
            <KeyRound size={18} className="text-orange-500" />
            <h1 className="text-lg font-semibold">Definir nova senha</h1>
          </div>

          {estado === 'ok' ? (
            <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> {msg} Redirecionando para o login…
            </div>
          ) : (
            <>
              <label className="block text-sm">
                <span className="text-slate-600">Nova senha</span>
                <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Confirmar senha</span>
                <input type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)} required
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </label>
              <p className="text-[11px] text-slate-400">Mínimo 12 caracteres, com maiúscula, minúscula, número e caractere especial.</p>

              {estado === 'erro' && msg && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" /> {msg}
                </div>
              )}

              <button type="submit" disabled={estado === 'enviando'}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
                {estado === 'enviando' ? <><Loader2 size={15} className="animate-spin" /> Salvando…</> : 'Redefinir senha'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
