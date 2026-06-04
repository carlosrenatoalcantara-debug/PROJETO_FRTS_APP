import { useState, useMemo } from 'react'
import { X, Upload, CheckCircle, AlertTriangle, AlertCircle, ChevronLeft, ChevronRight, SkipForward, Loader, Info } from 'lucide-react'
import {
  classificarCampos,
  resumirQualidade,
  STATUS,
  PROVENIENCIA,
} from '../../../../backend/src/ai/camposEquipamento.js'

const API_URL = ''

/**
 * P0-INV-CAT-03 — Importação Assistida de Datasheets (modelo-a-modelo).
 *
 * Fases: upload → confirmar → assistente (1 modelo por vez) → resumo.
 * Persistência INCREMENTAL: cada modelo é salvo imediatamente ao confirmar,
 * via POST /api/equipamentos/lote-inversores (upsert idempotente). Um erro em
 * um modelo NÃO perde os demais. Campos editáveis com indicadores 🟢🟡🔴.
 * Reaproveita extrair-multi (Gemini/Claude/parser) e o catálogo atual.
 */
export default function AssistenteImportacaoDatasheet({ tipoEquipamento = 'inversor', onFechar, onConcluido }) {
  const [fase, setFase] = useState('upload')       // upload | confirmar | assistente | resumo
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)
  const [provider, setProvider] = useState(null)
  const [itens, setItens] = useState([])           // [{fabricante, modelo, tipo, especificacoes}]
  const [edicoes, setEdicoes] = useState({})        // { [indice]: { campoKey: valor } }
  const [indice, setIndice] = useState(0)
  const [resultados, setResultados] = useState([]) // [{modelo, status:'salvo'|'ignorado'|'erro', percentual, corrigidos}]

  const fabricante = itens[0]?.fabricante || '—'

  // ── Especificações efetivas (extraídas + edições do operador) do modelo atual ──
  const especEfetiva = useMemo(() => {
    const base = itens[indice]?.especificacoes || {}
    return { ...base, ...(edicoes[indice] || {}) }
  }, [itens, indice, edicoes])

  // P1-INV-MATRIX-01: proveniência por campo vinda do parser (matricial: 🟢/🟡).
  const statusMap = useMemo(() => itens[indice]?._meta?.status || {}, [itens, indice])

  const campos = useMemo(
    () => classificarCampos(itens[indice]?.tipo || tipoEquipamento, especEfetiva, statusMap),
    [itens, indice, especEfetiva, tipoEquipamento, statusMap]
  )
  const qualidade = useMemo(
    () => resumirQualidade(itens[indice]?.tipo || tipoEquipamento, especEfetiva, statusMap),
    [itens, indice, especEfetiva, tipoEquipamento, statusMap]
  )

  // ── ETAPA 1: upload + extração ────────────────────────────────────────────────
  async function aoSelecionarArquivo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCarregando(true); setErro(null)
    try {
      const fd = new FormData()
      fd.append('pdf', file)
      const res = await fetch(`${API_URL}/api/datasheet/extrair-multi`, { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.erro || `Erro ${res.status}`)
      const lista = Array.isArray(json.itens) ? json.itens : []
      if (lista.length === 0) throw new Error('Nenhum modelo identificado neste datasheet.')
      setProvider(json.provider)
      setItens(lista)
      setIndice(0)
      setFase('confirmar')
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  function editarCampo(key, valor) {
    setEdicoes(prev => ({ ...prev, [indice]: { ...(prev[indice] || {}), [key]: valor } }))
  }

  function registrarResultado(r) {
    setResultados(prev => {
      const semEsse = prev.filter(x => x.indice !== indice)
      return [...semEsse, { indice, ...r }]
    })
  }

  // ── ETAPA 2/3: salvar modelo atual (persistência incremental) ──────────────────
  async function salvarEProximo() {
    if (!qualidade.podeSalvar) {
      setErro(`Preencha os campos obrigatórios: ${qualidade.obrigatoriosFaltando.join(', ')}`)
      return
    }
    setCarregando(true); setErro(null)
    const it = itens[indice]
    try {
      const res = await fetch(`${API_URL}/api/equipamentos/lote-inversores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itens: [{ tipo: it.tipo || tipoEquipamento, fabricante: it.fabricante, modelo: it.modelo, especificacoes: especEfetiva }],
        }),
      })
      const json = await res.json().catch(() => ({}))
      const ok = (json.criados || 0) + (json.atualizados || 0) > 0
      if (!ok) throw new Error(json.detalhe?.falhas?.[0]?.erro || json.erro || 'Falha ao salvar')
      registrarResultado({ modelo: it.modelo, status: 'salvo', percentual: qualidade.percentual, corrigidos: Object.keys(edicoes[indice] || {}).length })
      avancar()
    } catch (err) {
      registrarResultado({ modelo: it.modelo, status: 'erro', percentual: qualidade.percentual, corrigidos: 0, erro: err.message })
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  function ignorarModelo() {
    registrarResultado({ modelo: itens[indice]?.modelo, status: 'ignorado', percentual: qualidade.percentual, corrigidos: 0 })
    avancar()
  }

  function avancar() {
    setErro(null)
    if (indice < itens.length - 1) setIndice(indice + 1)
    else setFase('resumo')
  }
  function voltar() {
    setErro(null)
    if (indice > 0) setIndice(indice - 1)
  }

  // ── Resumo final ───────────────────────────────────────────────────────────────
  const resumo = useMemo(() => {
    const salvos = resultados.filter(r => r.status === 'salvo')
    const ignorados = resultados.filter(r => r.status === 'ignorado')
    const corrigidos = resultados.reduce((s, r) => s + (r.corrigidos || 0), 0)
    const media = salvos.length ? Math.round(salvos.reduce((s, r) => s + r.percentual, 0) / salvos.length) : 0
    return { salvos, ignorados, corrigidos, media }
  }, [resultados])

  // Proveniência: 🟢 encontrado no PDF · 🟡 inferido pelo parser · 🔴 não encontrado
  const BadgeProveniencia = ({ proveniencia }) => proveniencia === PROVENIENCIA.ENCONTRADO
    ? <CheckCircle size={15} className="text-emerald-500" title="Encontrado diretamente no PDF" />
    : proveniencia === PROVENIENCIA.INFERIDO
      ? <AlertTriangle size={15} className="text-amber-500" title="Inferido pelo parser" />
      : <AlertCircle size={15} className="text-red-500" title="Não encontrado" />

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onFechar}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-slate-900">Importação Assistida de Datasheet</h2>
          <button onClick={onFechar} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="p-5 overflow-auto">
          {erro && (
            <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded text-sm text-red-700">{erro}</div>
          )}

          {/* ── FASE UPLOAD ── */}
          {fase === 'upload' && (
            <label className="block border-2 border-dashed border-slate-300 rounded-lg p-10 text-center cursor-pointer hover:bg-slate-50">
              <Upload size={28} className="mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-600">{carregando ? 'Extraindo modelos…' : 'Envie o datasheet (PDF)'}</p>
              <input type="file" accept="application/pdf" className="hidden" onChange={aoSelecionarArquivo} disabled={carregando} />
            </label>
          )}

          {/* ── FASE CONFIRMAR ── */}
          {fase === 'confirmar' && (
            <div className="text-center py-4">
              <p className="text-sm text-slate-500 mb-1">Fabricante: <strong>{fabricante}</strong> {provider && <span className="text-xs text-slate-400">· via {provider}</span>}</p>
              <p className="text-lg font-semibold text-slate-900 mb-3">Encontramos {itens.length} modelo(s) neste datasheet</p>
              <ul className="inline-block text-left text-sm text-slate-700 mb-5 space-y-1">
                {itens.map((it, i) => <li key={i}>• {it.modelo}</li>)}
              </ul>
              <p className="text-sm text-slate-500 mb-4">Deseja iniciar a importação assistida?</p>
              <div className="flex gap-2 justify-center">
                <button onClick={onFechar} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancelar</button>
                <button onClick={() => setFase('assistente')} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Iniciar</button>
              </div>
            </div>
          )}

          {/* ── FASE ASSISTENTE (modelo-a-modelo) ── */}
          {fase === 'assistente' && itens[indice] && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-500">Modelo {indice + 1} de {itens.length}</span>
                <span className={`text-xs font-semibold ${qualidade.percentual >= 80 ? 'text-emerald-600' : qualidade.percentual >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                  Qualidade: {qualidade.percentual}%
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">{itens[indice].modelo}</h3>
              <p className="text-xs text-slate-400 mb-3">{itens[indice].fabricante}</p>

              {/* Alerta de qualidade da extração */}
              <div className="mb-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-700">Qualidade da extração</span>
                  <span className={`text-sm font-bold ${qualidade.percentual >= 80 ? 'text-emerald-600' : qualidade.percentual >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{qualidade.percentual}%</span>
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="flex items-center gap-1 text-emerald-700"><CheckCircle size={13} /> Encontrados: <strong>{qualidade.encontrados}</strong></span>
                  <span className="flex items-center gap-1 text-amber-700"><AlertTriangle size={13} /> Inferidos: <strong>{qualidade.inferidos}</strong></span>
                  <span className="flex items-center gap-1 text-red-700"><AlertCircle size={13} /> Pendentes: <strong>{qualidade.pendentes}</strong></span>
                </div>
                {qualidade.faltantes.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <p className="text-[11px] font-medium text-slate-500 mb-1">Campos não encontrados:</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {qualidade.faltantes.map(f => (
                        <label key={f} className="flex items-center gap-1 text-[11px] text-slate-600">
                          <input type="checkbox" disabled className="accent-red-500" /> {f}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {campos.map(c => (
                  <div key={c.key}>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
                      <BadgeProveniencia proveniencia={c.proveniencia} />
                      {c.label}{c.obrigatorio && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type={c.tipo === 'number' ? 'number' : 'text'}
                      value={c.valor ?? ''}
                      onChange={e => editarCampo(c.key, c.tipo === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
                      className={`w-full px-2.5 py-1.5 text-sm border rounded-lg focus:ring-1 focus:ring-blue-400 outline-none ${
                        c.proveniencia === PROVENIENCIA.FALTANTE && c.obrigatorio ? 'border-red-300 bg-red-50'
                          : c.proveniencia === PROVENIENCIA.INFERIDO ? 'border-amber-200 bg-amber-50'
                          : c.proveniencia === PROVENIENCIA.FALTANTE ? 'border-amber-200' : 'border-slate-200'
                      }`}
                    />
                    {/* Legenda EXTERNA ao campo (não usar placeholder como documentação) */}
                    {c.info && (
                      <p className="mt-0.5 flex items-start gap-1 text-[11px] text-slate-400">
                        <Info size={11} className="mt-0.5 shrink-0" /> <span>{c.info}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t">
                <button onClick={voltar} disabled={indice === 0 || carregando}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1">
                  <ChevronLeft size={15} /> Voltar
                </button>
                <button onClick={ignorarModelo} disabled={carregando}
                  className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1">
                  <SkipForward size={15} /> Ignorar Modelo
                </button>
                <button onClick={salvarEProximo} disabled={carregando || !qualidade.podeSalvar}
                  className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-1">
                  {carregando ? <Loader size={15} className="animate-spin" /> : <ChevronRight size={15} />}
                  Salvar e Próximo
                </button>
              </div>
            </div>
          )}

          {/* ── FASE RESUMO ── */}
          {fase === 'resumo' && (
            <div className="py-2">
              <h3 className="text-lg font-bold text-slate-900 mb-3">Importação concluída</h3>
              <ul className="space-y-1 mb-4">
                {resultados.sort((a, b) => a.indice - b.indice).map(r => (
                  <li key={r.indice} className="flex items-center gap-2 text-sm">
                    {r.status === 'salvo' && <CheckCircle size={15} className="text-emerald-500" />}
                    {r.status === 'ignorado' && <SkipForward size={15} className="text-slate-400" />}
                    {r.status === 'erro' && <AlertCircle size={15} className="text-red-500" />}
                    <span className={r.status === 'ignorado' ? 'text-slate-400' : 'text-slate-800'}>{r.modelo}</span>
                    {r.status === 'salvo' && <span className="text-xs text-slate-400">· {r.percentual}%</span>}
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-3 gap-3 text-center mb-5">
                <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Qualidade média</p><p className="text-xl font-bold text-slate-900">{resumo.media}%</p></div>
                <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Corrigidos</p><p className="text-xl font-bold text-slate-900">{resumo.corrigidos}</p></div>
                <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Ignorados</p><p className="text-xl font-bold text-slate-900">{resumo.ignorados.length}</p></div>
              </div>
              <button onClick={() => { onConcluido?.(resumo); onFechar?.() }}
                className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Concluir</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
