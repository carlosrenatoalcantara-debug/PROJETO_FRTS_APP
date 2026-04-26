import { useState } from 'react'
import { Send, MessageCircle, X, Loader } from 'lucide-react'
import { consultarIA, obterApiConfigurada } from '../utils/aiService'

export default function AssisteIA({ contexto }) {
  const [aberto, setAberto] = useState(false)
  const [mensagens, setMensagens] = useState([])
  const [entrada, setEntrada] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const apiConfigurada = obterApiConfigurada()

  async function enviarPergunta() {
    if (!entrada.trim() || carregando) return

    const novaMensagem = { role: 'user', text: entrada }
    setMensagens(prev => [...prev, novaMensagem])
    setEntrada('')
    setCarregando(true)
    setErro('')

    try {
      const resultado = await consultarIA(entrada, contexto)
      setMensagens(prev => [...prev, {
        role: 'assistant',
        text: resultado.resposta,
        provider: resultado.provider,
      }])
    } catch (err) {
      setErro(err.message)
      setMensagens(prev => [...prev, {
        role: 'error',
        text: `❌ ${err.message}`,
      }])
    } finally {
      setCarregando(false)
    }
  }

  if (!apiConfigurada) {
    return null
  }

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setAberto(!aberto)}
        className="fixed bottom-6 right-6 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 z-40"
        title="Abrir assistente de IA"
      >
        {aberto ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat */}
      {aberto && (
        <div className="fixed bottom-24 right-6 w-96 bg-white rounded-lg shadow-xl z-50 flex flex-col max-h-96">
          {/* Cabeçalho */}
          <div className="bg-blue-600 text-white p-4 rounded-t-lg">
            <h3 className="font-semibold">🤖 Assistente de IA</h3>
            <p className="text-xs mt-1 opacity-90">Faça perguntas sobre seu projeto</p>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {mensagens.length === 0 && (
              <div className="text-center text-slate-500 text-sm py-8">
                <MessageCircle className="mx-auto mb-2 opacity-50" size={32} />
                <p>Como posso ajudar?</p>
              </div>
            )}

            {mensagens.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white rounded-br-none'
                      : msg.role === 'error'
                      ? 'bg-red-100 text-red-800 rounded-bl-none'
                      : 'bg-slate-100 text-slate-900 rounded-bl-none'
                  }`}
                >
                  {msg.text}
                  {msg.provider && (
                    <p className="text-xs opacity-60 mt-1">via {msg.provider}</p>
                  )}
                </div>
              </div>
            ))}

            {carregando && (
              <div className="flex justify-start">
                <div className="bg-slate-100 text-slate-900 px-3 py-2 rounded-lg text-sm rounded-bl-none flex items-center gap-2">
                  <Loader size={16} className="animate-spin" />
                  Pensando...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-slate-200 p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={entrada}
                onChange={(e) => setEntrada(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && enviarPergunta()}
                placeholder="Digite sua pergunta..."
                disabled={carregando}
                className="flex-1 px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 text-sm"
              />
              <button
                onClick={enviarPergunta}
                disabled={!entrada.trim() || carregando}
                className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
