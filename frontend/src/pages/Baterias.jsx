import { useState, useEffect, useRef } from 'react'
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, Battery, Upload } from 'lucide-react'
import Card, { CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function val(v, decimais = 2, sufixo = '') {
  if (v == null || v === '') return '—'
  const n = typeof v === 'number' ? v.toFixed(decimais) : v
  return sufixo ? `${n} ${sufixo}` : n
}

function Linha({ label, value }) {
  if (value === '—') return null
  return (
    <div className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-semibold text-slate-800 text-right ml-4">{value}</span>
    </div>
  )
}

function Secao({ titulo, children }) {
  const visiveis = Array.isArray(children) ? children.filter(Boolean) : [children].filter(Boolean)
  if (!visiveis.length) return null
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{titulo}</p>
      <div className="space-y-0">{visiveis}</div>
    </div>
  )
}

function CardBateria({ bateria, onEditar, onExcluir }) {
  const [aberto, setAberto] = useState(false)
  const e = bateria.especificacoes || {}

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="p-2.5 bg-green-50 rounded-xl shrink-0">
          <Battery size={18} className="text-green-500" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 truncate">{bateria.fabricante} — {bateria.modelo}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-xs text-slate-500">
            {e.capacidade_kwh != null && <span className="font-semibold text-slate-700">{e.capacidade_kwh} kWh</span>}
            {e.voltagem != null && <span>{e.voltagem} V</span>}
            {e.tipo_quimica != null && <span>{e.tipo_quimica}</span>}
            {e.poder_ciclos != null && <span>{e.poder_ciclos} ciclos</span>}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setAberto(a => !a)}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
            title={aberto ? 'Recolher' : 'Ver todos os dados'}
          >
            {aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button onClick={() => onEditar(bateria)} className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors">
            <Edit2 size={16} />
          </button>
          <button onClick={() => onExcluir(bateria._id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {aberto && (
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Secao titulo="Especificações Técnicas">
              <Linha label="Capacidade" value={val(e.capacidade_kwh, 2, 'kWh')} />
              <Linha label="Voltagem Nominal" value={val(e.voltagem, 1, 'V')} />
              <Linha label="Corrente Máxima" value={val(e.corrente_max, 1, 'A')} />
              <Linha label="Tipo de Química" value={val(e.tipo_quimica, 0)} />
              <Linha label="Eficiência Round-trip" value={val(e.eficiencia, 1, '%')} />
            </Secao>

            <Secao titulo="Ciclos e Performance">
              <Linha label="Número de Ciclos" value={val(e.poder_ciclos, 0)} />
              <Linha label="Profundidade de Descarga (DoD)" value={val(e.dod, 1, '%')} />
              <Linha label="Tempo de Carga" value={val(e.tempo_carga, 0, 'h')} />
              <Linha label="Tempo de Descarga" value={val(e.tempo_descarga, 0, 'h')} />
            </Secao>

            <Secao titulo="Garantias e Certificações">
              <Linha
                label="Período de Garantia"
                value={e.garantia_anos ? `${e.garantia_anos} anos` : '—'}
              />
              <Linha label="Garantia em Ciclos" value={val(e.garantia_ciclos, 0)} />
              <Linha label="Certificações" value={val(e.certificacoes, 0)} />
              <Linha label="Dimensões" value={val(e.dimensoes, 0)} />
            </Secao>
          </div>
        </div>
      )}
    </Card>
  )
}

export default function Baterias() {
  const inputRef = useRef(null)
  const [baterias, setBaterias] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [ordenar, setOrdenar] = useState('data')
  const [arrastando, setArrastando] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [bateriaEditar, setBateriaEditar] = useState(null)

  useEffect(() => { carregarBaterias() }, [busca, ordenar])

  async function carregarBaterias() {
    try {
      setCarregando(true)
      const params = new URLSearchParams({
        tipo: 'bateria', ativo: 'true',
        ...(busca && { search: busca }),
        ...(ordenar && { ordenar }),
      })
      const res = await fetch(`${API_URL}/api/equipamentos?${params}`)
      const dados = await res.json()
      setBaterias(dados.equipamentos || [])
    } catch (err) { console.error('Erro ao carregar baterias:', err) }
    finally { setCarregando(false) }
  }

  async function handleExcluir(id) {
    if (!confirm('Tem certeza que deseja excluir esta bateria?')) return
    try {
      await fetch(`${API_URL}/api/equipamentos/${id}`, { method: 'DELETE' })
      carregarBaterias()
    } catch (err) { console.error('Erro ao excluir:', err) }
  }

  function handleNovo() { setBateriaEditar(null); setModalAberto(true) }
  function handleEditar(b) { setBateriaEditar(b); setModalAberto(true) }
  function handleSalvar() { setModalAberto(false); carregarBaterias() }

  function onDragOver(e) { e.preventDefault(); setArrastando(true) }
  function onDragLeave(e) { e.preventDefault(); setArrastando(false) }
  function onDrop(e) {
    e.preventDefault(); setArrastando(false)
    const pdfs = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf')
    if (pdfs.length) { setBateriaEditar(null); setModalAberto(true) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Baterias</h1>
          <p className="text-slate-600 mt-1">
            Arraste datasheets ou clique em <strong>Nova Bateria</strong> para importar
          </p>
        </div>
        <Button
          onClick={handleNovo}
          onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
          className={`flex items-center gap-2 transition-all ${arrastando ? 'ring-4 ring-blue-300 scale-105' : ''}`}
        >
          {arrastando ? <Upload size={20} /> : <Plus size={20} />}
          {arrastando ? 'Soltar aqui' : 'Nova Bateria'}
        </Button>
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Buscar por fabricante ou modelo…"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="flex-1 min-w-48 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={ordenar}
              onChange={e => setOrdenar(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="data">Mais recentes</option>
              <option value="capacidade">Maior capacidade</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {carregando ? (
        <Card><CardBody><p className="text-center text-slate-500 py-6">Carregando…</p></CardBody></Card>
      ) : baterias.length === 0 ? (
        <Card><CardBody>
          <div className="text-center py-10 text-slate-400">
            <Battery size={44} className="mx-auto mb-3 opacity-25" />
            <p className="font-medium text-slate-600">Nenhuma bateria cadastrada</p>
            <p className="text-sm mt-1">Clique em <strong>Nova Bateria</strong> ou arraste um datasheet PDF</p>
          </div>
        </CardBody></Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 font-medium">
            {baterias.length} bateria{baterias.length > 1 ? 's' : ''} cadastrada{baterias.length > 1 ? 's' : ''}
            <span className="ml-2 text-slate-400 text-xs">— clique em ▼ para ver todos os dados técnicos</span>
          </p>
          {baterias.map(b => (
            <CardBateria
              key={b._id}
              bateria={b}
              onEditar={handleEditar}
              onExcluir={handleExcluir}
            />
          ))}
        </div>
      )}
    </div>
  )
}
