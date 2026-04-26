import { useState, useEffect } from 'react'
import { Search, MapPin, CheckCircle, AlertCircle } from 'lucide-react'
import { useProjetoFV } from '../../../contexts/ProjetoFVContext'
import Input from '../../ui/Input'
import Button from '../../ui/Button'
import { geocodificarEndereco } from '../../../services/geocodingApi'
import { detectarUF, getRegiao } from '../../../data/regioesBrasil'

export default function E3Localizacao() {
  const { state, dispatch, proxima, anterior } = useProjetoFV()
  const loc = state.localizacao

  const [buscando, setBuscando] = useState(false)
  const [erroBusca, setErroBusca] = useState('')
  const [erroForm, setErroForm]   = useState('')

  // Auto-preencher endereço se extraído do PDF
  useEffect(() => {
    if (!loc.endereco && state.localizacao?.endereco) {
      // Já foi preenchido em E1
    }
  }, [])

  function set(campo, valor) {
    dispatch({ type: 'SET_LOCALIZACAO', payload: { [campo]: valor } })
  }

  async function buscarEndereco() {
    if (!loc.endereco.trim()) { setErroBusca('Digite um endereço'); return }
    setBuscando(true)
    setErroBusca('')
    try {
      const res = await geocodificarEndereco(loc.endereco)
      const uf  = detectarUF(res.enderecoFormatado)
      const reg = uf ? getRegiao(uf) : null
      dispatch({
        type: 'SET_LOCALIZACAO',
        payload: {
          lat:          res.lat,
          lon:          res.lon,
          cidadeEstado: res.cidadeEstado,
          endereco:     res.enderecoFormatado,
          uf:           uf,
        },
      })
      // Sugere concessionária e tensão baseada no estado
      if (reg && reg.concessionarias.length > 0) {
        dispatch({ type: 'SET_CONSUMO', payload: { concessionaria: reg.concessionarias[0] } })
      }
    } catch (e) {
      setErroBusca(e.message)
    } finally {
      setBuscando(false)
    }
  }

  function validar() {
    if (!loc.lat || !loc.lon) {
      setErroForm('Pesquise e confirme o endereço antes de continuar.')
      return false
    }
    setErroForm('')
    return true
  }

  const mapaUrl = loc.lat
    ? `https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lon}#map=15/${loc.lat}/${loc.lon}`
    : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Localização do Cliente</h2>
        <p className="text-sm text-slate-500 mt-1">
          Pesquise o endereço para obter as coordenadas geográficas automaticamente.
        </p>
      </div>

      {/* Busca */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Endereço completo</label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ex: Rua das Flores, 100, São Paulo, SP"
            value={loc.endereco}
            onChange={e => { set('endereco', e.target.value); set('lat', null); set('lon', null) }}
            onKeyDown={e => e.key === 'Enter' && buscarEndereco()}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300
                       focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
          <Button
            icone={Search}
            onClick={buscarEndereco}
            carregando={buscando}
            tamanho="md"
          >
            Buscar
          </Button>
        </div>
        {erroBusca && (
          <p className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle size={14} /> {erroBusca}
          </p>
        )}
      </div>

      {/* Resultado */}
      {loc.lat && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <CheckCircle size={18} className="text-emerald-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">{loc.cidadeEstado}</p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{loc.endereco}</p>
              <div className="flex gap-4 mt-2">
                <span className="text-xs bg-white border border-slate-200 px-2 py-1 rounded font-mono">
                  Lat: {loc.lat.toFixed(6)}
                </span>
                <span className="text-xs bg-white border border-slate-200 px-2 py-1 rounded font-mono">
                  Lon: {loc.lon.toFixed(6)}
                </span>
              </div>
            </div>
            <a
              href={mapaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline shrink-0"
            >
              <MapPin size={13} /> Ver mapa
            </a>
          </div>

          {/* Lat/lon manual override */}
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
              Ajustar coordenadas manualmente
            </summary>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Input
                rotulo="Latitude"
                type="number"
                step="0.000001"
                value={loc.lat ?? ''}
                onChange={e => set('lat', parseFloat(e.target.value))}
              />
              <Input
                rotulo="Longitude"
                type="number"
                step="0.000001"
                value={loc.lon ?? ''}
                onChange={e => set('lon', parseFloat(e.target.value))}
              />
            </div>
          </details>
        </div>
      )}

      {erroForm && (
        <p className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle size={14} /> {erroForm}
        </p>
      )}

      <div className="flex justify-between pt-2">
        <Button variante="secundario" onClick={anterior}>← Anterior</Button>
        <Button onClick={() => validar() && proxima()}>Próxima →</Button>
      </div>
    </div>
  )
}
