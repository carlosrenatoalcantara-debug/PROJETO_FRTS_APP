import { useState, useMemo, useCallback } from 'react'
import { Briefcase, PenLine, BadgeCheck, GitCompare, Battery, Cpu, ShieldAlert, Clock, Scale, GitBranch, Lock, Snowflake } from 'lucide-react'
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
  gerarAssinaturaSegura,
  construirSnapshotComercial,
  getAprovacaoConfig,
} from '../../utils/comercialGovernanca'
import {
  getEstadoConfig,
  transicoesValidas,
  getStatusJuridicoConfig,
  avaliarMargem,
  estaCongelado,
} from '../../utils/comercialStateMachine'
import { hashTecnico } from '../../utils/engenhariaGovernanca'
import {
  salvarComercial,
  atualizarWorkflowComercial as apiWorkflow,
  registrarAssinatura,
  registrarAprovacao,
  criarRevisaoComercial,
  congelarCenario,
  revisaoCenario,
  assinarCenario,
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
  const wfCfg = getEstadoConfig(status)
  const congelado = estaCongelado(status)
  const assinado = status === 'ASSINADO'
  const statusJuridico = com.status_juridico || 'PENDENTE_ASSINATURA'
  const sjCfg = getStatusJuridicoConfig(statusJuridico)
  const proximosEstados = transicoesValidas(status)

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

  // S4.3: proteção de margem
  const margemGuard = useMemo(() => avaliarMargem({
    margemLiquidaPct: margemLiq,
    margemMinima: config.margemMinimaPct ?? 8,
    margemAlerta: config.margemAlertaPct ?? 12,
    margemBloqueio: config.margemBloqueioPct ?? 0,
  }), [margemLiq, config])

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
      // S4.3: assinatura SHA-256 com hash do snapshot técnico e da proposta
      const assinatura = await gerarAssinaturaSegura({
        papel, nome,
        hashDocumento: com.snapshot_comercial?.hash || null,
        hashSnapshot: snapshotTecnico?.hash || null,
      })
      const res = await registrarAssinatura(projetoId, { ...assinatura, usuario })
      refresh(res.comercial)
    } catch (e) { setErro(e.message) } finally { setAcao(false) }
  }

  async function revisar() {
    const motivo = window.prompt('Motivo da nova revisão comercial (reabre a proposta):', '')
    if (motivo === null) return
    setAcao(true); setErro('')
    try {
      const res = await criarRevisaoComercial(projetoId, { usuario, motivo, snapshot_comercial: com.snapshot_comercial || null })
      refresh(res.comercial)
    } catch (e) { setErro(e.message) } finally { setAcao(false) }
  }

  async function congelarComercial() {
    if (margemGuard.nivel === 'bloqueio') { setErro(margemGuard.mensagem); return }
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
        margem_liquida_pct: margemLiq,
        congelar: true,
        usuario,
      })
      refresh(res.comercial)
    } catch (e) { setErro(e.message) } finally { setAcao(false) }
  }

  // ── S4.3.1: governança individual por cenário ──────────────────────────────
  const cenGovMap = com.cenarios_governanca || {}

  async function congelarCen(c) {
    setAcao(true); setErro('')
    try {
      const snapComercial = { scenario_id: c.id, label: c.label, valores: c, desconto_pct: descontoPct }
      const hash = hashTecnico(snapComercial)
      const res = await congelarCenario(projetoId, {
        scenario_id: c.id,
        snapshots: {
          comercial: snapComercial,
          financeiro: resultadoFinanceiro?.retorno_realista || resultadoFinanceiro?.retorno || null,
          regulatorio: resultadoFinanceiro?.regulatorio || null,
        },
        hash, usuario,
      })
      refresh(res.comercial)
    } catch (e) { setErro(e.message) } finally { setAcao(false) }
  }

  async function revisarCen(c) {
    const motivo = window.prompt(`Motivo da revisão do cenário ${c.label}:`, '')
    if (motivo === null) return
    setAcao(true); setErro('')
    try {
      const res = await revisaoCenario(projetoId, { scenario_id: c.id, usuario, motivo })
      refresh(res.comercial)
    } catch (e) { setErro(e.message) } finally { setAcao(false) }
  }

  async function assinarCen(c, papel) {
    const nome = window.prompt(`Assinar cenário ${c.label} como ${papel} — nome:`, '')
    if (!nome) return
    setAcao(true); setErro('')
    try {
      const assinatura = await gerarAssinaturaSegura({
        papel, nome,
        hashDocumento: cenGovMap[c.id]?.hash || null,
        hashSnapshot: snapshotTecnico?.hash || null,
      })
      const res = await assinarCenario(projetoId, { ...assinatura, hash_cenario: cenGovMap[c.id]?.hash || null, scenario_id: c.id, usuario })
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
        <div className="flex items-center gap-2 flex-wrap">
          <Briefcase size={18} className="text-indigo-600" />
          <span className="text-sm font-semibold text-slate-800">Proposta Enterprise</span>
          <Badge cor={wfCfg.cor}>{wfCfg.label}</Badge>
          <span className="text-[11px] text-slate-400">jurídico:</span>
          <Badge cor={sjCfg.cor}>{sjCfg.label}</Badge>
          {com.revisao_comercial_atual && <span className="text-xs text-slate-400 font-mono">Rev {com.revisao_comercial_atual}</span>}
        </div>
        {congelado && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><Lock size={14} /> Congelado comercialmente</span>}
      </div>

      {/* Proteção de margem */}
      {margemGuard.mensagem && (
        <div className={`text-xs rounded px-2 py-1.5 flex items-center gap-1 ${
          margemGuard.nivel === 'bloqueio' ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          <Scale size={12} /> {margemGuard.mensagem}
        </div>
      )}

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

      {/* S4.3.1: Governança individual por cenário */}
      {cenariosShow?.cenarios?.length > 0 && projetoId && (
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1"><Snowflake size={12} /> Governança por cenário</p>
          <div className="space-y-2">
            {cenariosShow.cenarios.map((c) => {
              const g = cenGovMap[c.id] || {}
              const cong = g.freeze_status === 'CONGELADO'
              const wf = g.workflow_status || 'EDITÁVEL'
              const nAssin = (g.assinaturas || []).length
              return (
                <div key={c.id} className="border border-slate-200 rounded-lg p-2.5 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge cor={c.cor}>{c.label}</Badge>
                      <Badge cor={cong ? 'verde' : 'cinza'}>{cong ? 'CONGELADO' : 'EDITÁVEL'}</Badge>
                      {g.workflow_status && <span className="text-slate-400">{wf}</span>}
                      {g.revisao_atual && <span className="text-slate-400 font-mono">Rev {g.revisao_atual}</span>}
                      {nAssin > 0 && <span className="text-slate-400 flex items-center gap-0.5"><PenLine size={10} />{nAssin}/3</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!cong ? (
                        <>
                          <button onClick={() => congelarCen(c)} disabled={acao} className="text-emerald-700 font-medium hover:underline">Congelar</button>
                          {['cliente', 'vendedor', 'tecnico'].map((p) => (
                            <button key={p} onClick={() => assinarCen(c, p)} disabled={acao} className="text-indigo-600 hover:underline" title={`Assinar como ${p}`}>{p[0].toUpperCase()}</button>
                          ))}
                        </>
                      ) : (
                        <button onClick={() => revisarCen(c)} disabled={acao} className="text-slate-600 font-medium hover:underline">Nova revisão</button>
                      )}
                    </div>
                  </div>
                  {g.timeline?.length > 0 && (
                    <div className="mt-1.5 pl-1 border-l-2 border-slate-100 space-y-0.5">
                      {[...g.timeline].reverse().slice(0, 3).map((t, i) => (
                        <p key={i} className="text-slate-400">
                          {t.detalhe}
                          {t.timestamp && <span className="ml-1">· {new Date(t.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Congele cenários individualmente — um pode estar ASSINADO enquanto outro segue em negociação.</p>
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

      {/* Revisões comerciais (diff) */}
      {(com.revisoes_comerciais?.length > 0) && (
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1"><GitBranch size={12} /> Revisões comerciais</p>
          <div className="space-y-1.5">
            {[...com.revisoes_comerciais].reverse().map((r, i) => (
              <div key={i} className="text-xs bg-slate-50 rounded px-2 py-1.5">
                <span className="font-mono text-slate-600">Rev {r.rev}</span>
                {r.motivo && <span className="text-slate-500"> · {r.motivo}</span>}
                {r.diff?.length > 0 && (
                  <ul className="ml-3 mt-0.5 list-disc text-slate-500">
                    {r.diff.map((d, j) => (
                      <li key={j}>{d.campo}: {String(d.de)} → {String(d.para)}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {erro && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{erro}</div>}

      {/* Ações de workflow (state-machine: só transições válidas) */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        {proximosEstados.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">Avançar para:</span>
            {proximosEstados.map((e) => (
              <button key={e} onClick={() => mudarWorkflow(e)} disabled={acao}
                className="text-xs font-medium px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                {getEstadoConfig(e).label}
              </button>
            ))}
          </div>
        )}
        {podeCalcular && !congelado && (
          <Button variante="secundario" tamanho="sm" icone={Snowflake} onClick={congelarComercial} carregando={acao}>
            Congelar comercial
          </Button>
        )}
        {congelado && (
          <Button variante="secundario" tamanho="sm" icone={GitBranch} onClick={revisar} carregando={acao}>
            Nova revisão comercial
          </Button>
        )}
      </div>
    </div>
  )
}
