import { useState, useRef } from 'react'
import { X, Upload, CheckCircle, AlertCircle, Loader, FileText, Zap } from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5005'

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
  const [fila, setFila]             = useState(() => arquivosIniciais.map(criarItem))
  const [arrastando, setArrastando] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [concluido, setConcluido]   = useState(false)

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
        </div>

        {/* Footer */}
        <div className="p-6 border-t shrink-0 flex items-center justify-between gap-4">
          <p className="text-xs text-slate-400">
            {fila.length === 0 ? 'Nenhum arquivo selecionado'
              : `${fila.length} arquivo${fila.length > 1 ? 's' : ''} na fila`}
          </p>
          <div className="flex gap-3">
            <Button onClick={onClose} variante="secundario">Fechar</Button>
            {podeProcesar && (
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
