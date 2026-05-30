import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, AlertTriangle, Database } from 'lucide-react'
import { buscarEquipamentosEngenharia, registrarFallback } from '../../services/catalogoEngenhariaApi'
import { agruparInversores } from '../../utils/catalogoEngenhariaAdapter'
import { FEATURE_FLAGS } from '../../config/featureFlags'

const INVERSORES_DATA = {
  string: {
    Fronius: {
      monofasico: [{ id: 'fr5', modelo: 'Primo 5.0-1', potenciaKW: 5, nMppts: 2, garantia: 10 }],
      trifasico: [{ id: 'fr20', modelo: 'Symo 20.0-3-M', potenciaKW: 20, nMppts: 3, garantia: 10 }],
    },
  },
}

export default function SeletorInversores({ onSelecionar, selecionado }) {
  const [tipo, setTipo] = useState('')
  const [marca, setMarca] = useState('')
  const [rede, setRede] = useState('')
  const [dataset, setDataset] = useState({})
  const [fonte, setFonte] = useState('catalogo')
  const [erroFonte, setErroFonte] = useState(null)

  useEffect(() => {
    let ativo = true
    buscarEquipamentosEngenharia('inversor', false)
      .then((eqs) => {
        if (!ativo) return
        if (Array.isArray(eqs) && eqs.length > 0) {
          setDataset(agruparInversores(eqs))
          setFonte('catalogo')
          setErroFonte(null)
          return
        }

        if (FEATURE_FLAGS.ENABLE_LEGACY_INVERSORES) {
          setDataset(INVERSORES_DATA)
          setFonte('legado_local')
          setErroFonte('Catálogo vazio no Mongo. Legado habilitado.')
          registrarFallback('inversor', 'AUDITORIA_FALLBACK|arquivo=SeletorInversores|funcao=useEffect|origem=INVERSORES_DATA|motivo=catalogo_vazio')
          return
        }

        setDataset({})
        setFonte('catalogo_indisponivel')
        setErroFonte('Catálogo de inversores vazio no Mongo e legado desabilitado.')
      })
      .catch((e) => {
        if (!ativo) return
        if (FEATURE_FLAGS.ENABLE_LEGACY_INVERSORES) {
          setDataset(INVERSORES_DATA)
          setFonte('legado_local')
          setErroFonte(`Falha API (${e.message}). Legado habilitado.`)
          registrarFallback('inversor', `AUDITORIA_FALLBACK|arquivo=SeletorInversores|funcao=useEffect|origem=INVERSORES_DATA|motivo=${e.message}`)
          return
        }

        setDataset({})
        setFonte('catalogo_indisponivel')
        setErroFonte(`Falha ao carregar catálogo: ${e.message}`)
      })

    return () => { ativo = false }
  }, [])

  const marcas = useMemo(() => (tipo ? Object.keys(dataset[tipo] || {}) : []), [tipo, dataset])
  const redes = useMemo(() => (marca ? Object.keys(dataset[tipo]?.[marca] || {}) : []), [tipo, marca, dataset])
  const modelos = useMemo(() => ((marca && rede) ? (dataset[tipo]?.[marca]?.[rede] || []) : []), [tipo, marca, rede, dataset])

  const handleSelect = (inversor) => {
    onSelecionar({
      id: inversor.id,
      tipo,
      marca,
      rede: rede === 'monofasico' ? 1 : 3,
      ...inversor,
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
        <h4 className="font-semibold text-slate-900 mb-3">Passo 1: Tipo de Inversor</h4>
        <div className="flex gap-3">
          {['string', 'micro'].map(t => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="tipo"
                value={t}
                checked={tipo === t}
                onChange={e => {
                  setTipo(e.target.value)
                  setMarca('')
                  setRede('')
                }}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-slate-700 capitalize">{t === 'string' ? 'String' : 'Microinversor'}</span>
            </label>
          ))}
        </div>
      </div>

      {tipo && (
        <div>
          <h4 className="font-semibold text-slate-900 mb-3">Passo 2: Marca</h4>
          <select
            value={marca}
            onChange={e => {
              setMarca(e.target.value)
              setRede('')
            }}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecione uma marca...</option>
            {marcas.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      )}

      {marca && (
        <div>
          <h4 className="font-semibold text-slate-900 mb-3">Passo 3: Rede Elétrica</h4>
          <div className="flex gap-3">
            {redes.map(r => {
              const lista = dataset[tipo]?.[marca]?.[r] || []
              return (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="rede"
                    value={r}
                    checked={rede === r}
                    onChange={e => setRede(e.target.value)}
                    className="w-4 h-4"
                    disabled={lista.length === 0}
                  />
                  <span className={`text-sm font-medium ${lista.length === 0 ? 'text-slate-400' : 'text-slate-700'}`}>
                    {r === 'monofasico' ? 'Monofásico' : 'Trifásico'}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {rede && modelos.length > 0 && (
        <div>
          <h4 className="font-semibold text-slate-900 mb-3">Passo 4: Modelo</h4>
          <div className="grid grid-cols-1 gap-2">
            {modelos.map(inv => (
              <div
                key={inv.id}
                onClick={() => handleSelect(inv)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selecionado?.id === inv.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-slate-900">{inv.modelo}</p>
                    <div className="grid grid-cols-3 gap-4 mt-2 text-xs text-slate-600">
                      <div><p className="text-slate-400">Potência</p><p className="font-medium text-slate-900">{inv.potenciaKW} kW</p></div>
                      <div><p className="text-slate-400">MPPTs</p><p className="font-medium text-slate-900">{inv.nMppts}</p></div>
                      <div><p className="text-slate-400">Garantia</p><p className="font-medium text-slate-900">{inv.garantia} anos</p></div>
                    </div>
                  </div>
                  {selecionado?.id === inv.id && <div className="text-green-600 font-bold">✓</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {rede && modelos.length === 0 && (
        <div className="flex items-start gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p>Nenhum modelo disponível para esta combinação.</p>
        </div>
      )}
    </div>
  )
}
