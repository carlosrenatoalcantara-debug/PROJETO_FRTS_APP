import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import AssisteIA from '../AssisteIA'
import ErrorBoundary from './ErrorBoundary'

export default function Layout() {
  const location = useLocation()
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {/* key={pathname} reseta o ErrorBoundary ao navegar entre rotas
              — assim um crash em /crm não fica "preso" ao mudar para /clientes. */}
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <AssisteIA />
    </div>
  )
}
