import { useState } from 'react'
import { Clock, Save, Check, Hash } from 'lucide-react'
import Button from '../../ui/Button'
import { getHistoricoTipoConfig } from '../../../utils/engenhariaGovernanca'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway */

const STATUS_S9_LABEL = {
  nao_iniciado: 'Não iniciado',
  em_preparacao: 'Em preparação',
  pendente_documentacao: 'Pendente documentação',
  pendente_engenharia: 'Pendente engenharia',
  pendente_concessionaria: 'Pendente concessionária',
  homologado: 'Homologado',
  reprovado: 'Reprovado',
}

function fmt(data) {
  if (!data) return '—'
  try { return new Date(data).toLocaleString('pt-BR') } catch { return String(data) }
}

/**
 * P1-CENTRAL-HOMOLOGACAO-MVP — Aba Histórico + Protocolo.
 * Timeline lê os históricos JÁ EXISTENTES (governanca.historico + homologacao.historico_status).
 * NÃO cria engine nova de eventos. Protocolo persiste via PATCH /homologacao/protocolo.
 */
export default function CentralHistorico({ projeto, onAtualizar }) {
  const projetoId = projeto?._id
  const homol = projeto?.homologacao || {}
  const gov = projeto?.governanca || {}

  const [protocolo, setProtocolo] = useState(homol.numero_protocolo || '')
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState('')
  const [protocoloHist, setProtocoloHist] = useState(homol.protocolo_historico || [])

  // ── Timeline consolidada a partir dos históricos existentes ──────────────
  const eventos = []

  for (const h of (Array.isArray(gov.historico) ? gov.historico : [])) {
    const cfg = getHistoricoTipoConfig(h.tipo)
    eventos.push({
      em: h.em || h.data || h.criado_em || null,
      icon: cfg.icon,
      titulo: cfg.label,
      detalhe: h.motivo || h.descricao || null,
      por: h.por || h.usuario || null,
    })
  }

  for (const h of (Array.isArray(homol.historico_status) ? homol.historico_status : [])) {
    const para = STATUS_S9_LABEL[h.para] || h.para
    const de = STATUS_S9_LABEL[h.de] || h.de
    eventos.push({
      em: h.em || null,
      icon: '📋',
      titulo: `Homologação: ${de || '—'} → ${para || '—'}`,
      detalhe: h.motivo || null,
      por: h.por || null,
    })
  }

  eventos.sort((a, b) => new Date(b.em || 0) - new Date(a.em || 0))

  async function salvarProtocolo() {
    if (!projetoId) return
    setSalvando(true); setErro('')
    try {
      const r = await fetch(`${API_URL}/api/projetos-fv/${projetoId}/homologacao/protocolo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero_protocolo: protocolo }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.erro || 'Erro ao salvar protocolo')
      setProtocoloHist(d.protocolo_historico || [])
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2000)
      onAtualizar?.({
        numero_protocolo: d.numero_protocolo,
        protocolo_atualizado_em: d.protocolo_atualizado_em,
        protocolo_historico: d.protocolo_historico,
      })
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Protocolo da concessionária */}
      <div className="border border-slate-200 rounded-lg bg-white p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Hash size={16} className="text-indigo-600" />
          <h4 className="text-sm font-semibold text-slate-800">Protocolo da Concessionária</h4>
        </div>
        <p className="text-xs text-slate-500">
          Número do protocolo de solicitação de acesso (Neoenergia, Equatorial, Enel, etc.). Opcional.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={protocolo}
            onChange={(e) => setProtocolo(e.target.value)}
            placeholder="Ex: 2026-00123456"
            className="flex-1 min-w-[180px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Button onClick={salvarProtocolo} disabled={salvando} icone={salvo ? Check : Save}>
            {salvando ? 'Salvando...' : salvo ? 'Salvo!' : 'Salvar'}
          </Button>
        </div>
        {homol.protocolo_atualizado_em && (
          <p className="text-[11px] text-slate-400">
            Última atualização: {fmt(homol.protocolo_atualizado_em)}
          </p>
        )}
        {erro && <p className="text-xs text-red-600">✗ {erro}</p>}
        {protocoloHist.length > 1 && (
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer hover:text-slate-700">Histórico de protocolo ({protocoloHist.length})</summary>
            <div className="mt-2 space-y-1 pl-2 border-l-2 border-slate-100">
              {[...protocoloHist].reverse().map((p, i) => (
                <p key={i}>{p.valor || '(removido)'} · {fmt(p.em)} {p.por ? `· ${p.por}` : ''}</p>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Timeline */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock size={16} className="text-slate-500" />
          <h4 className="text-sm font-semibold text-slate-800">Linha do tempo</h4>
        </div>
        {eventos.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-lg">
            Nenhum evento registrado ainda.
          </p>
        ) : (
          <ol className="space-y-3">
            {eventos.map((ev, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-lg leading-none mt-0.5">{ev.icon}</span>
                <div className="flex-1 border-b border-slate-100 pb-3 last:border-0">
                  <p className="text-sm font-medium text-slate-800">{ev.titulo}</p>
                  <p className="text-[11px] text-slate-400">
                    {fmt(ev.em)}{ev.por ? ` · ${ev.por}` : ''}
                  </p>
                  {ev.detalhe && <p className="text-xs text-slate-500 mt-0.5">{ev.detalhe}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
