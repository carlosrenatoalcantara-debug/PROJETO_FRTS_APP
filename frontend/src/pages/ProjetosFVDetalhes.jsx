import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle, BarChart3, Battery, FileText, Zap, Edit2, X, ShieldCheck, Briefcase, Users, Map } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import UnifilarFV from '../components/fv/UnifilarFV'
import PlanejadorTelhado from '../components/fv/PlanejadorTelhado'
import GovernancaPainel from '../components/fv/GovernancaPainel'
import PropostaEnterprise from '../components/fv/PropostaEnterprise'
import CrmPainel from '../components/fv/CrmPainel'
import { getFreezeStatusConfig } from '../utils/engenhariaGovernanca'
import { getWorkflowConfig } from '../utils/comercialGovernanca'
import { getPipelineConfig } from '../utils/crmComercial'
import InteractiveDiagram from '../components/diagram/InteractiveDiagram'
import { carregarDiagramaLocal, salvarDiagramaLocal, deletarDiagramaLocal } from '../components/diagram/utils/diagramPersistence'

export default function ProjetosFVDetalhes() {
  const { id } = useParams()
  const [projeto, setProjeto] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [abaAtiva, setAbaAtiva] = useState('resumo')
  const [modalEditorAberto, setModalEditorAberto] = useState(false)
  const [diagramaEditado, setDiagramaEditado] = useState(null)
  const [salvandoDiagrama, setSalvandoDiagrama] = useState(false)

  useEffect(() => {
    carregarProjeto()
  }, [id])

  async function carregarProjeto() {
    try {
      const resposta = await fetch(`/api/projetos-fv/${id}`)
      if (!resposta.ok) throw new Error('Projeto não encontrado')
      const dados = await resposta.json()
      setProjeto(dados)
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  // Abrir editor de diagrama
  const abrirEditorDiagrama = () => {
    const diagramaSalvo = carregarDiagramaLocal(`projeto-fv-${id}`)
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
        `projeto-fv-${id}`,
        diagramaEditado.nodes,
        diagramaEditado.edges,
        {
          projeto_nome: projeto?.nomeCliente,
          endereco: projeto?.endereco,
          projeto_id: id,
          timestamp: new Date().toISOString()
        }
      )

      if (!sucesso) {
        alert('❌ Erro ao salvar diagrama localmente')
        return
      }

      // Atualizar projeto no backend
      const response = await fetch(`/api/projetos-fv/${id}`, {
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
      carregarProjeto()
    } catch (erro) {
      console.error('Erro ao salvar diagrama:', erro)
      alert(`❌ Erro ao salvar: ${erro.message}`)
    } finally {
      setSalvandoDiagrama(false)
    }
  }

  // Deletar diagrama salvo
  const deletarDiagramaSalvo = () => {
    if (window.confirm('Tem certeza que deseja deletar o diagrama editado?')) {
      deletarDiagramaLocal(`projeto-fv-${id}`)
      alert('✅ Diagrama deletado')
    }
  }

  if (carregando) return <div className="p-8 text-center"><p>Carregando...</p></div>
  if (erro) return <div className="p-8"><p className="text-red-600">{erro}</p></div>
  if (!projeto) return null

  const abas = [
    { id: 'resumo', label: 'Resumo', icone: BarChart3 },
    { id: 'layout', label: 'Layout', icone: Map },
    { id: 'bess', label: 'BESS', icone: Battery },
    { id: 'financeiro', label: 'Financeiro', icone: BarChart3 },
    { id: 'unifilar', label: 'Unifilar', icone: Zap },
    { id: 'governanca', label: 'Governança', icone: ShieldCheck },
    { id: 'comercial', label: 'Comercial', icone: Briefcase },
    { id: 'crm', label: 'CRM', icone: Users },
    { id: 'homologacao', label: 'Homologação', icone: FileText },
  ]

  const statusGov = projeto.governanca?.freeze_status
  const cfgGov = statusGov ? getFreezeStatusConfig(statusGov) : null
  const statusCom = projeto.governanca?.comercial?.workflow_status
  const cfgCom = statusCom ? getWorkflowConfig(statusCom) : null
  const pipelineCrm = projeto.governanca?.comercial?.crm_pipeline
  const cfgCrm = pipelineCrm ? getPipelineConfig(pipelineCrm) : null

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-slate-900">{projeto.nomeCliente}</h1>
            {cfgGov && <Badge cor={cfgGov.cor}>{cfgGov.label}</Badge>}
            {cfgCom && <Badge cor={cfgCom.cor}>{cfgCom.label}</Badge>}
            {cfgCrm && <Badge cor={cfgCrm.cor}>{cfgCrm.label}</Badge>}
          </div>
          <p className="text-slate-600 mt-1">{projeto.endereco}</p>
        </div>
        <Button
          icone={Edit2}
          onClick={abrirEditorDiagrama}
          title="Editar diagrama técnico"
        >
          Editar Diagrama
        </Button>
      </div>

      <div className="border-b border-slate-200">
        <div className="flex gap-1 overflow-x-auto">
          {abas.map((aba) => {
            const Icone = aba.icone
            return (
              <button
                key={aba.id}
                onClick={() => setAbaAtiva(aba.id)}
                className={`flex items-center gap-2 px-4 py-3 font-medium whitespace-nowrap border-b-2 transition-colors ${
                  abaAtiva === aba.id
                    ? 'text-blue-600 border-blue-600'
                    : 'text-slate-600 border-transparent hover:text-slate-900'
                }`}
              >
                <Icone size={18} />
                {aba.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        {abaAtiva === 'resumo' && <AbaResumo projeto={projeto} />}
        {abaAtiva === 'layout' && <AbaLayout projeto={projeto} />}
        {abaAtiva === 'bess' && <AbaBESS />}
        {abaAtiva === 'financeiro' && <AbaFinanceiro projeto={projeto} />}
        {abaAtiva === 'unifilar' && <UnifilarFV projeto={projeto} />}
        {abaAtiva === 'governanca' && (
          <GovernancaPainel
            projetoId={id}
            governanca={projeto.governanca}
            onAtualizar={(g) => setProjeto(p => ({ ...p, governanca: g }))}
            usuario={null}
          />
        )}
        {abaAtiva === 'comercial' && (
          <PropostaEnterprise
            projetoId={id}
            snapshotTecnico={projeto.governanca?.snapshot_tecnico}
            resultadoFinanceiro={null}
            governancaComercial={projeto.governanca?.comercial}
            onAtualizar={(c) => setProjeto(p => ({ ...p, governanca: { ...p.governanca, comercial: c } }))}
            usuario={null}
          />
        )}
        {abaAtiva === 'crm' && (
          <CrmPainel
            projetoId={id}
            comercial={projeto.governanca?.comercial}
            cliente={{ nome: projeto.clienteId?.nome || projeto.nomeCliente, email: projeto.clienteId?.email, telefone: projeto.clienteId?.telefone }}
            resumo={{ potenciaKwp: projeto.dimensionamento?.potenciaArredondada ?? projeto.potencia_kwp, valor: projeto.governanca?.snapshot_financeiro?.proposta_final }}
            onAtualizar={(c) => setProjeto(p => ({ ...p, governanca: { ...p.governanca, comercial: c } }))}
            usuario={null}
          />
        )}
        {abaAtiva === 'homologacao' && <AbaHomologacao />}
      </div>

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
                  projeto_nome: projeto?.nomeCliente,
                  endereco: projeto?.endereco,
                  comprimento_cabo: projeto?.comprimento_cabo_m || 10,
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

function AbaResumo({ projeto }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>Informações Básicas</CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-slate-600">Cliente</p>
              <p className="font-semibold text-slate-900">{projeto.nomeCliente}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Endereço</p>
              <p className="font-semibold text-slate-900">{projeto.endereco}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Status</p>
              <p className="font-semibold text-slate-900">{projeto.status || 'Ativo'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Data Criação</p>
              <p className="font-semibold text-slate-900">{new Date(projeto.dataCriacao).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {projeto.dimensionamento && (
        <Card>
          <CardHeader>Dimensionamento</CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded">
                <p className="text-sm text-slate-600">Potência</p>
                <p className="text-2xl font-bold text-blue-600">{projeto.dimensionamento.potenciaArredondada} kWp</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded">
                <p className="text-sm text-slate-600">Painéis</p>
                <p className="text-2xl font-bold text-blue-600">{projeto.dimensionamento.numPaineis}</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded">
                <p className="text-sm text-slate-600">Inversores</p>
                <p className="text-2xl font-bold text-blue-600">{projeto.dimensionamento.numInversores}</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded">
                <p className="text-sm text-slate-600">Strings</p>
                <p className="text-2xl font-bold text-blue-600">{projeto.dimensionamento.numStrings}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function AbaLayout({ projeto }) {
  const geo = projeto?.governanca?.snapshot_geoespacial
  const panos = geo?.panos || projeto?.layout_solar?.roof_planes || []
  const congelado = ['CONGELADO', 'HOMOLOGADO'].includes(projeto?.governanca?.freeze_status)

  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        Layout no Telhado
        {congelado && <span className="text-xs text-emerald-600">· geoespacial congelado</span>}
      </CardHeader>
      <CardBody>
        {panos.length > 0 ? (
          <>
            {geo && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="text-center p-3 bg-slate-50 rounded"><p className="text-xs text-slate-500">Área útil</p><p className="text-xl font-bold text-slate-800">{geo.area_util_total} m²</p></div>
                <div className="text-center p-3 bg-emerald-50 rounded"><p className="text-xs text-slate-500">Capacidade</p><p className="text-xl font-bold text-emerald-700">{geo.max_modulos_total}</p></div>
                <div className="text-center p-3 bg-slate-50 rounded"><p className="text-xs text-slate-500">Panos</p><p className="text-xl font-bold text-slate-800">{geo.total_panos}</p></div>
                <div className="text-center p-3 bg-slate-50 rounded"><p className="text-xs text-slate-500">Fator geração</p><p className="text-xl font-bold text-slate-800">{geo.fator_geracao_medio}</p></div>
              </div>
            )}
            <PlanejadorTelhado panos={panos} onChange={() => {}} bloqueado />
          </>
        ) : (
          <p className="text-slate-600">Nenhum layout geoespacial registrado para este projeto.</p>
        )}
      </CardBody>
    </Card>
  )
}

function AbaBESS() {
  return (
    <Card>
      <CardHeader>Sistema de Armazenamento (BESS)</CardHeader>
      <CardBody>
        <p className="text-slate-600">BESS em desenvolvimento...</p>
      </CardBody>
    </Card>
  )
}

function AbaFinanceiro({ projeto }) {
  return (
    <Card>
      <CardHeader>Análise Financeira</CardHeader>
      <CardBody>
        {projeto.dimensionamento ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-50 rounded">
              <p className="text-sm text-slate-600">Economia Anual</p>
              <p className="text-2xl font-bold text-emerald-600">R$ {parseFloat(projeto.dimensionamento.economiaAnual).toLocaleString('pt-BR')}</p>
            </div>
            <div className="p-4 bg-emerald-50 rounded">
              <p className="text-sm text-slate-600">Payback</p>
              <p className="text-2xl font-bold text-emerald-600">{projeto.dimensionamento.payback} anos</p>
            </div>
            <div className="p-4 bg-emerald-50 rounded">
              <p className="text-sm text-slate-600">Economia 25 anos</p>
              <p className="text-2xl font-bold text-emerald-600">R$ {(parseFloat(projeto.dimensionamento.economiaAnual) * 25).toLocaleString('pt-BR')}</p>
            </div>
          </div>
        ) : (
          <p className="text-slate-600">Aguardando dimensionamento...</p>
        )}
      </CardBody>
    </Card>
  )
}

function AbaHomologacao() {
  return (
    <Card>
      <CardHeader>Documentos de Homologação</CardHeader>
      <CardBody>
        <p className="text-slate-600">Homologação em desenvolvimento...</p>
      </CardBody>
    </Card>
  )
}
