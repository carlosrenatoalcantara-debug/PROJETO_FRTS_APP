import { useState, useEffect, useRef } from 'react'
import { X, Edit2, Trash2, Upload, Zap, ChevronDown, ChevronUp, Cable } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import ModalNovoInversor from '../components/equipamentos/ModalNovoInversor'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway. Não usar VITE_API_URL */

// ── Dimensionamento elétrico NBR 5410 ────────────────────────────────────────

// Cabos de cobre 70°C PVC, método B1 (eletroduto fixado em parede), NBR 5410 Tab. 36
const CABOS_NBR = [
  { secao: 1.5,  amp: 15.5 },
  { secao: 2.5,  amp: 21   },
  { secao: 4,    amp: 28   },
  { secao: 6,    amp: 36   },
  { secao: 10,   amp: 50   },
  { secao: 16,   amp: 68   },
  { secao: 25,   amp: 89   },
  { secao: 35,   amp: 110  },
  { secao: 50,   amp: 134  },
  { secao: 70,   amp: 171  },
  { secao: 95,   amp: 207  },
  { secao: 120,  amp: 239  },
  { secao: 150,  amp: 275  },
]
// Correntes nominais padronizadas de disjuntores termomagnéticos (NBR IEC 60898-1)
const DISJUNTORES_NBR = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 400]

function parseCorrente(val) {
  if (val == null) return null
  if (typeof val === 'number') return val
  const m = String(val).match(/[\d.]+/)
  return m ? parseFloat(m[0]) : null
}

// Seleciona menor cabo e menor disjuntor satisfazendo Ib ≤ In ≤ Iz (NBR 5410 item 9.5)
function dimensionar(corrente_projeto) {
  for (const cabo of CABOS_NBR) {
    const disj = DISJUNTORES_NBR.find(d => d >= corrente_projeto && d <= cabo.amp)
    if (disj) return { secao: cabo.secao, ampCabo: cabo.amp, disjuntor: disj }
  }
  return null
}

function calcularDimensionamento(espec) {
  if (!espec) return null
  const imax = parseCorrente(espec.corrente_ac_saida)
  if (!imax) return null

  const fases  = Number(espec.fases) || 1
  const polos  = fases === 3 ? 'Tripolar' : 'Bipolar'
  const iProj  = +(imax * 1.1).toFixed(1)
  const dim    = dimensionar(iProj)
  if (!dim) return null

  const result = { imax, iProj, polos, ...dim }

  // Cabo tronco para micro-inversores (corrente acumulada de N unidades em série)
  if (espec.subtipo === 'microinversor' && espec.max_por_cabo_tronco) {
    const nMicros      = espec.max_por_cabo_tronco
    const iTotal       = +(imax * nMicros).toFixed(1)
    const iProjTronco  = +(iTotal * 1.1).toFixed(1)
    const dimTronco    = dimensionar(iProjTronco)
    if (dimTronco) result.tronco = { nMicros, iTotal, iProj: iProjTronco, ...dimTronco }
  }

  return result
}

// ── Componente de dimensionamento ─────────────────────────────────────────────

function DimensionamentoEletrico({ espec }) {
  const d = calcularDimensionamento(espec)
  if (!d) return null

  const Linha = ({ label, value, destaque }) => (
    <div className="flex justify-between text-xs py-0.5 border-b border-amber-100 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold ${destaque ? 'text-amber-800' : 'text-slate-800'}`}>{value}</span>
    </div>
  )

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-3">
      <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">
        Dimensionamento Elétrico CA — NBR 5410
      </p>

      {/* Saída do inversor / conexão ao QDC */}
      <div>
        <p className="text-[10px] font-semibold text-amber-600 uppercase mb-1">
          {espec.subtipo === 'microinversor' ? 'Conexão de cada microinversor' : 'Saída CA do inversor'}
        </p>
        <Linha label="Corrente de saída (Imax)"             value={`${d.imax} A`} />
        <Linha label="Corrente de projeto (Imax × 1,1)"    value={`${d.iProj} A`} />
        <Linha label="Cabo recomendado (cobre 70°C, B1)"    value={`${d.secao} mm²  —  cap. ${d.ampCabo} A`} destaque />
        <Linha label={`Disjuntor ${d.polos}`}               value={`${d.disjuntor} A`} destaque />
      </div>

      {/* Cabo tronco — só para micro-inversores */}
      {d.tronco && (
        <div>
          <p className="text-[10px] font-semibold text-amber-600 uppercase mb-1">
            Cabo tronco — máx. {d.tronco.nMicros} microinversores em série
          </p>
          <Linha label="Corrente total do ramal"                value={`${d.tronco.nMicros} × ${d.imax} A = ${d.tronco.iTotal} A`} />
          <Linha label="Corrente de projeto (× 1,1)"          value={`${d.tronco.iProj} A`} />
          <Linha label="Cabo tronco recomendado (cobre 70°C)"  value={`${d.tronco.secao} mm²  —  cap. ${d.tronco.ampCabo} A`} destaque />
          <Linha label={`Disjuntor do ramal ${d.polos}`}       value={`${d.tronco.disjuntor} A`} destaque />
        </div>
      )}

      <p className="text-[10px] text-amber-600 leading-tight">
        Referência: NBR 5410 — cabo cobre 70 °C, método B1 (eletroduto fixado em parede).
        Corrente de projeto = 1,1 × Imax (carga contínua).
      </p>
    </div>
  )
}

// Campos técnicos exibidos no card expandido — organizados para o unifilar
const SPECS_AC = [
  { key: 'potencia_kw',         label: 'Potência nominal CA',   unit: 'kW'  },
  { key: 'potencia_maxima_kw',  label: 'Potência máxima CA',    unit: 'kW'  },
  { key: 'potencia_aparente_kva',label:'Potência aparente',     unit: 'kVA' },
  { key: 'tensao_ac',           label: 'Tensão nominal da rede',unit: 'V'   },
  { key: 'faixa_tensao_rede',   label: 'Faixa tensão da rede',  unit: ''    },
  { key: 'fases',               label: 'Fases',                 unit: ''    },
  { key: 'tipo_conexao_rede',   label: 'Conexão com a rede',    unit: ''    },
  { key: 'frequencia_hz',       label: 'Frequência nominal',    unit: 'Hz'  },
  { key: 'faixa_frequencia_hz', label: 'Faixa de frequência',   unit: ''    },
  { key: 'corrente_ac_saida',   label: 'Corrente saída CA',     unit: 'A'   },
  { key: 'fator_potencia',      label: 'Fator de potência',     unit: ''    },
  { key: 'thdi',                label: 'THDi',                  unit: '%'   },
  { key: 'max_por_cabo_tronco', label: 'Máx. por cabo tronco',  unit: 'un.' },
]
const SPECS_DC = [
  { key: 'n_mppts',                label: 'Nº de MPPTs',               unit: ''  },
  { key: 'strings_por_mppt',       label: 'Strings por MPPT',          unit: ''  },
  { key: 'potencia_max_entrada_cc',label: 'Potência máx. entrada CC',  unit: ''  },
  { key: 'tensao_max_entrada',     label: 'Tensão máx. entrada DC',    unit: 'V' },
  { key: 'tensao_partida',         label: 'Tensão de partida',         unit: 'V' },
  { key: 'tensao_nominal_cc',      label: 'Tensão nominal CC',         unit: 'V' },
  { key: 'tensao_mppt_min',        label: 'Tensão MPPT mín.',          unit: 'V' },
  { key: 'tensao_mppt_max',        label: 'Tensão MPPT máx.',          unit: 'V' },
  { key: 'faixa_operacao_cc',      label: 'Faixa operação CC',         unit: ''  },
  { key: 'corrente_max_entrada',   label: 'Corrente máx. entrada DC',  unit: 'A' },
  { key: 'corrente_max_por_mppt',  label: 'Corrente máx. por MPPT',    unit: 'A' },
  { key: 'corrente_isc_max',       label: 'Isc máx. por entrada',      unit: 'A' },
]
const SPECS_EXTRA = [
  { key: 'eficiencia_maxima',       label: 'Eficiência máxima',     unit: '%'   },
  { key: 'eficiencia_europeia',     label: 'Eficiência europeia',   unit: '%'   },
  { key: 'eficiencia_cec',          label: 'Eficiência CEC',        unit: '%'   },
  { key: 'eficiencia_mppt',         label: 'Eficiência MPPT',       unit: '%'   },
  { key: 'grau_protecao_ip',        label: 'Grau de proteção IP',   unit: ''    },
  { key: 'protecao_sobretensao_dc', label: 'Prot. sobretensão DC',  unit: ''    },
  { key: 'protecao_sobretensao_ac', label: 'Prot. sobretensão CA',  unit: ''    },
  { key: 'temperatura_operacao',    label: 'Temperatura operação',  unit: ''    },
  { key: 'tipo_refrigeracao',       label: 'Refrigeração',          unit: ''    },
  { key: 'comunicacao',             label: 'Comunicação',           unit: ''    },
  { key: 'peso_kg',                 label: 'Peso',                  unit: 'kg'  },
  { key: 'dimensoes',               label: 'Dimensões',             unit: 'mm'  },
  { key: 'garantia_anos',           label: 'Garantia',              unit: 'anos'},
]

function SpecGroup({ titulo, specs, espec }) {
  const visiveis = specs.filter(s => espec?.[s.key] != null)
  if (!visiveis.length) return null
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{titulo}</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        {visiveis.map(s => (
          <div key={s.key} className="flex justify-between text-xs py-0.5 border-b border-slate-100">
            <span className="text-slate-500">{s.label}</span>
            <span className="font-semibold text-slate-800">{espec[s.key]}{s.unit && s.unit !== '' ? ` ${s.unit}` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Inversores() {
  const dropRef = useRef(null)
  const inputRef = useRef(null)

  const [inversores, setInversores]     = useState([])
  const [carregando, setCarregando]     = useState(true)
  const [busca, setBusca]               = useState('')
  const [ordenar, setOrdenar]           = useState('data')
  const [arrastando, setArrastando]     = useState(false)
  const [modalAberto, setModalAberto]   = useState(false)
  const [arquivosModal, setArquivosModal] = useState([])
  const [inversorEditar, setInversorEditar] = useState(null)
  const [expandido, setExpandido]       = useState(null)   // _id do card expandido

  useEffect(() => { carregarInversores() }, [busca, ordenar])

  async function carregarInversores() {
    try {
      setCarregando(true)
      const params = new URLSearchParams({ tipo: 'inversor', ativo: 'true',
        ...(busca && { search: busca }), ...(ordenar && { ordenar }) })
      const res  = await fetch(`${API_URL}/api/equipamentos?${params}`)
      const dados = await res.json()
      setInversores(dados.equipamentos || [])
    } catch (err) { console.error('Erro ao carregar inversores:', err) }
    finally { setCarregando(false) }
  }

  async function handleExcluir(id) {
    if (!confirm('Tem certeza que deseja excluir este inversor?')) return
    try {
      await fetch(`${API_URL}/api/equipamentos/${id}`, { method: 'DELETE' })
      carregarInversores()
    } catch (err) { console.error('Erro ao excluir:', err) }
  }

  function abrirComArquivos(files) {
    const pdfs = Array.from(files).filter(f => f.type === 'application/pdf')
    if (!pdfs.length) return
    setArquivosModal(pdfs)
    setInversorEditar(null)
    setModalAberto(true)
  }

  function handleEditar(inv) {
    setInversorEditar(inv)
    setArquivosModal([])
    setModalAberto(true)
  }

  function handleSalvar() {
    setModalAberto(false)
    setArquivosModal([])
    carregarInversores()
  }

  // Drag & drop na zona da página
  function onDragOver(e)  { e.preventDefault(); setArrastando(true)  }
  function onDragLeave(e) { e.preventDefault(); setArrastando(false) }
  function onDrop(e) {
    e.preventDefault(); setArrastando(false)
    abrirComArquivos(e.dataTransfer.files)
  }

  return (
    <div className="space-y-6">

      {/* Cabeçalho */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Inversores Solares</h1>
        <p className="text-slate-600 mt-1">Importe datasheets — Claude extrai todos os dados técnicos automaticamente</p>
      </div>

      {/* Zona de upload — sempre visível */}
      <div
        ref={dropRef}
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all select-none
          ${arrastando
            ? 'border-blue-500 bg-blue-50 scale-[1.01] shadow-lg'
            : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
      >
        <div className={`inline-flex p-5 rounded-2xl mb-4 transition-colors
          ${arrastando ? 'bg-blue-100' : 'bg-slate-100'}`}>
          <Upload size={36} className={arrastando ? 'text-blue-600' : 'text-slate-500'} />
        </div>
        <p className="text-lg font-semibold text-slate-700">
          {arrastando ? 'Solte os datasheets aqui' : 'Arraste os datasheets de inversores'}
        </p>
        <p className="text-sm text-slate-500 mt-1">
          ou clique para selecionar • PDF • um ou vários ao mesmo tempo
        </p>
        <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-400">
          <span className="flex items-center gap-1"><Zap size={12} className="text-blue-400" /> Huawei</span>
          <span className="flex items-center gap-1"><Zap size={12} className="text-blue-400" /> Fronius</span>
          <span className="flex items-center gap-1"><Zap size={12} className="text-blue-400" /> SMA</span>
          <span className="flex items-center gap-1"><Zap size={12} className="text-blue-400" /> Growatt</span>
          <span className="flex items-center gap-1"><Zap size={12} className="text-blue-400" /> Deye</span>
          <span className="flex items-center gap-1"><Zap size={12} className="text-blue-400" /> WEG</span>
          <span className="flex items-center gap-1"><Zap size={12} className="text-blue-400" /> e mais…</span>
        </div>
        <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden"
          onChange={e => { abrirComArquivos(e.target.files); e.target.value = '' }} />
      </div>

      {/* Filtros */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-3">
            <input type="text" placeholder="Buscar por fabricante ou modelo…"
              value={busca} onChange={e => setBusca(e.target.value)}
              className="flex-1 min-w-48 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <select value={ordenar} onChange={e => setOrdenar(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="data">Mais recentes</option>
              <option value="potencia">Maior potência</option>
              <option value="preco">Menor preço</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {/* Lista */}
      {carregando ? (
        <Card><CardBody><p className="text-center text-slate-500 py-4">Carregando…</p></CardBody></Card>
      ) : inversores.length === 0 ? (
        <Card><CardBody>
          <div className="text-center py-8 text-slate-400">
            <Zap size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum inversor cadastrado</p>
            <p className="text-sm mt-1">Arraste um datasheet acima para começar</p>
          </div>
        </CardBody></Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 font-medium">{inversores.length} inversor{inversores.length > 1 ? 'es' : ''} cadastrado{inversores.length > 1 ? 's' : ''}</p>
          {inversores.map(inv => {
            const espec = inv.especificacoes || {}
            const aberto = expandido === inv._id
            return (
              <Card key={inv._id} className="overflow-hidden">
                {/* Linha principal */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="p-2.5 bg-blue-50 rounded-xl shrink-0">
                    <Zap size={18} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-slate-900 truncate">{inv.fabricante} — {inv.modelo}</p>
                      {espec.subtipo && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0
                          ${espec.subtipo === 'microinversor' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {espec.subtipo === 'microinversor' ? 'Microinversor' : 'String'}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                      {espec.potencia_kw        && <span className="font-semibold text-slate-700">{espec.potencia_kw} kW</span>}
                      {espec.tensao_ac           && <span>{espec.tensao_ac}V CA</span>}
                      {espec.fases               && <span>{espec.fases === 1 ? 'Monofásico' : espec.fases === 3 ? 'Trifásico' : `${espec.fases}F`}</span>}
                      {espec.n_mppts             && <span>{espec.n_mppts} MPPT{espec.n_mppts > 1 ? 's' : ''}</span>}
                      {espec.tensao_max_entrada  && <span>Vmax {espec.tensao_max_entrada}V CC</span>}
                      {espec.eficiencia_maxima   && <span>η {espec.eficiencia_maxima}%</span>}
                      {espec.grau_protecao_ip    && <span>{espec.grau_protecao_ip}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setExpandido(aberto ? null : inv._id)}
                      className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                      title={aberto ? 'Recolher' : 'Ver todos os dados'}>
                      {aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button onClick={() => handleEditar(inv)}
                      className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleExcluir(inv._id)}
                      className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Painel expandido — todos os dados técnicos */}
                {aberto && (
                  <div className="border-t border-slate-100 px-5 py-4 bg-slate-50 space-y-5">
                    <SpecGroup titulo="Saída CA" specs={SPECS_AC} espec={espec} />
                    <SpecGroup titulo="Entrada CC / MPPT" specs={SPECS_DC} espec={espec} />
                    <SpecGroup titulo="Desempenho e instalação" specs={SPECS_EXTRA} espec={espec} />
                    <DimensionamentoEletrico espec={espec} />
                    {Object.keys(espec).length === 0 && (
                      <p className="text-xs text-slate-400 text-center">Nenhum dado técnico registrado</p>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal batch */}
      {modalAberto && !inversorEditar && (
        <ModalNovoInversor
          arquivosIniciais={arquivosModal}
          onClose={() => { setModalAberto(false); setArquivosModal([]) }}
          onSalvar={handleSalvar}
        />
      )}

      {/* Modal edição manual simples */}
      {modalAberto && inversorEditar && (
        <EdicaoInversor
          inversor={inversorEditar}
          onClose={() => setModalAberto(false)}
          onSalvar={handleSalvar}
        />
      )}
    </div>
  )
}

// ── Modal de edição simplificado ─────────────────────────────────────────────

function EdicaoInversor({ inversor, onClose, onSalvar }) {
  const [form, setForm] = useState({ ...inversor })
  const [salvando, setSalvando] = useState(false)

  function setEspec(key, val) {
    setForm(f => ({ ...f, especificacoes: { ...f.especificacoes, [key]: val === '' ? undefined : val } }))
  }

  async function salvar() {
    if (!form.fabricante || !form.modelo) return alert('Preencha fabricante e modelo')
    setSalvando(true)
    try {
      const res = await fetch(`${API_URL}/api/equipamentos/${inversor._id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      if (res.ok) onSalvar()
      else alert('Erro ao salvar')
    } catch { alert('Erro ao salvar') }
    finally { setSalvando(false) }
  }

  const espec = form.especificacoes || {}
  const inp = (placeholder, key, type = 'text', isEspec = false) => (
    <input type={type} placeholder={placeholder}
      value={isEspec ? (espec[key] ?? '') : (form[key] ?? '')}
      onChange={e => isEspec ? setEspec(key, type === 'number' ? parseFloat(e.target.value) || '' : e.target.value) : setForm(f => ({ ...f, [key]: e.target.value }))}
      className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full" />
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b shrink-0">
          <h2 className="font-bold text-slate-900">Editar Inversor</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {inp('Fabricante', 'fabricante')}
            {inp('Modelo', 'modelo')}
            {inp('Potência nominal AC (kW)', 'potencia_kw', 'number', true)}
            {inp('Potência máxima AC (kW)', 'potencia_maxima_kw', 'number', true)}
            {inp('Tensão AC (V)', 'tensao_ac', 'number', true)}
            {inp('Fases (1 ou 3)', 'fases', 'number', true)}
            {inp('Frequência (Hz)', 'frequencia_hz', 'number', true)}
            {inp('Corrente AC saída (A)', 'corrente_ac_saida', 'number', true)}
            {inp('Nº de MPPTs', 'n_mppts', 'number', true)}
            {inp('Entradas por MPPT', 'strings_por_mppt', 'number', true)}
            {inp('Tensão MPPT mín. (V)', 'tensao_mppt_min', 'number', true)}
            {inp('Tensão MPPT máx. (V)', 'tensao_mppt_max', 'number', true)}
            {inp('Tensão máx. entrada DC (V)', 'tensao_max_entrada', 'number', true)}
            {inp('Corrente máx. por MPPT (A)', 'corrente_max_por_mppt', 'number', true)}
            {inp('Isc máx. entrada (A)', 'corrente_isc_max', 'number', true)}
            {inp('Eficiência máxima (%)', 'eficiencia_maxima', 'number', true)}
            {inp('Grau proteção IP', 'grau_protecao_ip', 'text', true)}
            {inp('Peso (kg)', 'peso_kg', 'number', true)}
          </div>
          {inp('Dimensões (H×L×P mm)', 'dimensoes', 'text', true)}
          {inp('Temperatura de operação', 'temperatura_operacao', 'text', true)}
        </div>
        <div className="p-5 border-t flex justify-end gap-3 shrink-0">
          <Button onClick={onClose} variante="secundario">Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      </Card>
    </div>
  )
}

