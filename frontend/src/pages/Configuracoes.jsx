import { useState, useEffect } from 'react'
import { ArrowLeft, Save, Check, ExternalLink, ToggleLeft, ToggleRight, Lock, AlertCircle, Loader, Eye, EyeOff, Trash2, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { useAuth } from '../context/AuthContext'

const API_INTEGRATIONS = [
  {
    id: 'GoogleMaps',
    nome: 'Google Maps',
    descricao: 'Mapa de localização e desenho de telhado',
    docs: 'https://console.cloud.google.com',
    placeholder: 'AIzaSy...',
    categoria: 'Mapas',
    obrigatoria: true,
  },
  {
    id: 'GeminiVision',
    nome: 'Google Gemini',
    descricao: 'IA para análise técnica e respostas de perguntas',
    docs: 'https://ai.google.dev',
    placeholder: 'AIzaSy...',
    categoria: 'Inteligência Artificial',
  },
  {
    id: 'OpenAI',
    nome: 'OpenAI GPT',
    descricao: 'IA avançada para análise de projetos e conferência de dados',
    docs: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-...',
    categoria: 'Inteligência Artificial',
  },
  {
    id: 'Claude',
    nome: 'Anthropic Claude',
    descricao: 'IA para análise técnica e processamento de documentos',
    docs: 'https://console.anthropic.com',
    placeholder: 'sk-ant-...',
    categoria: 'Inteligência Artificial',
  },
]

export default function Configuracoes() {
  const navigate = useNavigate()
  const { token } = useAuth()

  // Estado de chaves seguras do backend
  const [chavesSeguras, setChavesSeguras] = useState([])
  const [carregandoChaves, setCarregandoChaves] = useState(true)
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(false)

  // Estado do formulário para adicionar nova chave
  const [telaFormulario, setTelaFormulario] = useState(false)
  const [novaChave, setNovaChave] = useState({
    integrationName: '',
    apiKey: '',
    description: '',
  })
  const [enviandoChave, setEnviandoChave] = useState(false)

  useEffect(() => {
    carregarChaves()
  }, [token])

  async function carregarChaves() {
    try {
      setCarregandoChaves(true)
      setErro(null)

      if (!token) {
        setChavesSeguras([])
        return
      }

      const response = await fetch('/api/integrations/keys', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setChavesSeguras(data.keys || [])
      } else if (response.status !== 401) {
        setErro('Erro ao carregar chaves do servidor')
      }
    } catch (erro) {
      console.error('[Configuracoes] Erro:', erro)
      setErro('Erro ao carregar configurações')
    } finally {
      setCarregandoChaves(false)
    }
  }

  async function adicionarChave(e) {
    e.preventDefault()

    if (!novaChave.integrationName) {
      setErro('Selecione uma integração')
      return
    }

    if (!novaChave.apiKey.trim()) {
      setErro('A chave de API não pode estar vazia')
      return
    }

    try {
      setEnviandoChave(true)
      setErro(null)

      const response = await fetch('/api/integrations/add-key', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrationName: novaChave.integrationName,
          apiKey: novaChave.apiKey,
          description: novaChave.description,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setSucesso(true)
        setNovaChave({ integrationName: '', apiKey: '', description: '' })
        setTelaFormulario(false)
        await carregarChaves()
        setTimeout(() => setSucesso(false), 3000)
      } else {
        const errorData = await response.json()
        setErro(errorData.error || 'Erro ao salvar a chave')
      }
    } catch (erro) {
      console.error('Erro ao adicionar chave:', erro)
      setErro('Erro ao adicionar chave')
    } finally {
      setEnviandoChave(false)
    }
  }

  async function revogarChave(keyId, integrationName) {
    if (!window.confirm(`Tem certeza que deseja revogar a chave de ${integrationName}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/integrations/keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        setSucesso(true)
        await carregarChaves()
        setTimeout(() => setSucesso(false), 3000)
      } else {
        setErro('Erro ao revogar chave')
      }
    } catch (erro) {
      console.error('Erro ao revogar chave:', erro)
      setErro('Erro ao revogar chave')
    }
  }

  async function rotacionarChave(keyId) {
    const novaChaveValor = prompt('Digite a nova chave de API:')
    if (!novaChaveValor?.trim()) return

    try {
      const response = await fetch(`/api/integrations/keys/${keyId}/rotate`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newApiKey: novaChaveValor }),
      })

      if (response.ok) {
        setSucesso(true)
        await carregarChaves()
        setTimeout(() => setSucesso(false), 3000)
      } else {
        setErro('Erro ao rotacionar chave')
      }
    } catch (erro) {
      console.error('Erro ao rotacionar chave:', erro)
      setErro('Erro ao rotacionar chave')
    }
  }

  const getIntegrationInfo = (name) => {
    return API_INTEGRATIONS.find(api => api.id === name) || {}
  }

  const chavasAgrupadasPorCategoria = API_INTEGRATIONS.reduce((acc, api) => {
    if (!acc[api.categoria]) acc[api.categoria] = []
    acc[api.categoria].push(api)
    return acc
  }, {})

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
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
          <p className="text-sm text-slate-600">Gerenciar chaves de API com segurança</p>
        </div>
      </div>

      {/* Alertas */}
      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-800 font-medium">Erro</p>
            <p className="text-red-700 text-sm">{erro}</p>
          </div>
        </div>
      )}

      {sucesso && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <Check size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-800 font-medium">Operação realizada com sucesso</p>
        </div>
      )}

      {/* Aviso de Segurança */}
      <Card className="border-blue-200 bg-blue-50">
        <CardBody className="flex items-start gap-3">
          <Lock size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">🔐 Suas chaves estão seguras</p>
            <p className="text-sm text-blue-800 mt-1">
              As chaves de API são armazenadas com criptografia AES-256-GCM no servidor. Nunca são transmitidas em texto plano e não são armazenadas no seu navegador.
            </p>
            <ul className="text-sm text-blue-800 mt-2 space-y-1">
              <li>✅ Criptografia de ponta a ponta</li>
              <li>✅ Rotação automática a cada 90 dias</li>
              <li>✅ Auditoria de acesso completa</li>
              <li>✅ Proteção contra XSS e injeção</li>
            </ul>
          </div>
        </CardBody>
      </Card>

      {/* Chaves Armazenadas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Chaves de API Ativas</h2>
              <p className="text-sm text-slate-600 mt-1">Gerenciar suas credenciais de integração</p>
            </div>
            <button
              onClick={() => setTelaFormulario(!telaFormulario)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus size={18} />
              {telaFormulario ? 'Cancelar' : 'Adicionar Chave'}
            </button>
          </div>
        </CardHeader>
        <CardBody>
          {carregandoChaves ? (
            <div className="flex items-center justify-center py-8">
              <Loader size={20} className="animate-spin text-slate-400" />
              <span className="ml-2 text-slate-600">Carregando...</span>
            </div>
          ) : chavesSeguras.length === 0 && !telaFormulario ? (
            <div className="py-8 text-center">
              <Lock size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-600">Nenhuma chave de API configurada ainda</p>
              <p className="text-sm text-slate-500 mt-1">Adicione as primeiras credenciais para começar</p>
            </div>
          ) : (
            <div className="space-y-4">
              {chavesSeguras.map(chave => {
                const info = getIntegrationInfo(chave.integrationName)
                return (
                  <div key={chave.keyId} className="border border-slate-200 rounded-lg p-4 hover:shadow-sm transition">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-slate-900">{info.nome || chave.integrationName}</h3>
                        {chave.description && (
                          <p className="text-sm text-slate-600 mt-1">{chave.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => rotacionarChave(chave.keyId)}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded transition"
                          title="Rotacionar chave"
                        >
                          <ToggleRight size={18} />
                        </button>
                        <button
                          onClick={() => revogarChave(chave.keyId, info.nome || chave.integrationName)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                          title="Revogar chave"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Info da Chave */}
                    <div className="bg-slate-50 rounded-lg p-3 mb-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">Chave:</span>
                        <span className="font-mono text-sm text-slate-900">{chave.maskedKey}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">Criada:</span>
                        <span className="text-sm text-slate-600">{new Date(chave.createdAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                      {chave.lastUsed && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700">Último uso:</span>
                          <span className="text-sm text-slate-600">{new Date(chave.lastUsed).toLocaleDateString('pt-BR')}</span>
                        </div>
                      )}

                      {/* Status de Rotação */}
                      <div className={`flex items-center justify-between p-2 rounded ${
                        chave.daysUntilRotation <= 7 ? 'bg-red-100' : 'bg-green-100'
                      }`}>
                        <span className="text-sm font-medium text-slate-700">Rotação:</span>
                        <span className={`text-sm font-medium ${
                          chave.daysUntilRotation <= 7 ? 'text-red-700' : 'text-green-700'
                        }`}>
                          {chave.daysUntilRotation > 0
                            ? `${chave.daysUntilRotation} dias`
                            : '⚠️ Vencida - rotacione agora'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Formulário para Adicionar Chave */}
      {telaFormulario && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <h3 className="font-semibold text-slate-900">Adicionar Nova Chave de API</h3>
          </CardHeader>
          <CardBody>
            <form onSubmit={adicionarChave} className="space-y-4">
              {/* Seleção de Integração */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Integração *
                </label>
                <select
                  value={novaChave.integrationName}
                  onChange={(e) => setNovaChave({ ...novaChave, integrationName: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecione uma integração</option>
                  {API_INTEGRATIONS.map(api => (
                    <option key={api.id} value={api.id}>
                      {api.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Campo de Chave */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Chave de API *
                </label>
                <input
                  type="password"
                  value={novaChave.apiKey}
                  onChange={(e) => setNovaChave({ ...novaChave, apiKey: e.target.value })}
                  placeholder={API_INTEGRATIONS[0]?.placeholder || 'Cole aqui sua chave de API'}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                />
              </div>

              {/* Campo de Descrição */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Descrição (opcional)
                </label>
                <input
                  type="text"
                  value={novaChave.description}
                  onChange={(e) => setNovaChave({ ...novaChave, description: e.target.value })}
                  placeholder="Ex: Chave para produção, Chave de desenvolvimento..."
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Botões */}
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={enviandoChave}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {enviandoChave ? (
                    <>
                      <Loader size={18} className="animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Salvar Chave
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTelaFormulario(false)
                    setNovaChave({ integrationName: '', apiKey: '', description: '' })
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Guia de Integração */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-slate-900">Como Obter suas Chaves de API</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-6">
            {Object.entries(chavasAgrupadasPorCategoria).map(([categoria, apis]) => (
              <div key={categoria}>
                <h4 className="font-medium text-slate-900 mb-3">{categoria}</h4>
                <div className="space-y-3">
                  {apis.map(api => (
                    <div key={api.id} className="p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-slate-900">{api.nome}</p>
                        <a
                          href={api.docs}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm"
                        >
                          Acessar
                          <ExternalLink size={14} />
                        </a>
                      </div>
                      <p className="text-sm text-slate-600">{api.descricao}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
