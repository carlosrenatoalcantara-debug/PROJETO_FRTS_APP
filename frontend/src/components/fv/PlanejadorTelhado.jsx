import { useMemo } from 'react'
import { Plus, Trash2, Compass, Sun, Cloudy, Square } from 'lucide-react'
import { consolidarPanos, ORIENTACOES_PANO, panoNovo } from '../../utils/geoEngine'

/**
 * PlanejadorTelhado — Sprint 6
 *
 * Gerenciador de múltiplos panos de telhado (geoespacial leve). Cada pano tem
 * área, orientação, inclinação, sombra, orientação do módulo e obstáculos.
 * Calcula área útil real e capacidade máxima de módulos — que alimentam a
 * engenharia (snapshot técnico) e limitam o E7.
 *
 * @param {Array}    panos
 * @param {function} onChange  (panos) => void
 * @param {boolean}  [bloqueado]  — congelado: somente leitura
 */
export default function PlanejadorTelhado({ panos = [], onChange, bloqueado = false }) {
  const consolidado = useMemo(() => consolidarPanos(panos), [panos])

  function atualizar(i, campo, valor) {
    if (bloqueado) return
    const novo = panos.map((p, idx) => idx === i ? { ...p, [campo]: valor } : p)
    onChange(novo)
  }
  function adicionar() {
    if (bloqueado) return
    onChange([...panos, panoNovo(panos.length)])
  }
  function remover(i) {
    if (bloqueado) return
    onChange(panos.filter((_, idx) => idx !== i))
  }
  function addObstaculo(i) {
    if (bloqueado) return
    const nome = window.prompt('Obstáculo (ex: caixa d\'água, chaminé):', 'Obstáculo')
    if (!nome) return
    const area = Number(window.prompt('Área aproximada do obstáculo (m²):', '2')) || 0
    const p = panos[i]
    const obst = [...(p.obstaculos || []), { nome, area_m2: area }]
    atualizar(i, 'obstaculos', obst)
  }
  function removerObstaculo(i, j) {
    if (bloqueado) return
    const p = panos[i]
    atualizar(i, 'obstaculos', (p.obstaculos || []).filter((_, idx) => idx !== j))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <Square size={15} className="text-slate-500" /> Panos do telhado ({panos.length})
        </p>
        {!bloqueado && (
          <button onClick={adicionar} className="flex items-center gap-1 text-sm text-emerald-700 font-medium hover:underline">
            <Plus size={14} /> Adicionar pano
          </button>
        )}
      </div>

      {panos.length === 0 && (
        <p className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg p-3">
          Nenhum pano cadastrado. Adicione os planos do telhado para calcular a área útil real e a capacidade de módulos.
        </p>
      )}

      {panos.map((p, i) => {
        const calc = consolidado.panos[i] || {}
        return (
          <div key={p.id || i} className="border border-slate-200 rounded-lg p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <input
                value={p.nome || ''} disabled={bloqueado}
                onChange={(e) => atualizar(i, 'nome', e.target.value)}
                className="text-sm font-semibold text-slate-800 bg-transparent border-b border-transparent focus:border-slate-300 focus:outline-none"
              />
              {!bloqueado && (
                <button onClick={() => remover(i)} className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Campo label="Área bruta (m²)">
                <input type="number" min="0" step="1" value={p.area_bruta} disabled={bloqueado}
                  onChange={(e) => atualizar(i, 'area_bruta', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </Campo>
              <Campo label="Orientação">
                <select value={p.orientacao} disabled={bloqueado}
                  onChange={(e) => atualizar(i, 'orientacao', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {ORIENTACOES_PANO.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Campo>
              <Campo label={`Inclinação ${p.inclinacao}°`}>
                <input type="range" min="0" max="45" step="5" value={p.inclinacao} disabled={bloqueado}
                  onChange={(e) => atualizar(i, 'inclinacao', Number(e.target.value))} className="w-full" />
              </Campo>
              <Campo label={`Sombra ${p.fator_sombra}%`}>
                <input type="range" min="0" max="90" step="5" value={p.fator_sombra} disabled={bloqueado}
                  onChange={(e) => atualizar(i, 'fator_sombra', Number(e.target.value))} className="w-full" />
              </Campo>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-xs text-slate-500 flex items-center gap-1">
                Módulo:
                <select value={p.orientacao_modulo || 'retrato'} disabled={bloqueado}
                  onChange={(e) => atualizar(i, 'orientacao_modulo', e.target.value)}
                  className="px-1.5 py-1 text-xs border border-slate-300 rounded">
                  <option value="retrato">Retrato</option>
                  <option value="paisagem">Paisagem</option>
                </select>
              </label>
              {!bloqueado && (
                <button onClick={() => addObstaculo(i)} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1">
                  <Plus size={12} /> Obstáculo
                </button>
              )}
              {(p.obstaculos || []).map((o, j) => (
                <span key={j} className="text-xs bg-slate-100 rounded px-1.5 py-0.5 flex items-center gap-1">
                  {o.nome} ({o.area_m2}m²)
                  {!bloqueado && <button onClick={() => removerObstaculo(i, j)} className="text-slate-400 hover:text-red-600">×</button>}
                </span>
              ))}
            </div>

            {/* Resultado do pano */}
            <div className="flex items-center gap-4 text-xs text-slate-600 bg-slate-50 rounded px-2 py-1.5">
              <span><Compass size={11} className="inline mr-0.5" />Azimute {calc.azimute}°</span>
              <span>Útil: <strong>{calc.area_util} m²</strong></span>
              <span><Sun size={11} className="inline mr-0.5" />Fator {calc.fator_geracao}</span>
              <span className="ml-auto font-semibold text-emerald-700">{calc.capacidade_modulos} módulos</span>
            </div>
          </div>
        )
      })}

      {/* Consolidação */}
      {panos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Resumo titulo="Área bruta" valor={`${consolidado.area_bruta_total} m²`} />
          <Resumo titulo="Área útil" valor={`${consolidado.area_util_total} m²`} />
          <Resumo titulo="Capacidade" valor={`${consolidado.max_modulos_total} módulos`} destaque />
          <Resumo titulo="Sombra média" valor={`${consolidado.fator_sombra_medio}%`} />
        </div>
      )}
    </div>
  )
}

function Campo({ label, children }) {
  return <div><label className="text-xs text-slate-500 block mb-0.5">{label}</label>{children}</div>
}
function Resumo({ titulo, valor, destaque }) {
  return (
    <div className={`rounded-lg p-2.5 border ${destaque ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
      <p className="text-[11px] text-slate-500">{titulo}</p>
      <p className={`text-sm font-bold ${destaque ? 'text-emerald-700' : 'text-slate-800'}`}>{valor}</p>
    </div>
  )
}
