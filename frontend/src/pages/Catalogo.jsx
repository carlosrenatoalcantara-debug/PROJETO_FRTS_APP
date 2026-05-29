import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, RefreshCw, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Search, BarChart2, Copy, Zap, Edit2 } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import {
  validarEquipamento,
  getNivelConfig,
  getSeveridadeConfig,
  corDoScore,
  podeUsarEmProjeto,
  NIVEL_CONFIG,
} from '../utils/catalogQualityEngine'
import { avaliarUtilizavel } from '../utils/utilizavelProjeto'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway */

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function QualidadeBadge({ nivel, pequeno = false }) {
  const cfg = getNivelConfig(nivel)
  const mapCor = {
    verde:    'bg-emerald-100 text-emerald-800 border-emerald-200',
    azul:     'bg-blue-100 text-blue-800 border-blue-200',
    amarelo:  'bg-amber-100 text-amber-800 border-amber-200',
    laranja:  'bg-orange-100 text-orange-800 border-orange-200',
    vermelho: 'bg-red-100 text-red-800 border-red-200',
    cinza:    'bg-slate-100 text-slate-600 border-slate-200',
  }
  const cls = mapCor[cfg.cor] || mapCor.cinza
  const size = pequeno ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
  return (
    <span className={`inline-block font-bold border rounded ${size} ${cls}`} title={cfg.descricao}>
      {cfg.label}
    </span>
  )
}

function ScoreBar({ score, showLabel = true }) {
  const cores = corDoScore(score ?? 0)
  const pct = Math.max(0, Math.min(100, score ?? 0))
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${cores.bg}`} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span className={`text-xs font-semibold tabular-nums ${cores.text}`}>{pct}</span>}
    </div>
  )
}

function AlertasLista({ alertas }) {
  if (!alertas?.length) return null
  return (
    <div className="mt-2 space-y-1">
      {alertas.map((a, i) => {
        const cfg = getSeveridadeConfig(a.severidade)
        return (
          <div key={i} className={`text-xs rounded px-2 py-1 ${cfg.corBg} ${cfg.corText}`}>
            <span className="mr-1">{cfg.icon}</span>
            <span className="font-medium">{a.codigo}:</span>{' '}
            <span>{a.mensagem}</span>
          </div>
        )
      })}
    </div>
  )
}

// Card de equipamento com badge de qualidade e score
function EquipamentoCard({ eq, onDeletar, onReprocessar, selecionado, onToggleSel, onEditar, onCompletarIA }) {
  const [expandido, setExpandido] = useState(false)

  // Qualidade: prefere dados calculados pelo backend, fallback ao engine local
  const qualBD = eq.qualidade || null
  const nivel   = qualBD?.nivel ?? null
  const score   = qualBD?.score_global ?? null
  const alertas = qualBD?.alertas ?? []
  const alertasCriticos = alertas.filter(a => a.severidade === 'critico' || a.severidade === 'alto')

  const esp = eq.especificacoes || {}
  const isMod = eq.tipo === 'modulo'

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {onToggleSel && (
            <input type="checkbox" checked={!!selecionado} onChange={onToggleSel} className="mt-1 accent-orange-500" title="Selecionar" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-slate-900 truncate">{eq.fabricante || '—'}</p>
              <QualidadeBadge nivel={nivel} pequeno />
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">{eq.modelo}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onCompletarIA && (
            <button onClick={onCompletarIA} title="Completar com IA (datasheet salvo)"
              className="text-slate-400 hover:text-violet-600 p-1 rounded">
              <Zap size={13} />
            </button>
          )}
          {onEditar && (
            <button onClick={onEditar} title="Editar ficha técnica"
              className="text-slate-400 hover:text-emerald-600 p-1 rounded">
              <Edit2 size={13} />
            </button>
          )}
          {onReprocessar && (
            <button onClick={() => onReprocessar(eq._id)} title="Reprocessar qualidade"
              className="text-slate-400 hover:text-blue-600 p-1 rounded">
              <RefreshCw size={13} />
            </button>
          )}
          <button onClick={() => onDeletar(eq._id, `${eq.fabricante} ${eq.modelo}`)}
            className="text-slate-400 hover:text-red-600 p-1 rounded">
            <Trash2 size={13} />
          </button>
        </div>
      </CardHeader>

      <CardBody className="flex-1 space-y-2 text-sm">
        {score !== null && (
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-0.5">
              <span>Qualidade</span>
              {alertasCriticos.length > 0 && (
                <span className="text-orange-600 font-medium">{alertasCriticos.length} alerta{alertasCriticos.length > 1 ? 's' : ''}</span>
              )}
            </div>
            <ScoreBar score={score} />
          </div>
        )}

        {/* S8.0.1: liberação para engenharia */}
        {(() => {
          const av = eq.utilizavel_em_projeto != null
            ? { utilizavel: eq.utilizavel_em_projeto, faltando: eq.bloqueio_engenharia || [] }
            : avaliarUtilizavel(eq.tipo, esp)
          return av.utilizavel
            ? <div className="text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-1">Engenharia: Liberado ✓</div>
            : <div className="text-xs text-red-700 bg-red-50 rounded px-2 py-1">Engenharia: Bloqueado — Falta: {av.faltando.join(', ')}</div>
        })()}

        {isMod ? (
          <>
            {esp.potencia != null && <SpecRow rotulo="Potência" valor={`${esp.potencia} Wp`} />}
            {esp.voc     != null && <SpecRow rotulo="Voc" valor={`${esp.voc} V`} />}
            {esp.vmp     != null && <SpecRow rotulo="Vmpp" valor={`${esp.vmp} V`} />}
            {esp.isc     != null && <SpecRow rotulo="Isc" valor={`${esp.isc} A`} />}
            {esp.eficiencia != null && <SpecRow rotulo="Efic." valor={`${esp.eficiencia} %`} />}
          </>
        ) : (
          <>
            {esp.potencia != null && <SpecRow rotulo="Potência CA" valor={`${esp.potencia} kW`} />}
            {esp.mppts    != null && <SpecRow rotulo="MPPTs" valor={esp.mppts} />}
            {esp.voc_max  != null && <SpecRow rotulo="Voc max DC" valor={`${esp.voc_max} V`} />}
            {esp.mppt_min != null && <SpecRow rotulo="MPPT min" valor={`${esp.mppt_min} V`} />}
            {esp.mppt_max != null && <SpecRow rotulo="MPPT max" valor={`${esp.mppt_max} V`} />}
          </>
        )}

        {alertas.length > 0 && (
          <button
            onClick={() => setExpandido(v => !v)}
            className="w-full text-left text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 mt-1"
          >
            {expandido ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expandido ? 'Ocultar alertas' : `Ver ${alertas.length} alerta${alertas.length > 1 ? 's' : ''}`}
          </button>
        )}
        {expandido && <AlertasLista alertas={alertas} />}
      </CardBody>
    </Card>
  )
}

function SpecRow({ rotulo, valor }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{rotulo}:</span>
      <span className="font-medium">{valor}</span>
    </div>
  )
}

// Preview de qualidade inline durante preenchimento do formulário
function PreviewQualidade({ eq }) {
  if (!eq.tipo || (!eq.fabricante && !eq.modelo)) return null
  const res = validarEquipamento(eq)
  const uso = podeUsarEmProjeto(res.nivel)
  return (
    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600">Qualidade prévia</span>
        <div className="flex items-center gap-2">
          <QualidadeBadge nivel={res.nivel} />
          <span className="text-xs text-slate-500">Score {res.score}</span>
        </div>
      </div>
      <ScoreBar score={res.score} />
      {!uso.pode && (
        <p className="text-xs text-red-700 bg-red-50 rounded px-2 py-1">{uso.mensagem}</p>
      )}
      {res.alertas.length > 0 && (
        <AlertasLista alertas={res.alertas.slice(0, 4)} />
      )}
      {res.campos_faltantes.length > 0 && (
        <p className="text-xs text-slate-500">
          Faltando: {res.campos_faltantes.slice(0, 5).join(', ')}
          {res.campos_faltantes.length > 5 ? ` (+${res.campos_faltantes.length - 5})` : ''}
        </p>
      )}
    </div>
  )
}

// ─── Aba Qualidade (dashboard) ────────────────────────────────────────────────

function AbaQualidade({ modulos, inversores }) {
  const [relatorio, setRelatorio] = useState(null)
  const [carregandoRel, setCarregandoRel] = useState(false)
  const [erroRel, setErroRel] = useState(null)
  const [reprocessando, setReprocessando] = useState(false)
  const [msgReprocessamento, setMsgReprocessamento] = useState(null)

  const carregarRelatorio = useCallback(async () => {
    setCarregandoRel(true)
    setErroRel(null)
    try {
      const res = await fetch(`${API_URL}/api/admin/catalogo/qualidade-relatorio`)
      const data = await res.json()
      if (!data.sucesso) throw new Error(data.erro || 'Falha ao carregar relatório')
      setRelatorio(data)
    } catch (err) {
      setErroRel(err.message)
    } finally {
      setCarregandoRel(false)
    }
  }, [])

  useEffect(() => { carregarRelatorio() }, [carregarRelatorio])

  async function reprocessarTodos() {
    if (!confirm('Reprocessar qualidade de todos os equipamentos? Pode levar alguns segundos.')) return
    setReprocessando(true)
    setMsgReprocessamento(null)
    try {
      const res = await fetch(`${API_URL}/api/admin/catalogo/reprocessar-todos`, { method: 'POST' })
      const data = await res.json()
      if (data.sucesso) {
        setMsgReprocessamento(`✅ ${data.processados} reprocessados, ${data.erros} erros.`)
        await carregarRelatorio()
      } else {
        setMsgReprocessamento(`❌ Erro: ${data.erro}`)
      }
    } catch (err) {
      setMsgReprocessamento(`❌ ${err.message}`)
    } finally {
      setReprocessando(false)
    }
  }

  // S8.0: limpeza segura por status (inválidos/suspeitos), com proteção a aprovados
  async function limparPorStatus(status) {
    const incluiAprovados = status.some(s => ['validado', 'utilizavel'].includes(s))
    if (!confirm(`Excluir equipamentos com status: ${status.join(', ')}?`)) return
    if (incluiAprovados && !confirm('⚠️ Você está incluindo APROVADOS. Confirma a exclusão definitiva?')) return
    setReprocessando(true)
    try {
      const res = await fetch(`${API_URL}/api/admin/catalogo/por-status`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, confirmarAprovados: incluiAprovados }),
      })
      const data = await res.json()
      setMsgReprocessamento(data.sucesso ? `🗑️ ${data.excluidos} excluído(s).` : `❌ ${data.erro}`)
      await carregarRelatorio()
    } catch (err) {
      setMsgReprocessamento(`❌ ${err.message}`)
    } finally {
      setReprocessando(false)
    }
  }

  if (carregandoRel) return <div className="p-8 text-center text-slate-500">Carregando relatório de qualidade...</div>
  if (erroRel) return (
    <div className="p-4">
      <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 text-sm mb-3">
        ⚠️ {erroRel}
      </div>
      <button onClick={carregarRelatorio} className="text-sm text-blue-600 hover:underline">Tentar novamente</button>
    </div>
  )
  if (!relatorio) return null

  const { totais, distribuicao_nivel, scores, top_alertas, invalidos_amostra } = relatorio
  const nivelOrdem = ['validado', 'utilizavel', 'incompleto', 'suspeito', 'invalido', 'aguardando_revisao']

  return (
    <div className="space-y-6">
      {/* Cabeçalho + botão reprocessar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Dashboard de Qualidade</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {totais.equipamentos_total} equipamentos analisados
            {totais.sem_qualidade_calculada > 0 && (
              <span className="ml-2 text-amber-600">({totais.sem_qualidade_calculada} sem cálculo)</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={carregarRelatorio} title="Atualizar"
            className="p-2 text-slate-400 hover:text-slate-700 rounded">
            <RefreshCw size={16} />
          </button>
          <Button
            variante="secundario"
            icone={Zap}
            onClick={reprocessarTodos}
            carregando={reprocessando}
          >
            Reprocessar Todos
          </Button>
          <button onClick={() => limparPorStatus(['invalido', 'suspeito'])} disabled={reprocessando}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-medium">
            <Trash2 size={14} /> Limpar inválidos/suspeitos
          </button>
        </div>
      </div>

      {msgReprocessamento && (
        <div className="text-sm bg-slate-50 border border-slate-200 rounded px-3 py-2">{msgReprocessamento}</div>
      )}

      {/* Totais por tipo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(totais.por_tipo || {}).map(([tipo, total]) => (
          <div key={tipo} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-slate-800">{total}</div>
            <div className="text-xs text-slate-500 capitalize mt-0.5">{tipo}</div>
          </div>
        ))}
      </div>

      {/* Scores gerais */}
      {scores?.geral && (
        <Card>
          <CardHeader>Scores Médios Globais</CardHeader>
          <CardBody>
            <div className="grid grid-cols-3 gap-4">
              <ScoreGlobal label="Score Global" value={scores.geral.score_global_medio} />
              <ScoreGlobal label="Completude" value={scores.geral.completude_score_medio} />
              <ScoreGlobal label="Confiança" value={scores.geral.confianca_score_medio} />
            </div>
          </CardBody>
        </Card>
      )}

      {/* Distribuição por nível */}
      <Card>
        <CardHeader>Distribuição por Nível</CardHeader>
        <CardBody>
          <div className="space-y-2">
            {nivelOrdem.map(nivel => {
              const total = distribuicao_nivel?.[nivel] ?? 0
              if (!total) return null
              const cfg = getNivelConfig(nivel)
              const pct = totais.equipamentos_total > 0 ? Math.round((total / totais.equipamentos_total) * 100) : 0
              return (
                <div key={nivel} className="flex items-center gap-3">
                  <div className="w-24 shrink-0">
                    <QualidadeBadge nivel={nivel} />
                  </div>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cfg.corHex }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 w-8 text-right">{total}</span>
                  <span className="text-xs text-slate-400 w-8">{pct}%</span>
                </div>
              )
            })}
          </div>
        </CardBody>
      </Card>

      {/* Scores por tipo */}
      {scores?.por_tipo?.length > 0 && (
        <Card>
          <CardHeader>Scores por Tipo</CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-100">
                    <th className="text-left py-1 pr-4">Tipo</th>
                    <th className="text-right py-1 px-2">Total</th>
                    <th className="text-right py-1 px-2">Score Global</th>
                    <th className="text-right py-1 px-2">Completude</th>
                    <th className="text-right py-1 px-2">Confiança</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.por_tipo.map(s => (
                    <tr key={s.tipo} className="border-b border-slate-50">
                      <td className="py-1.5 pr-4 font-medium capitalize text-slate-800">{s.tipo}</td>
                      <td className="py-1.5 px-2 text-right text-slate-600">{s.total}</td>
                      <ScoreCell v={s.score_global_medio} />
                      <ScoreCell v={s.completude_score_medio} />
                      <ScoreCell v={s.confianca_score_medio} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Top alertas */}
      {top_alertas?.length > 0 && (
        <Card>
          <CardHeader>Top Alertas mais Frequentes</CardHeader>
          <CardBody>
            <div className="space-y-1">
              {top_alertas.slice(0, 12).map((a, i) => {
                const cfg = getSeveridadeConfig(a.severidade)
                return (
                  <div key={i} className={`flex items-center justify-between text-xs rounded px-2 py-1.5 ${cfg.corBg} ${cfg.corText}`}>
                    <span>{cfg.icon} <span className="font-mono font-medium">{a.codigo}</span></span>
                    <span className="font-bold">{a.ocorrencias}×</span>
                  </div>
                )
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Inválidos */}
      {invalidos_amostra?.length > 0 && (
        <Card>
          <CardHeader>Equipamentos Inválidos (amostra)</CardHeader>
          <CardBody>
            <div className="space-y-2">
              {invalidos_amostra.map(e => (
                <div key={e._id} className="flex items-start justify-between gap-2 text-sm border-b border-slate-50 pb-2">
                  <div>
                    <span className="font-medium text-slate-800">{e.fabricante} {e.modelo}</span>
                    <span className="ml-2 text-xs text-slate-400 capitalize">{e.tipo}</span>
                    {e.codigos_alerta?.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {e.codigos_alerta.map(c => (
                          <span key={c} className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono">{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 shrink-0">Score {e.score_global ?? '—'}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function ScoreGlobal({ label, value }) {
  const cores = corDoScore(value ?? 0)
  return (
    <div className="text-center">
      <div className={`text-3xl font-bold ${cores.text}`}>{value ?? '—'}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      <div className="mt-1"><ScoreBar score={value} showLabel={false} /></div>
    </div>
  )
}

function ScoreCell({ v }) {
  const cores = corDoScore(v ?? 0)
  return (
    <td className={`py-1.5 px-2 text-right font-semibold ${cores.text}`}>{v ?? '—'}</td>
  )
}

// ─── Aba Duplicatas ───────────────────────────────────────────────────────────

function AbaDuplicatas() {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const res = await fetch(`${API_URL}/api/admin/catalogo/duplicatas`)
      const data = await res.json()
      if (!data.sucesso) throw new Error(data.erro || 'Falha')
      setDados(data)
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  if (carregando) return <div className="p-8 text-center text-slate-500">Analisando duplicatas...</div>
  if (erro) return (
    <div className="p-4">
      <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 text-sm mb-3">⚠️ {erro}</div>
      <button onClick={carregar} className="text-sm text-blue-600 hover:underline">Tentar novamente</button>
    </div>
  )
  if (!dados) return null

  const { resumo, duplicatas_exatas, duplicatas_provaveis } = dados

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Detecção de Duplicatas</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {resumo.grupos_exatos} duplicatas exatas · {resumo.grupos_provaveis} prováveis
          </p>
        </div>
        <button onClick={carregar} title="Atualizar" className="p-2 text-slate-400 hover:text-slate-700 rounded">
          <RefreshCw size={16} />
        </button>
      </div>

      {resumo.total_suspeitos === 0 && (
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-4">
          <CheckCircle size={20} />
          <span className="font-medium">Nenhuma duplicata detectada no catálogo.</span>
        </div>
      )}

      {/* Duplicatas exatas */}
      {duplicatas_exatas?.length > 0 && (
        <Card>
          <CardHeader className="flex items-center gap-2">
            <Copy size={16} className="text-red-500" />
            Duplicatas Exatas ({duplicatas_exatas.length} grupos)
          </CardHeader>
          <CardBody>
            <p className="text-xs text-slate-500 mb-3">Mesmo hash tipo|fabricante_norm|modelo_norm — provavelmente cadastros duplicados.</p>
            <div className="space-y-3">
              {duplicatas_exatas.map((g, i) => (
                <GrupoDuplicata key={i} grupo={g} tipo="exata" />
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Duplicatas prováveis */}
      {duplicatas_provaveis?.length > 0 && (
        <Card>
          <CardHeader className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            Prováveis Duplicatas ({duplicatas_provaveis.length} grupos)
          </CardHeader>
          <CardBody>
            <p className="text-xs text-slate-500 mb-3">Mesmo tipo + fabricante + prefixo de modelo — verificar manualmente.</p>
            <div className="space-y-3">
              {duplicatas_provaveis.map((g, i) => (
                <GrupoDuplicata key={i} grupo={g} tipo="provavel" />
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function GrupoDuplicata({ grupo, tipo }) {
  const [aberto, setAberto] = useState(false)
  const id = grupo._id
  const titulo = typeof id === 'object'
    ? `${id.tipo || '?'} · ${id.fab_norm || '?'} · ${id.mod_prefix || '?'}…`
    : String(id)

  return (
    <div className={`border rounded-lg overflow-hidden ${tipo === 'exata' ? 'border-red-200' : 'border-amber-200'}`}>
      <button
        onClick={() => setAberto(v => !v)}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-left ${tipo === 'exata' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`}
      >
        <span>{grupo.total}× {titulo}</span>
        {aberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {aberto && (
        <div className="divide-y divide-slate-100">
          {grupo.docs.map(doc => (
            <div key={doc._id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-medium text-slate-800">{doc.fabricante} {doc.modelo}</span>
                <span className="ml-2 text-slate-400 capitalize">{doc.tipo}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <QualidadeBadge nivel={doc.nivel} pequeno />
                <span className="text-slate-400">{doc.score ?? '—'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Formulário módulo ────────────────────────────────────────────────────────

const FORM_MODULO_INICIAL = {
  fabricante: '', modelo: '', potencia: '', voc: '', vmp: '', isc: '', impp: '',
  eficiencia: '', coef_temp_voc: '', noct: '',
  garantia_produto: 12, garantia_performance: 25,
}

function FormNovoModulo({ onSalvar, onCancelar }) {
  const [form, setForm] = useState(FORM_MODULO_INICIAL)
  const [salvando, setSalvando] = useState(false)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  // Monta objeto de preview para validarEquipamento
  const previewEq = {
    tipo: 'modulo',
    fabricante: form.fabricante,
    modelo: form.modelo,
    especificacoes: {
      potencia: form.potencia, voc: form.voc, vmp: form.vmp,
      isc: form.isc, impp: form.impp, eficiencia: form.eficiencia,
      coef_temp_voc: form.coef_temp_voc, noct: form.noct,
    },
  }

  async function salvar() {
    if (!form.fabricante || !form.modelo || !form.potencia) {
      alert('Fabricante, modelo e potência são obrigatórios.')
      return
    }
    setSalvando(true)
    try {
      const payload = {
        tipo: 'modulo',
        fabricante: form.fabricante,
        modelo: form.modelo,
        especificacoes: {
          potencia: Number(form.potencia) || 0,
          voc:      Number(form.voc) || undefined,
          vmp:      Number(form.vmp) || undefined,
          isc:      Number(form.isc) || undefined,
          impp:     Number(form.impp) || undefined,
          eficiencia: Number(form.eficiencia) || undefined,
          coef_temp_voc: Number(form.coef_temp_voc) || undefined,
          noct:     Number(form.noct) || undefined,
        },
        garantia_produto:     { value: Number(form.garantia_produto) || 12, unit: 'anos' },
        garantia_performance: { value: Number(form.garantia_performance) || 25, unit: 'anos' },
        ativo: true,
      }
      await onSalvar(payload)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card>
      <CardHeader>Adicionar Módulo Fotovoltaico</CardHeader>
      <CardBody className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input rotulo="Fabricante *" value={form.fabricante} onChange={set('fabricante')} placeholder="Ex: Canadian Solar" />
          <Input rotulo="Modelo *" value={form.modelo} onChange={set('modelo')} placeholder="Ex: CS6W-550MS" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input rotulo="Potência (Wp) *" type="number" value={form.potencia} onChange={set('potencia')} />
          <Input rotulo="Voc (V)" type="number" value={form.voc} onChange={set('voc')} />
          <Input rotulo="Vmpp (V)" type="number" value={form.vmp} onChange={set('vmp')} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input rotulo="Isc (A)" type="number" value={form.isc} onChange={set('isc')} />
          <Input rotulo="Impp (A)" type="number" value={form.impp} onChange={set('impp')} />
          <Input rotulo="Eficiência (%)" type="number" value={form.eficiencia} onChange={set('eficiencia')} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input rotulo="Coef. Temp. Voc (%/°C)" type="number" value={form.coef_temp_voc} onChange={set('coef_temp_voc')} placeholder="-0.29" />
          <Input rotulo="NOCT (°C)" type="number" value={form.noct} onChange={set('noct')} placeholder="44" />
          <Input rotulo="Garantia produto (anos)" type="number" value={form.garantia_produto} onChange={set('garantia_produto')} />
        </div>

        <PreviewQualidade eq={previewEq} />

        <div className="flex gap-2 pt-1">
          <Button variante="primario" onClick={salvar} carregando={salvando}>Criar Módulo</Button>
          <Button variante="secundario" onClick={onCancelar}>Cancelar</Button>
        </div>
      </CardBody>
    </Card>
  )
}

// ─── Formulário inversor ──────────────────────────────────────────────────────

const FORM_INVERSOR_INICIAL = {
  fabricante: '', modelo: '', potencia: '', mppts: 1,
  voc_max: '', mppt_min: '', mppt_max: '', isc_max_mppt: '', fases: '',
}

function FormNovoInversor({ onSalvar, onCancelar }) {
  const [form, setForm] = useState(FORM_INVERSOR_INICIAL)
  const [salvando, setSalvando] = useState(false)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const previewEq = {
    tipo: 'inversor',
    fabricante: form.fabricante,
    modelo: form.modelo,
    especificacoes: {
      potencia:     form.potencia,
      mppts:        form.mppts,
      voc_max:      form.voc_max,
      mppt_min:     form.mppt_min,
      mppt_max:     form.mppt_max,
      ipv_max:      form.isc_max_mppt,
      fases:        form.fases,
    },
  }

  async function salvar() {
    if (!form.fabricante || !form.modelo || !form.potencia) {
      alert('Fabricante, modelo e potência são obrigatórios.')
      return
    }
    setSalvando(true)
    try {
      const payload = {
        tipo: 'inversor',
        fabricante: form.fabricante,
        modelo: form.modelo,
        especificacoes: {
          potencia:     Number(form.potencia) || 0,
          mppts:        Number(form.mppts) || 1,
          voc_max:      Number(form.voc_max) || undefined,
          mppt_min:     Number(form.mppt_min) || undefined,
          mppt_max:     Number(form.mppt_max) || undefined,
          ipv_max:      Number(form.isc_max_mppt) || undefined,
          fases:        Number(form.fases) || undefined,
        },
        ativo: true,
      }
      await onSalvar(payload)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card>
      <CardHeader>Adicionar Inversor</CardHeader>
      <CardBody className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input rotulo="Fabricante *" value={form.fabricante} onChange={set('fabricante')} placeholder="Ex: Growatt" />
          <Input rotulo="Modelo *" value={form.modelo} onChange={set('modelo')} placeholder="Ex: MIC 5000TL-X" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input rotulo="Potência CA (kW) *" type="number" value={form.potencia} onChange={set('potencia')} />
          <Input rotulo="Nº MPPTs" type="number" value={form.mppts} onChange={set('mppts')} />
          <Input rotulo="Fases saída" type="number" value={form.fases} onChange={set('fases')} placeholder="1 ou 3" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input rotulo="Voc máx DC (V)" type="number" value={form.voc_max} onChange={set('voc_max')} />
          <Input rotulo="MPPT mín (V)" type="number" value={form.mppt_min} onChange={set('mppt_min')} />
          <Input rotulo="MPPT máx (V)" type="number" value={form.mppt_max} onChange={set('mppt_max')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input rotulo="Isc máx/MPPT (A)" type="number" value={form.isc_max_mppt} onChange={set('isc_max_mppt')} />
        </div>

        <PreviewQualidade eq={previewEq} />

        <div className="flex gap-2 pt-1">
          <Button variante="primario" onClick={salvar} carregando={salvando}>Criar Inversor</Button>
          <Button variante="secundario" onClick={onCancelar}>Cancelar</Button>
        </div>
      </CardBody>
    </Card>
  )
}

// ─── Aba equipamentos (módulos ou inversores) ─────────────────────────────────

function AbaEquipamentos({ tipo, equipamentos, carregarDados }) {
  const [mostraForm, setMostraForm]   = useState(false)
  const [busca, setBusca]             = useState('')
  const [filtroNivel, setFiltroNivel] = useState('')
  const [reprocessandoId, setReprocessandoId] = useState(null)
  // S8.0: seleção múltipla + ações em lote
  const [selecionados, setSelecionados] = useState({})
  const [emLote, setEmLote] = useState(false)

  const isMod = tipo === 'modulo'

  const filtrados = equipamentos.filter(eq => {
    const q = busca.toLowerCase()
    const matchBusca = !q ||
      (eq.fabricante || '').toLowerCase().includes(q) ||
      (eq.modelo || '').toLowerCase().includes(q)
    const matchNivel = !filtroNivel || eq.qualidade?.nivel === filtroNivel
    return matchBusca && matchNivel
  })

  async function onSalvar(payload) {
    const res = await fetch(`${API_URL}/api/equipamentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      await carregarDados()
      setMostraForm(false)
    } else {
      const err = await res.json().catch(() => ({}))
      alert('Erro ao criar: ' + (err.erro || res.status))
    }
  }

  async function onDeletar(id, nome) {
    if (!confirm(`Deletar "${nome}"?`)) return
    const res = await fetch(`${API_URL}/api/equipamentos/${id}`, { method: 'DELETE' })
    if (res.ok) await carregarDados()
    else alert('Erro ao deletar: ' + res.status)
  }

  async function onReprocessar(id) {
    setReprocessandoId(id)
    try {
      await fetch(`${API_URL}/api/admin/catalogo/reprocessar/${id}`, { method: 'POST' })
      await carregarDados()
    } catch (e) {
      console.error('Reprocessar:', e)
    } finally {
      setReprocessandoId(null)
    }
  }

  // Contagens por nível para os filtros
  const contagemNivel = equipamentos.reduce((acc, eq) => {
    const n = eq.qualidade?.nivel || '(sem)'
    acc[n] = (acc[n] || 0) + 1
    return acc
  }, {})

  // S8.0: seleção e ações em lote
  const idsSelecionados = Object.keys(selecionados).filter(id => selecionados[id])
  function toggleSel(id) { setSelecionados(s => ({ ...s, [id]: !s[id] })) }
  function selecionarTodos() {
    const todos = {}
    filtrados.forEach(eq => { todos[eq._id] = true })
    setSelecionados(todos)
  }
  function limparSelecao() { setSelecionados({}) }

  async function acaoLote(acao) {
    if (idsSelecionados.length === 0) return
    if (acao === 'excluir' && !confirm(`Excluir ${idsSelecionados.length} equipamento(s)?`)) return
    setEmLote(true)
    try {
      const res = await fetch(`${API_URL}/api/admin/catalogo/lote`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsSelecionados, acao }),
      })
      const d = await res.json()
      if (d.sucesso) { limparSelecao(); await carregarDados() }
      else alert('Erro: ' + (d.erro || res.status))
    } catch (e) { alert('Erro: ' + e.message) } finally { setEmLote(false) }
  }

  async function editarManual(eq) {
    // Edição rápida dos campos elétricos principais via prompt (modal completo: futuro)
    const esp = eq.especificacoes || {}
    const campo = (label, atual) => {
      const v = window.prompt(`${label}:`, atual ?? '')
      return v === null ? undefined : (v === '' ? null : (isNaN(Number(v)) ? v : Number(v)))
    }
    const campos = {}
    const fab = window.prompt('Fabricante:', eq.fabricante ?? ''); if (fab !== null) campos.fabricante = fab
    const mod = window.prompt('Modelo:', eq.modelo ?? ''); if (mod !== null) campos.modelo = mod
    if (isMod) {
      const p = campo('Potência (Wp)', esp.potencia); if (p !== undefined) campos.potencia = p
      const voc = campo('Voc (V)', esp.voc); if (voc !== undefined) campos.voc = voc
      const isc = campo('Isc (A)', esp.isc); if (isc !== undefined) campos.isc = isc
    } else {
      const p = campo('Potência CA (kW)', esp.potencia); if (p !== undefined) campos.potencia = p
      const vm = campo('Voc máx DC (V)', esp.voc_max); if (vm !== undefined) campos.voc_max = vm
    }
    if (Object.keys(campos).length === 0) return
    try {
      const res = await fetch(`${API_URL}/api/admin/catalogo/equipamento/${eq._id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campos }),
      })
      const d = await res.json()
      if (d.sucesso) await carregarDados()
      else alert('Erro: ' + (d.erro || res.status))
    } catch (e) { alert('Erro: ' + e.message) }
  }

  // S8.0.1: completar com IA usando o datasheet salvo → revisão humana → PATCH
  async function completarIA(eq) {
    try {
      const res = await fetch(`${API_URL}/api/admin/catalogo/completar-ia/${eq._id}`, { method: 'POST' })
      const d = await res.json()
      if (!d.sucesso) { alert('Erro: ' + (d.erro || (d.codigo === 'SEM_DATASHEET' ? 'Sem datasheet salvo.' : res.status))); return }
      const sug = d.sugestoes || {}
      const chaves = Object.keys(sug)
      if (chaves.length === 0) { alert('IA não encontrou campos vazios para sugerir.'); return }
      // Revisão humana simples: confirma cada sugestão
      const campos = {}
      for (const k of chaves) {
        const s = sug[k]
        if (window.confirm(`Confirmar "${k}" = ${s.valor} (${s.fonte}, ${Math.round((s.confianca || 0) * 100)}%)?`)) campos[k] = s.valor
      }
      if (Object.keys(campos).length === 0) return
      const pr = await fetch(`${API_URL}/api/admin/catalogo/equipamento/${eq._id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campos }),
      })
      const pd = await pr.json()
      if (pd.sucesso) await carregarDados(); else alert('Erro ao salvar: ' + (pd.erro || pr.status))
    } catch (e) { alert('Erro: ' + e.message) }
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-slate-900">
          {isMod ? 'Módulos Fotovoltaicos' : 'Inversores'} ({equipamentos.length})
        </h2>
        <Button icone={Plus} onClick={() => setMostraForm(v => !v)}>
          {isMod ? 'Novo Módulo' : 'Novo Inversor'}
        </Button>
      </div>

      {/* Formulário */}
      {mostraForm && (
        isMod
          ? <FormNovoModulo onSalvar={onSalvar} onCancelar={() => setMostraForm(false)} />
          : <FormNovoInversor onSalvar={onSalvar} onCancelar={() => setMostraForm(false)} />
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar fabricante ou modelo..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <select
          value={filtroNivel}
          onChange={e => setFiltroNivel(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          <option value="">Todos os níveis</option>
          {Object.entries(NIVEL_CONFIG).filter(([k]) => k !== 'null').map(([k, v]) => (
            <option key={k} value={k}>
              {v.label} {contagemNivel[k] ? `(${contagemNivel[k]})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* S8.0: barra de seleção/ações em lote */}
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <button onClick={selecionarTodos} className="text-slate-600 hover:underline">Selecionar todos ({filtrados.length})</button>
        {idsSelecionados.length > 0 && (
          <>
            <span className="text-slate-400">·</span>
            <span className="font-medium text-slate-700">{idsSelecionados.length} selecionado(s)</span>
            <button onClick={() => acaoLote('reprocessar')} disabled={emLote} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs">Reprocessar</button>
            <button onClick={() => acaoLote('validar')} disabled={emLote} className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs">Validar</button>
            <button onClick={() => acaoLote('excluir')} disabled={emLote} className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs">Excluir</button>
            <button onClick={limparSelecao} className="text-slate-400 hover:text-slate-600 text-xs">limpar</button>
          </>
        )}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtrados.map(eq => (
          <EquipamentoCard
            key={eq._id}
            eq={eq}
            onDeletar={onDeletar}
            onReprocessar={onReprocessar}
            selecionado={!!selecionados[eq._id]}
            onToggleSel={() => toggleSel(eq._id)}
            onEditar={() => editarManual(eq)}
            onCompletarIA={() => completarIA(eq)}
          />
        ))}
        {filtrados.length === 0 && (
          <div className="col-span-full text-center text-slate-500 py-10">
            {busca || filtroNivel ? 'Nenhum resultado para o filtro aplicado.' : `Nenhum ${isMod ? 'módulo' : 'inversor'} cadastrado.`}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Catalogo() {
  const [aba, setAba]             = useState('modulos')
  const [modulos, setModulos]     = useState([])
  const [inversores, setInversores] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga]   = useState(null)

  const carregarDados = useCallback(async () => {
    try {
      setCarregando(true)
      setErroCarga(null)

      const [modRes, invRes] = await Promise.all([
        fetch(`${API_URL}/api/equipamentos?tipo=modulo`),
        fetch(`${API_URL}/api/equipamentos?tipo=inversor`),
      ])

      if (!modRes.ok || !invRes.ok) {
        throw new Error(`Backend retornou erro (${modRes.status}/${invRes.status})`)
      }

      const modJson = await modRes.json()
      const invJson = await invRes.json()

      const mod = Array.isArray(modJson) ? modJson : (modJson.equipamentos || [])
      const inv = Array.isArray(invJson) ? invJson : (invJson.equipamentos || [])

      setModulos(mod)
      setInversores(inv)
    } catch (err) {
      console.error('Erro ao carregar catálogo:', err)
      setErroCarga(err.message)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { carregarDados() }, [carregarDados])

  if (carregando) {
    return <div className="p-6 text-center text-slate-500">Carregando catálogo...</div>
  }

  if (erroCarga) {
    return (
      <div className="p-6">
        <Card>
          <CardBody className="text-center py-12">
            <div className="text-amber-600 font-medium mb-1">⚠️ Servidor temporariamente indisponível</div>
            <div className="text-slate-500 text-sm mb-3">{erroCarga}</div>
            <button onClick={carregarDados} className="text-sm text-blue-600 hover:text-blue-800 underline">
              Tentar novamente
            </button>
          </CardBody>
        </Card>
      </div>
    )
  }

  const TABS = [
    { id: 'modulos',     label: `Módulos (${modulos.length})` },
    { id: 'inversores',  label: `Inversores (${inversores.length})` },
    { id: 'qualidade',   label: '📊 Qualidade',  icone: BarChart2 },
    { id: 'duplicatas',  label: '🔍 Duplicatas',  icone: Copy },
  ]

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Catálogo de Equipamentos</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setAba(tab.id)}
            className={`px-4 py-2 font-medium whitespace-nowrap transition-colors ${
              aba === tab.id
                ? 'text-orange-600 border-b-2 border-orange-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {aba === 'modulos' && (
        <AbaEquipamentos tipo="modulo" equipamentos={modulos} carregarDados={carregarDados} />
      )}
      {aba === 'inversores' && (
        <AbaEquipamentos tipo="inversor" equipamentos={inversores} carregarDados={carregarDados} />
      )}
      {aba === 'qualidade' && (
        <AbaQualidade modulos={modulos} inversores={inversores} />
      )}
      {aba === 'duplicatas' && (
        <AbaDuplicatas />
      )}
    </div>
  )
}
