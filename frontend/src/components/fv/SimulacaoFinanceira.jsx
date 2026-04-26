import { useState } from 'react'
import { TrendingUp, DollarSign, Clock, BarChart2, ChevronDown } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../ui/Card'

// ── Gráfico de fluxo de caixa acumulado (SVG) ─────────────────────────────────
function GraficoFluxoCaixa({ fluxoAnual, custoTotal, corPrimaria = '#f97316' }) {
  if (!fluxoAnual?.length) return null

  const W = 560, H = 200, PL = 60, PB = 28, PT = 16
  const cW = W - PL - 12
  const cH = H - PB - PT

  const saldos   = fluxoAnual.map(f => f.saldoAcumulado)
  const saldosD  = fluxoAnual.map(f => f.saldoDescontado)
  const minVal   = Math.min(-custoTotal, ...saldos, ...saldosD) * 1.05
  const maxVal   = Math.max(...saldos, ...saldosD) * 1.10

  const range = maxVal - minVal
  const fy = (v) => PT + cH - ((v - minVal) / range) * cH
  const fx = (i) => PL + (i / (fluxoAnual.length - 1)) * cW

  // Linha zero
  const yZero = fy(0)

  const pontosSaldo  = fluxoAnual.map((_, i) => `${fx(i)},${fy(saldos[i])}`).join(' ')
  const pontosSaldoD = fluxoAnual.map((_, i) => `${fx(i)},${fy(saldosD[i])}`).join(' ')

  // Grid Y
  const grade = [-custoTotal, 0, maxVal * 0.5, maxVal].filter(v => v >= minVal && v <= maxVal)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Fluxo de caixa acumulado">
      {/* Grid */}
      {grade.map(v => {
        const y = fy(v)
        const neg = v < 0
        return (
          <g key={v}>
            <line x1={PL} y1={y} x2={W - 12} y2={y}
              stroke={v === 0 ? '#64748b' : '#e2e8f0'}
              strokeWidth={v === 0 ? 1.5 : 1}
              strokeDasharray={v === 0 ? '4 3' : undefined}
            />
            <text x={PL - 4} y={y + 4} textAnchor="end" fontSize="9" fill={neg ? '#ef4444' : '#94a3b8'}>
              {Math.abs(v) >= 1000
                ? `${v < 0 ? '-' : ''}R$${(Math.abs(v)/1000).toFixed(0)}k`
                : `R$${v.toFixed(0)}`}
            </text>
          </g>
        )
      })}

      {/* Área abaixo de zero preenchida */}
      {yZero < PT + cH && (
        <rect x={PL} y={yZero} width={cW} height={PT + cH - yZero}
          fill="#fee2e2" opacity="0.4" />
      )}

      {/* Linhas */}
      <polyline points={pontosSaldoD} fill="none" stroke="#94a3b8"
        strokeWidth="1.5" strokeDasharray="5 3" />
      <polyline points={pontosSaldo} fill="none" stroke={corPrimaria}
        strokeWidth="2.5" strokeLinejoin="round" />

      {/* Ponto de payback */}
      {fluxoAnual.map((f, i) => {
        if (f.saldoAcumulado < 0 || (i > 0 && fluxoAnual[i-1].saldoAcumulado >= 0)) return null
        return (
          <circle key={i} cx={fx(i)} cy={fy(f.saldoAcumulado)}
            r="4" fill={corPrimaria} stroke="white" strokeWidth="2" />
        )
      })}

      {/* Labels eixo X */}
      {[5, 10, 15, 20, 25].map(ano => {
        const idx = ano - 1
        if (idx >= fluxoAnual.length) return null
        return (
          <text key={ano} x={fx(idx)} y={H - PB + 14}
            textAnchor="middle" fontSize="10" fill="#94a3b8">
            {ano}a
          </text>
        )
      })}

      {/* Legenda */}
      <line x1={PL} y1={H - 10} x2={PL + 20} y2={H - 10} stroke={corPrimaria} strokeWidth="2.5" />
      <text x={PL + 24} y={H - 6} fontSize="10" fill="#64748b">Saldo acumulado</text>
      <line x1={PL + 120} y1={H - 10} x2={PL + 140} y2={H - 10}
        stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="5 3" />
      <text x={PL + 144} y={H - 6} fontSize="10" fill="#94a3b8">Valor presente (TMA {'{'}6%{'}'} )</text>
    </svg>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function SimulacaoFinanceira({ financeiro, corPrimaria = '#f97316' }) {
  const [mostrarFluxo, setMostrarFluxo] = useState(false)
  if (!financeiro) return null

  const {
    custoTotalEstimado, economiaMensal, economiaAnual, economiaTotal25,
    paybackAnos, paybackDescontado, tir, vpl, roi25Anos,
    tarifaEnergia, inflacaoEnergia, taxaDesconto, fluxoAnual,
  } = financeiro

  const brl = (v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-slate-600" />
          <div>
            <h2 className="font-semibold text-slate-900">Simulação Financeira — 25 anos</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Inflação energia: {(inflacaoEnergia * 100).toFixed(0)}% a.a. · TMA: {(taxaDesconto * 100).toFixed(0)}% a.a. · Degradação: 0,5%/ano
            </p>
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        {/* KPIs financeiros */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { r: 'Investimento',     v: brl(custoTotalEstimado), sub: 'estimado',           icone: DollarSign, cor: 'text-slate-600' },
            { r: 'TIR',             v: `${tir}% a.a.`,          sub: 'retorno real',        icone: TrendingUp, cor: tir > 20 ? 'text-emerald-600' : 'text-amber-600' },
            { r: 'VPL (25 anos)',    v: brl(vpl),                sub: `à TMA ${(taxaDesconto*100).toFixed(0)}%`, icone: BarChart2,  cor: vpl > 0 ? 'text-emerald-600' : 'text-red-500' },
            { r: 'Payback Desc.',   v: `${paybackDescontado} anos`, sub: 'valor presente',  icone: Clock,       cor: 'text-blue-600' },
          ].map(({ r, v, sub, icone: Icone, cor }) => (
            <div key={r} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-1">
                <Icone size={14} className={cor} />
                <p className="text-xs text-slate-500">{r}</p>
              </div>
              <p className={`text-lg font-bold ${cor}`}>{v}</p>
              <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Resumo economia */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { r: 'Economia/mês',  v: brl(economiaMensal) },
            { r: 'Economia/ano',  v: brl(economiaAnual) },
            { r: 'Total 25 anos', v: brl(economiaTotal25) },
          ].map(({ r, v }) => (
            <div key={r} className="text-center p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-xs text-slate-500">{r}</p>
              <p className="font-bold text-emerald-700 text-base mt-0.5">{v}</p>
            </div>
          ))}
        </div>

        {/* ROI bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-500">
            <span>ROI em 25 anos: <strong className="text-slate-800">{roi25Anos}%</strong></span>
            <span>Payback simples: <strong className="text-slate-800">{paybackAnos} anos</strong></span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (Number(paybackAnos) / 25) * 100)}%`,
                backgroundColor: corPrimaria,
              }}
            />
          </div>
          <p className="text-xs text-slate-400">Barra = payback simples / vida útil (25 anos)</p>
        </div>

        {/* Comparativo conta de luz */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-xs font-semibold text-red-700 uppercase">Sem solar — 25 anos</p>
            <p className="text-xl font-bold text-red-800 mt-1">
              {brl(economiaAnual * (1 - Math.pow(1 + Number(inflacaoEnergia), 25)) / (-Number(inflacaoEnergia)))}
            </p>
            <p className="text-xs text-red-600 mt-0.5">Gasto total com energia elétrica</p>
          </div>
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <p className="text-xs font-semibold text-emerald-700 uppercase">Com solar — 25 anos</p>
            <p className="text-xl font-bold text-emerald-800 mt-1">{brl(custoTotalEstimado)}</p>
            <p className="text-xs text-emerald-600 mt-0.5">Investimento único + manutenção mínima</p>
          </div>
        </div>

        {/* Gráfico de fluxo */}
        {fluxoAnual?.length > 0 && (
          <div>
            <button
              onClick={() => setMostrarFluxo(v => !v)}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
            >
              <ChevronDown size={16} className={`transition-transform ${mostrarFluxo ? 'rotate-180' : ''}`} />
              {mostrarFluxo ? 'Ocultar' : 'Ver'} fluxo de caixa acumulado
            </button>
            {mostrarFluxo && (
              <div className="mt-3">
                <GraficoFluxoCaixa
                  fluxoAnual={fluxoAnual}
                  custoTotal={custoTotalEstimado}
                  corPrimaria={corPrimaria}
                />
                {/* Tabela resumida */}
                <div className="mt-3 overflow-x-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200">
                        {['Ano','Economia','Saldo Acum.','VP Economia','Saldo VP'].map(h => (
                          <th key={h} className="text-left px-2 py-1.5 text-slate-500 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fluxoAnual.filter((_, i) => i % 5 === 4 || i === 0).map(f => (
                        <tr key={f.ano} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-2 py-1.5 font-medium">{f.ano}º</td>
                          <td className="px-2 py-1.5 text-emerald-700">R$ {f.economia.toLocaleString('pt-BR', {maximumFractionDigits:0})}</td>
                          <td className={`px-2 py-1.5 font-medium ${f.saldoAcumulado >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            R$ {f.saldoAcumulado.toLocaleString('pt-BR', {maximumFractionDigits:0})}
                          </td>
                          <td className="px-2 py-1.5 text-slate-500">R$ {f.valorPresente.toLocaleString('pt-BR', {maximumFractionDigits:0})}</td>
                          <td className={`px-2 py-1.5 ${f.saldoDescontado >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            R$ {f.saldoDescontado.toLocaleString('pt-BR', {maximumFractionDigits:0})}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
