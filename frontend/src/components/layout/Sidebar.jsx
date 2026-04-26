import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Sun, Zap, Settings,
  ChevronLeft, ChevronRight, TrendingUp, Briefcase,
  Package, ChevronDown,
} from 'lucide-react'
import { useState } from 'react'
import { useEmpresa } from '../../contexts/EmpresaContext'

const itensMenu = [
  { rotulo: 'Dashboard',     caminho: '/dashboard',     icone: LayoutDashboard },
  { rotulo: 'Clientes',      caminho: '/clientes',      icone: Users           },
  { rotulo: 'Financeiro',    caminho: '/financeiro',    icone: TrendingUp      },
  { rotulo: 'CRM',           caminho: '/crm',           icone: Briefcase       },
  { rotulo: 'Equipamentos',  icone: Package, submenu: [
    { rotulo: 'Módulos',     caminho: '/equipamentos/modulos' },
    { rotulo: 'Inversores',  caminho: '/equipamentos/inversores' },
  ]},
  { rotulo: 'Configurações', caminho: '/configuracoes', icone: Settings        },
]

export default function Sidebar() {
  const [recolhida, setRecolhida] = useState(false)
  const [menuAberto, setMenuAberto] = useState({})
  const { empresa } = useEmpresa()

  const corBg     = empresa.corSecundaria || '#0f172a'
  const corAtivo  = empresa.corPrimaria   || '#f97316'

  return (
    <aside
      className="flex flex-col shrink-0 transition-all duration-300 ease-in-out"
      style={{ backgroundColor: corBg, width: recolhida ? '64px' : '240px' }}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/10 ${recolhida ? 'justify-center' : ''}`}>
        {empresa.logo ? (
          <img
            src={empresa.logo}
            alt={empresa.nomeEmpresa}
            className="w-9 h-9 rounded-lg object-contain bg-white/10 p-0.5 shrink-0"
          />
        ) : (
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
            style={{ backgroundColor: corAtivo }}
          >
            <Sun size={20} className="text-white" />
          </div>
        )}
        {!recolhida && (
          <div className="overflow-hidden">
            <p className="text-white font-bold text-base leading-tight truncate">
              {empresa.nomeEmpresa || 'Forte Solar'}
            </p>
            <p className="text-white/50 text-xs">Gestão de Projetos</p>
          </div>
        )}
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {itensMenu.map((item) => {
          const { rotulo, caminho, icone: Icone, submenu } = item
          const temSubmenu = submenu && submenu.length > 0

          if (temSubmenu) {
            return (
              <div key={rotulo}>
                <button
                  onClick={() => setMenuAberto({ ...menuAberto, [rotulo]: !menuAberto[rotulo] })}
                  className="sidebar-link w-full justify-between"
                  title={recolhida ? rotulo : undefined}
                >
                  <div className="flex items-center gap-3">
                    <Icone size={18} className="shrink-0" />
                    {!recolhida && <span className="truncate">{rotulo}</span>}
                  </div>
                  {!recolhida && (
                    <ChevronDown
                      size={16}
                      className={`transition-transform ${menuAberto[rotulo] ? 'rotate-180' : ''}`}
                    />
                  )}
                </button>
                {menuAberto[rotulo] && !recolhida && (
                  <div className="pl-4 space-y-1">
                    {submenu.map(({ rotulo: subRotulo, caminho: subCaminho }) => (
                      <NavLink
                        key={subCaminho}
                        to={subCaminho}
                        className={({ isActive }) =>
                          `sidebar-link text-sm ${isActive ? 'ativo' : ''}`
                        }
                        style={({ isActive }) =>
                          isActive ? { backgroundColor: corAtivo, color: 'white' } : undefined
                        }
                      >
                        <span className="truncate">{subRotulo}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          return (
            <NavLink
              key={caminho}
              to={caminho}
              title={recolhida ? rotulo : undefined}
              end={caminho === '/projetos-fv'}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'ativo' : ''} ${recolhida ? 'justify-center' : ''}`
              }
              style={({ isActive }) =>
                isActive ? { backgroundColor: corAtivo, color: 'white' } : undefined
              }
            >
              <Icone size={18} className="shrink-0" />
              {!recolhida && <span className="truncate">{rotulo}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Botão recolher */}
      <div className="px-2 py-4 border-t border-white/10">
        <button
          onClick={() => setRecolhida(!recolhida)}
          className={`sidebar-link w-full ${recolhida ? 'justify-center' : 'justify-between'}`}
          title={recolhida ? 'Expandir' : 'Recolher'}
        >
          {!recolhida && <span className="text-xs">Recolher</span>}
          {recolhida ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  )
}
