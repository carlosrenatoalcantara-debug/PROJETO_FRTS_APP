import { useState } from 'react'
import { AlertCircle } from 'lucide-react'

const PAINEIS_DATA = {
  'Canadian Solar': {
    '400W': [
      { id: 'cs400', modelo: 'CS6L-400MS', pmpp: 400, voc: 41.4, vmpp: 34.2, isc: 12.28, garantiaProduto: 10, garantiaPerformance: 25, percentualPerformance: 80 },
    ],
    '550W': [
      { id: 'cs550', modelo: 'CS6W-550MS', pmpp: 550, voc: 49.5, vmpp: 41.2, isc: 13.90, garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80 },
    ],
  },
  'Risen': {
    '550W': [
      { id: 'rs550', modelo: 'RSM144-7-550M', pmpp: 550, voc: 49.8, vmpp: 41.65, isc: 13.85, garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80 },
    ],
  },
  'JA Solar': {
    '550W': [
      { id: 'ja550', modelo: 'JAM72S30-550MR', pmpp: 550, voc: 49.2, vmpp: 41.10, isc: 13.87, garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80 },
    ],
  },
  'Trina Solar': {
    '610W': [
      { id: 'tr610', modelo: 'TSM-610DE21', pmpp: 610, voc: 53.2, vmpp: 44.20, isc: 14.60, garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80 },
    ],
  },
  'BYD': {
    '415W': [
      { id: 'byd415', modelo: 'BYD415H5-54E', pmpp: 415, voc: 40.2, vmpp: 33.50, isc: 13.20, garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80 },
    ],
  },
  'LONGi': {
    '450W': [
      { id: 'lon450', modelo: 'LR5-72HPH-450M', pmpp: 450, voc: 44.5, vmpp: 37.10, isc: 13.80, garantiaProduto: 15, garantiaPerformance: 25, percentualPerformance: 80.7 },
    ],
  },
}

export default function SeletorPaineis({ onSelecionar, selecionado }) {
  const [marca, setMarca] = useState('')
  const [potencia, setPotencia] = useState('')

  const marcas = Object.keys(PAINEIS_DATA)
  const potencias = marca ? Object.keys(PAINEIS_DATA[marca]) : []
  const modelos = (marca && potencia) ? PAINEIS_DATA[marca][potencia] : []

  const handleSelect = (painel) => {
    onSelecionar({
      ...painel,
      marca,
      potenciaW: painel.pmpp,
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold text-slate-900 mb-3">Passo 1: Marca</h4>
        <select
          value={marca}
          onChange={e => {
            setMarca(e.target.value)
            setPotencia('')
          }}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecione uma marca...</option>
          {marcas.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {marca && (
        <div>
          <h4 className="font-semibold text-slate-900 mb-3">Passo 2: Potência</h4>
          <select
            value={potencia}
            onChange={e => setPotencia(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecione uma potência...</option>
            {potencias.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      )}

      {potencia && modelos.length > 0 && (
        <div>
          <h4 className="font-semibold text-slate-900 mb-3">Passo 3: Modelo</h4>
          <div className="grid grid-cols-1 gap-3">
            {modelos.map(painel => (
              <div
                key={painel.id}
                onClick={() => handleSelect(painel)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selecionado?.id === painel.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{painel.modelo}</p>

                    <div className="grid grid-cols-5 gap-3 mt-3 text-xs">
                      <div>
                        <p className="text-slate-400">Pmpp</p>
                        <p className="font-medium text-slate-900">{painel.pmpp}W</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Voc</p>
                        <p className="font-medium text-slate-900">{painel.voc}V</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Vmpp</p>
                        <p className="font-medium text-slate-900">{painel.vmpp}V</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Isc</p>
                        <p className="font-medium text-slate-900">{painel.isc}A</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Efic.</p>
                        <p className="font-medium text-slate-900">~21%</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200 text-xs">
                      <div>
                        <p className="text-slate-400">Garantia do Produto</p>
                        <p className="font-bold text-slate-900">{painel.garantiaProduto} anos</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Garantia de Performance</p>
                        <p className="font-bold text-slate-900">{painel.garantiaPerformance} anos ({painel.percentualPerformance}%)</p>
                      </div>
                    </div>
                  </div>

                  {selecionado?.id === painel.id && (
                    <div className="text-green-600 font-bold text-lg ml-4">✓</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {potencia && modelos.length === 0 && (
        <div className="flex items-start gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p>Nenhum modelo disponível para esta combinação. Escolha outra potência ou marca.</p>
        </div>
      )}
    </div>
  )
}
