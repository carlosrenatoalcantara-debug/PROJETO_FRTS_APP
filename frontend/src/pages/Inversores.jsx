import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import ModalNovoInversor from '../components/equipamentos/ModalNovoInversor'

export default function Inversores() {
  const [inversores, setInversores] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [ordenar, setOrdenar] = useState('data')
  const [modalAberto, setModalAberto] = useState(false)
  const [inversorEditar, setInversorEditar] = useState(null)

  useEffect(() => {
    carregarInversores()
  }, [busca, ordenar])

  async function carregarInversores() {
    try {
      setCarregando(true)
      const params = new URLSearchParams({
        tipo: 'inversor',
        ativo: 'true',
        ...(busca && { search: busca }),
        ...(ordenar && { ordenar }),
      })
      const res = await fetch(`/api/equipamentos?${params}`)
      const dados = await res.json()
      setInversores(dados.equipamentos || [])
    } catch (err) {
      console.error('Erro ao carregar inversores:', err)
    } finally {
      setCarregando(false)
    }
  }

  async function handleExcluir(id) {
    if (!confirm('Tem certeza que deseja excluir este inversor?')) return
    try {
      await fetch(`/api/equipamentos/${id}`, { method: 'DELETE' })
      carregarInversores()
    } catch (err) {
      console.error('Erro ao excluir:', err)
    }
  }

  function handleNovo() {
    setInversorEditar(null)
    setModalAberto(true)
  }

  function handleEditar(inversor) {
    setInversorEditar(inversor)
    setModalAberto(true)
  }

  function handleSalvar() {
    setModalAberto(false)
    carregarInversores()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Inversores Solares</h1>
          <p className="text-slate-600 mt-1">Gerenciar inversores cadastrados</p>
        </div>
        <Button onClick={handleNovo} className="flex items-center gap-2">
          <Plus size={20} />
          Novo Inversor
        </Button>
      </div>

      <Card>
        <CardHeader>Filtros e Busca</CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Buscar por fabricante ou modelo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={ordenar}
              onChange={(e) => setOrdenar(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="data">Data (Mais Recente)</option>
              <option value="potencia">Potência (Maior)</option>
              <option value="preco">Preço (Menor)</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {carregando ? (
        <Card>
          <CardBody>
            <p className="text-center text-slate-600">Carregando inversores...</p>
          </CardBody>
        </Card>
      ) : inversores.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-center text-slate-600">Nenhum inversor cadastrado</p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader>Inversores Cadastrados ({inversores.length})</CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Fabricante</th>
                    <th className="px-4 py-3 text-left font-semibold">Modelo</th>
                    <th className="px-4 py-3 text-left font-semibold">Potência (kW)</th>
                    <th className="px-4 py-3 text-left font-semibold">Tensão Entrada</th>
                    <th className="px-4 py-3 text-left font-semibold">MPPT</th>
                    <th className="px-4 py-3 text-left font-semibold">Preço (R$)</th>
                    <th className="px-4 py-3 text-left font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {inversores.map((inversor) => (
                    <tr key={inversor._id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">{inversor.fabricante}</td>
                      <td className="px-4 py-3">{inversor.modelo}</td>
                      <td className="px-4 py-3">{inversor.especificacoes?.potencia_kw}</td>
                      <td className="px-4 py-3">{inversor.especificacoes?.tensao_entrada}V</td>
                      <td className="px-4 py-3">{inversor.especificacoes?.mppt}</td>
                      <td className="px-4 py-3 font-semibold">R$ {inversor.preco_sugerido?.toFixed(2)}</td>
                      <td className="px-4 py-3 flex gap-2">
                        <button
                          onClick={() => handleEditar(inversor)}
                          className="p-2 hover:bg-blue-100 rounded text-blue-600"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleExcluir(inversor._id)}
                          className="p-2 hover:bg-red-100 rounded text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {modalAberto && (
        <ModalNovoInversor
          inversor={inversorEditar}
          onClose={() => setModalAberto(false)}
          onSalvar={handleSalvar}
        />
      )}
    </div>
  )
}
