import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Zap, Edit2, X } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import InteractiveDiagram from '../components/diagram/InteractiveDiagram'
import { carregarDiagramaLocal, salvarDiagramaLocal, deletarDiagramaLocal } from '../components/diagram/utils/diagramPersistence'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5005'

const statusLabel = {
  'rascunho': 'Rascunho',
  'em_simulacao': 'Em Simulação',
  'dimensionado': 'Dimensionado',
  'proposta': 'Proposta',
  'aprovado': 'Aprovado',
  'em_execucao': 'Em Execução',
  'concluido': 'Concluído',
}

const corStatus = {
  'rascunho': 'cinza',
  'em_simulacao': 'amarelo',
  'dimensionado': 'azul',
  'proposta': 'cinza',
  'aprovado': 'verde',
  'em_execucao': 'azul',
  'concluido': 'verde',
}

export default function ProjetosEVDetalhes() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [projeto, setProjeto] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [modalEditorAberto, setModalEditorAberto] = useState(false)
  const [diagramaEditado, setDiagramaEditado] = useState(null)
  const [salvandoDiagrama, setSalvandoDiagrama] = useState(false)

  useEffect(() => {
    carregarProjeto()
  }, [id])

  const carregarProjeto = async () => {
    try {
      setCarregando(true)
      console.log('Carregando projeto EV:', id)
      const response = await fetch(`${API_URL}/api/projetos-ev/${id}`)
      console.log('Response status:', response.status)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Projeto não encontrado`)
      }

      const dados = await response.json()
      console.log('Projeto EV carregado:', dados)
      setProjeto(dados)
      setErro(null)
    } catch (err) {
      console.error('❌ Erro ao carregar projeto EV:', err)
      setErro(err.message || 'Erro desconhecido')
      setProjeto(null)
    } finally {
      setCarregando(false)
    }
  }

  // Abrir editor de diagrama
  const abrirEditorDiagrama = () => {
    // Carregar diagrama salvo localmente se existir
    const diagramaSalvo = carregarDiagramaLocal(`projeto-ev-${id}`)
    if (diagramaSalvo) {
      setDiagramaEditado(diagramaSalvo)
    }
    setModalEditorAberto(true)
  }

  // Fechar editor sem salvar
  const fecharEditorDiagrama = () => {
    setModalEditorAberto(false)
    setDiagramaEditado(null)
  }

  // Salvar diagrama editado
  const salvarDiagramaEditado = async () => {
    if (!diagramaEditado) return

    try {
      setSalvandoDiagrama(true)

      // Salvar localmente
      const sucesso = salvarDiagramaLocal(
        `projeto-ev-${id}`,
        diagramaEditado.nodes,
        diagramaEditado.edges,
        {
          projeto_nome: projeto.nome,
          cliente_nome: clienteNome,
          projeto_id: id,
          timestamp: new Date().toISOString()
        }
      )

      if (!sucesso) {
        alert('❌ Erro ao salvar diagrama localmente')
        return
      }

      // Atualizar projeto no backend com referência ao diagrama
      const response = await fetch(`${API_URL}/api/projetos-ev/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagrama_editado: {
            nodes: diagramaEditado.nodes,
            edges: diagramaEditado.edges,
            timestamp: new Date().toISOString()
          }
        })
      })

      if (!response.ok) {
        throw new Error('Erro ao salvar diagrama no servidor')
      }

      alert('✅ Diagrama salvo com sucesso!')
      fecharEditorDiagrama()
      carregarProjeto() // Recarregar projeto
    } catch (erro) {
      console.error('Erro ao salvar diagrama:', erro)
      alert(`❌ Erro ao salvar: ${erro.message}`)
    } finally {
      setSalvandoDiagrama(false)
    }
  }

  // Deletar diagrama salvo
  const deletarDiagramaSalvo = () => {
    if (window.confirm('Tem certeza que deseja deletar o diagrama editado? Isso não pode ser desfeito.')) {
      deletarDiagramaLocal(`projeto-ev-${id}`)
      alert('✅ Diagrama deletado')
    }
  }

  // Estado de carregamento
  if (carregando) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-slate-500">Carregando projeto...</p>
      </div>
    )
  }

  // Estado de erro
  if (erro || !projeto) {
    return (
      <div className="space-y-4">
        <Button
          variante="fantasma"
          icone={ChevronLeft}
          onClick={() => navigate('/projetos-ev')}
        >
          Voltar
        </Button>
        <Card>
          <CardBody className="text-center py-12">
            <p className="text-red-500 mb-4">{erro || 'Projeto não encontrado'}</p>
            <Button
              variante="primario"
              onClick={() => navigate('/projetos-ev')}
            >
              Voltar para lista
            </Button>
          </CardBody>
        </Card>
      </div>
    )
  }

  // Renderização segura com valores padrão
  const nome = projeto?.nome || 'Sem nome'
  const id_projeto = projeto?._id || 'N/A'
  const status = projeto?.status || 'desconhecido'
  const clienteNome = typeof projeto.clienteId === 'object'
    ? projeto.clienteId?.nome || 'N/A'
    : projeto.clienteId || 'N/A'
  const tipoCarregamento = projeto?.tipo_carregamento || 'N/A'
  const dataCriacao = projeto?.createdAt ? new Date(projeto.createdAt).toLocaleDateString('pt-BR') : 'N/A'
  const dataAtualizacao = projeto?.updatedAt ? new Date(projeto.updatedAt).toLocaleDateString('pt-BR') : 'N/A'

  const carregador = projeto?.carregadores?.[0]
  const calculos = projeto?.calculos_nbr || {}

  return (
    <div className="space-y-5">
      <Button
        variante="fantasma"
        icone={ChevronLeft}
        onClick={() => navigate('/projetos-ev')}
      >
        Voltar
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{nome}</h1>
          <p className="text-slate-500 mt-1">ID: {id_projeto}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            icone={Edit2}
            onClick={abrirEditorDiagrama}
            title="Editar diagrama técnico"
          >
            Editar Diagrama
          </Button>
          <Badge cor={corStatus[status] || 'cinza'}>
            {statusLabel[status] || status}
          </Badge>
        </div>
      </div>

      {/* Informações Gerais */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-900">Informações Gerais</h2>
        </CardHeader>
        <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-slate-500">Cliente</p>
            <p className="text-lg font-medium text-slate-900">{clienteNome}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Tipo de Carregamento</p>
            <p className="text-lg font-medium text-slate-900">{tipoCarregamento}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Data de Criação</p>
            <p className="text-lg font-medium text-slate-900">{dataCriacao}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Última Atualização</p>
            <p className="text-lg font-medium text-slate-900">{dataAtualizacao}</p>
          </div>
        </CardBody>
      </Card>

      {/* Carregadores */}
      {carregador && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-900">Carregador</h2>
          </CardHeader>
          <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-slate-500">Tipo</p>
              <p className="text-lg font-medium text-slate-900">{carregador.tipo || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Potência</p>
              <p className="text-lg font-medium text-slate-900">{carregador.potencia_kw || 0} kW</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Marca</p>
              <p className="text-lg font-medium text-slate-900">{carregador.marca || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Modelo</p>
              <p className="text-lg font-medium text-slate-900">{carregador.modelo || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Quantidade</p>
              <p className="text-lg font-medium text-slate-900">{carregador.quantidade || 0}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Tensão Entrada</p>
              <p className="text-lg font-medium text-slate-900">{carregador.tensao_entrada_v || 0}V</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Corrente Entrada</p>
              <p className="text-lg font-medium text-slate-900">{carregador.corrente_entrada_a || 0}A</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Cálculos NBR */}
      {Object.keys(calculos).length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-900">Cálculos (NBR)</h2>
          </CardHeader>
          <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-slate-500">Corrente Projeto</p>
              <p className="text-lg font-medium text-slate-900">{calculos.corrente_projeto_a || 0}A</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Corrente Máxima</p>
              <p className="text-lg font-medium text-slate-900">{calculos.corrente_maxima_a || 0}A</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Bitola do Cabo</p>
              <p className="text-lg font-medium text-slate-900">{calculos.bitola_cabo_mm2 || 0}mm²</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Disjuntor</p>
              <p className="text-lg font-medium text-slate-900">{calculos.disjuntor_a || 0}A</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">DR (mA)</p>
              <p className="text-lg font-medium text-slate-900">{calculos.dr_ma || 0}mA</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Queda de Tensão</p>
              <p className="text-lg font-medium text-slate-900">{calculos.queda_tensao_pct || 0}%</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Técnico */}
      {projeto?.tecnico && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-900">Técnico Responsável</h2>
          </CardHeader>
          <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-slate-500">Nome</p>
              <p className="text-lg font-medium text-slate-900">{projeto.tecnico.nome || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">CREA</p>
              <p className="text-lg font-medium text-slate-900">{projeto.tecnico.crea || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Tipo Profissional</p>
              <p className="text-lg font-medium text-slate-900">{projeto.tecnico.tipo_profissional || 'N/A'}</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Modal Editor de Diagrama */}
      {modalEditorAberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full h-[90vh] max-w-6xl flex flex-col">
            {/* Header do Modal */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Editor de Diagrama Técnico</h2>
              <button
                onClick={fecharEditorDiagrama}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                title="Fechar editor"
              >
                <X size={24} className="text-slate-600" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="flex-1 overflow-hidden bg-slate-50">
              <InteractiveDiagram
                calculos={projeto?.calculos_nbr}
                projeto={{
                  projeto_nome: projeto?.nome,
                  cliente_nome: clienteNome,
                  endereco: projeto?.endereco_completo,
                  carregador_potencia_kw: carregador?.potencia_kw,
                  carregador_tipo: carregador?.tipo,
                  carregador_marca: carregador?.marca,
                  carregador_modelo: carregador?.modelo,
                  comprimento_cabo: projeto?.comprimento_cabo_m || 10,
                  tecnico_nome: projeto?.tecnico?.nome,
                  tecnico_crea: projeto?.tecnico?.crea,
                }}
                onDiagramChange={(diagramData) => {
                  setDiagramaEditado(diagramData)
                }}
                readOnly={false}
              />
            </div>

            {/* Footer do Modal */}
            <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50">
              <div className="flex gap-2">
                <Button
                  variante="fantasma"
                  onClick={deletarDiagramaSalvo}
                  className="text-red-600 hover:bg-red-50"
                >
                  🗑 Deletar Diagrama Salvo
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  variante="secundario"
                  onClick={fecharEditorDiagrama}
                  disabled={salvandoDiagrama}
                >
                  Cancelar
                </Button>
                <Button
                  variante="primario"
                  onClick={salvarDiagramaEditado}
                  disabled={!diagramaEditado || salvandoDiagrama}
                >
                  {salvandoDiagrama ? 'Salvando...' : '✓ Salvar Diagrama'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
