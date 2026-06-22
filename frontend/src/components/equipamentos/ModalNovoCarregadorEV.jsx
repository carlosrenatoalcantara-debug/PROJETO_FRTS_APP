import { useState, useRef } from 'react'
import { X, Upload, CheckCircle, AlertCircle, Loader, FileText, Zap, PenLine, ChevronDown, ChevronUp } from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway */

// P1-EV-CADASTRO-SIMPLIFICADO-01 — opções do cadastro mínimo
const TENSOES = [127, 220, 380]
const FASES = [{ id: 1, label: 'Monofásico' }, { id: 2, label: 'Bifásico' }, { id: 3, label: 'Trifásico' }]
const PLUGS = ['Tipo 1', 'Tipo 2', 'CCS2', 'GB/T', 'NACS']
// Plug → tipo de carregamento (CCS2/GB-T = DC; demais = AC)
function tipoCarregadorDe(plug, fases) {
  if (plug === 'CCS2' || plug === 'GB/T') return 'DC'
  return Number(fases) === 3 ? 'AC_Tri' : 'AC_Mono'
}

// ── Status helpers ────────────────────────────────────────────────────────────

function statusIcon(item) {
  const s = typeof item === 'string' ? item : item?.status
  if (s === 'pendente')    return <FileText size={16} className="text-slate-400" />
  if (s === 'processando') return <Loader size={16} className="text-blue-500 animate-spin" />
  if (s === 'salvo')       return item?.aviso
    ? <AlertCircle size={16} className="text-amber-500" />
    : <CheckCircle size={16} className="text-emerald-500" />
  if (s === 'erro')        return <AlertCircle size={16} className="text-red-500" />
  return null
}

function statusLabel(item) {
  if (item.status === 'pendente')    return <span className="text-xs text-slate-400">Aguardando…</span>
  if (item.status === 'processando') return <span className="text-xs text-blue-600">Lendo datasheet…</span>
  if (item.status === 'salvo') {
    const acao = item.atualizado ? 'atualizado' : 'cadastrado'
    return (
      <span className={`text-xs ${item.aviso ? 'text-amber-600' : 'text-emerald-700'}`}>
        Carregador EV {acao}{item.aviso ? ' ⚠ verifique os dados' : ''}
      </span>
    )
  }
  if (item.status === 'erro') return <span className="text-xs text-red-600 truncate">{item.erro}</span>
  return null
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ModalNovoCarregadorEV({ arquivosIniciais = [], onClose, onSalvar }) {
  const inputRef  = useRef(null)
  const [modo, setModo]             = useState('datasheet')   // 'datasheet' | 'manual'
  const [fila, setFila]             = useState(() => arquivosIniciais.map(criarItem))
  const [arrastando, setArrastando] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [concluido, setConcluido]   = useState(false)

  // ── P1-EV-CADASTRO-SIMPLIFICADO-01: cadastro manual (sem PDF) ──────────────
  const [form, setForm] = useState({
    marca: '', modelo: '', potencia_kw: '', tensao_entrada_v: 220, numero_fases: 3,
    tipo_conector: 'Tipo 2', qtd_conectores: 1, ocpp: true, grau_protecao_ip: '',
  })
  const [avancado, setAvancado] = useState(false)
  const [salvandoManual, setSalvandoManual] = useState(false)
  const [erroManual, setErroManual] = useState('')
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function salvarManual() {
    setErroManual('')
    if (!form.marca?.trim() || !form.modelo?.trim() || !form.potencia_kw) {
      setErroManual('Preencha fabricante, modelo e potência.')
      return
    }
    setSalvandoManual(true)
    try {
      const tipo = tipoCarregadorDe(form.tipo_conector, form.numero_fases)
      const body = {
        marca: form.marca.trim(), modelo: form.modelo.trim(),
        potencia_kw: Number(form.potencia_kw),
        tipo,
        tensao_entrada_v: Number(form.tensao_entrada_v),
        numero_fases: Number(form.numero_fases),
        tipo_conector: form.tipo_conector,
        qtd_conectores: Number(form.qtd_conectores) || 1,
        ocpp: !!form.ocpp,
        comunicacao: form.ocpp ? 'OCPP' : null,
        ...(form.grau_protecao_ip ? { grau_protecao_ip: form.grau_protecao_ip } : {}),
        // Dados avançados (opcionais)
        ...(form.corrente_entrada_a ? { corrente_entrada_a: Number(form.corrente_entrada_a) } : {}),
        ...(form.peso_kg ? { peso_kg: Number(form.peso_kg) } : {}),
        ...(form.dimensoes_mm ? { dimensoes_mm: form.dimensoes_mm } : {}),
        ...(form.temperatura_operacao ? { temperatura_operacao: form.temperatura_operacao } : {}),
        ...(form.garantia_anos ? { garantia_anos: Number(form.garantia_anos) } : {}),
        ativo: true,
      }
      const res = await fetch(`${API_URL}/api/carregadores-ev`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.erro || `HTTP ${res.status}`) }
      onSalvar?.()
      onClose?.()
    } catch (err) {
      setErroManual(err.message || 'Erro ao salvar carregador')
    } finally {
      setSalvandoManual(false)
    }
  }

  function criarItem(file) {
    return { id: `${file.name}-${Date.now()}-${Math.random()}`, file, nome: file.name,
      status: 'pendente', dados: null, aviso: null, duplicata: false, erro: null }
  }

  function atualizarItem(id, patch) {
    setFila(f => f.map(i => i.id === id ? { ...i, ...patch } : i))
  }

  function adicionarArquivos(files) {
    const novos = Array.from(files)
      .filter(f => f.type === 'application/pdf')
      .map(criarItem)
    setFila(f => [...f, ...novos])
    setConcluido(false)
  }

  // ── Processa um PDF e salva o carregador EV ────────────────────────────────

  async function processarItem(item) {
    atualizarItem(item.id, { status: 'processando' })
    try {
      // Ler arquivo PDF como base64 (usando FileReader nativo do navegador)
      const pdfBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const base64 = reader.result.split(',')[1] // Remove o "data:application/pdf;base64," do início
          resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(item.file)
      })

      // Chamar nova rota de extração EV (Claude Vision)
      const res = await fetch(`${API_URL}/api/carregadores-ev/upload-datasheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64 }),
      })

      const json = await res.json()

      if (!res.ok) {
        // Erro na extração, mostrar avisos
        atualizarItem(item.id, {
          status: 'salvo',
          dados: json.carregador,
          aviso: json.avisos?.join('; ') || json.erro || 'Falha ao extrair dados',
        })
        return
      }

      // Sucesso! Carregador já foi salvo no backend
      atualizarItem(item.id, {
        status: 'salvo',
        dados: json.carregador,
        aviso: json.avisos?.length > 0 ? json.avisos.join('; ') : null,
      })

    } catch (err) {
      console.error('Erro ao processar:', item.nome, err)
      atualizarItem(item.id, {
        status: 'erro',
        erro: err.message || 'Erro ao ler o arquivo PDF',
      })
    }
  }

  async function processarFila() {
    setProcessando(true)
    setConcluido(false)
    const pendentes = fila.filter(i => i.status === 'pendente' || i.status === 'erro')
    for (const item of pendentes) await processarItem(item)
    setProcessando(false)
    setConcluido(true)
    onSalvar()
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────────

  function onDragOver(e)  { e.preventDefault(); setArrastando(true)  }
  function onDragLeave(e) { e.preventDefault(); setArrastando(false) }
  function onDrop(e) {
    e.preventDefault(); setArrastando(false)
    adicionarArquivos(e.dataTransfer.files)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const totalPendente  = fila.filter(i => i.status === 'pendente').length
  const totalSalvos    = fila.filter(i => i.status === 'salvo' && !i.duplicata).length
  const totalErros     = fila.filter(i => i.status === 'erro').length
  const totalIgnorados = fila.filter(i => i.duplicata).length
  const avisos         = [...new Set(fila.filter(i => i.aviso).map(i => i.aviso))]
  const temAvisoIA     = avisos.length > 0
  const podeProcesar   = !processando && totalPendente > 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Zap size={20} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Importar Carregadores EV</h2>
              <p className="text-xs text-slate-500">Claude extrai todos os dados para o unifilar</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Abas: Importar Datasheet | Preencher Manualmente */}
          <div className="flex gap-2">
            <Button onClick={() => setModo('datasheet')} variante={modo === 'datasheet' ? 'primario' : 'secundario'} className="flex items-center gap-2">
              <Upload size={15} /> Importar Datasheet
            </Button>
            <Button onClick={() => setModo('manual')} variante={modo === 'manual' ? 'primario' : 'secundario'} className="flex items-center gap-2">
              <PenLine size={15} /> Preencher Manualmente
            </Button>
          </div>

          {/* ── MODO MANUAL (sem PDF) ── */}
          {modo === 'manual' && (
            <div className="space-y-4">
              {erroManual && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erroManual}</div>}
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Fabricante *"><input value={form.marca} onChange={e => setF('marca', e.target.value)} placeholder="Ex: WEG" className={inp} /></Campo>
                <Campo label="Modelo *"><input value={form.modelo} onChange={e => setF('modelo', e.target.value)} placeholder="Ex: WEMOB Wall" className={inp} /></Campo>
                <Campo label="Potência (kW) *"><input type="number" step="0.1" value={form.potencia_kw} onChange={e => setF('potencia_kw', e.target.value)} placeholder="7.4" className={inp} /></Campo>
                <Campo label="Tensão (V)">
                  <select value={form.tensao_entrada_v} onChange={e => setF('tensao_entrada_v', Number(e.target.value))} className={inp + ' bg-white'}>
                    {TENSOES.map(t => <option key={t} value={t}>{t}V</option>)}
                  </select>
                </Campo>
                <Campo label="Fases">
                  <select value={form.numero_fases} onChange={e => setF('numero_fases', Number(e.target.value))} className={inp + ' bg-white'}>
                    {FASES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </Campo>
                <Campo label="Tipo de plug">
                  <select value={form.tipo_conector} onChange={e => setF('tipo_conector', e.target.value)} className={inp + ' bg-white'}>
                    {PLUGS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Campo>
                <Campo label="Qtd. conectores"><input type="number" min="1" value={form.qtd_conectores} onChange={e => setF('qtd_conectores', e.target.value)} className={inp} /></Campo>
                <Campo label="IP (opcional)"><input value={form.grau_protecao_ip} onChange={e => setF('grau_protecao_ip', e.target.value)} placeholder="IP54" className={inp} /></Campo>
                <label className="flex items-center gap-2 text-sm text-slate-700 col-span-2">
                  <input type="checkbox" checked={form.ocpp} onChange={e => setF('ocpp', e.target.checked)} className="accent-blue-600" /> OCPP (comunicação)
                </label>
              </div>

              {/* Dados Avançados (colapsado) */}
              <div className="border border-slate-200 rounded-lg">
                <button type="button" onClick={() => setAvancado(v => !v)} className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  Dados Avançados (opcional — não afeta dimensionamento)
                  {avancado ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
                {avancado && (
                  <div className="grid grid-cols-2 gap-3 p-3 border-t border-slate-100">
                    <Campo label="Corrente nominal (A)"><input type="number" value={form.corrente_entrada_a || ''} onChange={e => setF('corrente_entrada_a', e.target.value)} className={inp} /></Campo>
                    <Campo label="Peso (kg)"><input type="number" value={form.peso_kg || ''} onChange={e => setF('peso_kg', e.target.value)} className={inp} /></Campo>
                    <Campo label="Dimensões (mm)"><input value={form.dimensoes_mm || ''} onChange={e => setF('dimensoes_mm', e.target.value)} placeholder="AxLxP" className={inp} /></Campo>
                    <Campo label="Temperatura"><input value={form.temperatura_operacao || ''} onChange={e => setF('temperatura_operacao', e.target.value)} placeholder="-30 a 50°C" className={inp} /></Campo>
                    <Campo label="Garantia (anos)"><input type="number" value={form.garantia_anos || ''} onChange={e => setF('garantia_anos', e.target.value)} className={inp} /></Campo>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button onClick={salvarManual} disabled={salvandoManual} className="flex items-center gap-2">
                  <CheckCircle size={15} /> {salvandoManual ? 'Salvando…' : 'Salvar carregador'}
                </Button>
              </div>
            </div>
          )}

          {/* ── MODO DATASHEET ── */}
          {modo === 'datasheet' && (<>

          {/* Banner aviso IA — mostra o erro real do servidor */}
          {temAvisoIA && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-500" />
              <div className="space-y-0.5">
                {avisos.map((a, i) => <p key={i}>{a}</p>)}
                <p className="text-amber-600 text-xs mt-1">Verifique os dados técnicos antes de usar em projetos.</p>
              </div>
            </div>
          )}

          {/* Zona de drop */}
          <div
            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            onClick={() => !processando && inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer select-none
              ${arrastando ? 'border-amber-500 bg-amber-50 scale-[1.02]' : 'border-slate-300 hover:border-amber-400 hover:bg-slate-50'}
              ${processando ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <div className={`inline-flex p-4 rounded-full mb-3 ${arrastando ? 'bg-amber-100' : 'bg-slate-100'}`}>
              <Upload size={32} className={arrastando ? 'text-amber-600' : 'text-slate-500'} />
            </div>
            <p className="font-semibold text-slate-700">
              {arrastando ? 'Solte os datasheets aqui' : 'Arraste os datasheets de carregadores EV'}
            </p>
            <p className="text-sm text-slate-500 mt-1">ou clique para selecionar • PDF • múltiplos aceitos</p>
            <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden"
              onChange={e => { adicionarArquivos(e.target.files); e.target.value = '' }} />
          </div>

          {/* Fila */}
          {fila.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fila de processamento</p>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {fila.map(item => (
                  <div key={item.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm transition-colors
                      ${item.status === 'salvo' && !item.duplicata ? 'bg-emerald-50 border-emerald-200'
                      : item.status === 'erro'                     ? 'bg-red-50 border-red-200'
                      : item.status === 'processando'              ? 'bg-blue-50 border-blue-200'
                      : item.duplicata                             ? 'bg-slate-50 border-slate-200'
                      : 'bg-white border-slate-200'}`}
                  >
                    <div className="shrink-0">{statusIcon(item)}</div>
                    <span className="flex-1 truncate font-medium text-slate-700">{item.nome}</span>
                    <div className="shrink-0 text-right">{statusLabel(item)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resumo pós-processamento */}
          {concluido && (
            <div className="bg-slate-50 rounded-xl p-4 space-y-1 text-sm">
              {totalSalvos   > 0 && <p className="text-emerald-700">✓ {totalSalvos} carregador{totalSalvos > 1 ? 'es' : ''} cadastrado{totalSalvos > 1 ? 's' : ''}</p>}
              {totalIgnorados > 0 && <p className="text-slate-500">— {totalIgnorados} já existia{totalIgnorados > 1 ? 'm' : ''} no sistema</p>}
              {totalErros    > 0 && <p className="text-red-600">✗ {totalErros} com erro — verifique e tente novamente</p>}
            </div>
          )}
          </>)}
        </div>

        {/* Footer */}
        <div className="p-6 border-t shrink-0 flex items-center justify-between gap-4">
          <p className="text-xs text-slate-400">
            {modo === 'manual' ? 'Cadastro manual — sem PDF'
              : fila.length === 0 ? 'Nenhum arquivo selecionado'
              : `${fila.length} arquivo${fila.length > 1 ? 's' : ''} na fila`}
          </p>
          <div className="flex gap-3">
            <Button onClick={onClose} variante="secundario">Fechar</Button>
            {modo === 'datasheet' && podeProcesar && (
              <Button onClick={processarFila} className="flex items-center gap-2">
                <Zap size={16} />
                Processar {totalPendente} PDF{totalPendente > 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

// ── Helpers do cadastro manual ──────────────────────────────────────────────
const inp = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
function Campo({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 block mb-1">{label}</span>
      {children}
    </label>
  )
}
