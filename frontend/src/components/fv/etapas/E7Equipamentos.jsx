import { useState } from 'react'
import { Sun, Zap, Layers, AlertCircle } from 'lucide-react'
import { useProjetoFV } from '../../../contexts/ProjetoFVContext'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'
import SeletorPaineis from '../SeletorPaineis'
import SeletorInversores from '../SeletorInversores'
import SeletorEstrutura from '../SeletorEstrutura'

export default function E7Equipamentos() {
  const { state, dispatch, proxima, anterior } = useProjetoFV()
  const { equipamentos, dimensionamento: dim } = state
  const [erro, setErro] = useState('')

  function selecionarPainel(painel) {
    dispatch({ type: 'SET_EQUIPAMENTO', payload: { tipo: 'painel', item: painel } })
    setErro('')
  }

  function selecionarInversor(inversor) {
    dispatch({ type: 'SET_EQUIPAMENTO', payload: { tipo: 'inversor', item: inversor } })
    setErro('')
  }

  function selecionarEstrutura(estrutura) {
    dispatch({ type: 'SET_EQUIPAMENTO', payload: { tipo: 'estrutura', item: estrutura } })
    setErro('')
  }

  function validar() {
    if (!equipamentos.painel || !equipamentos.inversor || !equipamentos.estrutura) {
      setErro('Selecione um painel, um inversor e uma estrutura para continuar.')
      return false
    }
    return true
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Seleção de Equipamentos</h2>
        <p className="text-sm text-slate-500 mt-1">
          Selecione um painel, um inversor e uma estrutura para o sistema de <strong>{dim.potenciaRealKwp} kWp</strong>.
        </p>
      </div>

      {/* Painéis com Filtros */}
      <section className="border border-amber-200 rounded-xl p-5 bg-amber-50">
        <div className="flex items-center gap-2 mb-5">
          <Sun size={18} className="text-amber-600" />
          <h3 className="font-semibold text-slate-900">Módulos Fotovoltaicos</h3>
          <Badge cor="amarelo">{dim.numPaineis} un. necessárias</Badge>
        </div>

        <SeletorPaineis
          onSelecionar={selecionarPainel}
          selecionado={equipamentos.painel}
        />

        {equipamentos.painel && (
          <div className="mt-4 p-3 bg-white border border-amber-200 rounded-lg">
            <p className="text-sm font-medium text-slate-900">
              ✓ Selecionado: <span className="text-amber-700">{equipamentos.painel.marca} {equipamentos.painel.modelo}</span>
            </p>
          </div>
        )}
      </section>

      {/* Inversores com Filtros */}
      <section className="border border-blue-200 rounded-xl p-5 bg-blue-50">
        <div className="flex items-center gap-2 mb-5">
          <Zap size={18} className="text-blue-600" />
          <h3 className="font-semibold text-slate-900">Inversores</h3>
          <Badge cor="azul">{dim.numInversores} un. necessária(s)</Badge>
        </div>

        <SeletorInversores
          onSelecionar={selecionarInversor}
          selecionado={equipamentos.inversor}
        />

        {equipamentos.inversor && (
          <div className="mt-4 p-3 bg-white border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-slate-900">
              ✓ Selecionado: <span className="text-blue-700">{equipamentos.inversor.marca} {equipamentos.inversor.modelo}</span>
            </p>
          </div>
        )}
      </section>

      {/* Estruturas Simplificadas */}
      <section className="border border-slate-300 rounded-xl p-5 bg-slate-50">
        <div className="flex items-center gap-2 mb-5">
          <Layers size={18} className="text-slate-600" />
          <h3 className="font-semibold text-slate-900">Estruturas de Fixação</h3>
        </div>

        <SeletorEstrutura
          onSelecionar={selecionarEstrutura}
          selecionado={equipamentos.estrutura}
        />

        {equipamentos.estrutura && (
          <div className="mt-4 p-3 bg-white border border-slate-300 rounded-lg">
            <p className="text-sm font-medium text-slate-900">
              ✓ Selecionado: <span className="text-slate-700">{equipamentos.estrutura.tipo}</span>
            </p>
          </div>
        )}
      </section>

      {/* Aviso: Preço na Etapa de Orçamento */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <p>
          💡 O preço final dos equipamentos será calculado na etapa de orçamento com base no mercado fornecedor e descontos aplicáveis.
        </p>
      </div>

      {erro && (
        <div className="flex items-center gap-2 text-sm text-red-600 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle size={16} /> {erro}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variante="secundario" onClick={anterior}>← Anterior</Button>
        <Button onClick={() => validar() && proxima()}>Próxima →</Button>
      </div>
    </div>
  )
}
