import { useState, useEffect, useMemo, useCallback } from 'react'
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
// EV-ALIGN-01: alinhar com FV — RT via API de Gestão Corporativa
import { tecnicosApi } from '../services/gestaoApi'
import { apenasAtivos } from '../utils/gestaoUtils'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway. Não usar VITE_API_URL */

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
  const [carregadoresErro, setCarregadoresErro] = useState(null)  // EV-BUGFIX-02
  const [calculos, setCalculos] = useState(null)
  const [unifilar, setUnifilar] = useState(null)
  const [modalUploadAberto, setModalUploadAberto] = useState(false)
  const [responsaveisTecnicos, setResponsaveisTecnicos] = useState([])
  const [tecnicoSelecionado, setTecnicoSelecionado] = useState('')
  const [rtCarregando, setRtCarregando] = useState(true)  // EV-ALIGN-01
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

  // EV-BUGFIX-02: filtro EV-ALIGN-01 era restritivo demais — excluía técnicos
  // com especialidades=['FV'] (técnicos cadastrados para projetos solares que
  // também podem assinar EV). Agora alinha com o FV: lista TODOS os ativos.
  // Quem tem 'EV' declarado aparece com destaque; demais aparecem normalmente.
  useEffect(() => {
    let vivo = true
    setRtCarregando(true)
    tecnicosApi.listar()
      .then(lista => {
        if (!vivo) return
        setRtCarregando(false)
        // EV-BUGFIX-02: aceita TODOS os técnicos ativos (mesmo padrão FV).
        // Auto-seleciona quando há apenas 1; com múltiplos, prioriza quem
        // declarou especialidade EV; demais aparecem no seletor.
        const aptos = apenasAtivos(lista)
        setResponsaveisTecnicos(aptos)
        if (aptos.length > 0) {
          const comEV = aptos.find(t => Array.isArray(t.especialidades) && t.especialidades.includes('EV'))
          const escolhido = comEV || aptos[0]
          setTecnicoSelecionado(escolhido._id)
          const ehCrea = (escolhido.tipo_registro || '').toUpperCase() === 'CREA'
          setDados(prev => ({
            ...prev,
            tecnico_nome: escolhido.nome || '',
            tecnico_crea: ehCrea ? escolhido.registro : '',
            tecnico_cft: !ehCrea ? escolhido.registro : '',
            tecnico_tipo: ehCrea ? 'crea' : 'cft',
            tecnico_id: escolhido._id,
            tecnico_potencia_max_kw: escolhido.potencia_max_kw || null,
            tecnico_validade_carteira: escolhido.validade_carteira_profissional || null,
          }))
        }
      })
      .catch(err => {
        if (!vivo) return
        setRtCarregando(false)
        console.error('Erro ao carregar técnicos:', err)
        // Fallback compat: localStorage (apenas para usuários migrando)
        const tecnicoSalvo = localStorage.getItem('tecnico_dados')
        if (tecnicoSalvo) {
          try {
            const tecnico = JSON.parse(tecnicoSalvo)
            setDados(prev => ({
              ...prev,
              tecnico_nome: tecnico.nome || '',
              tecnico_crea: tecnico.crea || '',
              tecnico_cft: tecnico.cft || '',
              tecnico_tipo: tecnico.tipo || 'crea',
            }))
          } catch {}
        }
      })
    return () => { vivo = false }
  }, [])

  // EV-ALIGN-01: helpers de validação RT (espelham EquipeProjeto/FV)
  const tecnicoSelecionadoObj = responsaveisTecnicos.find(t => t._id === tecnicoSelecionado)
  const potenciaTotalKw = carregadores.reduce((s, c) => s + (Number(c.potencia_kw) || 0) * (Number(c.quantidade) || 1), 0)
  const rtCarteiraVencida = (() => {
    const v = tecnicoSelecionadoObj?.validade_carteira_profissional
    if (!v) return false
    return new Date(v).getTime() < Date.now()
  })()
  const rtAcimaLimite = (() => {
    const lim = tecnicoSelecionadoObj?.potencia_max_kw
    if (!lim || !potenciaTotalKw) return false
    return potenciaTotalKw > Number(lim)
  })()

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
  // EV-BUGFIX-02: estado adicional `carregadoresErro` para diferenciar
  // "catálogo vazio" vs "falha de rede" no UX.
  const carregarCarregadores = () => {
    setCarregadoresErro(null)
    console.log('🔄 Carregando carregadores de:', `${API_URL}/api/carregadores-ev`)
    fetch(`${API_URL}/api/carregadores-ev`)
      .then(r => {
        console.log('📡 Response status:', r.status)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        const lista = Array.isArray(data) ? data : (data?.itens || [])
        console.log('✅ Carregadores carregados:', lista.length)
        setCarregadoresDisponiveis(lista)
      })
      .catch(err => {
        console.error('❌ Erro ao carregar carregadores:', err)
        setCarregadoresDisponiveis([])
        setCarregadoresErro(err.message || 'Falha na conexão com o servidor')
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
                  {/* EV-BUGFIX-02: deixa explícito quando há só 1 RT auto-selecionado */}
                  Responsável Técnico
                  {responsaveisTecnicos.length === 1
                    ? <span className="ml-1 text-[10px] text-emerald-700">✓ auto-selecionado</span>
                    : <span className="ml-1 text-[10px] text-slate-400">({responsaveisTecnicos.length} disponíveis)</span>}
                </label>
                <select
                  value={tecnicoSelecionado}
                  onChange={(e) => {
                    setTecnicoSelecionado(e.target.value)
                    const responsavel = responsaveisTecnicos.find(r => r._id === e.target.value)
                    if (responsavel) {
                      const ehCrea = (responsavel.tipo_registro || '').toUpperCase() === 'CREA'
                      setDados(prev => ({
                        ...prev,
                        tecnico_nome: responsavel.nome || '',
                        tecnico_crea: ehCrea ? responsavel.registro : '',
                        tecnico_cft: !ehCrea ? responsavel.registro : '',
                        tecnico_tipo: ehCrea ? 'crea' : 'cft',
                        tecnico_id: responsavel._id,
                        tecnico_potencia_max_kw: responsavel.potencia_max_kw || null,
                        tecnico_validade_carteira: responsavel.validade_carteira_profissional || null,
                      }))
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">-- Selecionar --</option>
                  {responsaveisTecnicos.map(resp => {
                    const limite = resp.potencia_max_kw ? ` · até ${resp.potencia_max_kw}kW` : ''
                    const v = resp.validade_carteira_profissional
                    const venc = v && new Date(v).getTime() < Date.now() ? ' · VENCIDO' : ''
                    const especEV = Array.isArray(resp.especialidades) && resp.especialidades.includes('EV')
                    const especIcon = especEV ? '⚡ ' : ''
                    return (
                      <option key={resp._id} value={resp._id} disabled={!!venc}>
                        {especIcon}{resp.nome} ({resp.tipo_registro} {resp.registro || ''}){limite}{venc}
                      </option>
                    )
                  })}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  ⚡ = RT com especialidade EV declarada. Demais técnicos ativos também podem ser atribuídos.
                </p>
                {rtCarteiraVencida && (
                  <p className="text-xs text-red-700 bg-red-50 p-2 rounded border border-red-200 mt-2">
                    ⚠ Carteira profissional VENCIDA — selecione outro RT antes de prosseguir.
                  </p>
                )}
                {rtAcimaLimite && !rtCarteiraVencida && (
                  <p className="text-xs text-amber-800 bg-amber-50 p-2 rounded border border-amber-200 mt-2">
                    ⚠ Potência do projeto ({potenciaTotalKw.toFixed(1)} kW) excede o limite do RT
                    ({tecnicoSelecionadoObj?.potencia_max_kw} kW). Exige justificativa Admin/Diretor.
                  </p>
                )}
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

            {rtCarregando ? (
              <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-200">
                ⏳ Carregando responsáveis técnicos…
              </p>
            ) : responsaveisTecnicos.length === 0 ? (
              <p className="text-xs text-slate-600 bg-yellow-50 p-2 rounded border border-yellow-200">
                ⚠️ Nenhum responsável técnico cadastrado.
                <br />
                Acesse <strong>Configurações → Equipe & Permissões → Técnicos</strong> para adicionar responsáveis aptos a projetos EV.
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
              {/* EV-ALIGN-01: bloqueia só se RT vencido. Sem carregador selecionado é alerta, não bloqueio. */}
              <Button
                onClick={proximaEtapa}
                disabled={rtCarteiraVencida || (carregadores.length === 0 && carregadoresDisponiveis.length === 0)}
                title={rtCarteiraVencida ? 'Selecione um RT válido (carteira vencida bloqueia)' : (carregadores.length === 0 ? 'Adicione ao menos 1 carregador via datasheet ou seleção' : '')}
              >Próxima →</Button>
            </div>
            {carregadores.length === 0 && carregadoresDisponiveis.length > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded mt-2">
                ⚠ Selecione um carregador da lista acima antes de prosseguir.
                <span className="ml-2 text-slate-500">({carregadoresDisponiveis.length} no catálogo)</span>
              </p>
            )}
            {/* EV-BUGFIX-02: distingue catálogo vazio (DB ok, 0 docs) de erro de rede */}
            {carregadoresDisponiveis.length === 0 && !carregadoresErro && (
              <p className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded mt-2">
                💡 Catálogo vazio. Use "Adicionar datasheet" acima para importar um PDF.
              </p>
            )}
            {carregadoresErro && (
              <p className="text-xs text-red-700 bg-red-50 px-3 py-1.5 rounded mt-2">
                ❌ Falha ao carregar catálogo: {carregadoresErro}
                <button onClick={carregarCarregadores} className="ml-2 underline text-red-800 hover:text-red-900">
                  Tentar novamente
                </button>
              </p>
            )}
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
                    <InteractiveDiagramWrapper
                      calculos={calculos}
                      dados={dados}
                      carregadores={carregadores}
                      onChange={setDiagramaEditado}
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

/**
 * EV-CRASH-FIX: wrapper que MEMOIZA `projeto` e `onDiagramChange` antes de
 * passar para o InteractiveDiagram.
 *
 * Causa raiz do crash do step 4 (Unifilar):
 *   InteractiveDiagram tem useEffect com deps [calculos, projeto, onDiagramChange]
 *   e chama onDiagramChange dentro dele. Como o pai criava `projeto` (objeto
 *   literal) e `onDiagramChange` (arrow function inline) em cada render, cada
 *   chamada de onDiagramChange → setDiagramaEditado → re-render do pai →
 *   nova referência de projeto/onDiagramChange → deps mudaram → useEffect
 *   refire → onDiagramChange de novo → loop infinito → React aborta
 *   "Maximum update depth exceeded".
 *
 * Fix: useMemo/useCallback estabilizam as referências.
 */
function InteractiveDiagramWrapper({ calculos, dados, carregadores, onChange }) {
  const projeto = useMemo(() => ({
    projeto_nome: dados.nome_projeto,
    cliente_nome: dados.cliente_nome,
    endereco: dados.endereco,
    carregador_potencia_kw: carregadores.reduce((sum, c) => sum + (Number(c.potencia_kw) || 0) * (Number(c.quantidade) || 1), 0),
    carregador_tipo: carregadores[0]?.tipo || 'AC Trifásico',
    carregador_marca: carregadores[0]?.marca || '',
    carregador_modelo: carregadores[0]?.modelo || '',
    comprimento_cabo: dados.comprimento_cabo_m,
    tecnico_nome: dados.tecnico_nome,
    tecnico_crea: dados.tecnico_crea,
  }), [
    // Apenas campos que afetam o diagrama
    dados.nome_projeto, dados.cliente_nome, dados.endereco, dados.comprimento_cabo_m,
    dados.tecnico_nome, dados.tecnico_crea, carregadores,
  ])

  const handleChange = useCallback((diagramData) => {
    onChange(diagramData)
    try {
      salvarDiagramaLocal(
        `proposta-${dados.nome_projeto || 'sem-nome'}`,
        diagramData?.nodes,
        diagramData?.edges,
        {
          projeto_nome: dados.nome_projeto,
          cliente_nome: dados.cliente_nome,
          timestamp: new Date().toISOString(),
        },
      )
    } catch (e) {
      console.warn('[EV] Falha ao salvar diagrama local:', e?.message)
    }
  }, [onChange, dados.nome_projeto, dados.cliente_nome])

  return (
    <InteractiveDiagram
      calculos={calculos}
      projeto={projeto}
      onDiagramChange={handleChange}
      readOnly={false}
    />
  )
}
