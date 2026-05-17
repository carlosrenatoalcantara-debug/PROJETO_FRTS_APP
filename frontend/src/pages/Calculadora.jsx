import { useState } from 'react'
import { Sun, Zap, TrendingDown, MapPin, DollarSign } from 'lucide-react'
import Card, { CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'

const API_URL = import.meta.env.VITE_API_URL || ''

// Irradiância média por cidade brasileira (kWh/m²/dia)
const IRRADIANCIA_CIDADES = {
  'natal': 5.5, 'rio-de-janeiro': 5.2, 'salvador': 5.6, 'fortaleza': 5.4,
  'brasilia': 5.3, 'belo-horizonte': 5.1, 'sao-paulo': 5.0, 'curitiba': 4.8,
  'porto-alegre': 4.6, 'manaus': 5.2, 'belém': 5.0, 'recife': 5.4,
  'maceio': 5.5, 'aracaju': 5.5, 'joao-pessoa': 5.5
}

// Tarifa média de energia (R$ por kWh)
const TARIFA_MEDIA = 0.85

export default function Calculadora() {
  const [etapa, setEtapa] = useState(1) // 1: dados, 2: resultado
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState(null)

  const [form, setForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    cidade: 'natal',
    tipoConsumo: 'kwh', // 'kwh' ou 'reais'
    consumoMedio: '', // kWh/mês ou R$/mês
  })

  const [erros, setErros] = useState({})

  function validar() {
    const novosErros = {}
    if (!form.nome.trim()) novosErros.nome = 'Nome obrigatório'
    if (!form.email.includes('@')) novosErros.email = 'Email inválido'
    if (!form.telefone.trim()) novosErros.telefone = 'Telefone obrigatório'
    if (!form.consumoMedio || parseFloat(form.consumoMedio) <= 0) {
      novosErros.consumoMedio = form.tipoConsumo === 'kwh' ? 'Consumo inválido (kWh/mês)' : 'Valor inválido (R$/mês)'
    }
    setErros(novosErros)
    return Object.keys(novosErros).length === 0
  }

  function calcular() {
    if (!validar()) return

    // Converter para kWh se necessário
    let consumoMensalKwh = parseFloat(form.consumoMedio)
    if (form.tipoConsumo === 'reais') {
      consumoMensalKwh = consumoMensalKwh / TARIFA_MEDIA
    }

    const irradiancia = IRRADIANCIA_CIDADES[form.cidade] || 5.0

    // Cálculo do sistema necessário (Wp)
    // Sistema = (Consumo Mensal / 30 dias) / Irradiância * Fator de segurança
    const consumoDiario = consumoMensalKwh / 30
    const sistemaWp = (consumoDiario / irradiancia) * 1000 * 1.15 // 1.15 = margem de 15%
    const sistemaKwp = (sistemaWp / 1000).toFixed(2)

    // Verificar limite GDII (Microgeração = até 4kWp)
    const isicrogeração = parseFloat(sistemaKwp) <= 4
    const statusGDII = isicrogeração ? 'Microgeração' : 'Minigeração'

    // Economia anual (compensação de energia conforme GDII)
    const economiaMensal = consumoMensalKwh * TARIFA_MEDIA
    const economiaAnual = economiaMensal * 12
    const economia25anos = economiaAnual * 25

    const novoResultado = {
      sistemaKwp,
      consumoDiario: consumoDiario.toFixed(2),
      economiaMensal: economiaMensal.toFixed(2),
      economiaAnual: economiaAnual.toFixed(2),
      economia25anos: economia25anos.toFixed(2),
      statusGDII,
      consumoOriginal: form.consumoMedio,
      tipoConsumo: form.tipoConsumo,
    }

    setResultado(novoResultado)
    setEtapa(2)
    enviarDados(novoResultado)
  }

  async function enviarDados(res) {
    try {
      setCarregando(true)
      const dataEnvio = {
        ...form,
        consumoMedio: parseFloat(form.consumoMedio),
        tipoConsumo: form.tipoConsumo,
        sistemaKwp: res.sistemaKwp,
        statusGDII: res.statusGDII,
        economiaMensal: res.economiaMensal,
        economiaAnual: res.economiaAnual,
        economia25anos: res.economia25anos,
        data: new Date().toISOString(),
      }

      await fetch(`${API_URL}/api/calculadora`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataEnvio),
      })
    } catch (err) {
      console.error('Erro ao enviar dados:', err)
    } finally {
      setCarregando(false)
    }
  }

  // ─────────────────────────────────────────────────────────

  if (etapa === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Sun className="text-orange-500" size={32} />
              <h1 className="text-4xl font-bold text-slate-900">Calculadora Solar</h1>
            </div>
            <p className="text-lg text-slate-600">
              Descubra quanto você pode economizar com energia solar
            </p>
          </div>

          {/* Form */}
          <Card className="shadow-xl">
            <CardBody className="space-y-6">

              {/* Dados Pessoais */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Seus Dados</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Nome</label>
                    <input
                      type="text"
                      value={form.nome}
                      onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      placeholder="Seu nome completo"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {erros.nome && <p className="text-red-500 text-xs mt-1">{erros.nome}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="seu@email.com"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {erros.email && <p className="text-red-500 text-xs mt-1">{erros.email}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Telefone</label>
                    <input
                      type="tel"
                      value={form.telefone}
                      onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                      placeholder="(84) 99999-9999"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {erros.telefone && <p className="text-red-500 text-xs mt-1">{erros.telefone}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Cidade</label>
                    <select
                      value={form.cidade}
                      onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="natal">Natal, RN</option>
                      <option value="rio-de-janeiro">Rio de Janeiro, RJ</option>
                      <option value="salvador">Salvador, BA</option>
                      <option value="fortaleza">Fortaleza, CE</option>
                      <option value="brasilia">Brasília, DF</option>
                      <option value="belo-horizonte">Belo Horizonte, MG</option>
                      <option value="sao-paulo">São Paulo, SP</option>
                      <option value="curitiba">Curitiba, PR</option>
                      <option value="porto-alegre">Porto Alegre, RS</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Consumo */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Consumo de Energia</h3>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    💡 <strong>Dica:</strong> Confira sua conta de energia para o valor mensal ou consumo em kWh
                  </p>
                </div>

                {/* Toggle entre kWh e R$ */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setForm({ ...form, tipoConsumo: 'kwh' })}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                      form.tipoConsumo === 'kwh'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    kWh/mês
                  </button>
                  <button
                    onClick={() => setForm({ ...form, tipoConsumo: 'reais' })}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                      form.tipoConsumo === 'reais'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    R$/mês
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {form.tipoConsumo === 'kwh' ? 'Consumo Mensal (kWh)' : 'Conta Mensal (R$)'}
                  </label>
                  <div className="relative">
                    <Zap className="absolute left-3 top-3 text-slate-400" size={20} />
                    <input
                      type="number"
                      value={form.consumoMedio}
                      onChange={(e) => setForm({ ...form, consumoMedio: e.target.value })}
                      placeholder={form.tipoConsumo === 'kwh' ? 'Ex: 250' : 'Ex: 200'}
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                    />
                  </div>
                  {erros.consumoMedio && <p className="text-red-500 text-xs mt-1">{erros.consumoMedio}</p>}
                </div>
              </div>

              {/* Botão */}
              <Button
                onClick={calcular}
                className="w-full bg-gradient-to-r from-blue-600 to-orange-500 text-white font-semibold py-4 rounded-lg text-lg hover:shadow-lg transition-all"
              >
                Calcular Economia 🔆
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────
  // RESULTADO
  // ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-full mb-4">
            <TrendingDown size={20} />
            <span className="font-semibold">Resultado da Simulação</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Você pode economizar <span className="text-green-600">R$ {parseFloat(resultado.economiaAnual).toLocaleString('pt-BR')}</span> por ano!
          </h1>
          <p className="text-lg text-slate-600">
            Em 25 anos: <strong className="text-green-600">R$ {parseFloat(resultado.economia25anos).toLocaleString('pt-BR')}</strong>
          </p>
        </div>

        {/* Resultados */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Sistema */}
          <Card className="bg-white shadow-lg">
            <CardBody className="text-center">
              <Sun className="mx-auto text-orange-500 mb-3" size={32} />
              <p className="text-slate-600 text-sm mb-2">Sistema Necessário</p>
              <p className="text-4xl font-bold text-slate-900">{resultado.sistemaKwp} kWp</p>
              <p className="text-xs text-slate-500 mt-2">~{Math.round(resultado.sistemaKwp / 0.4)} painéis de 400W</p>
            </CardBody>
          </Card>

          {/* Economia Mensal */}
          <Card className="bg-white shadow-lg">
            <CardBody className="text-center">
              <DollarSign className="mx-auto text-green-600 mb-3" size={32} />
              <p className="text-slate-600 text-sm mb-2">Economia Mensal</p>
              <p className="text-4xl font-bold text-slate-900">R$ {parseFloat(resultado.economiaMensal).toLocaleString('pt-BR')}</p>
              <p className="text-xs text-slate-500 mt-2">em sua conta de energia</p>
            </CardBody>
          </Card>

          {/* GDII */}
          <Card className="bg-white shadow-lg">
            <CardBody className="text-center">
              <MapPin className="mx-auto text-green-600 mb-3" size={32} />
              <p className="text-slate-600 text-sm mb-2">Classificação GDII</p>
              <p className="text-2xl font-bold text-slate-900">{resultado.statusGDII}</p>
              <p className="text-xs text-slate-500 mt-2">{parseFloat(resultado.sistemaKwp) <= 4 ? '≤ 4 kWp' : '> 4 kWp'}</p>
            </CardBody>
          </Card>

          {/* Consumo Diário */}
          <Card className="bg-white shadow-lg">
            <CardBody className="text-center">
              <Zap className="mx-auto text-yellow-600 mb-3" size={32} />
              <p className="text-slate-600 text-sm mb-2">Consumo Diário</p>
              <p className="text-4xl font-bold text-slate-900">{resultado.consumoDiario} kWh</p>
              <p className="text-xs text-slate-500 mt-2">por dia</p>
            </CardBody>
          </Card>
        </div>

        {/* Info GDII */}
        <Card className="bg-blue-50 border border-blue-200 mb-8">
          <CardBody>
            <h3 className="font-semibold text-blue-900 mb-3">📋 Informações GDII</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>✅ Seu sistema está enquadrado em <strong>{resultado.statusGDII}</strong> conforme Resolução ANEEL</li>
              <li>⚡ Compensação de energia conforme sistema de créditos da GDII</li>
              <li>📞 Entraremos em contato para análise técnica e documentação</li>
              <li>💰 Financiamento disponível com taxas especiais para energia solar</li>
            </ul>
          </CardBody>
        </Card>

        {/* Botões */}
        <div className="flex gap-4">
          <Button
            onClick={() => {
              setEtapa(1)
              setResultado(null)
            }}
            variante="secundario"
            className="flex-1 py-3"
          >
            Nova Simulação
          </Button>
          <Button
            onClick={() => window.location.href = 'https://www.fortesolar.com.br'}
            className="flex-1 bg-gradient-to-r from-blue-600 to-orange-500 text-white py-3"
          >
            Voltar ao Site
          </Button>
        </div>
      </div>
    </div>
  )
}
