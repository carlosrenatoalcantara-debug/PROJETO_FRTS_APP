/**
 * 🧪 Admin — Qualidade do Catálogo Técnico (S2.6.1)
 *
 * Exibe o relatório consolidado retornado por:
 *   GET /api/admin/catalogo/qualidade-relatorio
 *
 * Seções:
 *  1. Resumo (totais, cobertura do backfill)
 *  2. Distribuição por nível de qualidade
 *  3. Scores médios (geral + por tipo)
 *  4. Top alertas
 *  5. Amostra de equipamentos inválidos
 *  6. Amostra de equipamentos desconhecidos
 */

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart2, AlertTriangle, CheckCircle2, RefreshCw,
  XCircle, HelpCircle, Info, ChevronDown, ChevronUp
} from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway */

// ─── Helpers visuais ─────────────────────────────────────────────────────────

const NIVEL_CONFIG = {
  validado:           { cor: 'green',  label: 'Validado',           icon: CheckCircle2 },
  utilizavel:         { cor: 'blue',   label: 'Utilizável',         icon: CheckCircle2 },
  incompleto:         { cor: 'yellow', label: 'Incompleto',         icon: Info },
  suspeito:           { cor: 'orange', label: 'Suspeito',           icon: AlertTriangle },
  invalido:           { cor: 'red',    label: 'Inválido',           icon: XCircle },
  aguardando_revisao: { cor: 'purple', label: 'Aguardando revisão', icon: HelpCircle },
  '(sem)':            { cor: 'slate',  label: 'Sem qualidade',      icon: HelpCircle },
}

const SEV_COR = {
  critico: 'red',
  alto:    'orange',
  medio:   'yellow',
  baixo:   'blue',
  info:    'slate',
}

function nivelCor(nivel) {
  return NIVEL_CONFIG[nivel]?.cor || 'slate'
}

function NivelBadge({ nivel }) {
  const cfg = NIVEL_CONFIG[nivel] || NIVEL_CONFIG['(sem)']
  const Icon = cfg.icon
  const c = cfg.cor
  const cls = {
    green:  'bg-green-100 text-green-800 border-green-300',
    blue:   'bg-blue-100 text-blue-800 border-blue-300',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    orange: 'bg-orange-100 text-orange-800 border-orange-300',
    red:    'bg-red-100 text-red-800 border-red-300',
    purple: 'bg-purple-100 text-purple-800 border-purple-300',
    slate:  'bg-slate-100 text-slate-600 border-slate-300',
  }[c] || 'bg-slate-100 text-slate-600 border-slate-300'

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  )
}

function ScoreBar({ valor, max = 100 }) {
  const pct = Math.min(100, Math.max(0, (valor / max) * 100))
  const cor = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : pct >= 40 ? 'bg-orange-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-200 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${cor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold text-slate-700 w-10 text-right">{valor.toFixed(1)}</span>
    </div>
  )
}

// ─── Seção expansível ────────────────────────────────────────────────────────

function Secao({ titulo, icone: Icon, children, defaultOpen = true }) {
  const [aberta, setAberta] = useState(defaultOpen)
  return (
    <Card>
      <button
        className="w-full text-left"
        onClick={() => setAberta(v => !v)}
      >
        <CardHeader className="flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors rounded-t-xl">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={18} className="text-slate-600" />}
            <h2 className="font-semibold text-slate-900">{titulo}</h2>
          </div>
          {aberta ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </CardHeader>
      </button>
      {aberta && <CardBody>{children}</CardBody>}
    </Card>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function AdminCatalogoQualidade() {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const res = await fetch(`${API_URL}/api/admin/catalogo/qualidade-relatorio`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.erro || `HTTP ${res.status}`)
      }
      const json = await res.json()
      if (!json.sucesso) throw new Error(json.erro || 'Resposta inválida')
      setDados(json)
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // ── Telas de estado ──────────────────────────────────────────────────────

  if (carregando && !dados) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw size={20} className="animate-spin" />
          <span>Carregando relatório de qualidade...</span>
        </div>
      </div>
    )
  }

  if (erro && !dados) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardBody className="text-center py-12">
            <AlertTriangle size={40} className="text-amber-500 mx-auto mb-3" />
            <p className="text-amber-800 font-medium mb-1">Não foi possível carregar o relatório</p>
            <p className="text-slate-500 text-sm mb-4">{erro}</p>
            <Button onClick={carregar} variante="secundario">Tentar novamente</Button>
          </CardBody>
        </Card>
      </div>
    )
  }

  if (!dados) return null

  // ── Derivações ────────────────────────────────────────────────────────────

  const total = dados.totais.equipamentos_total
  const semQual = dados.totais.sem_qualidade_calculada
  const coberturaBackfill = total > 0 ? (((total - semQual) / total) * 100).toFixed(1) : 100

  const niveisSorted = Object.entries(dados.distribuicao_nivel)
    .sort((a, b) => b[1] - a[1])

  const geradoEm = new Date(dados.gerado_em).toLocaleString('pt-BR')

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart2 className="text-orange-500" />
            Qualidade do Catálogo
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Relatório S2.6.1 — gerado em {geradoEm}
          </p>
        </div>
        <Button
          variante="secundario"
          onClick={carregar}
          disabled={carregando}
          className="flex items-center gap-2"
        >
          <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />
          Atualizar
        </Button>
      </div>

      {/* ── 1. Resumo ──────────────────────────────────────────────────────── */}
      <Secao titulo="Resumo do Catálogo" icone={BarChart2}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500 uppercase font-semibold">Total de equipamentos</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{total.toLocaleString('pt-BR')}</p>
          </div>

          {Object.entries(dados.totais.por_tipo).map(([tipo, n]) => (
            <div key={tipo} className="bg-blue-50 p-4 rounded-xl border border-blue-200">
              <p className="text-xs text-slate-500 uppercase font-semibold">{tipo}</p>
              <p className="text-3xl font-bold text-blue-900 mt-1">{n.toLocaleString('pt-BR')}</p>
            </div>
          ))}
        </div>

        {/* Cobertura do backfill */}
        <div className="mt-4 p-3 rounded-lg border bg-slate-50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-slate-700">Cobertura do backfill de qualidade</span>
            <span className="text-sm font-bold text-slate-900">{coberturaBackfill}%</span>
          </div>
          <div className="h-3 bg-slate-200 rounded-full">
            <div
              className="h-3 rounded-full bg-orange-400 transition-all"
              style={{ width: `${coberturaBackfill}%` }}
            />
          </div>
          {semQual > 0 && (
            <p className="text-xs text-amber-700 mt-1">
              ⚠️ {semQual} equipamento(s) ainda sem qualidade calculada — execute o backfill
            </p>
          )}
        </div>
      </Secao>

      {/* ── 2. Distribuição por nível ───────────────────────────────────────── */}
      <Secao titulo="Distribuição por Nível de Qualidade">
        <div className="space-y-3">
          {niveisSorted.map(([nivel, n]) => {
            const pct = total > 0 ? ((n / total) * 100).toFixed(1) : 0
            const cfg = NIVEL_CONFIG[nivel] || NIVEL_CONFIG['(sem)']
            const cor = cfg.cor
            const barCls = {
              green:  'bg-green-500',
              blue:   'bg-blue-500',
              yellow: 'bg-yellow-500',
              orange: 'bg-orange-500',
              red:    'bg-red-500',
              purple: 'bg-purple-500',
              slate:  'bg-slate-400',
            }[cor] || 'bg-slate-400'

            return (
              <div key={nivel}>
                <div className="flex items-center justify-between mb-1">
                  <NivelBadge nivel={nivel} />
                  <span className="text-sm text-slate-600">
                    <strong>{n.toLocaleString('pt-BR')}</strong>
                    <span className="text-slate-400 ml-1">({pct}%)</span>
                  </span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full">
                  <div className={`h-2 rounded-full transition-all ${barCls}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Tabela cruzada tipo × nível */}
        {dados.cruzado_tipo_x_nivel.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <p className="text-sm font-semibold text-slate-700 mb-2">Tipo × Nível</p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left px-3 py-2 border border-slate-200 text-slate-600">Tipo</th>
                  <th className="text-left px-3 py-2 border border-slate-200 text-slate-600">Nível</th>
                  <th className="text-right px-3 py-2 border border-slate-200 text-slate-600">Qtd</th>
                </tr>
              </thead>
              <tbody>
                {dados.cruzado_tipo_x_nivel.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-1.5 border border-slate-200 text-slate-700">{r.tipo || '—'}</td>
                    <td className="px-3 py-1.5 border border-slate-200">
                      <NivelBadge nivel={r.nivel} />
                    </td>
                    <td className="px-3 py-1.5 border border-slate-200 text-right font-semibold text-slate-800">
                      {r.total.toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>

      {/* ── 3. Scores médios ───────────────────────────────────────────────── */}
      <Secao titulo="Scores Médios">
        {dados.scores.geral && (
          <div className="mb-6">
            <p className="text-sm font-semibold text-slate-700 mb-3">Geral (todos os equipamentos)</p>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Score global</p>
                <ScoreBar valor={dados.scores.geral.score_global_medio} />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Completude</p>
                <ScoreBar valor={dados.scores.geral.completude_score_medio} />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Confiança</p>
                <ScoreBar valor={dados.scores.geral.confianca_score_medio} />
              </div>
            </div>
          </div>
        )}

        {dados.scores.por_tipo.length > 0 && (
          <>
            <p className="text-sm font-semibold text-slate-700 mb-3">Por tipo</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left px-3 py-2 border border-slate-200 text-slate-600">Tipo</th>
                    <th className="text-right px-3 py-2 border border-slate-200 text-slate-600">Qtd</th>
                    <th className="text-right px-3 py-2 border border-slate-200 text-slate-600">Score global</th>
                    <th className="text-right px-3 py-2 border border-slate-200 text-slate-600">Completude</th>
                    <th className="text-right px-3 py-2 border border-slate-200 text-slate-600">Confiança</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.scores.por_tipo.map((s, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2 border border-slate-200 font-medium text-slate-800">{s.tipo || '—'}</td>
                      <td className="px-3 py-2 border border-slate-200 text-right text-slate-600">{s.total.toLocaleString('pt-BR')}</td>
                      <td className={`px-3 py-2 border border-slate-200 text-right font-bold ${s.score_global_medio >= 80 ? 'text-green-700' : s.score_global_medio >= 60 ? 'text-yellow-700' : 'text-red-700'}`}>
                        {s.score_global_medio}
                      </td>
                      <td className="px-3 py-2 border border-slate-200 text-right text-slate-600">{s.completude_score_medio}</td>
                      <td className="px-3 py-2 border border-slate-200 text-right text-slate-600">{s.confianca_score_medio}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Secao>

      {/* ── 4. Top Alertas ─────────────────────────────────────────────────── */}
      {dados.top_alertas.length > 0 && (
        <Secao titulo={`Top Alertas (${dados.top_alertas.length})`} icone={AlertTriangle}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left px-3 py-2 border border-slate-200 text-slate-600">#</th>
                  <th className="text-left px-3 py-2 border border-slate-200 text-slate-600">Código</th>
                  <th className="text-left px-3 py-2 border border-slate-200 text-slate-600">Severidade</th>
                  <th className="text-right px-3 py-2 border border-slate-200 text-slate-600">Ocorrências</th>
                </tr>
              </thead>
              <tbody>
                {dados.top_alertas.map((a, i) => {
                  const cor = SEV_COR[a.severidade] || 'slate'
                  const badgeCls = {
                    red:    'bg-red-100 text-red-800 border-red-300',
                    orange: 'bg-orange-100 text-orange-800 border-orange-300',
                    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
                    blue:   'bg-blue-100 text-blue-800 border-blue-300',
                    slate:  'bg-slate-100 text-slate-600 border-slate-300',
                  }[cor]
                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2 border border-slate-200 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2 border border-slate-200 font-mono text-xs text-slate-800">{a.codigo}</td>
                      <td className="px-3 py-2 border border-slate-200">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${badgeCls}`}>
                          {a.severidade}
                        </span>
                      </td>
                      <td className="px-3 py-2 border border-slate-200 text-right font-semibold text-slate-800">
                        {a.ocorrencias.toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Secao>
      )}

      {/* ── 5. Equipamentos Inválidos ───────────────────────────────────────── */}
      {dados.invalidos_amostra.length > 0 && (
        <Secao titulo={`Equipamentos Inválidos — amostra (${dados.invalidos_amostra.length})`} icone={XCircle} defaultOpen={false}>
          <p className="text-xs text-slate-500 mb-3">
            Exibindo até 50 equipamentos com nível <NivelBadge nivel="invalido" /> — corrija os dados ou execute reprocessamento.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left px-3 py-2 border border-slate-200 text-slate-600">Tipo</th>
                  <th className="text-left px-3 py-2 border border-slate-200 text-slate-600">Fabricante</th>
                  <th className="text-left px-3 py-2 border border-slate-200 text-slate-600">Modelo</th>
                  <th className="text-right px-3 py-2 border border-slate-200 text-slate-600">Score</th>
                  <th className="text-left px-3 py-2 border border-slate-200 text-slate-600">Alertas críticos</th>
                </tr>
              </thead>
              <tbody>
                {dados.invalidos_amostra.map((e, i) => (
                  <tr key={i} className="hover:bg-red-50">
                    <td className="px-3 py-2 border border-slate-200 text-xs text-slate-600">{e.tipo || '—'}</td>
                    <td className="px-3 py-2 border border-slate-200 text-slate-800">{e.fabricante || '—'}</td>
                    <td className="px-3 py-2 border border-slate-200 text-slate-800">{e.modelo || '—'}</td>
                    <td className="px-3 py-2 border border-slate-200 text-right font-bold text-red-700">
                      {e.score_global ?? '—'}
                    </td>
                    <td className="px-3 py-2 border border-slate-200">
                      <div className="flex flex-wrap gap-1">
                        {(e.codigos_alerta || []).map((c, j) => (
                          <span key={j} className="text-xs font-mono bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200">
                            {c}
                          </span>
                        ))}
                        {(e.codigos_alerta || []).length === 0 && <span className="text-slate-400 text-xs">—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Secao>
      )}

      {/* ── 6. Equipamentos Desconhecidos ──────────────────────────────────── */}
      {dados.desconhecidos_amostra.length > 0 && (
        <Secao titulo={`Equipamentos Desconhecidos — amostra (${dados.desconhecidos_amostra.length})`} icone={HelpCircle} defaultOpen={false}>
          <p className="text-xs text-slate-500 mb-3">
            Fabricante ou modelo com valores genéricos ("desconhecido", "N/A", etc). Corrija no cadastro.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left px-3 py-2 border border-slate-200 text-slate-600">Tipo</th>
                  <th className="text-left px-3 py-2 border border-slate-200 text-slate-600">Fabricante</th>
                  <th className="text-left px-3 py-2 border border-slate-200 text-slate-600">Modelo</th>
                  <th className="text-left px-3 py-2 border border-slate-200 text-slate-600">Nível</th>
                  <th className="text-right px-3 py-2 border border-slate-200 text-slate-600">Score</th>
                </tr>
              </thead>
              <tbody>
                {dados.desconhecidos_amostra.map((e, i) => (
                  <tr key={i} className="hover:bg-yellow-50">
                    <td className="px-3 py-2 border border-slate-200 text-xs text-slate-600">{e.tipo || '—'}</td>
                    <td className="px-3 py-2 border border-slate-200 text-slate-800">{e.fabricante || '—'}</td>
                    <td className="px-3 py-2 border border-slate-200 text-slate-800">{e.modelo || '—'}</td>
                    <td className="px-3 py-2 border border-slate-200">
                      <NivelBadge nivel={e.nivel} />
                    </td>
                    <td className="px-3 py-2 border border-slate-200 text-right font-semibold text-slate-700">
                      {e.score_global ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Secao>
      )}

      {/* Rodapé informativo */}
      <div className="text-xs text-slate-400 text-center pb-4">
        S2.6.1 — Motor de qualidade v1. Endpoints de reprocessamento e revisão manual disponíveis na S2.6.2.
      </div>
    </div>
  )
}
