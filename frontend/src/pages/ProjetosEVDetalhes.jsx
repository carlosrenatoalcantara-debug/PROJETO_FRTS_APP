import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Zap, Edit2, X, Trash2, Pencil, User, MapPin, Ruler, Package, Wrench, DollarSign, FileText, FileDown, MessageCircle, Mail, Printer } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import InteractiveDiagram from '../components/diagram/InteractiveDiagram'
import { deletarDiagramaLocal } from '../components/diagram/utils/diagramPersistence'
import { adaptarProjetoEV, construirCanonicalEV, construirCanonicalDeProjetoEV } from '../utils/adapterDiagramaEV'
import { build, computeLayout, toReactFlow, overridesDeReactFlow, renderSVG } from '@diagram-engine'
import { calcularOrcamento, subtotalItem } from '../utils/calcularOrcamento'
import { normalizarPolitica, margemDaPolitica, flagsApresentacao } from '../utils/politicaComercial'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway. Não usar VITE_API_URL */
const brl = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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

// P3-F3: monta os argumentos do adapter EV a partir do projeto persistido.
// Única ponte projeto→Engine; usada ao abrir e ao salvar o editor.
function montarArgsEV(projeto) {
  const calculos = projeto?.calculos_nbr || {}
  const carregador = projeto?.carregadores?.[0] || {}
  const clienteNome = typeof projeto?.clienteId === 'object' ? projeto?.clienteId?.nome : projeto?.clienteId
  return {
    calculos: { ...calculos, comprimento_cabo_m: projeto?.comprimento_cabo_m },
    bom: calculos?.materiais || projeto?.bom || [],
    numero_fases: Number(carregador?.numero_fases) || Number(projeto?.fases) || 1,
    carregador,
    projeto: {
      nome: projeto?.nome,
      cliente_nome: clienteNome,
      endereco: projeto?.endereco_completo,
      comprimento_cabo_m: projeto?.comprimento_cabo_m,
      tecnico_nome: projeto?.tecnico?.nome,
      tecnico_crea: projeto?.tecnico?.crea,
      tecnico_cft: projeto?.tecnico?.cft,
      estado: projeto?.estado,
      tipo_instalacao: projeto?.tipo_instalacao,
      ambiente: projeto?.ambiente,
      subsolo: projeto?.subsolo,
    },
  }
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
  const [editorInitial, setEditorInitial] = useState(null)   // { nodes, edges, viewport } do Engine
  const [editorCanonical, setEditorCanonical] = useState(null) // JSON canônico (fundo executivo)
  const [editorViewport, setEditorViewport] = useState(null) // viewport corrente (zoom/pan)

  // Callback estável para evitar loop infinito no InteractiveDiagram
  const handleDiagramChange = useCallback((diagramData) => {
    setDiagramaEditado(diagramData)
  }, [])
  const handleViewportChange = useCallback((vp) => { setEditorViewport(vp) }, [])

  useEffect(() => {
    carregarProjeto()
  }, [id])

  // FEATURE-003 — hooks ANTES de qualquer early-return (Regra dos Hooks). Null-safe.
  const resumo = useMemo(() => {
    const o = projeto?.orcamento || {}
    // FEATURE-004: usa a Política Comercial salva (margem por categoria + impostos). Sem política → FEATURE-002.
    const pol = (o.politica || projeto?.politica_comercial) ? normalizarPolitica(o.politica || projeto.politica_comercial) : null
    return calcularOrcamento({
      equipamentos: o.equipamentos || [], materiais: o.materiais || [], servicos: o.servicos || [], desconto_pct: o.desconto_pct ?? 0,
      ...(pol ? { margem: margemDaPolitica(pol), impostos_pct: pol.impostos_pct } : { margem_pct: o.margem_pct ?? 0, impostos_pct: o.impostos_pct ?? 0 }),
    })
  }, [projeto])
  const unifilarSVG = useMemo(() => {
    if (!projeto) return null
    try { return renderSVG(construirCanonicalDeProjetoEV(projeto)) } catch { return null }
  }, [projeto])

  const carregarProjeto = async () => {
    try {
      setCarregando(true)
      const response = await fetch(`${API_URL}/api/projetos-ev/${id}`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Projeto não encontrado`)
      }

      const dados = await response.json()
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

  // Monta o payload canônico do diagrama para persistir (version/viewport/metadata/overrides).
  const montarPayloadDiagrama = (canonical, rf) => ({
    diagrama_editado: {
      version: canonical.version,
      viewport: canonical.viewport,
      metadata: canonical.metadata,
      overrides: canonical.overrides || {},
      nodes: rf.nodes,
      edges: rf.edges,
      timestamp: new Date().toISOString(),
    },
  })

  // Abrir editor — HIDRATA do DiagramEngine (REQUISITO 1).
  // Reconstrói o layout base pelo Engine, aplica overrides salvos e abre exatamente
  // como foi salvo. Nunca abre em branco. Se não houver diagrama, gera e persiste 1x.
  const abrirEditorDiagrama = async () => {
    const persistido = projeto?.diagrama_editado
    const overrides = persistido?.overrides || {}
    const viewport = persistido?.viewport || null
    // BUG-016: usa o template fixo (construirCanonicalEV aplica as posições do template
    // como base). Editor abre com a MESMA geometria do SVG/PDF.
    const canonical = construirCanonicalEV(montarArgsEV(projeto), { viewport, overrides })
    const rf = toReactFlow(canonical)

    setEditorInitial(rf)
    setEditorCanonical(canonical)
    setEditorViewport(rf.viewport)
    setDiagramaEditado({ nodes: rf.nodes, edges: rf.edges })
    setModalEditorAberto(true)

    // persist-once (REQUISITO 1): projeto legado sem canônico → grava uma única vez.
    // Nunca sobrescreve um diagrama existente (só grava se não houver version).
    if (!persistido?.version) {
      try {
        await fetch(`${API_URL}/api/projetos-ev/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(montarPayloadDiagrama(canonical, rf)),
        })
      } catch (e) {
        console.warn('[EV] persist-once do diagrama falhou:', e?.message)
      }
    }
  }

  // Fechar editor sem salvar
  const fecharEditorDiagrama = () => {
    setModalEditorAberto(false)
    setDiagramaEditado(null)
    setEditorInitial(null)
    setEditorCanonical(null)
  }

  // Salvar diagrama editado — persiste APENAS version/viewport/metadata/overrides
  // (REQUISITO 3). O Engine recalcula a base; overrides são derivados das posições
  // movidas manualmente e os órfãos são podados pelo build() (REQUISITO 4).
  const salvarDiagramaEditado = async () => {
    if (!diagramaEditado) return
    try {
      setSalvandoDiagrama(true)
      // BUG-016: a base do override é o layout do TEMPLATE (não computeLayout), para o
      // editor persistir apenas os deslocamentos manuais em relação ao template fixo.
      const base = construirCanonicalEV(montarArgsEV(projeto)).layout
      const overrides = overridesDeReactFlow(diagramaEditado.nodes || [], base)
      const canonical = construirCanonicalEV(montarArgsEV(projeto), { viewport: editorViewport, overrides })
      const rf = toReactFlow(canonical)

      const response = await fetch(`${API_URL}/api/projetos-ev/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(montarPayloadDiagrama(canonical, rf)),
      })
      if (!response.ok) throw new Error('Erro ao salvar diagrama no servidor')

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

  // BUG-010: excluir o PROJETO definitivamente (confirma → DELETE → volta à lista)
  const [excluindo, setExcluindo] = useState(false)
  const excluirProjeto = async () => {
    if (!window.confirm(`Excluir definitivamente o projeto "${projeto?.nome || ''}"?\n\nEsta ação remove o projeto do banco de dados e não pode ser desfeita.`)) return
    try {
      setExcluindo(true)
      const res = await fetch(`${API_URL}/api/projetos-ev/${id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.erro || data?.mensagem || `HTTP ${res.status}`)
      }
      // BUG-019: sem registros órfãos — remove também o diagrama local deste projeto.
      try { deletarDiagramaLocal(`projeto-ev-${id}`) } catch { /* best-effort */ }
      // BUG-019: retornar ao CLIENTE (de onde o projeto é aberto); a lista é recarregada lá.
      const cid = typeof projeto?.clienteId === 'object' ? projeto?.clienteId?._id : projeto?.clienteId
      navigate(cid ? `/clientes/${cid}` : '/projetos-ev')
    } catch (err) {
      console.error('❌ Erro ao excluir projeto EV:', err)
      alert(`Erro ao excluir projeto: ${err.message}`)
      setExcluindo(false)
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

  // FEATURE-003 — dados de apresentação (sem edição)
  const clienteObj = typeof projeto.clienteId === 'object' ? projeto.clienteId : null
  const orcamento = projeto?.orcamento || {}
  const equipamentos = orcamento.equipamentos || []
  const materiais = orcamento.materiais || []
  const servicos = orcamento.servicos || []
  // FEATURE-004: modo de apresentação vem da política (ou compat mostrar_materiais_detalhados)
  const politicaView = (orcamento.politica || projeto?.politica_comercial) ? normalizarPolitica(orcamento.politica || projeto.politica_comercial) : null
  const modoView = politicaView?.modo_apresentacao || (orcamento.mostrar_materiais_detalhados === false ? 'resumo' : 'detalhada_com_precos')
  const ap = flagsApresentacao(modoView)
  const mostrarDetalhes = ap.itens

  const potenciaTotal = (projeto?.carregadores || []).reduce((s, c) => s + (Number(c.potencia_kw) || 0) * (Number(c.quantidade) || 1), 0)
  const tecnicoLinha = `${projeto?.tecnico?.nome || '—'} — ${projeto?.tecnico?.tipo_profissional === 'cft' ? `CFT ${projeto?.tecnico?.cft || ''}` : `CREA ${projeto?.tecnico?.crea || ''}`}`

  // ── AÇÕES ────────────────────────────────────────────────────────────────
  // Texto comercial (WhatsApp / e-mail) — respeita o detalhamento (FEATURE-002 ITEM 3)
  const textoProposta = () => {
    const l = [
      `*Proposta Comercial — ${nome}*`,
      `Cliente: ${clienteNome}`,
      `Local: ${projeto?.endereco_completo || '—'}`,
      '',
      `Carregador: ${carregador ? `${carregador.marca || ''} ${carregador.modelo || ''}`.trim() : '—'} (${potenciaTotal}kW)`,
      `Equipamentos: ${brl(resumo.subtotal_equipamentos)}`,
    ]
    if (mostrarDetalhes && materiais.length) {
      l.push('Materiais:'); materiais.forEach((it) => l.push(`  • ${it.descricao} — ${it.quantidade} ${it.unidade || ''}`))
      l.push(`  Subtotal materiais: ${brl(resumo.materiais_com_margem)}`)
    } else l.push(`Materiais: ${brl(resumo.materiais_com_margem)}`)
    l.push(`Serviços: ${brl(resumo.subtotal_servicos)}`)
    if (resumo.impostos_valor > 0) l.push(`Impostos: ${brl(resumo.impostos_valor)}`)
    l.push('', `*Valor final: ${brl(resumo.preco_final)}*`, '', `Resp. técnico: ${tecnicoLinha}`)
    return l.join('\n')
  }
  const enviarWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(textoProposta())}`, '_blank', 'noopener')
  const enviarEmail = () => { window.location.href = `mailto:?subject=${encodeURIComponent(`Proposta Comercial — ${nome}`)}&body=${encodeURIComponent(textoProposta().replace(/\*/g, ''))}` }
  const imprimir = () => window.print()

  const baixarPDFExecutivo = async () => {
    try {
      const r = await fetch(`${API_URL}/api/projetos-ev/${id}/pdf`)
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.mensagem || e.erro || `HTTP ${r.status}`) }
      const blob = await r.blob(); const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `Unifilar_${nome.replace(/\s+/g, '_')}.pdf`; a.click()
      window.URL.revokeObjectURL(url)
    } catch (e) { alert(`Erro ao gerar PDF executivo: ${e.message}`) }
  }

  const gerarPDFComercial = () => {
    const win = window.open('', '_blank'); if (!win) { alert('Permita pop-ups para gerar o PDF.'); return }
    const linhas = (arr) => arr.map((it) => `<tr><td>${it.descricao}</td><td style="text-align:center">${it.quantidade} ${it.unidade || ''}</td><td style="text-align:right">${brl(subtotalItem(it))}</td></tr>`).join('')
    win.document.write(`<html><head><title>Proposta — ${nome}</title><style>
      body{font-family:Arial,sans-serif;color:#1e293b;padding:32px;max-width:900px;margin:auto}
      h1{font-size:20px;border-bottom:2px solid #2563eb;padding-bottom:8px}h2{font-size:14px;color:#475569;margin-top:20px}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}td,th{border-bottom:1px solid #e2e8f0;padding:6px 4px;text-align:left}
      .total{font-size:18px;font-weight:bold;color:#059669;text-align:right;margin-top:16px}.meta{font-size:12px;color:#64748b}</style></head><body>
      <h1>Proposta Comercial — ${nome}</h1>
      <p class="meta"><b>Cliente:</b> ${clienteNome}<br/><b>Local:</b> ${projeto?.endereco_completo || '—'}<br/>
      <b>Carregador:</b> ${carregador ? `${carregador.marca || ''} ${carregador.modelo || ''}`.trim() : '—'} — ${potenciaTotal}kW</p>
      <h2>Equipamentos</h2><table>${linhas(equipamentos)}</table>
      <h2>Materiais</h2>${mostrarDetalhes ? `<table>${linhas(materiais)}</table>` : `<table><tr><td>Materiais</td><td style="text-align:right">${brl(resumo.materiais_com_margem)}</td></tr></table>`}
      <h2>Serviços</h2><table>${linhas(servicos)}</table>
      <h2>Composição</h2><table>
        <tr><td>Equipamentos</td><td style="text-align:right">${brl(resumo.subtotal_equipamentos)}</td></tr>
        <tr><td>Materiais</td><td style="text-align:right">${brl(resumo.subtotal_materiais)}</td></tr>
        <tr><td>Margem Materiais (${resumo.margem_pct}%)</td><td style="text-align:right">+ ${brl(resumo.margem_valor)}</td></tr>
        <tr><td><b>Subtotal Materiais</b></td><td style="text-align:right"><b>${brl(resumo.materiais_com_margem)}</b></td></tr>
        <tr><td>Serviços</td><td style="text-align:right">${brl(resumo.subtotal_servicos)}</td></tr>
        <tr><td>Impostos (${resumo.impostos_pct}%)</td><td style="text-align:right">+ ${brl(resumo.impostos_valor)}</td></tr>
        ${resumo.desconto_pct > 0 ? `<tr><td>Desconto (${resumo.desconto_pct}%)</td><td style="text-align:right">- ${brl(resumo.desconto_valor)}</td></tr>` : ''}
      </table>
      <p class="total">Valor Final: ${brl(resumo.preco_final)}</p>
      <p class="meta">Resp. técnico: ${tecnicoLinha}</p></body></html>`)
    win.document.close(); win.focus(); setTimeout(() => win.print(), 300)
  }

  const linhaResumo = (label, valor, bold) => (
    <div className={`flex justify-between text-sm ${bold ? 'font-bold border-t border-slate-300 pt-1' : ''}`}>
      <span className={bold ? 'text-slate-900' : 'text-slate-500'}>{label}</span>
      <span className={`font-mono ${bold ? 'text-emerald-700' : ''}`}>{valor}</span>
    </div>
  )
  const Campo = ({ rotulo, valor }) => (
    <div><p className="text-sm text-slate-500">{rotulo}</p><p className="text-lg font-medium text-slate-900">{valor}</p></div>
  )

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
          <p className="text-slate-500 mt-1">ID: {id_projeto} · {tipoCarregamento} · Atualizado {dataAtualizacao}</p>
        </div>
        <Badge cor={corStatus[status] || 'cinza'}>{statusLabel[status] || status}</Badge>
      </div>

      {/* AÇÕES — apresentação/conferência (FEATURE-003) */}
      <Card className="print:hidden">
        <CardBody className="flex flex-wrap gap-2">
          <Button icone={Pencil} onClick={() => navigate(`/projetos-ev/${id}/editar`)}
            title="Abre o wizard exatamente no estado salvo (não reinicia)">Editar Projeto</Button>
          <Button variante="secundario" icone={FileText} onClick={gerarPDFComercial}>PDF Comercial</Button>
          <Button variante="secundario" icone={FileDown} onClick={baixarPDFExecutivo}>PDF Executivo</Button>
          <Button variante="secundario" icone={MessageCircle} onClick={enviarWhatsApp} className="text-emerald-700">WhatsApp</Button>
          <Button variante="secundario" icone={Mail} onClick={enviarEmail}>Email</Button>
          <Button variante="secundario" icone={Printer} onClick={imprimir}>Imprimir</Button>
          <div className="flex-1" />
          <Button variante="secundario" icone={Edit2} onClick={abrirEditorDiagrama} title="Editar diagrama técnico">Editar Diagrama</Button>
          <Button variante="secundario" icone={Trash2} onClick={excluirProjeto} disabled={excluindo}
            className="text-red-600 hover:bg-red-50 border-red-200">{excluindo ? 'Excluindo…' : 'Excluir'}</Button>
        </CardBody>
      </Card>

      {/* 1 · CLIENTE */}
      <Card>
        <CardHeader><h2 className="flex items-center gap-2 font-semibold text-slate-900"><User size={16} className="text-blue-500" /> Cliente</h2></CardHeader>
        <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Campo rotulo="Nome" valor={clienteNome} />
          <Campo rotulo="CPF/CNPJ" valor={clienteObj?.cpf || clienteObj?.cnpj || 'N/A'} />
          <Campo rotulo="Responsável técnico" valor={tecnicoLinha} />
          <Campo rotulo="Criado em" valor={dataCriacao} />
        </CardBody>
      </Card>

      {/* 2 · LOCAL DA INSTALAÇÃO */}
      <Card>
        <CardHeader><h2 className="flex items-center gap-2 font-semibold text-slate-900"><MapPin size={16} className="text-blue-500" /> Local da instalação</h2></CardHeader>
        <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2"><Campo rotulo="Endereço" valor={projeto?.endereco_completo || 'N/A'} /></div>
          {projeto?.latitude != null && <Campo rotulo="Latitude" valor={projeto.latitude} />}
          {projeto?.longitude != null && <Campo rotulo="Longitude" valor={projeto.longitude} />}
        </CardBody>
      </Card>

      {/* 3 · DADOS DO CARREGADOR */}
      {carregador && (
        <Card>
          <CardHeader><h2 className="flex items-center gap-2 font-semibold text-slate-900"><Zap size={16} className="text-blue-500" /> Dados do carregador</h2></CardHeader>
          <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Campo rotulo="Tipo" valor={carregador.tipo === 'AC_Mono' ? 'AC Monofásico' : carregador.tipo === 'AC_Tri' ? 'AC Trifásico' : (carregador.tipo || 'N/A')} />
            <Campo rotulo="Potência" valor={`${carregador.potencia_kw || 0} kW`} />
            <Campo rotulo="Marca" valor={carregador.marca || 'N/A'} />
            <Campo rotulo="Modelo" valor={carregador.modelo || 'N/A'} />
            <Campo rotulo="Quantidade" valor={carregador.quantidade || 0} />
            <Campo rotulo="Tensão" valor={carregador.tensao_entrada_v != null ? `${carregador.tensao_entrada_v} V` : 'N/A'} />
            <Campo rotulo="Corrente nominal" valor={carregador.corrente_entrada_a != null ? `${carregador.corrente_entrada_a} A` : 'N/A'} />
            <Campo rotulo="Conector" valor={carregador.tipo_conector || 'N/A'} />
          </CardBody>
        </Card>
      )}

      {/* 4 · ENGENHARIA */}
      <Card>
        <CardHeader><h2 className="flex items-center gap-2 font-semibold text-slate-900"><Ruler size={16} className="text-blue-500" /> Engenharia</h2></CardHeader>
        <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Campo rotulo="Comprimento do percurso" valor={projeto?.comprimento_cabo_m != null ? `${projeto.comprimento_cabo_m} m` : 'N/A'} />
          <Campo rotulo="Pontos de recarga" valor={projeto?.quantidade_pontos ?? (projeto?.carregadores?.length || 0)} />
          <Campo rotulo="Potência total" valor={`${projeto?.potencia_total_kw ?? potenciaTotal} kW`} />
          <Campo rotulo="Fases" valor={carregador?.numero_fases || projeto?.fases || 'N/A'} />
        </CardBody>
      </Card>

      {/* 5 · CÁLCULOS NBR */}
      {Object.keys(calculos).length > 0 && (
        <Card>
          <CardHeader><h2 className="font-semibold text-slate-900">Cálculos (NBR)</h2></CardHeader>
          <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Campo rotulo="Corrente Projeto" valor={`${calculos.corrente_projeto_a || 0} A`} />
            <Campo rotulo="Corrente Máxima" valor={`${calculos.corrente_maxima_a || 0} A`} />
            <Campo rotulo="Bitola do Cabo" valor={`${calculos.bitola_cabo_mm2 || 0} mm²`} />
            <Campo rotulo="Disjuntor" valor={`${calculos.disjuntor_a || 0} A`} />
            <Campo rotulo="DR" valor={`${calculos.dr_ma || 0} mA`} />
            <Campo rotulo="Queda de Tensão" valor={`${calculos.queda_tensao_pct || 0} %`} />
          </CardBody>
        </Card>
      )}

      {/* 6 · EQUIPAMENTOS */}
      <Card>
        <CardHeader><h2 className="flex items-center gap-2 font-semibold text-slate-900"><Package size={16} className="text-blue-500" /> Equipamentos <span className="text-slate-400 font-normal text-sm">({brl(resumo.subtotal_equipamentos)})</span></h2></CardHeader>
        <CardBody>
          {equipamentos.length === 0 ? <p className="text-slate-400 text-sm">Nenhum equipamento.</p> : (
            <ul className="text-sm text-slate-600 divide-y divide-slate-100">
              {equipamentos.map((it, i) => (
                <li key={i} className="flex justify-between py-1"><span>{it.descricao} <span className="text-slate-400">· {it.quantidade} {it.unidade}</span></span><span className="font-mono">{brl(subtotalItem(it))}</span></li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* 7 · MATERIAIS — respeita o detalhamento (FEATURE-002 ITEM 3) */}
      <Card>
        <CardHeader><h2 className="flex items-center gap-2 font-semibold text-slate-900"><Wrench size={16} className="text-blue-500" /> Materiais <span className="text-slate-400 font-normal text-sm">({brl(resumo.materiais_com_margem)})</span></h2></CardHeader>
        <CardBody>
          {!mostrarDetalhes ? (
            <div className="flex justify-between text-sm text-slate-700"><span>Materiais</span><span className="font-mono font-semibold">{brl(resumo.materiais_com_margem)}</span></div>
          ) : materiais.length === 0 ? <p className="text-slate-400 text-sm">Nenhum material.</p> : (
            <ul className="text-sm text-slate-600 divide-y divide-slate-100">
              {materiais.map((it, i) => (
                <li key={i} className="flex justify-between py-1"><span>{it.descricao} <span className="text-slate-400">· {it.quantidade} {it.unidade}</span></span><span className="font-mono">{brl(subtotalItem(it))}</span></li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* 8 · SERVIÇOS */}
      <Card>
        <CardHeader><h2 className="flex items-center gap-2 font-semibold text-slate-900"><Wrench size={16} className="text-blue-500" /> Serviços <span className="text-slate-400 font-normal text-sm">({brl(resumo.subtotal_servicos)})</span></h2></CardHeader>
        <CardBody>
          {servicos.length === 0 ? <p className="text-slate-400 text-sm">Nenhum serviço.</p> : (
            <ul className="text-sm text-slate-600 divide-y divide-slate-100">
              {servicos.map((it, i) => (
                <li key={i} className="flex justify-between py-1"><span>{it.descricao}</span><span className="font-mono">{brl(subtotalItem(it))}</span></li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* 9 · RESUMO FINANCEIRO — composição FEATURE-002 (margem só materiais + impostos) */}
      <Card>
        <CardHeader><h2 className="flex items-center gap-2 font-semibold text-slate-900"><DollarSign size={16} className="text-emerald-600" /> Resumo Financeiro</h2></CardHeader>
        <CardBody className="space-y-1 max-w-md">
          {linhaResumo('Equipamentos', brl(resumo.subtotal_equipamentos))}
          {linhaResumo('Materiais', brl(resumo.subtotal_materiais))}
          {linhaResumo(`Margem Materiais (${resumo.margem_pct}%)`, `+ ${brl(resumo.margem_valor)}`)}
          {linhaResumo('Subtotal Materiais', brl(resumo.materiais_com_margem), true)}
          {linhaResumo('Serviços', brl(resumo.subtotal_servicos))}
          {linhaResumo(`Impostos (${resumo.impostos_pct}%)`, `+ ${brl(resumo.impostos_valor)}`)}
          {resumo.desconto_pct > 0 && linhaResumo(`Desconto (${resumo.desconto_pct}%)`, `− ${brl(resumo.desconto_valor)}`)}
          {linhaResumo('Valor Final', brl(resumo.preco_final), true)}
        </CardBody>
      </Card>

      {/* 10 · UNIFILAR — somente exibir (read-only). Nenhuma edição/melhoria. */}
      <Card>
        <CardHeader><h2 className="font-semibold text-slate-900">Unifilar</h2></CardHeader>
        <CardBody>
          {unifilarSVG ? (
            <div className="border border-slate-200 rounded-lg overflow-auto bg-white" style={{ maxHeight: 520 }}
              dangerouslySetInnerHTML={{ __html: unifilarSVG }} />
          ) : <p className="text-slate-400 text-sm">Unifilar indisponível.</p>}
        </CardBody>
      </Card>

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

            {/* Conteúdo do Modal — altura concreta para o React Flow medir o canvas
                (sem altura, RF não posiciona handles e as edges não renderizam). */}
            <div className="flex-1 overflow-hidden bg-slate-50" style={{ minHeight: 0, height: '70vh' }}>
              <InteractiveDiagram
                initial={editorInitial}
                canonical={editorCanonical}
                onDiagramChange={handleDiagramChange}
                onViewportChange={handleViewportChange}
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
