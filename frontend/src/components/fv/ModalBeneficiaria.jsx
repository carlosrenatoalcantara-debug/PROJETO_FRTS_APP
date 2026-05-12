import { useState } from 'react'
import { X } from 'lucide-react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Card from '../ui/Card'

export default function ModalBeneficiaria({ onAdicionarBeneficiaria, onClose, beneficiarias = [] }) {
  const [contaContrato, setContaContrato] = useState('')
  const [tipoRateio, setTipoRateio] = useState('percentual')
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState('')

  const validar = () => {
    if (!contaContrato.trim()) {
      setErro('Número da conta/contrato é obrigatório')
      return false
    }
    if (!valor || valor < 0) {
      setErro('Valor deve ser maior que 0')
      return false
    }

    if (tipoRateio === 'percentual') {
      if (valor > 100) {
        setErro('Percentual não pode ser maior que 100%')
        return false
      }

      const somaPercentuais = beneficiarias
        .filter(b => b.tipoRateio === 'percentual')
        .reduce((sum, b) => sum + b.valor, 0) + Number(valor)

      if (somaPercentuais > 100) {
        const disponivel = 100 - (somaPercentuais - Number(valor))
        setErro(`Soma de percentuais ultrapassaria 100%. Máximo disponível: ${disponivel}%`)
        return false
      }
    }

    return true
  }

  const handleAdicionar = () => {
    if (!validar()) return

    onAdicionarBeneficiaria({
      contaContrato: contaContrato.trim(),
      tipoRateio,
      valor: Number(valor),
    })

    setContaContrato('')
    setTipoRateio('percentual')
    setValor('')
    setErro('')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="flex items-center justify-between mb-6 px-6 pt-6">
          <h2 className="text-lg font-semibold text-slate-900">Adicionar Beneficiária</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-600" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <Input
            rotulo="Número da Conta/Contrato"
            placeholder="Ex: 123456789"
            value={contaContrato}
            onChange={(e) => setContaContrato(e.target.value)}
          />

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">Tipo de Rateio</label>
            <select
              value={tipoRateio}
              onChange={(e) => setTipoRateio(e.target.value)}
              className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="percentual">Percentual (%)</option>
              <option value="fixed">Valor Fixo (R$)</option>
              <option value="proporcional">Proporcional ao Consumo</option>
            </select>
          </div>

          <Input
            rotulo={tipoRateio === 'percentual' ? 'Percentual' : 'Valor'}
            type="number"
            placeholder={tipoRateio === 'percentual' ? '50' : '100'}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />

          {erro && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {erro}
            </div>
          )}

          {/* Resumo de percentuais se aplicável */}
          {tipoRateio === 'percentual' && beneficiarias.length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-xs text-slate-600">Rateio Atual:</p>
              {beneficiarias.map((b, idx) => (
                <p key={idx} className="text-xs text-slate-700">
                  • {b.contaContrato}: {b.valor}%
                </p>
              ))}
              {valor && (
                <p className="text-xs text-blue-700 font-semibold mt-2">
                  Total com esta: {beneficiarias.reduce((sum, b) => b.tipoRateio === 'percentual' ? sum + b.valor : sum, 0) + Number(valor)}%
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              variante="secundario"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAdicionar}
              className="flex-1"
            >
              Adicionar
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
