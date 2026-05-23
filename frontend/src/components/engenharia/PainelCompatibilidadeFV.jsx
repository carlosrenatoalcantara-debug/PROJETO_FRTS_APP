/**
 * PainelCompatibilidadeFV.jsx — S2.11
 *
 * Painel visual de engenharia fotovoltaica que apresenta o resultado da
 * análise de compatibilidade elétrica produzido por compatibilidadeEletricaService.js.
 *
 * ── Props ────────────────────────────────────────────────────────────────────
 *   resultado  {object|null}  Resultado de analisarCompatibilidade(). Opcional —
 *                             quando ausente, renderiza seletor de cenário mock.
 *
 * ── Stack ────────────────────────────────────────────────────────────────────
 *   React 18 · Tailwind CSS 3 · Lucide React
 *
 * ── Segurança das barras de progresso ────────────────────────────────────────
 *   width visual  = Math.min(margem, 100)   → nunca ultrapassa o contêiner
 *   texto exibido = margem.toFixed(2) + '%' → valor real, mesmo se > 100 %
 */

import React, { useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Thermometer,
  Zap,
  Activity,
  BarChart2,
  ChevronDown,
  ChevronUp,
  MapPin,
} from 'lucide-react'

// ─── Dados mock para desenvolvimento ─────────────────────────────────────────

/**
 * Cenário aprovado — 18 módulos × 1 string, Natal-RN (Tmin=20°C)
 * Canadian Solar CS6W-545MS + Deye SUN-12K-SG04LP3
 */
const MOCK_NATAL = {
  compativel: true,
  warnings: [],
  erros: [],
  limites: {
    tensao_max_inversor: 1000,
    faixa_mppt_min:      200,
    faixa_mppt_max:      850,
    corrente_max_mppt:   18,
    oversizing_max:      1.30,
  },
  calculos: {
    voc_corrigido_frio:       50.599,
    voc_string_max:           910.78,
    delta_temp_frio_c:        -5,
    vmpp_corrigido_frio:      43.39,
    vmpp_corrigido_quente:    34.28,
    vmpp_string_frio:         781.02,
    vmpp_string_quente:       617.04,
    t_cel_max_c:              62.5,
    delta_temp_quente_c:      37.5,
    isc_total:                13.92,
    impp_total:               13.04,
    potencia_cc_total:        9.81,
    fator_oversizing:         0.8175,
    total_modulos:            18,
    total_strings:            1,
    // S2.11 — margens
    margem_tensao_percentual:     91.08,
    margem_mppt_max_percentual:   91.89,
    margem_mppt_min_percentual:   32.41,
    margem_oversizing_percentual: 54.50,
  },
  clima_utilizado: {
    temperatura_min_c: 20,
    temperatura_max_c: 35,
    cidade: 'Natal',
    uf:     'RN',
    fonte:  'dados_regiao',
    usou_fallback: false,
  },
}

/**
 * Cenário reprovado — 19 módulos × 1 string, São Joaquim-SC (Tmin=-3°C)
 * Mesmo equipamento — mesmo arranjo — clima diferente → reprovado
 */
const MOCK_SAO_JOAQUIM = {
  compativel: false,
  warnings: [],
  erros: [
    {
      codigo:           'SOBRETENSAO_VOC',
      severidade:       'critico',
      nivel:            'critico',
      mensagem:         'SOBRETENSÃO CRÍTICA: Voc do string no frio (1022.43 V) excede a tensão máxima CC do inversor (1000 V) em 22.43 V. Risco de destruição imediata do inversor. Reduza módulos por string.',
      explicacao_curta: 'O frio extremo eleva a tensão Voc acima do limite CC do inversor.',
      valores: { voc_string_max: 1022.43, tensao_max_entrada: 1000, excesso_v: 22.43, modulos_por_string: 19, t_min: -3 },
    },
    {
      codigo:           'MPPT_STRING_LONGA',
      severidade:       'critico',
      nivel:            'critico',
      mensagem:         'STRING LONGA DEMAIS: Vmpp no frio (856.46 V) excede o limite máximo de MPPT (850 V) em 6.46 V. Inversor não rastreará potência máxima em dias frios. Reduza módulos.',
      explicacao_curta: 'String longa demais: Vmpp no frio ultrapassa o teto do MPPT.',
      valores: { vmpp_string_frio: 856.46, mppt_max: 850, excesso_v: 6.46, t_min: -3 },
    },
  ],
  limites: {
    tensao_max_inversor: 1000,
    faixa_mppt_min:      200,
    faixa_mppt_max:      850,
    corrente_max_mppt:   18,
    oversizing_max:      1.30,
  },
  calculos: {
    voc_corrigido_frio:       53.812,
    voc_string_max:           1022.43,
    delta_temp_frio_c:        -28,
    vmpp_corrigido_frio:      45.076,
    vmpp_corrigido_quente:    35.31,
    vmpp_string_frio:         856.46,
    vmpp_string_quente:       670.89,
    t_cel_max_c:              62.5,
    delta_temp_quente_c:      37.5,
    isc_total:                13.92,
    impp_total:               13.04,
    potencia_cc_total:        10.355,
    fator_oversizing:         0.8629,
    total_modulos:            19,
    total_strings:            1,
    // S2.11 — margens
    margem_tensao_percentual:     102.24,
    margem_mppt_max_percentual:   100.76,
    margem_mppt_min_percentual:   29.81,
    margem_oversizing_percentual: 57.53,
  },
  clima_utilizado: {
    temperatura_min_c: -3,
    temperatura_max_c: 30,
    cidade: 'São Joaquim',
    uf:     'SC',
    fonte:  'dados_regiao',
    usou_fallback: false,
  },
}

// ─── Helpers de estilo ────────────────────────────────────────────────────────

function corSeveridade(severidade) {
  switch (severidade) {
    case 'critico':      return 'text-red-700 bg-red-50 border-red-200'
    case 'alerta':       return 'text-amber-700 bg-amber-50 border-amber-200'
    case 'recomendacao': return 'text-blue-700 bg-blue-50 border-blue-200'
    default:             return 'text-gray-700 bg-gray-50 border-gray-200'
  }
}

function iconeSeveridade(severidade) {
  switch (severidade) {
    case 'critico':      return <XCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
    case 'alerta':       return <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500" />
    case 'recomendacao': return <Info className="w-4 h-4 flex-shrink-0 text-blue-500" />
    default:             return <Info className="w-4 h-4 flex-shrink-0 text-gray-500" />
  }
}

function labelSeveridade(severidade) {
  switch (severidade) {
    case 'critico':      return 'CRÍTICO'
    case 'alerta':       return 'ALERTA'
    case 'recomendacao': return 'INFO'
    default:             return severidade?.toUpperCase() ?? '—'
  }
}

/**
 * Cor da barra de progresso baseada no percentual de uso do limite.
 *   < 80 %  → verde
 *   80–95 % → amarelo
 *   > 95 %  → vermelho
 */
function corBarra(pct) {
  if (pct < 80)  return 'bg-emerald-500'
  if (pct < 95)  return 'bg-amber-400'
  return 'bg-red-500'
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

/**
 * Barra de progresso com proteção contra overflow de layout.
 * O preenchimento visual é limitado a 100 % mas o valor textual é o real.
 */
function BarraProgresso({ label, valor, unidade = '%', icone }) {
  const pctVisual = Math.min(valor, 100)   // segurança de layout
  const pctTexto  = valor.toFixed(2)       // valor real exibido ao usuário
  const cor       = corBarra(valor)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-gray-600 font-medium">
          {icone}
          {label}
        </span>
        <span className={`font-mono font-bold ${valor > 100 ? 'text-red-600' : valor > 95 ? 'text-amber-600' : 'text-gray-700'}`}>
          {pctTexto}{unidade}
        </span>
      </div>
      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${cor}`}
          style={{ width: `${pctVisual}%` }}
          aria-valuenow={valor}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
        />
      </div>
    </div>
  )
}

/**
 * Card de diagnóstico (erro ou warning).
 */
function CardDiagnostico({ item, expandidoPadrao = false }) {
  const [expandido, setExpandido] = useState(expandidoPadrao)
  const classeBase = corSeveridade(item.severidade)

  return (
    <div className={`rounded-lg border px-4 py-3 ${classeBase}`}>
      {/* Cabeçalho */}
      <button
        className="w-full flex items-start justify-between gap-2 text-left"
        onClick={() => setExpandido(e => !e)}
        aria-expanded={expandido}
      >
        <div className="flex items-start gap-2 min-w-0">
          {iconeSeveridade(item.severidade)}
          <div className="min-w-0">
            <span className="text-[10px] font-bold tracking-widest opacity-60 block leading-none mb-0.5">
              {labelSeveridade(item.severidade)}
            </span>
            <p className="text-sm font-semibold leading-snug">
              {item.explicacao_curta || item.mensagem}
            </p>
            <p className="text-[10px] font-mono opacity-50 mt-0.5">{item.codigo}</p>
          </div>
        </div>
        <span className="flex-shrink-0 mt-0.5 opacity-50">
          {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {/* Detalhes técnicos (expansível) */}
      {expandido && (
        <div className="mt-3 pt-3 border-t border-current/10 space-y-2">
          <p className="text-xs leading-relaxed opacity-80">{item.mensagem}</p>
          {item.valores && Object.keys(item.valores).length > 0 && (
            <div className="bg-white/60 rounded-md px-3 py-2 font-mono text-[11px] space-y-0.5">
              {Object.entries(item.valores).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="opacity-60">{k}</span>
                  <span className="font-semibold">{typeof v === 'number' ? v.toFixed(3).replace(/\.?0+$/, '') : String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

/**
 * Painel visual de compatibilidade elétrica FV.
 *
 * @param {{ resultado?: object|null }} props
 */
export default function PainelCompatibilidadeFV({ resultado: resultadoExterno }) {
  const [cenarioMock, setCenarioMock] = useState('natal')

  // Se resultado externo for passado via props, usa ele; caso contrário usa mock
  const resultado = resultadoExterno ?? (cenarioMock === 'natal' ? MOCK_NATAL : MOCK_SAO_JOAQUIM)
  const isMockMode = !resultadoExterno

  const { compativel, erros, warnings, limites, calculos, clima_utilizado } = resultado

  const todosOsDiagnosticos = [
    ...erros.map(e => ({ ...e, _tipo: 'erro' })),
    ...warnings.map(w => ({ ...w, _tipo: 'warning' })),
  ]

  const temDiagnosticos = todosOsDiagnosticos.length > 0

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 font-sans text-gray-800">

      {/* Seletor de mock (visível apenas em modo desenvolvimento) */}
      {isMockMode && (
        <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-lg px-4 py-2.5">
          <span className="text-xs font-semibold text-violet-500 tracking-wider">DEMO</span>
          <div className="flex gap-1.5 ml-auto">
            <button
              onClick={() => setCenarioMock('natal')}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                cenarioMock === 'natal'
                  ? 'bg-violet-600 text-white'
                  : 'bg-white text-violet-700 border border-violet-300 hover:bg-violet-50'
              }`}
            >
              ☀️ Natal-RN (aprovado)
            </button>
            <button
              onClick={() => setCenarioMock('sc')}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                cenarioMock === 'sc'
                  ? 'bg-violet-600 text-white'
                  : 'bg-white text-violet-700 border border-violet-300 hover:bg-violet-50'
              }`}
            >
              ❄️ São Joaquim-SC (reprovado)
            </button>
          </div>
        </div>
      )}

      {/* Banner de status principal */}
      <div className={`rounded-xl px-5 py-4 flex items-center gap-4 ${
        compativel
          ? 'bg-emerald-50 border border-emerald-200'
          : 'bg-red-50 border border-red-200'
      }`}>
        {compativel
          ? <CheckCircle2 className="w-8 h-8 text-emerald-500 flex-shrink-0" />
          : <XCircle     className="w-8 h-8 text-red-500 flex-shrink-0" />
        }
        <div>
          <p className={`text-base font-bold leading-tight ${compativel ? 'text-emerald-700' : 'text-red-700'}`}>
            {compativel ? 'Arranjo eletricamente compatível' : 'Arranjo reprovado — corrigir antes de executar'}
          </p>
          <p className="text-sm mt-0.5 opacity-70">
            {erros.length === 0 && warnings.length === 0
              ? 'Nenhum problema identificado nas verificações normativas.'
              : `${erros.length} erro${erros.length !== 1 ? 's' : ''} crítico${erros.length !== 1 ? 's' : ''} · ${warnings.length} aviso${warnings.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Clima utilizado */}
      {clima_utilizado && (
        <div className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm ${
          clima_utilizado.usou_fallback
            ? 'bg-amber-50 border border-amber-200 text-amber-800'
            : 'bg-sky-50 border border-sky-200 text-sky-800'
        }`}>
          {clima_utilizado.usou_fallback
            ? <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500" />
            : <MapPin         className="w-4 h-4 flex-shrink-0 text-sky-500" />
          }
          <span>
            {clima_utilizado.usou_fallback
              ? `Fallback climático nacional · Tmin ${clima_utilizado.temperatura_min_c}°C · Tmax ${clima_utilizado.temperatura_max_c}°C`
              : `${clima_utilizado.cidade ?? '—'}${clima_utilizado.uf ? ` — ${clima_utilizado.uf}` : ''} · Tmin ${clima_utilizado.temperatura_min_c}°C · Tmax ${clima_utilizado.temperatura_max_c}°C`
            }
          </span>
        </div>
      )}

      {/* Margens percentuais — barras de progresso */}
      {calculos && (
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Margens de segurança elétrica</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <BarraProgresso
              label="Tensão CC (Voc/Vmax)"
              valor={calculos.margem_tensao_percentual}
              icone={<Zap className="w-3.5 h-3.5" />}
            />
            <BarraProgresso
              label="MPPT teto (Vmpp_frio/MPPTmax)"
              valor={calculos.margem_mppt_max_percentual}
              icone={<Activity className="w-3.5 h-3.5" />}
            />
            <BarraProgresso
              label="MPPT piso (MPPTmin/Vmpp_quente)"
              valor={calculos.margem_mppt_min_percentual}
              icone={<Thermometer className="w-3.5 h-3.5" />}
            />
            <BarraProgresso
              label="Oversizing CC/CA (vs. limite crítico)"
              valor={calculos.margem_oversizing_percentual}
              icone={<BarChart2 className="w-3.5 h-3.5" />}
            />
          </div>

          <p className="text-[11px] text-gray-400 leading-relaxed">
            Valores &gt; 100 % indicam violação do limite normativo.
            A barra visual é limitada a 100 % para não quebrar o layout;
            o percentual real é exibido à direita.
          </p>
        </div>
      )}

      {/* Diagnósticos agrupados */}
      {temDiagnosticos && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-600 px-1">
            Diagnósticos ({todosOsDiagnosticos.length})
          </h3>
          {todosOsDiagnosticos.map((item, idx) => (
            <CardDiagnostico
              key={`${item.codigo}-${idx}`}
              item={item}
              expandidoPadrao={item.severidade === 'critico'}
            />
          ))}
        </div>
      )}

      {/* Cálculos intermediários (collapsível) */}
      {calculos && (
        <CalculosIntermediarios calculos={calculos} limites={limites} />
      )}
    </div>
  )
}

// ─── Tabela de cálculos intermediários ───────────────────────────────────────

function CalculosIntermediarios({ calculos, limites }) {
  const [aberto, setAberto] = useState(false)

  const linhas = [
    { label: 'Voc corrigido (frio)',       valor: calculos.voc_corrigido_frio,    unidade: 'V',   limite: limites?.tensao_max_inversor, acima: true },
    { label: 'Voc string max (frio)',       valor: calculos.voc_string_max,        unidade: 'V',   limite: limites?.tensao_max_inversor, acima: true },
    { label: 'Vmpp string (frio)',          valor: calculos.vmpp_string_frio,      unidade: 'V',   limite: limites?.faixa_mppt_max, acima: true },
    { label: 'Vmpp string (quente)',        valor: calculos.vmpp_string_quente,    unidade: 'V',   limite: limites?.faixa_mppt_min, abaixo: true },
    { label: 'T célula máx (NOCT)',         valor: calculos.t_cel_max_c,           unidade: '°C' },
    { label: 'Isc total',                   valor: calculos.isc_total,             unidade: 'A',   limite: limites?.corrente_max_mppt, acima: true },
    { label: 'Impp total',                  valor: calculos.impp_total,            unidade: 'A' },
    { label: 'Potência CC total',           valor: calculos.potencia_cc_total,     unidade: 'kWp' },
    { label: 'Fator oversizing (CC/CA)',    valor: calculos.fator_oversizing,      unidade: '×',   limite: 1.30, acima: true },
    { label: 'Total módulos',              valor: calculos.total_modulos,          unidade: '' },
    { label: 'Total strings',              valor: calculos.total_strings,          unidade: '' },
  ]

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setAberto(a => !a)}
        className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-semibold text-gray-600"
        aria-expanded={aberto}
      >
        <span className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-gray-400" />
          Cálculos intermediários
        </span>
        {aberto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {aberto && (
        <div className="divide-y divide-gray-100">
          {linhas.map(({ label, valor, unidade, limite, acima, abaixo }) => {
            const numValor = typeof valor === 'number' ? valor : null
            const excede = numValor !== null && limite != null && (
              (acima  && numValor > limite) ||
              (abaixo && numValor < limite)
            )

            return (
              <div key={label} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="text-gray-500">{label}</span>
                <div className="flex items-center gap-2">
                  {excede && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                  <span className={`font-mono font-semibold ${excede ? 'text-red-600' : 'text-gray-800'}`}>
                    {numValor !== null ? numValor.toFixed(3).replace(/\.?0+$/, '') : String(valor)}
                    {unidade && <span className="text-gray-400 font-normal ml-0.5">{unidade}</span>}
                  </span>
                  {limite != null && (
                    <span className="text-[10px] text-gray-300 font-mono">
                      / {typeof limite === 'number' ? limite.toFixed(2).replace(/\.?0+$/, '') : limite}{unidade}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
