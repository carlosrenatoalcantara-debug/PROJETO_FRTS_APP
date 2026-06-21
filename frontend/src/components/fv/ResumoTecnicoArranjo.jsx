/**
 * ResumoTecnicoArranjo.jsx — P0-E7-ARRANJO-WORKFLOW-REFACTOR-01
 *
 * Resumo técnico em TEMPO REAL de um arranjo (Fase 7/11). Puramente derivado —
 * não persiste nada. Exibe P CC, P CA, oversizing, MPPT, entradas, strings e a
 * alocação (módulos atendidos vs sem inversor), com selos ✓ / ⚠ (sem bloquear).
 */
import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { resumoTecnicoArranjo } from '../../utils/agregarArranjosFV'

function Metric({ label, valor, unidade, alerta }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</span>
      <span className={`text-sm font-bold font-mono ${alerta ? 'text-amber-600' : 'text-slate-800'}`}>
        {valor}{unidade ? <span className="text-[10px] text-slate-400 ml-0.5">{unidade}</span> : null}
      </span>
    </div>
  )
}

export default function ResumoTecnicoArranjo({ arranjo, catalogo }) {
  const r = resumoTecnicoArranjo(arranjo || {}, catalogo || {})
  const overAlerta = r.oversizing != null && r.oversizing > 1.3
  const semInv = r.semInversor > 0

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Activity size={13} className="text-emerald-600" />
        <span className="text-xs font-semibold text-slate-600">Resumo técnico</span>
        <span className="ml-auto text-[10px] text-emerald-600 font-bold tracking-widest">TEMPO REAL</span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-3 gap-y-2">
        <Metric label="Potência CC" valor={r.pCC} unidade="kWp" />
        <Metric label="Potência CA" valor={r.pCA} unidade="kW" />
        <Metric label="Oversizing" valor={r.oversizing != null ? `${r.oversizing}×` : '—'} alerta={overAlerta} />
        <Metric label="Módulos" valor={r.modulos} />
        <Metric label="MPPT usados" valor={r.nMppt} />
        <Metric label="Entradas" valor={r.entradas} />
        <Metric label="Strings" valor={r.strings} />
        <Metric label="Inversores" valor={r.inversores} />
      </div>

      {/* Alocação (Fase 11) */}
      <div className="flex items-center gap-3 pt-1 border-t border-slate-200 text-xs">
        <span className="inline-flex items-center gap-1 text-emerald-700">
          <CheckCircle2 size={12} /> {r.atendidos} módulo(s) alocado(s)
        </span>
        {semInv && (
          <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
            <AlertTriangle size={12} /> {r.semInversor} sem inversor
          </span>
        )}
      </div>

      {/* Avisos visuais (não bloqueiam) */}
      {r.avisos.length > 0 && (
        <div className="space-y-1">
          {r.avisos.map((a, i) => (
            <div key={i} className={`flex items-center gap-1.5 text-[11px] ${a.nivel === 'crit' ? 'text-red-600' : 'text-amber-600'}`}>
              <AlertTriangle size={11} /> {a.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
