/**
 * E5Dimensionamento.jsx — Pré-Dimensionamento (refatorado)
 *
 * REMOVIDO: quantidade/modelo de painéis e inversores (hardware → E7)
 * MANTIDO: consumo, irradiância, geração alvo, estimativa de potência
 * ADICIONADO: slider de eficiência 70–100%, crescimento de carga, aviso de hardware
 */

import { useEffect, useMemo } from 'react'
import { useState } from 'react'
import { Zap, Sun, TrendingUp, AlertCircle, Info } from 'lucide-react'
import { useProjetoFV } from '../../../contexts/ProjetoFVContext'
import Button from '../../ui/Button'

// Aparelhos com consumo típico mensal (kWh/mês) — valores conservadores
const APARELHOS = [
  { id: 'ar9',      label: 'Ar-cond. 9.000 BTU',   kwh: 120 },
  { id: 'ar12',     label: 'Ar-cond. 12.000 BTU',  kwh: 160 },
  { id: 'ar18',     label: 'Ar-cond. 18.000 BTU',  kwh: 240 },
  { id: 'chuveiro', label: 'Chuveiro elétrico',     kwh: 150 },
  { id: 'ev',       label: 'Veículo Elétrico (EV)', kwh: 280 },
  { id: 'piscina',  label: 'Piscina / aquecedor',   kwh: 120 },
  { id: 'bomba',    label: 'Bomba d\'água',         kwh:  60 },
  { id: 'freezer',  label: 'Freezer comercial',     kwh:  90 },
]

// Faixa de módulos estimada usando potências mín/máx de mercado
const PAINEL_MIN_W = 550
const PAINEL_MAX_W = 620
// Potência central para estimar numPaineis no contexto (sem exibir como hardware)
const PAINEL_REF_W = 585

export default function E5Dimensionamento() {
  const { state, dispatch, proxima, anterior } = useProjetoFV()
  const { dadosConsumo, irradiancia, localizacao, dimensionamento: dim } = state

  // ── Estado local (persiste em dim via _* campos ocultos) ─────────────────
  const [fatorEficiencia, setFatorEficiencia] = useState(
    dim._fatorEficiencia ?? 0.80
  )
  const [crescimentoKwh, setCrescimentoKwh] = useState(
    dim._crescimentoKwh != null ? String(dim._crescimentoKwh) : ''
  )
  const [aparelhosSel, setAparelhosSel] = useState(
    dim._aparelhos ?? []
  )

  // ── Entradas ─────────────────────────────────────────────────────────────
  const consumoBase = Number(dadosConsumo.consumoMensal) || 0
  const irrad       = irradiancia.mediaAnual || 0
  const cidadeLabel = localizacao?.cidadeEstado || 'sua cidade'

  const crescimentoAparelhos = useMemo(
    () => aparelhosSel.reduce((sum, id) => {
      const a = APARELHOS.find(x => x.id === id)
      return sum + (a?.kwh ?? 0)
    }, 0),
    [aparelhosSel]
  )
  const crescimentoManual = Number(crescimentoKwh) || 0
  const consumoTotal = consumoBase + crescimentoManual + crescimentoAparelhos

  // ── Cálculos em tempo real ────────────────────────────────────────────────
  // Geração por 1 kWp instalado nesta cidade/fator
  const geracaoPor1kWp = irrad > 0
    ? +(irrad * 30 * fatorEficiencia).toFixed(1)
    : 0

  const energiaDiaria = consumoTotal > 0 ? +(consumoTotal / 30).toFixed(2) : 0

  // Potência estimada = consumo_diário ÷ (fator_eficiência × irradiância)
  const potenciaKwp = irrad > 0 && consumoTotal > 0
    ? +(consumoTotal / 30 / fatorEficiencia / irrad).toFixed(2)
    : null

  // Faixa de módulos
  const faixaMin = potenciaKwp ? Math.ceil(potenciaKwp * 1000 / PAINEL_MAX_W) : null
  const faixaMax = potenciaKwp ? Math.ceil(potenciaKwp * 1000 / PAINEL_MIN_W) : null

  // Geração estimada do sistema
  const geracaoEstimada = potenciaKwp
    ? +(potenciaKwp * geracaoPor1kWp).toFixed(0)
    : null

  // ── Dispatch ao contexto (autosave funciona normalmente) ─────────────────
  useEffect(() => {
    if (!potenciaKwp) return

    const numPaineis    = Math.ceil(potenciaKwp * 1000 / PAINEL_REF_W)
    // Usa potência do inversor já selecionado (E7) se disponível; fallback 20kW
    const capInv        = state.equipamentos?.inversor?.potenciaKW || 20
    const numInversores = Math.ceil(potenciaKwp / capInv)
    const areaMinima    = +(numPaineis * 2.0).toFixed(1)

    dispatch({
      type: 'SET_DIMENSIONAMENTO',
      payload: {
        // Valores principais (consumidos por E6, E7, E8)
        potenciaKwp,
        potenciaRealKwp:      potenciaKwp,       // sem arredondamento por painel
        numPaineis,                               // estimativa central — E7 recalculará
        numInversores,                            // estimativa — E7 substitui com valor real
        energiaDiaria,
        energiaNecessaria:    +(consumoTotal / 30 / fatorEficiencia).toFixed(2),
        areaMinima,
        potenciaPainelW:      PAINEL_REF_W,       // referência padrão para E7
        capacidadeInversorKW: capInv,             // referência para E7
        // Estado interno do E5 para re-hidratação
        _fatorEficiencia: fatorEficiencia,
        _crescimentoKwh:  crescimentoManual,
        _aparelhos:       aparelhosSel,
      },
    })
  }, [potenciaKwp, fatorEficiencia, crescimentoManual, aparelhosSel])

  function toggleAparelho(id) {
    setAparelhosSel(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // Label descritivo do fator
  function labelEficiencia(f) {
    if (f < 0.78) return '🌥️ Conservador — sombreamento significativo ou orientação não ideal'
    if (f < 0.92) return '⛅ Realista — perdas típicas de cabos, conversão e sombreamento leve'
    return '☀️ Otimista — telhado ideal, sem sombreamento, alta eficiência'
  }

  const temDados    = consumoBase > 0 && irrad > 0
  const podeAvancar = !!potenciaKwp

  return (
    <div className="space-y-6">

      {/* Cabeçalho */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Pré-Dimensionamento</h2>
        <p className="text-sm text-slate-500 mt-1">
          Estimativa energética baseada no consumo e irradiância local.
          Hardware (painéis, inversores) será escolhido na etapa de equipamentos.
        </p>
      </div>

      {/* Alerta de dados incompletos */}
      {!temDados && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <AlertCircle size={16} className="shrink-0" />
          Dados de consumo ou irradiância incompletos. Volte e preencha as etapas anteriores.
        </div>
      )}

      {/* Resumo de entradas */}
      {temDados && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-500">Consumo atual</p>
            <p className="text-xl font-bold text-slate-900">
              {consumoBase}
              <span className="text-xs font-normal ml-1 text-slate-400">kWh/mês</span>
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-500">Irradiância local</p>
            <p className="text-xl font-bold text-slate-900">
              {irrad.toFixed(2)}
              <span className="text-xs font-normal ml-1 text-slate-400">kWh/m²/dia</span>
            </p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 col-span-2 sm:col-span-1">
            <p className="text-xs text-blue-600 font-medium">Cada 1 kWp gera</p>
            <p className="text-xl font-bold text-blue-700">
              {geracaoPor1kWp}
              <span className="text-xs font-normal ml-1 text-blue-500">kWh/mês</span>
            </p>
            <p className="text-[11px] text-blue-400 mt-0.5">em {cidadeLabel}, neste cenário</p>
          </div>
        </div>
      )}

      {/* Slider de eficiência */}
      {temDados && (
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Fator de eficiência / sombreamento</p>
            <span className="text-2xl font-bold text-blue-700">{Math.round(fatorEficiencia * 100)}%</span>
          </div>

          <input
            type="range"
            min="70"
            max="100"
            step="1"
            value={Math.round(fatorEficiencia * 100)}
            onChange={e => setFatorEficiencia(Number(e.target.value) / 100)}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: '#3b82f6' }}
          />

          <div className="flex justify-between text-[11px] text-slate-400 -mt-2">
            <span>70% — Muito sombreado</span>
            <span>85% — Típico</span>
            <span>100% — Ideal</span>
          </div>

          <div className="bg-white rounded-lg border border-blue-100 p-3 text-xs text-slate-600">
            <p>{labelEficiencia(fatorEficiencia)}</p>
            <p className="text-slate-400 mt-1">
              Engloba: perdas em cabos, conversão CC/CA, temperatura, sujeira e sombreamento.
            </p>
          </div>
        </div>
      )}

      {/* Crescimento futuro da carga */}
      {temDados && (
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-600" />
            <p className="text-sm font-semibold text-slate-700">Crescimento futuro da carga</p>
          </div>
          <p className="text-xs text-slate-500 -mt-2">
            Adicione equipamentos previstos para dimensionar com folga.
          </p>

          {/* Chips de aparelhos */}
          <div className="flex flex-wrap gap-2">
            {APARELHOS.map(a => {
              const sel = aparelhosSel.includes(a.id)
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAparelho(a.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all select-none ${
                    sel
                      ? 'bg-emerald-100 border-emerald-400 text-emerald-800 shadow-sm'
                      : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {sel ? '✓ ' : '+ '}{a.label}
                  <span className="ml-1 opacity-60">({a.kwh} kWh)</span>
                </button>
              )
            })}
          </div>

          {/* Campo manual */}
          <div className="flex items-center gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                Adicionar kWh manual
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={crescimentoKwh}
                  onChange={e => setCrescimentoKwh(e.target.value)}
                  className="w-28 px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <span className="text-sm text-slate-500">kWh/mês</span>
              </div>
            </div>
          </div>

          {/* Resumo de crescimento */}
          {(crescimentoAparelhos + crescimentoManual) > 0 && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
              <p className="text-emerald-800 font-medium">
                Crescimento total: +{crescimentoAparelhos + crescimentoManual} kWh/mês
              </p>
              <p className="text-emerald-600 text-xs mt-0.5">
                Consumo dimensionado: <strong>{consumoTotal} kWh/mês</strong>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Bloco de resultados */}
      {potenciaKwp && (
        <div className="space-y-3">

          {/* Cards principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-5 rounded-xl border-2 border-amber-200 bg-amber-50 text-amber-800 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-white/60">
                <Zap size={22} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Potência Estimada</p>
                <p className="text-2xl font-bold mt-0.5">
                  {potenciaKwp} <span className="text-sm font-normal opacity-70">kWp</span>
                </p>
              </div>
            </div>

            <div className="p-5 rounded-xl border-2 border-blue-200 bg-blue-50 text-blue-800 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-white/60">
                <Sun size={22} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Geração Estimada</p>
                <p className="text-2xl font-bold mt-0.5">
                  {geracaoEstimada} <span className="text-sm font-normal opacity-70">kWh/mês</span>
                </p>
              </div>
            </div>
          </div>

          {/* Faixa de módulos */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Faixa provável de módulos
              </p>
              <p className="text-xl font-bold text-slate-900">
                {faixaMin === faixaMax ? faixaMin : `${faixaMin} a ${faixaMax}`} painéis
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Estimativa para módulos de {PAINEL_MIN_W} W a {PAINEL_MAX_W} W
              </p>
            </div>
            <div className="text-4xl opacity-20 font-bold text-slate-600 select-none">~</div>
          </div>

          {/* Aviso de hardware */}
          <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
            <Info size={18} className="text-indigo-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-indigo-800">
                Hardware será definido na etapa de equipamentos.
              </p>
              <p className="text-xs text-indigo-600 mt-1">
                Modelos exatos de painéis, inversores e estrutura serão escolhidos na E7
                com base nesta estimativa de {potenciaKwp} kWp.
              </p>
            </div>
          </div>

          {/* Detalhes colapsáveis */}
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-500 hover:text-slate-700 font-medium select-none">
              Ver detalhes do cálculo
            </summary>
            <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 font-mono text-xs text-slate-600">
              <p>Consumo base        = <strong>{consumoBase} kWh/mês</strong></p>
              {(crescimentoManual + crescimentoAparelhos) > 0 && (
                <p>Crescimento         = +<strong>{crescimentoManual + crescimentoAparelhos} kWh/mês</strong></p>
              )}
              <p>Consumo total       = <strong>{consumoTotal} kWh/mês</strong></p>
              <p>Energia diária      = {consumoTotal} ÷ 30 = <strong>{energiaDiaria} kWh/dia</strong></p>
              <p>Fator de eficiência = <strong>{Math.round(fatorEficiencia * 100)}%</strong></p>
              <p>Irradiância local   = <strong>{irrad} kWh/m²/dia</strong></p>
              <p>Potência estimada   = {energiaDiaria} ÷ {fatorEficiencia} ÷ {irrad} = <strong>{potenciaKwp} kWp</strong></p>
              <p>Geração por 1 kWp  = {irrad} × 30 × {fatorEficiencia} = <strong>{geracaoPor1kWp} kWh/mês</strong></p>
              <p>Geração estimada    = {potenciaKwp} × {geracaoPor1kWp} = <strong>{geracaoEstimada} kWh/mês</strong></p>
              <p>Faixa de módulos    = {potenciaKwp}×1000÷{PAINEL_MAX_W} a {potenciaKwp}×1000÷{PAINEL_MIN_W} = <strong>{faixaMin}–{faixaMax} painéis</strong></p>
            </div>
          </details>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variante="secundario" onClick={anterior}>← Anterior</Button>
        <Button onClick={proxima} disabled={!podeAvancar}>Próxima →</Button>
      </div>
    </div>
  )
}
