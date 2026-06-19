/**
 * GerenciadorArranjos.jsx — P1-MULTIARRANJO-UX-RESTORE-01
 *
 * Configurador de arranjos que reflete instalações reais: cada arranjo tem
 * N módulos e N inversores (fabricantes/modelos diferentes), com seleção
 * HIERÁRQUICA Fabricante → Modelo (sem listas gigantes), quantidade por item,
 * e ações Novo / Duplicar / Excluir arranjo + orientação/inclinação.
 *
 * Sem alterar arquitetura/Mongo/ProjetoFV: usa o shape de backend já existente
 * (arranjos[].paineis[] / arranjos[].inversores[]) e a action SET_ARRANJOS.
 * `blocoParaBackend` (E7) já faz pass-through de paineis[]/inversores[].
 *
 * NOTA: orientação/inclinação por arranjo são UX/informativas — a persistência
 * canônica de orientação fica nos panos (E6/Área); o subdoc de arranjo não as
 * armazena (não alteramos o schema).
 */
import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Copy, Sun, Zap, Lock, Layers } from 'lucide-react'
import { useProjetoFV } from '../../contexts/ProjetoFVContext'
import Button from '../ui/Button'

const potW  = (e) => e?.especificacoes?.potencia_wp || e?.especificacoes?.potencia_w || e?.especificacoes?.potencia || e?.potencia_w || null
const potKW = (e) => e?.especificacoes?.potencia_kw || e?.especificacoes?.potencia || e?.potencia_kw || null

function groupByFab(items) {
  const m = {}
  for (const it of items) { const f = it.fabricante || '—'; (m[f] = m[f] || []).push(it) }
  for (const f of Object.keys(m)) m[f].sort((a, b) => (a.modelo || '').localeCompare(b.modelo || ''))
  return m
}

// Linha → shape de backend (o que persiste). Itens vazios saem do payload.
function linhaModulo(item, quantidade = 1) {
  return { equipamento_id: item?._id || null, fabricante: item?.fabricante || null, marca: item?.fabricante || null,
    modelo: item?.modelo || null, tipo: 'modulo', potencia_w: potW(item), quantidade: Number(quantidade) || 0 }
}
function linhaInversor(item, quantidade = 1) {
  return { equipamento_id: item?._id || null, fabricante: item?.fabricante || null, marca: item?.fabricante || null,
    modelo: item?.modelo || null, tipo: 'inversor', potencia_kw: potKW(item), quantidade: Number(quantidade) || 0 }
}

let _seq = 0
const novoId = () => `arr_${Date.now()}_${_seq++}`
// Arranjos secundários começam em B (A é sempre o arranjo primário de E7)
const proximaLetra = (lista) => {
  const usadas = new Set(lista.map(a => (a.rotulo || '').replace(/^Arranjo\s+/, '').charAt(0)))
  for (let c = 66; c <= 90; c++) {
    if (!usadas.has(String.fromCharCode(c))) return String.fromCharCode(c)
  }
  return `${lista.length + 1}`
}
const arranjoVazio = (lista) => ({ id: novoId(), rotulo: `Arranjo ${proximaLetra(lista)}`, tipo: 'secundario',
  paineis: [], inversores: [], orientacao: 'Norte', inclinacao: '', somente_leitura: false })

export default function GerenciadorArranjos() {
  const { state, dispatch } = useProjetoFV()
  const { arranjos, tipoProjeto } = state
  const [catalogo, setCatalogo] = useState({ modulos: [], inversores: [] })
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    let vivo = true; setCarregando(true)
    fetch('/api/equipamentos?limit=1000').then(r => (r.ok ? r.json() : null)).then(d => {
      if (!vivo) return
      const items = d?.equipamentos || []
      setCatalogo({ modulos: items.filter(e => e.tipo === 'modulo'), inversores: items.filter(e => e.tipo === 'inversor') })
    }).catch(() => {}).finally(() => vivo && setCarregando(false))
    return () => { vivo = false }
  }, [])

  const modPorFab = useMemo(() => groupByFab(catalogo.modulos), [catalogo.modulos])
  const invPorFab = useMemo(() => groupByFab(catalogo.inversores), [catalogo.inversores])
  const fabsMod = useMemo(() => Object.keys(modPorFab).sort(), [modPorFab])
  const fabsInv = useMemo(() => Object.keys(invPorFab).sort(), [invPorFab])

  const setArranjos = (lista) => dispatch({ type: 'SET_ARRANJOS', payload: lista })
  const patch = (i, p) => setArranjos(arranjos.map((a, idx) => idx === i ? { ...a, ...p } : a))

  // ── Arranjos ──────────────────────────────────────────────────────────────
  const addArranjo = () => { const nova = [...arranjos, arranjoVazio(arranjos)]; setArranjos(nova) }
  const dupArranjo = (i) => { const c = JSON.parse(JSON.stringify(arranjos[i])); c.id = novoId(); c.rotulo = `${arranjos[i].rotulo || 'Arranjo'} (cópia)`; c.somente_leitura = false
    const l = [...arranjos]; l.splice(i + 1, 0, c); setArranjos(l) }
  const delArranjo = (i) => setArranjos(arranjos.filter((_, idx) => idx !== i))

  // ── Módulos / Inversores (linhas) ────────────────────────────────────────────
  const linhas = (a, campo) => a[campo] || []
  const addLinha = (i, campo) => patch(i, { [campo]: [...linhas(arranjos[i], campo), campo === 'paineis' ? linhaModulo(null, 0) : linhaInversor(null, 0)] })
  const delLinha = (i, campo, j) => patch(i, { [campo]: linhas(arranjos[i], campo).filter((_, k) => k !== j) })
  const setLinha = (i, campo, j, novaLinha) => patch(i, { [campo]: linhas(arranjos[i], campo).map((l, k) => k === j ? novaLinha : l) })

  function escolherFab(i, campo, j, fab) {
    const atual = linhas(arranjos[i], campo)[j]
    const base = campo === 'paineis' ? linhaModulo(null, atual?.quantidade || 0) : linhaInversor(null, atual?.quantidade || 0)
    setLinha(i, campo, j, { ...base, fabricante: fab, marca: fab, modelo: null, equipamento_id: null })
  }
  function escolherModelo(i, campo, j, id) {
    const fonte = campo === 'paineis' ? catalogo.modulos : catalogo.inversores
    const item = fonte.find(x => x._id === id)
    const q = linhas(arranjos[i], campo)[j]?.quantidade || 1
    setLinha(i, campo, j, campo === 'paineis' ? linhaModulo(item, q) : linhaInversor(item, q))
  }
  function setQtd(i, campo, j, q) { const l = { ...linhas(arranjos[i], campo)[j], quantidade: q === '' ? 0 : Number(q) }; setLinha(i, campo, j, l) }

  function LinhaEquip({ i, campo, j, linha, ro }) {
    const fabs = campo === 'paineis' ? fabsMod : fabsInv
    const porFab = campo === 'paineis' ? modPorFab : invPorFab
    const modelos = linha.fabricante ? (porFab[linha.fabricante] || []) : []
    const idSel = linha.equipamento_id || ''
    return (
      <div className="grid grid-cols-[1fr_1fr_64px_28px] gap-1.5 items-center">
        <select disabled={ro} value={linha.fabricante || ''} onChange={(e) => escolherFab(i, campo, j, e.target.value)}
          className="text-xs px-2 py-1.5 rounded border border-slate-300 bg-white">
          <option value="">{carregando ? '…' : 'Fabricante'}</option>
          {fabs.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select disabled={ro || !linha.fabricante} value={idSel} onChange={(e) => escolherModelo(i, campo, j, e.target.value)}
          className="text-xs px-2 py-1.5 rounded border border-slate-300 bg-white disabled:bg-slate-50">
          <option value="">Modelo</option>
          {modelos.map(m => <option key={m._id} value={m._id}>{m.modelo} · {campo === 'paineis' ? `${potW(m) || '?'}W` : `${potKW(m) || '?'}kW`}</option>)}
        </select>
        <input disabled={ro} type="number" min="0" value={linha.quantidade ?? ''} onChange={(e) => setQtd(i, campo, j, e.target.value)}
          className="text-xs px-2 py-1.5 rounded border border-slate-300 bg-white text-center" placeholder="Qtd" />
        {!ro && <button type="button" onClick={() => delLinha(i, campo, j)} className="p-1 text-red-400 hover:bg-red-50 rounded" aria-label="Remover"><Trash2 size={13} /></button>}
      </div>
    )
  }

  return (
    <section className="border border-emerald-200 rounded-xl bg-emerald-50 p-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Layers size={18} className="text-emerald-600" />
        <h3 className="font-semibold text-slate-900">Arranjos do Sistema</h3>
        <span className="text-[10px] text-emerald-600 font-bold tracking-widest bg-emerald-100 border border-emerald-200 rounded-full px-2 py-0.5">MULTIARRANJO</span>
        {tipoProjeto === 'ampliacao' && <span className="text-[10px] text-amber-700 font-bold bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">AMPLIAÇÃO</span>}
      </div>
      <p className="text-xs text-slate-500">Cada arranjo tem seus próprios módulos e inversores (marcas/modelos diferentes). Seleção Fabricante → Modelo.</p>

      {arranjos.length === 0 && <p className="text-xs text-slate-400 italic">Nenhum arranjo. Clique em "Novo arranjo".</p>}

      {arranjos.map((a, i) => {
        const ro = !!a.somente_leitura
        return (
          <div key={a.id || i} className={['rounded-lg border p-3 space-y-3', ro ? 'border-slate-300 bg-slate-100' : 'border-emerald-300 bg-white'].join(' ')}>
            <div className="flex items-center justify-between gap-2">
              <input disabled={ro} value={a.rotulo || `Arranjo ${i + 1}`} onChange={(e) => patch(i, { rotulo: e.target.value })}
                className="text-sm font-bold text-slate-800 bg-transparent border-b border-transparent focus:border-emerald-300 outline-none" />
              <div className="flex items-center gap-1">
                {ro && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-200 border border-slate-300 rounded-full px-2 py-0.5"><Lock size={10} /> Existente</span>}
                {!ro && <>
                  <button type="button" onClick={() => dupArranjo(i)} className="p-1 text-slate-400 hover:bg-slate-100 rounded" title="Duplicar arranjo"><Copy size={14} /></button>
                  <button type="button" onClick={() => delArranjo(i)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Excluir arranjo"><Trash2 size={14} /></button>
                </>}
              </div>
            </div>

            {/* Módulos */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-600"><Sun size={12} className="text-amber-500" /> Módulos</div>
              {linhas(a, 'paineis').map((l, j) => <LinhaEquip key={j} i={i} campo="paineis" j={j} linha={l} ro={ro} />)}
              {!ro && <button type="button" onClick={() => addLinha(i, 'paineis')} className="text-xs text-emerald-700 font-medium flex items-center gap-1"><Plus size={12} /> Adicionar módulo</button>}
            </div>

            {/* Inversores */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-600"><Zap size={12} className="text-blue-500" /> Inversores</div>
              {linhas(a, 'inversores').map((l, j) => <LinhaEquip key={j} i={i} campo="inversores" j={j} linha={l} ro={ro} />)}
              {!ro && <button type="button" onClick={() => addLinha(i, 'inversores')} className="text-xs text-emerald-700 font-medium flex items-center gap-1"><Plus size={12} /> Adicionar inversor</button>}
            </div>

            {/* Orientação / Inclinação (UX) */}
            {!ro && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-600">Orientação
                  <select value={a.orientacao || 'Norte'} onChange={(e) => patch(i, { orientacao: e.target.value })} className="mt-0.5 w-full text-xs px-2 py-1.5 rounded border border-slate-300 bg-white">
                    {['Norte', 'Nordeste', 'Noroeste', 'Leste', 'Oeste', 'Sul'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </label>
                <label className="text-xs text-slate-600">Inclinação (°)
                  <input type="number" min="0" max="90" value={a.inclinacao ?? ''} onChange={(e) => patch(i, { inclinacao: e.target.value })} className="mt-0.5 w-full text-xs px-2 py-1.5 rounded border border-slate-300 bg-white" placeholder="ex.: 15" />
                </label>
              </div>
            )}
          </div>
        )
      })}

      <Button variante="secundario" icone={Plus} onClick={addArranjo} tamanho="sm">Novo arranjo</Button>
    </section>
  )
}
