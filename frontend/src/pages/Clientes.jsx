import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Phone, Mail, MapPin, X, Edit2, FileUp, Sun, Zap, Trash2 } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Input from '../components/ui/Input'
import Dropzone from '../components/ui/Dropzone'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway. Não usar VITE_API_URL */

function ModalNovoClienteComPDF({ onClose, onSalvo }) {
  const [step, setStep] = useState('upload') // 'upload' | 'manual'
  const [arquivo, setArquivo] = useState(null)
  const [extraindo, setExtraindo] = useState(false)
  const [erro, setErro] = useState('')

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf_cnpj: '',
    endereco_completo: '',
    cep: '',
    cidade: '',
    estado: '',
    tipo: 'Pessoa Física',
    // Dados da conta de energia
    numero_cliente: '',
    codigo_instalacao: '',
    consumo_kwh: '',
    distribuidora: '',
    classificacao: '',
    subgrupo: '',
    tipo_ligacao: '',
    valor_kwh: '',
  })

  function handleChange(e) {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  async function onArquivo(file) {
    setArquivo(file)
    setExtraindo(true)
    setErro('')

    try {
      const formDataUpload = new FormData()
      formDataUpload.append('fatura', file)

      // Passa chave Gemini do localStorage para o backend processar imagens
      const headers = {}
      const geminiKey = localStorage.getItem('geminiApiKey')
      if (geminiKey) headers['X-Gemini-Key'] = geminiKey

      const res = await fetch(`${API_URL}/api/fatura/extrair`, {
        method: 'POST',
        headers,
        body: formDataUpload,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.erro || 'Erro ao extrair dados da fatura')
      }

      const dados = await res.json()

      // Auto-preencher com todos os dados extraídos
      setFormData(prev => ({
        ...prev,
        nome:             dados.nome             || prev.nome,
        cpf_cnpj:         dados.cpfCnpj          || prev.cpf_cnpj,
        endereco_completo:dados.endereco          || prev.endereco_completo,
        cep:              dados.cep               || prev.cep,
        cidade:           dados.cidade            || prev.cidade,
        estado:           dados.estado            || prev.estado,
        numero_cliente:   dados.numeroCliente     || prev.numero_cliente,
        consumo_kwh:      dados.consumoKwh        || prev.consumo_kwh,
        distribuidora:    dados.distribuidora     || prev.distribuidora,
        classificacao:    dados.classificacao     || prev.classificacao,
        subgrupo:         dados.subgrupo          || prev.subgrupo,
        tipo_ligacao:     dados.tipoLigacao       || prev.tipo_ligacao,
        valor_kwh:        dados.valorKwh          || prev.valor_kwh,
      }))

      setStep('manual')
    } catch (err) {
      const msg = err.message || 'Erro desconhecido'
      if (msg.toLowerCase().includes('gemini') || msg.toLowerCase().includes('chave')) {
        setErro(`${msg} Clique em "Preencher manualmente" para continuar.`)
      } else {
        setErro(`Erro ao extrair: ${msg}`)
      }
      // Ainda abre o formulário manual para não bloquear o usuário
      setStep('manual')
    } finally {
      setExtraindo(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')

    if (!formData.nome || !formData.nome.trim()) {
      setErro('Nome é obrigatório')
      return
    }

    if (!formData.email || !formData.email.trim()) {
      setErro('Email é obrigatório')
      return
    }

    try {
      const res = await fetch(`${API_URL}/api/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.mensagem || data.erro || 'Erro ao criar cliente')
      }

      const novoCliente = data
      onSalvo(novoCliente)
      onClose()
    } catch (err) {
      setErro(`Erro: ${err.message}`)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-2xl my-4">
        <CardHeader className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Novo Cliente</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X size={18} />
          </button>
        </CardHeader>
        <CardBody>
          {step === 'upload' ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">
                  Anexe a fatura de energia para extrair dados automaticamente:
                </p>
                <Dropzone
                  arquivo={arquivo}
                  nomeArquivo={arquivo?.name}
                  onArquivo={onArquivo}
                  onRemover={() => setArquivo(null)}
                />
              </div>

              {erro && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                  {erro}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button onClick={onClose} variante="secundario" className="flex-1">
                  Cancelar
                </Button>
                <Button
                  onClick={() => setStep('manual')}
                  variante="secundario"
                  className="flex-1"
                >
                  Preencher manualmente
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 max-h-96 overflow-y-auto">
              <h4 className="font-semibold text-slate-900">Dados pessoais</h4>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  rotulo="Nome *"
                  value={formData.nome}
                  onChange={handleChange}
                  name="nome"
                  placeholder="Ex: João Silva"
                />
                <Input
                  rotulo="CPF/CNPJ"
                  value={formData.cpf_cnpj}
                  onChange={handleChange}
                  name="cpf_cnpj"
                />
                <Input
                  rotulo="Email *"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  name="email"
                  placeholder="Ex: joao@email.com"
                />
                <Input
                  rotulo="Telefone"
                  value={formData.telefone}
                  onChange={handleChange}
                  name="telefone"
                />
              </div>

              <h4 className="font-semibold text-slate-900 mt-4">Endereço</h4>
              <div className="space-y-2">
                <Input
                  rotulo="Endereço completo"
                  value={formData.endereco_completo}
                  onChange={handleChange}
                  name="endereco_completo"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    rotulo="CEP"
                    value={formData.cep}
                    onChange={handleChange}
                    name="cep"
                  />
                  <Input
                    rotulo="Cidade"
                    value={formData.cidade}
                    onChange={handleChange}
                    name="cidade"
                  />
                </div>
              </div>

              <h4 className="font-semibold text-slate-900 mt-4">Dados da conta de energia</h4>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  rotulo="Número do cliente / UC"
                  value={formData.numero_cliente}
                  onChange={handleChange}
                  name="numero_cliente"
                />
                <Input
                  rotulo="Distribuidora"
                  value={formData.distribuidora}
                  onChange={handleChange}
                  name="distribuidora"
                />
                <Input
                  rotulo="Classificação (B1, B2, B3...)"
                  value={formData.classificacao}
                  onChange={handleChange}
                  name="classificacao"
                  placeholder="Ex: B1"
                />
                <Input
                  rotulo="Subgrupo"
                  value={formData.subgrupo}
                  onChange={handleChange}
                  name="subgrupo"
                  placeholder="Ex: Residencial"
                />
                <Input
                  rotulo="Tipo de ligação"
                  value={formData.tipo_ligacao}
                  onChange={handleChange}
                  name="tipo_ligacao"
                  placeholder="Ex: Monofásico 220V"
                />
                <Input
                  rotulo="Tarifa (R$/kWh)"
                  type="number"
                  value={formData.valor_kwh}
                  onChange={handleChange}
                  name="valor_kwh"
                  placeholder="Ex: 0.85"
                />
                <Input
                  rotulo="Consumo médio (kWh)"
                  type="number"
                  value={formData.consumo_kwh}
                  onChange={handleChange}
                  name="consumo_kwh"
                />
              </div>

              {erro && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                  {erro}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button onClick={onClose} variante="secundario" className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1">
                  Criar cliente
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function ModalEditarCliente({ cliente, onClose, onSalvo }) {
  const [formData, setFormData] = useState(cliente || {
    nome: '',
    email: '',
    telefone: '',
    cpf_cnpj: '',
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

    if (!formData.nome) {
      setErro('Nome é obrigatório')
      setCarregando(false)
      return
    }

    try {
      const res = await fetch(`${API_URL}/api/clientes/${cliente._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) throw new Error('Erro ao atualizar')

      const clienteAtualizado = await res.json()
      onSalvo(clienteAtualizado)
      onClose()
    } catch (err) {
      setErro(`Erro: ${err.message}`)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Editar Cliente</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X size={18} />
          </button>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              rotulo="Nome *"
              value={formData.nome}
              onChange={handleChange}
              name="nome"
              placeholder="Ex: João Silva"
            />
            <Input
              rotulo="Email *"
              type="email"
              value={formData.email}
              onChange={handleChange}
              name="email"
              placeholder="Ex: joao@email.com"
            />
            <Input
              rotulo="Telefone"
              value={formData.telefone}
              onChange={handleChange}
              name="telefone"
              placeholder="Ex: (11) 99999-0000"
            />
            <Input
              rotulo="CPF/CNPJ"
              value={formData.cpf_cnpj}
              onChange={handleChange}
              name="cpf_cnpj"
            />

            {erro && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                {erro}
              </div>
            )}

            <div className="flex gap-3 pt-4">
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

function ModalNovoClienteAntigo({ onClose, onSalvo }) {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cidade: '',
    tipo: 'Pessoa Física',
    cpf_cnpj: '',
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

    if (!formData.nome) {
      setErro('Nome é obrigatório')
      setCarregando(false)
      return
    }

    try {
      const res = await fetch(`${API_URL}/api/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        throw new Error('Erro ao criar cliente')
      }

      const novoCliente = await res.json()
      onSalvo(novoCliente)
      onClose()
    } catch (err) {
      setErro(`Erro: ${err.message}`)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Novo Cliente</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X size={18} />
          </button>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Nome *</label>
              <input
                type="text"
                name="nome"
                value={formData.nome}
                onChange={handleChange}
                placeholder="Ex: João Silva"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Ex: joao@email.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Telefone</label>
              <input
                type="tel"
                name="telefone"
                value={formData.telefone}
                onChange={handleChange}
                placeholder="Ex: (11) 99999-0000"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Tipo</label>
              <select
                name="tipo"
                value={formData.tipo}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Pessoa Física</option>
                <option>Pessoa Jurídica</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">CPF/CNPJ</label>
              <input
                type="text"
                name="cpf_cnpj"
                value={formData.cpf_cnpj}
                onChange={handleChange}
                placeholder="Ex: 000.000.000-00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Cidade</label>
              <input
                type="text"
                name="cidade"
                value={formData.cidade}
                onChange={handleChange}
                placeholder="Ex: São Paulo - SP"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {erro && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                {erro}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button onClick={onClose} variante="secundario" className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" disabled={carregando} className="flex-1">
                {carregando ? 'Salvando...' : 'Salvar Cliente'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}

function TelaDetalhes({ cliente, onVoltar }) {
  const navigate = useNavigate()

  // Ir para gerenciamento em vez de tela de detalhes aqui
  React.useEffect(() => {
    navigate(`/clientes/${cliente._id}`)
  }, [cliente._id, navigate])

  return null
  const [projetosFV, setProjetosFV] = useState([])
  const [projetosEV, setProjetosEV] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregarProjetos() {
      try {
        setCarregando(true)
        setErro('')
        const [resFV, resEV] = await Promise.all([
          fetch(`${API_URL}/api/projetos-fv/cliente/${cliente._id}`),
          fetch(`${API_URL}/api/projetos-ev/cliente/${cliente._id}`),
        ])
        const dataFV = await resFV.json()
        const dataEV = await resEV.json()
        setProjetosFV(dataFV || [])
        setProjetosEV(dataEV || [])
      } catch (err) {
        console.error('Erro ao carregar projetos:', err)
        setErro('Erro ao carregar projetos')
      } finally {
        setCarregando(false)
      }
    }
    carregarProjetos()
  }, [cliente._id])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onVoltar} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{cliente.nome}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{cliente.tipo}</p>
        </div>
      </div>

      <Card>
        <CardHeader><h2 className="font-semibold text-slate-900">Informações</h2></CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 font-semibold mb-1">Email</p>
              <p className="text-sm flex items-center gap-1.5"><Mail size={14} />{cliente.email}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold mb-1">Telefone</p>
              <p className="text-sm flex items-center gap-1.5"><Phone size={14} />{cliente.telefone}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-slate-500 font-semibold mb-1">Cidade</p>
              <p className="text-sm flex items-center gap-1.5"><MapPin size={14} />{cliente.cidade}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {erro && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {erro}
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sun size={18} className="text-amber-500" />
              <h2 className="font-semibold text-slate-900">Projetos FV</h2>
            </div>
            <Button icone={Plus} tamanho="sm" variante="primario" onClick={() => navigate('/projetos-fv/novo')}>Novo</Button>
          </CardHeader>
          <CardBody>
            {carregando ? (
              <p className="text-sm text-slate-500">Carregando...</p>
            ) : projetosFV.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum projeto FV</p>
            ) : (
              <div className="space-y-2">
                {projetosFV.map((p) => (
                  <button key={p._id} onClick={() => navigate(`/projetos-fv/${p._id}`)} className="w-full text-left p-3 bg-amber-50 rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors">
                    <p className="font-medium text-slate-900">{p.nome}</p>
                    <p className="text-xs text-slate-600 mt-1">{p.potenciaKwp} kWp · {p.status}</p>
                  </button>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-blue-500" />
              <h2 className="font-semibold text-slate-900">Projetos EV</h2>
            </div>
            <Button icone={Plus} tamanho="sm" variante="primario">Novo</Button>
          </CardHeader>
          <CardBody>
            {carregando ? (
              <p className="text-sm text-slate-500">Carregando...</p>
            ) : projetosEV.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum projeto EV</p>
            ) : (
              <div className="space-y-2">
                {projetosEV.map((p) => (
                  <div key={p._id} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="font-medium text-slate-900">{p.nome}</p>
                    <p className="text-xs text-slate-600 mt-1">{p.potenciaKw} kW · {p.status}</p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

export default function Clientes() {
  const navigate = useNavigate()
  const [clienteSelecionado, setClienteSelecionado] = useState(null)
  const [clienteParaEditar, setClienteParaEditar] = useState(null)
  const [clienteParaDeletar, setClienteParaDeletar] = useState(null)
  const [clientes, setClientes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    carregarClientes()
  }, [])

  async function carregarClientes() {
    setCarregando(true)
    setErro('')
    try {
      const res = await fetch(`${API_URL}/api/clientes`)
      if (!res.ok) {
        throw new Error('Erro ao carregar clientes')
      }
      const dados = await res.json()
      setClientes(Array.isArray(dados) ? dados : [])
    } catch (err) {
      console.error('Erro:', err)
      setErro(`Erro ao carregar clientes: ${err.message}`)
      setClientes([])
    } finally {
      setCarregando(false)
    }
  }

  function handleNovoClienteSalvo(novoCliente) {
    setClientes(prev => [...prev, novoCliente])
    navigate(`/clientes/${novoCliente._id}`)
  }

  function handleClienteEditado(clienteAtualizado) {
    setClientes(prev => prev.map(c => c._id === clienteAtualizado._id ? clienteAtualizado : c))
    setClienteParaEditar(null)
  }

  async function handleDeleteCliente(clienteId) {
    setCarregando(true)
    setErro('')
    try {
      const res = await fetch(`${API_URL}/api/clientes/${clienteId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Erro ao deletar cliente')
      }

      // Remove o cliente da lista
      setClientes(prev => prev.filter(c => c._id !== clienteId))
      setClienteParaDeletar(null)
    } catch (err) {
      setErro(`Erro ao deletar: ${err.message}`)
    } finally {
      setCarregando(false)
    }
  }

  const clientesFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(filtro.toLowerCase()) ||
    c.email.toLowerCase().includes(filtro.toLowerCase()) ||
    c.cidade.toLowerCase().includes(filtro.toLowerCase())
  )

  if (clienteSelecionado) {
    return <TelaDetalhes cliente={clienteSelecionado} onVoltar={() => setClienteSelecionado(null)} />
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Input
          icone={Search}
          placeholder="Buscar cliente..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="sm:w-72"
        />
        <Button icone={Plus} onClick={() => setModalAberto(true)}>Novo Cliente</Button>
      </div>

      {erro && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {erro}
          <button onClick={carregarClientes} className="ml-4 font-semibold hover:underline">
            Tentar novamente
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-900">
            Clientes <span className="text-slate-400 font-normal text-sm ml-1">({clientesFiltrados.length})</span>
          </h2>
        </CardHeader>
        <CardBody className="p-0">
          {carregando ? (
            <div className="p-8 text-center text-slate-500">Carregando clientes...</div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              {clientes.length === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum cliente encontrado'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Contato</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Cidade</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {clientesFiltrados.map((c) => (
                    <tr key={c._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{c.nome}</td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <div className="flex flex-col gap-1 text-slate-500">
                          <span className="flex items-center gap-1.5"><Mail size={12} />{c.email}</span>
                          <span className="flex items-center gap-1.5"><Phone size={12} />{c.telefone}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 hidden lg:table-cell">
                        <span className="flex items-center gap-1.5"><MapPin size={12} />{c.cidade}</span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge cor={c.tipo === 'Pessoa Física' ? 'azul' : 'laranja'}>{c.tipo}</Badge>
                      </td>
                      <td className="px-6 py-4 text-right flex gap-2 justify-end">
                        <Button variante="fantasma" tamanho="sm" icone={Edit2} onClick={() => setClienteParaEditar(c)} />
                        <Button variante="fantasma" tamanho="sm" icone={Trash2} onClick={() => setClienteParaDeletar(c)} />
                        <Button variante="fantasma" tamanho="sm" onClick={() => setClienteSelecionado(c)}>Ver</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {modalAberto && (
        <ModalNovoClienteComPDF
          onClose={() => setModalAberto(false)}
          onSalvo={handleNovoClienteSalvo}
        />
      )}

      {clienteParaEditar && (
        <ModalEditarCliente
          cliente={clienteParaEditar}
          onClose={() => setClienteParaEditar(null)}
          onSalvo={handleClienteEditado}
        />
      )}

      {clienteParaDeletar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Confirmar Exclusão</h3>
              <button onClick={() => setClienteParaDeletar(null)} className="text-slate-500 hover:text-slate-700">
                <X size={18} />
              </button>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Tem certeza que deseja deletar o cliente <span className="font-semibold text-slate-900">{clienteParaDeletar.nome}</span>?
                </p>
                <p className="text-xs text-slate-500">
                  Esta ação não pode ser desfeita.
                </p>
                <div className="flex gap-3 pt-4">
                  <Button onClick={() => setClienteParaDeletar(null)} variante="secundario" className="flex-1">
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => handleDeleteCliente(clienteParaDeletar._id)}
                    disabled={carregando}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  >
                    {carregando ? 'Deletando...' : 'Deletar'}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}
