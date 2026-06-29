import { useState, useEffect, useRef } from 'react'
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, Sun, Upload, BarChart2, Zap, FileText, Award, CheckCircle2 } from 'lucide-react'
import Card, { CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import ModalNovoModulo from '../components/equipamentos/ModalNovoModulo'
import { useBulkSelection } from '../hooks/useBulkSelection'
import BulkActionBar from '../components/catalogo/BulkActionBar'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway. Não usar VITE_API_URL */

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

function StatusEngenharia({ equipamento }) {
  const utilizavel = equipamento?.utilizavel_em_projeto !== false
  const nivel = equipamento?.qualidade?.nivel
  const faltando = equipamento?.bloqueio_engenharia || []
  if (!utilizavel) {
    return (
      <span title={faltando.length ? `Faltando: ${faltando.join(', ')}` : 'Specs mínimas ausentes'}
        className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide bg-red-100 text-red-700 border border-red-200 shrink-0">
        ❌ Incompleto{faltando.length ? ` · falta ${faltando.join(', ')}` : ''}
      </span>
    )
  }
  if (['incompleto', 'suspeito', 'aguardando_revisao', 'invalido'].includes(nivel)) {
    return (
      <span title={`Nível de qualidade: ${nivel}`}
        className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
        ⚠ Revisão
      </span>
    )
  }
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">
      ✅ Utilizável
    </span>
  )
}

// ── Dashboard de métricas ─────────────────────────────────────────────────────

function MetricaTile({ label, valor, sub, cor = 'slate' }) {
  const cores = {
    blue:    'bg-blue-50 border-blue-200 text-blue-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    amber:   'bg-amber-50 border-amber-200 text-amber-900',
    red:     'bg-red-50 border-red-200 text-red-900',
    violet:  'bg-violet-50 border-violet-200 text-violet-900',
    slate:   'bg-slate-50 border-slate-200 text-slate-900',
  }
  return (
    <div className={`p-4 rounded-xl border ${cores[cor]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{valor ?? '—'}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

function DashboardModulos({ stats, carregandoStats }) {
  if (carregandoStats) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-slate-400 text-center py-2">Carregando métricas…</p>
        </CardBody>
      </Card>
    )
  }
  if (!stats) return null

  const { resumo, coberturas, distribuicao } = stats
  const pct = (n) => resumo?.total > 0 ? `${Math.round(n / resumo.total * 100)}%` : '—'

  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="flex items-center gap-2">
          <BarChart2 size={16} className="text-slate-400" />
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Painel de Qualidade — Módulos FV</h2>
        </div>

        {/* Totais de status */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricaTile label="Total" valor={resumo?.total} cor="blue" />
          <MetricaTile label="Validados" valor={resumo?.validados} sub={pct(resumo?.validados)} cor="emerald" />
          <MetricaTile label="Pendentes" valor={resumo?.pendentes} sub={pct(resumo?.pendentes)} cor="amber" />
          <MetricaTile label="Suspeitos" valor={resumo?.suspeitos} sub={pct(resumo?.suspeitos)} cor="amber" />
          <MetricaTile label="Duplicados" valor={resumo?.duplicados} sub={pct(resumo?.duplicados)} cor="red" />
          <MetricaTile label="Descontinuados" valor={resumo?.descontinuados} cor="slate" />
        </div>

        {/* Coberturas */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Cobertura Documental</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <CoberturaBar label="Datasheets" icone={FileText} qtd={coberturas?.datasheet?.quantidade} pct={coberturas?.datasheet?.pct} total={resumo?.total} cor="blue" />
            <CoberturaBar label="OCR processado" icone={Zap} qtd={coberturas?.ocr?.quantidade} pct={coberturas?.ocr?.pct} total={resumo?.total} cor="violet" />
            <CoberturaBar label="Certificação" icone={Award} qtd={coberturas?.certificacao?.quantidade} pct={coberturas?.certificacao?.pct} total={resumo?.total} cor="emerald" />
          </div>
        </div>

        {/* Distribuições lado a lado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <DistribuicaoLista titulo="Por Tecnologia" dados={distribuicao?.por_tecnologia?.slice(0, 6).map(x => ({ label: x.tecnologia, val: x.total }))} total={resumo?.total} />
          <DistribuicaoLista titulo="Por Potência (Wp)" dados={distribuicao?.por_potencia?.map(x => ({ label: faixaPotencia(x.faixa), val: x.total }))} total={resumo?.total} />
          <DistribuicaoLista titulo="Por Score" dados={distribuicao?.por_score?.map(x => ({ label: faixaScore(x.faixa), val: x.total }))} total={resumo?.total} />
          <DistribuicaoLista titulo="Top Fabricantes" dados={distribuicao?.por_fabricante?.slice(0, 6).map(x => ({ label: x.fabricante, val: x.total }))} total={resumo?.total} />
        </div>
      </CardBody>
    </Card>
  )
}

function CoberturaBar({ label, icone: Icone, qtd, pct, total, cor }) {
  const cores = { blue: 'bg-blue-500', violet: 'bg-violet-500', emerald: 'bg-emerald-500' }
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 font-medium text-slate-600"><Icone size={12} />{label}</span>
        <span className="font-bold text-slate-900">{qtd ?? 0} <span className="text-slate-400 font-normal">({pct ?? 0}%)</span></span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${cores[cor]}`} style={{ width: `${pct ?? 0}%` }} />
      </div>
    </div>
  )
}

function DistribuicaoLista({ titulo, dados, total }) {
  if (!dados?.length) return null
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{titulo}</p>
      <div className="space-y-1.5">
        {dados.map((d, i) => {
          const p = total > 0 ? Math.round(d.val / total * 100) : 0
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-slate-600 truncate flex-1">{d.label}</span>
              <span className="text-xs font-bold text-slate-900 shrink-0">{d.val}</span>
              <div className="w-16 h-1.5 bg-slate-100 rounded-full shrink-0">
                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${p}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function faixaPotencia(faixa) {
  if (faixa === '700+') return '700+ Wp'
  if (typeof faixa === 'number') return `${faixa}–${faixa + 50} Wp`
  return faixa
}

function faixaScore(faixa) {
  if (faixa === 'sem score') return 'Sem score'
  if (typeof faixa === 'number') {
    const map = { 0: '0–20', 20: '20–40', 40: '40–60', 60: '60–80', 80: '80–100' }
    return map[faixa] || `${faixa}+`
  }
  return faixa
}

// ── Card de módulo ────────────────────────────────────────────────────────────

function CardModulo({ modulo, selecionado, onToggle, onEditar, onExcluir }) {
  const [aberto, setAberto] = useState(false)
  const e = modulo.especificacoes || {}

  const gpAnos = modulo.garantia_produto?.value || e.garantia_produto_anos
  const gpeAnos = modulo.garantia_performance?.value || e.garantia_performance_anos

  return (
    <Card className={`overflow-hidden transition-shadow hover:shadow-md ${selecionado ? 'ring-2 ring-blue-500 bg-blue-50/30' : ''}`}>

      {/* ── Linha principal ── */}
      <div className="flex items-center gap-3 px-5 py-4">

        {/* Checkbox de seleção */}
        <input
          type="checkbox"
          checked={selecionado}
          onChange={() => onToggle(modulo._id)}
          onClick={e => e.stopPropagation()}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0 cursor-pointer"
        />

        <div className="p-2.5 bg-amber-50 rounded-xl shrink-0">
          <Sun size={18} className="text-amber-500" />
        </div>

        {/* Identidade + resumo elétrico */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-slate-900 truncate">{modulo.fabricante} — {modulo.modelo}</p>
            <StatusEngenharia equipamento={modulo} />
          </div>
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

  const [modulos, setModulos]         = useState([])
  const [carregando, setCarregando]   = useState(true)
  const [busca, setBusca]             = useState('')
  const [ordenar, setOrdenar]         = useState('data')
  const [arrastando, setArrastando]   = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [moduloEditar, setModuloEditar] = useState(null)
  const [stats, setStats]             = useState(null)
  const [carregandoStats, setCarregandoStats] = useState(true)
  const [mostrarDashboard, setMostrarDashboard] = useState(false)

  const bulk = useBulkSelection(modulos)

  useEffect(() => { carregarModulos() }, [busca, ordenar])
  useEffect(() => { carregarStats() }, [])

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

  async function carregarStats() {
    try {
      setCarregandoStats(true)
      const res = await fetch(`${API_URL}/api/admin/catalogo/stats?tipo=modulo`)
      if (res.ok) setStats(await res.json())
    } catch { /* não crítico */ }
    finally { setCarregandoStats(false) }
  }

  async function handleExcluir(id) {
    if (!confirm('Tem certeza que deseja excluir este módulo?')) return
    try {
      await fetch(`${API_URL}/api/equipamentos/${id}`, { method: 'DELETE' })
      carregarModulos()
      carregarStats()
    } catch (err) { console.error('Erro ao excluir:', err) }
  }

  function handleNovo() { setModuloEditar(null); setModalAberto(true) }
  function handleEditar(m) { setModuloEditar(m); setModalAberto(true) }
  function handleSalvar() { setModalAberto(false); carregarModulos(); carregarStats() }

  function onDragOver(e)  { e.preventDefault(); setArrastando(true)  }
  function onDragLeave(e) { e.preventDefault(); setArrastando(false) }
  function onDrop(e) {
    e.preventDefault(); setArrastando(false)
    const pdfs = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf')
    if (pdfs.length) { setModuloEditar(null); setModalAberto(true) }
  }

  function handleBulkSuccess(acao) {
    bulk.clearAll()
    carregarModulos()
    carregarStats()
  }

  // ── Select-all checkbox state ─────────────────────────────────────────────
  const refSelectAll = useRef(null)
  useEffect(() => {
    if (refSelectAll.current) {
      refSelectAll.current.indeterminate = bulk.isIndeterminate
    }
  }, [bulk.isIndeterminate])

  return (
    <div className="space-y-6 pb-24">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Módulos Fotovoltaicos</h1>
          <p className="text-slate-600 mt-1">
            Arraste datasheets ou clique em <strong>Novo Módulo</strong> para importar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMostrarDashboard(v => !v)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1.5
              ${mostrarDashboard ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
          >
            <BarChart2 size={15} />
            Painel
          </button>
          <Button
            onClick={handleNovo}
            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            className={`flex items-center gap-2 transition-all ${arrastando ? 'ring-4 ring-blue-300 scale-105' : ''}`}
          >
            {arrastando ? <Upload size={20} /> : <Plus size={20} />}
            {arrastando ? 'Soltar aqui' : 'Novo Módulo'}
          </Button>
        </div>
      </div>

      {/* Dashboard de métricas (toggle) */}
      {mostrarDashboard && (
        <DashboardModulos stats={stats} carregandoStats={carregandoStats} />
      )}

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

          {/* Controles de seleção em massa */}
          <div className="flex items-center gap-3 px-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                ref={refSelectAll}
                type="checkbox"
                checked={bulk.isAllSelected}
                onChange={bulk.toggleAll}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-sm text-slate-500 font-medium">
                {bulk.count > 0 ? `${bulk.count} selecionado${bulk.count > 1 ? 's' : ''}` : `Selecionar todos (${modulos.length})`}
              </span>
            </label>
            {bulk.count > 0 && (
              <button onClick={bulk.clearAll} className="text-xs text-slate-400 hover:text-slate-600">
                Limpar seleção
              </button>
            )}
            <span className="ml-auto text-sm text-slate-400 text-xs">
              {modulos.length} módulo{modulos.length > 1 ? 's' : ''} — clique em ▼ para dados técnicos
            </span>
          </div>

          {modulos.map(m => (
            <CardModulo
              key={m._id}
              modulo={m}
              selecionado={bulk.isSelected(m._id)}
              onToggle={bulk.toggleItem}
              onEditar={handleEditar}
              onExcluir={handleExcluir}
            />
          ))}
        </div>
      )}

      {/* Barra de ações em lote */}
      <BulkActionBar
        tipo="modulo"
        count={bulk.count}
        ids={bulk.selectedArray}
        onClear={bulk.clearAll}
        onSuccess={handleBulkSuccess}
      />

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
