/**
 * E7Equipamentos.jsx — S2.11.1 + S2.11.2
 *
 * Etapa 7 do wizard FV: seleção de painel, inversor, estrutura
 * e configuração de strings com análise + persistência de compatibilidade elétrica.
 *
 * ── S2.11.2 (reidratação) ─────────────────────────────────────────────────────
 *  Ao montar, se `projetoId` existir no contexto, busca o projeto via API.
 *  Se `ProjetoFV.engenharia_eletrica` existir, passa como `initialValues` ao
 *  ConfiguradorArranjoFV, que reidrata sliders/clima com uma única execução
 *  controlada por `useRef` (anti-loop — impede novo disparo reativo).
 *
 * ── Fluxo de save ─────────────────────────────────────────────────────────────
 *  "Salvar configuração" → PUT /api/projetos-fv/:id/etapa { engenharia_eletrica }
 *  "Salvar e avançar"   → idem + proxima()
 */

import { useState, useEffect, useRef } from 'react'
import { Sun, Zap, Layers, AlertCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { useProjetoFV } from '../../../contexts/ProjetoFVContext'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'
import SeletorPaineis from '../SeletorPaineis'
import SeletorInversores from '../SeletorInversores'
import SeletorEstrutura from '../SeletorEstrutura'
import ConfiguradorArranjoFV from '../ConfiguradorArranjoFV'

export default function E7Equipamentos() {
  const { state, dispatch, proxima, anterior } = useProjetoFV()
  const { equipamentos, dimensionamento: dim, localizacao, projetoId } = state
  const [erro, setErro] = useState('')

  // ── Reidratação de engenharia_eletrica do banco (S2.11.2) ─────────────────
  const [engenhariaInicial, setEngenhariaInicial] = useState(null)
  const [carregandoProjeto, setCarregandoProjeto] = useState(false)
  // Flag: buscamos apenas uma vez — impede re-fetch em re-renders
  const buscouRef = useRef(false)

  useEffect(() => {
    if (buscouRef.current || !projetoId) return
    buscouRef.current = true

    setCarregandoProjeto(true)
    fetch(`/api/projetos-fv/${projetoId}`)
      .then(r => r.ok ? r.json() : null)
      .then(projeto => {
        if (projeto?.engenharia_eletrica) {
          // Só reidrata se o banco tem dados — caso contrário mantém defaults
          setEngenhariaInicial(projeto.engenharia_eletrica)
        }
      })
      .catch(() => { /* silencioso — sem banco ou sem rede, usa defaults */ })
      .finally(() => setCarregandoProjeto(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoId])  // só re-executa se o projetoId mudar (nunca em prática)

  // ── Controle de colapso dos seletores ─────────────────────────────────────
  const [painelExpandido,    setPainelExpandido]    = useState(true)
  const [inversorExpandido,  setInversorExpandido]  = useState(true)
  const [estruturaExpandido, setEstruturaExpandido] = useState(true)

  function selecionarPainel(painel) {
    dispatch({ type: 'SET_EQUIPAMENTO', payload: { tipo: 'painel', item: painel } })
    setPainelExpandido(false)
    setErro('')
  }

  function selecionarInversor(inversor) {
    dispatch({ type: 'SET_EQUIPAMENTO', payload: { tipo: 'inversor', item: inversor } })
    setInversorExpandido(false)
    setErro('')
  }

  function selecionarEstrutura(estrutura) {
    dispatch({ type: 'SET_EQUIPAMENTO', payload: { tipo: 'estrutura', item: estrutura } })
    setEstruturaExpandido(false)
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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Seleção de Equipamentos</h2>
        <p className="text-sm text-slate-500 mt-1">
          Selecione um painel, um inversor e uma estrutura para o sistema de{' '}
          <strong>{dim.potenciaRealKwp} kWp</strong>.
        </p>
      </div>

      {/* ── Painéis ──────────────────────────────────────────────────────────── */}
      <section className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50">
        <button
          className="w-full flex items-center justify-between px-5 py-4"
          onClick={() => setPainelExpandido(v => !v)}
          aria-expanded={painelExpandido}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Sun size={18} className="text-amber-600" />
            <h3 className="font-semibold text-slate-900">Módulos Fotovoltaicos</h3>
            <Badge cor="amarelo">{dim.numPaineis} un. necessárias</Badge>
            {equipamentos.painel && (
              <span className="text-xs text-amber-700 font-medium bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">
                ✓ {equipamentos.painel.marca} {equipamentos.painel.modelo}
              </span>
            )}
          </div>
          {painelExpandido
            ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0" />
            : <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />}
        </button>

        {painelExpandido && (
          <div className="px-5 pb-5 border-t border-amber-100">
            <SeletorPaineis
              onSelecionar={selecionarPainel}
              selecionado={equipamentos.painel}
            />
          </div>
        )}
      </section>

      {/* ── Inversores ────────────────────────────────────────────────────────── */}
      <section className="border border-blue-200 rounded-xl overflow-hidden bg-blue-50">
        <button
          className="w-full flex items-center justify-between px-5 py-4"
          onClick={() => setInversorExpandido(v => !v)}
          aria-expanded={inversorExpandido}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Zap size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-900">Inversores</h3>
            <Badge cor="azul">{dim.numInversores} un. necessária(s)</Badge>
            {equipamentos.inversor && (
              <span className="text-xs text-blue-700 font-medium bg-blue-100 border border-blue-200 rounded-full px-2 py-0.5">
                ✓ {equipamentos.inversor.marca} {equipamentos.inversor.modelo}
              </span>
            )}
          </div>
          {inversorExpandido
            ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0" />
            : <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />}
        </button>

        {inversorExpandido && (
          <div className="px-5 pb-5 border-t border-blue-100">
            <SeletorInversores
              onSelecionar={selecionarInversor}
              selecionado={equipamentos.inversor}
            />
          </div>
        )}
      </section>

      {/* ── Estruturas ────────────────────────────────────────────────────────── */}
      <section className="border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
        <button
          className="w-full flex items-center justify-between px-5 py-4"
          onClick={() => setEstruturaExpandido(v => !v)}
          aria-expanded={estruturaExpandido}
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
          {estruturaExpandido
            ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0" />
            : <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />}
        </button>

        {estruturaExpandido && (
          <div className="px-5 pb-5 border-t border-slate-200">
            <SeletorEstrutura
              onSelecionar={selecionarEstrutura}
              selecionado={equipamentos.estrutura}
            />
          </div>
        )}
      </section>

      {/* ── Análise de Compatibilidade Elétrica (S2.11.1 + S2.11.2) ─────────── */}
      <section className="border border-violet-200 rounded-xl bg-violet-50 p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Zap size={18} className="text-violet-600" />
          <h3 className="font-semibold text-slate-900">Análise de Compatibilidade Elétrica</h3>
          <span className="text-[10px] text-violet-500 font-bold tracking-widest bg-violet-100 border border-violet-200 rounded-full px-2 py-0.5">
            TEMPO REAL
          </span>
          {engenhariaInicial?.compatibilidade?.analisado_em && (
            <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
              Último save: {new Date(engenhariaInicial.compatibilidade.analisado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          )}
        </div>

        {/* Indicador de busca do projeto no banco */}
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
            onSaved={() => {
              // Após save, mantemos o badge de feedback — nada extra necessário
            }}
            onSaveAndNext={() => {
              // Salvo com sucesso → avança para a próxima etapa
              validar() && proxima()
            }}
          />
        )}
      </section>

      {/* Aviso: preço */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        💡 O preço final dos equipamentos será calculado na etapa de orçamento
        com base no mercado fornecedor e descontos aplicáveis.
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
