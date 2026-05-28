import { useMemo } from 'react'
import { TrendingUp, Target, DollarSign, Percent, Filter as FunnelIcon, Users } from 'lucide-react'
import { WORKFLOW_COMERCIAL_CONFIG, getWorkflowConfig } from '../../utils/comercialGovernanca'
import { CRM_PIPELINE_CONFIG, getPipelineConfig } from '../../utils/crmComercial'
import Badge from '../ui/Badge'

/**
 * DashboardComercial — Sprint 4.2
 *
 * Métricas comerciais agregadas a partir dos projetos FV (governanca.comercial +
 * snapshot_financeiro). Sem CRM completo — visão executiva leve do funil.
 */
const brl = (v) => v == null ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })
const pctf = (v) => (v == null ? '—' : `${Number(v).toFixed(0)}%`)

export default function DashboardComercial({ projetos = [] }) {
  const m = useMemo(() => {
    const comProjetos = projetos.filter(p => p.governanca?.comercial)
    const fin = projetos.map(p => p.governanca?.snapshot_financeiro).filter(Boolean)

    const total = projetos.length
    const assinados = comProjetos.filter(p => p.governanca.comercial.workflow_status === 'ASSINADO').length
    const taxaFechamento = total > 0 ? (assinados / total) * 100 : 0

    const tickets = fin.map(f => f.proposta_final).filter(v => Number.isFinite(v))
    const ticketMedio = tickets.length ? tickets.reduce((s, v) => s + v, 0) / tickets.length : null

    const rois = fin.map(f => f.retorno_realista?.roi_pct ?? f.retorno?.roi_pct).filter(v => Number.isFinite(v))
    const roiMedio = rois.length ? rois.reduce((s, v) => s + v, 0) / rois.length : null

    const margens = fin.map(f => f.margem?.margem_liquida_pct).filter(v => Number.isFinite(v))
    const margemMedia = margens.length ? margens.reduce((s, v) => s + v, 0) / margens.length : null

    // Funil por status comercial
    const funil = {}
    for (const k of Object.keys(WORKFLOW_COMERCIAL_CONFIG)) funil[k] = 0
    for (const p of comProjetos) {
      const s = p.governanca.comercial.workflow_status || 'EM_ANALISE'
      funil[s] = (funil[s] || 0) + 1
    }

    // S5: pipeline CRM
    const pipeline = {}
    for (const p of comProjetos) {
      const s = p.governanca.comercial.crm_pipeline || 'LEAD'
      pipeline[s] = (pipeline[s] || 0) + 1
    }

    return { total, comProjetos: comProjetos.length, taxaFechamento, ticketMedio, roiMedio, margemMedia, funil, pipeline }
  }, [projetos])

  // Só exibe se houver ao menos um projeto com dados comerciais
  if (m.comProjetos === 0) return null

  const funilEntries = Object.entries(m.funil).filter(([, v]) => v > 0)
  const pipelineEntries = Object.entries(m.pipeline || {}).filter(([, v]) => v > 0)

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
        <TrendingUp size={16} className="text-indigo-600" /> Dashboard Comercial
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icone={Target}     titulo="Taxa de fechamento" valor={pctf(m.taxaFechamento)} />
        <KPI icone={DollarSign} titulo="Ticket médio"        valor={brl(m.ticketMedio)} />
        <KPI icone={TrendingUp} titulo="ROI médio (25a)"     valor={pctf(m.roiMedio)} />
        <KPI icone={Percent}    titulo="Margem média"        valor={pctf(m.margemMedia)} />
      </div>

      {funilEntries.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1"><FunnelIcon size={12} /> Funil comercial</p>
          <div className="flex flex-wrap gap-2">
            {funilEntries.map(([k, v]) => {
              const cfg = getWorkflowConfig(k)
              return (
                <span key={k} className="flex items-center gap-1.5">
                  <Badge cor={cfg.cor}>{cfg.label}</Badge>
                  <span className="text-xs font-semibold text-slate-700">{v}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {pipelineEntries.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1"><Users size={12} /> Pipeline CRM</p>
          <div className="flex flex-wrap gap-2">
            {pipelineEntries.map(([k, v]) => {
              const cfg = getPipelineConfig(k)
              return (
                <span key={k} className="flex items-center gap-1.5">
                  <Badge cor={cfg.cor}>{cfg.label}</Badge>
                  <span className="text-xs font-semibold text-slate-700">{v}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function KPI({ icone: Icone, titulo, valor }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <p className="text-xs text-slate-500 flex items-center gap-1"><Icone size={12} /> {titulo}</p>
      <p className="text-lg font-bold text-slate-900 mt-0.5">{valor}</p>
    </div>
  )
}
