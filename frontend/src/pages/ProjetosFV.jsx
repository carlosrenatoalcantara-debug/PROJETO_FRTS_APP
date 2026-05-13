import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Plus, Sun, Filter, Eye, Calculator, Upload, Download } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import UploadParecerModal from '../components/UploadParecerModal'

const corStatus = {
  'concluido': 'verde',
  'em_execucao': 'azul',
  'aguardando': 'amarelo',
  'proposta': 'cinza',
  'em_simulacao': 'azul',
  'rascunho': 'cinza',
  'default': 'cinza'
}

const statusLabel = {
  'concluido': 'Concluído',
  'em_execucao': 'Em Execução',
  'aguardando': 'Aguardando',
  'proposta': 'Proposta',
  'em_simulacao': 'Em Simulação',
  'rascunho': 'Rascunho',
}

export default function ProjetosFV() {
  const navigate = useNavigate()
  const [projetos, setProjetos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showParecerModal, setShowParecerModal] = useState(false)
  const [totalPotencia, setTotalPotencia] = useState(0)

  // Load projects from API
  useEffect(() => {
    carregarProjetos()
  }, [])

  const carregarProjetos = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/projetos-fv')
      if (!response.ok) throw new Error('Erro ao carregar projetos')

      const dados = await response.json()

      // Filter out test projects (those with fake-test tag)
      const projetosReais = (Array.isArray(dados) ? dados : dados.projetos || []).filter(
        p => !p.tags?.includes('fake-test')
      )

      setProjetos(projetosReais)

      // Calculate total power
      const total = projetosReais.reduce((sum, p) => {
        const potencia = parseFloat(p.potencia_kwp) || 0
        return sum + potencia
      }, 0)
      setTotalPotencia(total)

      setError(null)
    } catch (err) {
      console.error('Erro ao carregar projetos:', err)
      setError(err.message)
      setProjetos([])
    } finally {
      setLoading(false)
    }
  }

  const handleParecerProcessado = (novoProjeto) => {
    // Reload projects when a new one is added
    carregarProjetos()
    setShowParecerModal(false)
  }

  const formatarPotencia = (kwp) => {
    if (!kwp) return 'N/A'
    return kwp >= 1 ? `${kwp.toFixed(1)} kWp` : `${(kwp * 1000).toFixed(0)} Wp`
  }

  const calcularPaineis = (projeto) => {
    if (projeto.equipamentos?.paineis?.[0]?.quantidade) {
      return projeto.equipamentos.paineis[0].quantidade
    }
    return 'N/A'
  }

  const calcularInversores = (projeto) => {
    if (projeto.equipamentos?.inversor?.marca) {
      return 1 // At least one inversor if we have inversor data
    }
    return 'N/A'
  }

  return (
    <div className="space-y-5">
      {/* Topo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-100">
            <Sun size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Total de potência</p>
            <p className="font-bold text-slate-900">{totalPotencia.toFixed(1)} kWp instalados</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variante="secundario" icone={Filter} tamanho="sm">Filtros</Button>
          <Button variante="secundario" icone={Calculator} tamanho="sm" onClick={() => navigate('/projetos-fv/simulacao')}>
            Dimensionar
          </Button>
          <Button variante="secundario" icone={Upload} tamanho="sm" onClick={() => setShowParecerModal(true)}>
            Parecer de Acesso
          </Button>
          <Button icone={Plus} tamanho="sm" onClick={() => navigate('/projetos-fv/novo')}>
            Novo Projeto FV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-900">
            Projetos Fotovoltaicos{' '}
            <span className="text-slate-400 font-normal text-sm ml-1">({projetos.length})</span>
          </h2>
        </CardHeader>
        <CardBody className="p-0">
          {loading && (
            <div className="p-8 text-center text-slate-500">
              Carregando projetos...
            </div>
          )}

          {error && (
            <div className="p-8 bg-red-50 border border-red-200 rounded text-red-700">
              Erro ao carregar projetos: {error}
            </div>
          )}

          {!loading && projetos.length === 0 && !error && (
            <div className="p-8 text-center text-slate-500">
              Nenhum projeto cadastrado. Crie um novo projeto ou importe um Parecer de Acesso.
            </div>
          )}

          {!loading && projetos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Projeto','Cliente','Potência','Painéis','Inversores','Status',''].map(h => (
                      <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {projetos.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{p.nome}</td>
                      <td className="px-6 py-4 text-slate-600">{p.cliente_nome || 'N/A'}</td>
                      <td className="px-6 py-4 text-slate-600">{formatarPotencia(p.potencia_kwp)}</td>
                      <td className="px-6 py-4 text-slate-600">{calcularPaineis(p)}</td>
                      <td className="px-6 py-4 text-slate-600">{calcularInversores(p)}</td>
                      <td className="px-6 py-4">
                        <Badge cor={corStatus[p.status] || corStatus.default}>
                          {statusLabel[p.status] || p.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variante="fantasma" tamanho="sm" icone={Eye} onClick={() => navigate(`/projetos-fv/${p._id}`)}>
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Upload Parecer Modal */}
      {showParecerModal && (
        <UploadParecerModal
          onClose={() => setShowParecerModal(false)}
          onSuccess={handleParecerProcessado}
        />
      )}
    </div>
  )
}
