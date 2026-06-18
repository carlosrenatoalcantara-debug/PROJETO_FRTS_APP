import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2, Pencil, Check, X, Upload, ClipboardList, AlertTriangle, CheckCircle, Clock, Users } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../ui/Card'
import { parsearTextoExcel, validarRateio, normalizarParaCem, MODALIDADES_GD } from '../../../../backend/src/utils/beneficiarias/beneficiariaRateio.js'

/**
 * BeneficiariasPainel — Sprint 8.7 (Lei 14.300/2022) + P1-BENEFICIARIAS-PRIORIDADE-01
 * Gestão completa de beneficiárias de uma usina GD.
 *
 * Funcionalidades:
 *  - Modo Percentual: rateio com soma = 100%
 *  - Modo Prioridade: ordem de consumo (P1, P2, P3...)
 *  - Tabela editável inline (UC / Titular / CPF/CNPJ / Concessionária / Valor / Ativa)
 *  - Colar Excel (TSV/CSV) → parse automático
 *  - Upload de arquivo CSV
 *  - Auto-preenchimento de titular/CPF/concessionária ao informar UC
 *  - Validação do rateio em tempo real (soma = 100% no modo percentual)
 *  - Histórico de alterações por registro
 *  - Modalidade GD (Lei 14.300)
 *  - Integração com /api/projetos-fv/:projetoId/beneficiarias/*
 */

const API = ''
const inp = 'px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full'

// Badge para modo percentual
function RateioBadge({ rateio }) {
  if (!rateio) return null
  const { ok, soma, diferenca, status } = rateio
  if (ok) return (
    <span className="flex items-center gap-1 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
      <CheckCircle size={14} /> {soma.toFixed(2)}% ✓
    </span>
  )
  return (
    <span className={`flex items-center gap-1 text-sm font-medium px-3 py-1 rounded-full border ${status === 'excedido' ? 'text-red-700 bg-red-50 border-red-200' : 'text-amber-700 bg-amber-50 border-amber-200'}`}>
      <AlertTriangle size={14} />
      {soma.toFixed(2)}% — {status === 'excedido' ? `excede ${Math.abs(diferenca).toFixed(2)}%` : `falta ${diferenca.toFixed(2)}%`}
    </span>
  )
}

// Badge para modo prioridade
function PrioridadeBadge({ lista }) {
  const ativos = lista.filter(b => b.ativa !== false && b.tipoRateio === 'prioridade')
  if (!ativos.length) return null
  const prioridades = ativos.map(b => Number(b.valor))
  const hasDup = new Set(prioridades).size < prioridades.length
  return (
    <span className={`flex items-center gap-1 text-sm font-medium px-3 py-1 rounded-full border ${
      hasDup ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-indigo-700 bg-indigo-50 border-indigo-200'
    }`}>
      {hasDup ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
      {ativos.length} UC{ativos.length > 1 ? 's' : ''} · prioridade{hasDup ? ' (duplicatas!)' : ''}
    </span>
  )
}

const MODO_LABEL = { percentual: 'Percentual (%)', prioridade: 'Prioridade (P1, P2…)' }

export default function BeneficiariasPainel({ projetoId, somenteLeitura = false }) {
  const [lista, setLista] = useState([])
  const [rateio, setRateio] = useState(null)
  const [modalidades] = useState(MODALIDADES_GD)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [editandoId, setEditandoId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [novoForm, setNovoForm] = useState({
    contaContrato: '', valor: '', titular: '', cpf_cnpj: '', concessionaria: '', tipoRateio: 'percentual',
  })
  const [tipoRateioGlobal, setTipoRateioGlobal] = useState('percentual')
  const [modoImport, setModoImport] = useState(null) // null | 'colar' | 'arquivo'
  const [textoColado, setTextoColado] = useState('')
  const [preview, setPreview] = useState(null)
  const [modalHistorico, setModalHistorico] = useState(null)
  const fileRef = useRef()

  // Modo de rateio: derivado da lista quando tem itens; do seletor quando vazia
  const modoRateio = lista.length > 0
    ? (lista.some(b => b.tipoRateio === 'prioridade') ? 'prioridade' : 'percentual')
    : tipoRateioGlobal
  const isPrioridade = modoRateio === 'prioridade'

  const flash = (texto, tipo = 'sucesso') => { setMsg({ texto, tipo }); setTimeout(() => setMsg(null), 3000) }

  const carregar = useCallback(async () => {
    if (!projetoId) return
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/projetos-fv/${projetoId}/beneficiarias/resumo`)
      const d = await r.json()
      setLista(d.beneficiarias || [])
      setRateio(d.rateio || null)
    } catch { /* offline ok */ }
    finally { setLoading(false) }
  }, [projetoId])

  useEffect(() => { carregar() }, [carregar])

  // Recalcula rateio localmente em tempo real (modo percentual)
  useEffect(() => { setRateio(validarRateio(lista)) }, [lista])

  // Sincroniza tipoRateio do formulário com o modo atual
  useEffect(() => {
    setNovoForm(f => ({ ...f, tipoRateio: modoRateio }))
  }, [modoRateio])

  // ── Auto-preenchimento ───────────────────────────────────────────────────
  // Ao informar UC, busca dados de registros existentes na lista (mesmo projeto)
  function onUcChange(uc) {
    setNovoForm(f => {
      const match = uc.trim() ? lista.find(b => b.contaContrato === uc.trim()) : null
      return {
        ...f,
        contaContrato: uc,
        titular: match?.titular && !f.titular ? match.titular : f.titular,
        cpf_cnpj: match?.cpf_cnpj && !f.cpf_cnpj ? match.cpf_cnpj : f.cpf_cnpj,
        concessionaria: match?.concessionaria && !f.concessionaria ? match.concessionaria : f.concessionaria,
      }
    })
  }

  // ── CRUD individual ──────────────────────────────────────────────────────

  async function adicionar(e) {
    e.preventDefault()
    if (!novoForm.contaContrato) { flash('UC é obrigatória.', 'erro'); return }
    if (isPrioridade) {
      const prio = parseInt(novoForm.valor, 10)
      if (isNaN(prio) || prio < 1) { flash('Prioridade deve ser um número inteiro ≥ 1.', 'erro'); return }
    } else {
      const pct = parseFloat(novoForm.valor)
      if (isNaN(pct)) { flash('UC e percentual são obrigatórios.', 'erro'); return }
    }
    try {
      const r = await fetch(`${API}/api/projetos-fv/${projetoId}/beneficiarias`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...novoForm,
          valor: isPrioridade ? parseInt(novoForm.valor, 10) : parseFloat(novoForm.valor),
        }),
      })
      const d = await r.json()
      if (!r.ok) { flash(d.mensagem || 'Erro ao adicionar.', 'erro'); return }
      setNovoForm({ contaContrato: '', valor: '', titular: '', cpf_cnpj: '', concessionaria: '', tipoRateio: modoRateio })
      flash('Beneficiária adicionada.')
      carregar()
    } catch (e) { flash(e.message, 'erro') }
  }

  function iniciarEdicao(b) { setEditandoId(b._id); setEditForm({ ...b, valor: String(b.valor) }) }
  function cancelarEdicao() { setEditandoId(null); setEditForm({}) }

  async function salvarEdicao() {
    try {
      const r = await fetch(`${API}/api/projetos-fv/${projetoId}/beneficiarias/${editandoId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          valor: isPrioridade ? parseInt(editForm.valor, 10) : parseFloat(editForm.valor),
        }),
      })
      const d = await r.json()
      if (!r.ok) { flash(d.mensagem || 'Erro ao salvar.', 'erro'); return }
      cancelarEdicao(); flash('Alteração salva.'); carregar()
    } catch (e) { flash(e.message, 'erro') }
  }

  async function remover(b) {
    if (!window.confirm(`Remover UC ${b.contaContrato}?`)) return
    try {
      const r = await fetch(`${API}/api/projetos-fv/${projetoId}/beneficiarias/${b._id}`, { method: 'DELETE' })
      if (!r.ok) { flash('Erro ao remover.', 'erro'); return }
      flash(`UC ${b.contaContrato} removida.`); carregar()
    } catch (e) { flash(e.message, 'erro') }
  }

  // ── Excel / CSV ─────────────────────────────────────────────────────────

  function processarTexto(texto) {
    const res = parsearTextoExcel(texto)
    if (!res.ok) { flash(res.erro || 'Nenhum dado reconhecido.', 'erro'); return }
    setPreview(res)
  }

  async function confirmarImport(substituir = false) {
    if (!preview?.linhas?.length) return
    try {
      const r = await fetch(`${API}/api/projetos-fv/${projetoId}/beneficiarias/lote`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beneficiarias: preview.linhas, substituir }),
      })
      const d = await r.json()
      if (!r.ok) { flash(d.mensagem || 'Erro ao importar.', 'erro'); return }
      flash(`${d.inseridas} beneficiária(s) importada(s).`)
      setPreview(null); setTextoColado(''); setModoImport(null)
      carregar()
    } catch (e) { flash(e.message, 'erro') }
  }

  function onFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { processarTexto(ev.target?.result || ''); setModoImport('arquivo') }
    reader.readAsText(file)
  }

  const cInput = (campo, tipo = 'text') => (
    <input type={tipo} value={editForm[campo] ?? ''} className={inp}
      onChange={e => setEditForm(f => ({ ...f, [campo]: e.target.value }))} />
  )

  return (
    <div className="space-y-4">
      {/* Header com badge e seletor de modo */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-indigo-600" />
          <h3 className="font-semibold text-slate-900">Beneficiárias GD</h3>
          {lista.length > 0 && <span className="text-xs text-slate-400">({lista.length} UC{lista.length > 1 ? 's' : ''})</span>}
          {/* Modo ativo (read-only quando lista tem itens) */}
          {lista.length > 0 && (
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
              {MODO_LABEL[modoRateio]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Badge de status */}
          {lista.length > 0 && (isPrioridade
            ? <PrioridadeBadge lista={lista} />
            : <RateioBadge rateio={rateio} />
          )}
          {!somenteLeitura && (
            <>
              <button onClick={() => setModoImport(modoImport === 'colar' ? null : 'colar')}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 border border-slate-300 rounded hover:bg-slate-50 text-slate-600">
                <ClipboardList size={13} /> Colar Excel
              </button>
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 border border-slate-300 rounded hover:bg-slate-50 text-slate-600">
                <Upload size={13} /> Importar CSV
              </button>
              <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={onFileChange} />
            </>
          )}
        </div>
      </div>

      {/* Seletor de modo — visível somente quando lista vazia */}
      {!somenteLeitura && lista.length === 0 && (
        <div className="flex items-center gap-4 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
          <span className="text-xs font-medium text-slate-600">Tipo de rateio:</span>
          {['percentual', 'prioridade'].map(modo => (
            <label key={modo} className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-700">
              <input
                type="radio" name="tipoRateioGlobal" value={modo}
                checked={tipoRateioGlobal === modo}
                onChange={() => setTipoRateioGlobal(modo)}
                className="accent-indigo-600"
              />
              {MODO_LABEL[modo]}
            </label>
          ))}
          {isPrioridade && (
            <span className="text-xs text-slate-400 ml-2">
              Cada UC recebe uma posição de prioridade (1 = maior prioridade).
            </span>
          )}
        </div>
      )}

      {/* Banner mensagem */}
      {msg && (
        <div className={`text-sm px-3 py-2 rounded border ${msg.tipo === 'erro' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          {msg.texto}
        </div>
      )}

      {/* Área de colar Excel */}
      {modoImport === 'colar' && (
        <Card className="border-indigo-200 bg-indigo-50">
          <CardBody className="space-y-2">
            <p className="text-xs text-slate-600">Cole a tabela copiada do Excel. Colunas detectadas automaticamente: UC, Titular, CPF/CNPJ, Concessionária, Percentual.</p>
            <p className="text-[11px] text-slate-400">Exemplo: <code>UC;Titular;Percentual</code> / <code>123456;Empresa A;40</code></p>
            <textarea className="w-full h-32 px-2 py-1.5 border border-slate-300 rounded text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={textoColado} onChange={e => setTextoColado(e.target.value)}
              placeholder="Cole aqui o conteúdo copiado do Excel..." />
            <div className="flex gap-2">
              <button onClick={() => processarTexto(textoColado)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium">
                Pré-visualizar
              </button>
              <button onClick={() => { setModoImport(null); setTextoColado(''); setPreview(null) }}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-800 text-xs">
                Cancelar
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Pré-visualização da importação */}
      {preview && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <h4 className="text-sm font-semibold text-slate-900">Pré-visualização — {preview.linhas.length} linha(s)</h4>
          </CardHeader>
          <CardBody className="space-y-3">
            <RateioBadge rateio={validarRateio(preview.linhas)} />
            {preview.erros?.length > 0 && (
              <div className="text-xs text-amber-700">{preview.erros.map((e, i) => <p key={i}>⚠ {e}</p>)}</div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-200">
                    {['UC', 'Titular', 'CPF/CNPJ', 'Concessionária', '%'].map(h => (
                      <th key={h} className="text-left px-2 py-1">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.linhas.map((l, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-2 py-1 font-mono">{l.contaContrato}</td>
                      <td className="px-2 py-1">{l.titular || '—'}</td>
                      <td className="px-2 py-1 font-mono text-slate-500">{l.cpf_cnpj || '—'}</td>
                      <td className="px-2 py-1">{l.concessionaria || '—'}</td>
                      <td className="px-2 py-1 font-semibold">{l.valor}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => confirmarImport(true)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium">
                Substituir tudo
              </button>
              <button onClick={() => confirmarImport(false)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium">
                Acrescentar
              </button>
              <button onClick={() => setPreview(null)} className="px-3 py-1.5 text-slate-600 hover:text-slate-800 text-xs">Cancelar</button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Tabela principal */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-100">
              {['UC / Conta', 'Titular', 'CPF/CNPJ', 'Concessionária', isPrioridade ? 'Prioridade' : '% Rateio', 'Ativa', ''].map(h => (
                <th key={h} className="text-left py-1.5 px-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map(b => {
              const emEd = editandoId === b._id
              return (
                <tr key={b._id} className={`border-b border-slate-50 ${b.ativa === false ? 'opacity-50' : ''}`}>
                  <td className="py-1 px-2 font-mono text-slate-700 whitespace-nowrap">
                    {emEd ? cInput('contaContrato') : b.contaContrato}
                  </td>
                  <td className="py-1 px-2 text-slate-700">
                    {emEd ? cInput('titular') : (b.titular || '—')}
                  </td>
                  <td className="py-1 px-2 font-mono text-slate-500 text-xs">
                    {emEd ? cInput('cpf_cnpj') : (b.cpf_cnpj || '—')}
                  </td>
                  <td className="py-1 px-2 text-slate-600">
                    {emEd ? cInput('concessionaria') : (b.concessionaria || '—')}
                  </td>
                  <td className="py-1 px-2 font-semibold text-slate-900 whitespace-nowrap">
                    {emEd ? (
                      <input
                        type="number"
                        min={isPrioridade ? '1' : '0'}
                        max={isPrioridade ? undefined : '100'}
                        step={isPrioridade ? '1' : '0.01'}
                        value={editForm.valor ?? ''}
                        className={inp + ' w-20'}
                        onChange={e => setEditForm(f => ({ ...f, valor: e.target.value }))}
                      />
                    ) : (
                      isPrioridade ? `P${b.valor}` : `${b.valor}%`
                    )}
                  </td>
                  <td className="py-1 px-2">
                    {emEd ? (
                      <input type="checkbox" checked={editForm.ativa !== false} onChange={e => setEditForm(f => ({ ...f, ativa: e.target.checked }))} />
                    ) : (
                      <span className={`text-xs ${b.ativa !== false ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {b.ativa !== false ? '●' : '○'}
                      </span>
                    )}
                  </td>
                  <td className="py-1 px-2 text-right whitespace-nowrap">
                    {!somenteLeitura && (
                      emEd ? (
                        <div className="flex items-center gap-1">
                          <button onClick={salvarEdicao} className="text-emerald-600 hover:text-emerald-700"><Check size={14} /></button>
                          <button onClick={cancelarEdicao} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button onClick={() => iniciarEdicao(b)} className="text-slate-400 hover:text-indigo-600" title="Editar"><Pencil size={13} /></button>
                          {b.historico?.length > 0 && (
                            <button onClick={() => setModalHistorico(b)} className="text-slate-400 hover:text-slate-700" title="Histórico"><Clock size={13} /></button>
                          )}
                          <button onClick={() => remover(b)} className="text-slate-400 hover:text-red-600" title="Remover"><Trash2 size={13} /></button>
                        </div>
                      )
                    )}
                  </td>
                </tr>
              )
            })}
            {lista.length === 0 && !loading && (
              <tr><td colSpan={7} className="py-4 text-center text-slate-400 text-sm">Nenhuma beneficiária cadastrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Formulário de nova beneficiária */}
      {!somenteLeitura && (
        <form onSubmit={adicionar} className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <div>
            <label className="text-[11px] text-slate-500 block mb-0.5">UC / Conta *</label>
            <input
              className={inp + ' w-32'}
              value={novoForm.contaContrato}
              onChange={e => onUcChange(e.target.value)}
              placeholder="123456"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 block mb-0.5">Titular</label>
            <input
              className={inp + ' w-36'}
              value={novoForm.titular}
              onChange={e => setNovoForm(f => ({ ...f, titular: e.target.value }))}
              placeholder="Nome"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 block mb-0.5">CPF/CNPJ</label>
            <input
              className={inp + ' w-32'}
              value={novoForm.cpf_cnpj}
              onChange={e => setNovoForm(f => ({ ...f, cpf_cnpj: e.target.value }))}
              placeholder="00.000.000/0001-00"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 block mb-0.5">Concessionária</label>
            <input
              className={inp + ' w-28'}
              value={novoForm.concessionaria}
              onChange={e => setNovoForm(f => ({ ...f, concessionaria: e.target.value }))}
              placeholder="CEMIG"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 block mb-0.5">
              {isPrioridade ? 'Prioridade *' : '% Rateio *'}
            </label>
            {isPrioridade ? (
              <input
                type="number" min="1" step="1"
                className={inp + ' w-20'}
                value={novoForm.valor}
                onChange={e => setNovoForm(f => ({ ...f, valor: e.target.value }))}
                placeholder="1"
              />
            ) : (
              <input
                type="number" min="0" max="100" step="0.01"
                className={inp + ' w-20'}
                value={novoForm.valor}
                onChange={e => setNovoForm(f => ({ ...f, valor: e.target.value }))}
                placeholder="50"
              />
            )}
          </div>
          <button type="submit" className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium">
            <Plus size={14} /> Adicionar
          </button>
        </form>
      )}

      {/* Modal histórico */}
      {modalHistorico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModalHistorico(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <h4 className="font-semibold text-slate-900">Histórico — UC {modalHistorico.contaContrato}</h4>
              <button onClick={() => setModalHistorico(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {(modalHistorico.historico || []).map((h, i) => (
                <div key={i} className="text-xs border-l-2 border-indigo-200 pl-3 py-1">
                  <p className="font-medium text-slate-700 uppercase tracking-wide">{h.acao || '—'}</p>
                  <p className="text-slate-500">{h.por} · {h.em ? new Date(h.em).toLocaleString('pt-BR') : '—'}</p>
                  {h.antes && <p className="text-slate-400">antes: {JSON.stringify(h.antes).slice(0, 80)}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
