import { useState, useEffect } from 'react'
import { Check, TrendingDown, Award, Zap } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import { selecionarKitsAuto, gerarOrcamentoAuto } from '../../services/calcAutoMatico'

export default function SeletorAutomaticoKits({ potenciakWp, onSelecionarKit }) {
  const [kits, setKits] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [selecionado, setSelecionado] = useState(null)
  const [orcamentos, setOrcamentos] = useState({})

  // Ao receber potência, gerar sugestões automáticas
  useEffect(() => {
    if (potenciakWp) {
      setCarregando(true)
      setTimeout(() => {
        const kitsGerados = selecionarKitsAuto(potenciakWp)
        setKits(kitsGerados)

        // Gerar orçamentos para cada kit
        const orcs = {}
        kitsGerados.forEach(kit => {
          orcs[kit.tag] = gerarOrcamentoAuto(kit)
        })
        setOrcamentos(orcs)
        setCarregando(false)
      }, 500)
    }
  }, [potenciakWp])

  function handleSelecionarKit(kit) {
    setSelecionado(kit.tag)
    onSelecionarKit({
      kit,
      orcamento: orcamentos[kit.tag],
    })
  }

  if (carregando) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600">Analisando opções de kits...</p>
        <div className="flex gap-1 justify-center mt-4">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
        </div>
      </div>
    )
  }

  if (kits.length === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Seleção Automática de Kits</h2>
        <p className="text-sm text-slate-500 mt-1">Sistema recomenda 3 opções otimizadas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {kits.map((kit) => (
          <Card
            key={kit.tag}
            className={`cursor-pointer transition-all border-2 ${
              selecionado === kit.tag
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 hover:border-blue-300'
            }`}
            onClick={() => handleSelecionarKit(kit)}
          >
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900">{kit.nome}</h3>
                {selecionado === kit.tag && <Check size={20} className="text-green-600" />}
              </div>
              <p className="text-xs text-slate-500">{kit.subtitulo}</p>
            </CardHeader>

            <CardBody className="space-y-4">
              {/* Ícone do tipo */}
              <div className="flex justify-center">
                {kit.tag === 'economico' && <TrendingDown size={32} className="text-amber-600" />}
                {kit.tag === 'balanceado' && <Award size={32} className="text-blue-600" />}
                {kit.tag === 'premium' && <Zap size={32} className="text-purple-600" />}
              </div>

              {/* Equipamentos */}
              <div className="space-y-2 text-xs">
                <div className="p-2 bg-slate-50 rounded">
                  <p className="text-slate-600">Painéis</p>
                  <p className="font-semibold text-slate-900">{kit.paineis.quantidade} × {kit.paineis.modelo}</p>
                  <p className="text-slate-500">R$ {kit.paineis.precoUnitario.toLocaleString('pt-BR')}/un</p>
                </div>

                <div className="p-2 bg-slate-50 rounded">
                  <p className="text-slate-600">Inversor</p>
                  <p className="font-semibold text-slate-900">{kit.inversor.modelo}</p>
                  <p className="text-slate-500">R$ {kit.inversor.precoUnitario.toLocaleString('pt-BR')}</p>
                </div>
              </div>

              {/* Preço */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-slate-600">Preço Total do Kit</p>
                <p className="text-2xl font-bold text-blue-600">
                  R$ {kit.precoTotal.toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  R$ {kit.precoUnitariokWp}/kW
                </p>
              </div>

              {/* Payback */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded">
                  <p className="text-slate-600">Payback</p>
                  <p className="font-bold text-emerald-700">{kit.payback} anos</p>
                </div>
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded">
                  <p className="text-slate-600">Economia/ano</p>
                  <p className="font-bold text-emerald-700">R$ 15k</p>
                </div>
              </div>

              {/* Badge de recomendação */}
              {kit.tag === 'balanceado' && (
                <Badge cor="azul" className="w-full text-center">
                  ⭐ Recomendado
                </Badge>
              )}

              {/* Botão */}
              <Button
                className="w-full"
                variante={selecionado === kit.tag ? 'primario' : 'secundario'}
              >
                {selecionado === kit.tag ? '✓ Selecionado' : 'Selecionar'}
              </Button>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Tabela de comparação */}
      {selecionado && (
        <Card>
          <CardHeader>Orçamento Detalhado - {kits.find(k => k.tag === selecionado)?.nome}</CardHeader>
          <CardBody>
            <div className="space-y-2 text-sm">
              {orcamentos[selecionado]?.itens.map((item, i) => (
                <div key={i} className="flex justify-between items-center p-2 border-b last:border-0">
                  <span className="text-slate-700">{item.descricao}</span>
                  <div className="text-right">
                    <p className="font-semibold">R$ {item.valor.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-slate-500">{item.percentual}%</p>
                  </div>
                </div>
              ))}

              <div className="mt-4 p-4 bg-slate-900 text-white rounded">
                <p className="text-sm opacity-75">TOTAL COM MARGEM</p>
                <p className="text-3xl font-bold">
                  R$ {orcamentos[selecionado]?.total.toLocaleString('pt-BR')}
                </p>
                <p className="text-xs opacity-75 mt-2">
                  R$ {orcamentos[selecionado]?.precoWp}/Wp
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
