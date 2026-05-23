/**
 * ConfiguradorArranjoFV.jsx — S2.11.1 + S2.11.2
 *
 * Sub-painel de configuração de strings + dados climáticos + painel visual
 * de compatibilidade elétrica em tempo real.
 *
 * ── S2.11.1 (original) ───────────────────────────────────────────────────────
 *  - Sliders + inputs numéricos para modulos_por_string e strings_paralelo
 *  - Campos climáticos Tmin/Tmax pré-carregados por UF via CLIMA_PADRAO_UF
 *  - PainelCompatibilidadeFV atualizado em tempo real via hook debounced
 *
 * ── S2.11.2 (persistência) ───────────────────────────────────────────────────
 *  - Botão "Salvar Configuração Elétrica" — gravação consciente via PUT /etapa
 *  - Botão "Salvar e Avançar" — salva + chama proxima()
 *  - Reidratação controlada por `initialValues` prop + useRef anti-loop
 *  - Estado de saving (loading) e feedback visual de sucesso/erro do save
 *
 * ── Anti-loop de reidratação ─────────────────────────────────────────────────
 *  Quando `initialValues` é passado (dados recuperados do banco), um useEffect
 *  rodando somente na montagem (deps=[]) aplica os valores aos estados locais
 *  ANTES de qualquer debounce do hook de compatibilidade disparar.
 *  O flag `reidratadoRef.current` garante que nunca execute novamente.
 *
 * ── Props ────────────────────────────────────────────────────────────────────
 *  painel          Objeto do catálogo (com .id para resolução elétrica)
 *  inversor        Objeto do catálogo (com .id para resolução elétrica)
 *  numPaineis      Total de módulos necessários (do dimensionamento)
 *  uf              UF do projeto (para clima padrão pré-carregado)
 *  projetoId       ID do projeto no banco (para PUT /etapa)
 *  initialValues   Dados de engenharia_eletrica salvos previamente (reidratação)
 *  onSaved         Callback chamado após save bem-sucedido (opcional)
 *  onSaveAndNext   Callback chamado pelo botão "Salvar e Avançar" (opcional)
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  Sliders, Thermometer, AlertTriangle, Loader2, Info,
  Save, CheckCircle2, XCircle, ChevronRight, Wand2,
} from 'lucide-react'
import {
  dadosEletricosPainel,
  dadosEletricosInversor,
  CLIMA_PADRAO_UF,
} from '../../data/catalogoEletrico'
import { useCompatibilidadeEletrica } from '../../hooks/useCompatibilidadeEletrica'
import PainelCompatibilidadeFV from '../engenharia/PainelCompatibilidadeFV'

// ─── Versão do motor (para rastreabilidade no banco) ─────────────────────────
const VERSAO_MOTOR = '2.11.1'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sugestaoArranjo(numPaineis, nMppts = 1) {
  if (!numPaineis || numPaineis <= 0) return { modulos_por_string: 10, strings_paralelo: 1 }
  const stringSugerida = Math.min(14, Math.max(6, Math.ceil(numPaineis / nMppts)))
  const stringsParalelo = Math.max(1, Math.round(numPaineis / stringSugerida))
  return { modulos_por_string: stringSugerida, strings_paralelo: stringsParalelo }
}

// ─── Estado de save ───────────────────────────────────────────────────────────
// 'idle' | 'saving' | 'ok' | 'erro'

export default function ConfiguradorArranjoFV({
  painel,
  inversor,
  numPaineis = 0,
  uf,
  projetoId,
  initialValues,  // { arranjo, clima_utilizado } do banco
  onSaved,        // () => void  — após save bem-sucedido
  onSaveAndNext,  // () => void  — depois de salvar, avança etapa
}) {

  // ── Dados elétricos do catálogo enriquecido ──────────────────────────────
  const eletricoModulo   = useMemo(() => dadosEletricosPainel(painel),    [painel?.id])
  const eletricoInversor = useMemo(() => dadosEletricosInversor(inversor), [inversor?.id])

  // ── Arranjo ──────────────────────────────────────────────────────────────
  const sugestao = useMemo(
    () => sugestaoArranjo(numPaineis, inversor?.nMppts),
    [numPaineis, inversor?.nMppts]
  )
  const [modulos_por_string, setModulosPorString] = useState(sugestao.modulos_por_string)
  const [strings_paralelo,   setStringsParalelo]  = useState(sugestao.strings_paralelo)

  // ── Clima ─────────────────────────────────────────────────────────────────
  const climaPadrao = CLIMA_PADRAO_UF[uf] ?? { tmin: 10, tmax: 40 }
  const [tmin,       setTmin]       = useState(climaPadrao.tmin)
  const [tmax,       setTmax]       = useState(climaPadrao.tmax)
  const [cidadeClima, setCidadeClima] = useState('')

  // ── Anti-loop: reidratação única na montagem ─────────────────────────────
  const reidratadoRef = useRef(false)

  useEffect(() => {
    // Roda apenas uma vez na montagem (deps vazias).
    // Se initialValues existir (dados do banco), sobrescreve os defaults.
    if (reidratadoRef.current) return
    reidratadoRef.current = true

    if (!initialValues) return

    // Reidrata arranjo
    if (initialValues.arranjo) {
      const { quantidade_modulos_por_string: m, quantidade_strings_paralelo: s } = initialValues.arranjo
      if (m != null && m > 0) setModulosPorString(m)
      if (s != null && s > 0) setStringsParalelo(s)
    }

    // Reidrata clima
    if (initialValues.clima_utilizado) {
      const c = initialValues.clima_utilizado
      if (c.temperatura_min_historica_c != null) setTmin(c.temperatura_min_historica_c)
      if (c.temperatura_max_historica_c != null) setTmax(c.temperatura_max_historica_c)
      if (c.cidade)                              setCidadeClima(c.cidade)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // <- deps vazias: executa apenas na montagem

  // ── Objetos para o hook ────────────────────────────────────────────────────
  const arranjo = useMemo(() => ({
    quantidade_modulos_por_string: Number(modulos_por_string),
    quantidade_strings_paralelo:   Number(strings_paralelo),
    num_mppt_usados:               1,
  }), [modulos_por_string, strings_paralelo])

  const clima = useMemo(() => ({
    temperatura_min_historica_c: Number(tmin),
    temperatura_max_historica_c: Number(tmax),
    cidade: cidadeClima || uf || null,
    uf:     uf || null,
  }), [tmin, tmax, cidadeClima, uf])

  // ── Hook de compatibilidade (debounced, cancelável) ───────────────────────
  const { resultado, carregando, erro } = useCompatibilidadeEletrica(
    eletricoModulo,
    eletricoInversor,
    arranjo,
    clima,
  )

  // ── Estado de save ────────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState('idle')  // 'idle'|'saving'|'ok'|'erro'
  const [saveMensagem, setSaveMensagem] = useState('')

  // Monta o payload de engenharia_eletrica para persistência
  const montarPayload = useCallback(() => {
    if (!resultado) return null
    const { calculos, warnings, erros, clima_utilizado: climaUsado } = resultado

    return {
      arranjo: {
        quantidade_modulos_por_string: Number(modulos_por_string),
        quantidade_strings_paralelo:   Number(strings_paralelo),
        total_modulos: calculos?.total_modulos ?? modulos_por_string * strings_paralelo,
      },
      clima_utilizado: {
        cidade:                      climaUsado?.cidade ?? cidadeClima ?? null,
        uf:                          climaUsado?.uf ?? uf ?? null,
        temperatura_min_historica_c: climaUsado?.temperatura_min_c ?? Number(tmin),
        temperatura_max_historica_c: climaUsado?.temperatura_max_c ?? Number(tmax),
        fonte:                       climaUsado?.fonte ?? 'manual',
        usou_fallback:               climaUsado?.usou_fallback ?? false,
      },
      compatibilidade: {
        versao_motor:  VERSAO_MOTOR,
        compativel:    resultado.compativel,
        diagnosticos:  [...(erros ?? []), ...(warnings ?? [])],   // todos os diagnósticos
        margens: calculos ? {
          margem_tensao_percentual:     calculos.margem_tensao_percentual,
          margem_mppt_max_percentual:   calculos.margem_mppt_max_percentual,
          margem_mppt_min_percentual:   calculos.margem_mppt_min_percentual,
          margem_oversizing_percentual: calculos.margem_oversizing_percentual,
        } : null,
        calculos_principais: calculos ? {
          voc_string_max:      calculos.voc_string_max,
          vmpp_string_frio:    calculos.vmpp_string_frio,
          vmpp_string_quente:  calculos.vmpp_string_quente,
          isc_total:           calculos.isc_total,
          fator_oversizing:    calculos.fator_oversizing,
          potencia_cc_total:   calculos.potencia_cc_total,
          total_modulos:       calculos.total_modulos,
          t_cel_max_c:         calculos.t_cel_max_c,
        } : null,
        analisado_em: new Date().toISOString(),
      },
    }
  }, [resultado, modulos_por_string, strings_paralelo, cidadeClima, uf, tmin, tmax])

  // Handler de save (PUT /api/projetos-fv/:id/etapa)
  const salvar = useCallback(async () => {
    if (!projetoId) {
      setSaveStatus('erro')
      setSaveMensagem('Projeto ainda não foi criado. Complete as etapas anteriores primeiro.')
      return null
    }
    if (!resultado) {
      setSaveStatus('erro')
      setSaveMensagem('Aguarde a análise de compatibilidade completar antes de salvar.')
      return null
    }

    const payload = montarPayload()
    if (!payload) return null

    setSaveStatus('saving')
    setSaveMensagem('')

    try {
      const resp = await fetch(`/api/projetos-fv/${projetoId}/etapa`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapa: 'engenharia_eletrica', dados: payload }),
      })

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(body.erro ?? `HTTP ${resp.status}`)
      }

      setSaveStatus('ok')
      setSaveMensagem('Configuração elétrica salva com sucesso.')
      onSaved?.()

      // Reseta o badge de "salvo" após 4s
      setTimeout(() => setSaveStatus('idle'), 4000)
      return payload  // permite que o caller use o payload (ex: salvar-e-avançar)
    } catch (err) {
      setSaveStatus('erro')
      setSaveMensagem(err.message ?? 'Erro ao salvar configuração elétrica.')
      return null
    }
  }, [projetoId, resultado, montarPayload, onSaved])

  // Handler "Salvar e Avançar"
  const salvarEAvancar = useCallback(async () => {
    const ok = await salvar()
    if (ok !== null) {
      onSaveAndNext?.()
    }
  }, [salvar, onSaveAndNext])

  // ── Flags de estado ───────────────────────────────────────────────────────
  const semDadosModulo   = painel   && !eletricoModulo
  const semDadosInversor = inversor && !eletricoInversor
  const semEquipamentos  = !eletricoModulo && !eletricoInversor
  const totalModulosArranjo = modulos_por_string * strings_paralelo
  const podeSalvar = !!resultado && !carregando && !!projetoId

  return (
    <div className="space-y-5">

      {/* Aviso: dados elétricos não mapeados */}
      {(semDadosModulo || semDadosInversor) && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
          <span>
            {semDadosModulo   && 'Dados elétricos do módulo não encontrados. '}
            {semDadosInversor && 'Dados elétricos do inversor não encontrados. '}
            A análise de compatibilidade não está disponível para este equipamento.
          </span>
        </div>
      )}

      {/* Aviso: sem projetoId */}
      {!projetoId && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
          O projeto ainda não foi salvo no banco. Complete e salve as etapas anteriores
          para habilitar a persistência da configuração elétrica.
        </div>
      )}

      {/* Configuração do arranjo */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700">Configuração do Arranjo (Strings)</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Módulos por string */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">
              Módulos por string (em série)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={30}
                value={modulos_por_string}
                onChange={e => setModulosPorString(Number(e.target.value))}
                className="flex-1 accent-blue-600"
              />
              <input
                type="number"
                min={1}
                max={30}
                value={modulos_por_string}
                onChange={e => setModulosPorString(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                className="w-16 text-center border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Tensão CC: {eletricoModulo
                ? `~${(eletricoModulo.voc * modulos_por_string).toFixed(0)} V (Voc STC)`
                : 'selecione um módulo'}
            </p>
          </div>

          {/* Strings em paralelo */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">
              Strings em paralelo (por MPPT)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={10}
                value={strings_paralelo}
                onChange={e => setStringsParalelo(Number(e.target.value))}
                className="flex-1 accent-blue-600"
              />
              <input
                type="number"
                min={1}
                max={10}
                value={strings_paralelo}
                onChange={e => setStringsParalelo(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                className="w-16 text-center border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Corrente CC: {eletricoModulo
                ? `~${(eletricoModulo.isc * strings_paralelo).toFixed(2)} A (Isc STC)`
                : 'selecione um módulo'}
            </p>
          </div>
        </div>

        {/* Resumo do arranjo */}
        <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
          <Chip label="Total de módulos" valor={totalModulosArranjo} unidade="un." />
          {numPaineis > 0 && totalModulosArranjo !== numPaineis && (
            <div className="flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
              <AlertTriangle className="w-3 h-3" />
              {totalModulosArranjo > numPaineis
                ? `${totalModulosArranjo - numPaineis} módulos acima do dimensionado`
                : `${numPaineis - totalModulosArranjo} módulos abaixo do dimensionado`}
            </div>
          )}
          {eletricoModulo && (
            <Chip
              label="Potência CC"
              valor={((eletricoModulo.potencia_w * totalModulosArranjo) / 1000).toFixed(2)}
              unidade="kWp"
            />
          )}
          {eletricoInversor && eletricoModulo && (
            <Chip
              label="Oversizing"
              valor={(((eletricoModulo.potencia_w * totalModulosArranjo) / 1000) / eletricoInversor.potencia_ca_kw).toFixed(2)}
              unidade="× CC/CA"
            />
          )}
        </div>
      </div>

      {/* Dados climáticos */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">Dados Climáticos da Região</h3>
          </div>
          {uf && CLIMA_PADRAO_UF[uf] && (
            <span className="text-[11px] text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
              Padrão {uf} pré-carregado
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Tmin histórica (°C)</label>
            <input
              type="number"
              value={tmin}
              min={-30}
              max={25}
              step={1}
              onChange={e => setTmin(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-400">Pior caso Voc</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Tmax histórica (°C)</label>
            <input
              type="number"
              value={tmax}
              min={20}
              max={55}
              step={1}
              onChange={e => setTmax(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-400">Pior caso Vmpp (NOCT)</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Cidade / identificação</label>
            <input
              type="text"
              placeholder="Ex: Natal-RN"
              value={cidadeClima}
              onChange={e => setCidadeClima(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-start gap-2 text-[11px] text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            Sem dados: motor usa fallback nacional (Tmin=10°C / Tmax=40°C, NBR 16690).
            Use INMET ou NASA POWER para a localidade do projeto.
          </span>
        </div>
      </div>

      {/* Loading state do motor */}
      {carregando && (
        <div className="flex items-center gap-3 py-4 px-5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          Analisando compatibilidade elétrica...
        </div>
      )}

      {/* Erro da API do motor */}
      {erro && !carregando && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
          <div>
            <p className="font-semibold">Erro na análise de compatibilidade</p>
            <p className="text-xs mt-0.5 font-mono">{erro}</p>
          </div>
        </div>
      )}

      {/* Sem equipamentos selecionados */}
      {semEquipamentos && !carregando && !erro && (
        <div className="flex items-center gap-2 py-4 px-5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500">
          <Info className="w-4 h-4 text-slate-400" />
          Selecione um módulo e um inversor para iniciar a análise.
        </div>
      )}

      {/* Painel de resultado */}
      {resultado && !carregando && (
        <PainelCompatibilidadeFV resultado={resultado} />
      )}

      {/* ── Optimizer Inteligente de Arranjo (S2.12) ─────────────────────── */}
      {(eletricoModulo || eletricoInversor) && (
        <SecaoOptimizerInteligente
          eletricoModulo={eletricoModulo}
          eletricoInversor={eletricoInversor}
          clima={clima}
          modulos_por_string={modulos_por_string}
          strings_paralelo={strings_paralelo}
          onAplicar={(m, s) => {
            setModulosPorString(m)
            setStringsParalelo(s)
          }}
        />
      )}

      {/* ── Barra de ações de persistência (S2.11.2) ──────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">

          {/* Feedback de save */}
          <div className="flex items-center gap-2 min-h-[28px]">
            {saveStatus === 'saving' && (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span className="text-sm text-slate-500">Salvando configuração...</span>
              </>
            )}
            {saveStatus === 'ok' && (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-emerald-700 font-medium">{saveMensagem}</span>
              </>
            )}
            {saveStatus === 'erro' && (
              <>
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-700">{saveMensagem}</span>
              </>
            )}
            {saveStatus === 'idle' && resultado && projetoId && (
              <span className="text-xs text-slate-400">
                {resultado.compativel
                  ? '✓ Arranjo compatível — pronto para salvar'
                  : '⚠ Arranjo com problemas — você pode salvar mesmo assim para registrar os diagnósticos'}
              </span>
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={salvar}
              disabled={!podeSalvar || saveStatus === 'saving'}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                podeSalvar && saveStatus !== 'saving'
                  ? 'bg-slate-700 text-white hover:bg-slate-800 active:bg-slate-900'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              Salvar configuração
            </button>

            {onSaveAndNext && (
              <button
                onClick={salvarEAvancar}
                disabled={!podeSalvar || saveStatus === 'saving'}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  podeSalvar && saveStatus !== 'saving'
                    ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                Salvar e avançar
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Chip auxiliar ────────────────────────────────────────────────────────────

function Chip({ label, valor, unidade }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-full px-3 py-1">
      <span className="text-slate-500">{label}:</span>
      <span className="font-mono font-bold text-slate-800">{valor}</span>
      {unidade && <span className="text-slate-400">{unidade}</span>}
    </div>
  )
}

// ─── S2.12 — Optimizer Inteligente de Arranjo ────────────────────────────────
//
// Componente puramente local: não persiste dados no banco.
// O clique em um card aplica a configuração SOMENTE nos estados do React pai.
// A gravação segue o fluxo manual via "Salvar Configuração" (S2.11.2).

/**
 * @param {object}   eletricoModulo   — dados elétricos do módulo (catalogoEletrico)
 * @param {object}   eletricoInversor — dados elétricos do inversor (catalogoEletrico)
 * @param {object}   clima            — { temperatura_min_historica_c, temperatura_max_historica_c }
 * @param {number}   modulos_por_string — valor atual do slider (para destacar card ativo)
 * @param {number}   strings_paralelo   — valor atual do slider (para destacar card ativo)
 * @param {function} onAplicar        — (m, s) => void — aplica no estado local do pai
 */
function SecaoOptimizerInteligente({
  eletricoModulo,
  eletricoInversor,
  clima,
  modulos_por_string,
  strings_paralelo,
  onAplicar,
}) {
  const [status,    setStatus]    = useState('idle')  // 'idle'|'loading'|'ok'|'erro'
  const [resultado, setResultado] = useState(null)
  const [erroMsg,   setErroMsg]   = useState('')

  const podeOtimizar = !!eletricoModulo && !!eletricoInversor

  async function sugerir() {
    if (!podeOtimizar) return
    setStatus('loading')
    setErroMsg('')

    try {
      const resp = await fetch('/api/engenharia/optimizer-arranjo', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dados_eletricos_modulo:   eletricoModulo,
          dados_eletricos_inversor: eletricoInversor,
          dados_climaticos_regiao: clima
            ? {
                temperatura_min_historica_c: clima.temperatura_min_historica_c,
                temperatura_max_historica_c: clima.temperatura_max_historica_c,
              }
            : null,
        }),
      })

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(body.erro ?? `HTTP ${resp.status}`)
      }

      const data = await resp.json()
      setResultado(data)
      setStatus('ok')
    } catch (err) {
      setErroMsg(err.message ?? 'Erro ao executar optimizer.')
      setStatus('erro')
    }
  }

  const top3       = resultado?.configuracoes_validas?.slice(0, 3) ?? []
  const temTop     = status === 'ok' && top3.length > 0
  const stats      = resultado?.resumo_estatistico

  return (
    <div className="bg-white border border-violet-200 rounded-xl p-5 space-y-4">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-violet-500" />
          <h3 className="text-sm font-semibold text-slate-700">Optimizer de Arranjo</h3>
          <span className="text-[10px] font-bold tracking-widest text-violet-500 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">
            GRID SEARCH
          </span>
        </div>
        <button
          onClick={sugerir}
          disabled={!podeOtimizar || status === 'loading'}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            podeOtimizar && status !== 'loading'
              ? 'bg-violet-600 text-white hover:bg-violet-700 active:bg-violet-800'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {status === 'loading' ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Calculando...</>
          ) : (
            <><Wand2 className="w-3.5 h-3.5" /> Sugerir Melhor Arranjo</>
          )}
        </button>
      </div>

      {/* Aviso sem equipamentos */}
      {!podeOtimizar && (
        <p className="text-xs text-slate-400">
          Selecione módulo e inversor para habilitar o optimizer.
        </p>
      )}

      {/* Erro */}
      {status === 'erro' && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          {erroMsg}
        </div>
      )}

      {/* Nenhuma configuração válida */}
      {status === 'ok' && top3.length === 0 && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Nenhuma configuração elétrica válida encontrada nas restrições padrão (3–25 módulos, 1–6 strings).
          Verifique se os dados elétricos do módulo e inversor estão corretos.
        </div>
      )}

      {/* Métricas */}
      {temTop && stats && (
        <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-400">
          <span className="bg-slate-50 border border-slate-200 rounded-full px-2.5 py-0.5 font-mono">
            {stats.total_testadas} combinações testadas
          </span>
          <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full px-2.5 py-0.5 font-mono">
            {stats.total_validas} válidas
          </span>
          <span className="bg-slate-50 border border-slate-200 rounded-full px-2.5 py-0.5 font-mono">
            {stats.tempo_execucao_ms}ms
          </span>
        </div>
      )}

      {/* Top 3 cards */}
      {temTop && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {top3.map((cfg, idx) => (
            <CardSugestao
              key={`${cfg.modulos_por_string}-${cfg.strings_paralelo}`}
              cfg={cfg}
              posicao={idx + 1}
              ativo={modulos_por_string === cfg.modulos_por_string && strings_paralelo === cfg.strings_paralelo}
              onAplicar={() => onAplicar(cfg.modulos_por_string, cfg.strings_paralelo)}
            />
          ))}
        </div>
      )}

      {/* Aviso de read-only */}
      {temTop && (
        <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          Clicar em um card aplica a sugestão nos sliders acima. Use "Salvar configuração" para persistir no banco.
        </p>
      )}
    </div>
  )
}

// ─── Card de sugestão individual ─────────────────────────────────────────────

const MEDALHAS = ['🥇', '🥈', '🥉']

function CardSugestao({ cfg, posicao, ativo, onAplicar }) {
  const {
    modulos_por_string: m,
    strings_paralelo:   s,
    total_modulos,
    score_final,
    score_breakdown,
    calculos_principais: cp,
  } = cfg

  // Cor do oversizing: ideal [1.15–1.30] = verde, fora = âmbar
  const foOk = cp?.fator_oversizing >= 1.15 && cp?.fator_oversizing <= 1.30

  // Cor do uso Voc/Vmax: ≤ 85% = verde, > 85% = âmbar
  const tensaoOk = cp?.margem_tensao_percentual <= 85

  return (
    <button
      onClick={onAplicar}
      className={`w-full text-left rounded-xl border-2 p-4 space-y-3 transition-all ${
        ativo
          ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200'
          : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/50'
      }`}
    >
      {/* Posição + score */}
      <div className="flex items-center justify-between">
        <span className="text-xl leading-none">{MEDALHAS[posicao - 1]}</span>
        <div className="flex flex-col items-end">
          <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Score</span>
          <span className="text-xl font-black text-violet-700 leading-none">{score_final}</span>
        </div>
      </div>

      {/* Dados do arranjo */}
      <div className="space-y-1.5">
        <LinhaDado label="Módulos/string"  valor={`${m}`}         mono />
        <LinhaDado label="Strings paralelas" valor={`${s}`}       mono />
        <LinhaDado label="Total módulos"   valor={`${total_modulos}`} mono />

        {cp?.fator_oversizing != null && (
          <LinhaDado
            label="Oversizing"
            valor={`${cp.fator_oversizing.toFixed(2)}×`}
            cor={foOk ? 'text-emerald-700' : 'text-amber-600'}
            mono
          />
        )}

        {cp?.margem_tensao_percentual != null && (
          <LinhaDado
            label="Uso Voc/Vmax"
            valor={`${cp.margem_tensao_percentual}%`}
            cor={tensaoOk ? 'text-emerald-700' : 'text-amber-600'}
            mono
          />
        )}
      </div>

      {/* Mini barras de score por critério */}
      {score_breakdown && (
        <div className="pt-2 border-t border-slate-100 space-y-1">
          {Object.entries(score_breakdown).map(([chave, v]) => (
            <div key={chave} className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 w-16 capitalize truncate">{chave}</span>
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-400 rounded-full"
                  style={{ width: `${Math.min(v.score, 100)}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-slate-500 w-7 text-right">{v.score}</span>
            </div>
          ))}
        </div>
      )}

      {/* Indicador de aplicado */}
      {ativo && (
        <div className="text-[11px] text-violet-600 font-semibold text-center bg-violet-100 rounded-lg py-1">
          ✓ Configuração aplicada
        </div>
      )}
    </button>
  )
}

function LinhaDado({ label, valor, cor = 'text-slate-800', mono = false }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`${cor} ${mono ? 'font-mono font-bold' : 'font-medium'}`}>{valor}</span>
    </div>
  )
}
