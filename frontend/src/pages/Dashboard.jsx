import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sun, Users, Zap, TrendingUp, Plus, Clock } from 'lucide-react'
import StatCard from '../components/ui/StatCard'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'

const corStatus = {
  rascunho: 'cinza',
  em_simulacao: 'amarelo',
  dimensionado: 'azul',
  proposta: 'cinza',
  aprovado: 'verde',
  em_execucao: 'azul',
  concluido: 'verde',
}

const labelStatus = {
  rascunho: 'Rascunho',
  em_simulacao: 'Em Simulação',
  dimensionado: 'Dimensionado',
  proposta: 'Proposta',
  aprovado: 'Aprovado',
  em_execucao: 'Em Execução',
  concluido: 'Concluído',
}

const formatarMoeda = (valor) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(valor || 0)

const formatarData = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR')
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [resumo, setResumo] = useState(null)
  const [recentes, setRecentes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let cancelado = false
    const carregar = async () => {
      try {
        setCarregando(true)
        const [resResumo, resRecentes] = await Promise.all([
          fetch('/api/dashboard/resumo'),
          fetch('/api/dashboard/projetos-recentes?limite=5'),
        ])
        if (!resResumo.ok) throw new Error(`Resumo HTTP ${resResumo.status}`)
        if (!resRecentes.ok) throw new Error(`Recentes HTTP ${resRecentes.status}`)
        const dadosResumo = await resResumo.json()
        const dadosRecentes = await resRecentes.json()
        if (cancelado) return
        setResumo(dadosResumo)
        setRecentes(dadosRecentes)
        setErro(null)
      } catch (err) {
        if (!cancelado) setErro(err.message)
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }
    carregar()
    return () => { cancelado = true }
  }, [])

  return (
    <div className="space-y-6">
      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          titulo="Projetos FV Ativos"
          valor={carregando ? '...' : String(resumo?.projetosFVAtivos ?? 0)}
          icone={Sun}
          corIcone="bg-amber-100 text-amber-600"
        />
        <StatCard
          titulo="Projetos EV Ativos"
          valor={carregando ? '...' : String(resumo?.projetosEVAtivos ?? 0)}
          icone={Zap}
          corIcone="bg-blue-100 text-blue-600"
        />
        <StatCard
          titulo="Total de Clientes"
          valor={carregando ? '...' : String(resumo?.totalClientes ?? 0)}
          icone={Users}
          corIcone="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          titulo="Receita do Mês"
          valor={carregando ? '...' : formatarMoeda(resumo?.receitaMes)}
          icone={TrendingUp}
          corIcone="bg-primary-100 text-primary-600"
        />
      </div>

      {erro && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
          ⚠️ Não foi possível carregar os dados do servidor: {erro}
        </div>
      )}

      {/* Tabela de projetos recentes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Projetos Recentes</h2>
              <p className="text-sm text-slate-500 mt-0.5">Últimas atualizações nos projetos</p>
            </div>
            <Button icone={Plus} tamanho="sm" onClick={() => navigate('/projetos-fv/novo')}>
              Novo Projeto
            </Button>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {carregando ? (
            <div className="p-6 text-center text-slate-500">Carregando projetos...</div>
          ) : recentes.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-500 mb-3">Nenhum projeto cadastrado ainda.</p>
              <Button icone={Plus} tamanho="sm" onClick={() => navigate('/projetos-fv/novo')}>
                Criar primeiro projeto
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Projeto</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentes.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/projetos-${p.tipo.toLowerCase()}/${p.id}`)}
                    >
                      <td className="px-6 py-4 font-medium text-slate-900">{p.nome}</td>
                      <td className="px-6 py-4 text-slate-600">{p.cliente}</td>
                      <td className="px-6 py-4">
                        <Badge cor={p.tipo === 'FV' ? 'amarelo' : 'azul'}>{p.tipo}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge cor={corStatus[p.status] || 'cinza'}>
                          {labelStatus[p.status] || p.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Clock size={13} />
                          {formatarData(p.data)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
