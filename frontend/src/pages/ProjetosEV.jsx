import { Plus, Zap, Filter } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'

const projetos = [
  { id: 1, nome: 'Garagem Ferreira',  cliente: 'Ana Ferreira',  pontos: 2, potencia: '22 kW', tipo: 'AC',  status: 'Em andamento', valor: 'R$ 18.000' },
  { id: 2, nome: 'Frota Ind. Costa',  cliente: 'Marcia Costa',  pontos: 8, potencia: '200 kW', tipo: 'DC', status: 'Proposta',     valor: 'R$ 320.000' },
  { id: 3, nome: 'Estacionamento BD', cliente: 'Banco Dados SA', pontos: 4, potencia: '88 kW', tipo: 'AC', status: 'Aguardando',   valor: 'R$ 64.000' },
]

const corStatus = { 'Concluído': 'verde', 'Em andamento': 'azul', 'Aguardando': 'amarelo', 'Proposta': 'cinza' }

export default function ProjetosEV() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-100">
            <Zap size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Total de pontos de recarga</p>
            <p className="font-bold text-slate-900">14 pontos</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variante="secundario" icone={Filter} tamanho="sm">Filtros</Button>
          <Button icone={Plus} tamanho="sm">Novo Projeto EV</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-900">
            Projetos Elétrico-Veicular <span className="text-slate-400 font-normal text-sm ml-1">({projetos.length})</span>
          </h2>
        </CardHeader>
        <CardBody className="p-0">
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
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {projetos.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{p.nome}</td>
                    <td className="px-6 py-4 text-slate-600">{p.cliente}</td>
                    <td className="px-6 py-4 text-slate-600 hidden md:table-cell">{p.pontos}</td>
                    <td className="px-6 py-4 text-slate-600 hidden md:table-cell">{p.potencia}</td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <Badge cor={p.tipo === 'DC' ? 'azul' : 'cinza'}>{p.tipo}</Badge>
                    </td>
                    <td className="px-6 py-4"><Badge cor={corStatus[p.status]}>{p.status}</Badge></td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{p.valor}</td>
                    <td className="px-6 py-4 text-right">
                      <Button variante="fantasma" tamanho="sm">Ver</Button>
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
