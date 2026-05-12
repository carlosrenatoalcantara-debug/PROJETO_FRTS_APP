import { useState, useEffect } from 'react'
import { Plus, Zap, Filter } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001'

const corStatus = {
  'rascunho': 'cinza',
  'em_simulacao': 'amarelo',
  'dimensionado': 'azul',
  'proposta': 'cinza',
  'aprovado': 'verde',
  'em_execucao': 'azul',
  'concluido': 'verde',
}

const statusLabel = {
  'rascunho': 'Rascunho',
  'em_simulacao': 'Em Simulação',
  'dimensionado': 'Dimensionado',
  'proposta': 'Proposta',
  'aprovado': 'Aprovado',
  'em_execucao': 'Em Execução',
  'concluido': 'Concluído',
}

export default function ProjetosEV() {
  const navigate = useNavigate()
  const [projetos, setProjetos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    carregarProjetos()
  }, [])

  const carregarProjetos = async () => {
    try {
      setCarregando(true)
      const response = await fetch(`${API_URL}/api/projetos-ev`)
      if (!response.ok) throw new Error('Erro ao carregar projetos')
      const dados = await response.json()
      setProjetos(dados)
      setErro(null)
    } catch (err) {
      console.error('Erro ao carregar projetos EV:', err)
      setErro(err.message)
      setProjetos([])
    } finally {
      setCarregando(false)
    }
  }

  const formatarMoeda = (valor) => {
    if (!valor) return 'N/A'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-100">
            <Zap size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Total de pontos de recarga</p>
            <p className="font-bold text-slate-900">
              {projetos.reduce((sum, p) => sum + (p.quantidade_pontos || 0), 0)} pontos
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variante="secundario" icone={Filter} tamanho="sm">Filtros</Button>
          <Button icone={Plus} tamanho="sm" onClick={() => navigate('/propostas-ev/nova')}>
            Novo Projeto EV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-900">
            Projetos Elétrico-Veicular <span className="text-slate-400 font-normal text-sm ml-1">({projetos.length})</span>
          </h2>
        </CardHeader>
        <CardBody className="p-0">
          {carregando ? (
            <div className="p-6 text-center text-slate-500">
              Carregando projetos...
            </div>
          ) : erro ? (
            <div className="p-6 text-center text-red-500">
              Erro ao carregar projetos: {erro}
            </div>
          ) : projetos.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              Nenhum projeto criado ainda.{' '}
              <Button
                variante="fantasma"
                tamanho="sm"
                onClick={() => navigate('/propostas-ev/nova')}
                className="inline-block ml-2"
              >
                Criar novo
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Projeto</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Pontos</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Potência</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Tipo</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {projetos.map((p) => {
                    const carregador = p.carregadores?.[0]
                    const tipoLabel = carregador?.tipo || 'AC'
                    return (
                      <tr key={p._id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">{p.nome}</td>
                        <td className="px-6 py-4 text-slate-600">{p.clienteId?.nome || 'N/A'}</td>
                        <td className="px-6 py-4 text-slate-600 hidden md:table-cell">{p.quantidade_pontos || 0}</td>
                        <td className="px-6 py-4 text-slate-600 hidden md:table-cell">{p.potencia_total_kw || 0} kW</td>
                        <td className="px-6 py-4 hidden lg:table-cell">
                          <Badge cor={tipoLabel === 'DC' ? 'azul' : 'cinza'}>{tipoLabel}</Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge cor={corStatus[p.status] || 'cinza'}>
                            {statusLabel[p.status] || p.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variante="fantasma"
                            tamanho="sm"
                            onClick={() => navigate(`/projetos-ev/${p._id}`)}
                          >
                            Ver
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
