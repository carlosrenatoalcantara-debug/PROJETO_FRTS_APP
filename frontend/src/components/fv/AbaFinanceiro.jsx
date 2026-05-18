import { useState } from 'react'
import { TrendingUp, RefreshCw } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../ui/Card'
import Button from '../ui/Button'
import Input from '../ui/Input'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway */

function GraficoPayback({ fluxoCaixaSemBateria, fluxoCaixaComBateria }) {
  if (!fluxoCaixaSemBateria || !fluxoCaixaComBateria) return null

  const maxSaldo = Math.max(
    Math.max(...fluxoCaixaSemBateria.map(d => d.saldoAcumulado || 0)),
    Math.max(...fluxoCaixaComBateria.map(d => d.saldoAcumulado || 0))
  )

  const minSaldo = Math.min(
    Math.min(...fluxoCaixaSemBateria.map(d => d.saldoAcumulado || 0)),
    Math.min(...fluxoCaixaComBateria.map(d => d.saldoAcumulado || 0))
  )

  const escala = maxSaldo - minSaldo

  return (
    <div className="w-full space-y-4">
      <div className="flex items-end justify-between gap-1 h-64">
        {fluxoCaixaSemBateria.filter((_, i) => i % 3 === 0 || i === fluxoCaixaSemBateria.length - 1).map((ponto, idx) => {
          const pct1 = ((ponto.saldoAcumulado - minSaldo) / escala) * 100
          const pct2 = ((fluxoCaixaComBateria[ponto.ano]?.saldoAcumulado - minSaldo) / escala) * 100

          return (
            <div key={ponto.ano} className="flex gap-1 flex-1 items-end h-full">
              <div
                className="bg-blue-400 rounded-t flex-1 transition-all hover:bg-blue-500"
                style={{ height: `${Math.max(pct1, 2)}%` }}
                title={`Sem BESS Ano ${ponto.ano}: R$ ${ponto.saldoAcumulado?.toLocaleString()}`}
              />
              <div
                className="bg-green-400 rounded-t flex-1 transition-all hover:bg-green-500"
                style={{ height: `${Math.max(pct2, 2)}%` }}
                title={`Com BESS Ano ${ponto.ano}: R$ ${fluxoCaixaComBateria[ponto.ano]?.saldoAcumulado?.toLocaleString()}`}
              />
              <span className="text-xs text-slate-500 w-full text-center">{ponto.ano}a</span>
            </div>
          )
        })}
      </div>
      <div className="flex gap-4 justify-center">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-400 rounded" />
          <span className="text-sm text-slate-600">Sem BESS</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-400 rounded" />
          <span className="text-sm text-slate-600">Com BESS</span>
        </div>
      </div>
    </div>
  )
}

export default function AbaFinanceiro({ projetoId }) {
  const [tarifaEnergia, setTarifaEnergia] = useState('0.95')
  const [crescimentoConsumo, setCrescimentoConsumo] = useState('2')
  const [comBESS, setComBESS] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [resultadoSemBESS, setResultadoSemBESS] = useState(null)
  const [resultadoComBESS, setResultadoComBESS] = useState(null)

  async function simular() {
    setCarregando(true)

    try {
      const params = {
        investimento: 35000,
        consumo_kwh_mes: 1200,
        tarifa_energia: Number(tarifaEnergia),
        crescimento_consumo_anual: Number(crescimentoConsumo) / 100,
        inflacao_energia: 0.08,
        taxa_desconto: 0.10,
        anos: 25,
      }

      const resSemBESS = await fetch(`${API_URL}/api/financeiro/simular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, tipo_cenario: 'sem_bateria' }),
      })

      const dados1 = await resSemBESS.json()
      setResultadoSemBESS(dados1)

      if (comBESS) {
        const resComBESS = await fetch(`${API_URL}/api/financeiro/simular`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...params, tipo_cenario: 'com_bateria' }),
        })

        const dados2 = await resComBESS.json()
        setResultadoComBESS(dados2)
      } else {
        setResultadoComBESS(null)
      }
    } catch (err) {
      console.error('Erro ao simular:', err)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Parâmetros */}
      <Card>
        <CardHeader>Parâmetros Financeiros</CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              rotulo="Tarifa de Energia (R$/kWh)"
              type="number"
              value={tarifaEnergia}
              onChange={(e) => setTarifaEnergia(e.target.value)}
              step="0.01"
              placeholder="0.95"
            />
            <Input
              rotulo="Crescimento de Consumo Anual (%)"
              type="number"
              value={crescimentoConsumo}
              onChange={(e) => setCrescimentoConsumo(e.target.value)}
              placeholder="2"
            />
            <div className="flex items-end">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={comBESS}
                  onChange={(e) => setComBESS(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <span className="font-medium text-slate-700">Comparar com BESS</span>
              </label>
            </div>
          </div>

          <div className="mt-4">
            <Button
              icone={RefreshCw}
              variante="primario"
              onClick={simular}
              disabled={carregando}
            >
              {carregando ? 'Simulando...' : 'Simular Cenários'}
            </Button>
          </div>
        </CardBody>
      </Card>

      {resultadoSemBESS && (
        <>
          {/* Gráfico Comparativo */}
          {resultadoComBESS && (
            <Card>
              <CardHeader>Comparação de Payback (25 anos)</CardHeader>
              <CardBody>
                <GraficoPayback
                  fluxoCaixaSemBateria={resultadoSemBESS.fluxo_caixa}
                  fluxoCaixaComBateria={resultadoComBESS.fluxo_caixa}
                />
              </CardBody>
            </Card>
          )}

          {/* Indicadores Lado a Lado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sem BESS */}
            <Card>
              <CardHeader>Sem BESS</CardHeader>
              <CardBody className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">Payback</span>
                  <span className="font-bold text-slate-900">{resultadoSemBESS.payback} anos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">TIR</span>
                  <span className="font-bold text-slate-900">{resultadoSemBESS.tir}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">VPL (25 anos)</span>
                  <span className="font-bold text-slate-900">R$ {resultadoSemBESS.vpl.toLocaleString()}</span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="text-slate-600">Economia Total</span>
                  <span className="font-bold text-green-600">
                    R$ {resultadoSemBESS.economia_total_25anos.toLocaleString()}
                  </span>
                </div>
              </CardBody>
            </Card>

            {/* Com BESS */}
            {resultadoComBESS && (
              <Card>
                <CardHeader>Com BESS</CardHeader>
                <CardBody className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Payback</span>
                    <span className={`font-bold ${resultadoComBESS.payback < 15 ? 'text-green-600' : 'text-orange-600'}`}>
                      {resultadoComBESS.payback} anos
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">TIR</span>
                    <span className="font-bold text-slate-900">{resultadoComBESS.tir}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">VPL (25 anos)</span>
                    <span className="font-bold text-slate-900">R$ {resultadoComBESS.vpl.toLocaleString()}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between">
                    <span className="text-slate-600">Economia Total</span>
                    <span className="font-bold text-green-600">
                      R$ {resultadoComBESS.economia_total_25anos.toLocaleString()}
                    </span>
                  </div>
                </CardBody>
              </Card>
            )}
          </div>

          {/* Tabela Fluxo de Caixa */}
          <Card>
            <CardHeader>Fluxo de Caixa Detalhado (Sem BESS)</CardHeader>
            <CardBody className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-2 font-semibold text-slate-600">Ano</th>
                    <th className="text-right py-2 px-2 font-semibold text-slate-600">Consumo (kWh)</th>
                    <th className="text-right py-2 px-2 font-semibold text-slate-600">Tarifa</th>
                    <th className="text-right py-2 px-2 font-semibold text-slate-600">Economia Bruta</th>
                    <th className="text-right py-2 px-2 font-semibold text-slate-600">Custo O&M</th>
                    <th className="text-right py-2 px-2 font-semibold text-slate-600">Fluxo Líquido</th>
                    <th className="text-right py-2 px-2 font-semibold text-slate-600">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {resultadoSemBESS.fluxo_caixa.filter((_, i) => i % 5 === 0 || i === resultadoSemBESS.fluxo_caixa.length - 1).map((row) => (
                    <tr key={row.ano} className="border-b border-slate-100">
                      <td className="py-2 px-2 font-medium">{row.ano}</td>
                      <td className="text-right py-2 px-2 text-slate-600">{row.consumo_kwh}</td>
                      <td className="text-right py-2 px-2 text-slate-600">R$ {row.tarifa.toFixed(2)}</td>
                      <td className="text-right py-2 px-2 text-slate-600">R$ {row.economia_bruta.toLocaleString()}</td>
                      <td className="text-right py-2 px-2 text-slate-600">R$ {row.custo_om.toLocaleString()}</td>
                      <td className="text-right py-2 px-2 font-medium text-slate-900">R$ {row.fluxo_liquido.toLocaleString()}</td>
                      <td className={`text-right py-2 px-2 font-semibold ${row.saldoAcumulado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        R$ {row.saldoAcumulado.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>

          {resultadoComBESS && (
            <Card>
              <CardHeader>Fluxo de Caixa Detalhado (Com BESS)</CardHeader>
              <CardBody className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-2 font-semibold text-slate-600">Ano</th>
                      <th className="text-right py-2 px-2 font-semibold text-slate-600">Consumo (kWh)</th>
                      <th className="text-right py-2 px-2 font-semibold text-slate-600">Tarifa</th>
                      <th className="text-right py-2 px-2 font-semibold text-slate-600">Economia Bruta</th>
                      <th className="text-right py-2 px-2 font-semibold text-slate-600">Custo O&M</th>
                      <th className="text-right py-2 px-2 font-semibold text-slate-600">Fluxo Líquido</th>
                      <th className="text-right py-2 px-2 font-semibold text-slate-600">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultadoComBESS.fluxo_caixa.filter((_, i) => i % 5 === 0 || i === resultadoComBESS.fluxo_caixa.length - 1).map((row) => (
                      <tr key={row.ano} className="border-b border-slate-100">
                        <td className="py-2 px-2 font-medium">{row.ano}</td>
                        <td className="text-right py-2 px-2 text-slate-600">{row.consumo_kwh}</td>
                        <td className="text-right py-2 px-2 text-slate-600">R$ {row.tarifa.toFixed(2)}</td>
                        <td className="text-right py-2 px-2 text-slate-600">R$ {row.economia_bruta.toLocaleString()}</td>
                        <td className="text-right py-2 px-2 text-slate-600">R$ {row.custo_om.toLocaleString()}</td>
                        <td className="text-right py-2 px-2 font-medium text-slate-900">R$ {row.fluxo_liquido.toLocaleString()}</td>
                        <td className={`text-right py-2 px-2 font-semibold ${row.saldoAcumulado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          R$ {row.saldoAcumulado.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
