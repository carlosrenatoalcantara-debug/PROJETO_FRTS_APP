import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import Button from '../ui/Button'

const INVERSORES_DATA = {
  'string': {
    'Fronius': {
      'monofasico': [
        { id: 'fr5', modelo: 'Primo 5.0-1', potenciaKW: 5, nMppts: 2, garantia: 10 },
      ],
      'trifasico': [
        { id: 'fr20', modelo: 'Symo 20.0-3-M', potenciaKW: 20, nMppts: 3, garantia: 10 },
      ],
    },
    'Sungrow': {
      'monofasico': [
        { id: 'sg5', modelo: 'SG5.0RS', potenciaKW: 5, nMppts: 2, garantia: 10 },
        { id: 'sg10', modelo: 'SG10RS', potenciaKW: 10, nMppts: 2, garantia: 10 },
      ],
      'trifasico': [
        { id: 'sg15', modelo: 'SG15RT', potenciaKW: 15, nMppts: 3, garantia: 10 },
      ],
    },
    'Growatt': {
      'monofasico': [],
      'trifasico': [
        { id: 'gw5', modelo: 'MOD 5000TL3-LV', potenciaKW: 5, nMppts: 2, garantia: 5 },
      ],
    },
    'Deye': {
      'monofasico': [
        { id: 'dy8', modelo: 'SUN-8K-SG01LP1', potenciaKW: 8, nMppts: 2, garantia: 5 },
      ],
      'trifasico': [],
    },
  },
  'micro': {
    'APsystems': {
      'monofasico': [
        { id: 'aps400', modelo: 'EZ1-M 400W', potenciaKW: 0.4, nMppts: 1, garantia: 10 },
      ],
      'trifasico': [],
    },
    'Enphase': {
      'monofasico': [
        { id: 'enph', modelo: 'IQ8M', potenciaKW: 0.366, nMppts: 1, garantia: 25 },
      ],
      'trifasico': [],
    },
  },
}

export default function SeletorInversores({ onSelecionar, selecionado }) {
  const [tipo, setTipo] = useState('')
  const [marca, setMarca] = useState('')
  const [rede, setRede] = useState('')

  const marcas = tipo ? Object.keys(INVERSORES_DATA[tipo]) : []
  const redes = marca ? Object.keys(INVERSORES_DATA[tipo][marca]) : []
  const modelos = (marca && rede) ? INVERSORES_DATA[tipo][marca][rede] : []

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
            {redes.map(r => (
              <label key={r} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="rede"
                  value={r}
                  checked={rede === r}
                  onChange={e => setRede(e.target.value)}
                  className="w-4 h-4"
                  disabled={INVERSORES_DATA[tipo][marca][r].length === 0}
                />
                <span className={`text-sm font-medium ${INVERSORES_DATA[tipo][marca][r].length === 0 ? 'text-slate-400' : 'text-slate-700'}`}>
                  {r === 'monofasico' ? 'Monofásico' : 'Trifásico'}
                </span>
              </label>
            ))}
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
                  selecionado?.id === inv.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-slate-900">{inv.modelo}</p>
                    <div className="grid grid-cols-3 gap-4 mt-2 text-xs text-slate-600">
                      <div>
                        <p className="text-slate-400">Potência</p>
                        <p className="font-medium text-slate-900">{inv.potenciaKW} kW</p>
                      </div>
                      <div>
                        <p className="text-slate-400">MPPTs</p>
                        <p className="font-medium text-slate-900">{inv.nMppts}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Garantia</p>
                        <p className="font-medium text-slate-900">{inv.garantia} anos</p>
                      </div>
                    </div>
                  </div>
                  {selecionado?.id === inv.id && (
                    <div className="text-green-600 font-bold">✓</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {rede && modelos.length === 0 && (
        <div className="flex items-start gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p>Nenhum modelo disponível para esta combinação. Escolha outra rede ou marca.</p>
        </div>
      )}
    </div>
  )
}
