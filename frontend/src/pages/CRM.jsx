import { useEffect, useState } from 'react'
import { Plus, X, ChevronDown, MapPin } from 'lucide-react'
import { useEmpresa } from '../contexts/EmpresaContext'
import { useNavigate } from 'react-router-dom'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5005'

export default function CRM() {
  const { empresa } = useEmpresa()
  const navigate = useNavigate()
  const [funis, setFunis] = useState([])
  const [funilSelecionado, setFunilSelecionado] = useState(null)
  const [colunas, setColunas] = useState([])
  const [leads, setLeads] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [draggedLead, setDraggedLead] = useState(null)
  const [novoFunil, setNovoFunil] = useState('')
  const [novaColuna, setNovaColuna] = useState('')
  const [novoLead, setNovoLead] = useState({ nome: '', colunaId: '', valor: '', endereco: '', cidade: '', estado: '' })
  const [mostraFormFunil, setMostraFormFunil] = useState(false)
  const [mostraFormColuna, setMostraFormColuna] = useState(false)
  const [mostraFormLead, setMostraFormLead] = useState(false)

  const corBg = empresa.corSecundaria || '#0f172a'
  const corPrimaria = empresa.corPrimaria || '#f97316'

  const cores = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899']

  useEffect(() => {
    carregarFunis()
  }, [])

  useEffect(() => {
    if (funilSelecionado) {
      carregarColunas()
      carregarLeads()
    }
  }, [funilSelecionado])

  async function carregarFunis() {
    try {
      setCarregando(true)
      const res = await fetch(`${API_URL}/api/crm/funis`)
      const dados = await res.json()
      setFunis(dados)
      if (dados.length > 0 && !funilSelecionado) {
        setFunilSelecionado(dados[0].id)
      }
    } catch (err) {
      console.error('Erro ao carregar funis:', err)
    } finally {
      setCarregando(false)
    }
  }

  async function carregarColunas() {
    try {
      const res = await fetch(`${API_URL}/api/crm/colunas?funilId=${funilSelecionado}`)
      const dados = await res.json()
      setColunas(dados)
    } catch (err) {
      console.error('Erro ao carregar colunas:', err)
    }
  }

  async function carregarLeads() {
    try {
      const res = await fetch(`${API_URL}/api/crm/leads?funilId=${funilSelecionado}`)
      const dados = await res.json()
      setLeads(dados)
    } catch (err) {
      console.error('Erro ao carregar leads:', err)
    }
  }

  async function criarFunil() {
    if (!novoFunil.trim()) return
    try {
      const res = await fetch(`${API_URL}/api/crm/funis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoFunil })
      })
      if (res.ok) {
        await carregarFunis()
        setNovoFunil('')
        setMostraFormFunil(false)
      }
    } catch (err) {
      console.error('Erro ao criar funil:', err)
    }
  }

  async function criarColuna() {
    if (!novaColuna.trim() || !funilSelecionado) return
    try {
      const res = await fetch(`${API_URL}/api/crm/colunas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novaColuna, funilId: funilSelecionado })
      })
      if (res.ok) {
        await carregarColunas()
        setNovaColuna('')
        setMostraFormColuna(false)
      }
    } catch (err) {
      console.error('Erro ao criar coluna:', err)
    }
  }

  async function criarLead() {
    if (!novoLead.nome.trim() || !novoLead.colunaId) return
    try {
      const res = await fetch(`${API_URL}/api/crm/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: novoLead.nome,
          colunaId: Number(novoLead.colunaId),
          funilId: funilSelecionado,
          valor: novoLead.valor ? Number(novoLead.valor) : null,
          endereco: novoLead.endereco || '',
          cidade: novoLead.cidade || '',
          estado: novoLead.estado || ''
        })
      })
      if (res.ok) {
        await carregarLeads()
        setNovoLead({ nome: '', colunaId: '', valor: '', endereco: '', cidade: '', estado: '' })
        setMostraFormLead(false)
      }
    } catch (err) {
      console.error('Erro ao criar lead:', err)
    }
  }

  async function moverLead(leadId, novaColuna) {
    try {
      await fetch(`${API_URL}/api/crm/leads/${leadId}/mover`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colunaId: Number(novaColuna) })
      })
      await carregarLeads()
    } catch (err) {
      console.error('Erro ao mover lead:', err)
    }
  }

  async function deletarLead(leadId) {
    if (!confirm('Deletar este lead?')) return
    try {
      await fetch(`${API_URL}/api/crm/leads/${leadId}`, { method: 'DELETE' })
      await carregarLeads()
    } catch (err) {
      console.error('Erro ao deletar lead:', err)
    }
  }

  async function deletarColuna(colunaId) {
    if (!confirm('Deletar esta coluna? Todos os leads serão perdidos.')) return
    try {
      await fetch(`${API_URL}/api/crm/colunas/${colunaId}`, { method: 'DELETE' })
      await carregarColunas()
      await carregarLeads()
    } catch (err) {
      console.error('Erro ao deletar coluna:', err)
    }
  }

  function handleDragStart(e, leadId) {
    setDraggedLead(leadId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e, colunaId) {
    e.preventDefault()
    if (draggedLead) {
      moverLead(draggedLead, colunaId)
      setDraggedLead(null)
    }
  }

  const colunasDoFunil = colunas.map((col, i) => ({
    ...col,
    cor: cores[i % cores.length]
  }))

  if (carregando) {
    return <div style={{ backgroundColor: corBg }} className="flex-1 flex items-center justify-center text-white"><p>Carregando...</p></div>
  }

  return (
    <div style={{ backgroundColor: corBg }} className="flex-1 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">CRM</h1>
          <Button icone={Plus} variante="primario" onClick={() => setMostraFormFunil(!mostraFormFunil)}>
            Novo Funil
          </Button>
        </div>

        {mostraFormFunil && (
          <div className="bg-white/10 rounded-lg p-4 flex gap-2">
            <input
              type="text"
              value={novoFunil}
              onChange={(e) => setNovoFunil(e.target.value)}
              placeholder="Nome do funil"
              className="flex-1 px-3 py-2 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/20"
            />
            <button onClick={criarFunil} className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">
              Criar
            </button>
            <button onClick={() => setMostraFormFunil(false)} className="px-4 py-2 bg-slate-500 text-white rounded-lg">
              Cancelar
            </button>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          {funis.map(f => (
            <button
              key={f.id}
              onClick={() => setFunilSelecionado(f.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                funilSelecionado === f.id
                  ? 'bg-white text-slate-900'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {f.nome}
            </button>
          ))}
        </div>

        {funilSelecionado && (
          <>
            <div className="flex gap-2 mb-4">
              <Button icone={Plus} tamanho="sm" variante="secundario" onClick={() => setMostraFormColuna(!mostraFormColuna)}>
                Nova Coluna
              </Button>
              <Button icone={Plus} tamanho="sm" variante="secundario" onClick={() => setMostraFormLead(!mostraFormLead)}>
                Novo Lead
              </Button>
            </div>

            {mostraFormColuna && (
              <div className="bg-white/10 rounded-lg p-4 flex gap-2">
                <input
                  type="text"
                  value={novaColuna}
                  onChange={(e) => setNovaColuna(e.target.value)}
                  placeholder="Nome da coluna"
                  className="flex-1 px-3 py-2 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/20"
                />
                <button onClick={criarColuna} className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">
                  Criar
                </button>
                <button onClick={() => setMostraFormColuna(false)} className="px-4 py-2 bg-slate-500 text-white rounded-lg">
                  Cancelar
                </button>
              </div>
            )}

            {mostraFormLead && (
              <div className="bg-white/10 rounded-lg p-4 space-y-2">
                <input
                  type="text"
                  value={novoLead.nome}
                  onChange={(e) => setNovoLead({...novoLead, nome: e.target.value})}
                  placeholder="Nome do lead"
                  className="w-full px-3 py-2 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/20"
                />
                <div className="flex gap-2">
                  <select
                    value={novoLead.colunaId}
                    onChange={(e) => setNovoLead({...novoLead, colunaId: e.target.value})}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/20 text-white border border-white/20"
                  >
                    <option value="">Selecione coluna</option>
                    {colunasDoFunil.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={novoLead.valor}
                    onChange={(e) => setNovoLead({...novoLead, valor: e.target.value})}
                    placeholder="Valor (R$)"
                    className="px-3 py-2 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/20 w-32"
                  />
                </div>
                <input
                  type="text"
                  value={novoLead.endereco}
                  onChange={(e) => setNovoLead({...novoLead, endereco: e.target.value})}
                  placeholder="Endereço"
                  className="w-full px-3 py-2 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/20"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={novoLead.cidade}
                    onChange={(e) => setNovoLead({...novoLead, cidade: e.target.value})}
                    placeholder="Cidade"
                    className="flex-1 px-3 py-2 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/20"
                  />
                  <input
                    type="text"
                    value={novoLead.estado}
                    onChange={(e) => setNovoLead({...novoLead, estado: e.target.value})}
                    placeholder="Estado"
                    className="px-3 py-2 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/20 w-16"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={criarLead} className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">
                    Criar
                  </button>
                  <button onClick={() => setMostraFormLead(false)} className="px-4 py-2 bg-slate-500 text-white rounded-lg">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${Math.max(3, colunasDoFunil.length)}, minmax(300px, 1fr))` }}>
              {colunasDoFunil.map((col) => {
                const leadsCol = leads.filter(l => l.colunaId === col.id)
                return (
                  <div
                    key={col.id}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, col.id)}
                    className="rounded-lg p-4 group"
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', minHeight: '600px' }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: col.cor }} />
                      <h2 className="text-lg font-semibold text-white">{col.nome}</h2>
                      <span className="ml-auto text-sm text-white/50">{leadsCol.length}</span>
                      <button
                        onClick={() => deletarColuna(col.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                        title="Excluir coluna"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="space-y-3">
                      {leadsCol.map((lead) => (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, lead.id)}
                          className="p-4 rounded-lg bg-white/10 cursor-move hover:bg-white/15 transition-all group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{lead.nome}</p>
                              {lead.valor && (
                                <p className="text-sm font-bold text-emerald-300 mt-1">
                                  R$ {lead.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                              )}
                              {lead.endereco && (
                                <p className="text-xs text-white/60 mt-1 flex items-center gap-1">
                                  <MapPin size={12} />
                                  {lead.endereco}
                                  {lead.cidade && `, ${lead.cidade}`}
                                  {lead.estado && ` - ${lead.estado}`}
                                </p>
                              )}
                              {lead.notas && (
                                <p className="text-xs text-white/50 mt-2 line-clamp-2">{lead.notas}</p>
                              )}
                              <p className="text-xs text-white/40 mt-2">
                                {new Date(lead.data_criacao).toLocaleDateString('pt-BR')}
                              </p>
                              <button
                                onClick={() => navigate(`/propostas/nova?leadId=${lead.id}`)}
                                className="mt-2 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition-colors"
                              >
                                Criar Proposta
                              </button>
                            </div>
                            <button
                              onClick={() => deletarLead(lead.id)}
                              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {funis.length === 0 && (
          <div className="text-center py-12 text-white/50">
            <p>Nenhum funil criado. Crie um para começar!</p>
          </div>
        )}
      </div>
    </div>
  )
}
