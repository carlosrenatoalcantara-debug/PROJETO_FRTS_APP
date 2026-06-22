/**
 * SugestaoTopologiaReferencia.jsx — P1-COSERN-REFERENCE-TOPOLOGIES-01
 *
 * Painel opcional de SUGESTÃO de topologia técnica de referência (COSERN).
 * Aparece quando a concessionária é COSERN. O usuário escolhe a classe
 * (M2/M3/T5/T6/T7/T8) e a arquitetura; o sistema mostra a configuração de
 * referência e um botão "Aplicar configuração técnica de referência".
 * NÃO aplica automaticamente — apenas pré-configura via callback onAplicar.
 */
import { useState, useEffect } from 'react'
import { BookOpen, Wand2, AlertTriangle } from 'lucide-react'

const CLASSES = ['M2', 'M3', 'T5', 'T6', 'T7', 'T8']
const ARQUITETURAS = [
  { id: 'string', label: 'String' },
  { id: 'micro', label: 'Microinversor' },
  { id: 'otimizador', label: 'Otimizador' },
]

export default function SugestaoTopologiaReferencia({ concessionaria, onAplicar }) {
  const ehCosern = String(concessionaria || '').toUpperCase().replace(/\s+/g, '').includes('COSERN')
  const [classe, setClasse] = useState('')
  const [arquitetura, setArquitetura] = useState('string')
  const [ref, setRef] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!ehCosern || !classe) { setRef(null); return }
    let vivo = true
    setCarregando(true); setErro('')
    fetch(`/api/referencia/topologia?concessionaria=COSERN&classe=${classe}&arquitetura=${arquitetura}`)
      .then(r => r.json())
      .then(d => { if (!vivo) return; if (d.ok) setRef(d); else { setRef(null); setErro(d.erro || 'Não encontrado') } })
      .catch(e => vivo && setErro(e.message))
      .finally(() => vivo && setCarregando(false))
    return () => { vivo = false }
  }, [ehCosern, classe, arquitetura])

  if (!ehCosern) return null

  const t = ref?.topologia
  const inv = t?.inversor

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BookOpen size={16} className="text-indigo-600" />
        <h3 className="text-sm font-semibold text-slate-800">Topologia de referência COSERN</h3>
        <span className="text-[10px] font-bold tracking-widest text-indigo-500 bg-white border border-indigo-200 rounded-full px-2 py-0.5">SUGESTÃO</span>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-[11px] text-slate-500 block mb-1">Classe de entrada</label>
          <div className="flex gap-1">
            {CLASSES.map(c => (
              <button key={c} type="button" onClick={() => setClasse(c)}
                className={`text-xs font-mono font-bold px-2.5 py-1.5 rounded border ${classe === c ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[11px] text-slate-500 block mb-1">Arquitetura</label>
          <div className="flex gap-1">
            {ARQUITETURAS.map(a => (
              <button key={a.id} type="button" onClick={() => setArquitetura(a.id)}
                className={`text-xs px-2.5 py-1.5 rounded border ${arquitetura === a.id ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {carregando && <p className="text-xs text-slate-400">Carregando referência…</p>}
      {erro && <p className="text-xs text-red-600">Sem referência: {erro}</p>}

      {t && (
        <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5 text-xs">
            <div><p className="text-slate-400">Potência FV</p><p className="font-bold text-slate-800">{t.potencia_fv_kwp ?? t.modulos_atendidos ? (t.potencia_fv_kwp ?? '—') : '—'} {t.potencia_fv_kwp ? 'kWp' : ''}</p></div>
            <div><p className="text-slate-400">Módulos</p><p className="font-bold text-slate-800">{t.num_modulos ?? t.modulos_atendidos ?? '—'}</p></div>
            <div><p className="text-slate-400">Potência CA</p><p className="font-bold text-slate-800">{t.potencia_ca_kw ?? '—'} kW</p></div>
            <div><p className="text-slate-400">Oversizing</p><p className="font-bold text-slate-800">{t.oversizing ? `${t.oversizing}×` : '—'}</p></div>
            {arquitetura === 'string' && inv && <>
              <div className="col-span-2"><p className="text-slate-400">Inversor</p><p className="font-semibold text-slate-800">{inv.fabricante} {inv.modelo} ({inv.potencia_kw} kW)</p></div>
              <div><p className="text-slate-400">MPPT / Entradas</p><p className="font-semibold text-slate-800">{t.mppt} / {t.entradas}</p></div>
              <div><p className="text-slate-400">Strings × mód</p><p className="font-semibold text-slate-800">{t.strings} × {t.modulos_por_string}</p></div>
              <div><p className="text-slate-400">Voc estimado</p><p className="font-semibold text-slate-800">{t.voc_estimado_v} V</p></div>
              <div><p className="text-slate-400">Corrente est.</p><p className="font-semibold text-slate-800">{t.corrente_estimada_a} A</p></div>
            </>}
            {arquitetura === 'micro' && <>
              <div className="col-span-2"><p className="text-slate-400">Microinversor</p><p className="font-semibold text-slate-800">{t.modelo} · {t.num_micros} un.</p></div>
              <div><p className="text-slate-400">Entradas/micro</p><p className="font-semibold text-slate-800">{t.entradas_por_micro}</p></div>
            </>}
            {arquitetura === 'otimizador' && <>
              <div className="col-span-2"><p className="text-slate-400">Inversor compatível</p><p className="font-semibold text-slate-800">{t.inversor_compativel}</p></div>
              <div><p className="text-slate-400">Otimizadores</p><p className="font-semibold text-slate-800">{t.modelo} · {t.quantidade} un.</p></div>
            </>}
          </div>

          {ref?.limites && (
            <p className="text-[11px] text-slate-500">
              Classe {classe}: {ref.limites.ligacao} {ref.limites.tensao_v}V · disjuntor {ref.limites.disjuntor_a}A · cabo {ref.limites.cabo_mm2}mm² · {ref.limites.caixa}
            </p>
          )}

          <button type="button" onClick={() => onAplicar?.(ref)}
            className="w-full mt-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
            <Wand2 size={15} /> Aplicar configuração técnica de referência
          </button>
        </div>
      )}

      <p className="text-[11px] text-amber-700 flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
        <AlertTriangle size={12} className="shrink-0 mt-0.5" />
        Sugestão inicial editável — NÃO substitui o dimensionamento nem a Norma Técnica COSERN. Confirme os limites de entrada com a NT vigente.
      </p>
    </div>
  )
}
