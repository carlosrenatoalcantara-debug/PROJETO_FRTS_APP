import { useState, useEffect, useRef } from 'react'
import { X, Zap, Upload, CheckCircle, AlertTriangle, Save } from 'lucide-react'
import { avaliarUtilizavel } from '../../utils/utilizavelProjeto'
import { getNivelConfig } from '../../utils/catalogQualityEngine'
import BadgeEngenharia from '../engenharia/BadgeEngenharia.jsx'
import { payloadEngenharia } from '../../utils/engenharia/engenhariaPayload.js'

/**
 * FichaTecnicaModal — Sprint 8.0.2
 *
 * Ficha técnica profissional do equipamento: 3 status (Comercial/Engenharia/
 * Homologação), campos agrupados por tipo, com valor + fonte + confiança.
 * Edição manual, "Completar com IA" e upload de documentos técnicos.
 */
const API = ''

// Grupos de campos por tipo (chave = especificacoes.<chave>)
const GRUPOS = {
  modulo: {
    'Identificação': [['fabricante', 'Fabricante', 'topo'], ['modelo', 'Modelo', 'topo'], ['tecnologia', 'Tecnologia'], ['tipo_celula', 'N/P-Type'], ['bifacial', 'Bifacial']],
    'Elétrico STC': [['potencia', 'Potência (Wp)'], ['voc', 'Voc (V)'], ['vmp', 'Vmp (V)'], ['isc', 'Isc (A)'], ['imp', 'Imp (A)'], ['eficiencia', 'Eficiência (%)']],
    'Temperatura': [['coef_temp_voc', 'Coef. Voc (%/°C)'], ['coef_temp_pmax', 'Coef. Pmax (%/°C)'], ['noct', 'NOCT (°C)']],
    'Físico': [['comprimento', 'Comprimento (mm)'], ['largura', 'Largura (mm)'], ['espessura', 'Espessura (mm)'], ['peso', 'Peso (kg)']],
    'Garantia': [['garantia_produto', 'Produto (anos)'], ['garantia_performance', 'Desempenho (anos)'], ['degradacao_anual', 'Degradação (%/ano)']],
  },
  inversor: {
    'Identificação': [['fabricante', 'Fabricante', 'topo'], ['modelo', 'Modelo', 'topo']],
    'Entrada CC': [['potencia_cc_max', 'Pot. FV máx (kW)'], ['voc_max', 'Tensão máx CC (V)'], ['tensao_partida', 'Tensão partida (V)'], ['faixa_mppt_min', 'MPPT mín (V)'], ['faixa_mppt_max', 'MPPT máx (V)'], ['mppts', 'Qtd MPPT']],
    'Por MPPT': [['strings_por_mppt', 'Strings/MPPT'], ['corrente_max_mppt', 'Corrente máx (A)'], ['corrente_curto_mppt', 'Corrente curto (A)']],
    'Saída CA': [['potencia', 'Pot. nominal (kW)'], ['potencia_max', 'Pot. máxima (kW)'], ['tensao_saida', 'Tensão saída (V)'], ['corrente_max', 'Corrente máx (A)'], ['fases', 'Fases']],
    'Outros': [['eficiencia', 'Eficiência (%)'], ['grau_protecao', 'Grau proteção (IP)'], ['garantia', 'Garantia (anos)']],
  },
  carregador_ev: {
    'Geral': [['fabricante', 'Fabricante', 'topo'], ['modelo', 'Modelo', 'topo'], ['potencia', 'Potência (kW)'], ['tensao', 'Tensão (V)'], ['corrente', 'Corrente (A)'], ['fases', 'Fases']],
    'Conectividade': [['conector', 'Conector'], ['ocpp', 'OCPP'], ['protecoes', 'Proteções'], ['garantia', 'Garantia (anos)']],
  },
}

const FONTE_COR = { SolarMarket: 'bg-purple-100 text-purple-700', Gemini: 'bg-blue-100 text-blue-700', 'Gemini (cache)': 'bg-blue-100 text-blue-700', Datasheet: 'bg-amber-100 text-amber-700', Manual: 'bg-emerald-100 text-emerald-700' }

export default function FichaTecnicaModal({ equipamento, onFechar, onSalvo }) {
  const tipo = equipamento.tipo || 'modulo'
  const grupos = GRUPOS[tipo] || GRUPOS.modulo
  const [form, setForm] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const [homolog, setHomolog] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    const esp = equipamento.especificacoes || {}
    const init = { fabricante: equipamento.fabricante, modelo: equipamento.modelo }
    Object.values(grupos).flat().forEach(([k, , loc]) => { if (loc !== 'topo') init[k] = esp[k] ?? '' })
    setForm(init)
    fetch(`${API}/api/admin/catalogo/equipamento/${equipamento._id}/homologacao`)
      .then(r => r.json()).then(d => d.sucesso && setHomolog(d.homologacao)).catch(() => {})
  }, [equipamento._id]) // eslint-disable-line

  const fonteDados = equipamento.fonte_dados || {}
  const espAtual = { ...(equipamento.especificacoes || {}), ...form }
  // P1-ENGINEERING-CONSUME-01: payload de engenharia (badges/justificativa runtime).
  const payloadEng = payloadEngenharia({ ...equipamento, especificacoes: espAtual })
  const eng = avaliarUtilizavel(tipo, espAtual)
  const nivel = equipamento.qualidade?.nivel
  const nivelCfg = getNivelConfig(nivel)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function salvar() {
    setSalvando(true); setMsg('')
    try {
      const campos = {}
      Object.entries(form).forEach(([k, v]) => { if (v !== '' && v != null) campos[k] = isNaN(Number(v)) || ['fabricante', 'modelo', 'tecnologia', 'tipo_celula', 'conector', 'grau_protecao', 'protecoes'].includes(k) ? v : Number(v) })
      const res = await fetch(`${API}/api/admin/catalogo/equipamento/${equipamento._id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campos }),
      })
      const d = await res.json()
      if (d.sucesso) { setMsg('Salvo!'); onSalvo?.() } else setMsg('Erro: ' + (d.erro || res.status))
    } catch (e) { setMsg('Erro: ' + e.message) } finally { setSalvando(false) }
  }

  async function completarIA() {
    setMsg('Analisando datasheet...')
    try {
      const res = await fetch(`${API}/api/admin/catalogo/completar-ia/${equipamento._id}`, { method: 'POST' })
      const d = await res.json()
      if (!d.sucesso) { setMsg(d.codigo === 'SEM_DATASHEET' ? 'Sem datasheet salvo para reprocessar.' : 'Erro: ' + d.erro); return }
      const sug = d.sugestoes || {}
      setForm(f => {
        const novo = { ...f }
        Object.entries(sug).forEach(([k, s]) => { if (novo[k] === '' || novo[k] == null) novo[k] = s.valor })
        return novo
      })
      setMsg(`IA sugeriu ${Object.keys(sug).length} campo(s). Revise e salve.`)
    } catch (e) { setMsg('Erro: ' + e.message) }
  }

  async function uploadDoc(tipoDoc, file) {
    if (!file) return
    setMsg('Enviando documento...')
    const fd = new FormData()
    fd.append('arquivo', file); fd.append('tipo', tipoDoc)
    try {
      const res = await fetch(`${API}/api/admin/catalogo/equipamento/${equipamento._id}/documento`, { method: 'POST', body: fd })
      const d = await res.json()
      setMsg(d.sucesso ? `Documento anexado (${d.documento?.otimizacao?.tamanho_final ? Math.round(d.documento.otimizacao.tamanho_final / 1024) + ' KB' : ''}).` : 'Erro: ' + (d.erro || d.codigo))
      if (d.sucesso) onSalvo?.()
    } catch (e) { setMsg('Erro: ' + e.message) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header + status */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{equipamento.fabricante} {equipamento.modelo}</h2>
            <div className="flex gap-3 mt-1 text-xs flex-wrap">
              <span>Comercial: <strong className={nivel === 'validado' || nivel === 'utilizavel' ? 'text-emerald-600' : 'text-amber-600'}>{nivelCfg.label}</strong></span>
              <span>Engenharia: {eng.utilizavel ? <strong className="text-emerald-600">Liberado ✓</strong> : <strong className="text-red-600">Falta {eng.faltando.join(', ')}</strong>}</span>
              <span>Homologação: {homolog?.completo ? <strong className="text-emerald-600">✓</strong> : <strong className="text-amber-600">pendente</strong>}</span>
            </div>
          </div>
          <button onClick={onFechar} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>

        <div className="p-4 space-y-4">
          {Object.entries(grupos).map(([grupo, campos]) => (
            <div key={grupo}>
              <p className="text-sm font-semibold text-slate-700 mb-2">{grupo}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {campos.map(([k, label]) => {
                  const fonte = fonteDados[k]?.fonte
                  const conf = fonteDados[k]?.confianca
                  return (
                    <div key={k} className="flex items-center gap-2">
                      <label className="text-xs text-slate-500 w-32 shrink-0">{label}</label>
                      <input value={form[k] ?? ''} onChange={e => set(k, e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      {fonte && <span className={`text-[10px] px-1.5 py-0.5 rounded ${FONTE_COR[fonte] || 'bg-slate-100 text-slate-500'}`} title={conf ? `${Math.round(conf * 100)}%` : ''}>{fonte}</span>}
                      <BadgeEngenharia payload={payloadEng} chave={k} />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Documentos técnicos */}
          <div className="border-t border-slate-100 pt-3">
            <p className="text-sm font-semibold text-slate-700 mb-2">Documentos técnicos ({(equipamento.documentos_tecnicos || []).length})</p>
            <div className="flex flex-wrap gap-2 items-center">
              {(equipamento.documentos_tecnicos || []).map((d, i) => (
                <span key={i} className="text-xs bg-slate-100 rounded px-2 py-0.5">{d.tipo}: {d.nome}</span>
              ))}
              <select id="tipoDocSel" className="text-xs border border-slate-300 rounded px-1.5 py-1">
                {['datasheet', 'manual', 'inmetro', 'iec', 'declaracao', 'garantia'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input ref={fileRef} type="file" className="hidden" onChange={e => uploadDoc(document.getElementById('tipoDocSel').value, e.target.files?.[0])} />
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"><Upload size={12} /> Anexar</button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-slate-500">{msg}</span>
          <div className="flex gap-2">
            <button onClick={completarIA} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg text-sm font-medium"><Zap size={14} /> Completar com IA</button>
            <button onClick={salvar} disabled={salvando} className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"><Save size={14} /> Salvar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
