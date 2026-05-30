import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, AlertTriangle, AlertCircle, Info, CheckCircle, Archive, RefreshCw, Loader,
  ChevronRight, ExternalLink, FileText, X, Save,
} from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'

/**
 * AlertCenter — Sprint 8.8
 * Consolidação de alertas operacionais: RT vencido, catálogo, documentos,
 * projetos (snapshot/rateio/RT), faturas (OCR/histórico/Grupo A).
 * Endpoint: /api/alertcenter
 */
const SEV_CONFIG = {
  critico: { cor: 'bg-red-100 text-red-800 border-red-300',     icone: AlertCircle,    label: 'Crítico' },
  erro:    { cor: 'bg-rose-100 text-rose-800 border-rose-300',  icone: AlertTriangle,  label: 'Erro' },
  aviso:   { cor: 'bg-amber-100 text-amber-800 border-amber-300', icone: AlertTriangle, label: 'Aviso' },
  info:    { cor: 'bg-blue-100 text-blue-800 border-blue-300',  icone: Info,           label: 'Info' },
}

const ORIGEM_LABEL = { rt: 'RT', catalogo: 'Catálogo', documento: 'Documento', projeto: 'Projeto', fatura: 'Fatura' }

export default function AlertCenter() {
  const nav = useNavigate()
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [filtros, setFiltros] = useState({ severidade: 'todos', origem: 'todos', status: 'aberto', q: '' })
  const [acaoModal, setAcaoModal] = useState(null)  // { alerta, tipo: 'resolver|arquivar|reabrir' }
  const [msg, setMsg] = useState(null)

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null)
    try {
      const params = new URLSearchParams()
      if (filtros.severidade !== 'todos') params.set('severidade', filtros.severidade)
      if (filtros.origem !== 'todos') params.set('origem', filtros.origem)
      if (filtros.status) params.set('status', filtros.status)
      if (filtros.q) params.set('q', filtros.q)
      const r = await fetch(`/api/alertcenter?${params}`)
      const d = await r.json()
      if (!d.sucesso) throw new Error(d.erro || 'Erro ao carregar')
      setDados(d)
    } catch (e) { setErro(e.message) }
    finally { setCarregando(false) }
  }, [filtros])

  useEffect(() => { carregar() }, [carregar])

  async function executarAcao(alerta, tipo, observacao = null) {
    try {
      const r = await fetch(`/api/alertcenter/${tipo}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alerta.id, origem: alerta.origem, observacao }),
      })
      const d = await r.json()
      if (!r.ok || !d.sucesso) throw new Error(d.erro || 'Erro')
      setMsg({ tipo: 'sucesso', texto: `Alerta ${tipo === 'resolver' ? 'resolvido' : tipo === 'arquivar' ? 'arquivado' : 'reaberto'}.` })
      setTimeout(() => setMsg(null), 3000)
      setAcaoModal(null)
      carregar()
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e.message })
      setTimeout(() => setMsg(null), 3000)
    }
  }

  const k = dados?.kpis || {}
  const cards = k.cards || {}

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Bell size={20} className="text-amber-500" /> AlertCenter
          {k.total_ativos != null && (
            <span className="ml-2 text-sm text-slate-500 font-normal">({k.total_ativos} ativo{k.total_ativos !== 1 ? 's' : ''})</span>
          )}
        </h1>
        <button onClick={() => carregar()} disabled={carregando}
          className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">
          {carregando ? <Loader size={13} className="animate-spin" /> : <RefreshCw size={13} />} Atualizar
        </button>
      </div>

      {msg && <div className={`px-3 py-2 rounded border text-sm ${msg.tipo === 'erro' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>{msg.texto}</div>}
      {erro && <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-sm text-red-700">{erro}</div>}

      {/* KPIs por severidade */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['critico', 'erro', 'aviso', 'info']).map(sev => {
          const cfg = SEV_CONFIG[sev]
          const valor = (k.por_severidade || {})[sev] || 0
          const Ic = cfg.icone
          return (
            <Card key={sev}>
              <CardBody className="flex items-center gap-3 py-3">
                <div className={`p-2 rounded ${cfg.cor.split(' ').slice(0, 1).join(' ')}`}><Ic size={16} /></div>
                <div>
                  <p className="text-[11px] text-slate-500">{cfg.label}</p>
                  <p className="text-2xl font-bold text-slate-900">{valor}</p>
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>

      {/* KPI cards específicos */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { rotulo: 'RT vencidos',          valor: cards.rt_vencidos,           cor: 'bg-red-50 text-red-700' },
          { rotulo: 'Equip. pendentes',     valor: cards.equipamentos_pendentes, cor: 'bg-amber-50 text-amber-700' },
          { rotulo: 'Projetos c/ problema', valor: cards.projetos_com_problemas, cor: 'bg-orange-50 text-orange-700' },
          { rotulo: 'Doc. faltantes',       valor: cards.documentos_faltantes,   cor: 'bg-violet-50 text-violet-700' },
          { rotulo: 'Faturas inconsist.',   valor: cards.faturas_inconsistentes, cor: 'bg-blue-50 text-blue-700' },
        ].map(c => (
          <div key={c.rotulo} className={`px-3 py-2 rounded border border-slate-100 ${c.cor}`}>
            <p className="text-[11px]">{c.rotulo}</p>
            <p className="text-lg font-bold">{c.valor ?? '—'}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-2 items-end">
            <FiltroSelect rotulo="Severidade" valor={filtros.severidade} onChange={v => setFiltros(f => ({ ...f, severidade: v }))}
              opcoes={[['todos', 'Todas'], ['critico', 'Crítico'], ['erro', 'Erro'], ['aviso', 'Aviso'], ['info', 'Info']]} />
            <FiltroSelect rotulo="Origem" valor={filtros.origem} onChange={v => setFiltros(f => ({ ...f, origem: v }))}
              opcoes={[['todos', 'Todas'], ...Object.entries(ORIGEM_LABEL)]} />
            <FiltroSelect rotulo="Status" valor={filtros.status} onChange={v => setFiltros(f => ({ ...f, status: v }))}
              opcoes={[['aberto', 'Abertos'], ['resolvido', 'Resolvidos'], ['arquivado', 'Arquivados'], ['todos', 'Todos']]} />
            <div className="flex-1 min-w-48">
              <label className="text-[11px] text-slate-500 block mb-0.5">Busca livre</label>
              <input value={filtros.q} onChange={e => setFiltros(f => ({ ...f, q: e.target.value }))}
                placeholder="filtrar por título/descrição"
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Lista de alertas */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-slate-900">Alertas ({dados?.total ?? 0})</h3>
        </CardHeader>
        <CardBody className="p-0">
          {!carregando && (dados?.itens || []).length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              ✓ Nenhum alerta encontrado com os filtros atuais.
            </p>
          )}
          <ul className="divide-y divide-slate-100">
            {(dados?.itens || []).map(a => {
              const cfg = SEV_CONFIG[a.severidade] || SEV_CONFIG.info
              const Ic = cfg.icone
              return (
                <li key={a.id} className="px-4 py-3 hover:bg-slate-50">
                  <div className="flex items-start gap-3">
                    <span className={`p-1.5 rounded-full border ${cfg.cor} shrink-0 mt-0.5`}><Ic size={14} /></span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900 truncate">{a.titulo}</p>
                        <div className="flex items-center gap-1 text-[10px] shrink-0">
                          <span className={`px-1.5 py-0.5 rounded ${cfg.cor.split(' ').slice(0, 2).join(' ')}`}>{cfg.label}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{ORIGEM_LABEL[a.origem] || a.origem}</span>
                          {a.status === 'resolvido' && <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">resolvido</span>}
                          {a.status === 'arquivado' && <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">arquivado</span>}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{a.descricao}</p>
                      {a.acao_recomendada && (
                        <p className="text-[11px] text-indigo-700 mt-0.5">💡 {a.acao_recomendada}</p>
                      )}
                      {a.observacao && (
                        <p className="text-[11px] text-slate-500 mt-0.5">📝 {a.observacao}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                        <span>{a.data ? new Date(a.data).toLocaleDateString('pt-BR') : ''}</span>
                        {a.link && (
                          <button onClick={() => nav(a.link)} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
                            Ir para resolução <ExternalLink size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {a.status !== 'resolvido' && a.status !== 'arquivado' && (
                        <>
                          <button onClick={() => setAcaoModal({ alerta: a, tipo: 'resolver' })}
                            className="text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded flex items-center gap-1">
                            <CheckCircle size={11} /> Resolver
                          </button>
                          <button onClick={() => setAcaoModal({ alerta: a, tipo: 'arquivar' })}
                            className="text-xs px-2 py-1 text-slate-600 hover:bg-slate-100 rounded flex items-center gap-1">
                            <Archive size={11} /> Arquivar
                          </button>
                        </>
                      )}
                      {(a.status === 'resolvido' || a.status === 'arquivado') && (
                        <button onClick={() => executarAcao(a, 'reabrir')}
                          className="text-xs px-2 py-1 text-indigo-600 hover:bg-indigo-50 rounded">
                          Reabrir
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </CardBody>
      </Card>

      {/* Modal de ação com observação */}
      {acaoModal && (
        <ModalAcao
          alerta={acaoModal.alerta}
          tipo={acaoModal.tipo}
          onFechar={() => setAcaoModal(null)}
          onConfirmar={(obs) => executarAcao(acaoModal.alerta, acaoModal.tipo, obs)}
        />
      )}
    </div>
  )
}

function FiltroSelect({ rotulo, valor, onChange, opcoes }) {
  return (
    <div>
      <label className="text-[11px] text-slate-500 block mb-0.5">{rotulo}</label>
      <select value={valor} onChange={e => onChange(e.target.value)}
        className="px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
        {opcoes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}

function ModalAcao({ alerta, tipo, onFechar, onConfirmar }) {
  const [obs, setObs] = useState('')
  const titulo = tipo === 'resolver' ? 'Resolver alerta' : tipo === 'arquivar' ? 'Arquivar alerta' : 'Confirmar'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onFechar}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-semibold text-slate-900">{titulo}</h4>
          <button onClick={onFechar} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <p className="text-slate-700"><strong>{alerta.titulo}</strong></p>
          <p className="text-xs text-slate-500">{alerta.descricao}</p>
          <textarea value={obs} onChange={e => setObs(e.target.value)}
            placeholder="Observação (opcional)"
            className="w-full h-20 px-2 py-1.5 border border-slate-300 rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onFechar} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
          <button onClick={() => onConfirmar(obs || null)}
            className={`px-4 py-1.5 rounded text-sm font-medium text-white flex items-center gap-1 ${tipo === 'resolver' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-600 hover:bg-slate-700'}`}>
            <Save size={12} /> Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}
