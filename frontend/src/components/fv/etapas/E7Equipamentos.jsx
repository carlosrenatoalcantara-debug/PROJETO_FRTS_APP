/**
 * E7Equipamentos.jsx — Sprint 2
 *
 * Orquestra SeletorPaineis + SeletorInversores + SeletorEstrutura +
 * ConfiguradorArranjoFV (multi-MPPT, validações, quantidade real).
 *
 * Novidades Sprint 2:
 *  - Passa `areaDisponivel` e `tipoLigacao` ao ConfiguradorArranjoFV
 *  - Passa `dispatch` para o configurador propagar numPaineis real ao contexto
 *  - Aviso de área insuficiente no header
 *  - Badge de topologia: String / Micro / Híbrido / Off-Grid / Otimizador
 */

import { useState, useEffect, useRef } from 'react'
import { Sun, Zap, Layers, AlertCircle, ChevronDown, ChevronUp, Loader2, AlertTriangle } from 'lucide-react'
import { useProjetoFV } from '../../../contexts/ProjetoFVContext'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'
import SeletorPaineis from '../SeletorPaineis'
import SeletorInversores from '../SeletorInversores'
import SeletorEstrutura from '../SeletorEstrutura'
import ConfiguradorArranjoFV from '../ConfiguradorArranjoFV'
import { consolidarPanos, dimensoesModulo } from '../../../utils/geoEngine'

const TIPO_BADGE_COR = {
  string:     'azul',
  hibrido:    'verde',
  micro:      'laranja',
  'off-grid': 'cinza',
  otimizador: 'amarelo',
}

export default function E7Equipamentos() {
  const { state, dispatch, proxima, anterior } = useProjetoFV()
  const { equipamentos, dimensionamento: dim, localizacao, dadosConsumo, area, projetoId } = state
  const [erro, setErro] = useState('')

  // ── Reidratação de engenharia_eletrica do banco ────────────────────────
  const [engenhariaInicial, setEngenhariaInicial] = useState(null)
  const [carregandoProjeto, setCarregandoProjeto] = useState(false)
  const buscouRef = useRef(false)

  useEffect(() => {
    if (buscouRef.current || !projetoId) return
    buscouRef.current = true
    setCarregandoProjeto(true)
    fetch(`/api/projetos-fv/${projetoId}`)
      .then(r => r.ok ? r.json() : null)
      .then(projeto => {
        if (projeto?.engenharia_eletrica) setEngenhariaInicial(projeto.engenharia_eletrica)
      })
      .catch(() => {})
      .finally(() => setCarregandoProjeto(false))
  }, [projetoId])

  // ── Colapso dos seletores ──────────────────────────────────────────────
  const [painelExp,    setPainelExp]    = useState(true)
  const [inversorExp,  setInversorExp]  = useState(true)
  const [estruturaExp, setEstruturaExp] = useState(true)

  function selecionarPainel(painel) {
    dispatch({ type: 'SET_EQUIPAMENTO', payload: { tipo: 'painel', item: painel } })
    setPainelExp(false)
    setErro('')
  }
  function selecionarInversor(inversor) {
    dispatch({ type: 'SET_EQUIPAMENTO', payload: { tipo: 'inversor', item: inversor } })
    setInversorExp(false)
    setErro('')
  }
  function selecionarEstrutura(estrutura) {
    dispatch({ type: 'SET_EQUIPAMENTO', payload: { tipo: 'estrutura', item: estrutura } })
    setEstruturaExp(false)
    setErro('')
  }

  function validar() {
    if (!equipamentos.painel || !equipamentos.inversor || !equipamentos.estrutura) {
      setErro('Selecione um painel, um inversor e uma estrutura para continuar.')
      return false
    }
    return true
  }

  const ambosSelecionados = !!(equipamentos.painel && equipamentos.inversor)

  // ── Dados para configurador ────────────────────────────────────────────
  const areaDisponivel  = parseFloat(area?.areaDisponivel) || 0
  const tipoLigacao     = dadosConsumo?.tipoLigacao ?? 'monofasico'

  // Quantidade configurada (pode ter sido atualizada pelo configurador)
  const numPaineisReal  = equipamentos.quantidadeModulos ?? dim.numPaineis ?? 0

  // Aviso de área
  const areaNecess      = numPaineisReal * 2.0
  const areaInsuficiente = areaDisponivel > 0 && areaNecess > areaDisponivel

  // S6/S6.1: capacidade real do layout — recalculada com o módulo SELECIONADO
  const capacidadeLayout = (() => {
    if (!Array.isArray(area?.panos) || area.panos.length === 0) return area?.capacidadeMaxModulos ?? 0
    try {
      const dims = dimensoesModulo(equipamentos.painel)
      return consolidarPanos(area.panos, { moduloDims: dims }).max_modulos_total
    } catch { return area?.capacidadeMaxModulos ?? 0 }
  })()
  const capacidadeExcedida = capacidadeLayout > 0 && numPaineisReal > capacidadeLayout

  return (
    <div className="space-y-8">

      {/* Cabeçalho */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Seleção de Equipamentos</h2>
        <p className="text-sm text-slate-500 mt-1">
          Sistema estimado em{' '}
          <strong>{dim.potenciaRealKwp ?? dim.potenciaKwp ?? '?'} kWp</strong>
          {' '}· {numPaineisReal > 0 ? `${numPaineisReal} módulos configurados` : `~${dim.numPaineis ?? '?'} módulos estimados`}
        </p>

        {/* S6: bloqueio de capacidade do layout (precede o aviso de área bruta) */}
        {capacidadeExcedida && (
          <div className="flex items-center gap-2 mt-3 p-3 bg-red-50 border border-red-300 rounded-lg text-sm text-red-800">
            <AlertTriangle size={16} className="shrink-0" />
            <span>
              <strong>Capacidade do layout excedida:</strong> o telhado (E6) comporta {capacidadeLayout} módulos,
              mas a configuração tenta usar {numPaineisReal}. Ajuste os panos em E6 ou reduza os módulos.
            </span>
          </div>
        )}

        {/* Aviso área insuficiente (fallback por área bruta quando não há panos) */}
        {!capacidadeLayout && areaInsuficiente && (
          <div className="flex items-center gap-2 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <AlertTriangle size={16} className="shrink-0" />
            Área insuficiente: {numPaineisReal} módulos precisam de ~{areaNecess.toFixed(0)} m²,
            mas apenas {areaDisponivel.toFixed(1)} m² disponível (E6).
            Reduza a quantidade de módulos ou revise a área.
          </div>
        )}
      </div>

      {/* ── Painéis ──────────────────────────────────────────────────────── */}
      <section className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50">
        <button
          className="w-full flex items-center justify-between px-5 py-4"
          onClick={() => setPainelExp(v => !v)}
          aria-expanded={painelExp}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Sun size={18} className="text-amber-600" />
            <h3 className="font-semibold text-slate-900">Módulos Fotovoltaicos</h3>
            <Badge cor="amarelo">~{dim.numPaineis ?? '?'} un. (estimativa E5)</Badge>
            {equipamentos.painel && (
              <span className="text-xs text-amber-700 font-medium bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">
                ✓ {equipamentos.painel.marca} {equipamentos.painel.modelo} · {equipamentos.painel.potenciaW}W
                {equipamentos.painel.tecnologia && ` · ${equipamentos.painel.tecnologia}`}
                {equipamentos.painel.bifacial   && ' · Bifacial'}
              </span>
            )}
          </div>
          {painelExp
            ? <ChevronUp size={16} className="text-slate-400 shrink-0" />
            : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
        </button>

        {painelExp && (
          <div className="px-5 pb-5 border-t border-amber-100">
            <SeletorPaineis onSelecionar={selecionarPainel} selecionado={equipamentos.painel} />
          </div>
        )}
      </section>

      {/* ── Inversores ───────────────────────────────────────────────────── */}
      <section className="border border-blue-200 rounded-xl overflow-hidden bg-blue-50">
        <button
          className="w-full flex items-center justify-between px-5 py-4"
          onClick={() => setInversorExp(v => !v)}
          aria-expanded={inversorExp}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Zap size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-900">Inversores</h3>
            <Badge cor="azul">~{dim.numInversores ?? '?'} un. (estimativa E5)</Badge>
            {equipamentos.inversor && (
              <>
                <span className="text-xs text-blue-700 font-medium bg-blue-100 border border-blue-200 rounded-full px-2 py-0.5">
                  ✓ {equipamentos.inversor.marca} {equipamentos.inversor.modelo} · {equipamentos.inversor.potenciaKW} kW · {equipamentos.inversor.nMppts} MPPT(s)
                </span>
                {equipamentos.inversor.tipo && (
                  <Badge cor={TIPO_BADGE_COR[equipamentos.inversor.tipo] ?? 'cinza'}>
                    {equipamentos.inversor.tipo}
                  </Badge>
                )}
              </>
            )}
          </div>
          {inversorExp
            ? <ChevronUp size={16} className="text-slate-400 shrink-0" />
            : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
        </button>

        {inversorExp && (
          <div className="px-5 pb-5 border-t border-blue-100">
            <SeletorInversores onSelecionar={selecionarInversor} selecionado={equipamentos.inversor} />
          </div>
        )}
      </section>

      {/* ── Estruturas ───────────────────────────────────────────────────── */}
      <section className="border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
        <button
          className="w-full flex items-center justify-between px-5 py-4"
          onClick={() => setEstruturaExp(v => !v)}
          aria-expanded={estruturaExp}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Layers size={18} className="text-slate-600" />
            <h3 className="font-semibold text-slate-900">Estruturas de Fixação</h3>
            {equipamentos.estrutura && (
              <span className="text-xs text-slate-700 font-medium bg-slate-100 border border-slate-300 rounded-full px-2 py-0.5">
                ✓ {equipamentos.estrutura.tipo}
              </span>
            )}
          </div>
          {estruturaExp
            ? <ChevronUp size={16} className="text-slate-400 shrink-0" />
            : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
        </button>

        {estruturaExp && (
          <div className="px-5 pb-5 border-t border-slate-200">
            <SeletorEstrutura onSelecionar={selecionarEstrutura} selecionado={equipamentos.estrutura} />
          </div>
        )}
      </section>

      {/* ── Configurador Elétrico ────────────────────────────────────────── */}
      <section className="border border-violet-200 rounded-xl bg-violet-50 p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Zap size={18} className="text-violet-600" />
          <h3 className="font-semibold text-slate-900">Configuração Elétrica do Arranjo</h3>
          <span className="text-[10px] text-violet-500 font-bold tracking-widest bg-violet-100 border border-violet-200 rounded-full px-2 py-0.5">
            TEMPO REAL
          </span>
          {engenhariaInicial?.compatibilidade?.analisado_em && (
            <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
              Salvo: {new Date(engenhariaInicial.compatibilidade.analisado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          )}
        </div>

        {carregandoProjeto && (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
            <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
            Recuperando configuração elétrica salva...
          </div>
        )}

        {!ambosSelecionados && !carregandoProjeto ? (
          <p className="text-sm text-slate-500 py-2">
            Selecione um módulo e um inversor acima para configurar as strings e
            ver a análise de compatibilidade elétrica em tempo real.
          </p>
        ) : ambosSelecionados && (
          <ConfiguradorArranjoFV
            painel={equipamentos.painel}
            inversor={equipamentos.inversor}
            numPaineis={dim.numPaineis ?? 0}
            uf={localizacao?.uf ?? null}
            projetoId={projetoId}
            initialValues={engenhariaInicial}
            areaDisponivel={areaDisponivel}
            tipoLigacao={tipoLigacao}
            dispatch={dispatch}
            onSaved={() => {}}
            onSaveAndNext={() => validar() && proxima()}
          />
        )}
      </section>

      {/* Aviso sobre preço */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        💡 O preço final dos equipamentos será calculado na etapa de orçamento
        com base no catálogo e na quantidade real de módulos configurada acima.
      </div>

      {erro && (
        <div className="flex items-center gap-2 text-sm text-red-600 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle size={16} /> {erro}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variante="secundario" onClick={anterior}>← Anterior</Button>
        <Button onClick={() => validar() && proxima()}>Próxima →</Button>
      </div>
    </div>
  )
}
