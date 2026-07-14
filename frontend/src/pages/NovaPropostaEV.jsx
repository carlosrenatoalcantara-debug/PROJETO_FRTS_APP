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
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { MapPin, Zap, FileText, Download, Plus, X, Edit2, DollarSign, AlertTriangle, ChevronRight, Ruler } from 'lucide-react'
import OrcamentoEV, { DEFAULT_SERVICOS_EV, bomParaMateriais, carregadoresParaEquipamentos } from '../components/ev/OrcamentoEV'
import PropostaComercialEV from '../components/ev/PropostaComercialEV'
import PerfilComercialSelector from '../components/ev/PerfilComercialSelector'
import { calcularOrcamento } from '../utils/calcularOrcamento'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Stepper from '../components/ui/Stepper'
import ModalNovoCarregadorEV from '../components/equipamentos/ModalNovoCarregadorEV'
import InteractiveDiagram from '../components/diagram/InteractiveDiagram'
import { calcularParametrosNBR5410, validarNBR5410 } from '../services/calculosNBR5410EV'
import { gerarUnifilarEVSVG } from '../utils/gerarUnifilarEV'
import { construirCanonicalEV, renderarSVGEV, toReactFlow, derivarEspecificacaoEV, especificacaoValida } from '../utils/adapterDiagramaEV'
import { gerarBOM } from '../utils/bomMateriaisEV'
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

// BUG-021.5: potência/corrente EFETIVAS de dimensionamento. Sem limitação → nominal.
// Com limitação, converte o valor configurado (potência OU corrente) no par (kW, A)
// coerente (P = √3·V·I·fp no tri; V·I·fp no mono) e nunca ultrapassa o nominal.
export function limitesEfetivosCarregador(lim, potenciaNominalKw, correnteNominalA, tensaoV, numeroFases) {
  const V = Number(tensaoV) || 220
  const raiz3 = Number(numeroFases) === 3 ? Math.sqrt(3) : 1
  const fp = 0.95
  if (!lim?.habilitado) return { potencia_kw: potenciaNominalKw, corrente_a: correnteNominalA, limitado: false }
  if (lim.modo === 'potencia' && Number(lim.potencia_max_kw) > 0) {
    const p = Math.min(Number(potenciaNominalKw) || Infinity, Number(lim.potencia_max_kw))
    return { potencia_kw: p, corrente_a: (p * 1000) / (V * raiz3 * fp), limitado: true }
  }
  if (lim.modo === 'corrente' && Number(lim.corrente_max_a) > 0) {
    const i = Math.min(Number(correnteNominalA) || Infinity, Number(lim.corrente_max_a))
    return { potencia_kw: (i * V * raiz3 * fp) / 1000, corrente_a: i, limitado: true }
  }
  return { potencia_kw: potenciaNominalKw, corrente_a: correnteNominalA, limitado: false }
}

export default function NovaPropostaEV() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { id: projetoIdParam } = useParams()          // BUG-010: modo edição (mesma tela, mesmo ID)
  const modoEdicaoProjeto = !!projetoIdParam
  const [clienteIdEdit, setClienteIdEdit] = useState(null)
  const clienteId = searchParams.get('clienteId') || clienteIdEdit

  // ── Estados principais ──────────────────────────────────────────────────
  const [etapa, setEtapa] = useState(1)
  const [carregadores, setCarregadores] = useState([])
  const [carregadoresDisponiveis, setCarregadoresDisponiveis] = useState([])
  const [carregadoresErro, setCarregadoresErro] = useState(null)
  const [calculos, setCalculos] = useState(null)
  // BUG-021 FASE 2: ESPECIFICAÇÃO EXECUTIVA — fonte única de componentes/condutores.
  // O Motor SEMEIA (dimensionamento inicial); depois o operador é o dono. Memorial,
  // Unifilar, BOM e PDFs leem SÓ daqui. `seedRef` guarda a assinatura do último seed
  // do Motor: enquanto o dimensionamento não mudar, as edições do operador sobrevivem.
  const [especificacao, setEspecificacao] = useState(null)
  const seedRef = useRef('')
  // ── Fonte única da verdade do orçamento (vive no pai, sobrevive à navegação) ─
  const [orcamento, setOrcamento] = useState({
    equipamentos: [],
    materiais: [],
    servicos: DEFAULT_SERVICOS_EV,
    margem_pct: 20,
    impostos_pct: 0,                    // FEATURE-002 ITEM 2
    desconto_pct: 0,
    mostrar_materiais_detalhados: true, // FEATURE-002 ITEM 3
  })
  const [statusComercial, setStatusComercial] = useState('dimensionado') // FEATURE-008
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
  // BUG-015: enquanto hidrata a edição (restaura estado salvo), o auto-cálculo NÃO roda —
  // assim os cálculos/BOM/orçamento salvos são preservados. Volta a rodar quando o
  // usuário edita algo (handlers limpam a flag).
  const hidratandoEdicao = useRef(false)

  const [dados, setDados] = useState({
    nome_projeto: '',
    cliente_nome: '',
    endereco: '',
    latitude: null,
    longitude: null,
    carregadores: [],
    comprimento_cabo_m: 25,
    corrente_aferida_a: null, // FEATURE-006: aferição da vistoria (opcional)
    // BUG-021.5: limitação de operação do carregador (opcional). Quando habilitado, o
    // dimensionamento usa a corrente/potência MÁXIMA configurada, não a nominal.
    limitacao_operacao: { habilitado: false, modo: 'corrente', corrente_max_a: null, potencia_max_kw: null },
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
  // Em modo edição NÃO buscamos o cliente aqui: os dados vêm do próprio projeto
  // (endereço pode ter sido ajustado no projeto e não deve ser sobrescrito).
  useEffect(() => {
    if (!clienteId || modoEdicaoProjeto) return
    fetch(`${API_URL}/api/clientes/${clienteId}`)
      .then(r => r.json())
      .then(c => setDados(prev => ({ ...prev, cliente_nome: c.nome || '', endereco: c.endereco_completo || '' })))
      .catch(console.error)
  }, [clienteId, modoEdicaoProjeto])

  // ── BUG-010: Carregar projeto existente (modo edição) ────────────────────
  // Reaproveita o MESMO wizard para editar. Pré-preenche todos os campos de
  // dimensionamento; ao salvar faz PUT no MESMO ID (recálculo no backend +
  // recálculo ao vivo aqui). Nunca cria projeto novo.
  useEffect(() => {
    if (!projetoIdParam) return
    let vivo = true
    ;(async () => {
      try {
        const r = await fetch(`${API_URL}/api/projetos-ev/${projetoIdParam}`)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const p = await r.json()
        if (!vivo) return
        // BUG-015: abre no ÚLTIMO estado salvo, sem recalcular (guarda o auto-cálculo).
        hidratandoEdicao.current = true
        const cli = typeof p.clienteId === 'object' ? p.clienteId?._id : p.clienteId
        setClienteIdEdit(cli || null)
        setDados(prev => ({
          ...prev,
          nome_projeto: p.nome || '',
          cliente_nome: typeof p.clienteId === 'object' ? (p.clienteId?.nome || prev.cliente_nome) : prev.cliente_nome,
          endereco: p.endereco_completo || '',
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null,
          comprimento_cabo_m: p.comprimento_cabo_m ?? 25,
          corrente_aferida_a: p.corrente_aferida_a ?? null, // FEATURE-006
          limitacao_operacao: { // BUG-021.5
            habilitado: !!p.limitacao_operacao?.habilitado,
            modo: p.limitacao_operacao?.modo || 'corrente',
            corrente_max_a: p.limitacao_operacao?.corrente_max_a ?? null,
            potencia_max_kw: p.limitacao_operacao?.potencia_max_kw ?? null,
          },
          tecnico_nome: p.tecnico?.nome || prev.tecnico_nome,
          tecnico_crea: p.tecnico?.crea || '',
          tecnico_cft: p.tecnico?.cft || '',
          tecnico_tipo: p.tecnico?.tipo_profissional || 'crea',
        }))
        // Carregadores: a leitura do backend já enriquece com specs do catálogo
        // (tensão/corrente/fases/conector — BUG-007), suficiente para redimensionar.
        if (Array.isArray(p.carregadores) && p.carregadores.length) {
          setCarregadores(p.carregadores.map(c => ({ ...c, quantidade: c.quantidade || 1 })))
        }
        // BUG-015: restaura EXATAMENTE a engenharia salva (não recalcula ao abrir).
        if (p.calculos_nbr && Object.keys(p.calculos_nbr).length) {
          setCalculos(p.calculos_nbr)
        }
        // BUG-021 FASE 2 (retrocompat): projeto novo abre com a especificação SALVA;
        // projeto antigo (sem a estrutura) abre com o FALLBACK derivado do Motor — e é
        // materializado na primeira gravação. Nenhum projeto existente deixa de abrir.
        {
          const seedMotor = derivarEspecificacaoEV({
            calculos: p.calculos_nbr || {},
            carregador: (p.carregadores && p.carregadores[0]) || {},
            comprimento_cabo_m: p.comprimento_cabo_m,
          })
          // seedRef = assinatura do SEED DO MOTOR (não da spec salva). Assim, enquanto o
          // dimensionamento não mudar, as edições do operador não são sobrescritas; quando
          // ele mudar (novo carregador/comprimento), o Motor re-semeia — como deve.
          seedRef.current = JSON.stringify(seedMotor)
          // especificacaoValida (regra única): o Mongoose devolve a estrutura com os
          // DEFAULTS do schema em projeto antigo (componentes vazios, condutores: []).
          // Testar só "existe?" adotaria essa casca oca — daria 2 DPS num trifásico e
          // tabela de condutores vazia. Só uma estrutura ÍNTEGRA vence o seed do Motor.
          setEspecificacao(especificacaoValida(p.especificacao) ? p.especificacao : seedMotor)
        }
        // BUG-015: restaura orçamento salvo por inteiro — materiais (BOM), equipamentos,
        // serviços, margem, desconto e status comercial.
        if (p.orcamento) {
          setOrcamento(prev => ({
            ...prev,
            materiais: Array.isArray(p.orcamento.materiais) ? p.orcamento.materiais
              : (Array.isArray(p.bom) ? p.bom : prev.materiais),
            equipamentos: Array.isArray(p.orcamento.equipamentos) ? p.orcamento.equipamentos : prev.equipamentos,
            servicos: Array.isArray(p.orcamento.servicos) && p.orcamento.servicos.length ? p.orcamento.servicos : prev.servicos,
            margem_pct: p.orcamento.margem_pct ?? prev.margem_pct,
            impostos_pct: p.orcamento.impostos_pct ?? prev.impostos_pct,                                   // FEATURE-002
            desconto_pct: p.orcamento.desconto_pct ?? prev.desconto_pct,
            mostrar_materiais_detalhados: p.orcamento.mostrar_materiais_detalhados ?? prev.mostrar_materiais_detalhados, // FEATURE-002
            // FEATURE-004: restaura EXATAMENTE a política comercial salva (perfil/herdada/personalizada)
            politica: p.orcamento.politica ?? p.politica_comercial ?? prev.politica,
            politica_perfil: p.orcamento.politica_perfil ?? p.politica_perfil ?? prev.politica_perfil,
            politica_herdada: (p.orcamento.politica_herdada ?? p.politica_herdada) ?? prev.politica_herdada,
          }))
        } else if (Array.isArray(p.bom) && p.bom.length) {
          setOrcamento(prev => ({ ...prev, materiais: p.bom }))
        }
        // FEATURE-008: status é lido de p.status (fonte única) — não mais de
        // p.orcamento.status. Independe de o projeto ter orçamento salvo.
        if (p.status) setStatusComercial(p.status)
        // BUG-015: abre EXATAMENTE na última etapa salva (nunca reinicia na etapa 1).
        const etapaSalva = Math.min(Math.max(Number(p.ultimaEtapa) || 1, 1), 4)
        setEtapa(etapaSalva)
      } catch (e) {
        console.error('[EV] Erro ao carregar projeto para edição:', e)
        alert('Erro ao carregar projeto para edição: ' + e.message)
      }
    })()
    return () => { vivo = false }
  }, [projetoIdParam])

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

    // Nome do item: tudo antes do primeiro " (" (remove especificação); normaliza espaços em volta de "+"
    const nomeItem = bomItem.descricao.split(' (')[0].toLowerCase().trim().replace(/\s*\+\s*/g, '+')
    return candidatos.find(c => {
      const cd = c.descricao.toLowerCase().replace(/\s*\+\s*/g, '+')
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
    // BUG-015: durante a hidratação da edição, NÃO recalcula (preserva o estado salvo).
    if (hidratandoEdicao.current) return
    if (carregadores.length === 0) {
      setCalculos(null)
      setOrcamento(prev => ({ ...prev, materiais: [], equipamentos: [] }))
      return
    }

    const potencia_total = carregadores.reduce((s, c) => s + (Number(c.potencia_kw) || 0) * (Number(c.quantidade) || 1), 0)
    const primeiro = carregadores[0]

    // BUG-021.5: quando há limitação de operação, TODO o dimensionamento usa a
    // potência/corrente MÁXIMA configurada (não a nominal do catálogo).
    const lim = limitesEfetivosCarregador(
      dados.limitacao_operacao, potencia_total, primeiro.corrente_entrada_a,
      primeiro.tensao_entrada_v || 220, primeiro.numero_fases || 1,
    )

    try {
      const resultado = calcularParametrosNBR5410({
        potencia_kw:       lim.potencia_kw,
        tensao_entrada_v:  primeiro.tensao_entrada_v || 220,
        numero_fases:      primeiro.numero_fases || 1,
        comprimento_cabo_m: dados.comprimento_cabo_m || 0,
        tipo_carregador:   primeiro.tipo,
        corrente_nominal_a: lim.corrente_a, // limitada quando habilitado; senão a nominal
        incluir_mob_box:   incluirMobBox,
        tipo_conector:     primeiro.tipo_conector,
      })
      setCalculos(resultado)

      // BUG-021.2: o Motor SEMEIA a especificação executiva. Só re-semeia quando o
      // DIMENSIONAMENTO realmente muda (assinatura) — assim uma re-renderização (ex.:
      // catálogo de preços carregando) não apaga o que o operador especificou.
      const espSeed = derivarEspecificacaoEV({
        calculos: resultado, carregador: primeiro, comprimento_cabo_m: dados.comprimento_cabo_m,
      })
      const assinatura = JSON.stringify(espSeed)
      if (assinatura !== seedRef.current) {
        seedRef.current = assinatura
        setEspecificacao(espSeed)
      }

      setOrcamento(prev => ({ ...prev, equipamentos: carregadoresParaEquipamentos(carregadores) }))
    } catch (err) {
      console.error('[EV] Erro no cálculo automático:', err)
    }
  }, [carregadores, dados.comprimento_cabo_m, dados.limitacao_operacao, incluirMobBox, catalogoItems])

  // BUG-021.2: o BOM é DERIVADO da especificação executiva (nunca mais do Motor direto).
  // Qualquer edição de componente/condutor regenera a lista de materiais na hora — é o
  // que garante que Materiais, Memorial e Unifilar mostrem SEMPRE o que será instalado.
  useEffect(() => {
    if (hidratandoEdicao.current) return          // BUG-015: preserva o BOM salvo na hidratação
    if (!especificacao || carregadores.length === 0) return
    const primeiro = carregadores[0]
    const bom = gerarBOM({
      potencia_kw: calculos?.potencia_kw ?? carregadores.reduce((s, c) => s + (Number(c.potencia_kw) || 0) * (Number(c.quantidade) || 1), 0),
      tipo_carregador: primeiro.tipo,
      tipo_conector: primeiro.tipo_conector,
      incluir_mob_box: incluirMobBox,
      especificacao,
    })
    setOrcamento(prev => ({ ...prev, materiais: enriquecerComCatalogo(bomParaMateriais(bom), catalogoItems) }))
  }, [especificacao, incluirMobBox, carregadores, catalogoItems]) // eslint-disable-line

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
  // BUG-015: qualquer edição do usuário encerra a hidratação → o auto-cálculo volta a rodar.
  const adicionarCarregador = (c) => { hidratandoEdicao.current = false; setCarregadores(prev => [...prev, { ...c, quantidade: 1 }]) }
  const removerCarregador   = (idx) => { hidratandoEdicao.current = false; setCarregadores(prev => prev.filter((_, i) => i !== idx)) }
  const atualizarQtd        = (idx, qtd) => { hidratandoEdicao.current = false; setCarregadores(prev => prev.map((c, i) => i === idx ? { ...c, quantidade: qtd } : c)) }

  // ── BUG-021.4 / 021.3: edição da ESPECIFICAÇÃO EXECUTIVA ─────────────────
  // Só ATRIBUTOS TÉCNICOS mudam. Componentes obrigatórios não têm remoção (não existe
  // handler de exclusão) e condutores mantêm identidade fixa (L1/L2/L3/N/PE) — o
  // operador altera apenas bitola e comprimento. Sem fabricante, sem modelo.
  const editarComponente = (chave, campo, valor) => {
    hidratandoEdicao.current = false
    setEspecificacao(prev => prev && ({
      ...prev,
      componentes: { ...prev.componentes, [chave]: { ...prev.componentes[chave], [campo]: valor } },
    }))
  }
  const editarCondutor = (id, campo, valor) => {
    hidratandoEdicao.current = false
    setEspecificacao(prev => prev && ({
      ...prev,
      condutores: prev.condutores.map(c => (c.id === id ? { ...c, [campo]: valor } : c)),
    }))
  }
  const num = (v) => (v === '' ? null : parseFloat(v))

  // ── Gerar unifilar ───────────────────────────────────────────────────────
  // P3-F2: o preview da etapa 4 passa a usar o DiagramEngine (mesma fonte do
  // React Flow e do PDF). gerarUnifilarEVSVG (motor antigo) será removido na F5.
  const construirArgsEngine = () => {
    const primeiro = carregadores[0]
    return {
      calculos: { ...calculos, comprimento_cabo_m: dados.comprimento_cabo_m },
      // BUG-021.2: a lista de materiais IMPRESSA no unifilar é a derivada da especificação
      // (orcamento.materiais), não a lista-semente do Motor (calculos.materiais) — senão o
      // desenho mostrava o símbolo novo (63 A) e, ao lado, a lista antiga (40 A).
      bom: orcamento.materiais?.length ? orcamento.materiais : (calculos?.materiais || []),
      // BUG-021.2: o unifilar desenha a ESPECIFICAÇÃO (o que será instalado) — nunca o Motor.
      especificacao,
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
      // BUG-017: persiste o carregador COMPLETO (tensão/fases/corrente/conector) — o
      // recálculo do backend usa a MESMA corrente do catálogo → valores idênticos ao wizard.
      carregadores: carregadores.map(c => ({
        tipo: c.tipo, potencia_kw: c.potencia_kw, marca: c.marca, modelo: c.modelo, quantidade: c.quantidade,
        tensao_entrada_v: c.tensao_entrada_v, numero_fases: c.numero_fases,
        corrente_entrada_a: c.corrente_entrada_a, tipo_conector: c.tipo_conector,
      })),
      quantidade_pontos: carregadores.length,
      potencia_total_kw: potenciaTotalKw,
      comprimento_cabo_m: dados.comprimento_cabo_m,
      corrente_aferida_a: dados.corrente_aferida_a, // FEATURE-006: aferição da vistoria
      limitacao_operacao: dados.limitacao_operacao, // BUG-021.5: limitação de operação
      // BUG-021.2: especificação executiva — o que SERÁ instalado. Na primeira gravação de
      // um projeto antigo, o fallback derivado é materializado aqui (migração transparente).
      especificacao,
      calculos_nbr: calculos,
      bom: orcamento.materiais,
      // FEATURE-008: status NÃO fica mais duplicado dentro de orcamento — vive só no
      // campo raiz `status` (fonte única).
      orcamento: { ...orcamento, resumo: resumoOrcamento },
      financeiro: {
        custo_equipamentos_r: resumoOrcamento.subtotal_equipamentos,
        custo_materiais_r:    resumoOrcamento.subtotal_materiais,
        custo_instalacao_r:   resumoOrcamento.subtotal_servicos,
        margem_pct:           resumoOrcamento.margem_pct,
        desconto_pct:         resumoOrcamento.desconto_pct,
        custo_total_r:        resumoOrcamento.preco_final,
      },
      tecnico: { nome: dados.tecnico_nome, crea: dados.tecnico_crea, cft: dados.tecnico_cft, tipo_profissional: dados.tecnico_tipo },
      // FEATURE-008: grava o status comercial DIRETO — sem derivação com perda. Antes,
      // 'enviado'/'aguardando_cliente'/'homologacao' viravam 'dimensionado' e o Badge da
      // listagem/visualização dessincronizava do que o usuário via no seletor.
      status: statusComercial,
      // BUG-015: registra a etapa atual do wizard (reabertura da edição inicia aqui)
      ultimaEtapa: etapa,
      // FEATURE-004: política comercial (perfil, herdada da empresa ou personalizada)
      politica_comercial: orcamento.politica || null,
      politica_perfil: orcamento.politica_perfil || null,
      politica_herdada: orcamento.politica_herdada !== false,
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
      // BUG-010: modo edição → PUT no MESMO ID (backend recalcula engenharia/NBR).
      const url = modoEdicaoProjeto ? `${API_URL}/api/projetos-ev/${projetoIdParam}` : `${API_URL}/api/projetos-ev`
      const method = modoEdicaoProjeto ? 'PUT' : 'POST'
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(projetoData) })
      if (!r.ok) { const e = await r.json(); throw new Error(e.erro || 'Erro ao salvar') }
      const projetoSalvo = await r.json()
      localStorage.setItem('tecnico_dados', JSON.stringify({ nome: dados.tecnico_nome, crea: dados.tecnico_crea, cft: dados.tecnico_cft, tipo: dados.tecnico_tipo }))
      alert(modoEdicaoProjeto ? '✅ Projeto atualizado com sucesso!' : '✅ Projeto salvo com sucesso!')
      if (window.confirm('Deseja baixar o diagrama em PDF?')) {
        await new Promise(r => setTimeout(r, 500))
        baixarPDFProjeto(projetoSalvo._id || projetoIdParam)
      }
      navigate(modoEdicaoProjeto ? `/projetos-ev/${projetoIdParam}` : '/projetos-ev')
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
        <h1 className="text-2xl font-bold text-slate-900">{modoEdicaoProjeto ? 'Editar Projeto EV' : 'Nova Proposta EV'}</h1>
        <Button variante="secundario" onClick={() => navigate(modoEdicaoProjeto ? `/projetos-ev/${projetoIdParam}` : '/projetos-ev')}>Cancelar</Button>
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
                    onChange={(e) => { hidratandoEdicao.current = false; setIncluirMobBox(e.target.checked) }}
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
                      onChange={(e) => { hidratandoEdicao.current = false; setDados(p => ({ ...p, comprimento_cabo_m: parseFloat(e.target.value) || 0 })) }}
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

                  {/* FEATURE-006: corrente aferida na fase do carregador (vistoria técnica).
                      Não afeta o dimensionamento — só documenta a disponibilidade no Memorial. */}
                  <div className="mt-4 pt-3 border-t border-blue-200">
                    <p className="font-semibold text-blue-900 text-sm">Corrente aferida na fase do carregador</p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      Medida na vistoria técnica, na fase destinada ao carregador (UC em uso normal). Usada no Memorial Descritivo. <strong>Opcional</strong>.
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        value={dados.corrente_aferida_a ?? ''}
                        onChange={(e) => { hidratandoEdicao.current = false; setDados(p => ({ ...p, corrente_aferida_a: e.target.value === '' ? null : parseFloat(e.target.value) })) }}
                        className="w-28 px-3 py-2 border-2 border-blue-400 rounded-lg text-center text-lg font-bold text-blue-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-blue-700 font-semibold">A (opcional)</span>
                    </div>
                  </div>

                  {/* BUG-021.5: limitação de operação do carregador. Nominal = catálogo
                      (somente leitura); quando habilitado, o dimensionamento usa o valor
                      configurado. */}
                  <div className="mt-4 pt-3 border-t border-blue-200">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox"
                        checked={!!dados.limitacao_operacao?.habilitado}
                        onChange={(e) => { hidratandoEdicao.current = false; setDados(p => ({ ...p, limitacao_operacao: { ...p.limitacao_operacao, habilitado: e.target.checked } })) }} />
                      <span className="font-semibold text-blue-900 text-sm">Limitar operação do carregador</span>
                    </label>
                    <p className="text-xs text-blue-700 mt-0.5">
                      Nominal (catálogo): <strong>{carregadores[0]?.potencia_kw ?? '—'} kW</strong> · <strong>{carregadores[0]?.corrente_entrada_a ?? '—'} A</strong>.
                      Quando habilitado, <strong>todo o dimensionamento</strong> (disjuntor, IDR, DPS, cabo) usa o valor configurado.
                    </p>
                    {dados.limitacao_operacao?.habilitado && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <select
                          value={dados.limitacao_operacao?.modo || 'corrente'}
                          onChange={(e) => { hidratandoEdicao.current = false; setDados(p => ({ ...p, limitacao_operacao: { ...p.limitacao_operacao, modo: e.target.value } })) }}
                          className="px-2 py-2 border-2 border-blue-400 rounded-lg text-sm text-blue-900 bg-white">
                          <option value="corrente">Corrente máx.</option>
                          <option value="potencia">Potência máx.</option>
                        </select>
                        {dados.limitacao_operacao?.modo === 'potencia' ? (
                          <>
                            <input type="number" min="0" step="0.1"
                              value={dados.limitacao_operacao?.potencia_max_kw ?? ''}
                              onChange={(e) => { hidratandoEdicao.current = false; setDados(p => ({ ...p, limitacao_operacao: { ...p.limitacao_operacao, potencia_max_kw: e.target.value === '' ? null : parseFloat(e.target.value) } })) }}
                              className="w-28 px-3 py-2 border-2 border-blue-400 rounded-lg text-center text-lg font-bold text-blue-900 bg-white" />
                            <span className="text-blue-700 font-semibold">kW</span>
                          </>
                        ) : (
                          <>
                            <input type="number" min="0" step="1"
                              value={dados.limitacao_operacao?.corrente_max_a ?? ''}
                              onChange={(e) => { hidratandoEdicao.current = false; setDados(p => ({ ...p, limitacao_operacao: { ...p.limitacao_operacao, corrente_max_a: e.target.value === '' ? null : parseFloat(e.target.value) } })) }}
                              className="w-28 px-3 py-2 border-2 border-blue-400 rounded-lg text-center text-lg font-bold text-blue-900 bg-white" />
                            <span className="text-blue-700 font-semibold">A</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
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

          {/* ── BUG-021.2/3/4 — ESPECIFICAÇÃO EXECUTIVA (fonte única) ──── */}
          {especificacao && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Especificação Executiva</h2>
                  <span className="text-xs text-slate-500">
                    Memorial, Unifilar, Materiais e PDFs usam <strong>exatamente</strong> o que está aqui
                  </span>
                </div>
              </CardHeader>
              <CardBody>
                <p className="text-xs text-slate-500 mb-4">
                  O Motor dimensionou os valores abaixo. Ajuste o que será <strong>efetivamente instalado</strong> —
                  os componentes são obrigatórios (não podem ser removidos) e são definidos apenas por características
                  técnicas, sem fabricante ou modelo.
                </p>

                {/* Componentes obrigatórios */}
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  {/* Disjuntor */}
                  <div className="border border-slate-200 rounded-lg p-3">
                    <div className="text-sm font-semibold mb-2">Disjuntor</div>
                    <label className="block text-xs text-slate-500 mb-1">Corrente (A)</label>
                    <input type="number" min="0" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm mb-2"
                      value={especificacao.componentes.disjuntor.corrente_a ?? ''}
                      onChange={(e) => editarComponente('disjuntor', 'corrente_a', num(e.target.value))} />
                    <label className="block text-xs text-slate-500 mb-1">Curva</label>
                    <select className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm mb-2"
                      value={especificacao.componentes.disjuntor.curva || 'C'}
                      onChange={(e) => editarComponente('disjuntor', 'curva', e.target.value)}>
                      <option value="B">B</option><option value="C">C</option><option value="D">D</option>
                    </select>
                    <label className="block text-xs text-slate-500 mb-1">Polos</label>
                    <input readOnly className="w-full px-2 py-1.5 border border-slate-200 bg-slate-50 rounded text-sm text-slate-600"
                      value={`${especificacao.componentes.disjuntor.polos}P`} />
                  </div>

                  {/* IDR */}
                  <div className="border border-slate-200 rounded-lg p-3">
                    <div className="text-sm font-semibold mb-2">IDR (Dispositivo DR)</div>
                    <label className="block text-xs text-slate-500 mb-1">Corrente (A)</label>
                    <input type="number" min="0" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm mb-2"
                      value={especificacao.componentes.idr.corrente_a ?? ''}
                      onChange={(e) => editarComponente('idr', 'corrente_a', num(e.target.value))} />
                    <label className="block text-xs text-slate-500 mb-1">Sensibilidade (mA)</label>
                    <input type="number" min="0" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm mb-2"
                      value={especificacao.componentes.idr.sensibilidade_ma ?? ''}
                      onChange={(e) => editarComponente('idr', 'sensibilidade_ma', num(e.target.value))} />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Tipo</label>
                        <select className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                          value={especificacao.componentes.idr.tipo || 'A'}
                          onChange={(e) => editarComponente('idr', 'tipo', e.target.value)}>
                          <option value="AC">AC</option><option value="A">A</option><option value="B">B</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Polos</label>
                        <input readOnly className="w-full px-2 py-1.5 border border-slate-200 bg-slate-50 rounded text-sm text-slate-600"
                          value={`${especificacao.componentes.idr.polos}P`} />
                      </div>
                    </div>
                  </div>

                  {/* DPS */}
                  <div className="border border-slate-200 rounded-lg p-3">
                    <div className="text-sm font-semibold mb-2">
                      DPS <span className="text-xs font-normal text-slate-500">
                        ({especificacao.fases >= 3 ? 4 : 2} un — 1 por condutor vivo)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Classe</label>
                        <select className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                          value={especificacao.componentes.dps.classe || 'II'}
                          onChange={(e) => editarComponente('dps', 'classe', e.target.value)}>
                          <option value="I">I</option><option value="II">II</option><option value="III">III</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Tensão (V)</label>
                        <input type="number" min="0" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                          value={especificacao.componentes.dps.tensao_v ?? ''}
                          onChange={(e) => editarComponente('dps', 'tensao_v', num(e.target.value))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Imax (kA)</label>
                        <input type="number" min="0" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                          value={especificacao.componentes.dps.imax_ka ?? ''}
                          onChange={(e) => editarComponente('dps', 'imax_ka', num(e.target.value))} />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Polos</label>
                        <input readOnly className="w-full px-2 py-1.5 border border-slate-200 bg-slate-50 rounded text-sm text-slate-600"
                          value={`${especificacao.componentes.dps.polos}P`} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Condutores — identidade permanente */}
                <div className="text-sm font-semibold mb-2">
                  Condutores <span className="text-xs font-normal text-slate-500">
                    (identidade fixa — altere apenas bitola e comprimento)
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                        <th className="py-2 pr-3">Condutor</th>
                        <th className="py-2 pr-3">Função</th>
                        <th className="py-2 pr-3">Bitola (mm²)</th>
                        <th className="py-2">Comprimento (m)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {especificacao.condutores.map((c) => (
                        <tr key={c.id} className="border-b border-slate-100">
                          <td className="py-2 pr-3 font-semibold text-slate-700">{c.id}</td>
                          <td className="py-2 pr-3 text-slate-500 text-xs">
                            {c.id === 'PE' ? 'Proteção (terra)' : c.id === 'N' ? 'Neutro' : 'Fase'}
                          </td>
                          <td className="py-2 pr-3">
                            <input type="number" min="0" step="0.5" className="w-28 px-2 py-1 border border-slate-300 rounded text-sm"
                              value={c.bitola_mm2 ?? ''}
                              onChange={(e) => editarCondutor(c.id, 'bitola_mm2', num(e.target.value))} />
                          </td>
                          <td className="py-2">
                            <input type="number" min="0" step="0.5" className="w-28 px-2 py-1 border border-slate-300 rounded text-sm"
                              value={c.comprimento_m ?? ''}
                              onChange={(e) => editarCondutor(c.id, 'comprimento_m', num(e.target.value))} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                {/* FEATURE-004 — Perfil Comercial (herdar da empresa ou personalizar) */}
                <div className="mb-4">
                  <PerfilComercialSelector
                    value={{ politica: orcamento.politica, politica_perfil: orcamento.politica_perfil, politica_herdada: orcamento.politica_herdada }}
                    onChange={(p) => setOrcamento((o) => ({ ...o, ...p }))}
                  />
                </div>
                <OrcamentoEV
                  value={orcamento}
                  onChange={setOrcamento}
                  catalogo={catalogoItems}
                  onCatalogoAdd={(m) => { if (m) setCatalogoItems((prev) => [m, ...prev]) }}
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
              onOrcamentoChange={(p) => setOrcamento((o) => ({ ...o, ...p }))}
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
              <Button onClick={salvarProjeto}>{modoEdicaoProjeto ? 'Atualizar Projeto' : 'Salvar Projeto'}</Button>
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

  return <InteractiveDiagram initial={initial} canonical={canonical} calculos={calculos} projeto={projeto} onDiagramChange={handleChange} readOnly={false} />
}
