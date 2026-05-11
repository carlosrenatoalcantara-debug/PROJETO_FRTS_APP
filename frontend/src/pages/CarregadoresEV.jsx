import { useState, useEffect, useRef } from 'react'
import { X, Edit2, Trash2, Upload, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import ModalNovoCarregadorEV from '../components/equipamentos/ModalNovoCarregadorEV'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// Campos técnicos exibidos no card expandido
const SPECS_POTENCIA = [
  { key: 'potencia_kw',      label: 'Potência nominal',     unit: 'kW'  },
  { key: 'potencia_maxima',  label: 'Potência máxima',      unit: 'kW'  },
]

const SPECS_ENTRADA = [
  { key: 'tensao_entrada',    label: 'Tensão entrada',       unit: 'V'   },
  { key: 'corrente_entrada',  label: 'Corrente entrada',     unit: 'A'   },
  { key: 'potencia_entrada',  label: 'Potência entrada',     unit: 'kW'  },
  { key: 'numero_fases',      label: 'Fases',                unit: ''    },
  { key: 'frequencia_hz',     label: 'Frequência nominal',   unit: 'Hz'  },
]

const SPECS_SAIDA = [
  { key: 'tensao_saida_dc',    label: 'Tensão saída DC',      unit: 'V'   },
  { key: 'corrente_saida_dc',  label: 'Corrente saída DC',    unit: 'A'   },
  { key: 'potencia_saida_dc',  label: 'Potência saída DC',    unit: 'kW'  },
  { key: 'tipo_conector_saida',label: 'Tipo conector saída',  unit: ''    },
]

const SPECS_PROTOCOLOS = [
  { key: 'protocolo_carregamento', label: 'Protocolo carregamento', unit: ''    },
  { key: 'tipo_carregamento',      label: 'Tipo carregamento',      unit: ''    },
  { key: 'tempo_carga_rapida',     label: 'Tempo carga rápida',     unit: 'min' },
  { key: 'comunicacao',            label: 'Comunicação',            unit: ''    },
]

const SPECS_EXTRAS = [
  { key: 'eficiencia',              label: 'Eficiência',                unit: '%'   },
  { key: 'fator_potencia',          label: 'Fator de potência',         unit: ''    },
  { key: 'grau_protecao_ip',        label: 'Grau proteção IP',          unit: ''    },
  { key: 'temperatura_operacao',    label: 'Temperatura operação',      unit: ''    },
  { key: 'peso_kg',                 label: 'Peso',                      unit: 'kg'  },
  { key: 'dimensoes',               label: 'Dimensões',                 unit: 'mm'  },
  { key: 'garantia_anos',           label: 'Garantia',                  unit: 'anos'},
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

export default function CarregadoresEV() {
  const dropRef = useRef(null)
  const inputRef = useRef(null)

  const [carregadores, setCarregadores]         = useState([])
  const [carregando, setCarregando]             = useState(true)
  const [busca, setBusca]                       = useState('')
  const [ordenar, setOrdenar]                   = useState('data')
  const [arrastando, setArrastando]             = useState(false)
  const [modalAberto, setModalAberto]           = useState(false)
  const [arquivosModal, setArquivosModal]       = useState([])
  const [carregadorEditar, setCarregadorEditar] = useState(null)
  const [expandido, setExpandido]               = useState(null)
  const [modoManual, setModoManual]             = useState(false)

  useEffect(() => { carregarCarregadores() }, [busca, ordenar])

  async function carregarCarregadores() {
    try {
      setCarregando(true)
      const params = new URLSearchParams({ tipo: 'carregador-ev', ativo: 'true',
        ...(busca && { search: busca }), ...(ordenar && { ordenar }) })
      const res  = await fetch(`${API_URL}/api/equipamentos?${params}`)
      const dados = await res.json()
      setCarregadores(dados.equipamentos || [])
    } catch (err) { console.error('Erro ao carregar carregadores:', err) }
    finally { setCarregando(false) }
  }

  async function handleExcluir(id) {
    if (!confirm('Tem certeza que deseja excluir este carregador?')) return
    try {
      await fetch(`${API_URL}/api/equipamentos/${id}`, { method: 'DELETE' })
      carregarCarregadores()
    } catch (err) { console.error('Erro ao excluir:', err) }
  }

  function abrirComArquivos(files) {
    const pdfs = Array.from(files).filter(f => f.type === 'application/pdf')
    if (!pdfs.length) return
    setArquivosModal(pdfs)
    setCarregadorEditar(null)
    setModalAberto(true)
  }

  function handleEditar(car) {
    setCarregadorEditar(car)
    setArquivosModal([])
    setModalAberto(true)
  }

  function handleSalvar() {
    setModalAberto(false)
    setArquivosModal([])
    carregarCarregadores()
  }

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
        <h1 className="text-3xl font-bold text-slate-900">Carregadores EV</h1>
        <p className="text-slate-600 mt-1">Importe datasheets — Claude extrai todos os dados técnicos automaticamente</p>
      </div>

      {/* Abas: Upload ou Manual */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setModoManual(false)}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            !modoManual
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          📄 Upload Datasheet
        </button>
        <button
          onClick={() => setModoManual(true)}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            modoManual
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          ✏️ Cadastro Manual
        </button>
      </div>

      {/* Zona de upload */}
      {!modoManual && (
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
          {arrastando ? 'Solte os datasheets aqui' : 'Arraste os datasheets de carregadores'}
        </p>
        <p className="text-sm text-slate-500 mt-1">
          ou clique para selecionar • PDF • um ou vários ao mesmo tempo
        </p>
        <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-400">
          <span className="flex items-center gap-1"><Zap size={12} className="text-blue-400" /> Wall Box</span>
          <span className="flex items-center gap-1"><Zap size={12} className="text-blue-400" /> Tesla</span>
          <span className="flex items-center gap-1"><Zap size={12} className="text-blue-400" /> Siemens</span>
          <span className="flex items-center gap-1"><Zap size={12} className="text-blue-400" /> ABB</span>
          <span className="flex items-center gap-1"><Zap size={12} className="text-blue-400" /> Schneider</span>
          <span className="flex items-center gap-1"><Zap size={12} className="text-blue-400" /> e mais…</span>
        </div>
        <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden"
          onChange={e => { abrirComArquivos(e.target.files); e.target.value = '' }} />
      </div>
      )}

      {/* Cadastro Manual */}
      {modoManual && (
        <Card>
          <CardHeader>Cadastro Manual de Carregador EV</CardHeader>
          <CardBody>
            <button
              onClick={() => {
                setCarregadorEditar({
                  fabricante: '',
                  modelo: '',
                  tipo: 'AC_Tri',
                  especificacoes: {}
                })
                setModoManual(false)
                setModalAberto(true)
              }}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all"
            >
              ➕ Novo Carregador EV
            </button>
            <p className="text-sm text-slate-500 mt-3 text-center">
              Preencha os dados do carregador no formulário que será aberto
            </p>
          </CardBody>
        </Card>
      )}

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
      ) : carregadores.length === 0 ? (
        <Card><CardBody>
          <div className="text-center py-8 text-slate-400">
            <Zap size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum carregador cadastrado</p>
            <p className="text-sm mt-1">Arraste um datasheet acima para começar</p>
          </div>
        </CardBody></Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 font-medium">{carregadores.length} carregador{carregadores.length > 1 ? 'es' : ''} cadastrado{carregadores.length > 1 ? 's' : ''}</p>
          {carregadores.map(car => {
            const espec = car.especificacoes || {}
            const aberto = expandido === car._id
            return (
              <Card key={car._id} className="overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="p-2.5 bg-blue-50 rounded-xl shrink-0">
                    <Zap size={18} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">{car.fabricante} — {car.modelo}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                      {espec.potencia_kw           && <span className="font-semibold text-slate-700">{espec.potencia_kw} kW</span>}
                      {espec.tensao_entrada        && <span>{espec.tensao_entrada}V entrada</span>}
                      {espec.numero_fases          && <span>{espec.numero_fases === 1 ? 'Monofásico' : espec.numero_fases === 3 ? 'Trifásico' : `${espec.numero_fases}F`}</span>}
                      {espec.tipo_conector_saida   && <span>{espec.tipo_conector_saida}</span>}
                      {espec.eficiencia            && <span>η {espec.eficiencia}%</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setExpandido(aberto ? null : car._id)}
                      className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                      title={aberto ? 'Recolher' : 'Ver todos os dados'}>
                      {aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button onClick={() => handleEditar(car)}
                      className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleExcluir(car._id)}
                      className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {aberto && (
                  <div className="border-t border-slate-100 px-5 py-4 bg-slate-50 space-y-5">
                    <SpecGroup titulo="Potência" specs={SPECS_POTENCIA} espec={espec} />
                    <SpecGroup titulo="Entrada AC" specs={SPECS_ENTRADA} espec={espec} />
                    <SpecGroup titulo="Saída DC" specs={SPECS_SAIDA} espec={espec} />
                    <SpecGroup titulo="Protocolos e Carregamento" specs={SPECS_PROTOCOLOS} espec={espec} />
                    <SpecGroup titulo="Performance e Instalação" specs={SPECS_EXTRAS} espec={espec} />
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

      {modalAberto && !carregadorEditar && (
        <ModalNovoCarregadorEV
          arquivosIniciais={arquivosModal}
          onClose={() => { setModalAberto(false); setArquivosModal([]) }}
          onSalvar={handleSalvar}
        />
      )}

      {modalAberto && carregadorEditar && (
        <EdicaoCarregador
          carregador={carregadorEditar}
          onClose={() => setModalAberto(false)}
          onSalvar={handleSalvar}
        />
      )}
    </div>
  )
}

function EdicaoCarregador({ carregador, onClose, onSalvar }) {
  const [form, setForm] = useState({ ...carregador })
  const [salvando, setSalvando] = useState(false)

  function setEspec(key, val) {
    setForm(f => ({ ...f, especificacoes: { ...f.especificacoes, [key]: val === '' ? undefined : val } }))
  }

  async function salvar() {
    if (!form.fabricante || !form.modelo) return alert('Preencha fabricante e modelo')
    setSalvando(true)
    try {
      const res = await fetch(`${API_URL}/api/equipamentos/${carregador._id}`, {
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
          <h2 className="font-bold text-slate-900">Editar Carregador EV</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {inp('Fabricante', 'fabricante')}
            {inp('Modelo', 'modelo')}
            {inp('Potência nominal (kW)', 'potencia_kw', 'number', true)}
            {inp('Potência máxima (kW)', 'potencia_maxima', 'number', true)}
            {inp('Tensão entrada (V)', 'tensao_entrada', 'number', true)}
            {inp('Corrente entrada máxima (A)', 'corrente_entrada', 'number', true)}
            {inp('Número de fases (1 ou 3)', 'numero_fases', 'number', true)}
            {inp('Frequência (Hz)', 'frequencia_hz', 'number', true)}
            {inp('Tensão saída DC (V)', 'tensao_saida_dc', 'number', true)}
            {inp('Corrente saída DC (A)', 'corrente_saida_dc', 'number', true)}
            {inp('Tipo conector saída', 'tipo_conector_saida', 'text', true)}
            {inp('Protocolo carregamento', 'protocolo_carregamento', 'text', true)}
            {inp('Tipo carregamento', 'tipo_carregamento', 'text', true)}
            {inp('Tempo carga rápida (min)', 'tempo_carga_rapida', 'number', true)}
            {inp('Eficiência (%)', 'eficiencia', 'number', true)}
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
