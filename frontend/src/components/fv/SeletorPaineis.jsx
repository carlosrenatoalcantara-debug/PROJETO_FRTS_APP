/**
 * SeletorPaineis.jsx — FV-12
 *
 * Cascade corrigido: Marca → Modelo (potência exibida no card).
 * Adicionado precoUnitario no objeto selecionado para E8 usar como sugestão inicial.
 */
import { useState } from 'react'

// Cada entrada: um modelo específico com suas características técnicas e preço sugerido
const PAINEIS_DATA = {
  'Canadian Solar': [
    { id: 'cs400',  modelo: 'CS6L-400MS',       potenciaW: 400, voc: 41.4, vmpp: 34.2, isc: 12.28, garantiaProduto: 10, garantiaPerformance: 25, percentualPerformance: 80,   precoUnitario: 480  },
    { id: 'cs550',  modelo: 'CS6W-550MS',       potenciaW: 550, voc: 49.5, vmpp: 41.2, isc: 13.90, garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,   precoUnitario: 620  },
    { id: 'cs665',  modelo: 'CS7N-665MS',       potenciaW: 665, voc: 51.8, vmpp: 43.1, isc: 16.23, garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 84.8, precoUnitario: 780  },
  ],
  'Risen': [
    { id: 'rs550',  modelo: 'RSM144-7-550M',    potenciaW: 550, voc: 49.8, vmpp: 41.65, isc: 13.85, garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80, precoUnitario: 600  },
    { id: 'rs600',  modelo: 'RSM130-8-600BMDG', potenciaW: 600, voc: 51.2, vmpp: 43.10, isc: 14.71, garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80, precoUnitario: 680  },
  ],
  'JA Solar': [
    { id: 'ja550',  modelo: 'JAM72S30-550MR',   potenciaW: 550, voc: 49.2, vmpp: 41.10, isc: 13.87, garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80, precoUnitario: 595  },
    { id: 'ja605',  modelo: 'JAM72D42-605/LB',  potenciaW: 605, voc: 43.3, vmpp: 36.20, isc: 17.57, garantiaProduto: 12, garantiaPerformance: 30, percentualPerformance: 87.4, precoUnitario: 720  },
  ],
  'Trina Solar': [
    { id: 'tr610',  modelo: 'TSM-610DE21',      potenciaW: 610, voc: 53.2, vmpp: 44.20, isc: 14.60, garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80, precoUnitario: 720  },
    { id: 'tr670',  modelo: 'TSM-670NEG21C.20', potenciaW: 670, voc: 45.2, vmpp: 38.20, isc: 18.50, garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 87.4, precoUnitario: 820  },
  ],
  'BYD': [
    { id: 'byd415', modelo: 'BYD415H5-54E',     potenciaW: 415, voc: 40.2, vmpp: 33.50, isc: 13.20, garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80, precoUnitario: 500  },
  ],
  'LONGi': [
    { id: 'lon450', modelo: 'LR5-72HPH-450M',   potenciaW: 450, voc: 44.5, vmpp: 37.10, isc: 13.80, garantiaProduto: 15, garantiaPerformance: 25, percentualPerformance: 80.7, precoUnitario: 540 },
    { id: 'lon580', modelo: 'LR5-72HIH-580M',   potenciaW: 580, voc: 50.6, vmpp: 42.00, isc: 14.59, garantiaProduto: 15, garantiaPerformance: 25, percentualPerformance: 80.7, precoUnitario: 650 },
  ],
  'Jinko Solar': [
    { id: 'jk545',  modelo: 'JKM545N-72HL4',    potenciaW: 545, voc: 50.4, vmpp: 42.16, isc: 13.77, garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80, precoUnitario: 590  },
    { id: 'jk620',  modelo: 'JKM620N-78HL4',    potenciaW: 620, voc: 53.0, vmpp: 44.20, isc: 14.78, garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 84.8, precoUnitario: 740  },
  ],
}

export default function SeletorPaineis({ onSelecionar, selecionado }) {
  const [marca, setMarca] = useState('')

  const marcas  = Object.keys(PAINEIS_DATA)
  const modelos = marca ? PAINEIS_DATA[marca] : []

  function handleSelect(painel) {
    onSelecionar({
      ...painel,
      marca,
      potenciaW: painel.potenciaW,    // alias pmpp → potenciaW
      pmpp:      painel.potenciaW,    // compatibilidade com gerarUnifilarSVG
      voc:       painel.voc,
      vmpp:      painel.vmpp,
      isc:       painel.isc,
      garantia:  painel.garantiaProduto,
      precoUnitario: painel.precoUnitario,  // FV-09: E8 usa como sugestão de preço
    })
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Passo 1: Marca */}
      <div>
        <h4 className="font-semibold text-slate-900 mb-2">Selecione a Marca</h4>
        <div className="flex flex-wrap gap-2">
          {marcas.map(m => (
            <button
              key={m}
              onClick={() => setMarca(m)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                marca === m
                  ? 'border-amber-500 bg-amber-50 text-amber-700'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Passo 2: Modelo */}
      {marca && (
        <div>
          <h4 className="font-semibold text-slate-900 mb-2">Selecione o Modelo</h4>
          <div className="grid grid-cols-1 gap-3">
            {modelos.map(painel => (
              <div
                key={painel.id}
                onClick={() => handleSelect(painel)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selecionado?.id === painel.id
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{painel.modelo}</p>
                      <span className="text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">
                        {painel.potenciaW}W
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-3 mt-3 text-xs">
                      <div><p className="text-slate-400">Voc</p><p className="font-medium text-slate-900">{painel.voc}V</p></div>
                      <div><p className="text-slate-400">Vmpp</p><p className="font-medium text-slate-900">{painel.vmpp}V</p></div>
                      <div><p className="text-slate-400">Isc</p><p className="font-medium text-slate-900">{painel.isc}A</p></div>
                      <div><p className="text-slate-400">Gar. prod.</p><p className="font-medium text-slate-900">{painel.garantiaProduto}a</p></div>
                    </div>

                    <div className="flex items-center gap-4 mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                      <span>Performance: {painel.garantiaPerformance}a ({painel.percentualPerformance}%)</span>
                      <span className="ml-auto text-emerald-700 font-medium">
                        ≈ R$ {painel.precoUnitario.toLocaleString('pt-BR')}/un
                      </span>
                    </div>
                  </div>

                  {selecionado?.id === painel.id && (
                    <div className="text-amber-600 font-bold text-lg ml-4 shrink-0">✓</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
