import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Upload, Upload as UploadIcon } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import ModalNovoModulo from '../components/equipamentos/ModalNovoModulo'

export default function Modulos() {
  const [modulos, setModulos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [ordenar, setOrdenar] = useState('data')
  const [modalAberto, setModalAberto] = useState(false)
  const [moduloEditar, setModuloEditar] = useState(null)

  useEffect(() => {
    carregarModulos()
  }, [busca, ordenar])

  async function carregarModulos() {
    try {
      setCarregando(true)
      const params = new URLSearchParams({
        tipo: 'modulo',
        ativo: 'true',
        ...(busca && { search: busca }),
        ...(ordenar && { ordenar }),
      })
      const res = await fetch(`/api/equipamentos?${params}`)
      const dados = await res.json()
      setModulos(dados.equipamentos || [])
    } catch (err) {
      console.error('Erro ao carregar módulos:', err)
    } finally {
      setCarregando(false)
    }
  }

  async function handleExcluir(id) {
    if (!confirm('Tem certeza que deseja excluir este módulo?')) return
    try {
      await fetch(`/api/equipamentos/${id}`, { method: 'DELETE' })
      carregarModulos()
    } catch (err) {
      console.error('Erro ao excluir:', err)
    }
  }

  function handleNovo() {
    setModuloEditar(null)
    setModalAberto(true)
  }

  function handleEditar(modulo) {
    setModuloEditar(modulo)
    setModalAberto(true)
  }

  function handleSalvar() {
    setModalAberto(false)
    carregarModulos()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Módulos Fotovoltaicos</h1>
          <p className="text-slate-600 mt-1">Gerenciar placas solares cadastradas</p>
        </div>
        <Button onClick={handleNovo} className="flex items-center gap-2">
          <Plus size={20} />
          Novo Módulo
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
            <p className="text-center text-slate-600">Carregando módulos...</p>
          </CardBody>
        </Card>
      ) : modulos.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-center text-slate-600">Nenhum módulo cadastrado</p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader>Módulos Cadastrados ({modulos.length})</CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Fabricante</th>
                    <th className="px-4 py-3 text-left font-semibold">Modelo</th>
                    <th className="px-4 py-3 text-left font-semibold">Potência (Wp)</th>
                    <th className="px-4 py-3 text-left font-semibold">Voc (V)</th>
                    <th className="px-4 py-3 text-left font-semibold">Vmp (V)</th>
                    <th className="px-4 py-3 text-left font-semibold">Preço (R$)</th>
                    <th className="px-4 py-3 text-left font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {modulos.map((modulo) => (
                    <tr key={modulo._id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">{modulo.fabricante}</td>
                      <td className="px-4 py-3">{modulo.modelo}</td>
                      <td className="px-4 py-3">
                        {modulo.especificacoes?.potencia_wp || modulo.especificacoes?.potencia_kw}
                      </td>
                      <td className="px-4 py-3">{modulo.especificacoes?.voc?.toFixed(2)}</td>
                      <td className="px-4 py-3">{modulo.especificacoes?.vmp?.toFixed(2)}</td>
                      <td className="px-4 py-3 font-semibold">R$ {modulo.preco_sugerido?.toFixed(2)}</td>
                      <td className="px-4 py-3 flex gap-2">
                        <button
                          onClick={() => handleEditar(modulo)}
                          className="p-2 hover:bg-blue-100 rounded text-blue-600"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleExcluir(modulo._id)}
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
        <ModalNovoModulo
          modulo={moduloEditar}
          onClose={() => setModalAberto(false)}
          onSalvar={handleSalvar}
        />
      )}
    </div>
  )
}
