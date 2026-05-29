/**
 * SeletorPaineis.jsx — Sprint 2
 *
 * Cascade: Marca → Modelo
 * Novos campos: tecnologia (N/P-type), bifacial, eficiência, Voc, Vmpp, Isc
 * Filtros: busca textual, tecnologia, faixa de potência
 */
import { useState, useMemo, useEffect } from 'react'
import { Search, X, Lock, Database, AlertTriangle } from 'lucide-react'
import { buscarEquipamentosEngenharia, registrarFallback } from '../../services/catalogoEngenhariaApi'
import { agruparPaineis } from '../../utils/catalogoEngenhariaAdapter'

// ─── Catálogo completo de módulos ─────────────────────────────────────────────
// Campos: id, modelo, potenciaW, tecnologia, bifacial, eficiencia(%),
//         voc(V), vmpp(V), isc(A), garantiaProduto(a), garantiaPerformance(a),
//         percentualPerformance(%), precoUnitario(R$)

const PAINEIS_DATA = {
  'Canadian Solar': [
    {
      id: 'cs400', modelo: 'CS6L-400MS', potenciaW: 400,
      tecnologia: 'P-type', bifacial: false, eficiencia: 20.3,
      voc: 41.4, vmpp: 34.2, isc: 12.28,
      garantiaProduto: 10, garantiaPerformance: 25, percentualPerformance: 80,
      precoUnitario: 480,
    },
    {
      id: 'cs550', modelo: 'CS6W-550MS', potenciaW: 550,
      tecnologia: 'P-type', bifacial: false, eficiencia: 21.1,
      voc: 49.5, vmpp: 41.2, isc: 13.90,
      garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
      precoUnitario: 620,
    },
    {
      id: 'cs665', modelo: 'CS7N-665MS', potenciaW: 665,
      tecnologia: 'N-type', bifacial: true, eficiencia: 22.4,
      voc: 51.8, vmpp: 43.1, isc: 16.23,
      garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 84.8,
      precoUnitario: 780,
    },
  ],
  'Risen': [
    {
      id: 'rs550', modelo: 'RSM144-7-550M', potenciaW: 550,
      tecnologia: 'P-type', bifacial: false, eficiencia: 21.1,
      voc: 49.8, vmpp: 41.65, isc: 13.85,
      garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
      precoUnitario: 600,
    },
    {
      id: 'rs600', modelo: 'RSM130-8-600BMDG', potenciaW: 600,
      tecnologia: 'P-type', bifacial: true, eficiencia: 22.5,
      voc: 51.2, vmpp: 43.10, isc: 14.71,
      garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
      precoUnitario: 680,
    },
  ],
  'JA Solar': [
    {
      id: 'ja550', modelo: 'JAM72S30-550MR', potenciaW: 550,
      tecnologia: 'P-type', bifacial: false, eficiencia: 21.0,
      voc: 49.2, vmpp: 41.10, isc: 13.87,
      garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
      precoUnitario: 595,
    },
    {
      id: 'ja605', modelo: 'JAM72D42-605/LB', potenciaW: 605,
      tecnologia: 'N-type', bifacial: true, eficiencia: 22.5,
      voc: 43.3, vmpp: 36.20, isc: 17.57,
      garantiaProduto: 12, garantiaPerformance: 30, percentualPerformance: 87.4,
      precoUnitario: 720,
    },
  ],
  'Trina Solar': [
    {
      id: 'tr610', modelo: 'TSM-610DE21', potenciaW: 610,
      tecnologia: 'P-type', bifacial: true, eficiencia: 21.3,
      voc: 53.2, vmpp: 44.20, isc: 14.60,
      garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
      precoUnitario: 720,
    },
    {
      id: 'tr670', modelo: 'TSM-670NEG21C.20', potenciaW: 670,
      tecnologia: 'N-type', bifacial: true, eficiencia: 22.5,
      voc: 45.2, vmpp: 38.20, isc: 18.50,
      garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 87.4,
      precoUnitario: 820,
    },
  ],
  'BYD': [
    {
      id: 'byd415', modelo: 'BYD415H5-54E', potenciaW: 415,
      tecnologia: 'P-type', bifacial: false, eficiencia: 20.5,
      voc: 40.2, vmpp: 33.50, isc: 13.20,
      garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
      precoUnitario: 500,
    },
  ],
  'LONGi': [
    {
      id: 'lon450', modelo: 'LR5-72HPH-450M', potenciaW: 450,
      tecnologia: 'P-type', bifacial: false, eficiencia: 20.7,
      voc: 44.5, vmpp: 37.10, isc: 13.80,
      garantiaProduto: 15, garantiaPerformance: 25, percentualPerformance: 80.7,
      precoUnitario: 540,
    },
    {
      id: 'lon580', modelo: 'LR5-72HIH-580M', potenciaW: 580,
      tecnologia: 'P-type', bifacial: false, eficiencia: 21.3,
      voc: 50.6, vmpp: 42.00, isc: 14.59,
      garantiaProduto: 15, garantiaPerformance: 25, percentualPerformance: 80.7,
      precoUnitario: 650,
    },
  ],
  'Jinko Solar': [
    {
      id: 'jk545', modelo: 'JKM545N-72HL4', potenciaW: 545,
      tecnologia: 'N-type', bifacial: false, eficiencia: 21.3,
      voc: 50.4, vmpp: 42.16, isc: 13.77,
      garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
      precoUnitario: 590,
    },
    {
      id: 'jk620', modelo: 'JKM620N-78HL4', potenciaW: 620,
      tecnologia: 'N-type', bifacial: false, eficiencia: 22.3,
      voc: 53.0, vmpp: 44.20, isc: 14.78,
      garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 84.8,
      precoUnitario: 740,
    },
  ],
}

const FAIXAS_POTENCIA = [
  { label: 'Todas',    min: 0,   max: 9999 },
  { label: '< 500 W', min: 0,   max: 499  },
  { label: '500–599 W', min: 500, max: 599 },
  { label: '600 W+',  min: 600, max: 9999 },
]

// ─── Badges auxiliares ────────────────────────────────────────────────────────
function BadgeTipo({ tecnologia }) {
  const isN = tecnologia === 'N-type'
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
      isN ? 'bg-violet-50 border-violet-300 text-violet-700'
           : 'bg-slate-50 border-slate-300 text-slate-600'
    }`}>
      {tecnologia}
    </span>
  )
}

function BadgeBifacial({ bifacial }) {
  if (!bifacial) return null
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-blue-50 border-blue-300 text-blue-700">
      Bifacial
    </span>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function SeletorPaineis({ onSelecionar, selecionado }) {
  const [marca, setMarca] = useState(selecionado?.marca ?? '')
  const [busca, setBusca] = useState('')
  const [faixaIdx, setFaixaIdx] = useState(0)   // índice em FAIXAS_POTENCIA
  const [filtroTec, setFiltroTec] = useState('') // '' | 'N-type' | 'P-type'

  // S8.1: catálogo Mongo como fonte; PAINEIS_DATA vira contingência
  const [dataset, setDataset] = useState(PAINEIS_DATA)
  const [fonte, setFonte] = useState('local')   // 'catalogo' | 'local'
  const [incluirBloqueados, setIncluirBloqueados] = useState(false)

  useEffect(() => {
    let vivo = true
    buscarEquipamentosEngenharia('modulo', incluirBloqueados)
      .then((eqs) => {
        if (!vivo) return
        if (Array.isArray(eqs) && eqs.length > 0) { setDataset(agruparPaineis(eqs)); setFonte('catalogo') }
        else { setDataset(PAINEIS_DATA); setFonte('local') }  // catálogo vazio → contingência
      })
      .catch((e) => {
        if (!vivo) return
        setDataset(PAINEIS_DATA); setFonte('local')
        registrarFallback('modulo', e.message)
      })
    return () => { vivo = false }
  }, [incluirBloqueados])

  const todosModelos = useMemo(() => Object.entries(dataset).flatMap(([mk, ms]) => ms.map(m => ({ ...m, marca: m.marca ?? mk }))), [dataset])
  const marcas = Object.keys(dataset)
  const faixa  = FAIXAS_POTENCIA[faixaIdx]

  // Modelos filtrados (aplica marca, busca, potência, tecnologia)
  const modelos = useMemo(() => {
    const base = marca ? (dataset[marca] || []) : todosModelos
    return base.filter(p => {
      const okBusca = !busca || p.modelo.toLowerCase().includes(busca.toLowerCase())
      const okPot   = p.potenciaW >= faixa.min && p.potenciaW <= faixa.max
      const okTec   = !filtroTec || p.tecnologia === filtroTec
      return okBusca && okPot && okTec
    })
  }, [marca, busca, faixaIdx, filtroTec, dataset, todosModelos])

  function handleSelect(painel) {
    if (painel.utilizavel_em_projeto === false) {
      alert(`Módulo não liberado para engenharia.\nFalta: ${(painel.bloqueio_engenharia || []).join(', ') || 'dados técnicos'}.\nComplete a ficha técnica no Catálogo.`)
      return
    }
    const m = painel.marca ?? marca
    onSelecionar({
      ...painel,
      marca: m,
      pmpp: painel.potenciaW,   // compat gerarUnifilarSVG
      garantia: painel.garantiaProduto,
    })
  }

  return (
    <div className="space-y-4 pt-2">

      {/* S8.1: indicador de fonte + contingência + bloqueados */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {fonte === 'catalogo' ? (
          <span className="text-xs text-emerald-700 flex items-center gap-1"><Database size={13} /> Fonte: Catálogo Forte Solar ✓</span>
        ) : (
          <span className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle size={13} /> Modo contingência — catálogo online indisponível, usando base local.</span>
        )}
        <label className="text-xs text-slate-500 flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={incluirBloqueados} onChange={e => setIncluirBloqueados(e.target.checked)} className="accent-amber-500" disabled={fonte !== 'catalogo'} />
          Mostrar equipamentos incompletos
        </label>
      </div>

      {/* ── Filtro: Marca ───────────────────────────────────────────────────── */}
      <div>
        <h4 className="font-semibold text-slate-700 text-sm mb-2">Marca</h4>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setMarca('')}
            className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              marca === ''
                ? 'border-amber-500 bg-amber-50 text-amber-700'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            Todas
          </button>
          {marcas.map(m => (
            <button
              key={m}
              onClick={() => setMarca(m)}
              className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                marca === m
                  ? 'border-amber-500 bg-amber-50 text-amber-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filtros: busca + potência + tecnologia ──────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Busca textual */}
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar modelo..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-8 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          {busca && (
            <button onClick={() => setBusca('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filtro potência */}
        <div className="flex gap-1">
          {FAIXAS_POTENCIA.map((f, i) => (
            <button
              key={f.label}
              onClick={() => setFaixaIdx(i)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                faixaIdx === i
                  ? 'border-amber-500 bg-amber-50 text-amber-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Filtro tecnologia */}
        <div className="flex gap-1">
          {['', 'N-type', 'P-type'].map(t => (
            <button
              key={t || 'all'}
              onClick={() => setFiltroTec(t)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                filtroTec === t
                  ? 'border-violet-500 bg-violet-50 text-violet-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {t || 'N+P'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lista de modelos ────────────────────────────────────────────────── */}
      {modelos.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-4">
          Nenhum módulo encontrado com esses filtros.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 max-h-[540px] overflow-y-auto pr-1">
        {modelos.map(painel => {
          const sel = selecionado?.id === painel.id
          const bloqueado = painel.utilizavel_em_projeto === false
          return (
            <div
              key={painel.id}
              onClick={() => handleSelect(painel)}
              className={`p-4 rounded-xl border-2 transition-all ${
                bloqueado
                  ? 'border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed'
                  : sel
                    ? 'border-amber-500 bg-amber-50 shadow-sm cursor-pointer'
                    : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/40 cursor-pointer'
              }`}
            >
              {bloqueado && (
                <div className="flex items-center gap-1 text-xs text-red-600 mb-1">
                  <Lock size={12} /> Não liberado — Falta: {(painel.bloqueio_engenharia || []).join(', ') || 'dados técnicos'}
                </div>
              )}
              {/* Linha 1: Modelo + potência + badges */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-1.5">
                    <span className="text-xs text-slate-500 font-medium">{painel.marca ?? marca}</span>
                    <span className="text-slate-300">·</span>
                    <span className="font-semibold text-slate-900 text-sm">{painel.modelo}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-sm font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">
                      {painel.potenciaW} W
                    </span>
                    <BadgeTipo tecnologia={painel.tecnologia} />
                    <BadgeBifacial bifacial={painel.bifacial} />
                    <span className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                      η {painel.eficiencia}%
                    </span>
                  </div>
                </div>
                {sel && <span className="text-amber-600 font-bold text-lg shrink-0 mt-1">✓</span>}
              </div>

              {/* Linha 2: Parâmetros elétricos */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3 text-xs border-t border-slate-100 pt-3">
                <Param label="Voc" valor={`${painel.voc} V`} />
                <Param label="Vmpp" valor={`${painel.vmpp} V`} />
                <Param label="Isc" valor={`${painel.isc} A`} />
                <Param label="Gar. produto" valor={`${painel.garantiaProduto} anos`} />
                <Param label="Gar. linear" valor={`${painel.garantiaPerformance} anos`} />
                <Param label="Perf. final" valor={`${painel.percentualPerformance}%`} />
              </div>

              {/* Linha 3: Preço */}
              <div className="mt-2 text-right text-xs text-emerald-700 font-medium">
                ≈ R$ {painel.precoUnitario.toLocaleString('pt-BR')}/un
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Param({ label, valor }) {
  return (
    <div>
      <p className="text-slate-400 text-[10px]">{label}</p>
      <p className="font-medium text-slate-800">{valor}</p>
    </div>
  )
}
