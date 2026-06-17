/**
 * GerenciadorArranjos.jsx — P1-UX-FRONT-CONNECT-01 (FASE 1 + FASE 3)
 *
 * UI para múltiplos arranjos de componentes. Permite adicionar blocos extra de
 * (módulo + inversor) com marcas/potências distintas, e remover blocos limpando
 * o índice do array antes do salvamento.
 *
 * FASE 3: em projetos de ampliação (tipoProjeto === 'ampliacao'), os arranjos com
 * `somente_leitura` (o sistema executado, congelado) são renderizados desabilitados
 * com a tag "Sistema Existente"; apenas o(s) bloco(s) de ampliação ficam editáveis.
 */
import { useState, useEffect } from 'react'
import { Plus, Trash2, Sun, Zap, Lock, Layers } from 'lucide-react'
import { useProjetoFV } from '../../contexts/ProjetoFVContext'
import Button from '../ui/Button'

// Lê o módulo/inversor de um bloco em qualquer um dos dois shapes:
//  - frontend (singular): block.painel / block.inversor
//  - backend  (array):    block.paineis[0] / block.inversores[0]
function moduloDoBloco(b)   { return b.painel   || b.paineis?.[0]    || null }
function inversorDoBloco(b) { return b.inversor || b.inversores?.[0] || null }

function rotuloEquip(e, tipo) {
  if (!e) return '— selecionar —'
  const pot = tipo === 'modulo'
    ? `${e.potencia_w || e.potenciaW || e.especificacoes?.potencia_wp || e.especificacoes?.potencia_w || e.especificacoes?.potencia || '?'}W`
    : `${e.potencia_kw || e.potenciaKW || e.especificacoes?.potencia_kw || e.especificacoes?.potencia || '?'}kW`
  return `${e.fabricante || e.marca || ''} ${e.modelo || ''} · ${pot}`.trim()
}

export default function GerenciadorArranjos() {
  const { state, dispatch } = useProjetoFV()
  const { arranjos, equipamentos, tipoProjeto } = state
  const [catalogo, setCatalogo] = useState({ modulos: [], inversores: [] })
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    fetch('/api/equipamentos?limit=1000')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!vivo) return
        const items = d?.equipamentos || []
        setCatalogo({
          modulos:    items.filter(e => e.tipo === 'modulo'),
          inversores: items.filter(e => e.tipo === 'inversor'),
        })
      })
      .catch(() => {})
      .finally(() => vivo && setCarregando(false))
    return () => { vivo = false }
  }, [])

  function setArranjo(index, patch) { dispatch({ type: 'SET_ARRANJO', payload: { index, patch } }) }
  function addArranjo()             { dispatch({ type: 'ADD_ARRANJO' }) }
  function removeArranjo(index)     { dispatch({ type: 'REMOVE_ARRANJO', payload: index }) }

  function pickModulo(index, id) {
    const m = catalogo.modulos.find(x => x._id === id)
    setArranjo(index, { painel: m || null })
  }
  function pickInversor(index, id) {
    const inv = catalogo.inversores.find(x => x._id === id)
    setArranjo(index, { inversor: inv || null })
  }

  const primario = moduloDoBloco({ painel: equipamentos.painel, inversor: equipamentos.inversor })
  const temPrimario = !!(equipamentos.painel || equipamentos.inversor)

  return (
    <section className="border border-emerald-200 rounded-xl bg-emerald-50 p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Layers size={18} className="text-emerald-600" />
        <h3 className="font-semibold text-slate-900">Arranjos do Sistema</h3>
        <span className="text-[10px] text-emerald-600 font-bold tracking-widest bg-emerald-100 border border-emerald-200 rounded-full px-2 py-0.5">
          MÚLTIPLOS
        </span>
        {tipoProjeto === 'ampliacao' && (
          <span className="text-[10px] text-amber-700 font-bold tracking-wide bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">
            AMPLIAÇÃO
          </span>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Combine módulos e inversores de marcas/potências diferentes em blocos independentes
        (ex.: Bloco A com Helius, Bloco B com Sirius).
      </p>

      {/* Arranjo primário (da seleção principal acima) — só em projeto novo */}
      {tipoProjeto !== 'ampliacao' && temPrimario && (
        <div className="rounded-lg border border-emerald-200 bg-white p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-emerald-700">Arranjo A</span>
            <span className="text-[10px] text-slate-400">(seleção principal acima)</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-2 text-xs text-slate-600">
            <span className="flex items-center gap-1"><Sun size={12} className="text-amber-500" /> {rotuloEquip(equipamentos.painel, 'modulo')}</span>
            <span className="flex items-center gap-1"><Zap size={12} className="text-blue-500" /> {rotuloEquip(equipamentos.inversor, 'inversor')}</span>
          </div>
        </div>
      )}

      {/* Blocos de arranjo (extra / ampliação) */}
      {arranjos.map((b, index) => {
        const ro = !!b.somente_leitura
        const mod = moduloDoBloco(b)
        const inv = inversorDoBloco(b)
        return (
          <div
            key={b.id || index}
            className={[
              'rounded-lg border p-3 space-y-2',
              ro ? 'border-slate-300 bg-slate-100' : 'border-emerald-300 bg-white',
            ].join(' ')}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">{b.rotulo || `Arranjo ${index + 1}`}</span>
                {ro && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-200 border border-slate-300 rounded-full px-2 py-0.5">
                    <Lock size={10} /> Sistema Existente
                  </span>
                )}
              </div>
              {!ro && (
                <button
                  type="button"
                  onClick={() => removeArranjo(index)}
                  className="p-1 rounded text-red-500 hover:bg-red-50"
                  title="Remover arranjo"
                  aria-label="Remover arranjo"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="grid sm:grid-cols-3 gap-2">
              {/* Módulo */}
              <label className="text-xs text-slate-600">
                <span className="flex items-center gap-1 mb-1"><Sun size={11} className="text-amber-500" /> Módulo</span>
                {ro ? (
                  <input disabled value={rotuloEquip(mod, 'modulo')} className="w-full text-xs px-2 py-1.5 rounded border border-slate-200 bg-slate-50 text-slate-500" />
                ) : (
                  <select
                    value={mod?._id || ''}
                    onChange={(e) => pickModulo(index, e.target.value)}
                    className="w-full text-xs px-2 py-1.5 rounded border border-slate-300 bg-white"
                  >
                    <option value="">{carregando ? 'Carregando…' : '— selecionar —'}</option>
                    {catalogo.modulos.map(m => (
                      <option key={m._id} value={m._id}>{rotuloEquip(m, 'modulo')}</option>
                    ))}
                  </select>
                )}
              </label>

              {/* Inversor */}
              <label className="text-xs text-slate-600">
                <span className="flex items-center gap-1 mb-1"><Zap size={11} className="text-blue-500" /> Inversor</span>
                {ro ? (
                  <input disabled value={rotuloEquip(inv, 'inversor')} className="w-full text-xs px-2 py-1.5 rounded border border-slate-200 bg-slate-50 text-slate-500" />
                ) : (
                  <select
                    value={inv?._id || ''}
                    onChange={(e) => pickInversor(index, e.target.value)}
                    className="w-full text-xs px-2 py-1.5 rounded border border-slate-300 bg-white"
                  >
                    <option value="">{carregando ? 'Carregando…' : '— selecionar —'}</option>
                    {catalogo.inversores.map(i => (
                      <option key={i._id} value={i._id}>{rotuloEquip(i, 'inversor')}</option>
                    ))}
                  </select>
                )}
              </label>

              {/* Quantidade de módulos */}
              <label className="text-xs text-slate-600">
                <span className="block mb-1">Qtd. módulos</span>
                <input
                  type="number" min="0" disabled={ro}
                  value={b.quantidadeModulos ?? (mod?.quantidade ?? mod?.paineis?.[0]?.quantidade ?? '')}
                  onChange={(e) => setArranjo(index, { quantidadeModulos: e.target.value ? Number(e.target.value) : null })}
                  className={['w-full text-xs px-2 py-1.5 rounded border', ro ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-slate-300 bg-white'].join(' ')}
                  placeholder="0"
                />
              </label>
            </div>
          </div>
        )
      })}

      <Button variante="secundario" icone={Plus} onClick={addArranjo} tamanho="sm">
        Adicionar Novo Arranjo (Módulos/Inversor)
      </Button>
    </section>
  )
}
