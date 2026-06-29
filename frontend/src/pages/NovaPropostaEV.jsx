/**
 * NovaPropostaEV.jsx — Sprint P2-EV-WORKFLOW-ENGINEERING-01
 *
 * Workflow reduzido de 5 para 4 etapas:
 *   1. Localização
 *   2. Carregador + Engenharia  ← cálculo automático + BOM editável
 *   3. Orçamento                ← apenas apresentação + preços (sem recalcular)
 *   4. Unifilar                 ← gerado automaticamente ao entrar na etapa
 *
 * Etapa "Cálculos NBR" eliminada. Toda engenharia acontece em tempo real
 * ao selecionar o carregador e informar o comprimento do percurso.
 *
 * BUG P6 (perda de foco): tabela BOM implementada com mapeamento direto
 * em JSX — sem sub-componente declarado dentro do render. Identidade
 * estável, sem unmount/mount a cada keystroke.
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapPin, Zap, FileText, Download, Plus, X, Edit2, DollarSign, AlertTriangle, ChevronRight, Ruler } from 'lucide-react'
import OrcamentoEV, { DEFAULT_SERVICOS_EV, bomParaMateriais, carregadoresParaEquipamentos } from '../components/ev/OrcamentoEV'
import PropostaComercialEV from '../components/ev/PropostaComercialEV'
import { calcularOrcamento } from '../utils/calcularOrcamento'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Stepper from '../components/ui/Stepper'
import ModalNovoCarregadorEV from '../components/equipamentos/ModalNovoCarregadorEV'
import InteractiveDiagram from '../components/diagram/InteractiveDiagram'
import { calcularParametrosNBR5410, validarNBR5410 } from '../services/calculosNBR5410EV'
import { gerarUnifilarEVSVG } from '../utils/gerarUnifilarEV'
import { construirCanonicalEV, renderarSVGEV, toReactFlow } from '../utils/adapterDiagramaEV'
import { renderSVG } from '@diagram-engine'
import { salvarDiagramaLocal } from '../components/diagram/utils/diagramPersistence'
import { tecnicosApi } from '../services/gestaoApi'
import { apenasAtivos } from '../utils/gestaoUtils'
import { listarAtivos as listarMateriaisAtivos } from '../services/materiaisApi'

const API_URL = '' /* URL relativa — Vercel proxy → Railway */

const ETAPAS = [
  { num: 1, rotulo: 'Localização',            icone: MapPin    },
  { num: 2, rotulo: 'Carregador + Engenharia', icone: Zap       },
  { num: 3, rotulo: 'Orçamento',              icone: DollarSign },
  { num: 4, rotulo: 'Unifilar',               icone: FileText   },
]

export default function NovaPropostaEV() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const clienteId = searchParams.get('clienteId')

  // ── Estados principais ──────────────────────────────────────────────────
  const [etapa, setEtapa] = useState(1)
  const [carregadores, setCarregadores] = useState([])
  const [carregadoresDisponiveis, setCarregadoresDisponiveis] = useState([])
  const [carregadoresErro, setCarregadoresErro] = useState(null)
  const [calculos, setCalculos] = useState(null)
  // ── Fonte única da verdade do orçamento (vive no pai, sobrevive à navegação) ─
  const [orcamento, setOrcamento] = useState({
    equipamentos: [],
    materiais: [],
    servicos: DEFAULT_SERVICOS_EV,
    margem_pct: 20,
    desconto_pct: 0,
  })
  const [statusComercial, setStatusComercial] = useState('rascunho')
  const [incluirMobBox, setIncluirMobBox] = useState(false)
  const [unifilar, setUnifilar] = useState(null)
  const [canonical, setCanonical] = useState(null)   // JSON canônico do DiagramEngine (fonte única)
  const [modalUploadAberto, setModalUploadAberto] = useState(false)
  const [responsaveisTecnicos, setResponsaveisTecnicos] = useState([])
  const [tecnicoSelecionado, setTecnicoSelecionado] = useState('')
  const [rtCarregando, setRtCarregando] = useState(true)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [diagramaEditado, setDiagramaEditado] = useState(null)
  const [draftId] = useState(() => `ev-draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)

  const [dados, setDados] = useState({
    nome_projeto: '',
    cliente_nome: '',
    endereco: '',
    latitude: null,
    longitude: null,
    carregadores: [],
    comprimento_cabo_m: 25,
    tecnico_nome: '',
    tecnico_crea: '',
    tecnico_cft: '',
    tecnico_tipo: 'crea',
  })

  const [catalogoItems, setCatalogoItems] = useState([])

  // ── Catálogo Mestre — carrega materiais ativos para enriquecer preços ────
  useEffect(() => {
    listarMateriaisAtivos().then(setCatalogoItems).catch(() => {})
  }, [])

  // ── Técnicos responsáveis ────────────────────────────────────────────────
  useEffect(() => {
    let vivo = true
    setRtCarregando(true)
    tecnicosApi.listar()
      .then(lista => {
        if (!vivo) return
        setRtCarregando(false)
        const aptos = apenasAtivos(lista)
        setResponsaveisTecnicos(aptos)
        if (aptos.length > 0) {
          const comEV   = aptos.find(t => Array.isArray(t.especialidades) && t.especialidades.includes('EV'))
          const escolhido = comEV || aptos[0]
          setTecnicoSelecionado(escolhido._id)
          const ehCrea = (escolhido.tipo_registro || '').toUpperCase() === 'CREA'
          const registro = escolhido.registro || ''   // backend pode retornar null → '' (evita warning controlled input)
          setDados(prev => ({
            ...prev,
            tecnico_nome: escolhido.nome || '',
            tecnico_crea: ehCrea ? registro : '',
            tecnico_cft: !ehCrea ? registro : '',
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
        const salvo = localStorage.getItem('tecnico_dados')
        if (salvo) {
          try {
            const t = JSON.parse(salvo)
            setDados(prev => ({ ...prev, tecnico_nome: t.nome || '', tecnico_crea: t.crea || '', tecnico_cft: t.cft || '', tecnico_tipo: t.tipo || 'crea' }))
          } catch {}
        }
      })
    return () => { vivo = false }
  }, [])

  // ── Carregar cliente ────────────────────────────────────────────────────
  useEffect(() => {
    if (!clienteId) return
    fetch(`${API_URL}/api/clientes/${clienteId}`)
      .then(r => r.json())
      .then(c => setDados(prev => ({ ...prev, cliente_nome: c.nome || '', endereco: c.endereco_completo || '' })))
      .catch(console.error)
  }, [clienteId])

  // ── Carregar catálogo ───────────────────────────────────────────────────
  const carregarCarregadores = () => {
    setCarregadoresErro(null)
    fetch(`${API_URL}/api/carregadores-ev`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(data => setCarregadoresDisponiveis(Array.isArray(data) ? data : (data?.itens || [])))
      .catch(err => { setCarregadoresDisponiveis([]); setCarregadoresErro(err.message || 'Falha na conexão') })
  }

  useEffect(() => { carregarCarregadores() }, [])

  // ── CÁLCULO AUTOMÁTICO ───────────────────────────────────────────────────
  // Dispara sempre que os carregadores selecionados ou o comprimento mudam.
  // ── Enriquecimento de preços via Catálogo Mestre ─────────────────────────
  // Mapeamento de categoria BOM → categoria(s) do catálogo
  const CAT_BOM_PARA_CATALOGO = {
    Cabos: ['cabos'],
    Proteções: ['protecao_eletrica', 'quadros_barramentos'],
    Equipamentos: ['quadros_barramentos'],
    Infraestrutura: ['conexoes_infraestrutura', 'fixacao'],
    Conexões: ['conexoes_infraestrutura'],
    Diversos: ['fixacao'],
  }

  function encontrarNoCatalogo(bomItem, catalogo) {
    const cats = CAT_BOM_PARA_CATALOGO[bomItem.categoria] || []
    const candidatos = cats.length ? catalogo.filter(m => cats.includes(m.categoria)) : catalogo

    // Extrai "Xmm²" do descricao para match por bitola (cabos e terminais)
    const bitolaMatch = bomItem.descricao.match(/(\d+(?:[.,]\d+)?)mm²/)
    const bitolaStr = bitolaMatch ? bitolaMatch[1].replace(',', '.') : null

    if (bitolaStr) {
      // Primeiro tenta match por bitola exata
      const porBitola = candidatos.find(c => c.descricao.includes(`${bitolaStr}mm²`))
      if (porBitola) return porBitola
    }

    // Nome do item: tudo antes do primeiro " (" (remove especificação)
    const nomeItem = bomItem.descricao.split(' (')[0].toLowerCase().trim()
    return candidatos.find(c => {
      const cd = c.descricao.toLowerCase()
      return cd.includes(nomeItem) || nomeItem.includes(cd)
    }) || null
  }

  function enriquecerComCatalogo(materiais, catalogo) {
    if (!catalogo.length) return materiais
    return materiais.map(m => {
      const encontrado = encontrarNoCatalogo(m, catalogo)
      if (!encontrado) return { ...m, nao_cadastrado: true }
      const preco = encontrado.precoReferencia?.valor ?? 0
      return { ...m, preco_unitario: preco, material_id: encontrado._id, nao_cadastrado: !preco }
    })
  }

  // Reseta o BOM editável para refletir os novos parâmetros elétricos.
  useEffect(() => {
    if (carregadores.length === 0) {
      setCalculos(null)
      setOrcamento(prev => ({ ...prev, materiais: [], equipamentos: [] }))
      return
    }

    const potencia_total = carregadores.reduce((s, c) => s + (Number(c.potencia_kw) || 0) * (Number(c.quantidade) || 1), 0)
    const primeiro = carregadores[0]

    try {
      const resultado = calcularParametrosNBR5410({
        potencia_kw:       potencia_total,
        tensao_entrada_v:  primeiro.tensao_entrada_v || 220,
        numero_fases:      primeiro.numero_fases || 1,
        comprimento_cabo_m: dados.comprimento_cabo_m || 0,
        tipo_carregador:   primeiro.tipo,
        corrente_nominal_a: primeiro.corrente_entrada_a, // fabricante — prioridade para disjuntor
        incluir_mob_box:   incluirMobBox,
        tipo_conector:     primeiro.tipo_conector,
      })
      setCalculos(resultado)
      // Propaga engenharia → orçamento. Enriquece com preços do Catálogo Mestre.
      setOrcamento(prev => ({
        ...prev,
        materiais: enriquecerComCatalogo(bomParaMateriais(resultado.materiais), catalogoItems),
        equipamentos: carregadoresParaEquipamentos(carregadores),
      }))
    } catch (err) {
      console.error('[EV] Erro no cálculo automático:', err)
    }
  }, [carregadores, dados.comprimento_cabo_m, incluirMobBox, catalogoItems])

  // ── Gerar unifilar ao entrar na etapa 4 ────────────────────────────────
  const etapaRef = useRef(etapa)
  useEffect(() => {
    const entrouNaEtapa4 = etapa === 4 && etapaRef.current !== 4
    etapaRef.current = etapa
    if (entrouNaEtapa4 && calculos) {
      gerarUnifilar()
    }
  }, [etapa]) // eslint-disable-line

  // ── Helpers de RT ───────────────────────────────────────────────────────
  const tecnicoSelecionadoObj = responsaveisTecnicos.find(t => t._id === tecnicoSelecionado)
  const potenciaTotalKw = carregadores.reduce((s, c) => s + (Number(c.potencia_kw) || 0) * (Number(c.quantidade) || 1), 0)
  const rtCarteiraVencida = (() => {
    const v = tecnicoSelecionadoObj?.validade_carteira_profissional
    return v ? new Date(v).getTime() < Date.now() : false
  })()
  const rtAcimaLimite = (() => {
    const lim = tecnicoSelecionadoObj?.potencia_max_kw
    return lim && potenciaTotalKw ? potenciaTotalKw > Number(lim) : false
  })()

  // ── Navegação ────────────────────────────────────────────────────────────
  const validarEtapa = (step) => {
    switch (step) {
      case 1: return !!(dados.nome_projeto && dados.cliente_nome && dados.endereco)
      case 2: return carregadores.length > 0 && calculos !== null
      case 3: return true
      default: return true
    }
  }

  const proximaEtapa = () => { if (validarEtapa(etapa)) setEtapa(e => e + 1) }
  const etapaAnterior = () => { if (etapa > 1) setEtapa(e => e - 1) }

  // ── Carregadores ─────────────────────────────────────────────────────────
  const adicionarCarregador = (c) => setCarregadores(prev => [...prev, { ...c, quantidade: 1 }])
  const removerCarregador   = (idx) => setCarregadores(prev => prev.filter((_, i) => i !== idx))
  const atualizarQtd        = (idx, qtd) => setCarregadores(prev => prev.map((c, i) => i === idx ? { ...c, quantidade: qtd } : c))

  // ── Gerar unifilar ───────────────────────────────────────────────────────
  // P3-F2: o preview da etapa 4 passa a usar o DiagramEngine (mesma fonte do
  // React Flow e do PDF). gerarUnifilarEVSVG (motor antigo) será removido na F5.
  const construirArgsEngine = () => {
    const primeiro = carregadores[0]
    return {
      calculos: { ...calculos, comprimento_cabo_m: dados.comprimento_cabo_m },
      bom: calculos?.materiais || [],   // BOM de engenharia (item/especificacao/quantidade)
      numero_fases: Number(primeiro?.numero_fases) || 1,
      carregador: primeiro || {},
      projeto: {
        nome: dados.nome_projeto,
        cliente_nome: dados.cliente_nome,
        endereco: dados.endereco,
        comprimento_cabo_m: dados.comprimento_cabo_m,
        tecnico_nome: dados.tecnico_nome,
        tecnico_crea: dados.tecnico_crea,
        tecnico_cft: dados.tecnico_cft,
      },
    }
  }

  const gerarUnifilar = () => {
    if (!calculos) return
    try {
      const canon = construirCanonicalEV(construirArgsEngine())
      setCanonical(canon)
      setUnifilar(renderSVG(canon))
      setModoEdicao(false)   // F2: mostra o SVG do Engine por padrão (editor é F3)
    } catch (err) {
      console.error('[EV] Erro ao gerar unifilar:', err)
      alert('Erro ao gerar unifilar: ' + err.message)
    }
  }

  const baixarUnifilar = () => {
    if (!unifilar) return
    const link = document.createElement('a')
    link.href = 'data:application/octet-stream;base64,' + btoa(unescape(encodeURIComponent(unifilar)))
    link.download = `unifilar-ev-${dados.nome_projeto.replace(/\s+/g, '-')}.svg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const baixarPDFProjeto = async (projetoId) => {
    try {
      const r = await fetch(`${API_URL}/api/projetos-ev/${projetoId}/pdf`)
      if (!r.ok) throw new Error('Erro ao gerar PDF')
      const blob = await r.blob()
      const url  = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Unifilar_${dados.nome_projeto}.pdf`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erro ao baixar PDF:', err)
      alert(`Erro ao gerar PDF: ${err.message}`)
    }
  }

  const salvarProjeto = async () => {
    if (!clienteId) { alert('Erro: cliente não identificado'); return }
    if (!validarEtapa(1) || !validarEtapa(2)) { alert('Complete as etapas 1 e 2 antes de salvar'); return }

    const projetoData = {
      clienteId,
      nome: dados.nome_projeto,
      endereco_completo: dados.endereco,
      latitude: dados.latitude,
      longitude: dados.longitude,
      carregadores: carregadores.map(c => ({ tipo: c.tipo, potencia_kw: c.potencia_kw, marca: c.marca, modelo: c.modelo, quantidade: c.quantidade })),
      quantidade_pontos: carregadores.length,
      potencia_total_kw: potenciaTotalKw,
      comprimento_cabo_m: dados.comprimento_cabo_m,
      calculos_nbr: calculos,
      bom: orcamento.materiais,
      orcamento: { ...orcamento, status: statusComercial, resumo: resumoOrcamento },
      financeiro: {
        custo_equipamentos_r: resumoOrcamento.subtotal_equipamentos,
        custo_materiais_r:    resumoOrcamento.subtotal_materiais,
        custo_instalacao_r:   resumoOrcamento.subtotal_servicos,
        margem_pct:           resumoOrcamento.margem_pct,
        desconto_pct:         resumoOrcamento.desconto_pct,
        custo_total_r:        resumoOrcamento.preco_final,
      },
      tecnico: { nome: dados.tecnico_nome, crea: dados.tecnico_crea, cft: dados.tecnico_cft, tipo_profissional: dados.tecnico_tipo },
      status: ['aprovado', 'em_execucao', 'concluido'].includes(statusComercial) ? 'aprovado' : 'dimensionado',
      // P3-F2: diagrama canônico do DiagramEngine (fonte única — version/viewport/metadata/overrides)
      diagrama_editado: (() => {
        const canon = canonical || construirCanonicalEV(construirArgsEngine())
        const { nodes, edges, viewport } = toReactFlow(canon)
        return {
          version: canon.version,
          viewport,
          metadata: canon.metadata,
          overrides: canon.overrides || {},
          nodes,
          edges,
          timestamp: new Date().toISOString(),
        }
      })(),
    }

    try {
      const r = await fetch(`${API_URL}/api/projetos-ev`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(projetoData) })
      if (!r.ok) { const e = await r.json(); throw new Error(e.erro || 'Erro ao salvar') }
      const novoProjeto = await r.json()
      localStorage.setItem('tecnico_dados', JSON.stringify({ nome: dados.tecnico_nome, crea: dados.tecnico_crea, cft: dados.tecnico_cft, tipo: dados.tecnico_tipo }))
      alert('✅ Projeto salvo com sucesso!')
      if (window.confirm('Deseja baixar o diagrama em PDF?')) {
        await new Promise(r => setTimeout(r, 500))
        baixarPDFProjeto(novoProjeto._id)
      }
      navigate('/projetos-ev')
    } catch (err) {
      console.error('Erro ao salvar:', err)
      alert(`❌ Erro ao salvar: ${err.message}`)
    }
  }

  // ── Validação NBR para exibição ─────────────────────────────────────────
  const validacaoNBR = calculos ? validarNBR5410(calculos) : null

  // ── Resumo financeiro derivado da fonte única (etapa 2 → etapa 3 → salvar) ─
  const resumoOrcamento = useMemo(() => calcularOrcamento(orcamento), [orcamento])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Nova Proposta EV</h1>
        <Button variante="secundario" onClick={() => navigate('/projetos-ev')}>Cancelar</Button>
      </div>

      <Stepper etapas={ETAPAS} etapaAtual={etapa} />

      {/* ══════════════════════════════════════════════════════════════════
          ETAPA 1 — LOCALIZAÇÃO
      ══════════════════════════════════════════════════════════════════ */}
      {etapa === 1 && (
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Localização do Projeto</h2></CardHeader>
          <CardBody className="space-y-4">
            <Input rotulo="Nome do Projeto" value={dados.nome_projeto}
              onChange={(e) => setDados(p => ({ ...p, nome_projeto: e.target.value }))}
              placeholder="Ex: Frota Costa 22kW" />

            <Input rotulo="Nome do Cliente" value={dados.cliente_nome}
              onChange={(e) => setDados(p => ({ ...p, cliente_nome: e.target.value }))}
              placeholder="Ex: Ana Karina Franco" />

            <Input rotulo="Endereço Completo" value={dados.endereco}
              onChange={(e) => setDados(p => ({ ...p, endereco: e.target.value }))}
              placeholder="Rua, número, bairro, cidade/UF" />

            {/* Responsável Técnico */}
            {responsaveisTecnicos.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Responsável Técnico
                  {responsaveisTecnicos.length === 1
                    ? <span className="ml-1 text-[10px] text-emerald-700">✓ auto-selecionado</span>
                    : <span className="ml-1 text-[10px] text-slate-400">({responsaveisTecnicos.length} disponíveis)</span>}
                </label>
                <select value={tecnicoSelecionado}
                  onChange={(e) => {
                    setTecnicoSelecionado(e.target.value)
                    const resp = responsaveisTecnicos.find(r => r._id === e.target.value)
                    if (resp) {
                      const ehCrea = (resp.tipo_registro || '').toUpperCase() === 'CREA'
                      const registro = resp.registro || ''   // backend pode retornar null → '' (evita warning controlled input)
                      setDados(p => ({ ...p, tecnico_nome: resp.nome || '', tecnico_crea: ehCrea ? registro : '', tecnico_cft: !ehCrea ? registro : '', tecnico_tipo: ehCrea ? 'crea' : 'cft', tecnico_id: resp._id, tecnico_potencia_max_kw: resp.potencia_max_kw || null, tecnico_validade_carteira: resp.validade_carteira_profissional || null }))
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="">-- Selecionar --</option>
                  {responsaveisTecnicos.map(resp => {
                    const limite  = resp.potencia_max_kw ? ` · até ${resp.potencia_max_kw}kW` : ''
                    const venc    = resp.validade_carteira_profissional && new Date(resp.validade_carteira_profissional).getTime() < Date.now() ? ' · VENCIDO' : ''
                    const especEV = Array.isArray(resp.especialidades) && resp.especialidades.includes('EV')
                    return (
                      <option key={resp._id} value={resp._id} disabled={!!venc}>
                        {especEV ? '⚡ ' : ''}{resp.nome} ({resp.tipo_registro} {resp.registro || ''}){limite}{venc}
                      </option>
                    )
                  })}
                </select>
                {rtCarteiraVencida && <p className="text-xs text-red-700 bg-red-50 p-2 rounded border border-red-200 mt-2">⚠ Carteira profissional VENCIDA — selecione outro RT.</p>}
                {rtAcimaLimite && !rtCarteiraVencida && <p className="text-xs text-amber-800 bg-amber-50 p-2 rounded border border-amber-200 mt-2">⚠ Potência ({potenciaTotalKw.toFixed(1)} kW) excede limite do RT ({tecnicoSelecionadoObj?.potencia_max_kw} kW).</p>}
              </div>
            )}

            <Input rotulo="Técnico Responsável" value={dados.tecnico_nome}
              onChange={(e) => setDados(p => ({ ...p, tecnico_nome: e.target.value }))}
              placeholder="Nome completo" />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Profissional</label>
                <select value={dados.tecnico_tipo}
                  onChange={(e) => setDados(p => ({ ...p, tecnico_tipo: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="crea">CREA (Engenheiro/Técnico)</option>
                  <option value="cft">CFT (Eletrotécnico)</option>
                </select>
              </div>
            </div>

            {dados.tecnico_tipo === 'crea'
              ? <Input rotulo="Número CREA" value={dados.tecnico_crea} onChange={(e) => setDados(p => ({ ...p, tecnico_crea: e.target.value }))} placeholder="Ex: RN 12345/D" />
              : <Input rotulo="Número CFT"  value={dados.tecnico_cft}  onChange={(e) => setDados(p => ({ ...p, tecnico_cft: e.target.value }))}  placeholder="Ex: CFT 123456" />
            }

            {rtCarregando && <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-200">⏳ Carregando responsáveis técnicos…</p>}
            {!rtCarregando && responsaveisTecnicos.length === 0 && (
              <p className="text-xs text-slate-600 bg-yellow-50 p-2 rounded border border-yellow-200">
                ⚠️ Nenhum responsável técnico cadastrado.<br />
                Acesse <strong>Configurações → Equipe & Permissões → Técnicos</strong>.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variante="secundario" disabled>← Anterior</Button>
              <Button onClick={proximaEtapa} disabled={!validarEtapa(1)}>Próxima →</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ETAPA 2 — CARREGADOR + ENGENHARIA
      ══════════════════════════════════════════════════════════════════ */}
      {etapa === 2 && (
        <div className="space-y-4">

          {/* ── Seleção do carregador ─────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Seleção do Carregador</h2>
                <Button variante="secundario" tamanho="sm" onClick={() => setModalUploadAberto(true)}>
                  + Adicionar datasheet
                </Button>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {/* Carregadores selecionados */}
              {carregadores.length > 0 && (
                <div className="space-y-2">
                  {carregadores.map((c, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div>
                        <p className="font-semibold text-sm text-blue-900">{c.marca} {c.modelo}</p>
                        <p className="text-xs text-blue-600">{c.tipo} · {c.potencia_kw}kW · {c.tensao_entrada_v}V · {c.corrente_entrada_a}A</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="number" min="1" value={c.quantidade}
                          onChange={(e) => atualizarQtd(idx, parseInt(e.target.value) || 1)}
                          className="w-14 px-2 py-1 border border-blue-300 rounded text-center text-sm" />
                        <span className="text-xs text-slate-500">un</span>
                        <button onClick={() => removerCarregador(idx)} className="text-slate-400 hover:text-red-500">
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Banco de carregadores */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Banco de Carregadores</p>
                {carregadoresErro && (
                  <p className="text-xs text-red-700 bg-red-50 px-3 py-1.5 rounded mb-2">
                    ❌ {carregadoresErro}
                    <button onClick={carregarCarregadores} className="ml-2 underline">Tentar novamente</button>
                  </p>
                )}
                {carregadoresDisponiveis.length === 0 && !carregadoresErro && (
                  <p className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded">
                    💡 Catálogo vazio. Use "Adicionar datasheet" para importar um PDF.
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                  {carregadoresDisponiveis.map((c) => (
                    <div key={c._id} className="p-3 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
                      onClick={() => adicionarCarregador(c)}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-slate-800">{c.marca} {c.modelo}</p>
                          <p className="text-xs text-slate-500">{c.tipo} · {c.potencia_kw}kW</p>
                          <p className="text-xs text-slate-500">{c.numero_fases}F · {c.tensao_entrada_v}V · {c.corrente_entrada_a}A</p>
                        </div>
                        <Plus size={16} className="text-blue-500 mt-1 flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {carregadores.length === 0 && carregadoresDisponiveis.length > 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded flex items-center gap-1">
                  <AlertTriangle size={12} /> Selecione um carregador acima para calcular automaticamente.
                </p>
              )}
            </CardBody>
          </Card>

          {/* ── Mob Box (equipamento opcional) ────────────────────────── */}
          {carregadores.length > 0 && (
            <Card>
              <CardBody>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={incluirMobBox}
                    onChange={(e) => setIncluirMobBox(e.target.checked)}
                    className="accent-blue-600" />
                  Incluir <strong>Mob Box</strong> (caixa de proteção/gerenciamento do carregador)
                </label>
              </CardBody>
            </Card>
          )}

          {/* ── Card destacado: comprimento do percurso ───────────────── */}
          <Card className="border-2 border-blue-300 bg-blue-50">
            <CardBody>
              <div className="flex items-start gap-3">
                <div className="bg-blue-600 rounded-lg p-2 flex-shrink-0">
                  <Ruler size={20} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-blue-900 text-sm">Comprimento do percurso</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Este valor determina: <strong>bitola dos cabos · queda de tensão · quantidade de material · lista de materiais</strong>
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      value={dados.comprimento_cabo_m}
                      onChange={(e) => setDados(p => ({ ...p, comprimento_cabo_m: parseFloat(e.target.value) || 0 }))}
                      className="w-28 px-3 py-2 border-2 border-blue-400 rounded-lg text-center text-lg font-bold text-blue-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-blue-700 font-semibold">metros de percurso</span>
                  </div>
                  {calculos && dados.comprimento_cabo_m > 0 && (
                    <p className="text-xs text-blue-600 mt-2">
                      {carregadores[0]?.numero_fases >= 3
                        ? `→ ${dados.comprimento_cabo_m}m × 5 condutores = ${dados.comprimento_cabo_m * 5}m de cabo total (L1+L2+L3+N+PE)`
                        : `→ ${dados.comprimento_cabo_m}m × 3 condutores = ${dados.comprimento_cabo_m * 3}m de cabo total (L+N+PE)`}
                    </p>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* ── Resultado automático ─────────────────────────────────── */}
          {calculos && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <h2 className="text-lg font-semibold">Resultado do Dimensionamento</h2>
                  {validacaoNBR && !validacaoNBR.valido && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle size={11} /> {validacaoNBR.erros[0]}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Metric label="Corrente nominal (Ib)" value={`${calculos.Ib_disjuntor?.toFixed(1)} A`} cor="blue" />
                  <Metric label="Bitola dos cabos" value={`${calculos.bitola_cabo_mm2} mm²`} cor="green" />
                  <Metric label="Disjuntor" value={`${calculos.disjuntor_a} A`} cor="yellow" nota={`Ib ≤ In ≤ Iz (${calculos.capacidade_cabo_a}A)`} />
                  <Metric label="DR" value={`${calculos.dr_ma} mA`} cor="purple" />
                  <Metric label="DPS" value={`${calculos.dps_kv} V`} cor="orange" nota="Tipo 2 / Classe II" />
                  <Metric label="Queda de tensão" value={`${calculos.queda_tensao_pct?.toFixed(2)} %`} cor={calculos.queda_tensao_pct > 3 ? 'red' : 'green'} nota="limite NBR: 3%" />
                  {carregadores[0]?.ocpp && <Metric label="OCPP" value={typeof carregadores[0].ocpp === 'string' ? carregadores[0].ocpp : 'Sim'} cor="blue" />}
                  {carregadores[0]?.tipo_conector && <Metric label="Conector" value={carregadores[0].tipo_conector} cor="slate" />}
                </div>
              </CardBody>
            </Card>
          )}

          {/* ── Materiais & Custos (lista editável + preços) ──────────── */}
          {calculos && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Materiais &amp; Custos</h2>
                  <span className="text-xs text-slate-500">Lista gerada automaticamente · ajuste quantidades e preços</span>
                </div>
              </CardHeader>
              <CardBody>
                <OrcamentoEV
                  value={orcamento}
                  onChange={setOrcamento}
                  onCadastrarMaterial={(item) => {
                    const BOM_PARA_SLUG = {
                      Cabos: 'cabos', Proteções: 'protecao_eletrica',
                      Equipamentos: 'quadros_barramentos', Infraestrutura: 'conexoes_infraestrutura',
                      Conexões: 'conexoes_infraestrutura', Diversos: 'fixacao',
                    }
                    const qs = new URLSearchParams({
                      new: '1',
                      descricao: item.descricao || '',
                      categoria: BOM_PARA_SLUG[item.categoria] || '',
                      unidade: item.unidade || 'un',
                    }).toString()
                    window.open(`/materiais?${qs}`, '_blank', 'noopener')
                  }}
                />
              </CardBody>
            </Card>
          )}

          {/* Navegação */}
          <div className="flex justify-between gap-2">
            <Button variante="secundario" onClick={etapaAnterior}>← Anterior</Button>
            <Button onClick={proximaEtapa} disabled={!validarEtapa(2) || rtCarteiraVencida}>
              Próxima → Proposta comercial
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ETAPA 3 — ORÇAMENTO
      ══════════════════════════════════════════════════════════════════ */}
      {etapa === 3 && (
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Proposta Comercial</h2></CardHeader>
          <CardBody className="space-y-4">
            <PropostaComercialEV
              dados={dados}
              carregadores={carregadores}
              orcamento={orcamento}
              status={statusComercial}
              onStatusChange={setStatusComercial}
              onSalvar={salvarProjeto}
            />
            <div className="flex justify-between gap-2">
              <Button variante="secundario" onClick={etapaAnterior}>← Anterior</Button>
              <Button onClick={proximaEtapa}>Próxima → Unifilar</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ETAPA 4 — UNIFILAR
      ══════════════════════════════════════════════════════════════════ */}
      {etapa === 4 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Unifilar A4 Paisagem</h2>
              {unifilar && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setModoEdicao(v => !v)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                      modoEdicao ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}>
                    <Edit2 size={16} />
                    {modoEdicao ? 'Visualizar SVG' : 'Editor Interativo'}
                  </button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            {!unifilar ? (
              <div className="text-center py-8">
                <p className="text-slate-500 mb-4">Gerando unifilar…</p>
                <Button onClick={gerarUnifilar}>Gerar Unifilar</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {modoEdicao ? (
                  <div className="border-2 border-blue-300 rounded-lg overflow-hidden bg-white" style={{ height: '600px' }}>
                    <InteractiveDiagramWrapper
                      canonical={canonical}
                      calculos={calculos}
                      dados={dados}
                      carregadores={carregadores}
                      onChange={setDiagramaEditado}
                      draftId={draftId}
                    />
                  </div>
                ) : (
                  <div
                    className="border-2 border-slate-200 rounded-lg overflow-auto bg-white"
                    dangerouslySetInnerHTML={{ __html: unifilar }}
                    style={{ maxHeight: '600px' }}
                  />
                )}

                <div className="flex gap-2 flex-wrap">
                  <Button icone={Download} onClick={baixarUnifilar} className="flex-1 min-w-[150px]">
                    Baixar SVG
                  </Button>
                  <Button variante="secundario" onClick={gerarUnifilar} className="flex-1 min-w-[150px]">
                    Recalcular
                  </Button>
                  {modoEdicao && diagramaEditado && (
                    <Button variante="secundario" onClick={() => setModoEdicao(false)} className="flex-1 min-w-[150px]">
                      Finalizar Edição
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between gap-2">
              <Button variante="secundario" onClick={etapaAnterior}>← Anterior</Button>
              <Button onClick={salvarProjeto}>Salvar Projeto</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {modalUploadAberto && (
        <ModalNovoCarregadorEV
          onClose={() => setModalUploadAberto(false)}
          onSalvar={() => { setModalUploadAberto(false); carregarCarregadores() }}
        />
      )}
    </div>
  )
}

// ─── Metric ───────────────────────────────────────────────────────────────────
// Card de métrica para o resultado do dimensionamento.
// Declarado fora do componente pai para identidade estável.
const COR_MAP = {
  blue:   { bg: 'bg-blue-50',   brd: 'border-blue-200',   text: 'text-blue-900',   sub: 'text-blue-600'   },
  green:  { bg: 'bg-green-50',  brd: 'border-green-200',  text: 'text-green-900',  sub: 'text-green-600'  },
  yellow: { bg: 'bg-yellow-50', brd: 'border-yellow-200', text: 'text-yellow-900', sub: 'text-yellow-600' },
  purple: { bg: 'bg-purple-50', brd: 'border-purple-200', text: 'text-purple-900', sub: 'text-purple-600' },
  orange: { bg: 'bg-orange-50', brd: 'border-orange-200', text: 'text-orange-900', sub: 'text-orange-600' },
  red:    { bg: 'bg-red-50',    brd: 'border-red-200',    text: 'text-red-900',    sub: 'text-red-600'    },
  slate:  { bg: 'bg-slate-50',  brd: 'border-slate-200',  text: 'text-slate-900',  sub: 'text-slate-600'  },
}

function Metric({ label, value, cor = 'blue', nota }) {
  const c = COR_MAP[cor] || COR_MAP.blue
  return (
    <div className={`p-3 ${c.bg} rounded-lg border ${c.brd}`}>
      <p className={`text-xs uppercase font-semibold ${c.sub} leading-tight`}>{label}</p>
      <p className={`text-xl font-bold ${c.text} mt-1`}>{value}</p>
      {nota && <p className={`text-[10px] ${c.sub} mt-0.5`}>{nota}</p>}
    </div>
  )
}

// ─── InteractiveDiagramWrapper ────────────────────────────────────────────────
function InteractiveDiagramWrapper({ canonical, calculos, dados, carregadores, onChange, draftId }) {
  // P3-F3: o editor hidrata do JSON canônico (Engine). React Flow só renderiza/edita.
  const initial = useMemo(() => (canonical ? toReactFlow(canonical) : null), [canonical])
  const projeto = useMemo(() => ({
    projeto_nome:        dados.nome_projeto,
    cliente_nome:        dados.cliente_nome,
    endereco:            dados.endereco,
    carregador_potencia_kw: carregadores.reduce((s, c) => s + (Number(c.potencia_kw) || 0) * (Number(c.quantidade) || 1), 0),
    carregador_tipo:     carregadores[0]?.tipo || 'AC Monofásico',
    carregador_marca:    carregadores[0]?.marca || '',
    carregador_modelo:   carregadores[0]?.modelo || '',
    comprimento_cabo:    dados.comprimento_cabo_m,
    tecnico_nome:        dados.tecnico_nome,
    tecnico_crea:        dados.tecnico_crea,
  }), [dados.nome_projeto, dados.cliente_nome, dados.endereco, dados.comprimento_cabo_m, dados.tecnico_nome, dados.tecnico_crea, carregadores])

  const handleChange = useCallback((diagramData) => {
    onChange(diagramData)
    try {
      salvarDiagramaLocal(draftId, diagramData?.nodes, diagramData?.edges, {
        projeto_nome: dados.nome_projeto,
        cliente_nome: dados.cliente_nome,
        timestamp:    new Date().toISOString(),
      })
    } catch (e) {
      console.warn('[EV] Falha ao salvar diagrama local:', e?.message)
    }
  }, [onChange, draftId, dados.nome_projeto, dados.cliente_nome])

  return <InteractiveDiagram initial={initial} calculos={calculos} projeto={projeto} onDiagramChange={handleChange} readOnly={false} />
}
