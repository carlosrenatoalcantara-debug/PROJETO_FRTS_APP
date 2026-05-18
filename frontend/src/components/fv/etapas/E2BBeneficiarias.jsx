import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, AlertCircle, Users } from 'lucide-react'
import { useProjetoFV } from '../../../contexts/ProjetoFVContext'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'
import Input from '../../ui/Input'
import Card, { CardHeader, CardBody } from '../../ui/Card'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway */

function ModalBeneficiaria({ beneficiaria, projetoId, onClose, onSalvo }) {
  const [formData, setFormData] = useState(beneficiaria || {
    contaContrato: '',
    tipoRateio: 'percentual',
    valor: '',
  })
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  function handleChange(e) {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setCarregando(true)
    setErro('')

    if (!formData.contaContrato || !formData.tipoRateio || formData.valor === '') {
      setErro('Preencha todos os campos obrigatórios')
      setCarregando(false)
      return
    }

    const valor = Number(formData.valor)

    if (formData.tipoRateio === 'percentual' && (valor < 0 || valor > 100)) {
      setErro('Percentual deve estar entre 0 e 100')
      setCarregando(false)
      return
    }

    if (formData.tipoRateio === 'prioridade' && valor < 1) {
      setErro('Prioridade deve ser maior que 0')
      setCarregando(false)
      return
    }

    try {
      const url = beneficiaria?._id
        ? `${API_URL}/api/projetos-fv/${projetoId}/beneficiarias/${beneficiaria._id}`
        : `${API_URL}/api/projetos-fv/${projetoId}/beneficiarias`

      const method = beneficiaria?._id ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, valor }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.mensagem || 'Erro ao salvar')
      }

      const data = await res.json()
      onSalvo(data)
      onClose()
    } catch (err) {
      setErro(`Erro: ${err.message}`)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">
            {beneficiaria ? 'Editar' : 'Nova'} Beneficiária
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            ✕
          </button>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              rotulo="Número da Conta/Contrato *"
              type="text"
              value={formData.contaContrato}
              onChange={handleChange}
              name="contaContrato"
              placeholder="Ex: 123456789"
            />

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Tipo de Rateio *</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-2 border border-slate-300 rounded cursor-pointer hover:bg-slate-50"
                  style={{borderColor: formData.tipoRateio === 'percentual' ? '#3b82f6' : 'inherit'}}>
                  <input
                    type="radio"
                    name="tipoRateio"
                    value="percentual"
                    checked={formData.tipoRateio === 'percentual'}
                    onChange={handleChange}
                  />
                  <span className="text-sm font-medium">Percentual</span>
                </label>
                <label className="flex items-center gap-2 p-2 border border-slate-300 rounded cursor-pointer hover:bg-slate-50"
                  style={{borderColor: formData.tipoRateio === 'prioridade' ? '#3b82f6' : 'inherit'}}>
                  <input
                    type="radio"
                    name="tipoRateio"
                    value="prioridade"
                    checked={formData.tipoRateio === 'prioridade'}
                    onChange={handleChange}
                  />
                  <span className="text-sm font-medium">Prioridade</span>
                </label>
              </div>
            </div>

            <Input
              rotulo={formData.tipoRateio === 'percentual' ? 'Percentual (0-100) *' : 'Ordem de Prioridade (1, 2, 3...) *'}
              type="number"
              min={formData.tipoRateio === 'percentual' ? '0' : '1'}
              max={formData.tipoRateio === 'percentual' ? '100' : ''}
              value={formData.valor}
              onChange={handleChange}
              name="valor"
              placeholder={formData.tipoRateio === 'percentual' ? '50' : '1'}
            />

            {erro && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                {erro}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button onClick={onClose} variante="secundario" className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" disabled={carregando} className="flex-1">
                {carregando ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}

export default function E2BBeneficiarias() {
  const { state, dispatch, proxima, anterior } = useProjetoFV()
  const { dadosCliente } = state

  const [beneficiarias, setBeneficiarias] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [beneficiariaSelecionada, setBeneficiariaSelecionada] = useState(null)
  const [projetoId, setProjetoId] = useState(null)

  const somaPercentuais = beneficiarias
    .filter(b => b.tipoRateio === 'percentual')
    .reduce((sum, b) => sum + b.valor, 0)

  function abrirModalNova() {
    setBeneficiariaSelecionada(null)
    setModalAberto(true)
  }

  function abrirModalEditar(b) {
    setBeneficiariaSelecionada(b)
    setModalAberto(true)
  }

  async function deletarBeneficiaria(id) {
    if (!projetoId || !window.confirm('Tem certeza?')) return

    try {
      const res = await fetch(`${API_URL}/api/projetos-fv/${projetoId}/beneficiarias/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setBeneficiarias(prev => prev.filter(b => b._id !== id))
      }
    } catch (err) {
      console.error('Erro ao deletar:', err)
    }
  }

  function handleBeneficiariaSalva(beneficiaria) {
    if (beneficiariaSelecionada?._id) {
      // Atualizar
      setBeneficiarias(prev =>
        prev.map(b => b._id === beneficiaria._id ? beneficiaria : b)
      )
    } else {
      // Adicionar
      setBeneficiarias(prev => [...prev, beneficiaria])
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Users size={24} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Unidades Beneficiárias</h2>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Geração Distribuída: adicione outras unidades consumidoras que receberão a energia gerada.
        </p>
      </div>

      {/* Resumo */}
      {beneficiarias.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-medium text-slate-700">Beneficiárias registradas: {beneficiarias.length}</p>
          {somaPercentuais > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 bg-slate-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(somaPercentuais, 100)}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-slate-900">{somaPercentuais}%</span>
            </div>
          )}
        </div>
      )}

      {/* Tabela de Beneficiárias */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Unidades Beneficiárias</h3>
          <Button icone={Plus} tamanho="sm" onClick={abrirModalNova}>
            Adicionar
          </Button>
        </CardHeader>
        <CardBody>
          {beneficiarias.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p className="text-sm">Nenhuma beneficiária adicionada</p>
              <p className="text-xs mt-1">Clique em "Adicionar" para começar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Conta/Contrato</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Tipo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Valor</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {beneficiarias.map((b) => (
                    <tr key={b._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-900">{b.contaContrato}</td>
                      <td className="px-4 py-3">
                        <Badge cor={b.tipoRateio === 'percentual' ? 'azul' : 'laranja'}>
                          {b.tipoRateio === 'percentual' ? 'Percentual' : 'Prioridade'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {b.tipoRateio === 'percentual' ? `${b.valor}%` : `#${b.valor}`}
                      </td>
                      <td className="px-4 py-3 text-right flex gap-2 justify-end">
                        <button
                          onClick={() => abrirModalEditar(b)}
                          className="p-1 rounded hover:bg-slate-200"
                          title="Editar"
                        >
                          <Edit2 size={16} className="text-slate-600" />
                        </button>
                        <button
                          onClick={() => deletarBeneficiaria(b._id)}
                          className="p-1 rounded hover:bg-red-100"
                          title="Deletar"
                        >
                          <Trash2 size={16} className="text-red-600" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Aviso */}
      <div className="flex items-start gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <AlertCircle size={16} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Geração Distribuída</p>
          <ul className="text-xs mt-1 space-y-1 list-disc list-inside">
            <li><strong>Percentual:</strong> divide a energia gerada proporcionalmente</li>
            <li><strong>Prioridade:</strong> abastece beneficiárias em ordem (1º, 2º, 3º...)</li>
          </ul>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button variante="secundario" onClick={anterior}>← Anterior</Button>
        <Button onClick={proxima}>Próxima →</Button>
      </div>

      {modalAberto && (
        <ModalBeneficiaria
          beneficiaria={beneficiariaSelecionada}
          projetoId={projetoId}
          onClose={() => setModalAberto(false)}
          onSalvo={handleBeneficiariaSalva}
        />
      )}
    </div>
  )
}
