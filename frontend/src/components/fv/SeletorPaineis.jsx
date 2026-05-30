import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, AlertTriangle, Database } from 'lucide-react'
import { buscarEquipamentosEngenharia, registrarFallback } from '../../services/catalogoEngenhariaApi'
import { agruparPaineis } from '../../utils/catalogoEngenhariaAdapter'
import { FEATURE_FLAGS } from '../../config/featureFlags'

const PAINEIS_DATA = {
  'Canadian Solar': [
    { id: 'cs400', modelo: 'CS6L-400MS', potenciaW: 400, voc: 41.4, vmpp: 34.2, isc: 12.28, garantiaProduto: 10, garantiaPerformance: 25, percentualPerformance: 80 },
  ],
}

export default function SeletorPaineis({ onSelecionar, selecionado }) {
  const [marca, setMarca] = useState('')
  const [dataset, setDataset] = useState({})
  const [fonte, setFonte] = useState('catalogo')
  const [erroFonte, setErroFonte] = useState(null)

  useEffect(() => {
    let ativo = true
    buscarEquipamentosEngenharia('modulo', false)
      .then((eqs) => {
        if (!ativo) return
        if (Array.isArray(eqs) && eqs.length > 0) {
          setDataset(agruparPaineis(eqs))
          setFonte('catalogo')
          setErroFonte(null)
          return
        }

        if (FEATURE_FLAGS.ENABLE_LEGACY_MODULOS) {
          setDataset(PAINEIS_DATA)
          setFonte('legado_local')
          setErroFonte('Catálogo vazio no Mongo. Legado habilitado.')
          registrarFallback('modulo', 'AUDITORIA_FALLBACK|arquivo=SeletorPaineis|funcao=useEffect|origem=PAINEIS_DATA|motivo=catalogo_vazio')
          return
        }

        setDataset({})
        setFonte('catalogo_indisponivel')
        setErroFonte('Catálogo de módulos vazio no Mongo e legado desabilitado.')
      })
      .catch((e) => {
        if (!ativo) return
        if (FEATURE_FLAGS.ENABLE_LEGACY_MODULOS) {
          setDataset(PAINEIS_DATA)
          setFonte('legado_local')
          setErroFonte(`Falha API (${e.message}). Legado habilitado.`)
          registrarFallback('modulo', `AUDITORIA_FALLBACK|arquivo=SeletorPaineis|funcao=useEffect|origem=PAINEIS_DATA|motivo=${e.message}`)
          return
        }

        setDataset({})
        setFonte('catalogo_indisponivel')
        setErroFonte(`Falha ao carregar catálogo: ${e.message}`)
      })

    return () => { ativo = false }
  }, [])

  const marcas = useMemo(() => Object.keys(dataset), [dataset])
  const modelos = useMemo(() => (marca ? dataset[marca] || [] : []), [dataset, marca])

  const handleSelect = (painel) => {
    onSelecionar({
      ...painel,
      marca,
      pmpp: painel.potenciaW ?? painel.pmpp,
      potenciaW: painel.potenciaW ?? painel.pmpp,
    })
  }

  return (
    <div className="space-y-4">
      {fonte === 'catalogo' && (
        <p className="text-xs text-emerald-700 flex items-center gap-1"><Database size={13} /> Fonte: Equipamento (Mongo)</p>
      )}
      {fonte !== 'catalogo' && erroFonte && (
        <p className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle size={13} /> {erroFonte}</p>
      )}

      <div>
        <h4 className="font-semibold text-slate-900 mb-3">Passo 1: Marca</h4>
        <select
          value={marca}
          onChange={e => setMarca(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecione uma marca...</option>
          {marcas.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {marca && modelos.length > 0 && (
        <div>
          <h4 className="font-semibold text-slate-900 mb-3">Passo 2: Modelo</h4>
          <div className="grid grid-cols-1 gap-3">
            {modelos.map(painel => (
              <div
                key={painel.id}
                onClick={() => handleSelect(painel)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selecionado?.id === painel.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{painel.modelo}</p>
                    <div className="grid grid-cols-4 gap-3 mt-3 text-xs">
                      <div><p className="text-slate-400">Pmpp</p><p className="font-medium text-slate-900">{painel.potenciaW ?? painel.pmpp}W</p></div>
                      <div><p className="text-slate-400">Voc</p><p className="font-medium text-slate-900">{painel.voc}V</p></div>
                      <div><p className="text-slate-400">Vmpp</p><p className="font-medium text-slate-900">{painel.vmpp}V</p></div>
                      <div><p className="text-slate-400">Isc</p><p className="font-medium text-slate-900">{painel.isc}A</p></div>
                    </div>
                  </div>
                  {selecionado?.id === painel.id && <div className="text-green-600 font-bold text-lg ml-4">✓</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {marca && modelos.length === 0 && (
        <div className="flex items-start gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p>Nenhum modelo disponível para esta marca.</p>
        </div>
      )}
    </div>
  )
}
