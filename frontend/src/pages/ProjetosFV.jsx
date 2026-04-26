import { useNavigate } from 'react-router-dom'
import { Plus, Sun, Filter, Eye, Calculator } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'

const projetos = [
  { id: 1, nome: 'Residência Silva',   cliente: 'João Silva',    potencia: '8,5 kWp',  paineis: 17,  inversores: 1, status: 'Em andamento', valor: 'R$ 32.000' },
  { id: 2, nome: 'Fazenda Oliveira',   cliente: 'Pedro Oliveira', potencia: '42 kWp',  paineis: 84,  inversores: 3, status: 'Concluído',    valor: 'R$ 98.000' },
  { id: 3, nome: 'Escola Municipal',   cliente: 'Pref. Cidade',  potencia: '25 kWp',  paineis: 50,  inversores: 2, status: 'Proposta',     valor: 'R$ 68.000' },
  { id: 4, nome: 'Supermercado Dias',  cliente: 'Lúcia Dias',    potencia: '62 kWp',  paineis: 124, inversores: 4, status: 'Aguardando',   valor: 'R$ 145.000' },
]

const corStatus = { 'Concluído': 'verde', 'Em andamento': 'azul', 'Aguardando': 'amarelo', 'Proposta': 'cinza' }

export default function ProjetosFV() {
  const navigate = useNavigate()

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
            <p className="font-bold text-slate-900">137,5 kWp instalados</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variante="secundario" icone={Filter} tamanho="sm">Filtros</Button>
          <Button variante="secundario" icone={Calculator} tamanho="sm" onClick={() => navigate('/projetos-fv/simulacao')}>
            Dimensionar
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Projeto','Cliente','Potência','Painéis','Inversores','Status','Valor',''].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {projetos.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{p.nome}</td>
                    <td className="px-6 py-4 text-slate-600">{p.cliente}</td>
                    <td className="px-6 py-4 text-slate-600">{p.potencia}</td>
                    <td className="px-6 py-4 text-slate-600">{p.paineis}</td>
                    <td className="px-6 py-4 text-slate-600">{p.inversores}</td>
                    <td className="px-6 py-4"><Badge cor={corStatus[p.status]}>{p.status}</Badge></td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{p.valor}</td>
                    <td className="px-6 py-4 text-right">
                      <Button variante="fantasma" tamanho="sm" icone={Eye}>Ver</Button>
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
