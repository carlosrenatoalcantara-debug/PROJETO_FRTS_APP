import { Sun, Users, Zap, TrendingUp, Plus, Clock } from 'lucide-react'
import StatCard from '../components/ui/StatCard'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'

const projetosRecentes = [
  { id: 1, nome: 'Residência Silva', cliente: 'João Silva',    tipo: 'FV', status: 'Em andamento', data: '18/04/2026' },
  { id: 2, nome: 'Comércio Ferreira', cliente: 'Ana Ferreira', tipo: 'EV', status: 'Aguardando',    data: '15/04/2026' },
  { id: 3, nome: 'Fazenda Oliveira',  cliente: 'Pedro Oliveira', tipo: 'FV', status: 'Concluído',  data: '10/04/2026' },
  { id: 4, nome: 'Indústria Costa',   cliente: 'Marcia Costa',  tipo: 'EV', status: 'Em andamento', data: '08/04/2026' },
  { id: 5, nome: 'Escola Municipal',  cliente: 'Pref. Cidade',  tipo: 'FV', status: 'Proposta',    data: '05/04/2026' },
]

const corStatus = { 'Concluído': 'verde', 'Em andamento': 'azul', 'Aguardando': 'amarelo', 'Proposta': 'cinza' }

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          titulo="Projetos FV Ativos"
          valor="24"
          tendencia={12}
          descricao="vs. mês anterior"
          icone={Sun}
          corIcone="bg-amber-100 text-amber-600"
        />
        <StatCard
          titulo="Projetos EV Ativos"
          valor="8"
          tendencia={5}
          descricao="vs. mês anterior"
          icone={Zap}
          corIcone="bg-blue-100 text-blue-600"
        />
        <StatCard
          titulo="Total de Clientes"
          valor="137"
          tendencia={8}
          descricao="vs. mês anterior"
          icone={Users}
          corIcone="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          titulo="Receita do Mês"
          valor="R$ 182k"
          tendencia={18}
          descricao="vs. mês anterior"
          icone={TrendingUp}
          corIcone="bg-primary-100 text-primary-600"
        />
      </div>

      {/* Tabela de projetos recentes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Projetos Recentes</h2>
              <p className="text-sm text-slate-500 mt-0.5">Últimas atualizações nos projetos</p>
            </div>
            <Button icone={Plus} tamanho="sm">Novo Projeto</Button>
          </div>
        </CardHeader>
        <CardBody className="p-0">
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
                {projetosRecentes.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors cursor-pointer">
                    <td className="px-6 py-4 font-medium text-slate-900">{p.nome}</td>
                    <td className="px-6 py-4 text-slate-600">{p.cliente}</td>
                    <td className="px-6 py-4">
                      <Badge cor={p.tipo === 'FV' ? 'amarelo' : 'azul'}>{p.tipo}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge cor={corStatus[p.status]}>{p.status}</Badge>
                    </td>
                    <td className="px-6 py-4 text-slate-500 flex items-center gap-1.5">
                      <Clock size={13} />
                      {p.data}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
