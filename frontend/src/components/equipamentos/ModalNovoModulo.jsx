import { useState, useRef } from 'react'
import { X, Upload, CheckCircle, AlertCircle, Loader, FileText, Plus } from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// ── Utilitários ───────────────────────────────────────────────────────────────

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
    const n = item.modulosSalvos    || 0
    const u = item.modulosAtualizados || 0
    const aviso = item.aviso
    const partes = []
    if (n > 0) partes.push(`${n} cadastrado${n > 1 ? 's' : ''}`)
    if (u > 0) partes.push(`${u} atualizado${u > 1 ? 's' : ''}`)
    if (!partes.length) return <span className="text-xs text-slate-500">Sem alterações</span>
    return (
      <span className={`text-xs ${aviso ? 'text-amber-600' : 'text-emerald-700'}`}>
        {partes.join(' · ')}{aviso && ' ⚠ verifique os dados'}
      </span>
    )
  }
  if (item.status === 'erro') return <span className="text-xs text-red-600 truncate">{item.erro}</span>
  return null
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ModalNovoModulo({ modulo, onClose, onSalvar }) {
  const [modo, setModo] = useState('lote')          // 'lote' | 'manual'
  const [arrastando, setArrastando] = useState(false)
  const [fila, setFila] = useState([])              // itens da fila de processamento
  const [processando, setProcessando] = useState(false)
  const [concluido, setConcluido] = useState(false)
  const inputRef = useRef(null)

  // ── Modo manual ─────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState(
    modulo || {
      tipo: 'modulo',
      fabricante: '',
      modelo: '',
      especificacoes: {},
      preco_sugerido: 0,
      garantia_produto: { value: null, unit: 'anos' },
    }
  )

  // ── Fila de arquivos ─────────────────────────────────────────────────────────

  function criarItens(files) {
    return Array.from(files)
      .filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
      .map((file, i) => ({
        id: Date.now() + i,
        file,
        nome: file.name,
        status: 'pendente',
        dados: null,
        variantes: null,
        modulosSalvos: 0,
        erro: null,
      }))
  }

  function adicionarArquivos(files) {
    const novos = criarItens(files)
    if (!novos.length) return
    setFila(prev => [...prev, ...novos])
    setConcluido(false)
  }

  function removerItem(id) {
    setFila(prev => prev.filter(i => i.id !== id))
  }

  function atualizarItem(id, patch) {
    setFila(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  }

  // ── Extrai + salva um arquivo ─────────────────────────────────────────────────

  async function processarItem(item) {
    atualizarItem(item.id, { status: 'processando' })

    try {
      // 1. Extração
      const fd = new FormData()
      fd.append('pdf', item.file)
      const res = await fetch(`${API_URL}/api/datasheet/extrair-datasheet`, { method: 'POST', body: fd })
      const texto = await res.text()
      let json
      try { json = JSON.parse(texto) } catch {
        throw new Error(`Servidor retornou status ${res.status}`)
      }
      if (!res.ok) throw new Error(json.erro || `Erro ${res.status}`)

      const dados = json.dados || json
      const variantes = json.variantes && json.variantes.length > 1 ? json.variantes : null
      const aviso = json.avisos && json.avisos.length > 0 ? json.avisos[0] : null

      // 2. Persistência: cria novo ou atualiza existente mesclando dados
      const salvarModulo = async (payload) => {
        const params = new URLSearchParams({
          fabricante: payload.fabricante,
          modelo:     payload.modelo,
          potenciaW:  payload.especificacoes?.potencia_wp ?? '',
        })
        const dup = await fetch(`${API_URL}/api/datasheet/verificar-duplicata?${params}`)
        const dupJson = await dup.json()

        if (dupJson.duplicata && dupJson.equipamento) {
          // Atualiza: mescla especificações existentes com os novos dados mecânicos/garantias
          const existente = dupJson.equipamento
          const updatePayload = {
            fabricante: payload.fabricante,
            modelo:     payload.modelo,
            especificacoes: { ...existente.especificacoes, ...payload.especificacoes },
            ...(payload.garantia_produto     ? { garantia_produto:    payload.garantia_produto    } : {}),
            ...(payload.garantia_performance ? { garantia_performance: payload.garantia_performance } : {}),
          }
          const r = await fetch(`${API_URL}/api/equipamentos/${existente._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
          })
          if (!r.ok) throw new Error('Erro ao atualizar no banco')
          return 'atualizado'
        }

        const r = await fetch(`${API_URL}/api/equipamentos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!r.ok) throw new Error('Erro ao salvar no banco')
        return 'criado'
      }

      // Campos mecânicos e garantias são iguais para todas as variantes do mesmo datasheet
      const especMecanica = {
        dimensoes:                 dados.dimensoes                 || null,
        peso_kg:                   dados.peso_kg                   || null,
        tipo_celula:               dados.tipo_celula               || null,
        num_celulas:               dados.num_celulas               || null,
        coef_temp_pmax:            dados.coef_temp_pmax            || null,
        coef_temp_voc:             dados.coef_temp_voc             || null,
        coef_temp_isc:             dados.coef_temp_isc             || null,
        garantia_produto_anos:     dados.garantia_produto_anos     || null,
        garantia_performance_anos: dados.garantia_performance_anos || null,
      }
      // Remove nulos para não poluir o banco
      Object.keys(especMecanica).forEach(k => { if (especMecanica[k] === null) delete especMecanica[k] })

      const base = {
        tipo: 'modulo',
        fabricante: dados.marca || dados.fabricante || 'Desconhecido',
        preco_sugerido: 0,
        ...(dados.garantia_produto_anos    ? { garantia_produto:    { value: dados.garantia_produto_anos,    unit: 'anos' } } : {}),
        ...(dados.garantia_performance_anos ? { garantia_performance: { value: dados.garantia_performance_anos, unit: 'anos' } } : {}),
      }

      let modulosSalvos = 0
      let modulosAtualizados = 0

      const contarResultado = (r) => {
        if (r === 'criado')    modulosSalvos++
        if (r === 'atualizado') modulosAtualizados++
      }

      if (variantes) {
        for (const v of variantes) {
          contarResultado(await salvarModulo({
            ...base,
            modelo: `${dados.modelo || 'Módulo'}-${v.potenciaW}W`,
            especificacoes: {
              potencia_wp: v.potenciaW,
              voc: v.voc,
              vmp: v.vmpp,
              isc: v.isc,
              imp: v.impp,
              eficiencia: v.eficiencia,
              ...especMecanica,
            },
          }))
        }
      } else {
        contarResultado(await salvarModulo({
          ...base,
          modelo: dados.modelo || 'Módulo',
          especificacoes: {
            potencia_wp: dados.potenciaW,
            voc: dados.voc,
            vmp: dados.vmpp,
            isc: dados.isc,
            imp: dados.impp,
            eficiencia: dados.eficiencia,
            ...especMecanica,
          },
        }))
      }

      atualizarItem(item.id, { status: 'salvo', dados, variantes, modulosSalvos, modulosAtualizados, aviso })
    } catch (err) {
      console.error('Erro no item', item.nome, err)
      atualizarItem(item.id, { status: 'erro', erro: err.message })
    }
  }

  // ── Processa a fila toda sequencialmente ──────────────────────────────────────

  async function processarFila() {
    setProcessando(true)
    setConcluido(false)

    const pendentes = fila.filter(i => i.status === 'pendente' || i.status === 'erro')
    for (const item of pendentes) {
      await processarItem(item)
    }

    setProcessando(false)
    setConcluido(true)
    onSalvar()
  }

  // ── Drag & Drop ──────────────────────────────────────────────────────────────

  function handleDragOver(e)  { e.preventDefault(); setArrastando(true) }
  function handleDragLeave(e) { e.preventDefault(); setArrastando(false) }
  function handleDrop(e) {
    e.preventDefault()
    setArrastando(false)
    adicionarArquivos(e.dataTransfer.files)
  }

  // ── Modo manual salvar ────────────────────────────────────────────────────────

  async function handleSalvarManual() {
    if (!formData.fabricante || !formData.modelo) {
      alert('Preencha fabricante e modelo')
      return
    }
    try {
      const url = modulo ? `${API_URL}/api/equipamentos/${modulo._id}` : `${API_URL}/api/equipamentos`
      const res = await fetch(url, {
        method: modulo ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) { onSalvar(); onClose() }
      else alert('Erro ao salvar módulo')
    } catch { alert('Erro ao salvar módulo') }
  }

  // ── Sumário ──────────────────────────────────────────────────────────────────

  const totalSalvos      = fila.reduce((s, i) => s + (i.modulosSalvos     || 0), 0)
  const totalAtualizados = fila.reduce((s, i) => s + (i.modulosAtualizados || 0), 0)
  const totalErros    = fila.filter(i => i.status === 'erro').length
  const totalPendente = fila.filter(i => i.status === 'pendente').length
  const podeProcesar  = !processando && totalPendente > 0
  const temAvisoIA    = fila.some(i => i.aviso)

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <h2 className="text-xl font-bold text-slate-900">
            {modulo ? 'Editar Módulo' : 'Novo Módulo'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Banner: Claude indisponível */}
          {temAvisoIA && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-500" />
              <span>Claude IA não estava disponível — leitura feita por parser de texto. Confirme o nome do modelo e os dados elétricos antes de usar em projetos.</span>
            </div>
          )}

          {/* Abas */}
          {!modulo && (
            <div className="flex gap-2">
              <Button
                onClick={() => setModo('lote')}
                variante={modo === 'lote' ? 'primario' : 'secundario'}
                className="flex items-center gap-2"
              >
                <Upload size={15} /> Upload de Datasheets
              </Button>
              <Button
                onClick={() => setModo('manual')}
                variante={modo === 'manual' ? 'primario' : 'secundario'}
              >
                Preencher Manualmente
              </Button>
            </div>
          )}

          {/* ── MODO LOTE ── */}
          {(modo === 'lote' || modulo) && !modulo && (
            <div className="space-y-4">

              {/* Zona de drop */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !processando && inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all select-none ${
                  arrastando
                    ? 'border-emerald-500 bg-emerald-50 scale-[1.02]'
                    : 'border-blue-300 hover:border-blue-500 hover:bg-blue-50'
                } ${processando ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
              >
                <div className={`flex justify-center mb-3`}>
                  <div className={`p-4 rounded-full ${arrastando ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                    <Upload size={36} className={arrastando ? 'text-emerald-600' : 'text-blue-600'} />
                  </div>
                </div>
                <p className="font-semibold text-blue-700 mb-1">
                  {arrastando ? 'Solte os PDFs aqui' : 'Arraste um ou mais datasheets PDF'}
                </p>
                <p className="text-sm text-slate-500">ou clique para selecionar</p>
                <p className="text-xs text-slate-400 mt-2">Aceita múltiplos arquivos de uma vez</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  className="hidden"
                  onChange={e => { adicionarArquivos(e.target.files); e.target.value = '' }}
                  disabled={processando}
                />
              </div>

              {/* Fila de arquivos */}
              {fila.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 flex items-center justify-between border-b">
                    <span className="text-sm font-semibold text-slate-700">
                      {fila.length} arquivo{fila.length > 1 ? 's' : ''} na fila
                    </span>
                    {!processando && (
                      <button
                        onClick={() => setFila([])}
                        className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                      >
                        Limpar tudo
                      </button>
                    )}
                  </div>

                  <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                    {fila.map(item => (
                      <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="shrink-0">{statusIcon(item)}</div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{item.nome}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {statusLabel(item)}
                            {item.variantes && (
                              <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                {item.variantes.length} variantes
                              </span>
                            )}
                          </div>
                        </div>

                        {item.status !== 'processando' && (
                          <button
                            onClick={() => removerItem(item.id)}
                            className="shrink-0 text-slate-300 hover:text-red-400 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Sumário pós-processamento */}
              {concluido && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm space-y-1">
                  <p className="font-semibold text-emerald-800">Processamento concluído</p>
                  {totalSalvos > 0 && (
                    <p className="text-emerald-700">✓ {totalSalvos} módulo{totalSalvos !== 1 ? 's' : ''} cadastrado{totalSalvos !== 1 ? 's' : ''}</p>
                  )}
                  {totalAtualizados > 0 && (
                    <p className="text-blue-700">↻ {totalAtualizados} módulo{totalAtualizados !== 1 ? 's' : ''} atualizado{totalAtualizados !== 1 ? 's' : ''} com novos dados</p>
                  )}
                  {totalErros > 0 && (
                    <p className="text-amber-700">✗ {totalErros} arquivo{totalErros > 1 ? 's' : ''} com erro — verifique e tente novamente.</p>
                  )}
                </div>
              )}

            </div>
          )}

          {/* ── MODO MANUAL ── */}
          {(modo === 'manual' || modulo) && (
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Fabricante"
                value={formData.fabricante}
                onChange={e => setFormData({ ...formData, fabricante: e.target.value })}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Modelo"
                value={formData.modelo}
                onChange={e => setFormData({ ...formData, modelo: e.target.value })}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Potência (Wp)"
                value={formData.especificacoes?.potencia_wp || ''}
                onChange={e => setFormData({ ...formData, especificacoes: { ...formData.especificacoes, potencia_wp: parseInt(e.target.value) } })}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Preço (R$)"
                value={formData.preco_sugerido}
                onChange={e => setFormData({ ...formData, preco_sugerido: parseFloat(e.target.value) })}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Voc (V)"
                step="0.01"
                value={formData.especificacoes?.voc || ''}
                onChange={e => setFormData({ ...formData, especificacoes: { ...formData.especificacoes, voc: parseFloat(e.target.value) } })}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Vmp (V)"
                step="0.01"
                value={formData.especificacoes?.vmp || ''}
                onChange={e => setFormData({ ...formData, especificacoes: { ...formData.especificacoes, vmp: parseFloat(e.target.value) } })}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-between items-center p-6 border-t shrink-0">
          <Button onClick={onClose} variante="secundario">
            {concluido ? 'Fechar' : 'Cancelar'}
          </Button>

          {modo === 'lote' && !modulo && (
            <div className="flex items-center gap-3">
              {processando && (
                <span className="text-sm text-slate-500 flex items-center gap-1.5">
                  <Loader size={14} className="animate-spin" />
                  Processando…
                </span>
              )}
              <Button
                onClick={processarFila}
                disabled={!podeProcesar}
                className="flex items-center gap-2"
              >
                <Plus size={15} />
                {totalPendente > 0
                  ? `Cadastrar ${totalPendente} datasheet${totalPendente > 1 ? 's' : ''}`
                  : 'Cadastrar'}
              </Button>
            </div>
          )}

          {(modo === 'manual' || modulo) && (
            <Button onClick={handleSalvarManual}>
              Salvar
            </Button>
          )}
        </div>

      </Card>
    </div>
  )
}
