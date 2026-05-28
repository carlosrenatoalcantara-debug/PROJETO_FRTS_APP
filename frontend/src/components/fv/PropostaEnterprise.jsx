import { useState, useMemo, useCallback } from 'react'
import { Briefcase, PenLine, BadgeCheck, GitCompare, Battery, Cpu, ShieldAlert, Clock } from 'lucide-react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import {
  compararCenariosFinanceiros,
  compararTecnologias,
  compararCenariosTarifarios,
  cenarioBESS,
  avaliarAprovacao,
} from '../../utils/comercialEngine'
import {
  getWorkflowConfig,
  PAPEIS_ASSINATURA,
  gerarAssinatura,
  construirSnapshotComercial,
  getAprovacaoConfig,
  WORKFLOW_COMERCIAL_CONFIG,
} from '../../utils/comercialGovernanca'
import {
  salvarComercial,
  atualizarWorkflowComercial as apiWorkflow,
  registrarAssinatura,
  registrarAprovacao,
} from '../../services/projetoFVApi'

/**
 * PropostaEnterprise — Sprint 4.2
 *
 * Camada comercial enterprise: comparação multi-cenário, comparação tecnológica,
 * FV×FV+BESS, cenários tarifários, workflow comercial, desconto/aprovação,
 * assinaturas digitais e congelamento comercial.
 *
 * ENGINEERING LOCK: consome snapshotTecnico + resultadoFinanceiro; quando
 * congelado (ASSINADO), exibe o snapshot comercial congelado.
 */

const brl = (v) => v == null ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const pctf = (v) => (v == null ? '—' : `${Number(v).toFixed(0)}%`)

export default function PropostaEnterprise({
  projetoId, snapshotTecnico, resultadoFinanceiro,
  consumoAnualKwh = 0, tipoLigacao = 'monofasico', config = {},
  governancaComercial, onAtualizar, usuario,
}) {
  const com = governancaComercial || {}
  const status = com.workflow_status || 'EM_ANALISE'
  const wfCfg = getWorkflowConfig(status)
  const assinado = status === 'ASSINADO'

  const precoVenda = resultadoFinanceiro?.orcamento?.preco_venda ?? com.snapshot_comercial?.proposta_final ?? null
  const margemLiq = resultadoFinanceiro?.margem?.margem_liquida_pct ?? null
  const geracao = snapshotTecnico?.geracao_anual_kwh ?? null
  const custoBase = resultadoFinanceiro?.margem?.custo_total ?? null
  const tarifaKwh = resultadoFinanceiro?.tarifa?.tarifa_kwh ?? 0.95

  const [descontoPct, setDescontoPct] = useState(com.desconto_pct ?? 0)
  const [acao, setAcao] = useState(false)
  const [erro, setErro] = useState('')

  const podeCalcular = !!(snapshotTecnico && resultadoFinanceiro && precoVenda)

  // ── Comparações multi-cenário (engineering lock via snapshot técnico) ──────────
  const comparacao = useMemo(() => {
    if (!podeCalcular) return null
    return compararCenariosFinanceiros({
      snapshotTecnico, precoVenda, consumoAnualKwh, tipoLigacao,
      base: { tarifaKwh, anoInstalacao: new Date().getFullYear(), modalidade: 'GD_I' },
    })
  }, [podeCalcular, snapshotTecnico, precoVenda, consumoAnualKwh, tipoLigacao, tarifaKwh])

  const tecnologias = useMemo(() => {
    if (!custoBase || !geracao) return null
    return compararTecnologias({ custoBase, geracaoAnualBase: geracao, tarifaKwh })
  }, [custoBase, geracao, tarifaKwh])

  const tarifarios = useMemo(() => {
    if (!podeCalcular) return null
    return compararCenariosTarifarios({ snapshotTecnico, precoVenda, consumoAnualKwh, tipoLigacao, base: { tarifaKwh } })
  }, [podeCalcular, snapshotTecnico, precoVenda, consumoAnualKwh, tipoLigacao, tarifaKwh])

  const bess = useMemo(() => {
    if (!precoVenda || !geracao) return null
    return cenarioBESS({
      precoBaseFV: precoVenda, geracaoAnualKwh: geracao, tarifaKwh,
      capacidadeKwh: 10, custoPorKwh: 3500,
      consumoMedioDiarioKwh: consumoAnualKwh ? consumoAnualKwh / 365 : 0,
      economiaPeakShavingPct: 8,
    })
  }, [precoVenda, geracao, tarifaKwh, consumoAnualKwh])

  const aprovacao = useMemo(() => avaliarAprovacao({
    descontoPct,
    descontoLimitePct: config.descontoMaximoPct ?? 10,
    margemLiquidaPct: margemLiq,
    margemMinimaPct: config.margemMinimaPct ?? 8,
  }), [descontoPct, config, margemLiq])

  // ── Ações ──────────────────────────────────────────────────────────────────────
  const refresh = useCallback((c) => onAtualizar?.(c), [onAtualizar])

  async function mudarWorkflow(novo) {
    setAcao(true); setErro('')
    try {
      const res = await apiWorkflow(projetoId, novo, usuario)
      refresh(res.comercial)
    } catch (e) { setErro(e.message) } finally { setAcao(false) }
  }

  async function aprovar(tipo) {
    const aprovadoPor = window.prompt('Nome do gestor que aprova:', usuario || '')
    if (!aprovadoPor) return
    setAcao(true); setErro('')
    try {
      const res = await registrarAprovacao(projetoId, { tipo, aprovado_por: aprovadoPor, usuario })
      refresh(res.comercial)
    } catch (e) { setErro(e.message) } finally { setAcao(false) }
  }

  async function assinar(papel) {
    const nome = window.prompt(`Nome de quem assina (${papel}):`, '')
    if (!nome) return
    setAcao(true); setErro('')
    try {
      const assinatura = gerarAssinatura({ papel, nome, contextoHash: snapshotTecnico?.hash })
      const res = await registrarAssinatura(projetoId, { ...assinatura, usuario })
      refresh(res.comercial)
    } catch (e) { setErro(e.message) } finally { setAcao(false) }
  }

  async function congelarComercial() {
    setAcao(true); setErro('')
    try {
      const snapshot_comercial = construirSnapshotComercial({
        cenarios: comparacao,
        comparacaoTecnologica: tecnologias,
        cenarioBESS: bess,
        cenariosTarifarios: tarifarios,
        descontoPct,
        snapshotFinanceiro: resultadoFinanceiro ? {
          proposta_final: precoVenda,
          cenario_exibicao: resultadoFinanceiro.cenario_exibicao,
        } : null,
      })
      const res = await salvarComercial(projetoId, {
        snapshot_comercial,
        cenarios: comparacao,
        comparativos: { tecnologias, tarifarios, bess },
        desconto_pct: descontoPct,
        desconto_limite_pct: config.descontoMaximoPct ?? 10,
        congelar: true,
        usuario,
      })
      refresh(res.comercial)
    } catch (e) { setErro(e.message) } finally { setAcao(false) }
  }

  // Cenários a exibir: live (comparacao) ou congelados (com.cenarios)
  const cenariosShow = comparacao || com.cenarios
  const histTimeline = [...(com.historico || [])].reverse()
  const assinaturas = com.assinaturas || []

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5 text-left">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Briefcase size={18} className="text-indigo-600" />
          <span className="text-sm font-semibold text-slate-800">Proposta Enterprise</span>
          <Badge cor={wfCfg.cor}>{wfCfg.label}</Badge>
        </div>
        {assinado && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><BadgeCheck size={14} /> Congelado comercialmente</span>}
      </div>

      {/* Comparação multi-cenário */}
      {cenariosShow?.cenarios?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1"><GitCompare size={13} /> Cenários financeiros</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-100">
                  <th className="text-left py-1.5 pr-3">Indicador</th>
                  {cenariosShow.cenarios.map((c) => (
                    <th key={c.id} className="text-right py-1.5 px-2">
                      <Badge cor={c.cor}>{c.label}</Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Economia/ano', 'economia_anual', brl],
                  ['Economia 25a', 'economia_25_anos', brl],
                  ['Payback', 'payback_anos', (v) => v == null ? '—' : `${v}a`],
                  ['ROI', 'roi_pct', pctf],
                  ['TIR a.a.', 'tir_pct', pctf],
                  ['Lucro 25a', 'lucro_25_anos', brl],
                ].map(([rot, campo, fmt]) => (
                  <tr key={campo} className="border-b border-slate-50">
                    <td className="py-1.5 pr-3 text-slate-600">{rot}</td>
                    {cenariosShow.cenarios.map((c) => (
                      <td key={c.id} className="py-1.5 px-2 text-right font-medium text-slate-800">{fmt(c[campo])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Comparação tecnológica */}
      {tecnologias && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1"><Cpu size={13} /> Arquitetura de inversor</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {tecnologias.map((t) => (
              <div key={t.id} className="border border-slate-200 rounded-lg p-3 text-xs">
                <p className="font-semibold text-slate-800">{t.label}</p>
                <p className="text-slate-500 mt-1">Custo: <span className="font-medium text-slate-700">{brl(t.custo)}</span></p>
                <p className="text-slate-500">Geração: +{t.ganho_geracao_pct}%</p>
                <p className="text-slate-500">Payback: {t.payback_anos ? `${t.payback_anos}a` : '—'}</p>
                <p className="text-slate-400 mt-1">Manut.: {t.manutencao} · Red.: {t.redundancia}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FV vs FV+BESS */}
      {bess && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1"><Battery size={13} /> FV × FV+BESS</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="border border-slate-200 rounded-lg p-3">
              <p className="font-semibold text-slate-800">Somente FV</p>
              <p className="text-slate-500 mt-1">Investimento: {brl(bess.fv.preco)}</p>
              <p className="text-slate-500">Economia/ano: {brl(bess.fv.economia_anual)}</p>
              <p className="text-slate-400">Sem backup</p>
            </div>
            <div className="border border-emerald-200 rounded-lg p-3">
              <p className="font-semibold text-slate-800">FV + BESS ({bess.fv_bess.capacidade_kwh} kWh)</p>
              <p className="text-slate-500 mt-1">Investimento: {brl(bess.fv_bess.preco)}</p>
              <p className="text-slate-500">Economia/ano: {brl(bess.fv_bess.economia_anual)}</p>
              <p className="text-slate-400">Backup ~{bess.fv_bess.autonomia_horas ?? '—'}h</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{bess.observacao}</p>
        </div>
      )}

      {/* Desconto + aprovação */}
      {!assinado && (
        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Desconto (%)</label>
              <input type="number" min={0} step={0.5} value={descontoPct}
                onChange={(e) => setDescontoPct(Number(e.target.value))}
                className="w-28 px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <span className="text-xs text-slate-400">Limite: {config.descontoMaximoPct ?? 10}% · Margem líq.: {pctf(margemLiq)}</span>
          </div>
          {aprovacao.requer_aprovacao && (
            <div className="mt-2 space-y-1">
              {aprovacao.exigencias.map((ex, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  <span className="text-amber-800 flex items-center gap-1"><ShieldAlert size={12} /> {ex.motivo}</span>
                  <button onClick={() => aprovar(ex.tipo)} disabled={acao}
                    className="text-amber-700 font-medium hover:underline">Aprovar</button>
                </div>
              ))}
            </div>
          )}
          {com.aprovacao && (
            <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
              <BadgeCheck size={12} /> {getAprovacaoConfig(com.aprovacao.tipo).label} aprovado por {com.aprovacao.aprovado_por}
            </p>
          )}
        </div>
      )}

      {/* Assinaturas */}
      <div className="border-t border-slate-100 pt-3">
        <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1"><PenLine size={13} /> Assinaturas digitais</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PAPEIS_ASSINATURA.map(({ papel, label }) => {
            const a = assinaturas.find((x) => x.papel === papel)
            return (
              <div key={papel} className="border border-slate-200 rounded-lg p-3 text-xs">
                <p className="font-medium text-slate-700">{label}</p>
                {a ? (
                  <>
                    <p className="text-emerald-600 mt-1 flex items-center gap-1"><BadgeCheck size={12} /> {a.nome}</p>
                    <p className="text-slate-400 font-mono">{a.hash}</p>
                    <p className="text-slate-400">{new Date(a.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                  </>
                ) : (
                  <button onClick={() => assinar(papel)} disabled={acao || !projetoId}
                    className="mt-1 text-indigo-600 font-medium hover:underline">Coletar assinatura</button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Timeline comercial */}
      {histTimeline.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1"><Clock size={12} /> Histórico comercial</p>
          <div className="space-y-1">
            {histTimeline.slice(0, 6).map((h, i) => (
              <div key={i} className="text-xs text-slate-600">
                <span className="font-medium">{h.detalhe || h.acao}</span>
                {h.timestamp && <span className="text-slate-400 ml-2">{new Date(h.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>}
                {h.usuario && <span className="text-slate-400"> · {h.usuario}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {erro && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{erro}</div>}

      {/* Ações de workflow */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        {!assinado && (
          <select
            value={status}
            onChange={(e) => mudarWorkflow(e.target.value)}
            disabled={acao}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {Object.entries(WORKFLOW_COMERCIAL_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        )}
        {podeCalcular && !assinado && (
          <Button variante="secundario" tamanho="sm" icone={GitCompare} onClick={congelarComercial} carregando={acao}>
            Congelar comercial
          </Button>
        )}
      </div>
    </div>
  )
}
