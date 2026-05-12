import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapPin, Zap, Wrench, FileText, Download, Plus, X } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Stepper from '../components/ui/Stepper'
import ModalNovoCarregadorEV from '../components/equipamentos/ModalNovoCarregadorEV'
import { calcularParametrosNBR5410, validarNBR5410 } from '../services/calculosNBR5410EV'
import { gerarUnifilarEVSVG } from '../utils/gerarUnifilarEV'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001'

const ETAPAS = [
  { num: 1, rotulo: 'Localização', icone: MapPin },
  { num: 2, rotulo: 'Carregadores', icone: Zap },
  { num: 3, rotulo: 'Cálculos NBR', icone: Wrench },
  { num: 4, rotulo: 'Unifilar', icone: FileText },
]

export default function NovaPropostaEV() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const clienteId = searchParams.get('clienteId')

  const [etapa, setEtapa] = useState(1)
  const [carregadores, setCarregadores] = useState([])
  const [carregadoresDisponiveis, setCarregadoresDisponiveis] = useState([])
  const [calculos, setCalculos] = useState(null)
  const [unifilar, setUnifilar] = useState(null)
  const [modalUploadAberto, setModalUploadAberto] = useState(false)

  const [dados, setDados] = useState({
    nome_projeto: '',
    cliente_nome: '',
    endereco: '',
    latitude: null,
    longitude: null,
    carregadores: [],
    comprimento_cabo_m: 50,
    tecnico_nome: '',
    tecnico_crea: '',
  })

  // Carregar cliente se clienteId foi fornecido
  useEffect(() => {
    if (clienteId) {
      fetch(`${API_URL}/api/clientes/${clienteId}`)
        .then(r => r.json())
        .then(cliente => {
          setDados(prev => ({
            ...prev,
            cliente_nome: cliente.nome || '',
            endereco: cliente.endereco_completo || '',
          }))
        })
        .catch(console.error)
    }
  }, [clienteId])

  // Carregar carregadores disponíveis
  const carregarCarregadores = () => {
    fetch(`${API_URL}/api/carregadores-ev`)
      .then(r => r.json())
      .then(data => setCarregadoresDisponiveis(data))
      .catch(console.error)
  }

  useEffect(() => {
    carregarCarregadores()
  }, [])

  const proximaEtapa = () => {
    if (validarEtapa(etapa)) {
      setEtapa(etapa + 1)
    }
  }

  const etapaAnterior = () => {
    if (etapa > 1) setEtapa(etapa - 1)
  }

  const validarEtapa = (step) => {
    switch (step) {
      case 1:
        return dados.nome_projeto && dados.cliente_nome && dados.endereco
      case 2:
        return carregadores.length > 0
      case 3:
        return true
      default:
        return true
    }
  }

  const adicionarCarregador = (carregador) => {
    setCarregadores([...carregadores, { ...carregador, quantidade: 1 }])
  }

  const removerCarregador = (idx) => {
    setCarregadores(carregadores.filter((_, i) => i !== idx))
  }

  const calcularNBR = () => {
    if (carregadores.length === 0) return

    const potencia_total = carregadores.reduce((sum, c) => sum + c.potencia_kw * c.quantidade, 0)
    const primeiro = carregadores[0]

    const resultado = calcularParametrosNBR5410({
      potencia_kw: potencia_total,
      tensao_entrada_v: primeiro.tensao_entrada_v || 220,
      numero_fases: primeiro.numero_fases || 3,
      comprimento_cabo_m: dados.comprimento_cabo_m,
      tipo_carregador: primeiro.tipo,
    })

    setCalculos(resultado)

    // Gerar unifilar
    const unifilarSvg = gerarUnifilarEVSVG({
      projeto_nome: dados.nome_projeto,
      endereco: dados.endereco,
      cliente_nome: dados.cliente_nome,
      carregador_tipo: primeiro.tipo,
      carregador_potencia_kw: potencia_total,
      carregador_marca: primeiro.marca,
      carregador_modelo: primeiro.modelo,
      calculos: resultado,
      tecnico_nome: dados.tecnico_nome,
      tecnico_crea: dados.tecnico_crea,
    })

    setUnifilar(unifilarSvg)
  }

  const baixarUnifilar = () => {
    if (!unifilar) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = 1200
    canvas.height = 842

    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0)
      const link = document.createElement('a')
      link.download = `Unifilar_${dados.nome_projeto}.png`
      link.href = canvas.toDataURL()
      link.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unifilar)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Nova Proposta EV</h1>
        <Button variante="secundario" onClick={() => navigate('/projetos-ev')}>
          Cancelar
        </Button>
      </div>

      <Stepper etapas={ETAPAS} etapaAtual={etapa} />

      {/* ETAPA 1: LOCALIZAÇÃO */}
      {etapa === 1 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Localização do Projeto</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <Input
              rotulo="Nome do Projeto"
              value={dados.nome_projeto}
              onChange={(e) => setDados({ ...dados, nome_projeto: e.target.value })}
              placeholder="Ex: Frota Costa 22kW"
            />

            <Input
              rotulo="Nome do Cliente"
              value={dados.cliente_nome}
              onChange={(e) => setDados({ ...dados, cliente_nome: e.target.value })}
              placeholder="Ex: Empresa XYZ"
            />

            <Input
              rotulo="Endereço Completo"
              value={dados.endereco}
              onChange={(e) => setDados({ ...dados, endereco: e.target.value })}
              placeholder="Rua, número, complemento"
            />

            <Input
              rotulo="Técnico Responsável"
              value={dados.tecnico_nome}
              onChange={(e) => setDados({ ...dados, tecnico_nome: e.target.value })}
              placeholder="Nome completo"
            />

            <Input
              rotulo="CREA"
              value={dados.tecnico_crea}
              onChange={(e) => setDados({ ...dados, tecnico_crea: e.target.value })}
              placeholder="Ex: SP 123456/D"
            />

            <div className="flex justify-end gap-2">
              <Button variante="secundario" disabled>Anterior</Button>
              <Button onClick={proximaEtapa} disabled={!validarEtapa(1)}>Próxima →</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ETAPA 2: SELEÇÃO DE CARREGADORES */}
      {etapa === 2 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Seleção de Carregadores</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            {/* Carregadores Selecionados */}
            <div>
              <h3 className="font-semibold mb-2">Carregadores Selecionados:</h3>
              {carregadores.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum carregador selecionado</p>
              ) : (
                <div className="space-y-2">
                  {carregadores.map((c, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded">
                      <div className="flex-1">
                        <p className="font-medium">{c.marca} {c.modelo}</p>
                        <p className="text-sm text-slate-500">{c.tipo} - {c.potencia_kw}kW</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={c.quantidade}
                          onChange={(e) => {
                            const updated = [...carregadores]
                            updated[idx].quantidade = parseInt(e.target.value)
                            setCarregadores(updated)
                          }}
                          className="w-12 px-2 py-1 border rounded"
                        />
                        <span className="text-sm">un</span>
                        <Button variante="fantasma" tamanho="sm" onClick={() => removerCarregador(idx)}>
                          <X size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Banco de Carregadores Disponíveis */}
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Banco de Carregadores</h3>
                <Button
                  variante="secundario"
                  tamanho="sm"
                  onClick={() => setModalUploadAberto(true)}
                >
                  Adicionar datasheet
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                {carregadoresDisponiveis.map((c) => (
                  <div key={c._id} className="p-3 border border-slate-200 rounded hover:bg-blue-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{c.marca} {c.modelo}</p>
                        <p className="text-xs text-slate-500">{c.tipo} - {c.potencia_kw}kW</p>
                        <p className="text-xs text-slate-600 mt-1">
                          {c.numero_fases}F | {c.tensao_entrada_v}V | {c.corrente_entrada_a}A
                        </p>
                      </div>
                      <Button
                        variante="fantasma"
                        tamanho="sm"
                        onClick={() => adicionarCarregador(c)}
                      >
                        <Plus size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Input
              rotulo="Comprimento do cabo (m)"
              type="number"
              value={dados.comprimento_cabo_m}
              onChange={(e) => setDados({ ...dados, comprimento_cabo_m: parseFloat(e.target.value) })}
            />

            <div className="flex justify-between gap-2">
              <Button variante="secundario" onClick={etapaAnterior}>← Anterior</Button>
              <Button onClick={proximaEtapa} disabled={carregadores.length === 0}>Próxima →</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ETAPA 3: CÁLCULOS NBR 5410 */}
      {etapa === 3 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Cálculos de Proteção (NBR 5410)</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            {!calculos ? (
              <Button onClick={calcularNBR} className="w-full">
                Calcular Parâmetros NBR 5410
              </Button>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600 uppercase font-semibold">Corrente de Projeto</p>
                  <p className="text-2xl font-bold text-blue-900">{calculos.corrente_projeto_a.toFixed(1)}</p>
                  <p className="text-xs text-blue-600">A</p>
                </div>

                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-xs text-red-600 uppercase font-semibold">Corrente Máxima</p>
                  <p className="text-2xl font-bold text-red-900">{calculos.corrente_maxima_a.toFixed(1)}</p>
                  <p className="text-xs text-red-600">A</p>
                </div>

                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-xs text-green-600 uppercase font-semibold">Bitola do Cabo</p>
                  <p className="text-2xl font-bold text-green-900">{calculos.bitola_cabo_mm2}</p>
                  <p className="text-xs text-green-600">mm²</p>
                </div>

                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-xs text-yellow-600 uppercase font-semibold">Disjuntor</p>
                  <p className="text-2xl font-bold text-yellow-900">{calculos.disjuntor_a}</p>
                  <p className="text-xs text-yellow-600">A</p>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-xs text-purple-600 uppercase font-semibold">DR</p>
                  <p className="text-2xl font-bold text-purple-900">{calculos.dr_ma}</p>
                  <p className="text-xs text-purple-600">mA</p>
                </div>

                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-xs text-orange-600 uppercase font-semibold">Queda Tensão</p>
                  <p className="text-2xl font-bold text-orange-900">{calculos.queda_tensao_pct.toFixed(2)}</p>
                  <p className="text-xs text-orange-600">%</p>
                </div>
              </div>
            )}

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
              <h4 className="font-semibold text-blue-900 mb-2">Materiais Necessários</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                {calculos?.materiais.map((mat, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>{mat.item} ({mat.especificacao})</span>
                    <span className="font-semibold">{mat.quantidade}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-between gap-2">
              <Button variante="secundario" onClick={etapaAnterior}>← Anterior</Button>
              <Button onClick={proximaEtapa} disabled={!calculos}>Próxima →</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ETAPA 4: GERAR UNIFILAR */}
      {etapa === 4 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Unifilar A4 Paisagem</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            {unifilar ? (
              <div className="space-y-4">
                <div
                  className="border-2 border-slate-200 rounded-lg overflow-auto bg-white"
                  dangerouslySetInnerHTML={{ __html: unifilar }}
                  style={{ maxHeight: '500px' }}
                />
                <div className="flex gap-2">
                  <Button icone={Download} onClick={baixarUnifilar} className="flex-1">
                    Baixar Unifilar
                  </Button>
                  <Button variante="secundario" onClick={calcularNBR} className="flex-1">
                    Recalcular
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={calcularNBR} className="w-full">
                Gerar Unifilar
              </Button>
            )}

            <div className="flex justify-between gap-2">
              <Button variante="secundario" onClick={etapaAnterior}>← Anterior</Button>
              <Button onClick={() => navigate('/projetos-ev')} disabled={!unifilar}>
                Salvar Projeto
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {modalUploadAberto && (
        <ModalNovoCarregadorEV
          onClose={() => setModalUploadAberto(false)}
          onSalvar={() => {
            setModalUploadAberto(false)
            carregarCarregadores()
          }}
        />
      )}
    </div>
  )
}
