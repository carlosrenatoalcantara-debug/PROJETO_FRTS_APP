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
import GerenciadorArranjos from '../GerenciadorArranjos'
import ResumoTecnicoArranjo from '../ResumoTecnicoArranjo'
import SugestaoTopologiaReferencia from '../SugestaoTopologiaReferencia'
import { salvarArranjos } from '../../../services/projetoFVApi'
import { consolidarPanos, dimensoesModulo } from '../../../utils/geoEngine'
import { snapshotEquipamentoSelecao } from '../../../utils/catalogoEngenhariaAdapter'
import { validarMicroinversores } from '../../../../../backend/src/utils/fv/validacaoMicroinversores.js'

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
        // FASE 3: hidrata arranjos + tipo_projeto (ampliação congela o arranjo existente)
        // P0-E7-UX-CLEANUP-01 (BUG-01): o Arranjo A primário vive em `equipamentos`;
        // NÃO carregar o bloco 'principal' em state.arranjos (senão o GerenciadorArranjos
        // renderiza o Arranjo A de novo E a agregação da E8 conta em dobro). Exceção:
        // 'ampliacao' usa state.arranjos como fonte (sem primário em equipamentos).
        if (Array.isArray(projeto?.arranjos) && projeto.arranjos.length) {
          const ehAmpliacao = projeto.tipo_projeto === 'ampliacao'
          const arranjosSecundarios = ehAmpliacao
            ? projeto.arranjos
            : projeto.arranjos.filter(a => a.tipo !== 'principal' && a.rotulo !== 'Arranjo A')
          dispatch({ type: 'SET_ARRANJOS', payload: arranjosSecundarios })
        }
        if (projeto?.tipo_projeto) {
          dispatch({ type: 'SET_TIPO_PROJETO', payload: { tipoProjeto: projeto.tipo_projeto, projetoOrigemId: projeto.projeto_origem_id ?? null } })
        }
      })
      .catch(() => {})
      .finally(() => setCarregandoProjeto(false))
  }, [projetoId])

  // ── Colapso dos seletores ──────────────────────────────────────────────
  const [painelExp,    setPainelExp]    = useState(true)
  const [inversorExp,  setInversorExp]  = useState(true)
  const [estruturaExp, setEstruturaExp] = useState(true)
  // P0-E7-UX-CLEANUP-01 (BUG-02): card "Sugestões Técnicas" — recolhido por padrão
  const [sugestoesAberto, setSugestoesAberto] = useState(false)
  const ehCosern = String(dadosConsumo?.concessionaria || dadosConsumo?.distribuidora || '').toUpperCase().replace(/\s+/g, '').includes('COSERN')

  function selecionarPainel(painel) {
    // S8.1: snapshot do equipamento no momento da seleção (versão congelada)
    const item = { ...painel, snapshot_equipamento: snapshotEquipamentoSelecao(painel) }
    dispatch({ type: 'SET_EQUIPAMENTO', payload: { tipo: 'painel', item } })
    setPainelExp(false)
    setErro('')
  }
  function selecionarInversor(inversor) {
    const item = { ...inversor, snapshot_equipamento: snapshotEquipamentoSelecao(inversor) }
    dispatch({ type: 'SET_EQUIPAMENTO', payload: { tipo: 'inversor', item } })
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

    // P1-03: validação física mínima de microinversores.
    // Topologia micro → cada micro tem nº finito de entradas DC. Bloqueia
    // configurações impossíveis (ex.: 20 módulos / 5 micros / 1 entrada).
    const inv = equipamentos.inversor
    if (inv?.tipo === 'micro') {
      const numModulos = equipamentos.quantidadeModulos ?? dim.numPaineis ?? 0
      const numMicros = dim.numInversores ?? 0
      const entradasPorMicro = (inv.nMppts ?? 1) * (inv.entradasPorMppt ?? 1)
      const res = validarMicroinversores({
        numModulos,
        numMicros,
        entradasPorMicro,
        potenciaModuloW: equipamentos.painel?.potenciaW ?? null,
        potenciaMicroCA_W: inv.potenciaKW ? inv.potenciaKW * 1000 : null,
      })
      if (!res.valido) {
        setErro(`Configuração de microinversores inválida: ${res.bloqueios.join(' ')}`)
        return false
      }
    }

    return true
  }

  // ── FASE 1: monta e persiste o array de arranjos (backend shape) ───────────
  function blocoParaBackend(b, rotuloFallback, tipoFallback) {
    const painel   = b.painel   || b.paineis?.[0]   || null
    const inversor = b.inversor || b.inversores?.[0] || null
    const paineis = b.painel ? [{
      marca: painel.fabricante || painel.marca || null,
      fabricante: painel.fabricante || painel.marca || null,
      modelo: painel.modelo || null,
      potencia_w: painel.especificacoes?.potencia_wp || painel.potencia_w || painel.potenciaW || null,
      quantidade: b.quantidadeModulos ?? null,
      equipamento_id: painel._id || null,
    }] : (b.paineis || [])
    const inversores = b.inversor ? [{
      marca: inversor.fabricante || inversor.marca || null,
      fabricante: inversor.fabricante || inversor.marca || null,
      modelo: inversor.modelo || null,
      potencia_kw: inversor.especificacoes?.potencia_kw || inversor.potencia_kw || inversor.potenciaKW || null,
      quantidade: 1,
      equipamento_id: inversor._id || null,
    }] : (b.inversores || [])
    return {
      id: b.id, rotulo: b.rotulo || rotuloFallback, tipo: b.tipo || tipoFallback,
      somente_leitura: !!b.somente_leitura, paineis, inversores,
      estrutura: b.estrutura || null,  // P2-FV-MULTIARRANJO-UX-01: estrutura por arranjo
    }
  }

  function montarArranjosPayload() {
    if (state.tipoProjeto === 'ampliacao') {
      // arranjos já carregados (existente congelado + ampliação editável)
      return state.arranjos.map((b, i) => blocoParaBackend(b, `Arranjo ${i + 1}`, b.tipo || 'ampliacao'))
    }
    const lista = []
    if (equipamentos.painel || equipamentos.inversor) {
      lista.push(blocoParaBackend(
        { id: 'arr_primario', rotulo: 'Arranjo A', tipo: 'principal',
          painel: equipamentos.painel, inversor: equipamentos.inversor,
          quantidadeModulos: equipamentos.quantidadeModulos ?? dim.numPaineis ?? null,
          estrutura: equipamentos.estrutura?.id || null },  // P2-FV-MULTIARRANJO-UX-01
        'Arranjo A', 'principal',
      ))
    }
    state.arranjos.forEach((b, i) => lista.push(blocoParaBackend(b, `Arranjo ${String.fromCharCode(66 + i)}`, 'secundario')))
    return lista
  }

  async function persistirArranjos() {
    if (!projetoId) return
    try { await salvarArranjos(projetoId, montarArranjosPayload()) }
    catch (err) { console.warn('[E7] salvar arranjos falhou:', err.message) }
  }

  function avancar() {
    if (!validar()) return
    persistirArranjos()   // fire-and-forget — não bloqueia a navegação
    proxima()
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

      {/* ── Arranjo A (principal) — P2-FV-MULTIARRANJO-UX-01 ────────────── */}
      <section className="border border-emerald-300 rounded-xl bg-white space-y-4 p-4">
        {/* Header Arranjo A */}
        <div className="flex items-center gap-2 flex-wrap">
          <Layers size={18} className="text-emerald-600" />
          <span className="font-bold text-slate-900">Arranjo A</span>
          <span className="text-[10px] text-emerald-700 font-bold tracking-widest bg-emerald-100 border border-emerald-200 rounded-full px-2 py-0.5">PRINCIPAL</span>
          {(equipamentos.painel || equipamentos.inversor || equipamentos.estrutura) && (
            <span className="text-[10px] text-slate-500 ml-auto">
              {[
                equipamentos.painel  && `${equipamentos.painel.marca} ${equipamentos.painel.modelo}`,
                equipamentos.inversor && `${equipamentos.inversor.marca} ${equipamentos.inversor.modelo}`,
                equipamentos.estrutura && equipamentos.estrutura.tipo,
              ].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>

        {/* Módulos Fotovoltaicos */}
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

        {/* Inversores */}
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

        {/* Estrutura de Fixação */}
        <section className="border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
          <button
            className="w-full flex items-center justify-between px-5 py-4"
            onClick={() => setEstruturaExp(v => !v)}
            aria-expanded={estruturaExp}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <Layers size={18} className="text-slate-600" />
              <h3 className="font-semibold text-slate-900">Estrutura de Fixação</h3>
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

        {/* Resumo técnico do Arranjo A (paridade com B/C/D) — Fase 7/10/11 */}
        {ambosSelecionados && (
          <ResumoTecnicoArranjo
            arranjo={{
              paineis: equipamentos.painel ? [{
                modelo: equipamentos.painel.modelo,
                potencia_w: equipamentos.painel.potenciaW,
                quantidade: equipamentos.quantidadeModulos ?? dim.numPaineis ?? 0,
              }] : [],
              inversores: equipamentos.inversor ? [{ modelo: equipamentos.inversor.modelo, quantidade: 1 }] : [],
            }}
            catalogo={{
              modulos: equipamentos.painel ? [{ _id: 'A_mod', modelo: equipamentos.painel.modelo, especificacoes: {
                potencia_wp: equipamentos.painel.potenciaW, voc: equipamentos.painel.voc,
              } }] : [],
              inversores: equipamentos.inversor ? [{ _id: 'A_inv', modelo: equipamentos.inversor.modelo, especificacoes: {
                potencia_kw: equipamentos.inversor.potenciaKW, n_mppts: equipamentos.inversor.nMppts,
                entradas_por_mppt: equipamentos.inversor.entradasPorMppt, tensao_max_entrada: equipamentos.inversor.tensaoMaxV,
              } }] : [],
            }}
          />
        )}

        {/* Configurador Elétrico */}
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
              onSaveAndNext={avancar}
            />
          )}
        </section>
      </section>

      {/* ── Arranjos Secundários (B, C, D…) — GerenciadorArranjos ──────────── */}
      <GerenciadorArranjos />

      {/* P0-E7-UX-CLEANUP-01 (BUG-02): "Sugestões Técnicas" — card recolhido,
          só quando concessionária = COSERN, e NUNCA acima do Arranjo A. */}
      {ehCosern && (
        <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setSugestoesAberto(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50"
            aria-expanded={sugestoesAberto}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Layers size={16} className="text-indigo-500" /> Sugestões Técnicas
              <span className="text-[10px] text-slate-400 font-normal">(opcional)</span>
            </span>
            {sugestoesAberto ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
          </button>
          {sugestoesAberto && (
            <div className="px-5 pb-5 border-t border-slate-100 pt-4">
              <SugestaoTopologiaReferencia
                concessionaria={dadosConsumo?.concessionaria || dadosConsumo?.distribuidora}
                onAplicar={(ref) => {
                  const t = ref?.topologia
                  const qtd = t?.num_modulos ?? t?.modulos_atendidos ?? null
                  if (qtd) {
                    dispatch({ type: 'SET_DIMENSIONAMENTO', payload: { numPaineis: qtd } })
                    dispatch({ type: 'SET_EQUIPAMENTO', payload: { tipo: 'quantidadeModulos', item: qtd } })
                  }
                  setErro(`Referência ${ref.classe} · ${ref.arquitetura} aplicada (${qtd} módulos sugeridos${t?.inversor?.modelo ? `, inversor ${t.inversor.modelo}` : ''}). Edite livremente — é apenas um ponto de partida.`)
                }}
              />
            </div>
          )}
        </div>
      )}

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
        <Button onClick={avancar}>Próxima →</Button>
      </div>
    </div>
  )
}
