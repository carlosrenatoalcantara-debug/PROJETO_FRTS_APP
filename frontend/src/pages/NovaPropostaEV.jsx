import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapPin, Zap, Wrench, FileText, Download, Plus, X, Edit2 } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Stepper from '../components/ui/Stepper'
import ModalNovoCarregadorEV from '../components/equipamentos/ModalNovoCarregadorEV'
import InteractiveDiagram from '../components/diagram/InteractiveDiagram'
import { calcularParametrosNBR5410, validarNBR5410 } from '../services/calculosNBR5410EV'
import { gerarUnifilarEVSVG } from '../utils/gerarUnifilarEV'
import { salvarDiagramaLocal } from '../components/diagram/utils/diagramPersistence'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5005'

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
  const [responsaveisTecnicos, setResponsaveisTecnicos] = useState([])
  const [tecnicoSelecionado, setTecnicoSelecionado] = useState('')
  const [modoEdicao, setModoEdicao] = useState(false)
  const [diagramaEditado, setDiagramaEditado] = useState(null)

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
    tecnico_cft: '',
    tecnico_tipo: 'crea', // 'crea' ou 'cft'
  })

  // Carregar dados do técnico da configuração (localStorage)
  useEffect(() => {
    // Carregar lista de responsáveis técnicos
    const respTecnicosArmazenados = localStorage.getItem('responsaveisTecnicos')
    if (respTecnicosArmazenados) {
      const responsaveis = JSON.parse(respTecnicosArmazenados)
      setResponsaveisTecnicos(responsaveis)
      // Auto-selecionar o primeiro responsável se houver
      if (responsaveis.length > 0) {
        const primeiro = responsaveis[0]
        setTecnicoSelecionado(primeiro.id)
        setDados(prev => ({
          ...prev,
          tecnico_nome: primeiro.nome || '',
          tecnico_crea: primeiro.certificacao === 'CREA' ? primeiro.numero : '',
          tecnico_cft: primeiro.certificacao === 'CFT' ? primeiro.numero : '',
          tecnico_tipo: primeiro.certificacao === 'CREA' ? 'crea' : 'cft',
        }))
      }
    }

    // Fallback: tentar carregar dados do técnico antigo (backward compatibility)
    if (!respTecnicosArmazenados) {
      const tecnicoSalvo = localStorage.getItem('tecnico_dados')
      if (tecnicoSalvo) {
        const tecnico = JSON.parse(tecnicoSalvo)
        setDados(prev => ({
          ...prev,
          tecnico_nome: tecnico.nome || '',
          tecnico_crea: tecnico.crea || '',
          tecnico_cft: tecnico.cft || '',
          tecnico_tipo: tecnico.tipo || 'crea',
        }))
      }
    }
  }, [])

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
    console.log('🔄 Carregando carregadores de:', `${API_URL}/api/carregadores-ev`)
    fetch(`${API_URL}/api/carregadores-ev`)
      .then(r => {
        console.log('📡 Response status:', r.status)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        console.log('✅ Carregadores carregados:', data?.length || 0)
        setCarregadoresDisponiveis(data || [])
      })
      .catch(err => {
        console.error('❌ Erro ao carregar carregadores:', err)
        setCarregadoresDisponiveis([])
      })
  }

  useEffect(() => {
    carregarCarregadores()
  }, [])

  const proximaEtapa = () => {
    console.log('🔄 Validando etapa:', etapa)
    try {
      if (validarEtapa(etapa)) {
        console.log('✅ Etapa válida, avançando para:', etapa + 1)
        setEtapa(etapa + 1)
      } else {
        console.warn('⚠️ Etapa inválida:', etapa)
      }
    } catch (err) {
      console.error('❌ Erro ao avançar etapa:', err)
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
    console.log('🧮 Iniciando cálculo NBR')
    if (carregadores.length === 0) {
      console.warn('⚠️ Sem carregadores')
      return
    }

    try {
      console.log('📊 Calculando potência total...')
      const potencia_total = carregadores.reduce((sum, c) => sum + c.potencia_kw * c.quantidade, 0)
      console.log('✅ Potência total:', potencia_total)

      const primeiro = carregadores[0]
      console.log('📋 Dados do primeiro carregador:', { tipo: primeiro.tipo, potencia: primeiro.potencia_kw })

      console.log('🔢 Chamando calcularParametrosNBR5410...')
      const resultado = calcularParametrosNBR5410({
        potencia_kw: potencia_total,
        tensao_entrada_v: primeiro.tensao_entrada_v || 220,
        numero_fases: primeiro.numero_fases || 3,
        comprimento_cabo_m: dados.comprimento_cabo_m,
        tipo_carregador: primeiro.tipo,
      })
      console.log('✅ Cálculos completos:', resultado)

      console.log('💾 Salvando cálculos no estado...')
      setCalculos(resultado)

      // Gerar unifilar
      console.log('🎨 Gerando SVG unifilar...')
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
      console.log('✅ SVG gerado')

      console.log('💾 Salvando unifilar no estado...')
      setUnifilar(unifilarSvg)

      // ✨ Ativar automaticamente modo de edição quando unifilar é gerado
      console.log('✨ Ativando editor interativo automaticamente...')
      setModoEdicao(true)

      console.log('✅ Cálculo NBR concluído com sucesso!')
    } catch (err) {
      console.error('❌ Erro ao calcular NBR:', err)
      alert('Erro ao calcular: ' + err.message)
    }
  }

  const baixarUnifilar = () => {
    if (!unifilar) {
      alert('Nenhum unifilar gerado. Por favor, gere o unifilar primeiro.')
      return
    }

    try {
      // Baixar como SVG
      const link = document.createElement('a')
      link.href = 'data:application/octet-stream;base64,' + btoa(unifilar)
      link.download = `unifilar-ev-${dados.nome_projeto.replace(/\s+/g, '-')}.svg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Também oferece download como PNG
      const svgBlob = new Blob([unifilar], { type: 'image/svg+xml' })
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        canvas.width = 1200
        canvas.height = 842
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, 1200, 842)
        ctx.drawImage(img, 0, 0)

        const pngLink = document.createElement('a')
        pngLink.href = canvas.toDataURL('image/png')
        pngLink.download = `unifilar-ev-${dados.nome_projeto.replace(/\s+/g, '-')}.png`
        pngLink.click()
      }

      img.src = 'data:image/svg+xml;base64,' + btoa(unifilar)
    } catch (erro) {
      console.error('Erro ao baixar unifilar:', erro)
      alert('Erro ao baixar unifilar: ' + erro.message)
    }
  }

  const baixarUnifilarPDF = () => {
    // Quando o projeto é salvo, ele pode fazer download do PDF
    alert('Por favor, salve o projeto primeiro para gerar o PDF completo.')
  }

  const baixarPDFProjeto = async (projetoId) => {
    try {
      const response = await fetch(`${API_URL}/api/projetos-ev/${projetoId}/pdf`)
      if (!response.ok) throw new Error('Erro ao gerar PDF')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Unifilar_${dados.nome_projeto}.pdf`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (erro) {
      console.error('Erro ao baixar PDF:', erro)
      alert(`Erro ao gerar PDF: ${erro.message}`)
    }
  }

  const salvarProjeto = async () => {
    if (!clienteId) {
      alert('Erro: cliente não identificado')
      return
    }

    if (!validarEtapa(1) || !validarEtapa(2) || !unifilar) {
      alert('Por favor, complete todas as etapas antes de salvar')
      return
    }

    const potencia_total = carregadores.reduce((sum, c) => sum + c.potencia_kw * c.quantidade, 0)

    const projetoData = {
      clienteId,
      nome: dados.nome_projeto,
      endereco_completo: dados.endereco,
      latitude: dados.latitude,
      longitude: dados.longitude,
      carregadores: carregadores.map(c => ({
        tipo: c.tipo,
        potencia_kw: c.potencia_kw,
        marca: c.marca,
        modelo: c.modelo,
        quantidade: c.quantidade,
      })),
      quantidade_pontos: carregadores.length,
      potencia_total_kw: potencia_total,
      comprimento_cabo_m: dados.comprimento_cabo_m,
      calculos_nbr: calculos,
      tecnico: {
        nome: dados.tecnico_nome,
        crea: dados.tecnico_crea,
        cft: dados.tecnico_cft,
        tipo_profissional: dados.tecnico_tipo,
      },
      status: 'dimensionado',
    }

    try {
      const response = await fetch(`${API_URL}/api/projetos-ev`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projetoData),
      })

      if (!response.ok) {
        const erro = await response.json()
        throw new Error(erro.erro || 'Erro ao salvar projeto')
      }

      const novoProjeto = await response.json()
      alert('✅ Projeto salvo com sucesso!')

      // Salvar dados do técnico para próximos projetos
      localStorage.setItem('tecnico_dados', JSON.stringify({
        nome: dados.tecnico_nome,
        crea: dados.tecnico_crea,
        cft: dados.tecnico_cft,
        tipo: dados.tecnico_tipo,
      }))

      // Oferecer download de PDF
      const fazerDownload = window.confirm('Deseja baixar o diagrama em PDF?')
      if (fazerDownload) {
        await new Promise(resolve => setTimeout(resolve, 500)) // Aguardar um pouco
        baixarPDFProjeto(novoProjeto._id)
      }

      navigate(`/projetos-ev`)
    } catch (erro) {
      console.error('Erro ao salvar projeto:', erro)
      alert(`❌ Erro ao salvar: ${erro.message}`)
    }
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

            {responsaveisTecnicos.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Selecionar Técnico Responsável
                </label>
                <select
                  value={tecnicoSelecionado}
                  onChange={(e) => {
                    setTecnicoSelecionado(e.target.value)
                    const responsavel = responsaveisTecnicos.find(r => r.id === e.target.value)
                    if (responsavel) {
                      setDados(prev => ({
                        ...prev,
                        tecnico_nome: responsavel.nome || '',
                        tecnico_crea: responsavel.certificacao === 'CREA' ? responsavel.numero : '',
                        tecnico_cft: responsavel.certificacao === 'CFT' ? responsavel.numero : '',
                        tecnico_tipo: responsavel.certificacao === 'CREA' ? 'crea' : 'cft',
                      }))
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">-- Selecionar --</option>
                  {responsaveisTecnicos.map(resp => (
                    <option key={resp.id} value={resp.id}>
                      {resp.nome} ({resp.certificacao})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Responsáveis cadastrados em Configurações → Responsável Técnico
                </p>
              </div>
            )}

            <Input
              rotulo="Técnico Responsável"
              value={dados.tecnico_nome}
              onChange={(e) => setDados({ ...dados, tecnico_nome: e.target.value })}
              placeholder="Nome completo"
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tipo de Profissional
                </label>
                <select
                  value={dados.tecnico_tipo}
                  onChange={(e) => setDados({ ...dados, tecnico_tipo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="crea">CREA (Engenheiro/Técnico)</option>
                  <option value="cft">CFT (Eletrotécnico)</option>
                </select>
              </div>
            </div>

            {dados.tecnico_tipo === 'crea' ? (
              <Input
                rotulo="Número CREA"
                value={dados.tecnico_crea}
                onChange={(e) => setDados({ ...dados, tecnico_crea: e.target.value })}
                placeholder="Ex: SP 123456/D"
              />
            ) : (
              <Input
                rotulo="Número CFT"
                value={dados.tecnico_cft}
                onChange={(e) => setDados({ ...dados, tecnico_cft: e.target.value })}
                placeholder="Ex: CFT 123456"
              />
            )}

            {responsaveisTecnicos.length === 0 ? (
              <p className="text-xs text-slate-600 bg-yellow-50 p-2 rounded border border-yellow-200">
                ⚠️ Nenhum responsável técnico cadastrado.
                <br />
                Acesse <strong>Configurações → Responsável Técnico</strong> para adicionar responsáveis que serão pré-preenchidos nos projetos.
              </p>
            ) : (
              <p className="text-xs text-slate-500 bg-blue-50 p-2 rounded">
                💡 Dica: Para projetos elétricos pequenos (solar/EV), eletrotécnico (CFT) pode assinar.
                Você pode adicionar mais responsáveis em <strong>Configurações → Responsável Técnico</strong>.
              </p>
            )}

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
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Unifilar A4 Paisagem</h2>
              {unifilar && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setModoEdicao(!modoEdicao)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                      modoEdicao
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    <Edit2 size={16} />
                    {modoEdicao ? 'Visualizar' : 'Editar'}
                  </button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            {unifilar ? (
              <div className="space-y-4">
                {modoEdicao ? (
                  // Modo de Edição: Diagrama Interativo
                  <div className="border-2 border-blue-300 rounded-lg overflow-hidden bg-white" style={{ height: '600px' }}>
                    <InteractiveDiagram
                      calculos={calculos}
                      projeto={{
                        projeto_nome: dados.nome_projeto,
                        cliente_nome: dados.cliente_nome,
                        endereco: dados.endereco,
                        carregador_potencia_kw: carregadores.reduce((sum, c) => sum + c.potencia_kw * c.quantidade, 0),
                        carregador_tipo: carregadores[0]?.tipo || 'AC Trifásico',
                        carregador_marca: carregadores[0]?.marca || '',
                        carregador_modelo: carregadores[0]?.modelo || '',
                        comprimento_cabo: dados.comprimento_cabo_m,
                        tecnico_nome: dados.tecnico_nome,
                        tecnico_crea: dados.tecnico_crea,
                      }}
                      onDiagramChange={(diagramData) => {
                        setDiagramaEditado(diagramData)
                        // Salvar localmente para persistência
                        salvarDiagramaLocal(
                          `proposta-${dados.nome_projeto}`,
                          diagramData.nodes,
                          diagramData.edges,
                          {
                            projeto_nome: dados.nome_projeto,
                            cliente_nome: dados.cliente_nome,
                            timestamp: new Date().toISOString()
                          }
                        )
                      }}
                      readOnly={false}
                    />
                  </div>
                ) : (
                  // Modo de Visualização: SVG Estático
                  <div
                    className="border-2 border-slate-200 rounded-lg overflow-auto bg-white"
                    dangerouslySetInnerHTML={{ __html: unifilar }}
                    style={{ maxHeight: '500px' }}
                  />
                )}

                <div className="flex gap-2 flex-wrap">
                  <Button icone={Download} onClick={baixarUnifilar} className="flex-1 min-w-[150px]">
                    Baixar Unifilar
                  </Button>
                  <Button variante="secundario" onClick={calcularNBR} className="flex-1 min-w-[150px]">
                    Recalcular
                  </Button>
                  {modoEdicao && diagramaEditado && (
                    <Button
                      variante="secundario"
                      onClick={() => {
                        setModoEdicao(false)
                        alert('✓ Diagrama salvo localmente. Use a opção "Salvar Projeto" para persistir as mudanças.')
                      }}
                      className="flex-1 min-w-[150px]"
                    >
                      Finalizar Edição
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <Button onClick={calcularNBR} className="w-full">
                Gerar Unifilar
              </Button>
            )}

            <div className="flex justify-between gap-2">
              <Button variante="secundario" onClick={etapaAnterior}>← Anterior</Button>
              <Button onClick={salvarProjeto} disabled={!unifilar}>
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
