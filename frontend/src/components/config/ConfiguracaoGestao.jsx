import { useState, useEffect, useCallback } from 'react'
import { Users, Building2, HardHat, Briefcase, Plus, ShieldCheck, Pencil, Check, X, Power, PowerOff, Save } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../ui/Card'
import { usuariosApi, empresasApi, tecnicosApi, vendedoresApi } from '../../services/gestaoApi'
import { PERFIS, LABEL_PERFIL, MODULOS, MATRIZ_RBAC, NIVEIS, mesclarMatriz } from '../../utils/rbac'
import { usePermissao } from '../../hooks/usePermissao'

/**
 * ConfiguracaoGestao — Sprint 7.2 / 8.3.1
 * Gestão de Usuários, Empresas, Técnicos e Vendedores + visão da matriz RBAC.
 * S8.3.1: ciclo de vida completo — criar / editar inline / salvar / cancelar /
 * ativar-inativar (soft). Usuários e Vendedores = edição inline. Técnicos = MODAL
 * com campos agrupados (Dados pessoais / Registro profissional / Atribuições).
 */
const inp = 'px-2 py-1.5 rounded border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500'
// S8.3: cargo = função (≠ perfil = permissão)
const CARGOS = ['Diretor', 'Gerente', 'Comercial', 'Engenheiro Eletricista', 'Engenheiro Civil', 'Eletrotécnico', 'Instalador', 'Projetista', 'Administrativo', 'Financeiro']

export default function ConfiguracaoGestao() {
  const [aba, setAba] = useState('usuarios')
  const { perfil, anonimo } = usePermissao()
  // S8.3.2: Organizações = tenant/ambiente, não fornecedor. Só admin opera.
  const podeOrganizacoes = anonimo || ['administrador', 'admin'].includes(perfil)
  const abas = [
    { id: 'usuarios', label: 'Usuários', icone: Users },
    ...(podeOrganizacoes ? [{ id: 'empresas', label: 'Organizações', icone: Building2 }] : []),
    { id: 'tecnicos', label: 'Técnicos', icone: HardHat },
    { id: 'vendedores', label: 'Vendedores', icone: Briefcase },
    { id: 'rbac', label: 'Permissões', icone: ShieldCheck },
  ]

  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <Users size={18} className="text-indigo-600" />
        <h3 className="font-semibold text-slate-900">Equipe & Permissões</h3>
      </CardHeader>
      <CardBody>
        <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
          {abas.map((a) => (
            <button key={a.id} onClick={() => setAba(a.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 ${
                aba === a.id ? 'text-indigo-600 border-indigo-600' : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}>
              <a.icone size={15} /> {a.label}
            </button>
          ))}
        </div>

        {aba === 'usuarios' && (
          <CrudLista
            api={usuariosApi}
            campos={[
              { k: 'nome', label: 'Nome', req: true },
              { k: 'email', label: 'Email', req: true, type: 'email' },
              { k: 'telefone', label: 'Telefone' },
              { k: 'cargo', label: 'Cargo', type: 'select', opcoes: CARGOS, def: 'Comercial' },
              { k: 'perfil', label: 'Perfil', type: 'select', opcoes: PERFIS, labels: LABEL_PERFIL, def: 'visualizador' },
            ]}
            colunas={['nome', 'email', 'perfil', 'cargo']}
            editaveis={['nome', 'email', 'telefone', 'cargo', 'perfil']}
          />
        )}
        {aba === 'empresas' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded p-2">
              <strong>Organizações</strong> são ambientes independentes da plataforma (tenants) — não são fornecedores.
              Cada organização isola usuários, projetos e configurações.
            </p>
            <CrudLista
              api={empresasApi}
              campos={[
                { k: 'nome', label: 'Nome', req: true },
                { k: 'cnpj', label: 'CNPJ' },
                { k: 'email', label: 'Email', type: 'email' },
                { k: 'telefone', label: 'Telefone' },
              ]}
              colunas={['nome', 'cnpj', 'email']}
              editaveis={['nome', 'cnpj', 'email', 'telefone']}
            />
          </div>
        )}
        {aba === 'tecnicos' && <TecnicosPainel />}
        {aba === 'vendedores' && (
          <CrudLista
            api={vendedoresApi}
            campos={[
              { k: 'nome', label: 'Nome', req: true },
              { k: 'email', label: 'Email', type: 'email' },
              { k: 'telefone', label: 'Telefone' },
              { k: 'meta', label: 'Meta (R$)', type: 'number' },
            ]}
            colunas={['nome', 'email', 'telefone', 'meta']}
            editaveis={['nome', 'email', 'telefone', 'meta']}
          />
        )}
        {aba === 'rbac' && <MatrizRBAC />}
      </CardBody>
    </Card>
  )
}

/**
 * CrudLista — lista com criação + edição INLINE + ativar/inativar (soft).
 * `editaveis` = chaves que entram em modo de edição inline.
 */
function CrudLista({ api, campos, colunas, editaveis = [] }) {
  const [itens, setItens] = useState([])
  const [form, setForm] = useState({})
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [editForm, setEditForm] = useState({})

  const carregar = useCallback(() => {
    setCarregando(true)
    api.listar().then(setItens).catch((e) => setErro(e.message)).finally(() => setCarregando(false))
  }, [api])
  useEffect(() => { carregar() }, [carregar])

  const campoDe = (k) => campos.find((c) => c.k === k)

  async function criar(e) {
    e.preventDefault()
    setErro('')
    try {
      const payload = { ...form }
      campos.forEach((c) => { if (c.def && payload[c.k] == null) payload[c.k] = c.def })
      await api.criar(payload)
      setForm({})
      carregar()
    } catch (err) { setErro(err.message) }
  }

  function iniciarEdicao(it) {
    setEditandoId(it._id)
    const inicial = {}
    editaveis.forEach((k) => { inicial[k] = it[k] ?? '' })
    setEditForm(inicial)
    setErro('')
  }
  function cancelarEdicao() { setEditandoId(null); setEditForm({}) }

  async function salvarEdicao(id) {
    setErro('')
    try {
      await api.atualizar(id, editForm)
      cancelarEdicao()
      carregar()
    } catch (err) { setErro(err.message) }
  }

  async function alternarAtivo(it) {
    setErro('')
    try {
      if (it.ativo === false) {
        await api.atualizar(it._id, { ativo: true })   // reativar
      } else {
        await api.remover(it._id)                       // soft-delete (ativo=false)
      }
      carregar()
    } catch (err) { setErro(err.message) }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={criar} className="flex flex-wrap items-end gap-2">
        {campos.map((c) => (
          <div key={c.k}>
            <label className="text-[11px] text-slate-500 block mb-0.5">{c.label}{c.req ? ' *' : ''}</label>
            {c.type === 'select' ? (
              <select className={inp} value={form[c.k] ?? c.def ?? ''} onChange={(e) => setForm((f) => ({ ...f, [c.k]: e.target.value }))}>
                {(c.opcoes || []).map((o) => <option key={o} value={o}>{c.labels?.[o] || o}</option>)}
              </select>
            ) : (
              <input className={inp} type={c.type || 'text'} value={form[c.k] ?? ''} onChange={(e) => setForm((f) => ({ ...f, [c.k]: e.target.value }))} />
            )}
          </div>
        ))}
        <button type="submit" className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium">
          <Plus size={14} /> Adicionar
        </button>
      </form>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-100">
              {colunas.map((c) => <th key={c} className="text-left py-1.5 pr-3 capitalize">{c.replace('_', ' ')}</th>)}
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((it) => {
              const emEdicao = editandoId === it._id
              return (
                <tr key={it._id} className={`border-b border-slate-50 ${it.ativo === false ? 'opacity-50' : ''}`}>
                  {colunas.map((c) => {
                    const cd = campoDe(c)
                    if (emEdicao && editaveis.includes(c)) {
                      return (
                        <td key={c} className="py-1 pr-3">
                          {cd?.type === 'select' ? (
                            <select className={inp} value={editForm[c] ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, [c]: e.target.value }))}>
                              {(cd.opcoes || []).map((o) => <option key={o} value={o}>{cd.labels?.[o] || o}</option>)}
                            </select>
                          ) : (
                            <input className={inp} type={cd?.type || 'text'} value={editForm[c] ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, [c]: e.target.value }))} />
                          )}
                        </td>
                      )
                    }
                    return <td key={c} className="py-1.5 pr-3 text-slate-700">{cd?.labels?.[it[c]] || it[c] || '—'}</td>
                  })}
                  <td className="text-right whitespace-nowrap">
                    {emEdicao ? (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => salvarEdicao(it._id)} className="text-emerald-600 hover:text-emerald-700" title="Salvar"><Check size={15} /></button>
                        <button onClick={cancelarEdicao} className="text-slate-400 hover:text-slate-600" title="Cancelar"><X size={15} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        {editaveis.length > 0 && (
                          <button onClick={() => iniciarEdicao(it)} className="text-slate-400 hover:text-indigo-600" title="Editar"><Pencil size={14} /></button>
                        )}
                        <button onClick={() => alternarAtivo(it)} className={it.ativo === false ? 'text-slate-400 hover:text-emerald-600' : 'text-slate-400 hover:text-amber-600'} title={it.ativo === false ? 'Reativar' : 'Inativar'}>
                          {it.ativo === false ? <Power size={14} /> : <PowerOff size={14} />}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {!carregando && itens.length === 0 && (
              <tr><td colSpan={colunas.length + 1} className="py-4 text-center text-slate-400">Nenhum registro.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * TecnicosPainel — S8.3.1: edição via MODAL (não inline), campos agrupados.
 * Grupos: Dados pessoais / Registro profissional / Atribuições.
 */
const ESPECIALIDADES = ['FV', 'EV', 'BESS']
function TecnicosPainel() {
  const [itens, setItens] = useState([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [modal, setModal] = useState(null)   // objeto técnico (novo ou existente) | null

  const carregar = useCallback(() => {
    setCarregando(true)
    tecnicosApi.listar().then(setItens).catch((e) => setErro(e.message)).finally(() => setCarregando(false))
  }, [])
  useEffect(() => { carregar() }, [carregar])

  async function alternarAtivo(it) {
    setErro('')
    try {
      if (it.ativo === false) await tecnicosApi.atualizar(it._id, { ativo: true })
      else await tecnicosApi.remover(it._id)
      carregar()
    } catch (err) { setErro(err.message) }
  }

  return (
    <div className="space-y-3">
      <button onClick={() => setModal({ tipo_registro: 'CREA', especialidades: ['FV'], ativo: true })}
        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium">
        <Plus size={14} /> Novo técnico
      </button>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-100">
              {['Nome', 'Registro', 'Nº', 'UF', 'Limite (kW)'].map((c) => <th key={c} className="text-left py-1.5 pr-3">{c}</th>)}
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((it) => (
              <tr key={it._id} className={`border-b border-slate-50 ${it.ativo === false ? 'opacity-50' : ''}`}>
                <td className="py-1.5 pr-3 text-slate-700">{it.nome || '—'}</td>
                <td className="py-1.5 pr-3 text-slate-700">{it.tipo_registro || '—'}</td>
                <td className="py-1.5 pr-3 text-slate-700">{it.registro || '—'}</td>
                <td className="py-1.5 pr-3 text-slate-700">{it.uf || '—'}</td>
                <td className="py-1.5 pr-3 text-slate-700">{it.potencia_max_kw ?? '—'}</td>
                <td className="text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => setModal(it)} className="text-slate-400 hover:text-indigo-600" title="Editar"><Pencil size={14} /></button>
                    <button onClick={() => alternarAtivo(it)} className={it.ativo === false ? 'text-slate-400 hover:text-emerald-600' : 'text-slate-400 hover:text-amber-600'} title={it.ativo === false ? 'Reativar' : 'Inativar'}>
                      {it.ativo === false ? <Power size={14} /> : <PowerOff size={14} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!carregando && itens.length === 0 && (
              <tr><td colSpan={6} className="py-4 text-center text-slate-400">Nenhum técnico.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && <TecnicoModal tecnico={modal} onFechar={() => setModal(null)} onSalvo={() => { setModal(null); carregar() }} />}
    </div>
  )
}

function TecnicoModal({ tecnico, onFechar, onSalvo }) {
  const [t, setT] = useState({ ...tecnico })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const novo = !tecnico._id
  const set = (k, v) => setT((p) => ({ ...p, [k]: v }))
  const toggleEsp = (e) => setT((p) => {
    const arr = Array.isArray(p.especialidades) ? p.especialidades : []
    return { ...p, especialidades: arr.includes(e) ? arr.filter((x) => x !== e) : [...arr, e] }
  })

  async function salvar() {
    setErro(''); setSalvando(true)
    try {
      if (novo) await tecnicosApi.criar(t)
      else await tecnicosApi.atualizar(t._id, t)
      onSalvo()
    } catch (err) { setErro(err.message); setSalvando(false) }
  }

  const Campo = ({ label, k, type = 'text', span = 1 }) => (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <label className="text-[11px] text-slate-500 block mb-0.5">{label}</label>
      <input className={`${inp} w-full`} type={type} value={t[k] ?? ''} onChange={(e) => set(k, e.target.value)} />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onFechar}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 sticky top-0 bg-white">
          <h4 className="font-semibold text-slate-900 flex items-center gap-2"><HardHat size={16} className="text-indigo-600" />{novo ? 'Novo técnico' : `Editar — ${tecnico.nome || ''}`}</h4>
          <button onClick={onFechar} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="space-y-2">
            <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-1">Dados pessoais</h5>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Nome *" k="nome" span={2} />
              <Campo label="Telefone" k="telefone" />
              <Campo label="Email" k="email" type="email" />
              <Campo label="Formação" k="formacao" span={2} />
            </div>
          </div>

          <div className="space-y-2">
            <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-1">Registro profissional</h5>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">Tipo de registro</label>
                <select className={`${inp} w-full`} value={t.tipo_registro ?? 'CREA'} onChange={(e) => set('tipo_registro', e.target.value)}>
                  {['CREA', 'CFT', 'CFMV'].map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <Campo label="Número do registro" k="registro" />
              <Campo label="UF" k="uf" />
              <Campo label="Modalidade" k="modalidade" />
              <Campo label="Validade da carteira" k="validade_carteira_profissional" type="date" />
              <Campo label="ART/TRT padrão" k="numero_art_padrao" />
            </div>
          </div>

          <div className="space-y-2">
            <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-1">Atribuições</h5>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Potência máxima (kW)" k="potencia_max_kw" type="number" />
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">Especialidades</label>
                <div className="flex gap-3 pt-1.5">
                  {ESPECIALIDADES.map((e) => (
                    <label key={e} className="flex items-center gap-1 text-sm text-slate-700">
                      <input type="checkbox" checked={Array.isArray(t.especialidades) && t.especialidades.includes(e)} onChange={() => toggleEsp(e)} /> {e}
                    </label>
                  ))}
                </div>
              </div>
              <Campo label="Assinatura (referência)" k="assinatura" span={2} />
            </div>
          </div>

          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 sticky bottom-0 bg-white">
          <button onClick={onFechar} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="flex items-center gap-1 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded text-sm font-medium">
            <Check size={14} /> {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * MatrizRBAC — S8.3.2: RBAC FLEXÍVEL (editável por empresa).
 * Cada célula vira seletor (nenhum→administrar). Salva permissoes_customizadas
 * via PUT /api/empresa/permissoes (auditoria delta no backend). Fallback: matriz padrão.
 */
const corNivel = { administrar: 'bg-emerald-50 text-emerald-800', aprovar: 'bg-blue-50 text-blue-800', editar: 'bg-amber-50 text-amber-800', visualizar: 'bg-slate-50 text-slate-600', nenhum: 'bg-red-50 text-red-400' }
function MatrizRBAC() {
  const [matriz, setMatriz] = useState(() => mesclarMatriz(null))
  const [salvo, setSalvo] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Carrega permissoes_customizadas da empresa (singleton); fallback matriz padrão.
  useEffect(() => {
    let vivo = true
    fetch('/api/empresa')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo && d?.config) setMatriz(mesclarMatriz(d.config.permissoes_customizadas)) })
      .catch(() => { /* offline → mantém padrão */ })
    return () => { vivo = false }
  }, [])

  function setCelula(p, m, nivel) {
    setMatriz((prev) => ({ ...prev, [p]: { ...prev[p], [m]: nivel } }))
  }

  async function salvar() {
    setSalvando(true); setSalvo('')
    try {
      // Envia apenas o que difere da matriz padrão (permissoes_customizadas)
      const custom = {}
      for (const p of PERFIS) {
        for (const m of MODULOS) {
          if (matriz[p]?.[m] !== MATRIZ_RBAC[p][m]) {
            custom[p] = { ...(custom[p] || {}), [m]: matriz[p][m] }
          }
        }
      }
      const res = await fetch('/api/empresa/permissoes', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissoes_customizadas: custom }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).erro || `HTTP ${res.status}`)
      const d = await res.json()
      setSalvo(`Permissões salvas (${d.alteracoes ?? 0} alteração(ões) auditada(s)).`)
      setTimeout(() => setSalvo(''), 3000)
    } catch (e) { setSalvo(`Erro: ${e.message}`) } finally { setSalvando(false) }
  }

  function resetarPadrao() { setMatriz(mesclarMatriz(null)) }

  return (
    <div className="overflow-x-auto space-y-3">
      <p className="text-xs text-slate-500">
        Matriz de permissões (perfil × módulo). Conceder um nível inclui os inferiores.
        Empresas pequenas podem acumular funções (ex.: técnico editar catálogo). Vazio = matriz padrão.
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-500 border-b border-slate-100">
            <th className="text-left py-1.5 pr-2">Perfil</th>
            {MODULOS.map((m) => <th key={m} className="py-1.5 px-1 capitalize">{m}</th>)}
          </tr>
        </thead>
        <tbody>
          {PERFIS.map((p) => (
            <tr key={p} className="border-b border-slate-50">
              <td className="py-1.5 pr-2 font-medium text-slate-700">{LABEL_PERFIL[p]}</td>
              {MODULOS.map((m) => {
                const n = matriz[p]?.[m] || 'nenhum'
                return (
                  <td key={m} className="py-1 px-1 text-center">
                    <select value={n} onChange={(e) => setCelula(p, m, e.target.value)}
                      className={`rounded border border-slate-200 px-1 py-0.5 text-[11px] ${corNivel[n]}`}>
                      {NIVEIS.map((nv) => <option key={nv} value={nv}>{nv}</option>)}
                    </select>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-3">
        <button onClick={salvar} disabled={salvando}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded text-sm font-medium">
          <Save size={14} /> {salvando ? 'Salvando…' : 'Salvar permissões'}
        </button>
        <button onClick={resetarPadrao} className="text-xs text-slate-500 hover:text-slate-700">Restaurar padrão</button>
        {salvo && <span className="text-xs text-emerald-700">{salvo}</span>}
      </div>
    </div>
  )
}
