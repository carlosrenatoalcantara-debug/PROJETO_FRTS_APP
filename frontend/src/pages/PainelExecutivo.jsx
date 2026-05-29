import { useState, useEffect } from 'react'
import { TrendingUp, Sun, DollarSign, Briefcase, Activity, Download, RefreshCw } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import { exportarCSV } from '../utils/exportar'

/**
 * PainelExecutivo — Sprint 7.3
 * Dashboard executivo + health da plataforma, sobre dados reais (/api/painel).
 */
const brl = (v) => v == null ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })
const numf = (v) => v == null ? '—' : Number(v).toLocaleString('pt-BR')
const pctf = (v) => v == null ? '—' : `${Number(v).toFixed(1)}%`

export default function PainelExecutivo() {
  const [exec, setExec] = useState(null)
  const [health, setHealth] = useState(null)
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(true)

  function carregar() {
    setCarregando(true); setErro(null)
    Promise.all([
      fetch('/api/painel/executivo').then(r => r.json()),
      fetch('/api/painel/health').then(r => r.json()),
    ]).then(([e, h]) => {
      if (!e.sucesso) throw new Error(e.erro || 'Falha no painel')
      setExec(e); setHealth(h.sucesso ? h.plataforma : null)
    }).catch(err => setErro(err.message)).finally(() => setCarregando(false))
  }
  useEffect(() => { carregar() }, [])

  function exportar() {
    if (!exec) return
    const linhas = [
      { indicador: 'Projetos total', valor: exec.projetos.total },
      { indicador: 'Em andamento', valor: exec.projetos.em_andamento },
      { indicador: 'Congelados', valor: exec.projetos.congelados },
      { indicador: 'Homologados', valor: exec.projetos.homologados },
      { indicador: 'Taxa conversão %', valor: exec.comercial.taxa_conversao_pct },
      { indicador: 'kWp vendidos', valor: exec.energia.kwp_vendidos },
      { indicador: 'kWp instalados', valor: exec.energia.kwp_instalados },
      { indicador: 'Geração anual kWh', valor: exec.energia.geracao_anual_kwh },
      { indicador: 'Valor total propostas', valor: exec.financeiro.valor_total_propostas },
      { indicador: 'Valor vendido', valor: exec.financeiro.valor_vendido },
      { indicador: 'Ticket médio', valor: exec.financeiro.ticket_medio },
      { indicador: 'Margem média %', valor: exec.financeiro.margem_media_pct },
      { indicador: 'ROI médio %', valor: exec.financeiro.roi_medio_pct },
      { indicador: 'Payback médio anos', valor: exec.financeiro.payback_medio_anos },
    ]
    exportarCSV(linhas, 'painel-executivo', [{ chave: 'indicador', rotulo: 'Indicador' }, { chave: 'valor', rotulo: 'Valor' }])
  }

  if (carregando) return <div className="p-8 text-center text-slate-500">Carregando painel…</div>
  if (erro) return (
    <div className="p-6">
      <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 text-sm mb-3">⚠️ {erro}</div>
      <button onClick={carregar} className="text-sm text-blue-600 hover:underline">Tentar novamente</button>
    </div>
  )
  if (!exec) return null

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold text-slate-900">Painel Executivo</h1>
        <div className="flex gap-2">
          <button onClick={carregar} className="p-2 text-slate-400 hover:text-slate-700"><RefreshCw size={16} /></button>
          <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700"><Download size={14} /> CSV</button>
        </div>
      </div>

      {/* Projetos */}
      <Secao titulo="Projetos" icone={Sun}>
        <Kpi titulo="Total" valor={numf(exec.projetos.total)} />
        <Kpi titulo="Em andamento" valor={numf(exec.projetos.em_andamento)} />
        <Kpi titulo="Congelados" valor={numf(exec.projetos.congelados)} />
        <Kpi titulo="Homologados" valor={numf(exec.projetos.homologados)} destaque />
      </Secao>

      {/* Comercial */}
      <Secao titulo="Comercial" icone={Briefcase}>
        <Kpi titulo="Leads" valor={numf(exec.comercial.leads)} />
        <Kpi titulo="Propostas" valor={numf(exec.comercial.propostas)} />
        <Kpi titulo="Negociação" valor={numf(exec.comercial.negociacao)} />
        <Kpi titulo="Fechados" valor={numf(exec.comercial.fechados)} />
        <Kpi titulo="Perdidos" valor={numf(exec.comercial.perdidos)} />
        <Kpi titulo="Conversão" valor={pctf(exec.comercial.taxa_conversao_pct)} destaque />
      </Secao>

      {/* Energia */}
      <Secao titulo="Energia" icone={TrendingUp}>
        <Kpi titulo="kWp vendidos" valor={numf(exec.energia.kwp_vendidos)} />
        <Kpi titulo="kWp instalados" valor={numf(exec.energia.kwp_instalados)} />
        <Kpi titulo="Geração mensal (kWh)" valor={numf(exec.energia.geracao_mensal_kwh)} />
        <Kpi titulo="Geração anual (kWh)" valor={numf(exec.energia.geracao_anual_kwh)} />
      </Secao>

      {/* Financeiro */}
      <Secao titulo="Financeiro" icone={DollarSign}>
        <Kpi titulo="Total propostas" valor={brl(exec.financeiro.valor_total_propostas)} />
        <Kpi titulo="Valor vendido" valor={brl(exec.financeiro.valor_vendido)} destaque />
        <Kpi titulo="Ticket médio" valor={brl(exec.financeiro.ticket_medio)} />
        <Kpi titulo="Margem média" valor={pctf(exec.financeiro.margem_media_pct)} />
        <Kpi titulo="ROI médio" valor={pctf(exec.financeiro.roi_medio_pct)} />
        <Kpi titulo="Payback médio" valor={exec.financeiro.payback_medio_anos != null ? `${exec.financeiro.payback_medio_anos} anos` : '—'} />
      </Secao>

      {/* Health */}
      {health && (
        <Secao titulo="Saúde da Plataforma" icone={Activity}>
          <Kpi titulo="Usuários" valor={numf(health.usuarios)} />
          <Kpi titulo="Empresas" valor={numf(health.empresas)} />
          <Kpi titulo="Vendedores" valor={numf(health.vendedores)} />
          <Kpi titulo="Técnicos" valor={numf(health.tecnicos)} />
          <Kpi titulo="Catálogo" valor={numf(health.equipamentos_catalogo)} />
          <Kpi titulo="Com snapshot" valor={numf(health.projetos_com_snapshot)} />
          <Kpi titulo="Sem snapshot" valor={numf(health.projetos_sem_snapshot)} />
          <Kpi titulo="Congelados" valor={numf(health.projetos_congelados)} />
        </Secao>
      )}
    </div>
  )
}

function Secao({ titulo, icone: Icone, children }) {
  return (
    <Card>
      <CardHeader className="flex items-center gap-2"><Icone size={16} className="text-slate-500" /> {titulo}</CardHeader>
      <CardBody><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">{children}</div></CardBody>
    </Card>
  )
}
function Kpi({ titulo, valor, destaque }) {
  return (
    <div className={`rounded-lg p-3 border ${destaque ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className={`text-lg font-bold ${destaque ? 'text-emerald-700' : 'text-slate-900'}`}>{valor}</p>
    </div>
  )
}
