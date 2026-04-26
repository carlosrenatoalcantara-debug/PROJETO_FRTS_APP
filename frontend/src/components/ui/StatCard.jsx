import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function StatCard({ titulo, valor, tendencia, descricao, icone: Icone, corIcone = 'bg-primary-100 text-primary-600' }) {
  const TendenciaIcone =
    tendencia > 0 ? TrendingUp :
    tendencia < 0 ? TrendingDown :
    Minus

  const corTendencia =
    tendencia > 0 ? 'text-emerald-600' :
    tendencia < 0 ? 'text-red-500' :
    'text-slate-400'

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex items-start justify-between gap-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-500">{titulo}</p>
        <p className="text-3xl font-bold text-slate-900">{valor}</p>
        {(tendencia !== undefined || descricao) && (
          <div className={`flex items-center gap-1 text-sm ${corTendencia}`}>
            {tendencia !== undefined && (
              <>
                <TendenciaIcone size={14} />
                <span>{Math.abs(tendencia)}%</span>
              </>
            )}
            {descricao && <span className="text-slate-400 ml-1">{descricao}</span>}
          </div>
        )}
      </div>
      {Icone && (
        <div className={`p-3 rounded-lg ${corIcone}`}>
          <Icone size={22} />
        </div>
      )}
    </div>
  )
}
