import { useState, useEffect } from 'react'
import { TrendingUp, Zap, AlertCircle, Info } from 'lucide-react'
import { useProjetoFV } from '../../../contexts/ProjetoFVContext'
import Button from '../../ui/Button'
import Input from '../../ui/Input'

const FATOR_GERACAO_PADRAO = 131.44 // kWh/kWp ao ano

export default function E3PreDimensionamento() {
  const { state, dispatch, proxima, anterior } = useProjetoFV()
  const { unidadesConsumidoras = [], preDimensionamento = {} } = state

  const [fatorGeracao, setFatorGeracao] = useState(String(preDimensionamento.fatorGeracao || FATOR_GERACAO_PADRAO))
  const [potenciaIdealManual, setPotenciaIdealManual] = useState(String(preDimensionamento.potenciaIdealManual || ''))
  const [usarManual, setUsarManual] = useState(!!preDimensionamento.potenciaIdealManual)
  const [erro, setErro] = useState('')

  // Calcular consumo total anual
  const consumoMensalTotal = unidadesConsumidoras.reduce(
    (sum, uc) => sum + (Number(uc.consumoMensal) || 0),
    0
  )
  const consumoAnualTotal = consumoMensalTotal * 12

  // Calcular potência ideal (consumo anual / fator de geração)
  const potenciaIdealCalculada = consumoAnualTotal / (Number(fatorGeracao) || FATOR_GERACAO_PADRAO)

  // Usar potência manual se ativada, senão usar calculada
  const potenciaIdealFinal = usarManual ? (Number(potenciaIdealManual) || 0) : potenciaIdealCalculada

  function salvar() {
    if (fatorGeracao <= 0) {
      setErro('Fator de geração deve ser maior que zero.')
      return
    }

    if (usarManual && (!potenciaIdealManual || Number(potenciaIdealManual) <= 0)) {
      setErro('Se usando manual, a potência ideal deve ser maior que zero.')
      return
    }

    dispatch({
      type: 'SET_PRE_DIMENSIONAMENTO',
      payload: {
        consumoMensalTotal,
        consumoAnualTotal,
        fatorGeracao: Number(fatorGeracao),
        potenciaIdealCalculada: usarManual ? null : potenciaIdealCalculada,
        potenciaIdealManual: usarManual ? Number(potenciaIdealManual) : null,
        potenciaIdealFinal,
      },
    })

    setErro('')
    proxima()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Pré-Dimensionamento</h2>
        <p className="text-sm text-slate-500 mt-1">
          Análise do consumo total e cálculo automático da potência ideal do sistema.
        </p>
      </div>

      {/* Consumo Total */}
      <div className="border border-blue-200 rounded-xl p-5 bg-blue-50">
        <h3 className="font-semibold text-slate-900 mb-4">Consumo Total Analisado</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg border border-blue-200">
            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Consumo Mensal</p>
            <p className="text-2xl font-bold text-slate-900">
              {consumoMensalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              <span className="text-sm font-normal text-slate-500 ml-1">kWh</span>
            </p>
            <p className="text-xs text-slate-600 mt-2">
              {unidadesConsumidoras.length} unidade{unidadesConsumidoras.length > 1 ? 's' : ''} consumidora{unidadesConsumidoras.length > 1 ? 's' : ''}
            </p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-blue-200">
            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Consumo Anual</p>
            <p className="text-2xl font-bold text-slate-900">
              {consumoAnualTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              <span className="text-sm font-normal text-slate-500 ml-1">kWh</span>
            </p>
            <p className="text-xs text-slate-600 mt-2">Consumo mensal × 12</p>
          </div>
        </div>
      </div>

      {/* Fator de Geração */}
      <div className="border border-amber-200 rounded-xl p-5 bg-amber-50">
        <div className="flex items-start gap-3 mb-4">
          <Zap className="text-amber-600 shrink-0 mt-0.5" size={18} />
          <div>
            <h3 className="font-semibold text-slate-900">Fator de Geração</h3>
            <p className="text-xs text-slate-600 mt-1">
              Irradiância solar média anual, ajustado para perdas por temperatura, sombra e conversão.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                rotulo="Fator de Geração (kWh/kWp/ano)"
                type="number"
                min="50"
                max="250"
                step="0.01"
                value={fatorGeracao}
                onChange={e => {
                  setFatorGeracao(e.target.value)
                  setErro('')
                }}
              />
            </div>
            <button
              onClick={() => setFatorGeracao(String(FATOR_GERACAO_PADRAO))}
              className="px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-white border border-blue-200 rounded-lg transition-colors mb-1"
            >
              Padrão
            </button>
          </div>

          <div className="p-3 bg-white border border-amber-200 rounded-lg text-xs text-slate-700">
            <p>
              <strong>Padrão brasileiro:</strong> {FATOR_GERACAO_PADRAO} kWh/kWp/ano
            </p>
            <p className="mt-1 text-slate-600">
              Varia entre ~110 kWh/kWp (regiões com baixa irradiância) e ~150 kWh/kWp (nordeste brasileiro)
            </p>
          </div>
        </div>
      </div>

      {/* Potência Ideal */}
      <div className="border border-green-200 rounded-xl p-5 bg-green-50">
        <div className="flex items-start gap-3 mb-4">
          <TrendingUp className="text-green-600 shrink-0 mt-0.5" size={18} />
          <div>
            <h3 className="font-semibold text-slate-900">Potência Ideal Calculada</h3>
            <p className="text-xs text-slate-600 mt-1">
              Potência mínima necessária para atender ao consumo anual.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Cálculo Automático */}
          <div className="bg-white p-4 rounded-lg border border-green-200">
            <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Cálculo Automático</p>
            <div className="space-y-2">
              <p className="text-sm text-slate-700">
                <span className="text-slate-500">Consumo anual:</span>
                <span className="font-bold ml-1">{consumoAnualTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} kWh</span>
              </p>
              <p className="text-sm text-slate-700">
                <span className="text-slate-500">÷ Fator de geração:</span>
                <span className="font-bold ml-1">{Number(fatorGeracao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kWh/kWp</span>
              </p>
              <div className="flex items-center gap-2 p-3 bg-green-100 rounded border border-green-300">
                <p className="text-sm">
                  <span className="text-slate-600">= </span>
                  <span className="text-xl font-bold text-green-900">
                    {potenciaIdealCalculada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kWp
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Toggle Edição Manual */}
          <label className="flex items-center gap-2 cursor-pointer p-3 bg-white border border-green-200 rounded-lg hover:bg-green-50 transition-colors">
            <input
              type="checkbox"
              checked={usarManual}
              onChange={e => {
                setUsarManual(e.target.checked)
                if (!e.target.checked) {
                  setPotenciaIdealManual('')
                }
                setErro('')
              }}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-slate-700">Usar valor manual (editar)</span>
          </label>

          {/* Campo Manual */}
          {usarManual && (
            <Input
              rotulo="Potência Ideal Manual (kWp)"
              type="number"
              min="0"
              step="0.1"
              value={potenciaIdealManual}
              onChange={e => {
                setPotenciaIdealManual(e.target.value)
                setErro('')
              }}
              placeholder="Ex: 5.5"
            />
          )}

          {/* Resumo Final */}
          <div className="p-4 bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg border border-green-300">
            <p className="text-xs text-slate-600 uppercase font-semibold mb-2">Potência Ideal Final</p>
            <p className="text-3xl font-bold text-green-900">
              {potenciaIdealFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kWp
            </p>
            <p className="text-xs text-slate-600 mt-2">
              {usarManual ? '📝 Valor manual definido' : '✓ Calculado automaticamente'}
            </p>
          </div>
        </div>
      </div>

      {/* Informação Adicional */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
        <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800">
          <strong>Próximo passo:</strong> Você poderá refinar a potência durante o dimensionamento técnico, considerando disponibilidade de espaço, modelos de equipamentos e restrições elétricas da instalação.
        </p>
      </div>

      {erro && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {erro}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variante="secundario" onClick={anterior}>← Anterior</Button>
        <Button onClick={salvar}>Próxima →</Button>
      </div>
    </div>
  )
}
