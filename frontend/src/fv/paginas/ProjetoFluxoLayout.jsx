import { Outlet, useParams, Link } from 'react-router-dom'
import { FvProviders } from '../providers/FvProviders'
import { useProjeto } from '../providers/ProjetoProvider'
import FluxoNav from '../componentes/FluxoNav'

/**
 * ProjetoFluxoLayout — shell da nova UX FV — FV-UX-010.
 *
 * Monta os providers uma única vez e serve o fluxo canônico por `Outlet`.
 * Cada etapa é uma rota: recarregar a página abre onde o usuário estava, o que
 * o wizard antigo só conseguia via `localStorage`.
 */
function Cabecalho() {
  const { projeto, carregando, erro, projetoId } = useProjeto()
  if (carregando) return <p className="p-4 text-sm text-slate-500">Carregando projeto…</p>
  if (erro) return <p className="p-4 text-sm text-red-600">Erro ao carregar o projeto: {erro}</p>
  return (
    <header className="flex items-baseline justify-between px-4 pt-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{projeto?.nome || 'Projeto FV'}</h1>
        <p className="text-xs text-slate-500">
          {projeto?.clienteId?.nome || 'Sem cliente vinculado'}
        </p>
      </div>
      {/* §6 — convivência: a tela antiga continua acessível e inalterada. */}
      <Link to={`/projetos-fv/${projetoId}`} className="text-xs text-slate-500 underline hover:text-slate-800">
        Abrir na tela clássica
      </Link>
    </header>
  )
}

export default function ProjetoFluxoLayout() {
  const { id } = useParams()
  return (
    <FvProviders projetoId={id}>
      <div className="min-h-full bg-slate-50">
        <Cabecalho />
        <FluxoNav projetoId={id} />
        <main><Outlet /></main>
      </div>
    </FvProviders>
  )
}
