import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle, BarChart3, Battery, FileText, Zap, Edit2, X, ShieldCheck, Briefcase, Users, Map } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import UnifilarFV from '../components/fv/UnifilarFV'
import PlanejadorTelhado from '../components/fv/PlanejadorTelhado'
import PreviewLayoutPano from '../components/fv/PreviewLayoutPano'
import GovernancaPainel from '../components/fv/GovernancaPainel'
import PropostaEnterprise from '../components/fv/PropostaEnterprise'
import ComparadorRevisoes from '../components/fv/ComparadorRevisoes'
import DocumentCenter from '../components/fv/DocumentCenter'
import CrmPainel from '../components/fv/CrmPainel'
import { getFreezeStatusConfig } from '../utils/engenhariaGovernanca'
import { getWorkflowConfig } from '../utils/comercialGovernanca'
import { getPipelineConfig } from '../utils/crmComercial'
import { tecnicosApi, vendedoresApi, registrarEventoPainel } from '../services/gestaoApi'
import { usePermissao } from '../hooks/usePermissao'
import { apenasAtivos } from '../utils/gestaoUtils'
import { formatarDataSegura } from '../utils/dataSegura'
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
    { id: 'documentos', label: 'Documentos', icone: FileText },
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
        {abaAtiva === 'resumo' && <><AbaResumo projeto={projeto} /><EquipeProjeto projeto={projeto} onAtualizar={carregarProjeto} /></>}
        {abaAtiva === 'layout' && <AbaLayout projeto={projeto} />}
        {abaAtiva === 'bess' && <AbaBESS />}
        {abaAtiva === 'financeiro' && <AbaFinanceiro projeto={projeto} />}
        {abaAtiva === 'unifilar' && <UnifilarFV projeto={projeto} />}
        {abaAtiva === 'governanca' && (
          <div className="space-y-6">
            <GovernancaPainel
              projetoId={id}
              governanca={projeto.governanca}
              onAtualizar={(g) => setProjeto(p => ({ ...p, governanca: g }))}
              usuario={null}
            />
            <ComparadorRevisoes
              governanca={projeto.governanca}
              onEvento={(acao, detalhe) => registrarEventoPainel(acao, detalhe, id, 'governanca')}
            />
          </div>
        )}
        {abaAtiva === 'documentos' && <DocumentCenter projeto={projeto} />}
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

// S7.2.1 / S8.3: equipe + validação de atribuição do RT (limite de potência/validade)
function EquipeProjeto({ projeto, onAtualizar }) {
  const [tecnicos, setTecnicos] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const { perfil, anonimo } = usePermissao()
  const podeExcecao = anonimo || ['administrador', 'diretor', 'admin'].includes(perfil)

  const projetoKwp = Number(projeto?.dimensionamento?.potenciaArredondada ?? projeto?.dimensionamento?.potencia_kwp ?? projeto?.potencia_kwp ?? 0)

  useEffect(() => {
    tecnicosApi.listar().then(setTecnicos).catch(() => {})
    vendedoresApi.listar().then(setVendedores).catch(() => {})
  }, [])

  // Avalia a atribuição de um técnico ao projeto
  function avaliarTecnico(t) {
    const venc = t.validade_carteira_profissional && new Date(t.validade_carteira_profissional) < new Date()
    const acimaLimite = t.potencia_max_kw && projetoKwp > Number(t.potencia_max_kw)
    return { vencido: !!venc, acimaLimite: !!acimaLimite }
  }

  async function patch(campo, valor, extra = {}) {
    setSalvando(true); setMsg('')
    try {
      const res = await fetch(`/api/projetos-fv/${projeto._id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo]: valor || null }),
      })
      if (!res.ok) throw new Error('Falha ao salvar')
      setMsg('Salvo!'); setTimeout(() => setMsg(''), 2000)
      onAtualizar?.()
    } catch (e) { setMsg(e.message) } finally { setSalvando(false) }
  }

  function selecionarTecnico(campo, id) {
    if (!id) return patch(campo, '')
    const t = tecnicos.find(x => x._id === id)
    if (!t) return
    const { vencido, acimaLimite } = avaliarTecnico(t)
    if (vencido) { setMsg('⚠ Registro profissional vencido — seleção bloqueada.'); return }
    if (acimaLimite) {
      if (!podeExcecao) { setMsg(`⚠ Responsável fora do limite (${t.potencia_max_kw} kW < ${projetoKwp} kWp).`); return }
      const just = window.prompt(`Atribuição EXCEDE o limite do RT (${t.potencia_max_kw} kW) para um projeto de ${projetoKwp} kWp.\nJustificativa (exceção Admin/Diretor):`, '')
      if (!just) return
      registrarEventoPainel('EXCECAO_RT', `${t.nome}: projeto ${projetoKwp}kWp > limite ${t.potencia_max_kw}kW — ${just}`, projeto._id, 'governanca')
    }
    registrarEventoPainel('RT_ALTERADO', `${campo}=${t.nome}`, projeto._id, 'governanca')
    patch(campo, id)
  }

  const sel = 'w-full px-2 py-1.5 rounded border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500'
  const optLabel = (t) => {
    const { vencido, acimaLimite } = avaliarTecnico(t)
    let s = `${t.nome}${t.registro ? ` (${t.tipo_registro} ${t.registro})` : ''}`
    if (t.potencia_max_kw) s += ` · até ${t.potencia_max_kw}kW`
    if (vencido) s += ' · VENCIDO'
    else if (acimaLimite) s += ' · ⚠ acima do limite'
    return s
  }

  return (
    <Card className="mt-6">
      <CardHeader className="flex items-center gap-2">
        <Users size={16} className="text-indigo-600" /> Equipe do Projeto ({projetoKwp} kWp)
        {msg && <span className="text-xs text-amber-600 ml-2">{msg}</span>}
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Vendedor</label>
            <select className={sel} disabled={salvando} value={projeto.vendedor_id?._id || projeto.vendedor_id || ''} onChange={e => patch('vendedor_id', e.target.value)}>
              <option value="">—</option>
              {apenasAtivos(vendedores).map(v => <option key={v._id} value={v._id}>{v.nome}</option>)}
            </select>
          </div>
          {['tecnico_principal_id', 'tecnico_secundario_id'].map((campo, i) => (
            <div key={campo}>
              <label className="text-xs text-slate-500 block mb-1">{i === 0 ? 'Técnico principal' : 'Técnico secundário'}</label>
              <select className={sel} disabled={salvando}
                value={projeto[campo]?._id || projeto[campo] || ''}
                onChange={e => selecionarTecnico(campo, e.target.value)}>
                <option value="">—</option>
                {apenasAtivos(tecnicos).map(t => {
                  const { vencido } = avaliarTecnico(t)
                  return <option key={t._id} value={t._id} disabled={vencido}>{optLabel(t)}</option>
                })}
              </select>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          RT acima do limite só pode ser atribuído por Admin/Diretor com justificativa (auditada). Registro vencido bloqueia a seleção.
        </p>
      </CardBody>
    </Card>
  )
}

function AbaResumo({ projeto }) {
  return (
    <div className="space-y-6">
      {/* S8.4: Bandeira de projeto legado / pendente de revisão */}
      {(projeto.legacy || projeto.necessita_revisao) && (
        <div className="border border-amber-300 bg-amber-50 rounded p-3 flex items-start gap-2">
          <span className="text-amber-600 mt-0.5">⚠</span>
          <div className="flex-1 text-sm text-amber-900">
            <p className="font-medium">Projeto criado em versão antiga</p>
            {Array.isArray(projeto.legacy_motivos) && projeto.legacy_motivos.length > 0 && (
              <p className="text-xs mt-0.5">Sinalizadores: {projeto.legacy_motivos.join(', ')}</p>
            )}
            <div className="flex gap-2 mt-2">
              <button onClick={() => window.location.assign(`/projetos-fv/${projeto._id}?wizard=1`)}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs">Completar dados</button>
              <button onClick={() => { /* no-op: o usuário continua visualizando */ }}
                className="px-3 py-1 border border-amber-400 text-amber-800 hover:bg-amber-100 rounded text-xs">Continuar</button>
            </div>
          </div>
        </div>
      )}
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
              <p className="font-semibold text-slate-900">{formatarDataSegura(projeto.dataCriacao ?? projeto.createdAt)}</p>
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
            {panos.some(p => p.layout_preview) && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {panos.filter(p => p.layout_preview).map((p, i) => (
                  <div key={i} className="border border-slate-200 rounded-lg p-2">
                    <p className="text-xs font-semibold text-slate-600 mb-1">{p.nome}</p>
                    <PreviewLayoutPano pano={p} compacto />
                  </div>
                ))}
              </div>
            )}
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
