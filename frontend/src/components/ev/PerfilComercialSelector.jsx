/**
 * PerfilComercialSelector.jsx — FEATURE-004.
 * Na etapa de orçamento: escolhe o Perfil Comercial (herdado da empresa) OU
 * personaliza APENAS esta proposta. A personalização nunca altera a empresa.
 */
import { useEffect, useState } from 'react'
import { Sliders, Building2, Pencil } from 'lucide-react'
import { buscarPoliticaComercialEmpresa } from '../../services/politicaComercialApi'
import { POLITICA_PADRAO, normalizarPolitica, MODO_LABEL, MODOS_APRESENTACAO } from '../../utils/politicaComercial'

export default function PerfilComercialSelector({ value, onChange }) {
  // value: { politica, politica_perfil, politica_herdada }
  const [perfisEmpresa, setPerfisEmpresa] = useState([])
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    buscarPoliticaComercialEmpresa().then((pc) => {
      const lista = Array.isArray(pc?.perfis) && pc.perfis.length ? pc.perfis.map(normalizarPolitica) : [normalizarPolitica(pc?.padrao || POLITICA_PADRAO)]
      setPerfisEmpresa(lista)
      // Se o projeto ainda não tem política, herda o padrão da empresa.
      if (!value?.politica) {
        const padrao = lista.find((x) => /padr[ãa]o/i.test(x.nome)) || lista[0]
        onChange?.({ politica: padrao, politica_perfil: padrao.nome, politica_herdada: true })
      }
    }).catch(() => {
      if (!value?.politica) onChange?.({ politica: normalizarPolitica(POLITICA_PADRAO), politica_perfil: 'Padrão Empresa', politica_herdada: true })
    })
  }, []) // eslint-disable-line

  const politica = normalizarPolitica(value?.politica || POLITICA_PADRAO)
  const herdada = value?.politica_herdada !== false
  const patchPol = (chg) => onChange?.({ politica: { ...politica, ...chg }, politica_perfil: value?.politica_perfil || politica.nome, politica_herdada: false })
  const patchMargem = (chg) => patchPol({ margem: { ...politica.margem, ...chg } })

  const usarPadrao = (perfil) => onChange?.({ politica: perfil, politica_perfil: perfil.nome, politica_herdada: true })

  return (
    <div className="border-2 border-blue-200 bg-blue-50/50 rounded-xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Sliders size={16} className="text-blue-600" />
          <span className="font-semibold text-slate-700">Perfil Comercial:</span>
          <span className="text-slate-900 font-medium">{value?.politica_perfil || politica.nome}</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${herdada ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {herdada ? 'herdado da empresa' : 'personalizado nesta proposta'}
          </span>
        </div>
        <button type="button" onClick={() => setAberto((v) => !v)}
          className="text-xs text-blue-700 font-medium inline-flex items-center gap-1"><Pencil size={12} /> Alterar</button>
      </div>

      {aberto && (
        <div className="mt-3 space-y-3 border-t border-blue-200 pt-3">
          {/* opção: usar padrão */}
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="modo-perfil" checked={herdada} onChange={() => usarPadrao(perfisEmpresa.find((x) => x.nome === (value?.politica_perfil)) || perfisEmpresa[0] || normalizarPolitica(POLITICA_PADRAO))} className="accent-blue-600" />
              <Building2 size={13} className="text-slate-500" /> Utilizar padrão da empresa
            </label>
            {herdada && perfisEmpresa.length > 1 && (
              <select value={value?.politica_perfil || ''} onChange={(e) => usarPadrao(perfisEmpresa.find((x) => x.nome === e.target.value))}
                className="ml-6 border border-slate-300 rounded px-2 py-1 text-xs bg-white">
                {perfisEmpresa.map((x) => <option key={x.nome} value={x.nome}>{x.nome}</option>)}
              </select>
            )}
          </div>

          {/* opção: personalizar */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" name="modo-perfil" checked={!herdada} onChange={() => patchPol({})} className="accent-blue-600" />
            <Pencil size={13} className="text-slate-500" /> Personalizar apenas esta proposta
          </label>

          {!herdada && (
            <div className="ml-6 space-y-3 bg-white border border-slate-200 rounded-lg p-3">
              <p className="text-[11px] text-amber-700">A alteração é gravada somente neste projeto — nunca no perfil da empresa.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <MargemCat titulo="Materiais" aplicar={politica.margem.aplicar_materiais} pct={politica.margem.materiais_pct}
                  onAplicar={(v) => patchMargem({ aplicar_materiais: v })} onPct={(v) => patchMargem({ materiais_pct: v })} />
                <MargemCat titulo="Equipamentos" aplicar={politica.margem.aplicar_equipamentos} pct={politica.margem.equipamentos_pct}
                  onAplicar={(v) => patchMargem({ aplicar_equipamentos: v })} onPct={(v) => patchMargem({ equipamentos_pct: v })} />
                <MargemCat titulo="Serviços" aplicar={politica.margem.aplicar_servicos} pct={politica.margem.servicos_pct}
                  onAplicar={(v) => patchMargem({ aplicar_servicos: v })} onPct={(v) => patchMargem({ servicos_pct: v })} />
              </div>
              <div className="flex flex-wrap gap-4 items-end">
                <div><label className="block text-[11px] text-slate-500 mb-1">Impostos (%)</label>
                  <input type="number" value={politica.impostos_pct} onChange={(e) => patchPol({ impostos_pct: Number(e.target.value) || 0 })}
                    className="w-24 border border-slate-300 rounded px-2 py-1 text-xs text-right" /></div>
                <div><label className="block text-[11px] text-slate-500 mb-1">Modo de apresentação</label>
                  <select value={politica.modo_apresentacao} onChange={(e) => patchPol({ modo_apresentacao: e.target.value })}
                    className="border border-slate-300 rounded px-2 py-1 text-xs bg-white">
                    {Object.keys(MODOS_APRESENTACAO).map((m) => <option key={m} value={m}>{MODO_LABEL[m]}</option>)}
                  </select></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MargemCat({ titulo, aplicar, pct, onAplicar, onPct }) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!aplicar} onChange={(e) => onAplicar(e.target.checked)} className="accent-blue-600" /> {titulo}</label>
      <input type="number" value={pct} onChange={(e) => onPct(Number(e.target.value) || 0)} disabled={!aplicar}
        className="w-full border border-slate-300 rounded px-2 py-1 text-right disabled:bg-slate-100" placeholder="%" />
    </div>
  )
}
