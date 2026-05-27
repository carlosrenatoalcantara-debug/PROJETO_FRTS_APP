/**
 * E2BBeneficiarias.jsx — FV-04 fix
 *
 * PROBLEMA: `projetoId` local era sempre null (estado nunca atualizado).
 *           Chamadas à API iam para /api/projetos-fv/null/beneficiarias → 404.
 *
 * SOLUÇÃO:
 *  - Beneficiárias ficam em state.beneficiarias (ProjetoFVContext).
 *  - Registros locais usam `localId` (sem _id) até o projeto ser salvo.
 *  - Se state.projetoId existir (modo edição via ?id=), operações CRUD
 *    também chamam a API em tempo real.
 *  - salvarTodosSlices() no E8 persiste as locais no DB ao criar o projeto.
 */
import { useState } from 'react'
import { Plus, Edit2, Trash2, AlertCircle, Users } from 'lucide-react'
import { useProjetoFV } from '../../../contexts/ProjetoFVContext'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'
import Input from '../../ui/Input'
import Card, { CardHeader, CardBody } from '../../ui/Card'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway */

// ─── Modal (puro — só valida e devolve os dados) ─────────────────────────────
function ModalBeneficiaria({ beneficiaria, onClose, onSalvo, carregandoExterno }) {
  const [formData, setFormData] = useState(beneficiaria
    ? { contaContrato: beneficiaria.contaContrato, tipoRateio: beneficiaria.tipoRateio, valor: String(beneficiaria.valor) }
    : { contaContrato: '', tipoRateio: 'percentual', valor: '' }
  )
  const [erro, setErro] = useState('')

  function handleChange(e) {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    setErro('')

    if (!formData.contaContrato.trim() || !formData.tipoRateio || formData.valor === '') {
      setErro('Preencha todos os campos obrigatórios')
      return
    }

    const valor = Number(formData.valor)

    if (formData.tipoRateio === 'percentual' && (valor < 0 || valor > 100)) {
      setErro('Percentual deve estar entre 0 e 100')
      return
    }

    if (formData.tipoRateio === 'prioridade' && valor < 1) {
      setErro('Prioridade deve ser maior que 0')
      return
    }

    onSalvo({ contaContrato: formData.contaContrato.trim(), tipoRateio: formData.tipoRateio, valor })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">
            {beneficiaria ? 'Editar' : 'Nova'} Beneficiária
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">✕</button>
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
                {['percentual', 'prioridade'].map(tipo => (
                  <label
                    key={tipo}
                    className="flex items-center gap-2 p-2 border border-slate-300 rounded cursor-pointer hover:bg-slate-50"
                    style={{ borderColor: formData.tipoRateio === tipo ? '#3b82f6' : undefined }}
                  >
                    <input
                      type="radio"
                      name="tipoRateio"
                      value={tipo}
                      checked={formData.tipoRateio === tipo}
                      onChange={handleChange}
                    />
                    <span className="text-sm font-medium capitalize">{tipo}</span>
                  </label>
                ))}
              </div>
            </div>

            <Input
              rotulo={formData.tipoRateio === 'percentual' ? 'Percentual (0–100) *' : 'Ordem de Prioridade (1, 2, 3…) *'}
              type="number"
              min={formData.tipoRateio === 'percentual' ? '0' : '1'}
              max={formData.tipoRateio === 'percentual' ? '100' : ''}
              value={formData.valor}
              onChange={handleChange}
              name="valor"
              placeholder={formData.tipoRateio === 'percentual' ? '50' : '1'}
            />

            {erro && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">{erro}</div>
            )}

            <div className="flex gap-3 pt-2">
              <Button onClick={onClose} variante="secundario" className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={carregandoExterno} className="flex-1">
                {carregandoExterno ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function E2BBeneficiarias() {
  const { state, dispatch, proxima, anterior } = useProjetoFV()
  // projetoId só existe em modo edição (?id=...) — é null em novo projeto
  const { projetoId, beneficiarias = [] } = state

  const [modalAberto, setModalAberto]               = useState(false)
  const [beneficiariaSelecionada, setBeneficiariaSelecionada] = useState(null)
  const [salvandoModal, setSalvandoModal]           = useState(false)
  const [erroGlobal, setErroGlobal]                 = useState('')

  const somaPercentuais = beneficiarias
    .filter(b => b.tipoRateio === 'percentual')
    .reduce((sum, b) => sum + Number(b.valor), 0)

  function abrirModalNova()     { setBeneficiariaSelecionada(null);  setModalAberto(true) }
  function abrirModalEditar(b)  { setBeneficiariaSelecionada(b);     setModalAberto(true) }
  function fecharModal()        { setModalAberto(false);             setBeneficiariaSelecionada(null) }

  /**
   * Salva uma beneficiária:
   *  - Se projeto já existe no DB → chama API (POST/PUT) e atualiza contexto
   *  - Se ainda é novo projeto  → salva só no contexto (localId)
   */
  async function handleSalvo(formData) {
    setSalvandoModal(true)
    setErroGlobal('')

    try {
      const isEdicao = Boolean(beneficiariaSelecionada)
      const temId    = beneficiariaSelecionada?._id  // _id real do MongoDB

      if (projetoId) {
        // ── Modo edição: sincroniza com o DB ──
        const url = temId
          ? `${API_URL}/api/projetos-fv/${projetoId}/beneficiarias/${beneficiariaSelecionada._id}`
          : `${API_URL}/api/projetos-fv/${projetoId}/beneficiarias`

        const res = await fetch(url, {
          method: temId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.mensagem || err.message || `HTTP ${res.status}`)
        }

        const salvo = await res.json()
        // Atualiza lista com o objeto devolvido pelo servidor (_id real)
        const novaLista = isEdicao
          ? beneficiarias.map(b => (b._id === salvo._id || b.localId === beneficiariaSelecionada?.localId) ? salvo : b)
          : [...beneficiarias, salvo]
        dispatch({ type: 'SET_BENEFICIARIAS', payload: novaLista })

      } else {
        // ── Novo projeto: guarda localmente com localId ──
        if (isEdicao) {
          const novaLista = beneficiarias.map(b =>
            b.localId === beneficiariaSelecionada.localId ? { ...b, ...formData } : b
          )
          dispatch({ type: 'SET_BENEFICIARIAS', payload: novaLista })
        } else {
          const nova = { ...formData, localId: `local_${Date.now()}` }
          dispatch({ type: 'SET_BENEFICIARIAS', payload: [...beneficiarias, nova] })
        }
      }

      fecharModal()
    } catch (err) {
      setErroGlobal(`Erro ao salvar: ${err.message}`)
    } finally {
      setSalvandoModal(false)
    }
  }

  async function deletarBeneficiaria(b) {
    if (!window.confirm('Remover esta beneficiária?')) return

    setErroGlobal('')

    try {
      if (projetoId && b._id) {
        const res = await fetch(`${API_URL}/api/projetos-fv/${projetoId}/beneficiarias/${b._id}`, {
          method: 'DELETE',
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      }

      // Remove do contexto pelo _id (DB) ou localId
      const novaLista = beneficiarias.filter(x =>
        b._id ? x._id !== b._id : x.localId !== b.localId
      )
      dispatch({ type: 'SET_BENEFICIARIAS', payload: novaLista })
    } catch (err) {
      setErroGlobal(`Erro ao remover: ${err.message}`)
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
        {!projetoId && (
          <p className="text-xs text-amber-600 mt-1">
            As beneficiárias serão salvas no banco de dados ao finalizar o projeto na etapa de Orçamento.
          </p>
        )}
      </div>

      {/* Resumo */}
      {beneficiarias.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-medium text-slate-700">
            Beneficiárias registradas: {beneficiarias.length}
          </p>
          {somaPercentuais > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 bg-slate-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(somaPercentuais, 100)}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-slate-900">{somaPercentuais}%</span>
              {somaPercentuais > 100 && (
                <span className="text-xs text-red-600 font-medium">excede 100%!</span>
              )}
            </div>
          )}
        </div>
      )}

      {erroGlobal && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          {erroGlobal}
        </div>
      )}

      {/* Tabela */}
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
                    <tr key={b._id || b.localId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-900">{b.contaContrato}</td>
                      <td className="px-4 py-3">
                        <Badge cor={b.tipoRateio === 'percentual' ? 'azul' : 'laranja'}>
                          {b.tipoRateio === 'percentual' ? 'Percentual' : 'Prioridade'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {b.tipoRateio === 'percentual' ? `${b.valor}%` : `#${b.valor}`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => abrirModalEditar(b)}
                            className="p-1 rounded hover:bg-slate-200"
                            title="Editar"
                          >
                            <Edit2 size={16} className="text-slate-600" />
                          </button>
                          <button
                            onClick={() => deletarBeneficiaria(b)}
                            className="p-1 rounded hover:bg-red-100"
                            title="Remover"
                          >
                            <Trash2 size={16} className="text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Aviso informativo */}
      <div className="flex items-start gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <AlertCircle size={16} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Geração Distribuída</p>
          <ul className="text-xs mt-1 space-y-1 list-disc list-inside">
            <li><strong>Percentual:</strong> divide a energia gerada proporcionalmente</li>
            <li><strong>Prioridade:</strong> abastece beneficiárias em ordem (1º, 2º, 3º…)</li>
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
          onClose={fecharModal}
          onSalvo={handleSalvo}
          carregandoExterno={salvandoModal}
        />
      )}
    </div>
  )
}
