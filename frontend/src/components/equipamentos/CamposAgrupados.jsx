import { Info } from 'lucide-react'
import { agruparCampos } from '@fortesolar/fv-shared/ai/campos-equipamento'

const ENTRADA = 'px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full'

/**
 * Campos técnicos por categoria — a MESMA apresentação na edição, no cadastro
 * manual e na importação assistida. `aoMudar(campo, valor)`; vazio chega como ''.
 */
export default function CamposAgrupados({ tipo, campos, aoMudar, marcador = null, classeEntrada = null }) {
  return agruparCampos(tipo, campos).map((g) => (
    <fieldset key={g.id} className="border-t border-slate-200 pt-3">
      {g.titulo && <legend className="pr-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.titulo}</legend>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {g.campos.map((c) => (
          <div key={c.key}>
            <label htmlFor={`campo-${tipo}-${c.key}`} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
              {marcador?.(c)}
              {c.label}{c.obrigatorio && <span className="text-red-500">*</span>}
            </label>
            {c.key === 'tipo_topologia' ? (
              <select id={`campo-${tipo}-${c.key}`} value={c.valor ?? 'STRING'} onChange={(e) => aoMudar(c, e.target.value)}
                className={`${ENTRADA} bg-white`}>
                {['STRING', 'MICRO', 'HYBRID'].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input id={`campo-${tipo}-${c.key}`} type={c.tipo === 'number' ? 'number' : 'text'} step="any" value={c.valor ?? ''}
                onChange={(e) => aoMudar(c, c.tipo === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value)}
                className={classeEntrada?.(c) ?? ENTRADA} />
            )}
            {c.info && (
              <p className="mt-0.5 flex items-start gap-1 text-[11px] text-slate-400">
                <Info size={11} className="mt-0.5 shrink-0" /> <span>{c.info}</span>
              </p>
            )}
          </div>
        ))}
      </div>
    </fieldset>
  ))
}
