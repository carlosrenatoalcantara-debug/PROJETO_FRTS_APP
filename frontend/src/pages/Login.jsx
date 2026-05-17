import { useState } from 'react'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostraSenha, setMostraSenha] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [telaReset, setTelaReset] = useState(false)
  const [emailReset, setEmailReset] = useState('')
  const [mensagemReset, setMensagemReset] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: senha }),
      })

      const dados = await res.json()

      if (!res.ok) {
        setErro(dados.erro || 'Erro ao fazer login')
        return
      }

      // Salvar token
      localStorage.setItem('token', dados.token)
      localStorage.setItem('usuario', JSON.stringify(dados.usuario))

      // Redirecionar para dashboard
      navigate('/dashboard')
    } catch (err) {
      setErro('Erro ao conectar com o servidor')
      console.error(err)
    } finally {
      setCarregando(false)
    }
  }

  async function handleReset(e) {
    e.preventDefault()
    setMensagemReset('')
    setCarregando(true)

    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailReset }),
      })

      const dados = await res.json()

      if (!res.ok) {
        setMensagemReset(dados.erro || 'Erro ao solicitar reset')
        return
      }

      setMensagemReset('✅ Verifique seu email para resetar a senha')
      setEmailReset('')
    } catch (err) {
      setMensagemReset('❌ Erro ao conectar. Tente novamente.')
      console.error(err)
    } finally {
      setCarregando(false)
    }
  }

  if (telaReset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
        {/* Background decorativo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-orange-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        </div>

        {/* Card de Reset */}
        <div className="relative w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-orange-500 px-8 py-12 text-center">
              <h1 className="text-2xl font-bold text-white mb-2">Reset de Senha</h1>
              <p className="text-blue-100">Digite seu email para receber instruções</p>
            </div>

            {/* Form */}
            <form onSubmit={handleReset} className="px-8 py-8 space-y-6">
              {mensagemReset && (
                <div className={`flex items-start gap-3 p-4 rounded-lg ${mensagemReset.includes('✅') ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <p className={`text-sm ${mensagemReset.includes('✅') ? 'text-green-700' : 'text-red-700'}`}>{mensagemReset}</p>
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={emailReset}
                  onChange={(e) => setEmailReset(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              {/* Botão */}
              <button
                type="submit"
                disabled={carregando}
                className="w-full bg-gradient-to-r from-blue-600 to-orange-500 text-white font-semibold py-3 rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {carregando ? 'Enviando...' : 'Enviar Link de Reset'}
              </button>
            </form>

            {/* Footer */}
            <div className="px-8 py-6 bg-slate-50 border-t border-slate-200 text-center">
              <button
                onClick={() => setTelaReset(false)}
                className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
              >
                ← Voltar para Login
              </button>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes blob {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
          }
          .animate-blob {
            animation: blob 7s infinite;
          }
          .animation-delay-2000 {
            animation-delay: 2s;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-orange-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      </div>

      {/* Card de Login */}
      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-orange-500 px-8 py-12 text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
              </svg>
              <h1 className="text-2xl font-bold text-white">Forte Solar</h1>
            </div>
            <p className="text-blue-100">Sistema de Gestão</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="px-8 py-8 space-y-6">

            {erro && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{erro}</p>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Senha */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => setTelaReset(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                >
                  Esqueci a senha?
                </button>
              </div>
              <div className="relative">
                <input
                  type={mostraSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition pr-12"
                />
                <button
                  type="button"
                  onClick={() => setMostraSenha(!mostraSenha)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition"
                >
                  {mostraSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Botão Login */}
            <button
              type="submit"
              disabled={carregando}
              className="w-full bg-gradient-to-r from-blue-600 to-orange-500 text-white font-semibold py-3 rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {carregando ? 'Entrando...' : 'Entrar no Sistema'}
            </button>
          </form>

          {/* Footer */}
          <div className="px-8 py-6 bg-slate-50 border-t border-slate-200 text-center">
            <p className="text-sm text-slate-600">
              Primeira vez?{' '}
              <a href="https://www.fortesolar.com.br" className="text-blue-600 hover:text-blue-700 font-semibold">
                Conheça nossos serviços
              </a>
            </p>
          </div>
        </div>

        {/* Info box */}
        <div className="mt-6 p-4 bg-white/10 backdrop-blur border border-white/20 rounded-lg text-center">
          <p className="text-sm text-white/80">
            Demo: <code className="bg-white/10 px-2 py-1 rounded text-xs">demo@fortesolar.com.br</code>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  )
}
