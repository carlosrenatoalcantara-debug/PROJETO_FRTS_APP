import { useState, useCallback } from 'react'
import { Users, MessageCircle, Mail, Share2, Clock, Copy, ExternalLink, CheckCircle } from 'lucide-react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import {
  CRM_PIPELINE_CONFIG, getPipelineConfig, FOLLOWUP_STATUS, getFollowupConfig,
  TEMPLATES_WHATSAPP, TEMPLATES_EMAIL, aplicarTemplate, urlPublica, linkWhatsApp, linkEmail,
} from '../../utils/crmComercial'
import {
  atualizarCrm, registrarComunicacao, criarCompartilhamento,
} from '../../services/projetoFVApi'

/**
 * CrmPainel — Sprint 5
 *
 * CRM operacional leve: pipeline, follow-up, comunicação (WhatsApp/email/share)
 * e timeline. Toda ação alimenta governanca.comercial.historico (timeline única).
 * Compartilhamento abre snapshot CONGELADO via link público.
 */
const brl = (v) => v == null ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })

export default function CrmPainel({
  projetoId, comercial, cliente = {}, empresa = {}, resumo = {}, onAtualizar, usuario,
}) {
  const com = comercial || {}
  const pipeline = com.crm_pipeline || 'LEAD'
  const followup = com.followup || {}
  const compartilhamentos = com.compartilhamentos || []
  const ultimoShare = compartilhamentos[compartilhamentos.length - 1] || null

  const [acao, setAcao] = useState(false)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)

  const refresh = useCallback((c) => onAtualizar?.(c), [onAtualizar])

  const varsTemplate = {
    cliente: cliente.nome || cliente.nomeCliente || 'cliente',
    vendedor: usuario || empresa.email || 'equipe',
    empresa: empresa.nomeEmpresa || 'Forte Solar',
    potencia: resumo.potenciaKwp ?? '—',
    valor: brl(resumo.valor),
    link: ultimoShare ? urlPublica(ultimoShare.token) : '',
  }

  async function mudarPipeline(novo) {
    setAcao(true); setErro('')
    try { refresh((await atualizarCrm(projetoId, { crm_pipeline: novo, usuario })).comercial) }
    catch (e) { setErro(e.message) } finally { setAcao(false) }
  }

  async function salvarFollowup(status) {
    const observacao = window.prompt('Observação do follow-up (opcional):', followup.observacao || '')
    if (observacao === null) return
    setAcao(true); setErro('')
    try { refresh((await atualizarCrm(projetoId, { followup: { status, observacao, data: new Date().toISOString() }, usuario })).comercial) }
    catch (e) { setErro(e.message) } finally { setAcao(false) }
  }

  async function compartilhar() {
    setAcao(true); setErro('')
    try {
      const res = await criarCompartilhamento(projetoId, { validade_dias: 30, usuario })
      refresh(res.comercial)
    } catch (e) { setErro(e.message) } finally { setAcao(false) }
  }

  async function comunicar(canal, abrirUrl) {
    // Abre o canal e registra na timeline única
    if (abrirUrl) window.open(abrirUrl, '_blank', 'noopener,noreferrer')
    try {
      const res = await registrarComunicacao(projetoId, {
        canal,
        destinatario: canal === 'whatsapp' ? (cliente.telefone || null) : (cliente.email || null),
        revisao: com.revisao_comercial_atual || 'A',
        snapshot_hash: ultimoShare?.snapshot_hash || com.snapshot_comercial?.hash || null,
        resumo: `${resumo.potenciaKwp ?? '?'} kWp · ${brl(resumo.valor)}`,
        usuario,
      })
      refresh(res.comercial)
    } catch (e) { setErro(e.message) }
  }

  function enviarWhatsApp() {
    const texto = aplicarTemplate(TEMPLATES_WHATSAPP.envio_proposta.texto, varsTemplate)
    comunicar('whatsapp', linkWhatsApp(cliente.telefone, texto))
  }
  function enviarEmail() {
    const assunto = aplicarTemplate(TEMPLATES_EMAIL.envio_proposta.assunto, varsTemplate)
    const corpo = aplicarTemplate(TEMPLATES_EMAIL.envio_proposta.corpo, varsTemplate)
    comunicar('email', linkEmail(cliente.email, assunto, corpo))
  }
  function copiarLink() {
    if (!ultimoShare) return
    navigator.clipboard?.writeText(urlPublica(ultimoShare.token))
      .then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000) })
      .catch(() => {})
  }

  const timeline = [...(com.historico || [])].filter(h => /comunicacao|followup|crm_pipeline/.test(h.acao || '')).reverse()

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-left">
      <div className="flex items-center gap-2">
        <Users size={18} className="text-cyan-600" />
        <span className="text-sm font-semibold text-slate-800">CRM Operacional</span>
        <Badge cor={getPipelineConfig(pipeline).cor}>{getPipelineConfig(pipeline).label}</Badge>
      </div>

      {/* Pipeline */}
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-1.5">Pipeline</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(CRM_PIPELINE_CONFIG).map(([k, v]) => (
            <button key={k} onClick={() => mudarPipeline(k)} disabled={acao}
              className={`text-xs font-medium px-2.5 py-1 rounded transition-colors ${
                pipeline === k ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Follow-up */}
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-1.5">Follow-up</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.entries(FOLLOWUP_STATUS).map(([k, v]) => (
            <button key={k} onClick={() => salvarFollowup(k)} disabled={acao}
              className={`text-xs px-2.5 py-1 rounded ${followup.status === k ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {v.label}
            </button>
          ))}
        </div>
        {followup.observacao && <p className="text-xs text-slate-500 mt-1">📝 {followup.observacao}</p>}
      </div>

      {/* Compartilhamento + comunicação */}
      <div className="border-t border-slate-100 pt-3">
        <p className="text-xs font-semibold text-slate-500 mb-2">Comunicação auditável</p>
        {ultimoShare ? (
          <div className="bg-slate-50 rounded-lg p-2.5 text-xs mb-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-slate-600 truncate">{urlPublica(ultimoShare.token)}</span>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={copiarLink} className="text-slate-500 hover:text-slate-800" title="Copiar link">
                  {copiado ? <CheckCircle size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
                <a href={urlPublica(ultimoShare.token)} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-800" title="Abrir"><ExternalLink size={14} /></a>
              </div>
            </div>
            <p className="text-slate-400 mt-1">
              Rev {ultimoShare.revisao} · {ultimoShare.tracking?.visualizacoes || 0} visualizações
              {ultimoShare.tracking?.ultimo_acesso ? ` · últ. acesso ${new Date(ultimoShare.tracking.ultimo_acesso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-400 mb-2">Crie um link público (abre o snapshot congelado) para compartilhar.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button variante="secundario" tamanho="sm" icone={Share2} onClick={compartilhar} carregando={acao} className="justify-center">
            {ultimoShare ? 'Novo link' : 'Gerar link'}
          </Button>
          <button onClick={enviarWhatsApp} className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium">
            <MessageCircle size={14} /> WhatsApp
          </button>
          <button onClick={enviarEmail} className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium">
            <Mail size={14} /> E-mail
          </button>
        </div>
      </div>

      {erro && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{erro}</div>}

      {/* Timeline operacional (mesma fonte: historico) */}
      {timeline.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1"><Clock size={12} /> Timeline operacional</p>
          <div className="space-y-1">
            {timeline.slice(0, 6).map((h, i) => (
              <div key={i} className="text-xs text-slate-600">
                <span>{h.detalhe || h.acao}</span>
                {h.timestamp && <span className="text-slate-400 ml-2">{new Date(h.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
