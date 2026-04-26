import { Bell, Search, User } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useEmpresa } from '../../contexts/EmpresaContext'

const titulos = {
  '/dashboard':     'Dashboard',
  '/clientes':      'Clientes',
  '/projetos-fv':   'Projetos Fotovoltaicos',
  '/projetos-fv/novo': 'Novo Projeto FV',
  '/projetos-ev':   'Projetos Elétrico-Veicular',
  '/homologacao':   'Homologação',
  '/configuracoes': 'Configurações',
}

export default function Header() {
  const { pathname }  = useLocation()
  const { empresa }   = useEmpresa()
  const titulo        = titulos[pathname] ?? 'Forte Solar'
  const corPrimaria   = empresa.corPrimaria || '#f97316'

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
      <h1 className="text-xl font-semibold text-slate-900">{titulo}</h1>

      <div className="flex items-center gap-3">
        {/* Busca */}
        <div className="relative hidden sm:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar..."
            className="pl-9 pr-4 py-2 text-sm bg-slate-100 rounded-lg border border-transparent
                       focus:outline-none focus:bg-white transition-colors w-56"
            style={{ '--tw-ring-color': corPrimaria }}
          />
        </div>

        {/* Notificações */}
        <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <Bell size={18} className="text-slate-600" />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ backgroundColor: corPrimaria }}
          />
        </button>

        {/* Avatar / Logo empresa */}
        <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
          {empresa.logo ? (
            <img
              src={empresa.logo}
              alt={empresa.nomeEmpresa}
              className="w-8 h-8 rounded-full object-contain border border-slate-200 bg-white p-0.5"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: corPrimaria }}
            >
              <User size={16} className="text-white" />
            </div>
          )}
        </button>
      </div>
    </header>
  )
}
