import { useState, useEffect } from 'react'
import { Download, AlertCircle, CheckCircle, Loader, Calendar } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5005'
const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY || 'dev-key-123'

export default function AdminCatalogo() {
  const [carregando, setCarregando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [status, setStatus] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    carregarStatus()
  }, [])

  async function carregarStatus() {
    try {
      const res = await fetch(`${API_URL}/api/admin/status-importacao`, {
        headers: { 'x-admin-key': ADMIN_API_KEY },
      })
      const dados = await res.json()
      setStatus(dados)
    } catch (err) {
      console.error('Erro ao carregar status:', err)
    }
  }

  async function executarImportacao() {
    setImportando(true)
    setErro('')
    setResultado(null)

    try {
      const res = await fetch(`${API_URL}/api/admin/importar-solarmarket`, {
        method: 'POST',
        headers: { 'x-admin-key': ADMIN_API_KEY },
      })

      if (!res.ok) {
        const erroData = await res.json()
        throw new Error(erroData.erro || 'Erro na importação')
      }

      const dados = await res.json()
      setResultado(dados)
      await carregarStatus()
    } catch (err) {
      setErro(`Erro: ${err.message}`)
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Administração - Catálogo</h1>
        <p className="text-slate-600 mt-2">Gerenciar importação de equipamentos do SolarMarket</p>
      </div>

      {/* Status Atual */}
      {status && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-900">Status Atual do Catálogo</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-xs text-slate-600 uppercase font-semibold">Módulos</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{status.total?.modulos || 0}</p>
              </div>
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                <p className="text-xs text-slate-600 uppercase font-semibold">Inversores</p>
                <p className="text-2xl font-bold text-indigo-900 mt-1">{status.total?.inversores || 0}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <p className="text-xs text-slate-600 uppercase font-semibold">Estruturas</p>
                <p className="text-2xl font-bold text-purple-900 mt-1">{status.total?.estruturas || 0}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-600 uppercase font-semibold">Última Importação</p>
                {status.ultimaImportacao ? (
                  <p className="text-sm font-bold text-slate-900 mt-1">
                    {new Date(status.ultimaImportacao).toLocaleDateString('pt-BR')}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500 mt-1">Nunca</p>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Controle de Importação */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Download className="text-blue-600" />
            <h2 className="font-semibold text-slate-900">Importar do SolarMarket</h2>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-slate-700">
            Baixa o catálogo completo de equipamentos (módulos, inversores, estruturas) da API SolarMarket
            e atualiza nosso banco de dados local. Recomendado: uma vez por mês.
          </p>

          {!importando && !resultado && (
            <div className="p-4 bg-white border border-blue-200 rounded-lg">
              <p className="text-sm text-slate-600 mb-3">
                <strong>Próximas etapas:</strong>
              </p>
              <ul className="text-sm text-slate-600 space-y-1 ml-4 list-disc">
                <li>Sistema conecta à API do SolarMarket</li>
                <li>Baixa todos os equipamentos disponíveis</li>
                <li>Salva no catálogo local</li>
                <li>Atualiza registros existentes</li>
              </ul>
            </div>
          )}

          {importando && (
            <div className="p-4 bg-blue-100 border border-blue-400 rounded-lg flex items-center gap-3">
              <Loader className="animate-spin text-blue-600" />
              <div>
                <p className="font-semibold text-blue-900">Importação em andamento...</p>
                <p className="text-sm text-blue-800">Conectando ao SolarMarket...</p>
              </div>
            </div>
          )}

          {resultado && (
            <div className="space-y-3">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-2 mb-2">
                  <CheckCircle size={20} className="text-green-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-green-900">Importação Concluída!</p>
                    <p className="text-sm text-green-800 mt-1">
                      Tempo: {resultado.finalizado && resultado.iniciado
                        ? `${Math.round((new Date(resultado.finalizado) - new Date(resultado.iniciado)) / 1000)}s`
                        : '?'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  titulo="Módulos"
                  novo={resultado.modulos?.novo || 0}
                  atualizado={resultado.modulos?.atualizado || 0}
                  erro={resultado.modulos?.erro || 0}
                  cor="blue"
                />
                <StatCard
                  titulo="Inversores"
                  novo={resultado.inversores?.novo || 0}
                  atualizado={resultado.inversores?.atualizado || 0}
                  erro={resultado.inversores?.erro || 0}
                  cor="indigo"
                />
                <StatCard
                  titulo="Estruturas"
                  novo={resultado.estruturas?.novo || 0}
                  atualizado={resultado.estruturas?.atualizado || 0}
                  erro={resultado.estruturas?.erro || 0}
                  cor="purple"
                />
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-600 font-semibold">Total</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">
                    {(resultado.modulos?.novo || 0) +
                      (resultado.modulos?.atualizado || 0) +
                      (resultado.inversores?.novo || 0) +
                      (resultado.inversores?.atualizado || 0) +
                      (resultado.estruturas?.novo || 0) +
                      (resultado.estruturas?.atualizado || 0)}
                  </p>
                </div>
              </div>

              {resultado.erros && resultado.erros.length > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-semibold text-yellow-900 mb-2">Avisos:</p>
                  <ul className="text-xs text-yellow-800 space-y-1">
                    {resultado.erros.slice(0, 5).map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                    {resultado.erros.length > 5 && (
                      <li>... e mais {resultado.erros.length - 5}</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {erro && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">Erro na Importação</p>
                <p className="text-sm text-red-800 mt-1">{erro}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-3 border-t border-blue-200">
            <Button
              onClick={executarImportacao}
              disabled={importando}
              className="flex-1"
            >
              {importando ? 'Importando...' : 'Iniciar Importação'}
            </Button>
            <Button
              variante="secundario"
              onClick={carregarStatus}
              disabled={importando}
            >
              Atualizar Status
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Informações */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-900">ℹ️ Informações</h2>
        </CardHeader>
        <CardBody className="space-y-3 text-sm text-slate-700">
          <p>
            <strong>API SolarMarket:</strong> Ativa apenas para importação. Após importar, o sistema
            usa apenas o catálogo local para melhor performance.
          </p>
          <p>
            <strong>Frequência recomendada:</strong> Uma vez por mês para manter o catálogo atualizado.
          </p>
          <p>
            <strong>Dados importados:</strong> Fabricantes, modelos, especificações técnicas (Voc, Vmpp, Isc, etc),
            garantias e preços de referência.
          </p>
          <p>
            <strong>Segurança:</strong> Apenas administradores podem executar importações (requer API key admin).
          </p>
        </CardBody>
      </Card>
    </div>
  )
}

function StatCard({ titulo, novo, atualizado, erro, cor }) {
  const cores = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
  }

  return (
    <div className={`p-3 rounded-lg border ${cores[cor]}`}>
      <p className="text-xs font-semibold">{titulo}</p>
      <p className="text-lg font-bold mt-1">{novo + atualizado}</p>
      <p className="text-xs opacity-75 mt-1">
        {novo > 0 && <span>+{novo} </span>}
        {atualizado > 0 && <span>~{atualizado} </span>}
        {erro > 0 && <span className="text-red-600">❌{erro}</span>}
      </p>
    </div>
  )
}
