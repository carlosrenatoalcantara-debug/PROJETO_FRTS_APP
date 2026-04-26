import { Check } from 'lucide-react'

export default function Stepper({ etapas, etapaAtual, onIrPara }) {
  return (
    <nav className="flex items-center gap-0 overflow-x-auto pb-1" aria-label="Progresso">
      {etapas.map((e, idx) => {
        const concluida = e.num < etapaAtual
        const ativa     = e.num === etapaAtual
        const futura    = e.num > etapaAtual
        const clicavel  = concluida && !!onIrPara

        return (
          <div key={e.num} className="flex items-center min-w-0">
            {/* Indicador da etapa */}
            <div className="flex flex-col items-center gap-1 min-w-[56px]">
              <button
                onClick={clicavel ? () => onIrPara(e.num) : undefined}
                disabled={!clicavel && !ativa}
                title={clicavel ? `Voltar para ${e.rotulo}` : e.rotulo}
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                  'transition-all duration-150',
                  concluida ? 'bg-emerald-500 text-white' + (clicavel ? ' cursor-pointer hover:bg-emerald-600 hover:scale-105' : '') : '',
                  ativa     ? 'text-white ring-2 ring-offset-2' : '',
                  futura    ? 'bg-slate-200 text-slate-400 cursor-default' : '',
                ].filter(Boolean).join(' ')}
                style={ativa ? { backgroundColor: 'var(--cor-primaria, #f97316)', ringColor: 'var(--cor-primaria, #f97316)' } : undefined}
              >
                {concluida ? <Check size={14} /> : e.num}
              </button>
              <span className={[
                'text-[10px] font-medium whitespace-nowrap text-center leading-tight',
                ativa     ? 'font-semibold' : '',
                concluida ? 'text-emerald-600' : '',
                futura    ? 'text-slate-400'  : '',
              ].filter(Boolean).join(' ')}
              style={ativa ? { color: 'var(--cor-primaria, #f97316)' } : undefined}
              >
                {e.rotulo}
              </span>
            </div>

            {/* Conector */}
            {idx < etapas.length - 1 && (
              <div
                className="h-0.5 w-5 sm:w-8 shrink-0 mx-0.5 mb-5 rounded-full transition-colors duration-300"
                style={{ backgroundColor: e.num < etapaAtual ? 'var(--cor-primaria, #f97316)' : '#e2e8f0' }}
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}
