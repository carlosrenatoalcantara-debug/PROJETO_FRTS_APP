import { useState, useEffect, useRef } from 'react'
import { X, Edit2, Trash2, Upload, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import ModalNovoCarregadorEV from '../components/equipamentos/ModalNovoCarregadorEV'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway. Não usar VITE_API_URL */

// P0-EV-CATALOG-ENGINEERING-VIEW-01: VIEW DE ENGENHARIA.
// Blocos de engenharia; chaves alinhadas ao doc derivado (carregadorEquipamentoView,
// que espelha CarregadorEV sem perda). TODOS os campos são exibidos; vazio → "Não informado".
// Nunca ocultar, nunca concatenar, nunca inferir.

// Formatadores de exibição (apresentação fiel do valor armazenado — NÃO inferência).
const ROTULO_TIPO = { AC_Mono: 'AC — Monofásico', AC_Tri: 'AC — Trifásico', DC: 'DC' }
const ROTULO_FASES = { 1: 'Monofásico', 2: 'Bifásico', 3: 'Trifásico' }
const NAO_INFO = 'Não informado'

function fmtValor(campo, raw) {
  if (raw === null || raw === undefined || raw === '') return NAO_INFO
  if (campo.bool) return raw === true ? 'Sim' : raw === false ? 'Não' : NAO_INFO
  if (campo.key === 'tipo_carregador') return ROTULO_TIPO[raw] || String(raw)
  if (campo.key === 'numero_fases') {
    const lbl = ROTULO_FASES[raw]
    return lbl ? `${raw} (${lbl})` : String(raw)
  }
  return `${raw}${campo.unit ? ` ${campo.unit}` : ''}`
}

// Resolve o valor de um campo: especificacoes por padrão; `fonte:'raiz'` lê do doc.
function valorCampo(car, espec, campo) {
  if (campo.get) return campo.get(car, espec)
  if (campo.fonte === 'raiz') return car?.[campo.key]
  return espec?.[campo.key]
}

const BLOCOS_ENGENHARIA = [
  { titulo: 'Identificação', campos: [
    { key: 'fabricante', label: 'Fabricante', fonte: 'raiz' },
    { key: 'modelo',     label: 'Modelo',     fonte: 'raiz' },
    { key: 'tipo_carregador', label: 'Tipo' },
  ]},
  // P2-EV-CATALOG-SIMPLIFICATION-01: catálogo = só características intrínsecas.
  // Frequência e fator de potência saíram (são engenharia/cálculo, não do catálogo).
  { titulo: 'Entrada Elétrica', campos: [
    { key: 'potencia_kw',       label: 'Potência nominal',  unit: 'kW' },
    { key: 'tensao_entrada_v',  label: 'Tensão de entrada', unit: 'V'  },
    { key: 'corrente_entrada_a',label: 'Corrente de entrada', unit: 'A' },
    { key: 'numero_fases',      label: 'Número de fases' },
  ]},
  // Bloco "Saída" só faz sentido para carregadores DC — renderizado condicionalmente.
  { titulo: 'Saída (DC)', dcOnly: true, campos: [
    { key: 'tensao_saida_dc_v',    label: 'Tensão de saída DC',   unit: 'V'   },
    { key: 'corrente_saida_dc_a',  label: 'Corrente de saída DC', unit: 'A'   },
    { key: 'tempo_carga_rapida_min', label: 'Tempo de carga rápida', unit: 'min' },
    { key: 'eficiencia_pct',       label: 'Eficiência',           unit: '%'   },
  ]},
  { titulo: 'Conectores', campos: [
    { key: 'tipo_conector',  label: 'Tipo de conector' },
    { key: 'qtd_conectores', label: 'Quantidade de conectores' },
  ]},
  { titulo: 'Comunicação', campos: [
    { key: 'comunicacao', label: 'Comunicação' },
  ]},
  { titulo: 'Protocolos', campos: [
    { key: 'protocolo_carregamento', label: 'Protocolo de carregamento' },
    { key: 'tipo_carregamento',      label: 'Tipo de carregamento' },
  ]},
  { titulo: 'Controle', campos: [
    { key: 'ocpp', label: 'OCPP', bool: true },
  ]},
  // P2-EV-CATALOG-SIMPLIFICATION-01: bloco "Proteções" (disjuntor/DR/bitola) REMOVIDO —
  // são resultados de cálculo da Engenharia (SSOT), não características do equipamento.
  { titulo: 'Mecânica', campos: [
    { key: 'peso_kg',      label: 'Peso',      unit: 'kg' },
    { key: 'dimensoes_mm', label: 'Dimensões', unit: 'mm' },
  ]},
  { titulo: 'Ambiental', campos: [
    { key: 'grau_protecao_ip',     label: 'Grau de proteção IP' },
    { key: 'temperatura_operacao', label: 'Temperatura de operação' },
  ]},
  { titulo: 'Certificações', campos: [
    { key: 'certificacoes', label: 'Certificações' },
  ]},
  { titulo: 'Garantia', campos: [
    { key: 'garantia', label: 'Garantia', get: (car) => car?.garantia_produto?.value
        ? `${car.garantia_produto.value} ${car.garantia_produto.unit || 'anos'}` : null },
  ]},
]

function BlocoEngenharia({ titulo, campos, car, espec }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{titulo}</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        {campos.map(c => {
          const raw = valorCampo(car, espec, c)
          const vazio = raw === null || raw === undefined || raw === ''
          return (
            <div key={c.key} className="flex justify-between text-xs py-0.5 border-b border-slate-100">
              <span className="text-slate-500">{c.label}</span>
              <span className={vazio ? 'italic text-slate-400' : 'font-semibold text-slate-800'}>
                {fmtValor(c, raw)}
              </span>
            </div>
          )
        })}
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
                      {espec.tensao_entrada_v      && <span>{espec.tensao_entrada_v}V entrada</span>}
                      {espec.numero_fases          && <span>{ROTULO_FASES[espec.numero_fases] || `${espec.numero_fases}F`}</span>}
                      {espec.tipo_conector         && <span>{espec.tipo_conector}</span>}
                      {espec.qtd_conectores        && <span>{espec.qtd_conectores} conector(es)</span>}
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
                    {BLOCOS_ENGENHARIA
                      // Bloco DC só aparece para carregadores DC (Req: campos DC ocultos no AC)
                      .filter(b => !b.dcOnly || (car.tipo_carregador || car.tipo) === 'DC')
                      .map(b => (
                        <BlocoEngenharia key={b.titulo} titulo={b.titulo} campos={b.campos} car={car} espec={espec} />
                      ))}
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
      // BUG-009: catálogo EV é fonte única em CarregadorEV. Grava no endpoint certo
      // com o SHAPE PLANO do modelo CarregadorEV (marca + campos das especificações).
      const ehEV = carregador._origem === 'CarregadorEV'
      const espec = form.especificacoes || {}
      // Descarta chaves derivadas da view que NÃO são campos do modelo CarregadorEV.
      const { tipo_carregador, carregadorEV_id, potencia_maxima, ...camposModelo } = espec
      const url = ehEV
        ? `${API_URL}/api/carregadores-ev/${carregador._id}`
        : `${API_URL}/api/equipamentos/${carregador._id}`
      const body = ehEV
        ? { marca: form.fabricante, modelo: form.modelo, ...camposModelo }
        : form
      const res = await fetch(url, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (res.ok) { onSalvar(); return }
      // Mostra o ERRO REAL retornado pela API (nunca só "Erro ao salvar").
      const data = await res.json().catch(() => ({}))
      alert(data?.erro || `Erro ao salvar (HTTP ${res.status})`)
    } catch (e) {
      alert(`Falha de conexão ao salvar: ${e.message}`)
    } finally { setSalvando(false) }
  }

  const espec = form.especificacoes || {}
  // Campos de saída DC só para carregadores DC. O tipo (AC_Mono/AC_Tri/DC) vem da
  // view em especificacoes.tipo_carregador (= CarregadorEV.tipo).
  const ehDC = (espec.tipo_carregador || form.tipo) === 'DC'
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
            {inp('Tensão entrada (V)', 'tensao_entrada_v', 'number', true)}
            {inp('Corrente entrada máxima (A)', 'corrente_entrada_a', 'number', true)}
            {inp('Número de fases (1 ou 3)', 'numero_fases', 'number', true)}
            {inp('Tipo conector', 'tipo_conector', 'text', true)}
            {inp('Protocolo carregamento', 'protocolo_carregamento', 'text', true)}
            {inp('Tipo carregamento', 'tipo_carregamento', 'text', true)}
            {ehDC && inp('Tensão saída DC (V)', 'tensao_saida_dc_v', 'number', true)}
            {ehDC && inp('Corrente saída DC (A)', 'corrente_saida_dc_a', 'number', true)}
            {ehDC && inp('Tempo carga rápida (min)', 'tempo_carga_rapida_min', 'number', true)}
            {ehDC && inp('Eficiência (%)', 'eficiencia_pct', 'number', true)}
            {inp('Grau proteção IP', 'grau_protecao_ip', 'text', true)}
            {inp('Peso (kg)', 'peso_kg', 'number', true)}
          </div>
          {inp('Dimensões (H×L×P mm)', 'dimensoes_mm', 'text', true)}
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
