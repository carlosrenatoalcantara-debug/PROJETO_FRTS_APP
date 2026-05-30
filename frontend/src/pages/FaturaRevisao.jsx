import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Check, AlertTriangle, X, Save, FileText, ChevronRight, Loader, Zap, TrendingUp, Gauge, Sun } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'

/**
 * FaturaRevisao — Sprint 8.5
 * Tela de revisão humana da fatura normalizada (filosofia do Catálogo Inteligente).
 * Mostra cada campo com ✓ (confirmado), ⚠ (dúvida) ou ❌ (ausente). Operador edita,
 * confirma e aprova; só então o sistema cria Cliente. Dois modos:
 *   - upload de PDF → /api/faturas/analisar
 *   - listagem das faturas pendentes (status_revisao=pendente)
 */
const SEV_COR = { erro: 'bg-red-50 border-red-200 text-red-700', aviso: 'bg-amber-50 border-amber-200 text-amber-700', info: 'bg-slate-50 border-slate-200 text-slate-600' }

export default function FaturaRevisao() {
  const navigate = useNavigate()
  const [pendentes, setPendentes] = useState([])
  const [fatura, setFatura] = useState(null)
  const [loading, setLoading] = useState(false)
  const [arquivo, setArquivo] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => { carregarPendentes() }, [])

  async function carregarPendentes() {
    try {
      const r = await fetch('/api/faturas?status=pendente')
      const d = await r.json().catch(() => null)
      if (r.ok && d?.itens) setPendentes(d.itens)
    } catch { /* offline ok */ }
  }

  async function analisar() {
    if (!arquivo) return
    try {
      setLoading(true); setMsg(null)
      const fd = new FormData(); fd.append('pdf', arquivo)
      const r = await fetch('/api/faturas/analisar', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) throw new Error(d.erro || 'Falha ao analisar')
      setFatura(d.fatura)
      setMsg({ tipo: 'sucesso', texto: `Fatura analisada (${d.fatura.alertas?.length || 0} alertas). ${d.persistida ? '' : '⚠ Não persistida (DB offline).'}` })
      carregarPendentes()
    } catch (e) { setMsg({ tipo: 'erro', texto: e.message }) }
    finally { setLoading(false) }
  }

  async function abrirFatura(id) {
    setLoading(true)
    try {
      const r = await fetch(`/api/faturas/${id}`)
      const d = await r.json()
      if (r.ok) setFatura(d.item)
    } finally { setLoading(false) }
  }

  async function corrigirCampo(caminho, valor) {
    if (!fatura?._id) return
    try {
      const r = await fetch(`/api/faturas/${fatura._id}/campo`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caminho, valor }),
      })
      const d = await r.json()
      if (r.ok) { setFatura(d.item); setMsg({ tipo: 'sucesso', texto: `Campo "${caminho}" salvo.` }) }
      else setMsg({ tipo: 'erro', texto: d.erro })
    } catch (e) { setMsg({ tipo: 'erro', texto: e.message }) }
  }

  async function aprovar() {
    if (!fatura?._id) return
    try {
      const r = await fetch(`/api/faturas/${fatura._id}/aprovar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.erro || 'Falha ao aprovar')
      setMsg({ tipo: 'sucesso', texto: `Fatura aprovada. Cliente: ${d.cliente_id || '—'}` })
      carregarPendentes()
    } catch (e) { setMsg({ tipo: 'erro', texto: e.message }) }
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><FileText size={22} /> Revisão de Faturas</h1>
        <button onClick={() => navigate('/projetos-fv')} className="text-sm text-slate-500 hover:text-slate-700">← Voltar</button>
      </div>

      {msg && <div className={`px-4 py-2 rounded border text-sm ${msg.tipo === 'erro' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>{msg.texto}</div>}

      {!fatura && (
        <Card>
          <CardHeader className="flex items-center gap-2"><Upload size={18} className="text-blue-600" /><h3 className="font-semibold">Analisar nova fatura</h3></CardHeader>
          <CardBody>
            <div className="flex items-center gap-3">
              <input type="file" accept=".pdf" onChange={(e) => setArquivo(e.target.files?.[0])} className="text-sm" />
              <button onClick={analisar} disabled={!arquivo || loading} className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm font-medium">
                {loading ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />} Analisar
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">O sistema lê, interpreta, valida e mostra dúvidas para revisão humana antes de criar Cliente.</p>
          </CardBody>
        </Card>
      )}

      {!fatura && pendentes.length > 0 && (
        <Card>
          <CardHeader><h3 className="font-semibold">Pendentes de revisão ({pendentes.length})</h3></CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-slate-100">
              {pendentes.map((p) => (
                <li key={p._id} className="px-4 py-3 hover:bg-slate-50 flex items-center justify-between cursor-pointer" onClick={() => abrirFatura(p._id)}>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{p.concessionaria_detectada?.concessionaria || '—'} · UC {p.unidade_consumidora?.numero_uc?.valor || '—'}</p>
                    <p className="text-xs text-slate-500">{(p.alertas || []).length} alerta(s)</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-400" />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {fatura && <Detalhe fatura={fatura} onVoltar={() => setFatura(null)} onCorrigir={corrigirCampo} onAprovar={aprovar} />}
    </div>
  )
}

function Detalhe({ fatura, onVoltar, onCorrigir, onAprovar }) {
  const Campo = ({ rotulo, caminho, valor, fonte, confianca }) => {
    const [editando, setEditando] = useState(false)
    const [v, setV] = useState(valor ?? '')
    const icone = valor == null
      ? <X size={14} className="text-red-500" />
      : confianca >= 0.8 ? <Check size={14} className="text-emerald-600" /> : <AlertTriangle size={14} className="text-amber-500" />
    return (
      <div className="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0">
        {icone}
        <span className="text-xs text-slate-500 w-40">{rotulo}</span>
        {!editando ? (
          <>
            <span className="text-sm text-slate-700 flex-1">{valor == null ? '—' : String(valor)}</span>
            <span className="text-[10px] text-slate-400 mr-2">{fonte} · {(confianca * 100).toFixed(0)}%</span>
            <button onClick={() => setEditando(true)} className="text-xs text-indigo-600 hover:text-indigo-800">Editar</button>
          </>
        ) : (
          <>
            <input value={v} onChange={(e) => setV(e.target.value)} className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm" />
            <button onClick={() => { onCorrigir(caminho, v); setEditando(false) }} className="text-xs text-emerald-700 hover:text-emerald-800"><Save size={12} /> salvar</button>
            <button onClick={() => setEditando(false)} className="text-xs text-slate-500 ml-1">cancelar</button>
          </>
        )}
      </div>
    )
  }

  const cl = fatura.cliente || {}
  const uc = fatura.unidade_consumidora || {}
  const cf = fatura.classificacao || {}
  const lig = fatura.ligacao || {}

  return (
    <>
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h3 className="font-semibold">{fatura.concessionaria_detectada?.concessionaria || '—'} ({fatura.concessionaria_detectada?.estado || '—'})</h3>
          <button onClick={onVoltar} className="text-xs text-slate-500 hover:text-slate-700">← lista</button>
        </CardHeader>
        <CardBody>
          {(fatura.alertas || []).map((a, i) => (
            <div key={i} className={`text-xs px-3 py-2 rounded border mb-1 ${SEV_COR[a.severidade] || SEV_COR.info}`}>
              <strong>{a.severidade.toUpperCase()}</strong> · {a.campo}: {a.mensagem}
            </div>
          ))}

          <h4 className="text-sm font-semibold text-slate-700 mt-4 mb-1">Cliente</h4>
          <Campo rotulo="Nome"     caminho="cliente.nome"     valor={cl.nome?.valor}     fonte={cl.nome?.fonte}     confianca={cl.nome?.confianca || 0} />
          <Campo rotulo="CPF/CNPJ" caminho="cliente.cpf_cnpj" valor={cl.cpf_cnpj?.valor} fonte={cl.cpf_cnpj?.fonte} confianca={cl.cpf_cnpj?.confianca || 0} />
          <Campo rotulo="Endereço" caminho="cliente.endereco" valor={cl.endereco?.valor} fonte={cl.endereco?.fonte} confianca={cl.endereco?.confianca || 0} />
          <Campo rotulo="Cidade"   caminho="cliente.cidade"   valor={cl.cidade?.valor}   fonte={cl.cidade?.fonte}   confianca={cl.cidade?.confianca || 0} />
          <Campo rotulo="UF"       caminho="cliente.uf"       valor={cl.uf?.valor}       fonte={cl.uf?.fonte}       confianca={cl.uf?.confianca || 0} />
          <Campo rotulo="CEP"      caminho="cliente.cep"      valor={cl.cep?.valor}      fonte={cl.cep?.fonte}      confianca={cl.cep?.confianca || 0} />

          <h4 className="text-sm font-semibold text-slate-700 mt-4 mb-1">Unidade Consumidora</h4>
          <Campo rotulo="UC"             caminho="unidade_consumidora.numero_uc"      valor={uc.numero_uc?.valor}      fonte={uc.numero_uc?.fonte}      confianca={uc.numero_uc?.confianca || 0} />
          <Campo rotulo="Concessionária" caminho="unidade_consumidora.concessionaria" valor={uc.concessionaria?.valor} fonte={uc.concessionaria?.fonte} confianca={uc.concessionaria?.confianca || 0} />

          <h4 className="text-sm font-semibold text-slate-700 mt-4 mb-1">Classificação & Ligação</h4>
          <Campo rotulo="Grupo"       caminho="classificacao.grupo"             valor={cf.grupo?.valor}                fonte={cf.grupo?.fonte}                confianca={cf.grupo?.confianca || 0} />
          <Campo rotulo="Modalidade"  caminho="classificacao.modalidade_tarifaria" valor={cf.modalidade_tarifaria?.valor} fonte={cf.modalidade_tarifaria?.fonte} confianca={cf.modalidade_tarifaria?.confianca || 0} />
          <Campo rotulo="Ligação"     caminho="ligacao.tipo"                    valor={lig.tipo?.valor}               fonte={lig.tipo?.fonte}               confianca={lig.tipo?.confianca || 0} />

          {fatura.historico_consumo?.length > 0 && (
            <>
              <h4 className="text-sm font-semibold text-slate-700 mt-4 mb-1">Histórico ({fatura.historico_consumo.length}/12 meses)</h4>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1 text-xs">
                {fatura.historico_consumo.map((h, i) => (
                  <div key={i} className="bg-slate-50 px-2 py-1 rounded text-center">
                    <p className="text-slate-500">{h.mes}/{String(h.ano).slice(-2)}</p>
                    <p className="font-semibold text-slate-700">{h.kwh} kWh</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Média 12m: <strong>{fatura.analise?.consumo_medio_12m ?? '—'}</strong> · maior: {fatura.analise?.maior_consumo ?? '—'} · menor: {fatura.analise?.menor_consumo ?? '—'}
              </p>
            </>
          )}

          {fatura.geracao_existente?.possui_gd?.valor && (
            <div className="mt-4 px-3 py-2 rounded border bg-amber-50 border-amber-200 text-amber-800 text-xs">
              ⚠ {fatura.geracao_existente.alerta || 'GD detectada.'} Energia injetada: {fatura.geracao_existente.energia_injetada?.valor ?? '—'} kWh
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-2">
            <button onClick={onAprovar} className="flex items-center gap-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-medium">
              <Check size={14} /> Aprovar e criar cliente
            </button>
          </div>
        </CardBody>
      </Card>

      {/* S8.9 — Dashboard energético */}
      <DashboardEnergetico fatura={fatura} />
    </>
  )
}

/**
 * DashboardEnergetico — Sprint 8.9
 * Análise avançada da fatura: demanda/ultrapassagem (Grupo A), tarifação ponta/
 * fora-ponta, GD (saldo/compensação/autossuficiência), sazonalidade, consistência.
 * Busca em /api/faturas/:id/analise se persistida; senão POST /api/faturas/analise.
 */
function DashboardEnergetico({ fatura }) {
  const [dash, setDash] = useState(null)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    const req = fatura?._id
      ? fetch(`/api/faturas/${fatura._id}/analise`).then(r => r.json())
      : fetch('/api/faturas/analise', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fatura }) }).then(r => r.json())
    req.then(d => { if (vivo && d?.dashboard) setDash(d.dashboard) })
      .catch(() => {})
      .finally(() => vivo && setCarregando(false))
    return () => { vivo = false }
  }, [fatura])

  if (carregando) return <Card className="mt-4"><CardBody><div className="flex items-center gap-2 text-slate-500 text-sm"><Loader size={14} className="animate-spin" /> Analisando energia…</div></CardBody></Card>
  if (!dash) return null

  const KPI = ({ icone: Ic, cor, rotulo, valor, sub }) => (
    <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
      <div className={`p-1.5 rounded ${cor}`}><Ic size={14} /></div>
      <div>
        <p className="text-[10px] text-slate-500">{rotulo}</p>
        <p className="text-sm font-bold text-slate-900">{valor ?? '—'}</p>
        {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
      </div>
    </div>
  )

  const d = dash.demanda || {}
  const t = dash.tarifacao || {}
  const gd = dash.gd || {}
  const sz = dash.sazonalidade || {}
  const cons = dash.consistencia || {}

  return (
    <Card className="mt-4">
      <CardHeader className="flex items-center gap-2">
        <Zap size={16} className="text-amber-500" />
        <h3 className="font-semibold text-slate-900">Dashboard Energético</h3>
        <span className="ml-auto text-xs text-slate-500">Prontidão p/ proposta: <strong className={dash.prontidao_proposta >= 70 ? 'text-emerald-600' : 'text-amber-600'}>{dash.prontidao_proposta}%</strong></span>
      </CardHeader>
      <CardBody className="space-y-4">
        {/* KPIs principais */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <KPI icone={TrendingUp} cor="bg-blue-100 text-blue-700" rotulo="Consumo médio" valor={dash.consumo_medio_kwh != null ? `${dash.consumo_medio_kwh} kWh` : '—'} />
          <KPI icone={Sun} cor="bg-amber-100 text-amber-700" rotulo="FV estimado" valor={dash.dimensionamento_sugerido?.potencia_fv_estimada_kwp != null ? `${dash.dimensionamento_sugerido.potencia_fv_estimada_kwp} kWp` : '—'} sub="regra de bolso" />
          <KPI icone={Gauge} cor="bg-violet-100 text-violet-700" rotulo="Grupo / Modalidade" valor={`${dash.grupo}${dash.modalidade ? ` · ${dash.modalidade}` : ''}`} />
          <KPI icone={Zap} cor="bg-emerald-100 text-emerald-700" rotulo="Sazonalidade" valor={sz.calculavel ? sz.sazonalidade : '—'} sub={sz.calculavel ? `±${sz.amplitude_pct}%` : ''} />
        </div>

        {/* Grupo A — Demanda */}
        {d.aplicavel && d.calculavel && (
          <div className={`rounded-lg border px-3 py-2 ${d.ultrapassou ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <p className="text-xs font-semibold text-slate-700 mb-1">Demanda (Grupo A)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs">
              <span className="text-slate-600">Contratada: <strong>{d.demanda_contratada} kW</strong></span>
              <span className="text-slate-600">Medida: <strong>{d.demanda_medida} kW</strong></span>
              <span className="text-slate-600">Utilização: <strong>{d.utilizacao_pct}%</strong></span>
              <span className={d.ultrapassou ? 'text-red-700 font-semibold' : 'text-emerald-700'}>
                {d.ultrapassou ? `Ultrapassagem: ${d.excedente_kw} kW` : `Folga: ${d.folga_kw} kW`}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{d.recomendacao}</p>
          </div>
        )}

        {/* Tarifação ponta/fora-ponta */}
        {t.aplicavel && t.consumo_total && (
          <div className="rounded-lg border border-slate-100 px-3 py-2">
            <p className="text-xs font-semibold text-slate-700 mb-1">Tarifação</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-600">Ponta: <strong>{t.consumo_ponta ?? '—'} kWh ({t.pct_ponta ?? '—'}%)</strong></span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-600">Fora-ponta: <strong>{t.consumo_fora_ponta ?? '—'} kWh ({t.pct_fora_ponta ?? '—'}%)</strong></span>
            </div>
          </div>
        )}

        {/* GD */}
        {gd.possui_gd && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs font-semibold text-amber-800 mb-1">Geração Distribuída existente</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs text-amber-800">
              <span>Injetada: <strong>{gd.energia_injetada ?? '—'} kWh</strong></span>
              <span>Créditos: <strong>{gd.creditos_kwh ?? '—'} kWh</strong></span>
              <span>Compensação: <strong>{gd.compensacao_kwh ?? '—'} kWh</strong></span>
              <span>Autossuf.: <strong>{gd.autossuficiencia_pct != null ? `${gd.autossuficiencia_pct}%` : '—'}</strong></span>
            </div>
          </div>
        )}

        {/* Consistência */}
        {cons.total_problemas > 0 && (
          <div className="rounded-lg border border-slate-100 px-3 py-2">
            <p className="text-xs font-semibold text-slate-700 mb-1">Consistência das leituras ({cons.total_problemas})</p>
            {cons.problemas.map((p, i) => (
              <p key={i} className={`text-[11px] ${p.severidade === 'erro' ? 'text-red-600' : 'text-amber-600'}`}>• {p.detalhe}</p>
            ))}
          </div>
        )}
        {cons.consistente && cons.total_problemas === 0 && (
          <p className="text-xs text-emerald-600">✓ Leituras consistentes, sem anomalias detectadas.</p>
        )}
      </CardBody>
    </Card>
  )
}
