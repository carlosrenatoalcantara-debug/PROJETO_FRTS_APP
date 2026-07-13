/**
 * CrmProjetos.jsx — FEATURE-009 (Passo 2): board Kanban de PROJETOS no CRM.
 *
 * Distinto do board de LEADS (funis/colunas/leads avulsos). Aqui os cards são os
 * PROJETOS reais (ProjetoEV + ProjetoFV) de TODOS os clientes, um card por projeto,
 * puxados automaticamente. As 5 colunas são FIXAS = o pipeline unificado (fonte única
 * = ProjetoEV.status). Arrastar um card grava o status DIRETO no projeto (2 vias com a
 * página de visualização — os dois leem/escrevem o mesmo campo).
 *
 * FV ainda não teve o enum unificado (Passo 3). Por isso os cards FV aparecem
 * (mapeados read-only) mas com o drag TRAVADO — quando o enum do FV for espelhado,
 * remove-se FV_PARA_COLUNA e habilita-se o arrasto.
 *
 * HISTÓRICO IMPORTADO (SolarMarket): 583 dos ~600 projetos FV vieram de import em
 * massa (status_migracao = 'proposta_importada'/'shell_importado') SEM o dado de
 * homologação nem a etapa/funil original — ficaram no sistema de origem. Medido: 0%
 * têm homologacao.status_homologacao preenchido; a maioria (568) está em 'rascunho'.
 * Não dá pra classificar concluído/não-fechado com o dado disponível hoje — inventar
 * status envenenaria as métricas do board. Decisão: escondidos por padrão (toggle
 * "mostrar histórico importado" revela). Reconciliação real fica para quando a API do
 * SolarMarket for lida de novo e comparada projeto a projeto (tarefa futura, à parte).
 */
import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, Lock, MapPin } from 'lucide-react'

const API_URL = '' /* URL relativa — Vercel proxy → Railway */

// Pipeline unificado — 5 colunas fixas (mesmo enum de ProjetoEV.status).
const COLUNAS = [
  { id: 'dimensionado',       label: 'Dimensionado' },
  { id: 'aguardando_cliente', label: 'Aguardando Cliente' },
  { id: 'aprovado',           label: 'Aprovado' },
  { id: 'homologacao',        label: 'Homologação' },
  { id: 'concluido',          label: 'Concluído' },
]
const IDS_VALIDOS = new Set(COLUNAS.map(c => c.id))

// FV (enum ainda não unificado — Passo 3): mapeia read-only o status FV → coluna.
const FV_PARA_COLUNA = {
  rascunho: 'dimensionado', em_simulacao: 'dimensionado', em_analise: 'dimensionado', dimensionado: 'dimensionado',
  proposta: 'aguardando_cliente',
  aprovado: 'aprovado',
  em_execucao: 'homologacao',
  concluido: 'concluido',
}
const FV_FORA_DO_BOARD = new Set(['perdido', 'cancelado', 'arquivado'])

const CORES_DEFAULT = { EV: '#10b981', FV: '#f97316' }
const CHAVE_CORES = 'crm_cores_projetos'

const brl = (v) => (Number.isFinite(Number(v)) && Number(v) > 0
  ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : null)

const nomeCliente = (p) => (typeof p?.clienteId === 'object' ? p?.clienteId?.nome : null) || '—'

export default function CrmProjetos() {
  const navigate = useNavigate()
  const [projetos, setProjetos] = useState([])          // cards normalizados
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [dragId, setDragId] = useState(null)
  const [salvandoId, setSalvandoId] = useState(null)
  const [mostraCfg, setMostraCfg] = useState(false)
  const [mostraImportados, setMostraImportados] = useState(false)
  const [cores, setCores] = useState(() => {
    try { return { ...CORES_DEFAULT, ...(JSON.parse(localStorage.getItem(CHAVE_CORES)) || {}) } }
    catch { return { ...CORES_DEFAULT } }
  })

  useEffect(() => { carregar() }, [])

  async function carregar() {
    try {
      setCarregando(true); setErro(null)
      const [rEv, rFv] = await Promise.all([
        fetch(`${API_URL}/api/projetos-ev`),
        fetch(`${API_URL}/api/projetos-fv`),
      ])
      const ev = rEv.ok ? await rEv.json() : []
      const fv = rFv.ok ? await rFv.json() : []
      const listaEv = (Array.isArray(ev) ? ev : ev.projetos || ev.data || []).map(p => ({
        id: p._id, tipo: 'EV', nome: p.nome || 'Projeto EV', cliente: nomeCliente(p),
        cidade: (typeof p.clienteId === 'object' ? p.clienteId?.cidade : '') || '',
        valor: p.financeiro?.custo_total_r ?? p.orcamento?.resumo?.preco_final ?? null,
        coluna: IDS_VALIDOS.has(p.status) ? p.status : 'dimensionado',
        rota: `/projetos-ev/${p._id}`, arrastavel: true,
      }))
      const listaFv = (Array.isArray(fv) ? fv : fv.projetos || fv.data || [])
        .filter(p => !FV_FORA_DO_BOARD.has(p.status))
        .map(p => ({
          id: p._id, tipo: 'FV', nome: p.nome || 'Projeto FV', cliente: nomeCliente(p),
          cidade: (typeof p.clienteId === 'object' ? p.clienteId?.cidade : '') || '',
          valor: p.financeiro?.custo_total_r ?? p.orcamento?.resumo?.preco_final ?? null,
          coluna: FV_PARA_COLUNA[p.status] || 'dimensionado',
          rota: `/projetos-fv/${p._id}`, arrastavel: false, // Passo 3: habilitar
          // Histórico importado (SolarMarket) — sem etapa/homologação confiável. Ver
          // nota no topo do arquivo. status_migracao null = projeto FV nativo real.
          importado: !!p.status_migracao,
        }))
      setProjetos([...listaEv, ...listaFv])
    } catch (e) {
      console.error('Erro ao carregar projetos do CRM:', e)
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }

  const totalImportados = useMemo(() => projetos.filter(p => p.importado).length, [projetos])

  const porColuna = useMemo(() => {
    const m = Object.fromEntries(COLUNAS.map(c => [c.id, []]))
    const visiveis = mostraImportados ? projetos : projetos.filter(p => !p.importado)
    for (const p of visiveis) (m[p.coluna] || m.dimensionado).push(p)
    return m
  }, [projetos, mostraImportados])

  // Arrastar card EV → nova coluna: PATCH otimista no ProjetoEV.status.
  async function soltarNaColuna(colunaId) {
    const card = projetos.find(p => p.id === dragId)
    setDragId(null)
    if (!card || !card.arrastavel || card.coluna === colunaId) return
    const anterior = card.coluna
    setProjetos(ps => ps.map(p => p.id === card.id ? { ...p, coluna: colunaId } : p))
    setSalvandoId(card.id)
    try {
      const res = await fetch(`${API_URL}/api/projetos-ev/${card.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: colunaId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (e) {
      setProjetos(ps => ps.map(p => p.id === card.id ? { ...p, coluna: anterior } : p))
      alert(`Erro ao mover projeto: ${e.message}`)
    } finally {
      setSalvandoId(null)
    }
  }

  function salvarCor(tipo, cor) {
    const novo = { ...cores, [tipo]: cor }
    setCores(novo)
    try { localStorage.setItem(CHAVE_CORES, JSON.stringify(novo)) } catch { /* ignora */ }
  }

  if (carregando) return <div className="text-white/70 py-12 text-center">Carregando projetos…</div>
  if (erro) return <div className="text-red-300 py-12 text-center">Erro ao carregar: {erro}</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-white/60 text-sm">
          {porColuna && Object.values(porColuna).reduce((n, l) => n + l.length, 0)} projeto(s) · arraste os cards <span className="text-emerald-300 font-medium">EV</span> entre as colunas para mudar o status
        </p>
        <div className="flex items-center gap-3">
          {totalImportados > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-white/60 cursor-pointer select-none">
              <input type="checkbox" checked={mostraImportados} onChange={(e) => setMostraImportados(e.target.checked)}
                className="rounded" />
              mostrar histórico importado ({totalImportados})
            </label>
          )}
          <button onClick={() => setMostraCfg(v => !v)} title="Configurar cores"
            className="text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <Settings size={18} />
          </button>
        </div>
      </div>

      {mostraCfg && (
        <div className="bg-white/10 rounded-lg p-4 mb-4 flex flex-wrap items-center gap-6">
          <span className="text-white/80 text-sm font-medium">Cores dos cards:</span>
          {['EV', 'FV'].map(t => (
            <label key={t} className="flex items-center gap-2 text-white/80 text-sm">
              <span className="w-8">{t}</span>
              <input type="color" value={cores[t]} onChange={(e) => salvarCor(t, e.target.value)}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
              <span className="font-mono text-xs text-white/50">{cores[t]}</span>
            </label>
          ))}
          <button onClick={() => { setCores({ ...CORES_DEFAULT }); localStorage.removeItem(CHAVE_CORES) }}
            className="text-xs text-white/60 hover:text-white underline">restaurar padrão</button>
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${COLUNAS.length}, minmax(240px, 1fr))` }}>
        {COLUNAS.map(col => (
          <div key={col.id}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
            onDrop={(e) => { e.preventDefault(); soltarNaColuna(col.id) }}
            className="rounded-lg p-3" style={{ backgroundColor: 'rgba(255,255,255,0.05)', minHeight: '560px' }}>
            <div className="flex items-center gap-2 mb-3 px-1">
              <h3 className="text-sm font-semibold text-white">{col.label}</h3>
              <span className="ml-auto text-xs text-white/40">{porColuna[col.id].length}</span>
            </div>
            <div className="space-y-2.5">
              {porColuna[col.id].map(card => (
                <div key={`${card.tipo}-${card.id}`}
                  draggable={card.arrastavel}
                  onDragStart={card.arrastavel ? () => setDragId(card.id) : undefined}
                  onClick={() => navigate(card.rota)}
                  className={`p-3 rounded-lg bg-white/10 hover:bg-white/15 transition-all border-l-4 ${card.arrastavel ? 'cursor-move' : 'cursor-pointer'} ${card.importado ? 'opacity-60' : ''} ${salvandoId === card.id ? 'opacity-50' : ''}`}
                  style={{ borderLeftColor: cores[card.tipo] }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: cores[card.tipo] }}>{card.tipo}</span>
                    {!card.arrastavel && <Lock size={11} className="text-white/40" title="Sincronização FV em breve (Passo 3)" />}
                    {card.importado && <span className="text-[9px] text-white/40 border border-white/20 rounded px-1" title="Importado do SolarMarket — etapa/homologação não disponível">histórico</span>}
                    <p className="text-sm font-semibold text-white truncate">{card.nome}</p>
                  </div>
                  <p className="text-xs text-white/60 truncate">{card.cliente}</p>
                  {card.cidade && <p className="text-[11px] text-white/40 flex items-center gap-1 mt-0.5"><MapPin size={10} />{card.cidade}</p>}
                  {brl(card.valor) && <p className="text-xs font-bold text-emerald-300 mt-1">{brl(card.valor)}</p>}
                </div>
              ))}
              {porColuna[col.id].length === 0 && <p className="text-white/25 text-xs text-center py-6">—</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
