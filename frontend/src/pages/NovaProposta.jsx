import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { X, MapPin, Zap, Sun, Wrench, DollarSign, FileText, CheckCircle, Download, Info, Trash2 } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Stepper from '../components/ui/Stepper'
import MapaTelhado from '../components/fv/MapaTelhado'
import Input from '../components/ui/Input'
import SeletorAutomaticoKits from '../components/fv/SeletorAutomaticoKits'
import ModalBeneficiaria from '../components/fv/ModalBeneficiaria'
import { calcularDimensionamentoAuto, selecionarKitsAuto, gerarOrcamentoAuto } from '../services/calcAutoMatico'
import { gerarUnifilarSVG } from '../utils/gerarUnifilarSVG'
import { gerarPropostaPDF, abrirOuBaixarProposta } from '../utils/gerarPropostaPDF'
import { obterIrradianciaCity, obterIrradianciaFallback } from '../data/irradianciaRN.js'
import NovaPropostaV2 from './NovaPropostaV2'  // S2 — funil v2 (atrás da flag ?wizard=v2)

const ETAPAS = [
  { num: 1, rotulo: 'Localização', icone: MapPin },
  { num: 2, rotulo: 'Unidades', icone: Zap },
  { num: 3, rotulo: 'Kit Gerador', icone: Sun },
  { num: 4, rotulo: 'Pré-Dimensionamento', icone: Wrench },
  { num: 5, rotulo: 'Irradiância', icone: Sun },
  { num: 6, rotulo: 'Dimensionamento', icone: Zap },
  { num: 7, rotulo: 'Orçamento', icone: DollarSign },
  { num: 8, rotulo: 'Proposta', icone: FileText },
]

function Etapa1Localizacao({ dados, setDados, proxima }) {
  const [areaDesenhada, setAreaDesenhada] = useState(null)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Localização + Mapa</h2>
        <p className="text-sm text-slate-500 mt-1">Desenhe a área de telhado disponível no mapa</p>
      </div>

      <Card>
        <CardHeader>Endereço</CardHeader>
        <CardBody className="space-y-3">
          <Input
            rotulo="Endereço do cliente"
            value={dados.endereco || ''}
            onChange={(e) => setDados({ ...dados, endereco: e.target.value })}
            placeholder="Digite o endereço ou deixe o auto-preenchido"
          />
          <p className="text-xs text-slate-500">
            Latitude: {dados.latitude?.toFixed(6) || '—'} | Longitude: {dados.longitude?.toFixed(6) || '—'}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>Google Maps - Desenhe o telhado</CardHeader>
        <CardBody>
          <MapaTelhado
            endereco={dados.endereco}
            latitude={dados.latitude}
            longitude={dados.longitude}
            onSave={(dadosTelhado) => {
              setDados({
                ...dados,
                endereco: dadosTelhado.endereco || dados.endereco,
                latitude: dadosTelhado.latitude ?? null,
                longitude: dadosTelhado.longitude ?? null,
                areaDisponivel: dadosTelhado.area_m2,
                geocoding_origem: dadosTelhado.geocoding_origem ?? dados.geocoding_origem ?? null,
                geocoding_confianca: dadosTelhado.geocoding_confianca ?? dados.geocoding_confianca ?? null,
                geocodificado_em: dadosTelhado.geocodificado_em ?? dados.geocodificado_em ?? null,
              })
              setAreaDesenhada(true)
            }}
          />
          {areaDesenhada && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-800">
              ✓ Área desenhada: {dados.areaDisponivel} m²
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex justify-end gap-3">
        <Button onClick={proxima} disabled={!areaDesenhada}>
          Próxima →
        </Button>
      </div>
    </div>
  )
}

function Etapa2Unidades({ dados, setDados, proxima, anterior }) {
  const [beneficiarias, setBeneficiarias] = useState(dados.beneficiarias || [])
  const [dimensionamento, setDimensionamento] = useState(null)
  const [modalAberta, setModalAberta] = useState(false)

  // Auto-populate com dados extraídos da fatura
  useEffect(() => {
    if (dados.consumo && dados.irradiancia && !dimensionamento) {
      const dim = calcularDimensionamentoAuto(Number(dados.consumo), dados.irradiancia)
      setDimensionamento(dim)
      setDados(prev => ({ ...prev, dimensionamento: dim }))
    }
  }, [dados.consumo, dados.irradiancia])

  // Auto-definir GD2 como padrão
  useEffect(() => {
    if (!dados.gd) {
      setDados(prev => ({ ...prev, gd: 'gd2' }))
    }
  }, [])

  // Sincronizar beneficiárias com dados
  useEffect(() => {
    setDados(prev => ({ ...prev, beneficiarias }))
  }, [beneficiarias])

  const handleAdicionarBeneficiaria = (nova) => {
    setBeneficiarias(prev => [...prev, { ...nova, id: Date.now() }])
    setModalAberta(false)
  }

  const handleRemoverBeneficiaria = (id) => {
    setBeneficiarias(prev => prev.filter(b => b.id !== id))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Unidades Consumidoras</h2>
        <p className="text-sm text-slate-500 mt-1">Configure a unidade geradora e beneficiárias</p>
      </div>

      {/* Mostrar dados extraídos da fatura */}
      {(dados.consumo || dados.tarifa || dados.fase) && (
        <Card>
          <CardHeader className="flex items-center gap-2">
            <Info size={18} className="text-blue-600" />
            <span>Dados Extraídos da Fatura</span>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {dados.consumo && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-xs text-slate-600">Consumo Médio</p>
                  <p className="text-lg font-bold text-blue-700">{dados.consumo} kWh</p>
                </div>
              )}
              {dados.tarifa && (
                <div className="p-3 bg-green-50 border border-green-200 rounded">
                  <p className="text-xs text-slate-600">Tarifa</p>
                  <p className="text-lg font-bold text-green-700">R$ {dados.tarifa.toFixed(5)}</p>
                </div>
              )}
              {dados.fase && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded">
                  <p className="text-xs text-slate-600">Fase</p>
                  <p className="text-lg font-bold text-purple-700">{dados.fase}</p>
                </div>
              )}
              {dados.irradiancia && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                  <p className="text-xs text-slate-600">Irradiância</p>
                  <p className="text-lg font-bold text-amber-700">{dados.irradiancia.toFixed(2)} kWh/m²</p>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>Unidade Geradora</CardHeader>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Regra GD</label>
              <select className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" value={dados.gd || ''} onChange={(e) => setDados({ ...dados, gd: e.target.value })}>
                <option value="">Selecione</option>
                <option value="gd1">GD I</option>
                <option value="gd2">GD II</option>
                <option value="gd3">GD III</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Grupo Tarifário</label>
              <select className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" value={dados.grupo || ''} onChange={(e) => setDados({ ...dados, grupo: e.target.value })}>
                <option value="">Selecione</option>
                <option value="A">Grupo A</option>
                <option value="B">Grupo B</option>
              </select>
            </div>
            <Input rotulo="Consumo (kWh)" type="number" placeholder="350" value={dados.consumo || ''} onChange={(e) => setDados({ ...dados, consumo: Number(e.target.value) || '' })} />
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Fase</label>
              <select className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" value={dados.fase || ''} onChange={(e) => setDados({ ...dados, fase: e.target.value })}>
                <option value="">Selecione</option>
                <option value="Monofásico">Monofásico (1Ø)</option>
                <option value="Bifásico">Bifásico (2Ø)</option>
                <option value="Trifásico">Trifásico (3Ø)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Tensão (V)</label>
              <select className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" value={dados.tensao || ''} onChange={(e) => setDados({ ...dados, tensao: e.target.value })}>
                <option value="">Selecione</option>
                <option value="127">127V</option>
                <option value="220">220V</option>
                <option value="380">380V</option>
              </select>
            </div>
            <Input rotulo="Tarifa (R$)" type="number" placeholder="1.50" value={dados.tarifa || ''} onChange={(e) => setDados({ ...dados, tarifa: Number(e.target.value) || '' })} />
          </div>
        </CardBody>
      </Card>

      {dimensionamento && (
        <Card>
          <CardHeader>📊 Dimensionamento Calculado Automaticamente</CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-xs text-slate-600">Consumo Diário</p>
                <p className="text-lg font-bold text-blue-600">{dimensionamento.consumoDiario} kWh</p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-xs text-slate-600">Potência Ideal</p>
                <p className="text-lg font-bold text-blue-600">{dimensionamento.potenciaIdealkWp} kWp</p>
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-xs text-slate-600">Potência Recomendada</p>
                <p className="text-lg font-bold text-green-600">{dimensionamento.potenciaArredondada} kWp</p>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded">
                <p className="text-xs text-slate-600">Economia/ano</p>
                <p className="text-lg font-bold text-emerald-600">R$ {Number(dimensionamento.economiaAnual).toLocaleString('pt-BR')}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <p className="text-xs text-slate-600">Painéis</p>
                <p className="text-lg font-bold">{dimensionamento.numPaineis}</p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <p className="text-xs text-slate-600">Inversores</p>
                <p className="text-lg font-bold">{dimensionamento.numInversores}</p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <p className="text-xs text-slate-600">Strings</p>
                <p className="text-lg font-bold">{dimensionamento.numStrings}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader className="flex items-center justify-between">
          <span>Beneficiárias</span>
          <Button tamanho="sm" onClick={() => setModalAberta(true)}>+ Adicionar</Button>
        </CardHeader>
        <CardBody>
          {beneficiarias.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma beneficiária adicionada</p>
          ) : (
            <div className="space-y-2">
              {beneficiarias.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{b.contaContrato}</p>
                    <p className="text-xs text-slate-600">
                      {b.tipoRateio === 'percentual' ? `${b.valor}%` : `R$ ${b.valor.toFixed(2)}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoverBeneficiaria(b.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex justify-between gap-3">
        <Button variante="secundario" onClick={anterior}>← Anterior</Button>
        <Button onClick={proxima} disabled={!dados.consumo || dados.consumo <= 0 || !dimensionamento}>
          Próxima →
        </Button>
      </div>

      {!dados.consumo || dados.consumo <= 0 ? (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
          ⚠️ Preencha o consumo ({'>'}0) para prosseguir
        </div>
      ) : null}

      {modalAberta && (
        <ModalBeneficiaria
          onAdicionarBeneficiaria={handleAdicionarBeneficiaria}
          onClose={() => setModalAberta(false)}
          beneficiarias={beneficiarias}
        />
      )}
    </div>
  )
}

function Etapa3KitGerador({ dados, setDados, proxima, anterior }) {
  const [tipoKitgerador, setTipoKit] = useState('disponivel')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Kit Gerador</h2>
        <p className="text-sm text-slate-500 mt-1">Escolha ou configure o sistema</p>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-3 p-4 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-blue-500"
          style={{borderColor: tipoKitgerador === 'disponivel' ? '#3b82f6' : 'inherit'}}>
          <input
            type="radio"
            name="tipoKit"
            value="disponivel"
            checked={tipoKitgerador === 'disponivel'}
            onChange={(e) => setTipoKit(e.target.value)}
          />
          <div>
            <p className="font-medium text-slate-900">Usar kit disponível</p>
            <p className="text-xs text-slate-500">Integração com SolarMarket ou catálogo</p>
          </div>
        </label>

        <label className="flex items-center gap-3 p-4 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-blue-500"
          style={{borderColor: tipoKitgerador === 'manual' ? '#3b82f6' : 'inherit'}}>
          <input
            type="radio"
            name="tipoKit"
            value="manual"
            checked={tipoKitgerador === 'manual'}
            onChange={(e) => setTipoKit(e.target.value)}
          />
          <div>
            <p className="font-medium text-slate-900">Criar do zero</p>
            <p className="text-xs text-slate-500">Configurar manualmente com equipamentos</p>
          </div>
        </label>
      </div>

      {tipoKitgerador === 'disponivel' && dados.dimensionamento && (
        <SeletorAutomaticoKits
          potenciakWp={dados.dimensionamento.potenciaArredondada}
          onSelecionarKit={(dadosKit) => {
            setDados(prev => ({
              ...prev,
              kitSelecionado: dadosKit.kit,
              orcamento: dadosKit.orcamento,
            }))
          }}
        />
      )}

      {tipoKitgerador === 'manual' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>Configuração do Kit</CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Sistema</label>
                  <select className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecione</option>
                    <option value="on-grid">On Grid</option>
                    <option value="hibrido">Híbrido</option>
                    <option value="off-grid">Off Grid</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Topologia</label>
                  <select className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecione</option>
                    <option value="tradicional">Tradicional</option>
                    <option value="otimizador">Otimizador</option>
                    <option value="microinversor">Microinversor</option>
                  </select>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>Módulo Fotovoltaico</CardHeader>
            <CardBody className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Marca</label>
                  <select className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecione</option>
                    <option value="jinko">Jinko Solar</option>
                    <option value="canadian">Canadian Solar</option>
                    <option value="trina">Trina Solar</option>
                    <option value="bifocal">Bifocal</option>
                    <option value="ja">JA Solar</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Modelo</label>
                  <select className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecione</option>
                    <option value="jkm">JKM 400M</option>
                    <option value="jkm350">JKM 350M</option>
                    <option value="jkm330">JKM 330M</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Potência (Wp)</label>
                  <select className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecione</option>
                    <option value="300">300 W</option>
                    <option value="330">330 W</option>
                    <option value="350">350 W</option>
                    <option value="400">400 W</option>
                    <option value="410">410 W</option>
                    <option value="450">450 W</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Quantidade</label>
                <input type="number" placeholder="Ex: 30" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>Inversor</CardHeader>
            <CardBody className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Marca</label>
                  <select className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecione</option>
                    <option value="fronius">Fronius</option>
                    <option value="sma">SMA</option>
                    <option value="growatt">Growatt</option>
                    <option value="deye">Deye</option>
                    <option value="huawei">Huawei</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Modelo</label>
                  <select className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecione</option>
                    <option value="fronius-25">Fronius Symo 25.0</option>
                    <option value="sma-20">SMA STP 20000</option>
                    <option value="growatt-10">Growatt 10000</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Potência (kW)</label>
                  <select className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecione</option>
                    <option value="5">5 kW</option>
                    <option value="10">10 kW</option>
                    <option value="15">15 kW</option>
                    <option value="20">20 kW</option>
                    <option value="25">25 kW</option>
                  </select>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      <div className="flex justify-between gap-3">
        <Button variante="secundario" onClick={anterior}>← Anterior</Button>
        <Button onClick={proxima} disabled={!dados.kitSelecionado || !dados.orcamento}>
          Próxima →
        </Button>
      </div>

      {(!dados.kitSelecionado || !dados.orcamento) && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
          ⚠️ Selecione um kit para prosseguir
        </div>
      )}
    </div>
  )
}

function Etapa4PreDimensionamento({ dados, setDados, proxima, anterior }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Pré-Dimensionamento</h2>
        <p className="text-sm text-slate-500 mt-1">Potência sugerida baseada no consumo</p>
      </div>

      <Card>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded">
              <p className="text-xs text-slate-600">Consumo Titular</p>
              <p className="text-xl font-bold text-amber-700">350 kWh</p>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-xs text-slate-600">Beneficiárias</p>
              <p className="text-xl font-bold text-blue-700">200 kWh</p>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded">
              <p className="text-xs text-slate-600">TOTAL</p>
              <p className="text-xl font-bold text-emerald-700">550 kWh</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mt-3">
            Potência sugerida: <strong>15 kWp</strong> (baseado em irradiância regional)
          </p>
        </CardBody>
      </Card>

      <div className="flex justify-between gap-3">
        <Button variante="secundario" onClick={anterior}>← Anterior</Button>
        <Button onClick={proxima}>Próxima →</Button>
      </div>
    </div>
  )
}

function Etapa5Irradiancia({ dados, setDados, proxima, anterior }) {
  const [irradianciaCustom, setIrradianciaCustom] = useState(dados.irradiancia || 5.5)
  const [fonte, setFonte] = useState('extraida')

  useEffect(() => {
    setDados(prev => ({ ...prev, irradiancia: irradianciaCustom }))
  }, [irradianciaCustom])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Irradiância Solar</h2>
        <p className="text-sm text-slate-500 mt-1">Dados precisos para sua localização exata</p>
      </div>

      <Card>
        <CardBody className="space-y-3">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-900">
              <strong>Irradiância em {dados.endereco || 'localização não definida'}:</strong> <br />
              <strong className="text-lg">{irradianciaCustom.toFixed(2)} kWh/m²/dia</strong>
            </p>
            <p className="text-xs text-blue-800 mt-2">
              Localização: {dados.latitude != null ? dados.latitude.toFixed(4) : 'não definida'} / {dados.longitude != null ? dados.longitude.toFixed(4) : 'não definida'}
            </p>
            <p className="text-xs text-blue-700 mt-1 font-medium">
              Fonte: {fonte === 'extraida' ? '📍 Extraída da cidade (base de dados CRESESB)' : '🔄 Ajustada manualmente'}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">Ajustar Irradiância (se necessário)</label>
            <div className="flex gap-2 items-center">
              <input
                type="range"
                min="3"
                max="8"
                step="0.1"
                value={irradianciaCustom}
                onChange={(e) => {
                  setIrradianciaCustom(Number(e.target.value))
                  setFonte('ajustada')
                }}
                className="flex-1"
              />
              <input
                type="number"
                min="3"
                max="8"
                step="0.1"
                value={irradianciaCustom}
                onChange={(e) => {
                  setIrradianciaCustom(Number(e.target.value))
                  setFonte('ajustada')
                }}
                className="w-20 px-2 py-1 rounded border border-slate-300"
              />
              <span className="text-xs text-slate-500">kWh/m²/dia</span>
            </div>
          </div>
          <div className="bg-slate-50 p-3 rounded border border-slate-200">
            <p className="text-xs text-slate-600 font-mono">Fonte: NASA POWER Climatology API</p>
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-between gap-3">
        <Button variante="secundario" onClick={anterior}>← Anterior</Button>
        <Button onClick={proxima}>Próxima →</Button>
      </div>
    </div>
  )
}

function Etapa6Dimensionamento({ dados, setDados, proxima, anterior }) {
  const [unifilarSVG, setUnifilarSVG] = useState(null)

  useEffect(() => {
    if (dados.dimensionamento && dados.fase) {
      const svg = gerarUnifilarSVG({
        nome: dados.nomeProjeto || 'Proposta FV',
        nomeCliente: dados.clienteId || 'Cliente',
        dimensionamento: dados.dimensionamento,
        tipo_ligacao: dados.fase,
        tensao: dados.tensao,
        distribuidora: dados.distribuidora || 'Concessionária',
        painel: dados.kitSelecionado?.paineis || dados.kitSelecionado?.painel || null,
        inversor: dados.kitSelecionado?.inversor || null,
      })
      setUnifilarSVG(svg)
      setDados(prev => ({ ...prev, unifilar: svg }))
    }
  }, [dados.dimensionamento, dados.fase, dados.kitSelecionado])

  const downloadUnifilar = () => {
    if (!unifilarSVG) return
    const blob = new Blob([unifilarSVG], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'unifilar-sistema-fv.svg'
    a.click()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Dimensionamento Final + Unifilar</h2>
        <p className="text-sm text-slate-500 mt-1">Diagrama técnico do sistema gerado automaticamente</p>
      </div>

      {dados.dimensionamento && (
        <Card>
          <CardHeader>Resultado do Dimensionamento</CardHeader>
          <CardBody className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-xs text-slate-600">Painéis</p>
              <p className="text-2xl font-bold text-blue-700">{dados.dimensionamento.numPaineis} un</p>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-xs text-slate-600">Inversores</p>
              <p className="text-2xl font-bold text-blue-700">{dados.dimensionamento.numInversores} un</p>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-xs text-slate-600">Strings</p>
              <p className="text-2xl font-bold text-blue-700">{dados.dimensionamento.numStrings}</p>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <p className="text-xs text-slate-600">Potência</p>
              <p className="text-2xl font-bold text-green-700">{dados.dimensionamento.potenciaArredondada} kWp</p>
            </div>
          </CardBody>
        </Card>
      )}

      {unifilarSVG && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <span>Diagrama Unifilar</span>
            <Button tamanho="sm" icone={Download} onClick={downloadUnifilar}>
              Baixar SVG
            </Button>
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto border border-slate-200 rounded bg-white">
              <div dangerouslySetInnerHTML={{ __html: unifilarSVG }} />
            </div>
          </CardBody>
        </Card>
      )}

      <div className="flex justify-between gap-3">
        <Button variante="secundario" onClick={anterior}>← Anterior</Button>
        <Button onClick={proxima}>Próxima →</Button>
      </div>
    </div>
  )
}

function Etapa7Orcamento({ dados, setDados, proxima, anterior }) {
  const [margemLucro, setMargemLucro] = useState(20)
  const [gerando, setGerando] = useState(false)

  // Se nenhum kit foi selecionado mas há dimensionamento, auto-gera balanceado
  const orcamento = (() => {
    if (dados.orcamento) return dados.orcamento
    if (dados.dimensionamento?.potenciaArredondada) {
      const kits = selecionarKitsAuto(dados.dimensionamento.potenciaArredondada)
      const kit = kits.find(k => k.tag === 'balanceado') || kits[0]
      if (kit) {
        const orc = gerarOrcamentoAuto(kit)
        setDados(prev => ({ ...prev, orcamento: orc, kitSelecionado: kit }))
        return orc
      }
    }
    return { itens: [], subtotal: 0, margem: { percentual: margemLucro, valor: 0 }, total: 0, precoWp: 0 }
  })()

  const gerarPDF = async () => {
    if (!dados.orcamento || !dados.dimensionamento) {
      alert('Faltam dados para gerar proposta')
      return
    }

    setGerando(true)
    try {
      const htmlProposta = gerarPropostaPDF({
        cliente: {
          nome: dados.clienteId,
          endereco: dados.endereco,
          coordenadas: { lat: dados.latitude, lng: dados.longitude },
        },
        sistema: {
          potenciakWp: dados.dimensionamento.potenciaArredondada,
          numPaineis: dados.dimensionamento.numPaineis,
          numInversores: dados.dimensionamento.numInversores,
          economiaAnual: dados.dimensionamento.economiaAnual,
          payback: dados.dimensionamento.payback,
          consumoDiario: dados.dimensionamento.consumoDiario,
        },
        orcamento: dados.orcamento,
        unifilar: dados.unifilar,
        empresa: {
          nome: 'Forte Solar',
          cnpj: '00.000.000/0000-00',
          telefone: '(84) 9999-9999',
          email: 'contato@fortesolar.com.br',
        },
      })

      setDados(prev => ({ ...prev, htmlProposta }))
      abrirOuBaixarProposta(htmlProposta)
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
      alert('Erro ao gerar proposta')
    } finally {
      setGerando(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Orçamento Detalhado</h2>
        <p className="text-sm text-slate-500 mt-1">Breakdown completo dos custos</p>
      </div>

      {orcamento.itens.length > 0 ? (
        <Card>
          <CardBody>
            <div className="space-y-2">
              {orcamento.itens.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 border-b">
                  <span className="text-sm text-slate-700">{item.descricao}</span>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">R$ {Math.round(item.valor).toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-slate-500">{item.percentual}%</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-4 bg-slate-900 text-white rounded">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Margem de Lucro ({orcamento.margem.percentual}%)</span>
                <p className="font-semibold">R$ {Math.round(orcamento.margem.valor).toLocaleString('pt-BR')}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">TOTAL DO INVESTIMENTO</span>
                <p className="text-2xl font-bold">R$ {Math.round(orcamento.total).toLocaleString('pt-BR')}</p>
              </div>
              <p className="text-xs text-slate-300 mt-2">R$ {orcamento.precoWp}/Wp</p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="text-center py-8">
            <p className="text-slate-600 mb-4">Selecione um kit na Etapa 3 para ver o orçamento</p>
          </CardBody>
        </Card>
      )}

      <div className="flex justify-between gap-3">
        <Button variante="secundario" onClick={anterior}>← Anterior</Button>
        <Button onClick={gerarPDF} disabled={gerando || !orcamento.total} className="flex-1">
          {gerando ? '⏳ Gerando...' : '📄 Gerar Proposta PDF'}
        </Button>
      </div>
    </div>
  )
}

function Etapa8Proposta({ dados, anterior }) {
  const [gerando, setGerando] = useState(false)
  const [propostaBaixada, setPropostaBaixada] = useState(false)

  const handleGerarProposta = async () => {
    try {
      setGerando(true)
      const htmlProposta = gerarPropostaPDF(dados)
      abrirOuBaixarProposta(htmlProposta, `Proposta-${dados.nomeProjeto || 'SolarFV'}-${new Date().toLocaleDateString('pt-BR')}`)
      setPropostaBaixada(true)
    } catch (err) {
      console.error('Erro ao gerar proposta:', err)
      alert('Erro ao gerar proposta. Verifique o console.')
    } finally {
      setGerando(false)
    }
  }

  const resumoCompleto = () => {
    const dim = dados.dimensionamento
    const orc = dados.orcamento
    if (!dim || !orc) return null

    return {
      potencia: `${dim.potenciaArredondada} kWp`,
      paineis: dim.numPaineis,
      inversores: dim.numInversores,
      economia: `R$ ${Number(dim.economiaAnual).toLocaleString('pt-BR')}/ano`,
      payback: `${dim.payback} anos`,
      investimento: `R$ ${Math.round(orc.total).toLocaleString('pt-BR')}`,
      precoWp: `R$ ${orc.precoWp}/Wp`,
    }
  }

  const resumo = resumoCompleto()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Resumo da Proposta</h2>
        <p className="text-sm text-slate-500 mt-1">Confira os dados finais e gere o PDF</p>
      </div>

      {resumo ? (
        <>
          <Card>
            <CardHeader>Sistema Fotovoltaico</CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-xs text-slate-600">Potência</p>
                  <p className="text-lg font-bold text-blue-700">{resumo.potencia}</p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-xs text-slate-600">Painéis</p>
                  <p className="text-lg font-bold text-blue-700">{resumo.paineis} un</p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-xs text-slate-600">Inversores</p>
                  <p className="text-lg font-bold text-blue-700">{resumo.inversores} un</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>Análise Financeira</CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-3 bg-green-50 border border-green-200 rounded">
                  <p className="text-xs text-slate-600">Economia/Ano</p>
                  <p className="text-lg font-bold text-green-700">{resumo.economia}</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                  <p className="text-xs text-slate-600">Payback</p>
                  <p className="text-lg font-bold text-amber-700">{resumo.payback}</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <p className="text-xs text-slate-600">Preço/Wp</p>
                  <p className="text-lg font-bold">{resumo.precoWp}</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>Investimento Total</CardHeader>
            <CardBody>
              <div className="p-4 bg-slate-900 text-white rounded text-center">
                <p className="text-sm text-slate-300 mb-1">Valor Total do Sistema</p>
                <p className="text-4xl font-bold">{resumo.investimento}</p>
              </div>
            </CardBody>
          </Card>

          {propostaBaixada && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded text-center">
              <p className="text-emerald-700 font-semibold">✅ Proposta PDF gerada com sucesso!</p>
              <p className="text-sm text-emerald-600">O arquivo foi aberto em uma nova aba</p>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardBody className="text-center py-8">
            <p className="text-slate-600 mb-4">Preencha todas as etapas anteriores para ver o resumo</p>
          </CardBody>
        </Card>
      )}

      <div className="flex justify-between gap-3">
        <Button variante="secundario" onClick={anterior}>← Anterior</Button>
        <Button
          onClick={handleGerarProposta}
          disabled={gerando || !resumo}
          className="flex-1 flex items-center justify-center gap-2"
        >
          {gerando ? (
            <>⏳ Gerando...</>
          ) : propostaBaixada ? (
            <>✅ Proposta Gerada</>
          ) : (
            <>📄 Gerar Proposta PDF</>
          )}
        </Button>
      </div>
    </div>
  )
}

export default function NovaProposta() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // ─── S2: Feature flag ?wizard=v2 ─────────────────────────────────────────
  // Quando ?wizard=v2 estiver presente, renderiza o funil v2 (S2+).
  // Sem o param, fluxo legado abaixo é preservado 100% intacto.
  if (searchParams.get('wizard') === 'v2') {
    return <NovaPropostaV2 />
  }
  // ─────────────────────────────────────────────────────────────────────────

  const clienteId = searchParams.get('clienteId')
  const leadId = searchParams.get('leadId')
  const tipoParam = searchParams.get('tipo')
  const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway. Não usar VITE_API_URL */

  const [etapa, setEtapa] = useState(1)

  // Redirecionar EV para página correta
  useEffect(() => {
    if (tipoParam === 'ev') {
      navigate(`/propostas-ev/nova${clienteId ? `?clienteId=${clienteId}` : ''}`, { replace: true })
    }
  }, [tipoParam, clienteId, navigate])
  const [nomeCliente, setNomeCliente] = useState('')
  const [dados, setDados] = useState({
    clienteId,
    endereco: '',
    latitude: null,
    longitude: null,
    geocoding_origem: null,
    geocoding_confianca: null,
    geocodificado_em: null,
    irradiancia: 5.5,
    areaDisponivel: null,
    gd: '',
    grupo: '',
    consumo: '',
    fase: '',
    tensao: '',
    tarifa: '',
    dimensionamento: null,
    kitSelecionado: null,
    orcamento: null,
    unifilar: null,
    htmlProposta: null,
  })

  useEffect(() => {
    if (leadId) {
      // Carregar dados do lead do CRM
      async function carregarLead() {
        try {
          const res = await fetch(`${API_URL}/api/crm/leads/${leadId}`)
          const lead = await res.json()

          console.log('Lead carregado:', lead)

          setNomeCliente(lead.nome)
          setDados(prev => ({
            ...prev,
            endereco: lead.endereco || `${lead.cidade || ''}, ${lead.estado || ''}`.trim(),
            latitude: lead.latitude != null ? Number(lead.latitude) : null,
            longitude: lead.longitude != null ? Number(lead.longitude) : null,
            geocoding_origem: lead.latitude != null && lead.longitude != null ? 'crm_lead' : null,
            geocoding_confianca: lead.latitude != null && lead.longitude != null ? 1 : null,
            geocodificado_em: lead.latitude != null && lead.longitude != null ? new Date().toISOString() : null,
          }))
        } catch (err) {
          console.error('Erro ao carregar lead:', err)
        }
      }
      carregarLead()
    } else if (clienteId) {
      // Carregar dados do cliente (existente)
      async function carregarCliente() {
        try {
          const res = await fetch(`${API_URL}/api/clientes/${clienteId}`)
          const cliente = await res.json()

          console.log('Cliente carregado:', cliente)

          // Extrair dados da fatura se disponíveis
          const cidade = cliente.cidade || ''
          const estado = cliente.estado || ''

          // Lookup de irradiância pela cidade
          const irradiaciaCity = obterIrradianciaCity(cidade, estado)
          const irradiancia = irradiaciaCity || obterIrradianciaFallback(estado)

          // Mapear tipo_ligacao para fase
          let fase = ''
          if (cliente.tipo_ligacao) {
            if (cliente.tipo_ligacao.includes('Monofás')) fase = 'Monofásico'
            else if (cliente.tipo_ligacao.includes('Bifás')) fase = 'Bifásico'
            else if (cliente.tipo_ligacao.includes('Trifás')) fase = 'Trifásico'
          }

          // Extrair tensão do tipo_ligacao
          let tensao = '220'
          if (cliente.tipo_ligacao) {
            if (cliente.tipo_ligacao.includes('127')) tensao = '127'
            else if (cliente.tipo_ligacao.includes('220')) tensao = '220'
            else if (cliente.tipo_ligacao.includes('380')) tensao = '380'
          }

          setNomeCliente(cliente.nome)
          setDados(prev => ({
            ...prev,
            endereco: cliente.endereco_completo || `${cliente.cidade || ''}, ${cliente.estado || ''}`,
            latitude: cliente.latitude != null ? parseFloat(cliente.latitude) : null,
            longitude: cliente.longitude != null ? parseFloat(cliente.longitude) : null,
            geocoding_origem: cliente.latitude != null && cliente.longitude != null ? 'cadastro_cliente' : null,
            geocoding_confianca: cliente.latitude != null && cliente.longitude != null ? 1 : null,
            geocodificado_em: cliente.latitude != null && cliente.longitude != null ? new Date().toISOString() : null,
            // Dados extraídos da fatura
            consumo: cliente.consumo_kwh ? Number(cliente.consumo_kwh) : '',
            tarifa: cliente.valor_kwh ? Number(cliente.valor_kwh) : '',
            fase: fase || '',
            tensao: tensao,
            irradiancia: irradiancia,
            grupo: cliente.classificacao ? cliente.classificacao.split(' ')[0] : '',
          }))
        } catch (err) {
          console.error('Erro ao carregar cliente:', err)
          // Sem fallback silencioso de coordenadas: o mapa abre no Brasil e o usuário ajusta.
          setDados(prev => ({
            ...prev,
            latitude: null,
            longitude: null,
            geocoding_origem: null,
            geocoding_confianca: null,
            geocodificado_em: null,
            irradiancia: obterIrradianciaFallback(''),
          }))
        }
      }

      carregarCliente()
    }
  }, [leadId, clienteId, API_URL])

  const componentes = {
    1: Etapa1Localizacao,
    2: Etapa2Unidades,
    3: Etapa3KitGerador,
    4: Etapa4PreDimensionamento,
    5: Etapa5Irradiancia,
    6: Etapa6Dimensionamento,
    7: Etapa7Orcamento,
    8: Etapa8Proposta,
  }

  const Componente = componentes[etapa]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nova Proposta</h1>
          <p className="text-sm text-slate-500 mt-1">Etapa {etapa} de 8</p>
        </div>
        <button
          onClick={() => navigate('/clientes')}
          className="p-2 rounded-lg hover:bg-slate-100"
        >
          <X size={20} className="text-slate-600" />
        </button>
      </div>

      {/* Stepper */}
      <Stepper etapaAtual={etapa} etapas={ETAPAS.map(e => ({ ...e, rotulo: e.rotulo }))} />

      {/* Conteúdo da etapa */}
      <Componente
        dados={dados}
        setDados={setDados}
        proxima={() => setEtapa(Math.min(etapa + 1, 8))}
        anterior={() => setEtapa(Math.max(etapa - 1, 1))}
      />
    </div>
  )
}
