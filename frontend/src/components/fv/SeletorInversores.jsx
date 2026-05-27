/**
 * SeletorInversores.jsx — FV-13 + FV-09
 *
 * FV-13: Adicionadas categorias hibrido e off-grid.
 * FV-09: precoUnitario incluído no objeto selecionado → E8 usa como preço inicial.
 */
import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import Button from '../ui/Button'

// Estrutura: tipo → marca → fase → [modelos]
const INVERSORES_DATA = {
  string: {
    Fronius: {
      monofasico: [
        { id: 'fr5',   modelo: 'Primo 5.0-1',    potenciaKW: 5,  nMppts: 2, garantia: 10, precoUnitario: 5500 },
        { id: 'fr8',   modelo: 'Primo 8.2-1',    potenciaKW: 8,  nMppts: 2, garantia: 10, precoUnitario: 7200 },
      ],
      trifasico: [
        { id: 'fr20',  modelo: 'Symo 20.0-3-M',  potenciaKW: 20, nMppts: 3, garantia: 10, precoUnitario: 12000 },
        { id: 'fr25',  modelo: 'Symo 25.0-3-M',  potenciaKW: 25, nMppts: 3, garantia: 10, precoUnitario: 15000 },
      ],
    },
    Sungrow: {
      monofasico: [
        { id: 'sg5',   modelo: 'SG5.0RS',        potenciaKW: 5,  nMppts: 2, garantia: 10, precoUnitario: 3800 },
        { id: 'sg8',   modelo: 'SG8.0RS',        potenciaKW: 8,  nMppts: 2, garantia: 10, precoUnitario: 5200 },
        { id: 'sg10',  modelo: 'SG10RS',         potenciaKW: 10, nMppts: 2, garantia: 10, precoUnitario: 5800 },
      ],
      trifasico: [
        { id: 'sg15t', modelo: 'SG15RT',         potenciaKW: 15, nMppts: 3, garantia: 10, precoUnitario: 8000 },
        { id: 'sg25t', modelo: 'SG25RT',         potenciaKW: 25, nMppts: 3, garantia: 10, precoUnitario: 11000 },
      ],
    },
    Growatt: {
      monofasico: [
        { id: 'gw5s',  modelo: 'MID 5000TL-X',  potenciaKW: 5,  nMppts: 2, garantia: 5,  precoUnitario: 2800 },
      ],
      trifasico: [
        { id: 'gw5t',  modelo: 'MOD 5000TL3-LV',potenciaKW: 5,  nMppts: 2, garantia: 5,  precoUnitario: 3200 },
        { id: 'gw10t', modelo: 'MOD 10000TL3-X', potenciaKW: 10, nMppts: 2, garantia: 5, precoUnitario: 4800 },
      ],
    },
    Deye: {
      monofasico: [
        { id: 'dy8',   modelo: 'SUN-8K-SG01LP1', potenciaKW: 8,  nMppts: 2, garantia: 5, precoUnitario: 4200 },
      ],
      trifasico: [
        { id: 'dy12t', modelo: 'SUN-12K-SG',     potenciaKW: 12, nMppts: 3, garantia: 5, precoUnitario: 6000 },
      ],
    },
    ABB: {
      monofasico: [
        { id: 'abb4',  modelo: 'UNO-DM-4.6-TL-PLUS', potenciaKW: 4.6, nMppts: 1, garantia: 10, precoUnitario: 4500 },
      ],
      trifasico: [],
    },
    WEG: {
      monofasico: [],
      trifasico: [
        { id: 'weg6',  modelo: 'SIW500H TL 6kW', potenciaKW: 6,  nMppts: 2, garantia: 5, precoUnitario: 4800 },
        { id: 'weg12', modelo: 'SIW500H TL 12kW',potenciaKW: 12, nMppts: 3, garantia: 5, precoUnitario: 8500 },
      ],
    },
  },

  // FV-13: Inversores híbridos (com entrada de bateria)
  hibrido: {
    Sungrow: {
      monofasico: [
        { id: 'sh5',   modelo: 'SH5.0RS',        potenciaKW: 5,  nMppts: 2, garantia: 10, precoUnitario: 6800 },
        { id: 'sh8',   modelo: 'SH8.0RS',        potenciaKW: 8,  nMppts: 2, garantia: 10, precoUnitario: 8500 },
        { id: 'sh10',  modelo: 'SH10RS',         potenciaKW: 10, nMppts: 2, garantia: 10, precoUnitario: 9500 },
      ],
      trifasico: [
        { id: 'sh15t', modelo: 'SH15T',          potenciaKW: 15, nMppts: 3, garantia: 10, precoUnitario: 15000 },
      ],
    },
    Growatt: {
      monofasico: [
        { id: 'sph5',  modelo: 'SPH 5000TL BL-UP', potenciaKW: 5,  nMppts: 2, garantia: 5, precoUnitario: 5200 },
        { id: 'sph8',  modelo: 'SPH 8000TL BL-UP', potenciaKW: 8,  nMppts: 2, garantia: 5, precoUnitario: 6800 },
      ],
      trifasico: [],
    },
    Deye: {
      monofasico: [
        { id: 'dh5',   modelo: 'SUN-5K-SG04LP1', potenciaKW: 5,  nMppts: 2, garantia: 5, precoUnitario: 5500 },
        { id: 'dh8',   modelo: 'SUN-8K-SG04LP1', potenciaKW: 8,  nMppts: 2, garantia: 5, precoUnitario: 7200 },
      ],
      trifasico: [
        { id: 'dh12t', modelo: 'SUN-12K-SG04LP3', potenciaKW: 12, nMppts: 3, garantia: 5, precoUnitario: 11000 },
      ],
    },
    Goodwe: {
      monofasico: [
        { id: 'gw5h',  modelo: 'GW5K-ET',        potenciaKW: 5,  nMppts: 2, garantia: 10, precoUnitario: 6500 },
        { id: 'gw10h', modelo: 'GW10K-ET',       potenciaKW: 10, nMppts: 2, garantia: 10, precoUnitario: 9000 },
      ],
      trifasico: [],
    },
    Sofar: {
      monofasico: [
        { id: 'sf6h',  modelo: 'HYD6000-ES',     potenciaKW: 6,  nMppts: 2, garantia: 10, precoUnitario: 6000 },
      ],
      trifasico: [],
    },
  },

  // FV-13: Microinversores
  micro: {
    APsystems: {
      monofasico: [
        { id: 'aps400', modelo: 'EZ1-M 400W',   potenciaKW: 0.4,   nMppts: 1, garantia: 10, precoUnitario: 800  },
        { id: 'aps800', modelo: 'EZ1-M 800W',   potenciaKW: 0.8,   nMppts: 2, garantia: 10, precoUnitario: 1200 },
      ],
      trifasico: [],
    },
    Enphase: {
      monofasico: [
        { id: 'enph',   modelo: 'IQ8M',         potenciaKW: 0.366, nMppts: 1, garantia: 25, precoUnitario: 1400 },
        { id: 'enph8a', modelo: 'IQ8A',         potenciaKW: 0.384, nMppts: 1, garantia: 25, precoUnitario: 1500 },
      ],
      trifasico: [],
    },
  },

  // FV-13: Off-grid
  'off-grid': {
    Victron: {
      monofasico: [
        { id: 'vic24_3', modelo: 'MultiPlus-II 24/3000/70',  potenciaKW: 3,   nMppts: 1, garantia: 5, precoUnitario: 4500 },
        { id: 'vic48_5', modelo: 'MultiPlus-II 48/5000/70',  potenciaKW: 5,   nMppts: 1, garantia: 5, precoUnitario: 7000 },
      ],
      trifasico: [],
    },
    Growatt: {
      monofasico: [
        { id: 'ofg3',  modelo: 'OFF3000-19B',  potenciaKW: 3,   nMppts: 1, garantia: 5, precoUnitario: 3200 },
        { id: 'ofg5',  modelo: 'OFF5000-19B',  potenciaKW: 5,   nMppts: 1, garantia: 5, precoUnitario: 4200 },
      ],
      trifasico: [],
    },
    Deye: {
      monofasico: [
        { id: 'dof5',  modelo: 'SUN-5K-SG01LP1-EU', potenciaKW: 5, nMppts: 2, garantia: 5, precoUnitario: 4800 },
      ],
      trifasico: [],
    },
  },
}

const TIPO_ROTULOS = {
  string:    'String',
  hibrido:   'Híbrido (c/ bateria)',
  micro:     'Microinversor',
  'off-grid':'Off-Grid',
}

export default function SeletorInversores({ onSelecionar, selecionado }) {
  const [tipo,  setTipo]  = useState('')
  const [marca, setMarca] = useState('')
  const [rede,  setRede]  = useState('')

  const marcas  = tipo  ? Object.keys(INVERSORES_DATA[tipo]) : []
  const redes   = marca ? Object.keys(INVERSORES_DATA[tipo][marca]) : []
  const modelos = (marca && rede) ? INVERSORES_DATA[tipo][marca][rede] : []

  function handleSelect(inversor) {
    onSelecionar({
      id:           inversor.id,
      tipo,
      marca,
      fases:        rede === 'trifasico' ? 3 : 1,
      modelo:       inversor.modelo,
      potenciaKW:   inversor.potenciaKW,
      nMppts:       inversor.nMppts,
      garantia:     inversor.garantia,
      precoUnitario: inversor.precoUnitario,  // FV-09
    })
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Passo 1: Tipo */}
      <div>
        <h4 className="font-semibold text-slate-900 mb-2">Tipo de Inversor</h4>
        <div className="flex flex-wrap gap-2">
          {Object.keys(INVERSORES_DATA).map(t => (
            <button
              key={t}
              onClick={() => { setTipo(t); setMarca(''); setRede('') }}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                tipo === t
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {TIPO_ROTULOS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Passo 2: Marca */}
      {tipo && (
        <div>
          <h4 className="font-semibold text-slate-900 mb-2">Marca</h4>
          <div className="flex flex-wrap gap-2">
            {marcas.map(m => (
              <button
                key={m}
                onClick={() => { setMarca(m); setRede('') }}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  marca === m
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Passo 3: Fase */}
      {marca && (
        <div>
          <h4 className="font-semibold text-slate-900 mb-2">Fase da Rede</h4>
          <div className="flex flex-wrap gap-3">
            {redes.map(r => {
              const temModelos = INVERSORES_DATA[tipo][marca][r].length > 0
              return (
                <label key={r} className={`flex items-center gap-2 cursor-pointer ${!temModelos ? 'opacity-40' : ''}`}>
                  <input
                    type="radio"
                    name="rede"
                    value={r}
                    checked={rede === r}
                    onChange={e => setRede(e.target.value)}
                    className="w-4 h-4"
                    disabled={!temModelos}
                  />
                  <span className="text-sm font-medium text-slate-700">
                    {r === 'monofasico' ? 'Monofásico' : 'Trifásico'}
                    {!temModelos && ' (indisponível)'}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* Passo 4: Modelo */}
      {rede && modelos.length > 0 && (
        <div>
          <h4 className="font-semibold text-slate-900 mb-2">Modelo</h4>
          <div className="grid grid-cols-1 gap-2">
            {modelos.map(inv => (
              <div
                key={inv.id}
                onClick={() => handleSelect(inv)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selecionado?.id === inv.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{inv.modelo}</p>
                      <span className="text-xs font-bold text-blue-700 bg-blue-100 border border-blue-200 rounded-full px-2 py-0.5">
                        {inv.potenciaKW} kW
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-2 text-xs text-slate-600">
                      <div><p className="text-slate-400">MPPTs</p><p className="font-medium text-slate-900">{inv.nMppts}</p></div>
                      <div><p className="text-slate-400">Garantia</p><p className="font-medium text-slate-900">{inv.garantia} anos</p></div>
                      <div><p className="text-slate-400">Preço sugerido</p><p className="font-medium text-emerald-700">R$ {inv.precoUnitario.toLocaleString('pt-BR')}</p></div>
                    </div>
                  </div>
                  {selecionado?.id === inv.id && (
                    <div className="text-blue-600 font-bold ml-4 shrink-0">✓</div>
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
          <p>Nenhum modelo disponível para esta combinação. Escolha outra fase ou marca.</p>
        </div>
      )}
    </div>
  )
}
