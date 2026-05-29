import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, CheckCircle, Clock, Ban, FileX, Award, Shield, Loader, ArrowLeft } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'

/**
 * SaudeCatalogo — Sprint 8.6
 * Painel de diagnóstico do catálogo técnico. Agrega:
 *  • aprovação técnica (rascunho/pendente/aprovado/bloqueado)
 *  • completude média da ficha técnica
 *  • equipamentos sem datasheet / sem certificação / sem garantia
 * Endpoint: GET /api/admin/catalogo/diagnostico
 */
export default function SaudeCatalogo() {
  const nav = useNavigate()
  const [diag, setDiag] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => { carregar() }, [])
  async function carregar() {
    setLoading(true); setErro(null)
    try {
      const r = await fetch('/api/admin/catalogo/diagnostico')
      const d = await r.json()
      if (!d.sucesso) throw new Error(d.erro || 'Falha ao carregar diagnóstico')
      setDiag(d.diagnostico)
    } catch (e) { setErro(e.message) }
    finally { setLoading(false) }
  }

  const KPI = ({ icone: Icone, cor, rotulo, valor, descricao }) => (
    <Card>
      <CardBody className="flex items-center gap-3">
        <div className={`p-2 rounded ${cor}`}><Icone size={18} /></div>
        <div>
          <p className="text-xs text-slate-500">{rotulo}</p>
          <p className="text-2xl font-bold text-slate-900">{valor ?? '—'}</p>
          {descricao && <p className="text-[11px] text-slate-400">{descricao}</p>}
        </div>
      </CardBody>
    </Card>
  )

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => nav(-1)} className="p-1.5 rounded hover:bg-slate-100"><ArrowLeft size={16} /></button>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Activity size={22} /> Saúde do Catálogo</h1>
        </div>
        <button onClick={carregar} className="text-sm text-slate-500 hover:text-slate-700">Atualizar</button>
      </div>

      {loading && <div className="flex items-center gap-2 text-slate-500"><Loader size={14} className="animate-spin" /> Carregando…</div>}
      {erro && <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{erro}</div>}

      {diag && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI icone={Activity}   cor="bg-blue-100 text-blue-700"     rotulo="Total"      valor={diag.total_equipamentos} />
            <KPI icone={CheckCircle} cor="bg-emerald-100 text-emerald-700" rotulo="Aprovados" valor={diag.aprovados} />
            <KPI icone={Clock}      cor="bg-amber-100 text-amber-700"   rotulo="Pendentes"  valor={diag.pendentes} />
            <KPI icone={Ban}        cor="bg-red-100 text-red-700"       rotulo="Bloqueados" valor={diag.bloqueados} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <KPI icone={FileX}  cor="bg-slate-100 text-slate-600" rotulo="Sem datasheet"    valor={diag.sem_datasheet} />
            <KPI icone={Shield} cor="bg-slate-100 text-slate-600" rotulo="Sem certificação" valor={diag.sem_certificacao} />
            <KPI icone={Award}  cor="bg-slate-100 text-slate-600" rotulo="Sem garantia"     valor={diag.sem_garantia} />
          </div>

          <Card>
            <CardHeader><h3 className="font-semibold text-slate-900">Completude da ficha técnica</h3></CardHeader>
            <CardBody>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${diag.completude_media_pct}%` }} />
                </div>
                <span className="text-sm font-semibold text-slate-700 tabular-nums">{diag.completude_media_pct}%</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Média de campos preenchidos por equipamento. Equipamentos abaixo de 80% precisam de revisão técnica.</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h3 className="font-semibold text-slate-900">Distribuição por tipo</h3></CardHeader>
            <CardBody>
              <ul className="space-y-1 text-sm">
                {Object.entries(diag.por_tipo || {}).map(([t, n]) => (
                  <li key={t} className="flex items-center justify-between border-b border-slate-50 py-1">
                    <span className="capitalize text-slate-600">{t.replace('_', ' ')}</span>
                    <span className="font-medium text-slate-900">{n}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
