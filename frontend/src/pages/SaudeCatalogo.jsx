import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity, CheckCircle, Clock, Ban, FileX, Award, Shield, Loader, ArrowLeft,
  AlertTriangle, Copy, RefreshCw, ChevronDown, ChevronUp, Zap, BarChart2
} from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'

/**
 * SaudeCatalogo — Sprint 8.6 + 8.6.4
 * Painel completo de diagnóstico e QA do catálogo técnico:
 *  • Saúde geral (por aprovação, completude, datasheet/cert/garantia)
 *  • Saúde específica de inversores (campos críticos: MPPT, Vmax, tensões…)
 *  • Lista de auditoria (equipamentos com < 80% completude)
 *  • Duplicatas detectadas (mesmo fabricante + prefixo modelo)
 *  • Botão de reprocessamento em lote (não sobrescreve manuais)
 */
export default function SaudeCatalogo() {
  const nav = useNavigate()
  const [diag, setDiag] = useState(null)
  const [qaInv, setQaInv] = useState(null)
  const [auditoria, setAuditoria] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [abaAtiva, setAbaAtiva] = useState('geral')
  const [selecionados, setSelecionados] = useState(new Set())
  const [reprocessando, setReprocessando] = useState(false)
  const [msgRep, setMsgRep] = useState(null)
  const [expandidoGrupo, setExpandidoGrupo] = useState(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true); setErro(null)
    try {
      const [rDiag, rQa, rAudit] = await Promise.all([
        fetch('/api/admin/catalogo/diagnostico').then(r => r.json()),
        fetch('/api/admin/catalogo/qa/inversores').then(r => r.json()),
        fetch('/api/admin/catalogo/qa/auditoria?minimo_pct=80').then(r => r.json()),
      ])
      if (rDiag.sucesso) setDiag(rDiag.diagnostico)
      if (rQa.sucesso)  setQaInv(rQa)
      if (rAudit.sucesso) setAuditoria(rAudit)
    } catch (e) { setErro(e.message) }
    finally { setLoading(false) }
  }

  async function reprocessarSelecionados() {
    if (!selecionados.size) return
    setReprocessando(true); setMsgRep(null)
    try {
      const r = await fetch('/api/admin/catalogo/lote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selecionados], acao: 'reprocessar' }),
      })
      const d = await r.json()
      setMsgRep(d.sucesso ? `✅ ${d.afetados} equipamento(s) reprocessado(s).` : `❌ ${d.erro}`)
      setSelecionados(new Set())
      setTimeout(carregar, 800)
    } catch (e) { setMsgRep(`❌ ${e.message}`) }
    finally { setReprocessando(false) }
  }

  const toggleSel = (id) => setSelecionados(prev => {
    const n = new Set(prev)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  const KPI = ({ icone: Icone, cor, rotulo, valor }) => (
    <Card>
      <CardBody className="flex items-center gap-3 py-3">
        <div className={`p-2 rounded ${cor}`}><Icone size={16} /></div>
        <div>
          <p className="text-[11px] text-slate-500">{rotulo}</p>
          <p className="text-xl font-bold text-slate-900">{valor ?? '—'}</p>
        </div>
      </CardBody>
    </Card>
  )

  const ABAS = [
    { id: 'geral', label: 'Saúde geral', icone: Activity },
    { id: 'inversores', label: 'Inversores QA', icone: Zap },
    { id: 'auditoria', label: 'Auditoria', icone: AlertTriangle },
    { id: 'duplicatas', label: 'Duplicatas', icone: Copy },
  ]

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => nav(-1)} className="p-1.5 rounded hover:bg-slate-100"><ArrowLeft size={16} /></button>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><BarChart2 size={20} /> Saúde do Catálogo</h1>
        </div>
        <button onClick={carregar} disabled={loading} className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">
          {loading ? <Loader size={13} className="animate-spin" /> : <RefreshCw size={13} />} Atualizar
        </button>
      </div>

      {erro && <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{erro}</div>}

      {/* Abas */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {ABAS.map(a => (
          <button key={a.id} onClick={() => setAbaAtiva(a.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 ${abaAtiva === a.id ? 'text-indigo-600 border-indigo-600' : 'text-slate-500 border-transparent hover:text-slate-700'}`}>
            <a.icone size={14} /> {a.label}
          </button>
        ))}
      </div>

      {/* ── ABA: Saúde geral ────────────────────────────────────────────── */}
      {abaAtiva === 'geral' && diag && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI icone={Activity}    cor="bg-blue-100 text-blue-700"      rotulo="Total"      valor={diag.total_equipamentos} />
            <KPI icone={CheckCircle} cor="bg-emerald-100 text-emerald-700" rotulo="Aprovados"  valor={diag.aprovados} />
            <KPI icone={Clock}       cor="bg-amber-100 text-amber-700"    rotulo="Pendentes"  valor={diag.pendentes} />
            <KPI icone={Ban}         cor="bg-red-100 text-red-700"        rotulo="Bloqueados" valor={diag.bloqueados} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <KPI icone={FileX}  cor="bg-slate-100 text-slate-600" rotulo="Sem datasheet"    valor={diag.sem_datasheet} />
            <KPI icone={Shield} cor="bg-slate-100 text-slate-600" rotulo="Sem certificação" valor={diag.sem_certificacao} />
            <KPI icone={Award}  cor="bg-slate-100 text-slate-600" rotulo="Sem garantia"     valor={diag.sem_garantia} />
          </div>
          <Card>
            <CardHeader><h3 className="font-semibold text-slate-900">Completude média</h3></CardHeader>
            <CardBody>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${diag.completude_media_pct}%` }} />
                </div>
                <span className="text-sm font-semibold tabular-nums">{diag.completude_media_pct}%</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Abaixo de 80% = necessita revisão técnica.</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader><h3 className="font-semibold text-slate-900">Por tipo</h3></CardHeader>
            <CardBody>
              <ul className="space-y-1 text-sm">
                {Object.entries(diag.por_tipo || {}).map(([t, n]) => (
                  <li key={t} className="flex justify-between border-b border-slate-50 py-1">
                    <span className="capitalize text-slate-600">{t.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-slate-900">{n}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </>
      )}

      {/* ── ABA: Inversores QA ───────────────────────────────────────────── */}
      {abaAtiva === 'inversores' && qaInv && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI icone={Activity}    cor="bg-blue-100 text-blue-700"      rotulo="Total inversores"    valor={qaInv.relatorio.total} />
            <KPI icone={CheckCircle} cor="bg-emerald-100 text-emerald-700" rotulo="Aprovados"           valor={qaInv.relatorio.por_status.aprovado} />
            <KPI icone={Clock}       cor="bg-amber-100 text-amber-700"    rotulo="Pendentes"            valor={qaInv.relatorio.por_status.pendente} />
            <KPI icone={RefreshCw}   cor="bg-violet-100 text-violet-700"  rotulo="Precisam reprocess."  valor={qaInv.relatorio.precisam_reprocessamento} />
          </div>

          <Card>
            <CardHeader><h3 className="font-semibold text-slate-900">Campos críticos — quantos sem cada campo</h3></CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(qaInv.relatorio.campos_faltando).map(([campo, qtd]) => {
                  const pct = qaInv.relatorio.total > 0 ? Math.round((qtd / qaInv.relatorio.total) * 100) : 0
                  const cor = pct === 0 ? 'bg-emerald-100 text-emerald-800' : pct < 30 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                  return (
                    <div key={campo} className={`text-xs rounded px-2 py-1.5 ${cor} flex items-center justify-between`}>
                      <span>{campo}</span>
                      <span className="font-bold ml-2">{qtd === 0 ? '✓' : `${qtd} (${pct}%)`}</span>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Completude média: <strong>{qaInv.relatorio.completude_media_pct}%</strong>
              </p>
            </CardBody>
          </Card>

          {/* Lista detalhada por inversor */}
          <Card>
            <CardHeader><h3 className="font-semibold text-slate-900">Por equipamento</h3></CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white border-b border-slate-100">
                    <tr>
                      {['Fabricante', 'Modelo', 'Completude', 'Campos faltando', 'Datasheet'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-slate-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {qaInv.relatorio.lista.sort((a, b) => a.completude_pct - b.completude_pct).map(eq => (
                      <tr key={String(eq._id)} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-800">{eq.fabricante || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{eq.modelo || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`font-bold ${eq.completude_pct >= 80 ? 'text-emerald-600' : eq.completude_pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                            {eq.completude_pct}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {eq.campos_faltando.length === 0 ? '✓ completo' : eq.campos_faltando.slice(0, 3).join(', ') + (eq.campos_faltando.length > 3 ? ` +${eq.campos_faltando.length - 3}` : '')}
                        </td>
                        <td className="px-3 py-2">
                          {eq.tem_datasheet ? <span className="text-emerald-600">✓</span> : <span className="text-red-500">❌</span>}
                        </td>
                      </tr>
                    ))}
                    {qaInv.relatorio.lista.length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">Nenhum inversor cadastrado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </>
      )}

      {/* ── ABA: Auditoria ───────────────────────────────────────────────── */}
      {abaAtiva === 'auditoria' && auditoria && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              <strong>{auditoria.total_problemas}</strong> equipamento(s) com completude &lt; {auditoria.minimo_pct}%.
            </p>
            {selecionados.size > 0 && (
              <button onClick={reprocessarSelecionados} disabled={reprocessando}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded text-xs font-medium">
                {reprocessando ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Reprocessar {selecionados.size} selecionado(s)
              </button>
            )}
          </div>
          {msgRep && <div className={`text-sm px-3 py-2 rounded ${msgRep.startsWith('✅') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msgRep}</div>}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-100 rounded">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-2 py-2"><input type="checkbox" onChange={e => setSelecionados(e.target.checked ? new Set(auditoria.lista.map(i => String(i._id))) : new Set())} /></th>
                  {['Tipo', 'Fabricante', 'Modelo', 'Completude', 'Ausentes', 'Datasheet', 'Reprocess.'].map(h => (
                    <th key={h} className="text-left px-2 py-2 text-slate-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {auditoria.lista.map(eq => (
                  <tr key={String(eq._id)} className={`hover:bg-slate-50 ${selecionados.has(String(eq._id)) ? 'bg-violet-50' : ''}`}>
                    <td className="px-2 py-2"><input type="checkbox" checked={selecionados.has(String(eq._id))} onChange={() => toggleSel(String(eq._id))} /></td>
                    <td className="px-2 py-2 capitalize text-slate-600">{eq.tipo}</td>
                    <td className="px-2 py-2 font-medium text-slate-800">{eq.fabricante || '—'}</td>
                    <td className="px-2 py-2 text-slate-600">{eq.modelo || '—'}</td>
                    <td className="px-2 py-2">
                      <span className={`font-bold ${eq.completude_pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{eq.completude_pct}%</span>
                    </td>
                    <td className="px-2 py-2 text-slate-500">{eq.campos_ausentes}</td>
                    <td className="px-2 py-2">{!eq.sem_datasheet ? <span className="text-emerald-600">✓</span> : <span className="text-red-500">❌</span>}</td>
                    <td className="px-2 py-2">{eq.precisa_reprocessamento ? <span className="text-violet-600 font-medium">sim</span> : '—'}</td>
                  </tr>
                ))}
                {auditoria.lista.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-4 text-center text-emerald-600 font-medium">✓ Todos os equipamentos estão com ≥ {auditoria.minimo_pct}% de completude!</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── ABA: Duplicatas ─────────────────────────────────────────────── */}
      {abaAtiva === 'duplicatas' && qaInv && (
        <>
          <p className="text-sm text-slate-600">
            <strong>{qaInv.duplicatas.total_grupos}</strong> grupo(s) de possíveis duplicatas (mesmo fabricante + prefixo de modelo). Nenhuma é removida automaticamente.
          </p>
          {qaInv.duplicatas.total_grupos === 0 && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-700">✓ Nenhuma duplicata detectada no catálogo de inversores.</div>
          )}
          <div className="space-y-2">
            {qaInv.duplicatas.grupos.map((g, i) => (
              <Card key={i}>
                <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50"
                  onClick={() => setExpandidoGrupo(expandidoGrupo === i ? null : i)}>
                  <div>
                    <span className="font-medium text-slate-900">{g.fabricante}</span>
                    <span className="text-slate-500 ml-2">· prefixo "{g.prefixo}"</span>
                    <span className="ml-2 text-xs bg-amber-100 text-amber-800 rounded px-1.5 py-0.5">{g.docs.length} equipamentos</span>
                  </div>
                  {expandidoGrupo === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
                {expandidoGrupo === i && (
                  <div className="px-4 pb-3 border-t border-slate-100">
                    <table className="w-full text-xs mt-2">
                      <thead><tr className="text-slate-500 border-b border-slate-100">
                        {['Modelo', 'Completude', 'Criado em'].map(h => <th key={h} className="text-left py-1 pr-3">{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {g.docs.map((d, j) => (
                          <tr key={j} className="border-b border-slate-50">
                            <td className="py-1 pr-3 text-slate-700">{d.modelo}</td>
                            <td className="py-1 pr-3"><span className={d.completude_pct >= 70 ? 'text-emerald-600' : 'text-amber-600'}>{d.completude_pct}%</span></td>
                            <td className="py-1 text-slate-500">{d.createdAt ? new Date(d.createdAt).toLocaleDateString('pt-BR') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-[11px] text-slate-500 mt-2">💡 O primeiro item (maior completude) é o recomendado. Decida manualmente quais manter.</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
