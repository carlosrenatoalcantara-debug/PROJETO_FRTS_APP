import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Sun, Lock, CheckCircle, AlertTriangle } from 'lucide-react'
import { obterPropostaPublica } from '../services/projetoFVApi'

/**
 * PropostaPublica — Sprint 5
 *
 * Página pública (sem login) acessada por link de compartilhamento /p/:token.
 * Exibe SOMENTE o snapshot congelado (read-only). Nunca recalcula. Nunca mostra
 * dados internos (custos/margem/markup) — apenas a visão do cliente.
 */
const brl = (v) => v == null ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pctf = (v) => (v == null ? '—' : `${Number(v).toFixed(0)}%`)

export default function PropostaPublica() {
  const { token } = useParams()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let vivo = true
    obterPropostaPublica(token)
      .then((d) => { if (vivo) setDados(d) })
      .catch((e) => { if (vivo) setErro(e.message) })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [token])

  if (carregando) return <Centro><p className="text-slate-500">Carregando proposta…</p></Centro>
  if (erro) return (
    <Centro>
      <AlertTriangle size={40} className="text-amber-500 mx-auto mb-3" />
      <p className="text-slate-700 font-medium">{erro}</p>
      <p className="text-slate-400 text-sm mt-1">Verifique o link com quem o enviou.</p>
    </Centro>
  )
  if (!dados) return null

  // Extrai a visão do cliente do snapshot congelado (sem dados internos)
  const snap = dados.snapshot || {}
  const comercial = snap.comercial || {}
  const financeiro = snap.financeiro || {}
  const vc = comercial.visao_cliente || comercial.valores || {}
  const valorFinal = comercial.proposta_final ?? vc.valor_final ?? vc.preco_venda ?? null
  const economiaAno = vc.economia_anual ?? financeiro.economia_anual_1ano ?? null
  const economia25 = vc.economia_25_anos ?? financeiro.economia_25_anos ?? null
  const payback = vc.payback_anos ?? financeiro.payback_anos ?? null
  const roi = vc.roi_pct ?? financeiro.roi_pct ?? null

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Cabeçalho institucional (S7.1) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {dados.empresa?.logo
              ? <img src={dados.empresa.logo} alt={dados.empresa.nome_fantasia || 'Empresa'} className="h-10 w-auto max-w-[120px] object-contain" />
              : <div className="p-2 rounded-lg bg-amber-100"><Sun size={20} className="text-amber-600" /></div>}
            <div>
              <h1 className="text-xl font-bold text-slate-900">{dados.empresa?.nome_fantasia || 'Proposta de Energia Solar'}</h1>
              <p className="text-sm text-slate-500">{dados.projeto_nome}{dados.cliente?.nome ? ` · ${dados.cliente.nome}` : ''}</p>
            </div>
          </div>
          <span className="text-xs text-emerald-700 flex items-center gap-1"><Lock size={12} /> Versão congelada</span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <Card titulo="Investimento" valor={brl(valorFinal)} destaque />
          <Card titulo="Economia / ano" valor={brl(economiaAno)} />
          <Card titulo="Payback" valor={payback ? `${payback} anos` : '—'} />
          <Card titulo="Retorno em 25 anos" valor={economia25 != null ? brl(economia25) : pctf(roi)} sub={roi != null ? `ROI ${pctf(roi)}` : null} />
        </div>

        {/* Metadados de versão */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm space-y-1.5">
          <p className="text-xs font-semibold text-slate-500 uppercase">Validade e versão</p>
          <Linha rotulo="Cenário" valor={dados.cenario_id || 'Padrão'} />
          <Linha rotulo="Revisão" valor={dados.revisao || 'A'} />
          {dados.validade && <Linha rotulo="Válida até" valor={new Date(dados.validade).toLocaleDateString('pt-BR')} />}
          {dados.snapshot_hash && <Linha rotulo="Código de verificação" valor={<span className="font-mono text-xs">{dados.snapshot_hash}</span>} />}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 justify-center">
          <CheckCircle size={13} className="text-emerald-500" />
          Documento somente leitura, gerado a partir de uma versão congelada e auditável.
        </div>
      </div>
    </div>
  )
}

function Centro({ children }) {
  return <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4"><div className="text-center max-w-sm">{children}</div></div>
}
function Card({ titulo, valor, sub, destaque }) {
  return (
    <div className={`rounded-xl p-4 border ${destaque ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className={`text-lg font-bold ${destaque ? 'text-emerald-700' : 'text-slate-900'}`}>{valor}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}
function Linha({ rotulo, valor }) {
  return <div className="flex justify-between"><span className="text-slate-500">{rotulo}</span><span className="font-medium text-slate-800">{valor}</span></div>
}
