/**
 * TopologiaMPPTEditor.jsx — P1-MPPT-TOPOLOGY-IMPLEMENTATION-01
 *
 * Editor da topologia FV REAL de campo:
 *   Arranjo → Inversor → MPPT → Entrada → String → quantidade de módulos
 *
 * Permite:
 *  - entradas independentes (1..N por MPPT, sugerido por entradas_por_mppt)
 *  - strings independentes por entrada (paralelas)
 *  - módulos por string independentes
 *  - entradas vazias (string com 0 ou entrada sem strings)
 *  - MPPT parcialmente utilizado
 *
 * Componente CONTROLADO: recebe `value` (array por MPPT) e emite `onChange`.
 * Não persiste nada por si só — o ConfiguradorArranjoFV inclui no payload.
 *
 * value: [ { entradas: [ { strings: [ { modulos:Number } ] } ] } ]  (length = nMppts)
 */
import { GitBranch, Plus, Trash2, Zap } from 'lucide-react'

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// Voc corrigida pelo frio (pior caso de tensão de circuito aberto)
const vocFrio = (voc, coef, tmin) => voc * (1 + (coef ?? 0) * (tmin - 25))

/** value vazio inicial p/ N MPPTs com `entradasPorMppt` entradas vazias cada */
export function topologiaVazia(nMppts, entradasPorMppt = 2) {
  return Array.from({ length: Math.max(1, nMppts) }, () => ({
    entradas: Array.from({ length: Math.max(1, entradasPorMppt) }, () => ({ strings: [] })),
  }))
}

/** Deriva a topologia detalhada a partir do modelo simples (numStrings/modulosPorString) */
export function derivarTopologia(mpptsSimples, entradasPorMppt = 2) {
  return (mpptsSimples || []).map((m) => {
    const nEnt = Math.max(entradasPorMppt, 1)
    const entradas = Array.from({ length: nEnt }, () => ({ strings: [] }))
    // distribui `numStrings` strings de `modulosPorString` nas primeiras entradas
    for (let s = 0; s < (m.numStrings || 0); s++) {
      entradas[s % nEnt].strings.push({ modulos: m.modulosPorString || 0 })
    }
    return { entradas }
  })
}

/** Totais agregados da topologia detalhada */
export function resumoTopologia(value) {
  let totalModulos = 0, totalStrings = 0, entradasUsadas = 0, entradasTotais = 0
  for (const m of value || []) {
    for (const e of m.entradas || []) {
      entradasTotais++
      const comModulos = (e.strings || []).filter((s) => (s.modulos || 0) > 0)
      if (comModulos.length > 0) entradasUsadas++
      for (const s of comModulos) { totalModulos += s.modulos; totalStrings++ }
    }
  }
  return { totalModulos, totalStrings, entradasUsadas, entradasTotais }
}

export default function TopologiaMPPTEditor({
  value,
  onChange,
  eletricoMod,
  eletricoInv,
  tmin = 10,
}) {
  const mppts = Array.isArray(value) ? value : []

  function setMpptEntradas(mi, entradas) {
    onChange(mppts.map((m, i) => (i === mi ? { ...m, entradas } : m)))
  }
  function addEntrada(mi) {
    setMpptEntradas(mi, [...(mppts[mi].entradas || []), { strings: [] }])
  }
  function delEntrada(mi, ei) {
    setMpptEntradas(mi, (mppts[mi].entradas || []).filter((_, k) => k !== ei))
  }
  function addString(mi, ei) {
    const entradas = (mppts[mi].entradas || []).map((e, k) =>
      k === ei ? { strings: [...(e.strings || []), { modulos: 0 }] } : e
    )
    setMpptEntradas(mi, entradas)
  }
  function delString(mi, ei, si) {
    const entradas = (mppts[mi].entradas || []).map((e, k) =>
      k === ei ? { strings: (e.strings || []).filter((_, j) => j !== si) } : e
    )
    setMpptEntradas(mi, entradas)
  }
  function setModulos(mi, ei, si, modulos) {
    const v = Math.max(0, Math.min(40, Number(modulos) || 0))
    const entradas = (mppts[mi].entradas || []).map((e, k) =>
      k === ei
        ? { strings: (e.strings || []).map((s, j) => (j === si ? { modulos: v } : s)) }
        : e
    )
    setMpptEntradas(mi, entradas)
  }

  const r = resumoTopologia(mppts)
  const vMax = eletricoInv?.tensao_max_entrada ?? null
  const iMax = eletricoInv?.corrente_max_mppt ?? null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <GitBranch className="w-4 h-4 text-blue-500" />
        <h3 className="text-sm font-semibold text-slate-700">Topologia Real (Entradas / Strings)</h3>
        <span className="text-[10px] font-bold tracking-widest text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
          MPPT → ENTRADA → STRING
        </span>
        <span className="ml-auto text-xs text-slate-500">
          {r.totalModulos} módulos · {r.totalStrings} strings · {r.entradasUsadas}/{r.entradasTotais} entradas usadas
        </span>
      </div>

      <div className="space-y-3">
        {mppts.map((m, mi) => {
          const entradas = m.entradas || []
          const usadas = entradas.filter((e) => (e.strings || []).some((s) => (s.modulos || 0) > 0)).length
          return (
            <div key={mi} className="rounded-xl border-2 border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-amber-500" />
                  <span className="text-sm font-semibold text-slate-800">MPPT {mi + 1}</span>
                  <span className="text-[10px] text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">
                    {usadas}/{entradas.length} entradas usadas
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => addEntrada(mi)}
                    className="text-xs text-blue-700 hover:bg-blue-50 rounded px-2 py-1 flex items-center gap-1">
                    <Plus size={12} /> Entrada
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {entradas.map((e, ei) => {
                  const strings = e.strings || []
                  const vazia = strings.every((s) => (s.modulos || 0) === 0)
                  return (
                    <div key={ei} className={`rounded-lg border p-2.5 space-y-2 ${vazia ? 'border-dashed border-slate-300 bg-white' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">
                          Entrada {LETRAS[ei] ?? ei + 1}
                          {vazia && <span className="ml-1.5 text-[10px] font-normal text-slate-400">(vazia)</span>}
                        </span>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => addString(mi, ei)}
                            className="text-[11px] text-emerald-700 hover:bg-emerald-50 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                            <Plus size={11} /> String
                          </button>
                          {entradas.length > 1 && (
                            <button type="button" onClick={() => delEntrada(mi, ei)}
                              className="text-slate-300 hover:text-red-400 p-0.5" title="Remover entrada">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      {strings.length === 0 && (
                        <p className="text-[11px] text-slate-400">Sem strings — entrada livre. Clique em “+ String”.</p>
                      )}

                      {strings.map((s, si) => {
                        const voc = eletricoMod ? vocFrio(eletricoMod.voc, eletricoMod.coef_temp_voc, tmin) * (s.modulos || 0) : null
                        const vocOk = voc != null && vMax != null ? voc <= vMax : true
                        return (
                          <div key={si} className="flex items-center gap-2">
                            <span className="text-[11px] text-emerald-600 font-medium w-12 shrink-0">Str {si + 1}</span>
                            <input
                              type="number" min={0} max={40} value={s.modulos ?? 0}
                              onChange={(ev) => setModulos(mi, ei, si, ev.target.value)}
                              className="w-16 text-center border border-slate-300 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-[11px] text-slate-400">mód</span>
                            {voc != null && (s.modulos || 0) > 0 && (
                              <span className={`text-[10px] font-mono ${vocOk ? 'text-slate-400' : 'text-red-600 font-bold'}`}>
                                Voc {voc.toFixed(0)}V {vocOk ? '' : '⛔'}
                              </span>
                            )}
                            <button type="button" onClick={() => delString(mi, ei, si)}
                              className="ml-auto text-slate-300 hover:text-red-400 p-0.5" title="Remover string">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {iMax != null && (
        <p className="text-[11px] text-slate-400">
          Limite do inversor: Vmáx entrada {vMax ?? '—'} V · Imáx por MPPT {iMax} A. Validação completa por string acima.
        </p>
      )}
    </div>
  )
}
