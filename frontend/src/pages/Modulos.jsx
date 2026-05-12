import { useState, useEffect, useRef } from 'react'
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, Sun, Upload } from 'lucide-react'
import Card, { CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import ModalNovoModulo from '../components/equipamentos/ModalNovoModulo'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Card de módulo ────────────────────────────────────────────────────────────

function CardModulo({ modulo, onEditar, onExcluir }) {
  const [aberto, setAberto] = useState(false)
  const e = modulo.especificacoes || {}

  const gpAnos = modulo.garantia_produto?.value || e.garantia_produto_anos
  const gpeAnos = modulo.garantia_performance?.value || e.garantia_performance_anos

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">

      {/* ── Linha principal ── */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="p-2.5 bg-amber-50 rounded-xl shrink-0">
          <Sun size={18} className="text-amber-500" />
        </div>

        {/* Identidade + resumo elétrico */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 truncate">{modulo.fabricante} — {modulo.modelo}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-xs text-slate-500">
            {e.potencia_wp  != null && <span className="font-semibold text-slate-700">{e.potencia_wp} Wp</span>}
            {e.voc          != null && <span>Voc {Number(e.voc).toFixed(2)} V</span>}
            {e.vmp          != null && <span>Vmpp {Number(e.vmp).toFixed(2)} V</span>}
            {e.isc          != null && <span>Isc {Number(e.isc).toFixed(2)} A</span>}
            {e.imp          != null && <span>Impp {Number(e.imp).toFixed(2)} A</span>}
            {e.eficiencia   != null && <span>η {Number(e.eficiencia).toFixed(1)}%</span>}
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setAberto(a => !a)}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
            title={aberto ? 'Recolher' : 'Ver todos os dados'}
          >
            {aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button onClick={() => onEditar(modulo)} className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors">
            <Edit2 size={16} />
          </button>
          <button onClick={() => onExcluir(modulo._id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* ── Painel expandido ── */}
      {aberto && (
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

            {/* Elétrica STC */}
            <Secao titulo="Características Elétricas (STC)">
              <Linha label="Potência Máxima — Pmax"   value={val(e.potencia_wp,  0, 'W')} />
              <Linha label="Tensão de Circuito Aberto — Voc"  value={val(e.voc,  2, 'V')} />
              <Linha label="Tensão na Pot. Máxima — Vmpp"     value={val(e.vmp,  2, 'V')} />
              <Linha label="Corrente de Curto-Circuito — Isc" value={val(e.isc,  2, 'A')} />
              <Linha label="Corrente na Pot. Máxima — Impp"   value={val(e.imp,  2, 'A')} />
              <Linha label="Eficiência do Módulo — η"         value={val(e.eficiencia, 2, '%')} />
            </Secao>

            {/* Temperatura + Mecânica */}
            <Secao titulo="Coef. de Temperatura e Mecânica">
              <Linha label="Coef. Temp. Pmax"   value={val(e.coef_temp_pmax,  3, '%/°C')} />
              <Linha label="Coef. Temp. Voc"    value={val(e.coef_temp_voc,   3, '%/°C')} />
              <Linha label="Coef. Temp. Isc"    value={val(e.coef_temp_isc,   3, '%/°C')} />
              <Linha label="Tipo de célula"      value={val(e.tipo_celula,     0)} />
              <Linha label="Nº de células"       value={val(e.num_celulas,     0)} />
              <Linha label="Dimensões"           value={val(e.dimensoes,       0, 'mm')} />
              <Linha label="Peso"                value={val(e.peso_kg,         1, 'kg')} />
            </Secao>

            {/* Garantias */}
            <Secao titulo="Garantias">
              <Linha
                label="Garantia contra defeito de fabricação"
                value={gpAnos  ? `${gpAnos} anos`  : '—'}
              />
              <Linha
                label="Garantia de potência linear"
                value={gpeAnos ? `${gpeAnos} anos` : '—'}
              />
            </Secao>

          </div>
        </div>
      )}
    </Card>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function Modulos() {
  const inputRef = useRef(null)

  const [modulos, setModulos]       = useState([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca]           = useState('')
  const [ordenar, setOrdenar]       = useState('data')
  const [arrastando, setArrastando] = useState(false)
  const [modalAberto, setModalAberto]   = useState(false)
  const [moduloEditar, setModuloEditar] = useState(null)

  useEffect(() => { carregarModulos() }, [busca, ordenar])

  async function carregarModulos() {
    try {
      setCarregando(true)
      const params = new URLSearchParams({
        tipo: 'modulo', ativo: 'true',
        ...(busca   && { search: busca }),
        ...(ordenar && { ordenar }),
      })
      const res  = await fetch(`${API_URL}/api/equipamentos?${params}`)
      const dados = await res.json()
      setModulos(dados.equipamentos || [])
    } catch (err) { console.error('Erro ao carregar módulos:', err) }
    finally { setCarregando(false) }
  }

  async function handleExcluir(id) {
    if (!confirm('Tem certeza que deseja excluir este módulo?')) return
    try {
      await fetch(`${API_URL}/api/equipamentos/${id}`, { method: 'DELETE' })
      carregarModulos()
    } catch (err) { console.error('Erro ao excluir:', err) }
  }

  function handleNovo() { setModuloEditar(null); setModalAberto(true) }
  function handleEditar(m) { setModuloEditar(m); setModalAberto(true) }
  function handleSalvar() { setModalAberto(false); carregarModulos() }

  function onDragOver(e)  { e.preventDefault(); setArrastando(true)  }
  function onDragLeave(e) { e.preventDefault(); setArrastando(false) }
  function onDrop(e) {
    e.preventDefault(); setArrastando(false)
    const pdfs = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf')
    if (pdfs.length) { setModuloEditar(null); setModalAberto(true) }
  }

  return (
    <div className="space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Módulos Fotovoltaicos</h1>
          <p className="text-slate-600 mt-1">
            Arraste datasheets ou clique em <strong>Novo Módulo</strong> para importar
          </p>
        </div>
        <Button
          onClick={handleNovo}
          onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
          className={`flex items-center gap-2 transition-all ${arrastando ? 'ring-4 ring-blue-300 scale-105' : ''}`}
        >
          {arrastando ? <Upload size={20} /> : <Plus size={20} />}
          {arrastando ? 'Soltar aqui' : 'Novo Módulo'}
        </Button>
      </div>

      {/* Filtros */}
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
              <option value="potencia">Maior potência</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {/* Lista */}
      {carregando ? (
        <Card><CardBody><p className="text-center text-slate-500 py-6">Carregando…</p></CardBody></Card>
      ) : modulos.length === 0 ? (
        <Card><CardBody>
          <div className="text-center py-10 text-slate-400">
            <Sun size={44} className="mx-auto mb-3 opacity-25" />
            <p className="font-medium text-slate-600">Nenhum módulo cadastrado</p>
            <p className="text-sm mt-1">Clique em <strong>Novo Módulo</strong> ou arraste um datasheet PDF</p>
          </div>
        </CardBody></Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 font-medium">
            {modulos.length} módulo{modulos.length > 1 ? 's' : ''} cadastrado{modulos.length > 1 ? 's' : ''}
            <span className="ml-2 text-slate-400 text-xs">— clique em ▼ para ver todos os dados técnicos</span>
          </p>
          {modulos.map(m => (
            <CardModulo
              key={m._id}
              modulo={m}
              onEditar={handleEditar}
              onExcluir={handleExcluir}
            />
          ))}
        </div>
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
