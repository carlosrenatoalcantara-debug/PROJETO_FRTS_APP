import { useState } from 'react'
import { TrendingUp, DollarSign, Clock, BarChart2, AlertCircle, CheckCircle } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

// ── Gráfico de fluxo de caixa acumulado (SVG) ─────────────────────────────────
function GraficoFluxoCaixa({ fluxoCaixa, corPrimaria = '#f97316' }) {
  if (!fluxoCaixa?.length) return null

  const W = 600, H = 240, PL = 60, PB = 30, PT = 20
  const cW = W - PL - 12
  const cH = H - PB - PT

  const saldos = fluxoCaixa.map(f => f.saldoAcumulado)
  const minVal = Math.min(0, ...saldos) * 1.05
  const maxVal = Math.max(...saldos) * 1.10

  const range = maxVal - minVal
  const fy = (v) => PT + cH - ((v - minVal) / range) * cH
  const fx = (i) => PL + (i / (fluxoCaixa.length - 1)) * cW

  const pontos = fluxoCaixa.map((_, i) => `${fx(i)},${fy(saldos[i])}`).join(' ')
  const yZero = fy(0)

  const grade = [minVal, 0, maxVal * 0.5, maxVal].filter(v => v >= minVal && v <= maxVal)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Fluxo de caixa acumulado">
      {/* Grid */}
      {grade.map(v => (
        <g key={v}>
          <line x1={PL} y1={fy(v)} x2={W - 12} y2={fy(v)}
            stroke={v === 0 ? '#64748b' : '#e2e8f0'}
            strokeWidth={v === 0 ? 1.5 : 1}
            strokeDasharray={v === 0 ? '4 3' : undefined}
          />
          <text x={PL - 4} y={fy(v) + 4} textAnchor="end" fontSize="9" fill={v < 0 ? '#ef4444' : '#94a3b8'}>
            {Math.abs(v) >= 1000 ? `${v < 0 ? '-' : ''}R$${(Math.abs(v)/1000).toFixed(0)}k` : `R$${Math.round(v)}`}
          </text>
        </g>
      ))}

      {/* Área abaixo de zero */}
      {yZero < PT + cH && (
        <rect x={PL} y={yZero} width={cW} height={PT + cH - yZero} fill="#fee2e2" opacity="0.4" />
      )}

      {/* Linha */}
      <polyline points={pontos} fill="none" stroke={corPrimaria} strokeWidth="2.5" strokeLinejoin="round" />

      {/* Labels eixo X */}
      {[5, 10, 15, 20, 25].map(ano => {
        const idx = ano - 1
        if (idx >= fluxoCaixa.length) return null
        return (
          <text key={ano} x={fx(idx)} y={H - PB + 14} textAnchor="middle" fontSize="10" fill="#94a3b8">
            {ano}a
          </text>
        )
      })}

      {/* Legenda */}
      <line x1={PL} y1={H - 10} x2={PL + 20} y2={H - 10} stroke={corPrimaria} strokeWidth="2.5" />
      <text x={PL + 24} y={H - 6} fontSize="10" fill="#64748b">Saldo acumulado (R$)</text>
    </svg>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function SimulacaoFinanceira() {
  const [form, setForm] = useState({
    investimento: '',
    economia_mensal: '',
    inflacao_energia: '8',
    taxa_desconto: '12',
    anos: '25',
  })

  const [resultado, setResultado] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const f = (campo, valor) => setForm(prev => ({ ...prev, [campo]: valor }))

  async function simular() {
    setErro('')

    if (!form.investimento || Number(form.investimento) <= 0) {
      setErro('Informe o investimento')
      return
    }
    if (!form.economia_mensal || Number(form.economia_mensal) <= 0) {
      setErro('Informe a economia mensal')
      return
    }

    setCarregando(true)
    try {
      const resp = await fetch('/api/financeiro/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investimento: Number(form.investimento),
          economia_mensal: Number(form.economia_mensal),
          inflacao_energia: Number(form.inflacao_energia) / 100,
          taxa_desconto: Number(form.taxa_desconto) / 100,
          anos: Number(form.anos),
        }),
      })

      const data = await resp.json()
      if (!resp.ok) throw new Error(data.erro || `HTTP ${resp.status}`)

      setResultado(data)
    } catch (e) {
      setErro(e.message || 'Erro ao conectar com o servidor')
    } finally {
      setCarregando(false)
    }
  }

  const corPrimaria = '#f97316'

  return (
    <div className="max-w-5xl space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Simulação Financeira</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Calcule payback, TIR, VPL e fluxo de caixa para sua análise de investimento.
        </p>
      </div>

      {/* Formulário */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-900">Parâmetros da Simulação</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              rotulo="Investimento inicial (R$) *"
              type="number"
              min="1000"
              placeholder="Ex: 50000"
              value={form.investimento}
              onChange={e => f('investimento', e.target.value)}
            />
            <Input
              rotulo="Economia mensal (R$) *"
              type="number"
              min="100"
              placeholder="Ex: 500"
              value={form.economia_mensal}
              onChange={e => f('economia_mensal', e.target.value)}
            />
            <Input
              rotulo="Inflação de energia (% a.a.)"
              type="number"
              min="0"
              max="20"
              step="0.5"
              placeholder="8"
              value={form.inflacao_energia}
              onChange={e => f('inflacao_energia', e.target.value)}
            />
            <Input
              rotulo="Taxa de desconto (% a.a.)"
              type="number"
              min="0"
              max="30"
              step="0.5"
              placeholder="12"
              value={form.taxa_desconto}
              onChange={e => f('taxa_desconto', e.target.value)}
            />
            <Input
              rotulo="Período de análise (anos)"
              type="number"
              min="5"
              max="50"
              placeholder="25"
              value={form.anos}
              onChange={e => f('anos', e.target.value)}
            />
          </div>

          {erro && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={16} />
              {erro}
            </div>
          )}

          <Button
            onClick={simular}
            carregando={carregando}
            className="w-full"
            icone={BarChart2}
          >
            Simular
          </Button>
        </CardBody>
      </Card>

      {/* Resultados */}
      {resultado && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { titulo: 'Payback Simples', valor: typeof resultado.payback === 'number' ? `${resultado.payback} anos` : resultado.payback, icone: Clock, cor: 'text-blue-600' },
              { titulo: 'TIR (a.a.)', valor: `${resultado.tir}%`, icone: TrendingUp, cor: resultado.tir > 20 ? 'text-emerald-600' : 'text-amber-600' },
              { titulo: 'VPL (25 anos)', valor: `R$ ${resultado.vpl.toLocaleString('pt-BR')}`, icone: DollarSign, cor: resultado.vpl > 0 ? 'text-emerald-600' : 'text-red-600' },
              { titulo: 'ROI', valor: `${resultado.roi}%`, icone: TrendingUp, cor: 'text-violet-600' },
            ].map(({ titulo, valor, icone: Icone, cor }) => (
              <div key={titulo} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <Icone size={14} className={cor} />
                  <p className="text-xs text-slate-500 uppercase font-semibold">{titulo}</p>
                </div>
                <p className={`text-lg font-bold ${cor}`}>{valor}</p>
              </div>
            ))}
          </div>

          {/* Gráfico */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart2 size={18} className="text-slate-600" />
                <h2 className="font-semibold text-slate-900">Fluxo de Caixa Acumulado</h2>
              </div>
            </CardHeader>
            <CardBody>
              <GraficoFluxoCaixa fluxoCaixa={resultado.fluxo_caixa} corPrimaria={corPrimaria} />
            </CardBody>
          </Card>

          {/* Tabela de fluxo detalhado */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-slate-900">Detalhamento Anual (seleção)</h2>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {['Ano', 'Economia (R$)', 'Saldo Acumulado', 'Valor Presente', 'Saldo Desc.'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.fluxo_caixa
                      .filter((_, i) => i % 5 === 0 || i === 0 || i === resultado.fluxo_caixa.length - 1)
                      .map(f => (
                        <tr key={f.ano} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-900">{f.ano}º</td>
                          <td className="px-4 py-2.5 text-emerald-700">
                            R$ {f.economia.toLocaleString('pt-BR')}
                          </td>
                          <td className={`px-4 py-2.5 font-medium ${f.saldoAcumulado >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            R$ {f.saldoAcumulado.toLocaleString('pt-BR')}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500">
                            R$ {f.valorPresente.toLocaleString('pt-BR')}
                          </td>
                          <td className={`px-4 py-2.5 ${f.saldoDescontado >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            R$ {f.saldoDescontado.toLocaleString('pt-BR')}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          {/* Interpretação */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-slate-900">Interpretação dos Resultados</h2>
            </CardHeader>
            <CardBody className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-slate-700">
                  <strong>Payback:</strong> O investimento será recuperado em{' '}
                  {typeof resultado.payback === 'number' ? `${resultado.payback} anos` : 'mais de 25 anos'}.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-slate-700">
                  <strong>TIR ({resultado.tir}% a.a.):</strong> Taxa anual de retorno do investimento. Compare com suas alternativas de investimento (taxa mínima de atratividade).
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle size={14} className={`${resultado.vpl > 0 ? 'text-emerald-600' : 'text-red-600'} shrink-0 mt-0.5`} />
                <p className="text-slate-700">
                  <strong>VPL (R$ {resultado.vpl.toLocaleString('pt-BR')}):</strong>{' '}
                  {resultado.vpl > 0
                    ? 'Positivo — o investimento é viável. Quanto maior, melhor.'
                    : 'Negativo — o investimento não cobre o custo de capital esperado.'}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-slate-700">
                  <strong>ROI ({resultado.roi}%):</strong> Retorno total do investimento em todo o período. Inclui a inflação de energia.
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}
