import { useState } from 'react'
import { CheckCircle, AlertCircle, Zap, DollarSign, TrendingUp, Battery } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../ui/Card'
import Button from '../ui/Button'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway */

export default function RecomendacaoFinal({ dadosSimulacao, onAceitar, onPersonalizar }) {
  const [carregando, setCarregando] = useState(false)
  const [recomendacao, setRecomendacao] = useState(null)
  const [erro, setErro] = useState('')

  async function gerar() {
    setCarregando(true)
    setErro('')

    try {
      const res = await fetch(`${API_URL}/api/decisao/recomendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosSimulacao),
      })

      if (!res.ok) throw new Error('Erro ao gerar recomendação')

      const dados = await res.json()
      setRecomendacao(dados)
    } catch (err) {
      setErro('Não foi possível gerar a recomendação automática')
      console.error(err)
    } finally {
      setCarregando(false)
    }
  }

  if (!recomendacao) {
    return (
      <Card className="border-2 border-orange-200 bg-orange-50">
        <CardHeader className="flex items-center gap-2">
          <Zap className="text-orange-600" />
          <h2 className="text-lg font-bold text-slate-900">Recomendação Final</h2>
        </CardHeader>
        <CardBody>
          <p className="text-slate-600 mb-4">
            Com base em todos os dados da simulação, o sistema pode gerar uma recomendação personalizada do melhor
            equipamento e configuração para seu projeto.
          </p>
          <Button
            variante="primario"
            onClick={gerar}
            disabled={carregando || !dadosSimulacao}
          >
            {carregando ? 'Analisando...' : 'Gerar Recomendação Inteligente'}
          </Button>
        </CardBody>
      </Card>
    )
  }

  const confiabilidadeCores = {
    alta: 'green',
    media: 'yellow',
    baixa: 'red'
  }

  const corConf = confiabilidadeCores[recomendacao.confiabilidade]

  return (
    <div className="space-y-4">
      {/* Alerta de Confiabilidade */}
      {recomendacao.confiabilidade !== 'alta' && (
        <div
          className={`p-4 rounded-lg border-2 flex items-start gap-3 ${
            corConf === 'yellow'
              ? 'bg-yellow-50 border-yellow-300'
              : 'bg-red-50 border-red-300'
          }`}
        >
          <AlertCircle className={`w-6 h-6 ${corConf === 'yellow' ? 'text-yellow-600' : 'text-red-600'}`} />
          <div>
            <p className="font-semibold text-slate-900">
              Atenção: Confiabilidade {recomendacao.confiabilidade.toUpperCase()}
            </p>
            {recomendacao.alertas && recomendacao.alertas.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {recomendacao.alertas.map((alerta, i) => (
                  <li key={i} className="text-slate-700">
                    • {alerta}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Card Principal - Sistema Recomendado */}
      <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-blue-50">
        <CardHeader className="flex items-center gap-2">
          <CheckCircle className="text-green-600" size={24} />
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Sistema de {recomendacao.sistema_recomendado.potencia.total_kwp} kWp
            </h2>
            <p className="text-sm text-slate-600">Recomendação gerada inteligentemente</p>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {/* Justificativa */}
          <div className="p-4 bg-white rounded-lg border border-slate-200">
            <p className="text-sm text-slate-700 leading-relaxed">{recomendacao.justificativa}</p>
          </div>

          {/* KPIs Principais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded-lg">
              <p className="text-xs text-slate-500 font-semibold">Economia Mensal</p>
              <p className="text-xl font-bold text-slate-900 mt-1">
                R$ {recomendacao.economia_estimada.mensal.toLocaleString()}
              </p>
            </div>

            <div className="bg-white p-3 rounded-lg">
              <p className="text-xs text-slate-500 font-semibold">Economia Anual</p>
              <p className="text-xl font-bold text-green-600 mt-1">
                R$ {recomendacao.economia_estimada.anual.toLocaleString()}
              </p>
            </div>

            <div className="bg-white p-3 rounded-lg">
              <p className="text-xs text-slate-500 font-semibold">Payback</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{recomendacao.payback} anos</p>
            </div>

            <div className="bg-white p-3 rounded-lg">
              <p className="text-xs text-slate-500 font-semibold">TIR</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{recomendacao.tir}%</p>
            </div>
          </div>

          {/* Especificações do Sistema */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Módulos */}
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
              <p className="text-xs font-semibold text-slate-600 uppercase mb-2">Módulos</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Marca/Modelo</span>
                  <span className="font-medium">{recomendacao.sistema_recomendado.modulos.marca}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Potência Unitária</span>
                  <span className="font-medium">{recomendacao.sistema_recomendado.modulos.potencia}W</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Quantidade</span>
                  <span className="font-medium">{recomendacao.sistema_recomendado.modulos.quantidade}</span>
                </div>
              </div>
            </div>

            {/* Inversor */}
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-xs font-semibold text-slate-600 uppercase mb-2">Inversor</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Marca/Modelo</span>
                  <span className="font-medium">{recomendacao.sistema_recomendado.inversor.marca}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Potência</span>
                  <span className="font-medium">{recomendacao.sistema_recomendado.inversor.potencia} kW</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Tipo</span>
                  <span className="font-medium">String</span>
                </div>
              </div>
            </div>
          </div>

          {/* Configuração */}
          <div className="bg-slate-50 p-3 rounded-lg">
            <p className="text-xs font-semibold text-slate-600 uppercase mb-2">Configuração Elétrica</p>
            <div className="grid grid-cols-4 gap-2 text-sm">
              <div>
                <p className="text-xs text-slate-500">Strings</p>
                <p className="font-bold text-slate-900">{recomendacao.sistema_recomendado.configuracao.strings}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Painéis/String</p>
                <p className="font-bold text-slate-900">{recomendacao.sistema_recomendado.configuracao.paineisPorString}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">VOC Frio</p>
                <p className="font-bold text-slate-900">{recomendacao.sistema_recomendado.configuracao.voc_frio}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">VMP String</p>
                <p className="font-bold text-slate-900">{recomendacao.sistema_recomendado.configuracao.vmp_string}</p>
              </div>
            </div>
          </div>

          {/* BESS */}
          {recomendacao.sistema_recomendado.bess && (
            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200 flex items-start gap-3">
              <Battery className="text-purple-600 shrink-0" size={20} />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-slate-900">Bateria de Armazenamento Incluída</p>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <p className="text-xs text-slate-600">Capacidade</p>
                    <p className="font-bold">{recomendacao.sistema_recomendado.bess.capacidade_kwh} kWh</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Autonomia</p>
                    <p className="font-bold">{recomendacao.sistema_recomendado.bess.autonomia_horas}h</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Payback</p>
                    <p className="font-bold">{recomendacao.sistema_recomendado.bess.payback_anos} anos</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Análise */}
          <div className="bg-white border border-slate-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-slate-600 uppercase mb-2">Análise Complementar</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Validação Elétrica</span>
                <span className="font-medium">{recomendacao.analise.validacao_eletrica}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Sombreamento</span>
                <span className="font-medium">{recomendacao.analise.sombreamento}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">BESS Viável</span>
                <span className="font-medium">{recomendacao.analise.bess_viavel ? '✓ Sim' : '✗ Não'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Complexidade</span>
                <span className="font-medium">{recomendacao.analise.rating_complexidade}</span>
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <Button
              variante="primario"
              onClick={onAceitar}
              className="flex-1"
            >
              Aceitar Recomendação
            </Button>
            <Button
              variante="secundario"
              onClick={onPersonalizar}
              className="flex-1"
            >
              Personalizar Sistema
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
