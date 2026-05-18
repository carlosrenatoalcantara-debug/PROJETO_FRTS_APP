import React from 'react'

/**
 * ErrorBoundary — captura crashes de componentes filhos e renderiza fallback
 * em vez de derrubar a árvore inteira (que apareceria como tela branca).
 *
 * Aplicado em volta de cada <Route> dentro do Layout para isolar crashes por página.
 * Componentes irmãos (ex: sidebar) continuam renderizando.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <div className="max-w-2xl mx-auto bg-white border border-amber-200 rounded-lg p-8 text-center shadow-sm">
            <div className="text-3xl mb-2">⚠️</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Algo deu errado nesta página
            </h2>
            <p className="text-slate-500 text-sm mb-4">
              O restante do app continua funcionando. Você pode tentar recarregar esta página
              ou navegar para outra seção pelo menu lateral.
            </p>
            <details className="text-left text-xs text-slate-400 mb-4 bg-slate-50 p-3 rounded">
              <summary className="cursor-pointer text-slate-600 font-medium">
                Detalhes técnicos
              </summary>
              <pre className="mt-2 whitespace-pre-wrap break-all">
                {this.state.error?.message || String(this.state.error)}
              </pre>
            </details>
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.reset}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
              >
                Tentar novamente
              </button>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 text-sm font-medium"
              >
                Voltar ao Dashboard
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
