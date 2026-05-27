import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit2, Plus, ChevronDown, ChevronUp, Upload, Zap, Zap as EV, Trash2, X } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Input from '../components/ui/Input'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway. Não usar VITE_API_URL */

export default function ClienteGerenciamento() {
  const { clienteId } = useParams()
  const navigate = useNavigate()
  const [cliente, setCliente] = useState(null)
  const [projetosFV, setProjetosFV] = useState([])
  const [projetosEV, setProjetosEV] = useState([])
  const [contas, setContas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [uploadandoConta, setUploadandoConta] = useState(false)
  const [dragAtivo, setDragAtivo] = useState(false)
  const [modalAberta, setModalAberta] = useState(false)
  const [clienteEditando, setClienteEditando] = useState(null)
  const [expandidos, setExpandidos] = useState({
    dados: true,
    contas: true,
    projetosFV: true,
    projetosEV: true,
  })

  useEffect(() => {
    async function carregar() {
      try {
        const [resCliente, resProjetosFV, resProjetosEV] = await Promise.all([
          fetch(`${API_URL}/api/clientes/${clienteId}`),
          fetch(`${API_URL}/api/projetos-fv/cliente/${clienteId}`),
          fetch(`${API_URL}/api/projetos-ev/cliente/${clienteId}`),
        ])

        const dataCliente = await resCliente.json()
        const dataProjetosFV = await resProjetosFV.json()
        const dataProjetosEV = await resProjetosEV.json()

        setCliente(dataCliente)
        setProjetosFV(Array.isArray(dataProjetosFV) ? dataProjetosFV : [])
        setProjetosEV(Array.isArray(dataProjetosEV) ? dataProjetosEV : [])
        setContas([])
      } catch (err) {
        console.error('Erro ao carregar:', err)
      } finally {
        setCarregando(false)
      }
    }

    carregar()
  }, [clienteId])

  function toggleExpandido(secao) {
    setExpandidos(prev => ({ ...prev, [secao]: !prev[secao] }))
  }

  async function enviarConta(arquivo) {
    if (!arquivo) return

    setUploadandoConta(true)
    setTimeout(() => {
      setContas([...contas, {
        _id: Date.now().toString(),
        nome: arquivo.name,
        createdAt: new Date(),
      }])
      setUploadandoConta(false)
    }, 300)
  }

  function handleDragOver(e) {
    e.preventDefault()
    setDragAtivo(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    setDragAtivo(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragAtivo(false)
    const arquivo = e.dataTransfer.files[0]
    if (arquivo && arquivo.type === 'application/pdf') {
      enviarConta(arquivo)
    }
  }

  function handleFileInput(e) {
    const arquivo = e.target.files?.[0]
    if (arquivo) {
      enviarConta(arquivo)
    }
  }

  function abrirModalEdicao() {
    setClienteEditando({ ...cliente })
    setModalAberta(true)
  }

  function fecharModal() {
    setModalAberta(false)
    setClienteEditando(null)
  }

  function atualizarClienteEditando(campo, valor) {
    setClienteEditando(prev => ({ ...prev, [campo]: valor }))
  }

  async function salvarClienteEditado() {
    if (!clienteEditando.nome?.trim()) {
      alert('Nome é obrigatório')
      return
    }

    try {
      const res = await fetch(`${API_URL}/api/clientes/${clienteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clienteEditando),
      })

      if (res.ok) {
        setCliente(clienteEditando)
        fecharModal()
        alert('Cliente atualizado com sucesso!')
      } else {
        alert('Erro ao atualizar cliente')
      }
    } catch (err) {
      console.error('Erro ao salvar cliente:', err)
      alert('Erro ao atualizar cliente')
    }
  }

  function deletarConta(contaId) {
    if (window.confirm('Tem certeza que deseja deletar este arquivo?')) {
      setContas(contas.filter(c => c._id !== contaId))
    }
  }

  if (carregando) return <div className="p-4 text-center text-slate-500">Carregando...</div>
  if (!cliente) return <div className="p-4 text-center text-red-600">Cliente não encontrado</div>

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/clientes')}
          className="p-2 rounded-lg hover:bg-slate-100"
        >
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{cliente.nome}</h1>
          <p className="text-sm text-slate-500">{cliente.email}</p>
        </div>
      </div>

      {/* SEÇÃO: DADOS DO CLIENTE */}
      <Card>
        <CardHeader
          className="cursor-pointer flex items-center justify-between hover:bg-slate-50"
          onClick={() => toggleExpandido('dados')}
        >
          <h2 className="font-semibold text-slate-900">Dados do cliente</h2>
          {expandidos.dados ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </CardHeader>
        {expandidos.dados && (
          <CardBody className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">CPF/CNPJ</p>
                <p className="font-medium text-slate-900">{cliente.cpf_cnpj || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Telefone</p>
                <p className="font-medium text-slate-900">{cliente.telefone || '—'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-500">Endereço</p>
                <p className="font-medium text-slate-900">{cliente.endereco_completo || cliente.cidade || '—'}</p>
              </div>
            </div>
            <Button variante="secundario" tamanho="sm" icone={Edit2} onClick={abrirModalEdicao}>
              Atualizar cliente
            </Button>
          </CardBody>
        )}
      </Card>

      {/* SEÇÃO: CONTAS DE ENERGIA */}
      <Card>
        <CardHeader
          className="cursor-pointer flex items-center justify-between hover:bg-slate-50"
          onClick={() => toggleExpandido('contas')}
        >
          <h2 className="font-semibold text-slate-900">Contas de Energia</h2>
          <div className="flex items-center gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileInput}
                disabled={uploadandoConta}
                className="hidden"
              />
              <Button
                tamanho="sm"
                variante="secundario"
                icone={Upload}
                disabled={uploadandoConta}
                onClick={(e) => {
                  e.stopPropagation()
                  document.querySelector('input[type="file"]')?.click()
                }}
              >
                {uploadandoConta ? 'Enviando...' : '+ Anexar'}
              </Button>
            </label>
            {expandidos.contas ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </CardHeader>
        {expandidos.contas && (
          <CardBody className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
                dragAtivo ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
              }`}
            >
              <Upload size={32} className="mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-600">Arraste PDFs aqui ou use o botão Anexar</p>
            </div>

            {contas.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma conta anexada</p>
            ) : (
              <div className="space-y-2">
                {contas.map(conta => (
                  <div key={conta._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-900">{conta.nome}</p>
                      <p className="text-xs text-slate-500">{new Date(conta.createdAt).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <button
                      onClick={() => deletarConta(conta._id)}
                      className="p-2 rounded hover:bg-red-100 text-red-600"
                      title="Deletar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        )}
      </Card>

      {/* SEÇÃO: PROJETOS FV */}
      <Card>
        <CardHeader
          className="cursor-pointer flex items-center justify-between hover:bg-slate-50"
          onClick={() => toggleExpandido('projetosFV')}
        >
          <h2 className="font-semibold text-slate-900">Projetos FV ({projetosFV.length})</h2>
          <div className="flex items-center gap-2">
            <Button icone={Plus} tamanho="sm" onClick={(e) => {
              e.stopPropagation()
              // [AUDIT LOCAL] Apontando para wizard novo ProjetosFVNovo (era /propostas/nova - velho monolítico)
              navigate(`/projetos-fv/novo?clienteId=${clienteId}`)
            }}>
              Novo
            </Button>
            {expandidos.projetosFV ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </CardHeader>
        {expandidos.projetosFV && (
          <CardBody>
            {projetosFV.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum projeto FV criado</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-4 py-2">Nome</th>
                      <th className="text-left px-4 py-2">Data</th>
                      <th className="text-left px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projetosFV.map(p => (
                      <tr key={p._id} className="border-b hover:bg-slate-50 cursor-pointer">
                        <td className="px-4 py-2 font-medium text-slate-900">{p.nome}</td>
                        <td className="px-4 py-2 text-slate-600">{new Date(p.createdAt).toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-2">
                          <Badge cor="verde">{p.status || 'rascunho'}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        )}
      </Card>

      {/* SEÇÃO: PROJETOS EV */}
      <Card>
        <CardHeader
          className="cursor-pointer flex items-center justify-between hover:bg-slate-50"
          onClick={() => toggleExpandido('projetosEV')}
        >
          <h2 className="font-semibold text-slate-900">Projetos EV ({projetosEV.length})</h2>
          <div className="flex items-center gap-2">
            <Button icone={Plus} tamanho="sm" onClick={(e) => {
              e.stopPropagation()
              navigate(`/propostas-ev/nova?clienteId=${clienteId}`)
            }}>
              Novo
            </Button>
            {expandidos.projetosEV ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </CardHeader>
        {expandidos.projetosEV && (
          <CardBody>
            {projetosEV.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum projeto EV criado</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-4 py-2">Nome</th>
                      <th className="text-left px-4 py-2">Data</th>
                      <th className="text-left px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projetosEV.map(p => (
                      <tr key={p._id} className="border-b hover:bg-slate-50 cursor-pointer">
                        <td className="px-4 py-2 font-medium text-slate-900">{p.nome}</td>
                        <td className="px-4 py-2 text-slate-600">{new Date(p.createdAt).toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-2">
                          <Badge cor="amarelo">{p.status || 'rascunho'}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        )}
      </Card>

      {/* MODAL: ATUALIZAR CLIENTE */}
      {modalAberta && clienteEditando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Atualizar cliente</h2>
              <button
                onClick={fecharModal}
                className="p-1 rounded hover:bg-slate-100"
              >
                <X size={20} className="text-slate-600" />
              </button>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input
                rotulo="Nome"
                value={clienteEditando.nome || ''}
                onChange={(e) => atualizarClienteEditando('nome', e.target.value)}
              />
              <Input
                rotulo="Email"
                tipo="email"
                value={clienteEditando.email || ''}
                onChange={(e) => atualizarClienteEditando('email', e.target.value)}
              />
              <Input
                rotulo="CPF/CNPJ"
                value={clienteEditando.cpf_cnpj || ''}
                onChange={(e) => atualizarClienteEditando('cpf_cnpj', e.target.value)}
              />
              <Input
                rotulo="Telefone"
                value={clienteEditando.telefone || ''}
                onChange={(e) => atualizarClienteEditando('telefone', e.target.value)}
              />
              <Input
                rotulo="Endereço"
                value={clienteEditando.endereco_completo || ''}
                onChange={(e) => atualizarClienteEditando('endereco_completo', e.target.value)}
              />
              <Input
                rotulo="Cidade"
                value={clienteEditando.cidade || ''}
                onChange={(e) => atualizarClienteEditando('cidade', e.target.value)}
              />
              <Input
                rotulo="Estado"
                value={clienteEditando.estado || ''}
                onChange={(e) => atualizarClienteEditando('estado', e.target.value)}
              />

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={fecharModal}
                  variante="secundario"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={salvarClienteEditado}
                  icone={Edit2}
                  className="flex-1"
                >
                  Salvar
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}
