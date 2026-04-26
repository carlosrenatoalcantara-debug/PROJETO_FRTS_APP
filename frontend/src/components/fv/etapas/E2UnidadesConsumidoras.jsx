import { useState } from 'react'
import { Plus, Trash2, AlertCircle } from 'lucide-react'
import { useProjetoFV } from '../../../contexts/ProjetoFVContext'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import Select from '../../ui/Select'

const SUBGRUPOS = [
  { valor: 'B1', rotulo: 'B1 - Convencional - Residencial' },
  { valor: 'B2', rotulo: 'B2 - Rural' },
  { valor: 'B3', rotulo: 'B3 - Industrial' },
  { valor: 'B4', rotulo: 'B4 - Serviços e Outras Atividades' },
  { valor: 'A1', rotulo: 'A1 - Trifásico 138kV' },
  { valor: 'A2', rotulo: 'A2 - Trifásico 69kV' },
  { valor: 'A3', rotulo: 'A3 - Trifásico 30kV a 44kV' },
  { valor: 'A3a', rotulo: 'A3a - Trifásico 30kV' },
  { valor: 'A3b', rotulo: 'A3b - Trifásico 44kV' },
  { valor: 'A4', rotulo: 'A4 - Trifásico 2,3kV a 25kV' },
  { valor: 'AS', rotulo: 'AS - Trifásico ≤ 1kV (Alta Tensão)' },
  { valor: 'B5', rotulo: 'B5 - Iluminação Pública' },
]

const FASES_TENSOES = [
  { valor: 'mono127', rotulo: 'Monofásico 127V' },
  { valor: 'mono220', rotulo: 'Monofásico 220V' },
  { valor: 'bi220', rotulo: 'Bifásico 220V' },
  { valor: 'tri220380', rotulo: 'Trifásico 220/380V' },
]

function UCForm({ uc, onChange, onRemove, index }) {
  const handleChange = (campo, valor) => {
    onChange(index, { ...uc, [campo]: valor })
  }

  return (
    <div className="border border-slate-300 rounded-lg p-4 space-y-4 bg-slate-50">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-slate-900">Unidade Consumidora {index + 1}</h4>
        {index > 0 && (
          <button
            onClick={() => onRemove(index)}
            className="text-red-500 hover:text-red-700 transition-colors"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Regra GD */}
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-2">Regra GD</label>
          <div className="flex gap-4">
            {['GD II', 'GD III'].map(regra => (
              <label key={regra} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`regra-${index}`}
                  value={regra}
                  checked={uc.regra === regra}
                  onChange={e => handleChange('regra', e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">{regra}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Grupo Tarifário */}
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-2">Grupo Tarifário</label>
          <div className="flex gap-4">
            {['A', 'B'].map(grupo => (
              <label key={grupo} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`grupo-${index}`}
                  value={grupo}
                  checked={uc.grupo === grupo}
                  onChange={e => handleChange('grupo', e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">Grupo {grupo}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Subgrupo */}
        <Select
          rotulo="Subgrupo"
          opcoes={SUBGRUPOS}
          value={uc.subgrupo}
          onChange={e => handleChange('subgrupo', e.target.value)}
        />

        {/* Consumo */}
        <Input
          rotulo="Consumo Mensal (kWh)"
          type="number"
          min="0"
          step="0.01"
          value={uc.consumoMensal}
          onChange={e => handleChange('consumoMensal', e.target.value)}
        />

        {/* Fase e Tensão */}
        <Select
          rotulo="Fase e Tensão da Rede"
          opcoes={FASES_TENSOES}
          value={uc.faseTensao}
          onChange={e => handleChange('faseTensao', e.target.value)}
        />

        {/* Tarifa */}
        <Input
          rotulo="Tarifa (R$/kWh)"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.95"
          value={uc.tarifa}
          onChange={e => handleChange('tarifa', e.target.value)}
        />

        {/* FioB */}
        <Input
          rotulo="Fio B (R$/kWh)"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.15"
          value={uc.fioB}
          onChange={e => handleChange('fioB', e.target.value)}
        />
      </div>

      {/* Consumo Total */}
      {uc.consumoMensal && (
        <div className="p-3 bg-white border border-slate-200 rounded-lg">
          <p className="text-sm text-slate-600">
            <strong>Consumo mensal:</strong> {Number(uc.consumoMensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kWh
          </p>
        </div>
      )}
    </div>
  )
}

export default function E2UnidadesConsumidoras() {
  const { state, dispatch, proxima, anterior } = useProjetoFV()
  const { unidadesConsumidoras = [] } = state
  const [erro, setErro] = useState('')

  const unidades = unidadesConsumidoras.length > 0 ? unidadesConsumidoras : [
    {
      regra: 'GD II',
      grupo: 'B',
      subgrupo: 'B1',
      consumoMensal: '',
      faseTensao: 'mono220',
      tarifa: '0.95',
      fioB: '0.15',
    }
  ]

  function atualizarUC(index, uc) {
    const novas = [...unidades]
    novas[index] = uc
    dispatch({ type: 'SET_UNIDADES_CONSUMIDORAS', payload: novas })
    setErro('')
  }

  function adicionarUC() {
    const nova = {
      regra: 'GD II',
      grupo: 'B',
      subgrupo: 'B1',
      consumoMensal: '',
      faseTensao: 'mono220',
      tarifa: unidades[0]?.tarifa || '0.95',
      fioB: unidades[0]?.fioB || '0.15',
    }
    dispatch({ type: 'SET_UNIDADES_CONSUMIDORAS', payload: [...unidades, nova] })
  }

  function removerUC(index) {
    if (unidades.length === 1) {
      setErro('Deve haver pelo menos uma unidade consumidora.')
      return
    }
    const novas = unidades.filter((_, i) => i !== index)
    dispatch({ type: 'SET_UNIDADES_CONSUMIDORAS', payload: novas })
  }

  function validar() {
    for (const uc of unidades) {
      if (!uc.consumoMensal || Number(uc.consumoMensal) <= 0) {
        setErro('Todos os campos de consumo mensal são obrigatórios e devem ser maiores que zero.')
        return false
      }
      if (!uc.tarifa || Number(uc.tarifa) <= 0) {
        setErro('Todos os campos de tarifa são obrigatórios e devem ser maiores que zero.')
        return false
      }
    }
    return true
  }

  const consumoTotal = unidades.reduce((sum, uc) => sum + (Number(uc.consumoMensal) || 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Unidades Consumidoras</h2>
        <p className="text-sm text-slate-500 mt-1">
          Configure as unidades consumidoras do cliente. Você pode adicionar múltiplas UCs para locais diferentes.
        </p>
      </div>

      {/* Lista de UCs */}
      <div className="space-y-4">
        {unidades.map((uc, i) => (
          <UCForm
            key={i}
            uc={uc}
            index={i}
            onChange={atualizarUC}
            onRemove={removerUC}
          />
        ))}
      </div>

      {/* Botão Adicionar */}
      <button
        onClick={adicionarUC}
        className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-blue-400 text-blue-600 hover:border-blue-500 hover:text-blue-700 rounded-lg transition-colors font-medium text-sm"
      >
        <Plus size={18} /> Adicionar Outra Unidade Consumidora
      </button>

      {/* Resumo */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Total de UCs:</strong> {unidades.length} unidade{unidades.length > 1 ? 's' : ''}
        </p>
        <p className="text-sm text-blue-900 mt-1">
          <strong>Consumo Total Mensal:</strong> {consumoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kWh
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
        <Button onClick={() => validar() && proxima()}>Próxima →</Button>
      </div>
    </div>
  )
}
