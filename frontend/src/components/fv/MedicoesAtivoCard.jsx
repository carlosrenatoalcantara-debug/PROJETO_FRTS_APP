// P5-ATIVO-MEDICOES-01 — medições elétricas de campo (embutidas em AtivoEquipamento)
// NÃO implementa upload, bucket ou APIs externas — apenas links e valores numéricos.
import { useCallback, useEffect, useState } from 'react'

const TIPOS = ['COMISSIONAMENTO', 'GARANTIA', 'SUPORTE', 'AMPLIACAO', 'INSPECAO', 'OUTRO']
const TIPO_COR = {
  COMISSIONAMENTO: 'bg-blue-50 text-blue-700',
  GARANTIA:        'bg-amber-50 text-amber-700',
  SUPORTE:         'bg-purple-50 text-purple-700',
  AMPLIACAO:       'bg-emerald-50 text-emerald-700',
  INSPECAO:        'bg-slate-100 text-slate-600',
  OUTRO:           'bg-slate-100 text-slate-500',
}

function ValorMed({ rotulo, valor, unidade }) {
  if (valor == null) return null
  return (
    <span className="text-xs bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 text-slate-600">
      {rotulo}: <strong>{valor}</strong> {unidade}
    </span>
  )
}

function UltimaMedicao({ med }) {
  if (!med) return null
  return (
    <div className="mb-3 bg-emerald-50 rounded-xl p-3 border border-emerald-100">
      <div className="text-xs font-semibold text-emerald-700 mb-1">Última medição</div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${TIPO_COR[med.tipo] || TIPO_COR.OUTRO}`}>{med.tipo}</span>
        <span className="text-xs text-slate-500">{med.data ? new Date(med.data).toLocaleDateString('pt-BR') : '—'}</span>
        {med.usuario && <span className="text-xs text-slate-400">· {med.usuario}</span>}
      </div>
      {med.observacao && <div className="text-xs text-slate-600 mt-1">{med.observacao}</div>}
      <div className="flex flex-wrap gap-1 mt-1">
        <ValorMed rotulo="Voc" valor={med.voc} unidade="V" />
        <ValorMed rotulo="Isc" valor={med.isc} unidade="A" />
        <ValorMed rotulo="Vac" valor={med.vac} unidade="V" />
        <ValorMed rotulo="Iac" valor={med.iac} unidade="A" />
        <ValorMed rotulo="P" valor={med.potencia} unidade="W" />
      </div>
      {med.link_foto && (
        <a href={med.link_foto} target="_blank" rel="noopener noreferrer"
          className="mt-1.5 text-xs text-blue-600 underline inline-block">📷 Ver foto/documento</a>
      )}
    </div>
  )
}

export default function MedicoesAtivoCard({ ativoId }) {
  const [medicoes, setMedicoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [formAberto, setFormAberto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [confirmandoRemover, setConfirmandoRemover] = useState(null)
  const [msg, setMsg] = useState(null)
  const [historico, setHistorico] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/ativos/${ativoId}/medicoes`)
      if (r.ok) { const j = await r.json(); setMedicoes(j.medicoes || []) }
    } catch { /* silencioso */ } finally { setLoading(false) }
  }, [ativoId])

  useEffect(() => { carregar() }, [carregar])

  function abrirNova() {
    setEditando(null)
    setForm({ tipo: 'OUTRO', data: new Date().toISOString().slice(0, 10) })
    setFormAberto(true)
    setMsg(null)
  }

  function abrirEditar(med) {
    setEditando(med._id)
    setForm({
      tipo:      med.tipo || 'OUTRO',
      data:      med.data ? new Date(med.data).toISOString().slice(0, 10) : '',
      observacao: med.observacao || '',
      voc:       med.voc ?? '',
      isc:       med.isc ?? '',
      vac:       med.vac ?? '',
      iac:       med.iac ?? '',
      potencia:  med.potencia ?? '',
      link_foto: med.link_foto || '',
      usuario:   med.usuario || '',
    })
    setFormAberto(true)
    setMsg(null)
  }

  function fecharForm() { setFormAberto(false); setEditando(null); setForm({}) }

  async function salvar() {
    setSalvando(true); setMsg(null)
    try {
      const n = (v) => v !== '' && v != null ? Number(v) : null
      const payload = {
        tipo:      form.tipo || 'OUTRO',
        data:      form.data || undefined,
        observacao: form.observacao || null,
        voc:       n(form.voc), isc: n(form.isc), vac: n(form.vac),
        iac:       n(form.iac), potencia: n(form.potencia),
        link_foto: form.link_foto || null,
        usuario:   form.usuario || null,
      }
      const url    = editando ? `/api/ativos/${ativoId}/medicoes/${editando}` : `/api/ativos/${ativoId}/medicoes`
      const method = editando ? 'PUT' : 'POST'
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await r.json()
      if (!r.ok) { setMsg({ tipo: 'erro', txt: j.erro || 'Erro ao salvar' }); return }
      await carregar()
      fecharForm()
      setMsg({ tipo: 'ok', txt: editando ? 'Medição atualizada.' : 'Medição registrada.' })
    } catch { setMsg({ tipo: 'erro', txt: 'Falha de conexão' }) } finally { setSalvando(false) }
  }

  async function remover(medicaoId) {
    try {
      const r = await fetch(`/api/ativos/${ativoId}/medicoes/${medicaoId}`, { method: 'DELETE' })
      if (r.ok) { await carregar(); setMsg({ tipo: 'ok', txt: 'Medição removida.' }) }
      else setMsg({ tipo: 'erro', txt: 'Erro ao remover' })
    } catch { setMsg({ tipo: 'erro', txt: 'Falha de conexão' }) }
  }

  const ultima = medicoes[0] || null
  const demais = historico ? medicoes.slice(1) : []

  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold text-slate-400 uppercase">Medições</div>
        {!formAberto && (
          <button onClick={abrirNova} className="text-emerald-700 text-xs font-semibold">+ Nova medição</button>
        )}
      </div>

      {msg && (
        <div className={`text-xs mb-2 ${msg.tipo === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>{msg.txt}</div>
      )}

      {formAberto && (
        <div className="space-y-2 mb-4 pb-4 border-b border-slate-100">
          <div className="text-xs font-semibold text-slate-600 mb-1">{editando ? 'Editar medição' : 'Nova medição'}</div>
          <label className="block">
            <span className="text-xs text-slate-500">Tipo</span>
            <select value={form.tipo || 'OUTRO'} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">Data</span>
            <input type="date" value={form.data || ''} onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">Observação</span>
            <textarea value={form.observacao || ''} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} rows={2}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[['voc','Voc (V)'],['isc','Isc (A)'],['vac','Vac (V)'],['iac','Iac (A)'],['potencia','Potência (W)']].map(([k, rotulo]) => (
              <label key={k} className="block">
                <span className="text-xs text-slate-500">{rotulo}</span>
                <input type="number" step="any" value={form[k] ?? ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </label>
            ))}
          </div>
          <label className="block">
            <span className="text-xs text-slate-500">Link Foto / Documento</span>
            <input type="url" value={form.link_foto || ''} onChange={e => setForm(f => ({ ...f, link_foto: e.target.value }))}
              placeholder="https://…" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">Técnico</span>
            <input type="text" value={form.usuario || ''} onChange={e => setForm(f => ({ ...f, usuario: e.target.value }))}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          <div className="flex gap-2 pt-1">
            <button onClick={fecharForm}
              className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm">Cancelar</button>
            <button onClick={salvar} disabled={salvando}
              className="flex-1 bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50">
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {loading && <div className="text-xs text-slate-400">Carregando…</div>}

      {!loading && medicoes.length === 0 && !formAberto && (
        <div className="text-xs text-slate-400 text-center py-2">Nenhuma medição registrada.</div>
      )}

      {!loading && ultima && <UltimaMedicao med={ultima} />}

      {!loading && medicoes.length > 1 && !formAberto && (
        <button onClick={() => setHistorico(h => !h)}
          className="text-xs text-slate-400 underline mb-2">
          {historico ? 'Ocultar histórico' : `Ver histórico (${medicoes.length - 1} medição${medicoes.length - 1 > 1 ? 'ões' : ''})`}
        </button>
      )}

      {historico && demais.map((med, i) => (
        <div key={med._id || i} className="py-2.5 border-t border-slate-100">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${TIPO_COR[med.tipo] || TIPO_COR.OUTRO}`}>{med.tipo}</span>
                <span className="text-xs text-slate-400">{med.data ? new Date(med.data).toLocaleDateString('pt-BR') : '—'}</span>
                {med.usuario && <span className="text-xs text-slate-400">· {med.usuario}</span>}
              </div>
              {med.observacao && <div className="text-sm text-slate-700 mt-1">{med.observacao}</div>}
              <div className="flex flex-wrap gap-1 mt-1">
                <ValorMed rotulo="Voc" valor={med.voc} unidade="V" />
                <ValorMed rotulo="Isc" valor={med.isc} unidade="A" />
                <ValorMed rotulo="Vac" valor={med.vac} unidade="V" />
                <ValorMed rotulo="Iac" valor={med.iac} unidade="A" />
                <ValorMed rotulo="P" valor={med.potencia} unidade="W" />
              </div>
              {med.link_foto && (
                <a href={med.link_foto} target="_blank" rel="noopener noreferrer"
                  className="mt-1 text-xs text-blue-600 underline inline-block">📷 Ver foto/documento</a>
              )}
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button onClick={() => abrirEditar(med)} className="text-xs text-slate-400 hover:text-slate-700">Editar</button>
              {confirmandoRemover === med._id ? (
                <div className="flex gap-1">
                  <button onClick={() => { setConfirmandoRemover(null); remover(med._id) }}
                    className="text-xs text-white bg-red-500 hover:bg-red-600 px-1.5 py-0.5 rounded">Sim</button>
                  <button onClick={() => setConfirmandoRemover(null)}
                    className="text-xs text-slate-500 hover:text-slate-700">Não</button>
                </div>
              ) : (
                <button onClick={() => setConfirmandoRemover(med._id)} className="text-xs text-red-400 hover:text-red-600">Remover</button>
              )}
            </div>
          </div>
        </div>
      ))}

      {ultima && !formAberto && (
        <div className="flex gap-3 mt-2 pt-2 border-t border-slate-100">
          <button onClick={() => abrirEditar(ultima)} className="text-xs text-slate-400 hover:text-slate-700">Editar última</button>
          {confirmandoRemover === ultima._id ? (
            <div className="flex gap-1 items-center">
              <button onClick={() => { setConfirmandoRemover(null); remover(ultima._id) }}
                className="text-xs text-white bg-red-500 hover:bg-red-600 px-1.5 py-0.5 rounded">Sim</button>
              <button onClick={() => setConfirmandoRemover(null)}
                className="text-xs text-slate-500 hover:text-slate-700">Não</button>
            </div>
          ) : (
            <button onClick={() => setConfirmandoRemover(ultima._id)} className="text-xs text-red-400 hover:text-red-600">Remover última</button>
          )}
        </div>
      )}
    </div>
  )
}
