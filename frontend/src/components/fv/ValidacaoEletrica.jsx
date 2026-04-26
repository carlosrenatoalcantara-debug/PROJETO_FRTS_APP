import { CheckCircle, XCircle, AlertTriangle, ChevronDown } from 'lucide-react'
import { useState } from 'react'

export default function ValidacaoEletrica({ validacao, stringsConfig }) {
  const [aberta, setAberta] = useState(true)
  if (!validacao && !stringsConfig) return null

  const erros   = validacao?.erros   ?? []
  const alertas = validacao?.alertas ?? []
  const valido  = validacao?.valido  ?? true
  const det     = validacao?.detalhes ?? {}

  return (
    <div className={`rounded-xl border overflow-hidden ${
      erros.length   ? 'border-red-300 bg-red-50'
      : alertas.length ? 'border-amber-300 bg-amber-50'
      : 'border-emerald-300 bg-emerald-50'
    }`}>
      <button
        onClick={() => setAberta(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-2">
          {erros.length
            ? <XCircle size={18} className="text-red-600" />
            : alertas.length
              ? <AlertTriangle size={18} className="text-amber-600" />
              : <CheckCircle size={18} className="text-emerald-600" />
          }
          <span className={`font-semibold text-sm ${
            erros.length ? 'text-red-800' : alertas.length ? 'text-amber-800' : 'text-emerald-800'
          }`}>
            {erros.length
              ? `${erros.length} erro(s) elétrico(s) encontrado(s)`
              : alertas.length
                ? `Sistema válido com ${alertas.length} alerta(s)`
                : 'Configuração elétrica validada ✓'
            }
          </span>
        </div>
        <ChevronDown size={16} className={`transition-transform ${aberta ? 'rotate-180' : ''} text-slate-500`} />
      </button>

      {aberta && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/50">
          {/* Erros */}
          {erros.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-red-800">
              <XCircle size={14} className="shrink-0 mt-0.5 text-red-600" />
              {e}
            </div>
          ))}

          {/* Alertas */}
          {alertas.map((a, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-amber-800">
              <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
              {a}
            </div>
          ))}

          {/* Detalhes elétricos */}
          {(det.vocFrio || stringsConfig) && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {stringsConfig && <>
                <div className="bg-white/60 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-500">Painéis/string</p>
                  <p className="font-bold text-slate-900">{stringsConfig.paineisPorString}</p>
                </div>
                <div className="bg-white/60 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-500">Total strings</p>
                  <p className="font-bold text-slate-900">{stringsConfig.totalStrings}</p>
                </div>
              </>}
              {det.vocFrio && (
                <div className="bg-white/60 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-500">Voc frio</p>
                  <p className="font-bold text-slate-900">{det.vocFrio} V</p>
                </div>
              )}
              {det.oversizing && (
                <div className="bg-white/60 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-500">Oversizing DC/AC</p>
                  <p className="font-bold text-slate-900">{det.oversizing}%</p>
                </div>
              )}
            </div>
          )}

          {/* Layout de strings */}
          {stringsConfig?.distribuicaoMPPT?.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-slate-600 uppercase mb-2">Distribuição por MPPT</p>
              <div className="flex flex-wrap gap-2">
                {stringsConfig.distribuicaoMPPT.map(m => (
                  <div key={m.mppt} className="flex items-center gap-2 bg-white/70 rounded-lg px-3 py-1.5 text-sm">
                    <span className="font-semibold text-slate-700">MPPT {m.mppt}</span>
                    <span className="text-slate-500">{m.strings} string(s) × {stringsConfig.paineisPorString} painéis = {m.paineis} módulos</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
