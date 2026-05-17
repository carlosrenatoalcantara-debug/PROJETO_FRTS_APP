import { useState, useEffect } from 'react'
import { Battery, Zap, DollarSign, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Badge from '../components/ui/Badge'

const API_URL = import.meta.env.VITE_API_URL || ''

function GraficoEconomia({ fluxoCaixa }) {
  const maxSaldo = Math.max(...fluxoCaixa.map(d => d.saldo))
  const altura = 300

  return (
    <div className="w-full h-64 flex flex-col">
      <div className="flex-1 flex items-end justify-between gap-1 px-2 py-4">
        {fluxoCaixa.filter((_, i) => i % 3 === 0 || i === fluxoCaixa.length - 1).map((ponto) => {
          const altoBarra = maxSaldo > 0 ? (ponto.saldo / maxSaldo) * 100 : 0
          return (
            <div key={ponto.ano} className="flex flex-col items-center gap-1 flex-1">
              <div
                className="bg-blue-500 rounded-t w-full transition-all hover:bg-blue-600"
                style={{ height: `${Math.max(altoBarra, 5)}%` }}
                title={`Ano ${ponto.ano}: R$ ${ponto.saldo.toLocaleString()}`}
              />
              <span className="text-xs text-slate-500">{ponto.ano}a</span>
            </div>
          )
        })}
      </div>
      <div className="text-xs text-slate-500 text-center mt-2">Saldo acumulado (R$)</div>
    </div>
  )
}

export default function ComparacaoBESS() {
  const [cargaKW, setCargaKW] = useState('5')
  const [horasBackup, setHorasBackup] = useState('4')
  const [consumoMensalKWh, setConsumoMensalKWh] = useState('1000')
  const [modo, setModo] = useState('economia')
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState('')

  async function dimensionar() {
    if (!cargaKW || !horasBackup) {
      setErro('Preenchimento obrigatório')
      return
    }

    setCarregando(true)
    setErro('')

    try {
      const res = await fetch(`${API_URL}/api/bess/dimensionar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carga_kw: Number(cargaKW),
          horas_backup: Number(horasBackup),
          consumo_mensal_kwh: Number(consumoMensalKWh),
          modo,
          tarifa_energia: 0.95,
          anos_simulacao: 25
        })
      })

      if (!res.ok) throw new Error('Erro ao dimensionar')

      const dados = await res.json()
      setResultado(dados)
    } catch (err) {
      setErro('Erro ao calcular cenários')
      console.error(err)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Comparação de Cenários BESS</h1>
        <p className="text-slate-500">Analise o impacto financeiro da bateria de armazenamento</p>
      </div>

      {/* Formulário */}
      <Card>
        <CardHeader>Parâmetros de Cálculo</CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Input
              rotulo="Carga (kW)"
              type="number"
              value={cargaKW}
              onChange={e => setCargaKW(e.target.value)}
              placeholder="Ex: 5"
            />
            <Input
              rotulo="Backup (horas)"
              type="number"
              value={horasBackup}
              onChange={e => setHorasBackup(e.target.value)}
              placeholder="Ex: 4"
            />
            <Input
              rotulo="Consumo Mensal (kWh)"
              type="number"
              value={consumoMensalKWh}
              onChange={e => setConsumoMensalKWh(e.target.value)}
              placeholder="Ex: 1000"
            />
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">Modo</label>
              <select
                value={modo}
                onChange={e => setModo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="economia">Economia</option>
                <option value="backup">Backup</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button variante="primario" onClick={dimensionar} disabled={carregando}>
              {carregando ? 'Calculando...' : 'Comparar Cenários'}
            </Button>
          </div>

          {erro && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">✗ {erro}</div>}
        </CardBody>
      </Card>

      {resultado && (
        <>
          {/* Recomendação */}
          <div
            className={`p-4 rounded-lg border-2 flex items-start gap-3 ${
              resultado.comparacao.recomendacao_cor === 'verde'
                ? 'bg-green-50 border-green-300'
                : resultado.comparacao.recomendacao_cor === 'amarela'
                  ? 'bg-yellow-50 border-yellow-300'
                  : 'bg-red-50 border-red-300'
            }`}
          >
            <div className="flex-shrink-0">
              {resultado.comparacao.recomendacao_cor === 'verde' ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-orange-600" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">{resultado.comparacao.recomendacao}</p>
              <p className="text-sm text-slate-600 mt-1">
                {resultado.comparacao.recomendacao_cor === 'verde'
                  ? 'A bateria é um investimento viável e rentável para sua situação.'
                  : resultado.comparacao.recomendacao_cor === 'amarela'
                    ? 'A bateria apresenta um retorno razoável. Considere seus objetivos.'
                    : 'A bateria não é economicamente viável no cenário atual.'}
              </p>
            </div>
          </div>

          {/* Cenários Lado a Lado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sem Bateria */}
            <Card>
              <CardHeader className="flex items-center gap-2">
                <Zap size={20} className="text-blue-500" />
                <h2 className="text-lg font-bold text-slate-900">Sem Bateria</h2>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="bg-blue-50 p-3 rounded">
                  <p className="text-xs text-slate-500 font-semibold">Investimento Inicial</p>
                  <p className="text-2xl font-bold text-slate-900">R$ 0</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Economia Anual</span>
                    <span className="font-semibold text-slate-900">
                      R$ {resultado.cenario_sem_bateria.economia_anual.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Payback</span>
                    <span className="font-semibold text-slate-900">N/A</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Saldo 25 anos</span>
                    <span className="font-semibold text-slate-900">
                      R$ {resultado.cenario_sem_bateria.fluxo_caixa_25_anos.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <p className="text-xs font-semibold text-slate-500 mb-2">Fluxo de Caixa</p>
                  <GraficoEconomia fluxoCaixa={resultado.fluxo_caixa.sem_bateria} />
                </div>
              </CardBody>
            </Card>

            {/* Com Bateria */}
            <Card>
              <CardHeader className="flex items-center gap-2">
                <Battery size={20} className="text-green-500" />
                <h2 className="text-lg font-bold text-slate-900">Com Bateria</h2>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="bg-green-50 p-3 rounded">
                  <p className="text-xs text-slate-500 font-semibold">Investimento Inicial</p>
                  <p className="text-2xl font-bold text-slate-900">
                    R$ {resultado.cenario_com_bateria.investimento.toLocaleString()}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Capacidade</span>
                    <span className="font-semibold text-slate-900">{resultado.cenario_com_bateria.capacidade_kwh} kWh</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Autonomia</span>
                    <span className="font-semibold text-slate-900">{resultado.cenario_com_bateria.autonomia}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Economia Anual</span>
                    <span className="font-semibold text-slate-900">
                      R$ {resultado.cenario_com_bateria.economia_anual.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Payback</span>
                    <span className={`font-semibold ${resultado.cenario_com_bateria.payback < 15 ? 'text-green-600' : 'text-red-600'}`}>
                      {resultado.cenario_com_bateria.payback} anos
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Saldo 25 anos</span>
                    <span className="font-semibold text-slate-900">
                      R$ {resultado.cenario_com_bateria.fluxo_caixa_25_anos.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <p className="text-xs font-semibold text-slate-500 mb-2">Fluxo de Caixa</p>
                  <GraficoEconomia fluxoCaixa={resultado.fluxo_caixa.com_bateria} />
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Comparação Destacada */}
          <Card>
            <CardHeader>Diferenças Principais</CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-3 bg-orange-50 rounded border border-orange-200">
                  <p className="text-xs text-slate-500 font-semibold">Investimento Extra</p>
                  <p className="text-xl font-bold text-orange-600 mt-1">
                    R$ {resultado.comparacao.diferenca_investimento.toLocaleString()}
                  </p>
                </div>

                <div
                  className={`p-3 rounded border ${
                    resultado.comparacao.diferenca_economia_anual > 0
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <p className="text-xs text-slate-500 font-semibold">Economia Adicional</p>
                  <p
                    className={`text-xl font-bold mt-1 ${
                      resultado.comparacao.diferenca_economia_anual > 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    R$ {Math.abs(resultado.comparacao.diferenca_economia_anual).toLocaleString()}/ano
                  </p>
                </div>

                <div className="p-3 bg-blue-50 rounded border border-blue-200">
                  <p className="text-xs text-slate-500 font-semibold">Diferença de Payback</p>
                  <p className="text-xl font-bold text-blue-600 mt-1">{resultado.comparacao.diferenca_payback} anos</p>
                </div>

                <div
                  className={`p-3 rounded border ${
                    resultado.comparacao.diferenca_saldo_25_anos > 0
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <p className="text-xs text-slate-500 font-semibold">Ganho em 25 Anos</p>
                  <p
                    className={`text-xl font-bold mt-1 ${
                      resultado.comparacao.diferenca_saldo_25_anos > 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    R$ {Math.abs(resultado.comparacao.diferenca_saldo_25_anos).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Resumo */}
          <Card>
            <CardHeader>Resumo da Análise</CardHeader>
            <CardBody>
              <div className="space-y-3 text-sm">
                <p>
                  <span className="font-semibold text-slate-900">Cenário Sem Bateria:</span> Investimento zero,
                  com economia anual de{' '}
                  <span className="font-bold text-blue-600">
                    R$ {resultado.cenario_sem_bateria.economia_anual.toLocaleString()}
                  </span>
                  .
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Cenário Com Bateria:</span> Investimento de{' '}
                  <span className="font-bold text-orange-600">
                    R$ {resultado.cenario_com_bateria.investimento.toLocaleString()}
                  </span>{' '}
                  em troca de{' '}
                  <span className="font-bold text-green-600">
                    R$ {resultado.cenario_com_bateria.economia_anual.toLocaleString()}/ano
                  </span>
                  , com payback de{' '}
                  <span className="font-bold">
                    {resultado.cenario_com_bateria.payback} anos
                  </span>
                  .
                </p>
                <p>
                  <span className="font-semibold text-slate-900">25 Anos:</span> A bateria acumula um saldo de{' '}
                  <span className="font-bold text-slate-900">
                    R$ {resultado.cenario_com_bateria.fluxo_caixa_25_anos.toLocaleString()}
                  </span>
                  , enquanto sem bateria seria{' '}
                  <span className="font-bold text-slate-900">
                    R$ {resultado.cenario_sem_bateria.fluxo_caixa_25_anos.toLocaleString()}
                  </span>
                  .
                </p>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
