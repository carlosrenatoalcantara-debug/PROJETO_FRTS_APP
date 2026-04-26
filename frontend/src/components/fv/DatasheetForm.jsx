import { useState } from 'react'
import { ChevronDown, AlertCircle } from 'lucide-react'
import Input from '../ui/Input'
import Select from '../ui/Select'

const GARANTIA_OPTS = [5,10,12,15,20,25,30].map(v => ({ valor: String(v), rotulo: `${v} anos` }))
const TIPO_OPTS = [
  { valor: 'monocristalino', rotulo: 'Monocristalino' },
  { valor: 'policristalino', rotulo: 'Policristalino' },
  { valor: 'bifacial',       rotulo: 'Bifacial' },
  { valor: 'topcon',         rotulo: 'TOPCon' },
  { valor: 'hjt',            rotulo: 'HJT' },
]

const PADRAO = {
  marca: '', modelo: '', tipo: 'monocristalino',
  pmpp: '', voc: '', isc: '', vmpp: '', impp: '',
  tempCoefVoc: '', tempCoefPmpp: '', area: '',
  garantiaProduto: '12', garantiaPerformance: '25', percentualPerformance: '80',
}

export default function DatasheetForm({ valor = PADRAO, onChange, titulo = 'Especificações do Painel' }) {
  const [aberto, setAberto] = useState(false)

  function set(campo, v) { onChange?.({ ...valor, [campo]: v }) }

  const incompleto = !valor.voc || !valor.vmpp || !valor.isc

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-slate-800">{titulo}</span>
          {incompleto && (
            <span className="flex items-center gap-1 text-xs text-amber-600">
              <AlertCircle size={12} />
              Specs elétricas incompletas (engine de string usará catálogo)
            </span>
          )}
        </div>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="p-5 space-y-4 border-t border-slate-100">
          {/* Identificação */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input rotulo="Marca" placeholder="Ex: Canadian Solar" value={valor.marca} onChange={e => set('marca', e.target.value)} />
            <Input rotulo="Modelo" placeholder="Ex: CS6W-550MS" value={valor.modelo} onChange={e => set('modelo', e.target.value)} />
            <Select rotulo="Tecnologia" opcoes={TIPO_OPTS} value={valor.tipo} onChange={e => set('tipo', e.target.value)} />
          </div>

          {/* Specs elétricas STC */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
              Especificações elétricas (STC: 25°C, 1000 W/m²)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Input rotulo="Pmpp (W)" type="number" placeholder="550" value={valor.pmpp} onChange={e => set('pmpp', e.target.value)} />
              <Input rotulo="Voc (V)" type="number" step="0.1" placeholder="49.5" value={valor.voc} onChange={e => set('voc', e.target.value)} />
              <Input rotulo="Isc (A)" type="number" step="0.01" placeholder="13.9" value={valor.isc} onChange={e => set('isc', e.target.value)} />
              <Input rotulo="Vmpp (V)" type="number" step="0.1" placeholder="41.2" value={valor.vmpp} onChange={e => set('vmpp', e.target.value)} />
              <Input rotulo="Impp (A)" type="number" step="0.01" placeholder="13.35" value={valor.impp} onChange={e => set('impp', e.target.value)} />
            </div>
          </div>

          {/* Coeficientes de temperatura */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Coeficientes de temperatura (%/°C)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <Input rotulo="αVoc (%/°C)" type="number" step="0.01" placeholder="-0.28"
                  value={valor.tempCoefVoc} onChange={e => set('tempCoefVoc', e.target.value)} />
                <p className="text-xs text-slate-400 mt-1">Normalmente -0.27 a -0.35</p>
              </div>
              <div>
                <Input rotulo="αPmpp (%/°C)" type="number" step="0.01" placeholder="-0.35"
                  value={valor.tempCoefPmpp} onChange={e => set('tempCoefPmpp', e.target.value)} />
                <p className="text-xs text-slate-400 mt-1">Normalmente -0.34 a -0.45</p>
              </div>
              <Input rotulo="Área (m²)" type="number" step="0.01" placeholder="2.26"
                value={valor.area} onChange={e => set('area', e.target.value)} />
            </div>
          </div>

          {/* Garantias */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Garantias</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select rotulo="Garantia do produto" opcoes={GARANTIA_OPTS}
                value={String(valor.garantiaProduto)} onChange={e => set('garantiaProduto', e.target.value)} />
              <Select rotulo="Garantia de performance" opcoes={GARANTIA_OPTS}
                value={String(valor.garantiaPerformance)} onChange={e => set('garantiaPerformance', e.target.value)} />
              <div>
                <Input rotulo="Performance mínima (%)" type="number" min="70" max="100"
                  placeholder="80" value={valor.percentualPerformance} onChange={e => set('percentualPerformance', e.target.value)} />
                <p className="text-xs text-slate-400 mt-1">Padrão de mercado: 80%</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
            Todos os campos são opcionais. Campos vazios usam fallback do catálogo interno para validação elétrica.
            Os dados do datasheet são incluídos no PDF comercial.
          </p>
        </div>
      )}
    </div>
  )
}
