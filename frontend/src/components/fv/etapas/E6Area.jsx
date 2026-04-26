import { useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, RotateCcw, Map } from 'lucide-react'
import { useProjetoFV } from '../../../contexts/ProjetoFVContext'
import Input from '../../ui/Input'
import Select from '../../ui/Select'
import Button from '../../ui/Button'
import MapaTelhado from '../MapaTelhado'
import { calcularAreaSuficiente } from '../../../utils/calcDimensionamento'

const ORIENTACOES = ['Norte','Sul','Leste','Oeste','Nordeste','Noroeste','Sudeste','Sudoeste','Plano']
  .map(v => ({ valor: v, rotulo: v }))

export default function E6Area() {
  const { state, dispatch, proxima, anterior } = useProjetoFV()
  const { area, dimensionamento: dim } = state
  const [erroForm, setErroForm] = useState('')

  function set(campo, valor) {
    const novaArea = { ...area, [campo]: valor }
    if (campo === 'areaDisponivel' && dim.areaMinima) {
      novaArea.suficiente = calcularAreaSuficiente(valor, dim.areaMinima)
    }
    dispatch({ type: 'SET_AREA', payload: novaArea })
  }

  function validar() {
    if (!area.areaDisponivel || Number(area.areaDisponivel) <= 0) {
      setErroForm('Informe a área disponível em m²')
      return false
    }
    setErroForm('')
    return true
  }

  const suficiente  = area.suficiente
  const faltaArea   = suficiente === false ? (dim.areaMinima - Number(area.areaDisponivel)).toFixed(1) : 0
  const sobra       = suficiente === true  ? (Number(area.areaDisponivel) - dim.areaMinima).toFixed(1) : 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Validação de Área</h2>
        <p className="text-sm text-slate-500 mt-1">
          Informe a área disponível no telhado para verificar se comporta os{' '}
          <strong>{dim.numPaineis} painéis</strong> calculados.
        </p>
      </div>

      {/* Card área necessária */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-4">
        <div className="text-center px-4 border-r border-slate-200">
          <p className="text-xs text-slate-500">Área necessária</p>
          <p className="text-2xl font-bold text-slate-900">{dim.areaMinima} <span className="text-sm font-normal">m²</span></p>
          <p className="text-xs text-slate-400">{dim.numPaineis} painéis × 2 m²</p>
        </div>
        <div className="text-sm text-slate-600 space-y-1">
          <p>• Considera painéis de <strong>{dim.potenciaPainelW} W</strong></p>
          <p>• Área mínima por painel: <strong>2,0 m²</strong></p>
          <p>• Recomendado: adicionar 20% de folga</p>
        </div>
      </div>

      {/* Formulário */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input
          rotulo="Área disponível (m²)"
          type="number"
          min="0"
          step="0.5"
          placeholder={`Mín. ${dim.areaMinima}`}
          value={area.areaDisponivel}
          onChange={e => set('areaDisponivel', e.target.value)}
          erro={erroForm}
        />
        <Select
          rotulo="Orientação do telhado"
          opcoes={ORIENTACOES}
          value={area.orientacao}
          onChange={e => set('orientacao', e.target.value)}
        />
        <div>
          <Input
            rotulo={`Inclinação do telhado (°): ${area.inclinacao}°`}
            type="range"
            min="0"
            max="45"
            step="5"
            value={area.inclinacao}
            onChange={e => set('inclinacao', e.target.value)}
            className="pt-1"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>0° (plano)</span><span>45°</span>
          </div>
        </div>
      </div>

      {/* Google Maps Interativo */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Map size={18} className="text-slate-600" />
          <p className="text-sm font-semibold text-slate-700">Desenhe a área no mapa</p>
        </div>
        <MapaTelhado onAreaCalculada={(areaM2) => set('areaDisponivel', String(areaM2))} />
      </div>

      {/* Resultado da verificação */}
      {area.areaDisponivel && suficiente !== null && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border-2 ${
          suficiente
            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
            : 'bg-red-50 border-red-300 text-red-800'
        }`}>
          {suficiente
            ? <CheckCircle size={22} className="shrink-0 mt-0.5" />
            : <XCircle    size={22} className="shrink-0 mt-0.5" />
          }
          <div>
            <p className="font-semibold">
              {suficiente ? 'Área suficiente!' : 'Área insuficiente'}
            </p>
            <p className="text-sm mt-1">
              {suficiente
                ? `Sobram ${sobra} m² em relação ao mínimo necessário.`
                : `Faltam ${faltaArea} m². Considere reduzir o sistema, usar painéis de maior potência ou dividir em mais de uma área.`
              }
            </p>
          </div>
        </div>
      )}

      {suficiente === false && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <strong>Sugestões:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Use painéis de maior potência (ex: 600 W ou 665 W) e recalcule</li>
              <li>Reduza o sistema para a área disponível</li>
              <li>Verifique outras áreas no imóvel</li>
            </ul>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variante="secundario" onClick={anterior}>← Anterior</Button>
        <Button onClick={() => validar() && proxima()}>Próxima →</Button>
      </div>
    </div>
  )
}
