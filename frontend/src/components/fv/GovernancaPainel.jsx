import { useState, useEffect, useCallback } from 'react'
import { Lock, GitBranch, AlertTriangle, CheckCircle, RefreshCw, Clock, ShieldCheck, TrendingUp } from 'lucide-react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import {
  getFreezeStatusConfig,
  getHistoricoTipoConfig,
  ENGINEERING_VERSION,
} from '../../utils/engenhariaGovernanca'
import { compararRevisoesFinanceiras } from '../../utils/financeiroEngine'
import {
  congelarProjeto,
  criarRevisao,
  buscarDivergencia,
} from '../../services/projetoFVApi'

/**
 * GovernancaPainel — Sprint 3.5
 *
 * Painel reutilizável de governança técnica. Mostra status de freeze, versão de
 * engenharia, timeline, divergência com catálogo e ações de congelar/revisar.
 *
 * @param {string}   projetoId
 * @param {object}   governanca   — subdoc governanca do projeto (pode ser null)
 * @param {function} construirSnapshots — () => { tecnico, catalogo, unifilar, memorial, financeiro }
 * @param {function} onAtualizar  — (governancaAtualizada) => void
 * @param {string}   usuario      — email/nome do responsável
 */
export default function GovernancaPainel({ projetoId, governanca, construirSnapshots, onAtualizar, usuario }) {
  const gov = governanca || {}
  const status = gov.freeze_status || 'RASCUNHO'
  const cfg = getFreezeStatusConfig(status)
  const congelado = status === 'CONGELADO' || status === 'HOMOLOGADO'

  const [acaoEmCurso, setAcaoEmCurso] = useState(false)
  const [erro, setErro] = useState('')
  const [divergencia, setDivergencia] = useState(null)
  const [verificandoDiv, setVerificandoDiv] = useState(false)

  const verificarDivergencia = useCallback(async () => {
    if (!projetoId || !congelado) return
    setVerificandoDiv(true)
    try {
      const res = await buscarDivergencia(projetoId)
      setDivergencia(res)
    } catch (e) {
      console.warn('[Governanca] divergência:', e.message)
    } finally {
      setVerificandoDiv(false)
    }
  }, [projetoId, congelado])

  useEffect(() => { verificarDivergencia() }, [verificarDivergencia])

  async function congelar(novoStatus) {
    setAcaoEmCurso(true)
    setErro('')
    try {
      const snapshots = construirSnapshots ? construirSnapshots() : {}
      const res = await congelarProjeto(projetoId, {
        snapshots,
        engineering_version: ENGINEERING_VERSION,
        usuario,
        novo_status: novoStatus,
      })
      onAtualizar?.(res.governanca)
    } catch (e) {
      setErro(e.message)
    } finally {
      setAcaoEmCurso(false)
    }
  }

  async function revisar() {
    const motivo = window.prompt('Motivo da nova revisão (reabre a engenharia para edição):', '')
    if (motivo === null) return
    setAcaoEmCurso(true)
    setErro('')
    try {
      const res = await criarRevisao(projetoId, { usuario, motivo })
      onAtualizar?.(res.governanca)
      setDivergencia(null)
    } catch (e) {
      setErro(e.message)
    } finally {
      setAcaoEmCurso(false)
    }
  }

  const timeline = [...(gov.historico || [])].reverse()
  const brl = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const cmpFin = compararRevisoesFinanceiras(gov.revisoes || [])

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-left">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Governança Técnica</span>
          <Badge cor={cfg.cor}>{cfg.label}</Badge>
          {gov.revisao_atual && (
            <span className="text-xs text-slate-400 font-mono">Rev {gov.revisao_atual}</span>
          )}
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {gov.engineering_version || ENGINEERING_VERSION}
        </span>
      </div>

      <p className="text-xs text-slate-500">{cfg.descricao}</p>

      {/* Divergência com catálogo */}
      {congelado && (
        <div className="rounded-lg border p-3 text-xs"
          style={{ borderColor: divergencia?.divergente ? '#fed7aa' : '#e2e8f0' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-slate-600 flex items-center gap-1">
              {divergencia?.divergente
                ? <><AlertTriangle size={13} className="text-orange-500" /> Divergência com catálogo</>
                : <><CheckCircle size={13} className="text-emerald-500" /> Catálogo consistente</>}
            </span>
            <button onClick={verificarDivergencia} className="text-slate-400 hover:text-slate-600" title="Reverificar">
              <RefreshCw size={12} className={verificandoDiv ? 'animate-spin' : ''} />
            </button>
          </div>
          {divergencia?.divergente ? (
            <div className="space-y-1.5">
              <p className="text-orange-700">
                Este projeto usa uma revisão antiga do equipamento. {divergencia.total_divergencias} item(ns) mudaram no catálogo:
              </p>
              {divergencia.divergencias.map((d, i) => (
                <div key={i} className="bg-orange-50 rounded px-2 py-1">
                  <span className="font-medium text-orange-800">{d.fabricante} {d.modelo}</span>
                  <span className="text-orange-600"> — {d.impacto}</span>
                  {d.mudancas?.length > 0 && (
                    <ul className="mt-0.5 ml-3 list-disc text-orange-700">
                      {d.mudancas.slice(0, 4).map((m, j) => (
                        <li key={j}><span className="font-mono">{m.campo}</span>: {String(m.de)} → {String(m.para)}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              <p className="text-slate-500 pt-1">
                O projeto permanece congelado com os dados originais. Crie uma revisão para incorporar as mudanças.
              </p>
            </div>
          ) : (
            <p className="text-slate-500">
              {divergencia?.tem_snapshot === false
                ? 'Sem snapshot de catálogo para comparar.'
                : 'Os equipamentos congelados continuam idênticos ao catálogo atual.'}
            </p>
          )}
        </div>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
            <Clock size={12} /> Histórico técnico
          </p>
          <div className="space-y-1.5">
            {timeline.slice(0, 6).map((h, i) => {
              const tc = getHistoricoTipoConfig(h.tipo)
              return (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span>{tc.icon}</span>
                  <div className="flex-1">
                    <span className="text-slate-700">{h.descricao || tc.label}</span>
                    {h.timestamp && (
                      <span className="text-slate-400 ml-2">
                        {new Date(h.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Comparativo de revisões financeiras */}
      {cmpFin.pontos.length >= 2 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
            <TrendingUp size={12} /> Comparativo financeiro de revisões
          </p>
          <div className="space-y-1">
            {cmpFin.pontos.map((p) => (
              <div key={p.rev} className="flex items-center justify-between text-xs">
                <span className="font-mono text-slate-500">Rev {p.rev}</span>
                <span className="font-semibold text-slate-800">{brl(p.preco)}</span>
              </div>
            ))}
          </div>
          {cmpFin.comparacoes.map((c, i) => (
            <p key={i} className={`text-xs mt-1 ${c.diferenca >= 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
              Rev {c.de} → {c.para}: {c.diferenca >= 0 ? '+' : ''}{brl(c.diferenca)}
              {c.diferenca_pct != null ? ` (${c.diferenca_pct >= 0 ? '+' : ''}${c.diferenca_pct}%)` : ''}
              {c.motivo ? ` — ${c.motivo}` : ''}
            </p>
          ))}
        </div>
      )}

      {erro && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{erro}</div>
      )}

      {/* Ações */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
        {!congelado ? (
          <>
            <Button variante="secundario" tamanho="sm" icone={Lock}
              onClick={() => congelar('CONGELADO')} carregando={acaoEmCurso} disabled={!projetoId}>
              Congelar Proposta
            </Button>
            <Button variante="secundario" tamanho="sm" icone={ShieldCheck}
              onClick={() => congelar('HOMOLOGADO')} carregando={acaoEmCurso} disabled={!projetoId}>
              Homologar
            </Button>
          </>
        ) : (
          <>
            <Button variante="secundario" tamanho="sm" icone={GitBranch}
              onClick={revisar} carregando={acaoEmCurso}>
              Criar Revisão
            </Button>
            {status === 'CONGELADO' && (
              <Button variante="secundario" tamanho="sm" icone={ShieldCheck}
                onClick={() => congelar('HOMOLOGADO')} carregando={acaoEmCurso}>
                Homologar
              </Button>
            )}
          </>
        )}
      </div>

      {gov.congelado_em && (
        <p className="text-[11px] text-slate-400">
          Congelado em {new Date(gov.congelado_em).toLocaleString('pt-BR')}
          {gov.congelado_por ? ` por ${gov.congelado_por}` : ''}
        </p>
      )}
    </div>
  )
}
