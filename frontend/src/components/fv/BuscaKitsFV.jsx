/**
 * BuscaKitsFV.jsx — S2.14 Passo 6
 *
 * Componente de busca e exibição de recomendações de Kits FV.
 * Motor determinístico, sem IA, sem LLM.
 *
 * Features:
 *  · Busca por texto livre com debounce 600ms
 *  · Loading lock via useRef (evita chamadas concorrentes)
 *  · Filtros rápidos: potência alvo, consumo
 *  · Cards expansíveis com breakdown completo de score
 *  · Prefixos visuais na explicação: ✓ ◯ △ ✗
 */

import { useState, useRef, useCallback } from 'react'
import {
  Search, Loader2, Zap, ChevronDown, ChevronUp,
  BarChart2, Sun, Cpu, Award, Info, AlertTriangle,
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'

// ─── Helpers visuais ──────────────────────────────────────────────────────────

function corScore(score) {
  if (score >= 80) return 'text-green-600 bg-green-50'
  if (score >= 60) return 'text-yellow-600 bg-yellow-50'
  return 'text-red-500 bg-red-50'
}

function barraScore(score, cor = 'bg-blue-500') {
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5">
      <div
        className={`h-1.5 rounded-full transition-all ${cor}`}
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
      />
    </div>
  )
}

function prefixoIcone(texto) {
  if (texto.startsWith('✓')) return 'text-green-600'
  if (texto.startsWith('◯')) return 'text-gray-500'
  if (texto.startsWith('△')) return 'text-yellow-600'
  if (texto.startsWith('✗')) return 'text-red-500'
  return 'text-gray-600'
}

// ─── Card de critério de score ────────────────────────────────────────────────

function CriterioScore({ label, score, peso, descricao, corBarra }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600 font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">peso {typeof peso === 'number' && peso <= 1 ? (peso * 100).toFixed(0) : peso}%</span>
          <span className={`font-bold ${score >= 70 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
            {score.toFixed(0)}
          </span>
        </div>
      </div>
      {barraScore(score, corBarra)}
      {descricao && <p className="text-xs text-gray-400 mt-0.5">{descricao}</p>}
    </div>
  )
}

// ─── Card de kit ──────────────────────────────────────────────────────────────

function CardKit({ kit, posicao }) {
  const [expandido, setExpandido] = useState(false)
  const scoreClass = corScore(kit.score_final)

  const medalhas = ['🥇', '🥈', '🥉']
  const medalha = medalhas[posicao - 1] ?? `#${posicao}`

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Cabeçalho */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="text-2xl flex-shrink-0 mt-0.5">{medalha}</span>
            <div className="min-w-0">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Módulo FV</p>
              <p className="font-semibold text-gray-900 text-sm truncate">
                {kit.painel.marca} {kit.painel.modelo}
              </p>
              <p className="text-xs text-gray-500">{kit.painel.pmpp} Wp · Gar. {kit.painel.garantia_produto ?? '—'}a</p>

              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mt-2">Inversor</p>
              <p className="font-semibold text-gray-900 text-sm truncate">
                {kit.inversor.marca} {kit.inversor.modelo}
              </p>
              <p className="text-xs text-gray-500">
                {kit.inversor.potencia_kw} kW · {kit.inversor.tipo ?? 'String'} · {kit.inversor.fase_ac ?? '—'} · Gar. {kit.inversor.garantia ?? '—'}a
              </p>
            </div>
          </div>

          {/* Score final */}
          <div className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl ${scoreClass}`}>
            <span className="text-xs font-medium opacity-70">Score</span>
            <span className="text-2xl font-black leading-none">{kit.score_final.toFixed(0)}</span>
            <span className="text-xs opacity-60">/100</span>
          </div>
        </div>

        {/* Chips de arranjo */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
            <Zap className="w-3 h-3" />
            {kit.potencia_kwp?.toFixed(2)} kWp
          </span>
          <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium">
            {kit.arranjo?.modulos_por_string}S × {kit.arranjo?.strings_paralelo}P = {kit.arranjo?.num_total_modulos} módulos
          </span>
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">
            Oversizing {((kit.oversizing_fator ?? 1) * 100).toFixed(0)}%
          </span>
          <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
            R$ {kit.custo_por_kwp?.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/kWp
          </span>
          <span className="inline-flex items-center gap-1 bg-gray-50 text-gray-600 text-xs px-2 py-0.5 rounded-full font-medium">
            Total R$ {kit.custo_total?.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
          </span>
        </div>

        {/* Botão expandir */}
        <button
          onClick={() => setExpandido(e => !e)}
          className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium py-1 rounded-lg hover:bg-blue-50 transition-colors"
        >
          {expandido ? (
            <><ChevronUp className="w-3.5 h-3.5" /> Ocultar detalhes</>
          ) : (
            <><ChevronDown className="w-3.5 h-3.5" /> Ver breakdown do score</>
          )}
        </button>
      </div>

      {/* Breakdown expandido */}
      {expandido && (
        <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">
          {/* Critérios */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <BarChart2 className="w-3.5 h-3.5" /> Breakdown de Score
            </p>
            {kit.score_breakdown?.map(criterio => {
              const cores = {
                tecnico:    'bg-blue-400',
                comercial:  'bg-green-400',
                semantico:  'bg-purple-400',
                engenharia: 'bg-amber-400',
              }
              const labels = {
                tecnico:    '⚡ Técnico',
                comercial:  '💰 Comercial',
                semantico:  '🔍 Semântico',
                engenharia: '🏗 Engenharia',
              }
              return (
                <CriterioScore
                  key={criterio.criterio}
                  label={labels[criterio.criterio] ?? criterio.criterio}
                  score={criterio.score}
                  peso={criterio.peso}
                  descricao={criterio.descricao}
                  corBarra={cores[criterio.criterio] ?? 'bg-gray-400'}
                />
              )
            })}
          </div>

          {/* Explicações */}
          {kit.explicacao_score?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> Justificativas
              </p>
              <ul className="space-y-1">
                {kit.explicacao_score.map((linha, i) => (
                  <li key={i} className={`text-xs flex items-start gap-1.5 ${prefixoIcone(linha)}`}>
                    <span className="flex-shrink-0 mt-0.5">{linha.slice(0, 1)}</span>
                    <span className="text-gray-600">{linha.slice(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Arranjo detalhado */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5" /> Arranjo Elétrico
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
              <span className="text-gray-400">Módulos/string</span>
              <span className="font-medium">{kit.arranjo?.modulos_por_string}</span>
              <span className="text-gray-400">Strings paralelo</span>
              <span className="font-medium">{kit.arranjo?.strings_paralelo}</span>
              <span className="text-gray-400">Total módulos</span>
              <span className="font-medium">{kit.arranjo?.num_total_modulos}</span>
              <span className="text-gray-400">Potência total</span>
              <span className="font-medium">{kit.potencia_kwp?.toFixed(3)} kWp</span>
              <span className="text-gray-400">Fator oversizing</span>
              <span className="font-medium">{kit.oversizing_fator?.toFixed(3)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Painel de métricas da busca ──────────────────────────────────────────────

function MetaBusca({ resultado }) {
  const { meta, tokens } = resultado
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 flex flex-wrap gap-x-4 gap-y-1">
      <span>🔍 <strong>{meta.combinacoes_brutas}</strong> combinações brutas</span>
      <span>✅ <strong>{meta.candidatos_pos_filtro}</strong> após filtros</span>
      <span>⚡ <strong>{meta.tempo_execucao_ms}ms</strong></span>
      {meta.tem_potencia_alvo && (
        <span>🎯 Potência: <strong>{resultado.potencia_alvo_kwp} kWp</strong></span>
      )}
      {tokens?.marcas?.todas?.length > 0 && (
        <span>🏷 Marcas: <strong>{tokens.marcas.todas.join(', ')}</strong></span>
      )}
      {tokens?.tecnologias?.length > 0 && (
        <span>🔬 Tecn.: <strong>{tokens.tecnologias.join(', ')}</strong></span>
      )}
      <span className="opacity-60">
        Confiança parse: <strong>{(tokens?.meta?.confianca_parse * 100).toFixed(0)}%</strong>
      </span>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function BuscaKitsFV() {
  const [busca, setBusca]           = useState('')
  const [potenciaKwp, setPotencia]  = useState('')
  const [consumoKwh, setConsumo]    = useState('')
  const [resultado, setResultado]   = useState(null)
  const [erro, setErro]             = useState(null)
  const [carregando, setCarregando] = useState(false)

  // Loading lock — impede chamadas concorrentes independente de closure
  const loadingRef = useRef(false)
  // Debounce timer
  const timerRef   = useRef(null)

  const buscarKits = useCallback(async (textoBusca, kwp, kwh) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setCarregando(true)
    setErro(null)

    try {
      const body = {
        busca: textoBusca,
        ...(kwp  ? { potencia_kwp:    Number(kwp)  } : {}),
        ...(kwh  ? { consumo_kwh_mes: Number(kwh)  } : {}),
      }

      const resp = await fetch(`${API_BASE}/api/v1/kits/recomendar`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.erro ?? `Erro HTTP ${resp.status}`)
      }

      const data = await resp.json()
      setResultado(data)
    } catch (e) {
      setErro(e.message ?? 'Erro ao buscar kits.')
      setResultado(null)
    } finally {
      loadingRef.current = false
      setCarregando(false)
    }
  }, [])

  // Disparo com debounce 600ms
  function agendarBusca(texto, kwp, kwh) {
    clearTimeout(timerRef.current)
    if (!texto.trim() && !kwp && !kwh) {
      setResultado(null)
      setErro(null)
      return
    }
    timerRef.current = setTimeout(() => buscarKits(texto, kwp, kwh), 600)
  }

  function onChangeBusca(e) {
    const v = e.target.value
    setBusca(v)
    agendarBusca(v, potenciaKwp, consumoKwh)
  }
  function onChangePotencia(e) {
    const v = e.target.value
    setPotencia(v)
    agendarBusca(busca, v, consumoKwh)
  }
  function onChangeConsumo(e) {
    const v = e.target.value
    setConsumo(v)
    agendarBusca(busca, potenciaKwp, v)
  }

  function onSubmit(e) {
    e.preventDefault()
    clearTimeout(timerRef.current)
    buscarKits(busca, potenciaKwp, consumoKwh)
  }

  return (
    <div className="space-y-6">
      {/* Formulário de busca */}
      <form onSubmit={onSubmit} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Busca livre
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={onChangeBusca}
              placeholder='Ex: "5kWp canadian bifacial" ou "300kWh/mês deye"'
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Reconhece marcas, tecnologias, potência (kWp/kW/W) e consumo (kWh)
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Potência alvo (kWp) <span className="font-normal text-gray-400">— opcional</span>
            </label>
            <input
              type="number"
              value={potenciaKwp}
              onChange={onChangePotencia}
              min="0.5" max="10000" step="0.5"
              placeholder="Ex: 5.5"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Consumo mensal (kWh) <span className="font-normal text-gray-400">— opcional</span>
            </label>
            <input
              type="number"
              value={consumoKwh}
              onChange={onChangeConsumo}
              min="50" max="100000" step="10"
              placeholder="Ex: 350"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={carregando}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
        >
          {carregando ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Analisando catálogo...</>
          ) : (
            <><Sun className="w-4 h-4" /> Recomendar Kits</>
          )}
        </button>
      </form>

      {/* Erro */}
      {erro && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{erro}</span>
        </div>
      )}

      {/* Resultados */}
      {resultado && (
        <div className="space-y-4">
          <MetaBusca resultado={resultado} />

          {resultado.top10?.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Sun className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum kit encontrado</p>
              <p className="text-sm mt-1">Tente ampliar os critérios de busca ou remover filtros.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-blue-500" />
                <h3 className="font-semibold text-gray-800 text-sm">
                  Top {resultado.top10.length} Kits Recomendados
                </h3>
                <span className="text-xs text-gray-400 ml-auto">
                  Score ponderado: técnico 35% · comercial 35% · semântico 20% · engenharia 10%
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {resultado.top10.map(kit => (
                  <CardKit key={kit.id} kit={kit} posicao={kit.posicao} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
