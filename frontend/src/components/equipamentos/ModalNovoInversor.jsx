import { useState, useRef } from 'react'
import { X, Upload, CheckCircle, AlertCircle, Loader, FileText, Zap, PenLine } from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway */

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
        Inversor {acao}{item.aviso ? ' ⚠ verifique os dados' : ''}
      </span>
    )
  }
  if (item.status === 'erro') return <span className="text-xs text-red-600 truncate">{item.erro}</span>
  return null
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ModalNovoInversor({ arquivosIniciais = [], onClose, onSalvar }) {
  const inputRef  = useRef(null)
  const [modo, setModo]             = useState('lote')  // 'lote' | 'manual'
  const [fila, setFila]             = useState(() => arquivosIniciais.map(criarItem))
  const [arrastando, setArrastando] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [concluido, setConcluido]   = useState(false)

  // ── Modo manual ─────────────────────────────────────────────────────────────
  const [formManual, setFormManual] = useState({
    tipo: 'inversor',
    fabricante: '',
    modelo: '',
    especificacoes: {},
    preco_sugerido: 0,
  })
  const [salvandoManual, setSalvandoManual] = useState(false)

  function setEspec(key, valor) {
    setFormManual(f => ({
      ...f,
      especificacoes: { ...f.especificacoes, [key]: valor === '' ? undefined : valor },
    }))
  }

  async function handleSalvarManual() {
    if (!formManual.fabricante || !formManual.modelo) {
      return alert('Preencha fabricante e modelo')
    }
    setSalvandoManual(true)
    try {
      const res = await fetch(`${API_URL}/api/equipamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formManual),
      })
      if (res.ok) { onSalvar(); onClose() }
      else alert('Erro ao salvar inversor')
    } catch { alert('Erro ao salvar inversor') }
    finally { setSalvandoManual(false) }
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

  // ── Processa um PDF e salva o inversor ─────────────────────────────────────

  async function processarItem(item) {
    atualizarItem(item.id, { status: 'processando' })
    try {
      const fd = new FormData()
      fd.append('pdf', item.file)

      // P0-INV-01C: extração MULTI-MODELO via AIOrchestrator (1 PDF → N modelos).
      const res  = await fetch(`${API_URL}/api/datasheet/extrair-multi`, { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.erro || `Erro ${res.status}`)

      const itens = Array.isArray(json.itens) ? json.itens : []
      if (itens.length === 0) {
        throw new Error(
          'IMPORTACAO_FALHOU: nenhum modelo identificado no datasheet. ' +
          'Verifique a qualidade do PDF ou cadastre manualmente.'
        )
      }

      // Revisão opcional: o operador pode desmarcar variantes antes de salvar.
      const selecionados = item.modelosSelecionados
        ? itens.filter(it => item.modelosSelecionados.includes(it.modelo))
        : itens

      // P0-INV-01B: persistência em LOTE (N equipamentos) com dedup no backend.
      const loteRes = await fetch(`${API_URL}/api/equipamentos/lote-inversores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itens: selecionados.map(it => ({
            tipo: 'inversor',
            fabricante: it.fabricante,
            modelo: it.modelo,
            especificacoes: it.especificacoes || {},
          })),
        }),
      })
      const loteJson = await loteRes.json().catch(() => ({}))
      const algum = (loteJson.criados || 0) + (loteJson.atualizados || 0) > 0
      if (!loteRes.ok && !algum) {
        throw new Error(loteJson.erro || `Falha ao salvar em lote (HTTP ${loteRes.status})`)
      }

      const modelos = selecionados.map(it => it.modelo)
      const resumo = `${loteJson.criados || 0} novo(s), ${loteJson.atualizados || 0} atualizado(s)` +
        (loteJson.falhas ? `, ${loteJson.falhas} falha(s)` : '')
      const aviso = modelos.length > 1
        ? `${modelos.length} modelos detectados (${json.provider || 'IA'}): ${modelos.join(', ')}`
        : (json.preenchimentoAssistido ? 'Identidade recuperada; revise os dados técnicos.' : null)

      atualizarItem(item.id, {
        status: 'salvo',
        dados: { fabricante: itens[0].fabricante, modelo: modelos.length > 1 ? `${modelos.length} modelos` : modelos[0] },
        modelos,
        provider: json.provider,
        resumo,
        aviso,
      })
    } catch (err) {
      console.error('Erro no item', item.nome, err)
      atualizarItem(item.id, { status: 'erro', erro: err.message })
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
            <div className="p-2 bg-blue-100 rounded-lg">
              <Zap size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Novo Inversor</h2>
              <p className="text-xs text-slate-500">Importe um datasheet ou preencha manualmente</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Abas */}
          <div className="flex gap-2">
            <Button
              onClick={() => setModo('lote')}
              variante={modo === 'lote' ? 'primario' : 'secundario'}
              className="flex items-center gap-2"
            >
              <Upload size={15} /> Upload de Datasheet
            </Button>
            <Button
              onClick={() => setModo('manual')}
              variante={modo === 'manual' ? 'primario' : 'secundario'}
              className="flex items-center gap-2"
            >
              <PenLine size={15} /> Preencher Manualmente
            </Button>
          </div>

          {/* ── MODO MANUAL ── */}
          {modo === 'manual' && (
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Fabricante *"
                value={formManual.fabricante}
                onChange={e => setFormManual(f => ({ ...f, fabricante: e.target.value }))}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Modelo *"
                value={formManual.modelo}
                onChange={e => setFormManual(f => ({ ...f, modelo: e.target.value }))}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Potência CA (kW) *"
                step="0.1"
                value={formManual.especificacoes?.potencia_kw ?? ''}
                onChange={e => setEspec('potencia_kw', e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Número de MPPTs"
                value={formManual.especificacoes?.n_mppts ?? ''}
                onChange={e => setEspec('n_mppts', e.target.value === '' ? '' : parseInt(e.target.value))}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Entradas por MPPT"
                value={formManual.especificacoes?.entradas_por_mppt ?? ''}
                onChange={e => setEspec('entradas_por_mppt', e.target.value === '' ? '' : parseInt(e.target.value))}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Tensão máx. CC (V)"
                value={formManual.especificacoes?.tensao_max_entrada ?? ''}
                onChange={e => setEspec('tensao_max_entrada', e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Corrente máx. por MPPT (A)"
                step="0.1"
                value={formManual.especificacoes?.corrente_max_por_mppt ?? ''}
                onChange={e => setEspec('corrente_max_por_mppt', e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Preço (R$)"
                value={formManual.preco_sugerido}
                onChange={e => setFormManual(f => ({ ...f, preco_sugerido: parseFloat(e.target.value) || 0 }))}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* ── MODO LOTE (PDF) ── */}
          {modo === 'lote' && (<>

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
              ${arrastando ? 'border-blue-500 bg-blue-50 scale-[1.02]' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}
              ${processando ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <div className={`inline-flex p-4 rounded-full mb-3 ${arrastando ? 'bg-blue-100' : 'bg-slate-100'}`}>
              <Upload size={32} className={arrastando ? 'text-blue-600' : 'text-slate-500'} />
            </div>
            <p className="font-semibold text-slate-700">
              {arrastando ? 'Solte os datasheets aqui' : 'Arraste os datasheets de inversores'}
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
              {totalSalvos   > 0 && <p className="text-emerald-700">✓ {totalSalvos} inversor{totalSalvos > 1 ? 'es' : ''} cadastrado{totalSalvos > 1 ? 's' : ''}</p>}
              {totalIgnorados > 0 && <p className="text-slate-500">— {totalIgnorados} já existia{totalIgnorados > 1 ? 'm' : ''} no sistema</p>}
              {totalErros    > 0 && <p className="text-red-600">✗ {totalErros} com erro — verifique e tente novamente</p>}
            </div>
          )}
        </>)}
        </div>

        {/* Footer */}
        <div className="p-6 border-t shrink-0 flex items-center justify-between gap-4">
          {modo === 'lote' ? (
            <p className="text-xs text-slate-400">
              {fila.length === 0 ? 'Nenhum arquivo selecionado'
                : `${fila.length} arquivo${fila.length > 1 ? 's' : ''} na fila`}
            </p>
          ) : <span />}
          <div className="flex gap-3">
            <Button onClick={onClose} variante="secundario">Fechar</Button>
            {modo === 'lote' && podeProcesar && (
              <Button onClick={processarFila} className="flex items-center gap-2">
                <Zap size={16} />
                Processar {totalPendente} PDF{totalPendente > 1 ? 's' : ''}
              </Button>
            )}
            {modo === 'manual' && (
              <Button onClick={handleSalvarManual} disabled={salvandoManual}>
                {salvandoManual ? 'Salvando…' : 'Salvar'}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
