import { useState, useRef } from 'react'
import { X, Upload, CheckCircle, AlertCircle, Loader, FileText, Zap } from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

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

  // ── Processa um PDF e salva o inversor ─────────────────────────────────────

  async function processarItem(item) {
    atualizarItem(item.id, { status: 'processando' })
    try {
      const fd = new FormData()
      fd.append('pdf', item.file)
      const res  = await fetch(`${API_URL}/api/datasheet/extrair-datasheet`, { method: 'POST', body: fd })
      const texto = await res.text()
      let json
      try { json = JSON.parse(texto) } catch { throw new Error(`Servidor retornou status ${res.status}`) }
      if (!res.ok) throw new Error(json.erro || `Erro ${res.status}`)

      const dados = json.dados || json
      const aviso = json.avisos?.length ? json.avisos[0] : null

      // Verifica duplicata — se existir, atualiza; senão, cria
      const params = new URLSearchParams({ fabricante: dados.fabricante || '', modelo: dados.modelo || '', tipo: 'inversor' })
      const dupRes  = await fetch(`${API_URL}/api/datasheet/verificar-duplicata?${params}`)
      const dupJson = await dupRes.json()
      const existente = dupJson.duplicata ? dupJson.equipamento : null

      // Monta payload
      const payload = {
        tipo: 'inversor',
        fabricante: dados.fabricante || 'Desconhecido',
        modelo:     dados.modelo     || 'Inversor',
        preco_sugerido: 0,
        ...(dados.garantia_anos ? { garantia_produto: { value: dados.garantia_anos, unit: 'anos' } } : {}),
        especificacoes: {
          subtipo:               dados.subtipo                                              || null,
          // AC
          potencia_kw:           dados.potencia_nominal_kw   || dados.potenciaKW           || null,
          potencia_maxima_kw:    dados.potencia_maxima_kw                                  || null,
          potencia_aparente_kva: dados.potencia_aparente_kva                               || null,
          tensao_ac:             dados.tensao_ac             || dados.tensao_ac_nominal     || null,
          faixa_tensao_rede:     dados.faixa_tensao_rede                                   || null,
          fases:                 dados.fases                 || dados.faseAC               || null,
          tipo_conexao_rede:     dados.tipo_conexao_rede                                   || null,
          frequencia_hz:         dados.frequencia_hz                                       || null,
          faixa_frequencia_hz:   dados.faixa_frequencia_hz                                 || null,
          corrente_ac_saida:     dados.corrente_ac_saida     || dados.correnteACSaida      || null,
          fator_potencia:        dados.fator_potencia                                      || null,
          thdi:                  dados.thdi                                                || null,
          // DC / MPPT
          n_mppts:               dados.n_mppts               || dados.nMppts               || null,
          strings_por_mppt:      dados.strings_por_mppt                                   || null,
          potencia_max_entrada_cc: dados.potencia_max_entrada_cc                          || null,
          tensao_max_entrada:    dados.tensao_max_entrada                                  || null,
          tensao_partida:        dados.tensao_partida                                      || null,
          tensao_nominal_cc:     dados.tensao_nominal_cc                                   || null,
          tensao_mppt_min:       dados.tensao_mppt_min       || dados.tensaoMpptMin        || null,
          tensao_mppt_max:       dados.tensao_mppt_max       || dados.tensaoMpptMax        || null,
          faixa_operacao_cc:     dados.faixa_operacao_cc                                   || null,
          corrente_max_entrada:  dados.corrente_max_entrada                                || null,
          corrente_max_por_mppt: dados.corrente_max_por_mppt                              || null,
          corrente_isc_max:      dados.corrente_isc_max                                   || null,
          // Eficiência
          eficiencia_maxima:     dados.eficiencia_maxima     || dados.eficiencia           || null,
          eficiencia_europeia:   dados.eficiencia_europeia                                 || null,
          eficiencia_cec:        dados.eficiencia_cec                                      || null,
          eficiencia_mppt:       dados.eficiencia_mppt                                     || null,
          // Proteções
          grau_protecao_ip:        dados.grau_protecao_ip                                 || null,
          protecao_antiilhamento:  dados.protecao_antiilhamento                           || null,
          protecao_sobretensao_dc: dados.protecao_sobretensao_dc                          || null,
          protecao_sobretensao_ac: dados.protecao_sobretensao_ac                          || null,
          // Geral / Físico
          temperatura_operacao:  dados.temperatura_operacao                               || null,
          tipo_refrigeracao:     dados.tipo_refrigeracao                                  || null,
          comunicacao:           dados.comunicacao                                         || null,
          max_por_cabo_tronco:   dados.max_por_cabo_tronco                                || null,
          peso_kg:               dados.peso_kg                                            || null,
          dimensoes:             dados.dimensoes                                          || null,
          garantia_anos:         dados.garantia_anos                                      || null,
        },
      }
      // Remove campos nulos para não poluir o banco
      Object.keys(payload.especificacoes).forEach(k => {
        if (payload.especificacoes[k] === null) delete payload.especificacoes[k]
      })

      const url    = existente ? `${API_URL}/api/equipamentos/${existente._id}` : `${API_URL}/api/equipamentos`
      const method = existente ? 'PUT' : 'POST'
      const savePayload = existente
        ? { ...payload, especificacoes: { ...existente.especificacoes, ...payload.especificacoes } }
        : payload

      const saveRes = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savePayload),
      })
      if (!saveRes.ok) throw new Error('Erro ao salvar no banco')

      atualizarItem(item.id, { status: 'salvo', dados, atualizado: !!existente, aviso })
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
  const temAvisoIA     = fila.some(i => i.aviso)
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
              <h2 className="text-xl font-bold text-slate-900">Importar Inversores</h2>
              <p className="text-xs text-slate-500">Claude extrai todos os dados para o unifilar</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Banner aviso IA */}
          {temAvisoIA && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-500" />
              <span>Claude IA não estava disponível — verifique os dados técnicos antes de usar em projetos.</span>
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
