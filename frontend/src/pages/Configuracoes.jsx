import { useState, useEffect } from 'react'
import { ArrowLeft, Save, Check, ExternalLink, ToggleLeft, ToggleRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

const APIS = [
  {
    id: 'googleMaps',
    nome: 'Google Maps',
    descricao: 'Mapa de localização e desenho de telhado',
    docs: 'https://console.cloud.google.com',
    storageKey: 'googleMapsApiKey',
    placeholder: 'AIzaSyD...',
    categoria: 'Mapas',
  },
  {
    id: 'googleGemini',
    nome: 'Google Gemini',
    descricao: 'IA para análise técnica e respostas de perguntas',
    docs: 'https://ai.google.dev',
    storageKey: 'geminiApiKey',
    placeholder: 'AIzaSy...',
    categoria: 'Inteligência Artificial',
  },
  {
    id: 'openaiGPT',
    nome: 'OpenAI GPT',
    descricao: 'IA avançada para análise de projetos e conferência de dados',
    docs: 'https://platform.openai.com/api-keys',
    storageKey: 'openaiApiKey',
    placeholder: 'sk-...',
    categoria: 'Inteligência Artificial',
  },
  {
    id: 'claudeAI',
    nome: 'Anthropic Claude',
    descricao: 'IA para análise técnica e processamento de documentos',
    docs: 'https://console.anthropic.com',
    storageKey: 'claudeApiKey',
    placeholder: 'sk-ant-...',
    categoria: 'Inteligência Artificial',
  },
]

export default function Configuracoes() {
  const navigate = useNavigate()
  const [chaves, setChaves] = useState({})
  const [apiAtivada, setApiAtivada] = useState({})
  const [iaAtiva, setIaAtiva] = useState('')
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    const novasChaves = {}
    const novasAtivacoes = {}

    APIS.forEach(api => {
      const chaveArmazenada = localStorage.getItem(api.storageKey)
      novasChaves[api.id] = chaveArmazenada || ''

      const ativada = localStorage.getItem(`${api.storageKey}_ativo`) === 'true'
      novasAtivacoes[api.id] = ativada && chaveArmazenada?.trim()
    })

    setChaves(novasChaves)
    setApiAtivada(novasAtivacoes)

    const iaArmazenada = localStorage.getItem('iaAtiva')
    if (iaArmazenada) {
      setIaAtiva(iaArmazenada)
    }
  }, [])

  function atualizarChave(apiId, valor) {
    setChaves(prev => ({ ...prev, [apiId]: valor }))
  }

  function alternarApiAtivada(apiId) {
    const api = APIS.find(a => a.id === apiId)

    // Se é IA, desativar outra IA e ativar esta
    if (api.categoria === 'Inteligência Artificial') {
      if (apiAtivada[apiId]) {
        // Desativar
        setApiAtivada(prev => ({ ...prev, [apiId]: false }))
        setIaAtiva('')
      } else {
        // Ativar apenas esta IA
        const novasAtivacoes = {}
        APIS.forEach(a => {
          novasAtivacoes[a.id] = false
        })
        novasAtivacoes[apiId] = true
        setApiAtivada(novasAtivacoes)
        setIaAtiva(apiId)
      }
    } else {
      // Para outras APIs (como Google Maps), toggle simples
      setApiAtivada(prev => ({ ...prev, [apiId]: !prev[apiId] }))
    }
  }

  function salvarTodas() {
    // Google Maps é obrigatório
    if (!chaves.googleMaps?.trim()) {
      alert('⚠️ Google Maps é obrigatório para o funcionamento do mapa')
      return
    }

    // Salvar chaves
    APIS.forEach(api => {
      localStorage.setItem(api.storageKey, chaves[api.id])
      localStorage.setItem(`${api.storageKey}_ativo`, apiAtivada[api.id] ? 'true' : 'false')
    })

    // Salvar qual IA está ativa
    if (iaAtiva) {
      localStorage.setItem('iaAtiva', iaAtiva)
    }

    setSalvo(true)
    setTimeout(() => {
      window.location.reload()
    }, 1500)
  }

  const podesSalvar = chaves.googleMaps?.trim()

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-lg hover:bg-slate-100"
        >
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Configurações</h1>
          <p className="text-sm text-slate-600">Gerenciar chaves de API</p>
        </div>
      </div>

      {/* Cartão principal com todas as APIs */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-900">Chaves de API</h2>
          <p className="text-sm text-slate-600 mt-1">Configure as APIs necessárias para o funcionamento completo do sistema</p>
        </CardHeader>
        <CardBody className="space-y-8">
          {/* Agrupar por categoria */}
          {['Mapas', 'Inteligência Artificial'].map(categoria => {
            const apisDaCategoria = APIS.filter(api => api.categoria === categoria)
            return (
              <div key={categoria}>
                <h3 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-200">
                  {categoria}
                </h3>
                <div className="space-y-6">
                  {apisDaCategoria.map(api => (
                    <div key={api.id} className={`pb-6 border-b border-slate-100 last:pb-0 last:border-0 ${apiAtivada[api.id] ? 'bg-green-50 -mx-6 px-6' : ''}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-slate-900">{api.nome}</h4>
                            {chaves[api.id]?.trim() && (
                              <button
                                onClick={() => alternarApiAtivada(api.id)}
                                className={`p-1 rounded flex-shrink-0 transition ${
                                  apiAtivada[api.id]
                                    ? 'bg-green-200 text-green-700 hover:bg-green-300'
                                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                }`}
                                title={apiAtivada[api.id] ? 'Desativar' : 'Ativar'}
                              >
                                {apiAtivada[api.id] ? (
                                  <ToggleRight size={20} />
                                ) : (
                                  <ToggleLeft size={20} />
                                )}
                              </button>
                            )}
                            {apiAtivada[api.id] && (
                              <span className="text-xs font-semibold bg-green-600 text-white px-2 py-1 rounded">
                                ATIVA
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-600">{api.descricao}</p>
                        </div>
                        <a
                          href={api.docs}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-slate-100 flex-shrink-0 ml-2"
                          title="Abrir documentação"
                        >
                          <ExternalLink size={16} className="text-slate-400" />
                        </a>
                      </div>

                      <Input
                        rotulo="Chave de API"
                        tipo="password"
                        value={chaves[api.id] || ''}
                        onChange={(e) => atualizarChave(api.id, e.target.value)}
                        placeholder={api.placeholder}
                      />

                      {api.categoria === 'Inteligência Artificial' && chaves[api.id]?.trim() && (
                        <p className="text-xs text-slate-500 mt-2">
                          {apiAtivada[api.id]
                            ? '✓ Esta é a IA que será usada no assistente'
                            : 'Ative para usar no assistente'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          <div className="pt-4">
            <Button
              onClick={salvarTodas}
              disabled={!podesSalvar || salvo}
              icone={salvo ? Check : Save}
              className="w-full"
            >
              {salvo ? 'Salvo com sucesso!' : 'Salvar todas as chaves'}
            </Button>
          </div>

          {salvo && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">
                ✓ Chaves salvas! A página será recarregada em instantes...
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Agente de IA */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-900">🤖 Agente de IA do Projeto</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-slate-700">
            Configure pelo menos uma API de Inteligência Artificial para habilitar o agente que pode:
          </p>
          <ul className="text-sm text-slate-700 space-y-2 ml-4">
            <li>✓ Responder perguntas sobre projetos FV e EV</li>
            <li>✓ Analisar dados técnicos e conferir cálculos</li>
            <li>✓ Gerar relatórios técnicos automáticos</li>
            <li>✓ Sugerir otimizações baseado em padrões</li>
            <li>✓ Validar dados de entrada e alertar inconsistências</li>
          </ul>

          <div className="pt-4 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-700 mb-3">Como obter as chaves (cada conta gratuita gera sua própria):</p>
            <div className="space-y-3">
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <a href="https://ai.google.dev" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm font-medium inline-flex items-center gap-2">
                  📌 Google Gemini
                </a>
                <p className="text-xs text-slate-600 mt-2">
                  <strong>Gratuito</strong> com limites generosos. Acesse <code className="bg-white px-2 py-1 rounded text-xs">ai.google.dev</code>, faça login com sua conta Google e crie uma chave de API no "API key" do Google AI Studio.
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm font-medium">
                  📌 OpenAI GPT
                </a>
                <p className="text-xs text-slate-600 mt-2">
                  <strong>Pago</strong> (com trial de $5). Crie conta em <code className="bg-slate-200 px-2 py-1 rounded text-xs">openai.com</code> e gere chave em "API keys".
                </p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline text-sm font-medium">
                  📌 Anthropic Claude
                </a>
                <p className="text-xs text-slate-600 mt-2">
                  <strong>Pago</strong> (com trial). Acesse <code className="bg-white px-2 py-1 rounded text-xs">console.anthropic.com</code>, faça login com sua conta, vá para "API keys" e crie uma nova chave. Cole aqui para usar sua conta pessoal.
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-900">
                💡 <strong>Dica:</strong> Cada API é vinculada à sua conta pessoal. Use a que já tiver acesso ou que preferir. O sistema usa a primeira disponível em ordem de prioridade.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Instruções Google Maps */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-900">Como obter a chave Google Maps</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <ol className="space-y-3 text-sm text-slate-700">
            <li>
              <span className="font-semibold">1.</span> Acesse{' '}
              <a
                href="https://console.cloud.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                Google Cloud Console
                <ExternalLink size={14} />
              </a>
            </li>
            <li>
              <span className="font-semibold">2.</span> Crie um novo projeto ou selecione um existente
            </li>
            <li>
              <span className="font-semibold">3.</span> Ative as APIs:
              <ul className="ml-4 mt-2 space-y-1">
                <li>• Maps JavaScript API</li>
                <li>• Maps Static API</li>
              </ul>
            </li>
            <li>
              <span className="font-semibold">4.</span> Vá para "Credenciais" e crie uma chave de API
            </li>
            <li>
              <span className="font-semibold">5.</span> Configure restrições de chave (HTTP referrers - seu domínio)
            </li>
            <li>
              <span className="font-semibold">6.</span> Copie a chave e cole no campo acima
            </li>
          </ol>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-700">
              💡 <span className="font-semibold">Dica de segurança:</span> Restrinja a chave aos domínios do seu aplicativo
              para evitar uso não autorizado
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
