import { useState, useEffect, useCallback } from 'react'
import { Users, Building2, HardHat, Briefcase, Plus, Trash2, ShieldCheck } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../ui/Card'
import { usuariosApi, empresasApi, tecnicosApi, vendedoresApi } from '../../services/gestaoApi'
import { PERFIS, LABEL_PERFIL, MODULOS, MATRIZ_RBAC } from '../../utils/rbac'

/**
 * ConfiguracaoGestao — Sprint 7.2
 * Gestão de Usuários, Empresas, Técnicos e Vendedores + visão da matriz RBAC.
 * CRUD leve (criar/listar/desativar). Sem auth/permissões impostas ainda.
 */
const inp = 'px-2 py-1.5 rounded border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500'
// S8.3: cargo = função (≠ perfil = permissão)
const CARGOS = ['Diretor', 'Gerente', 'Comercial', 'Engenheiro Eletricista', 'Engenheiro Civil', 'Eletrotécnico', 'Instalador', 'Projetista', 'Administrativo', 'Financeiro']

export default function ConfiguracaoGestao() {
  const [aba, setAba] = useState('usuarios')
  const abas = [
    { id: 'usuarios', label: 'Usuários', icone: Users },
    { id: 'empresas', label: 'Empresas', icone: Building2 },
    { id: 'tecnicos', label: 'Técnicos', icone: HardHat },
    { id: 'vendedores', label: 'Vendedores', icone: Briefcase },
    { id: 'rbac', label: 'Permissões', icone: ShieldCheck },
  ]

  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <Users size={18} className="text-indigo-600" />
        <h3 className="font-semibold text-slate-900">Equipe & Permissões (S7.2)</h3>
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
          />
        )}
        {aba === 'empresas' && (
          <CrudLista
            api={empresasApi}
            campos={[
              { k: 'nome', label: 'Nome', req: true },
              { k: 'cnpj', label: 'CNPJ' },
              { k: 'email', label: 'Email', type: 'email' },
              { k: 'telefone', label: 'Telefone' },
            ]}
            colunas={['nome', 'cnpj', 'email']}
          />
        )}
        {aba === 'tecnicos' && (
          <CrudLista
            api={tecnicosApi}
            campos={[
              { k: 'nome', label: 'Nome', req: true },
              { k: 'tipo_registro', label: 'Registro', type: 'select', opcoes: ['CREA', 'CFT', 'CFMV'], def: 'CREA' },
              { k: 'registro', label: 'Nº' },
              { k: 'uf', label: 'UF' },
              { k: 'modalidade', label: 'Modalidade' },
              { k: 'potencia_max_kw', label: 'Limite (kW)', type: 'number' },
              { k: 'validade_carteira_profissional', label: 'Validade carteira', type: 'date' },
            ]}
            colunas={['nome', 'tipo_registro', 'registro', 'uf', 'potencia_max_kw']}
          />
        )}
        {aba === 'vendedores' && (
          <CrudLista
            api={vendedoresApi}
            campos={[
              { k: 'nome', label: 'Nome', req: true },
              { k: 'email', label: 'Email', type: 'email' },
              { k: 'telefone', label: 'Telefone' },
              { k: 'cargo', label: 'Cargo' },
            ]}
            colunas={['nome', 'email', 'telefone']}
          />
        )}
        {aba === 'rbac' && <MatrizRBAC />}
      </CardBody>
    </Card>
  )
}

function CrudLista({ api, campos, colunas }) {
  const [itens, setItens] = useState([])
  const [form, setForm] = useState({})
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const carregar = useCallback(() => {
    setCarregando(true)
    api.listar().then(setItens).catch((e) => setErro(e.message)).finally(() => setCarregando(false))
  }, [api])
  useEffect(() => { carregar() }, [carregar])

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
  async function remover(id) {
    if (!window.confirm('Desativar este registro?')) return
    try { await api.remover(id); carregar() } catch (err) { setErro(err.message) }
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((it) => (
              <tr key={it._id} className={`border-b border-slate-50 ${it.ativo === false ? 'opacity-40' : ''}`}>
                {colunas.map((c) => <td key={c} className="py-1.5 pr-3 text-slate-700">{it[c] ?? '—'}</td>)}
                <td className="text-right">
                  {it.ativo !== false && (
                    <button onClick={() => remover(it._id)} className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                  )}
                </td>
              </tr>
            ))}
            {!carregando && itens.length === 0 && (
              <tr><td colSpan={colunas.length + 1} className="py-4 text-center text-slate-400">Nenhum registro.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MatrizRBAC() {
  const cor = { administrar: 'bg-emerald-100 text-emerald-800', aprovar: 'bg-blue-100 text-blue-800', editar: 'bg-amber-100 text-amber-800', visualizar: 'bg-slate-100 text-slate-600', nenhum: 'bg-red-50 text-red-400' }
  return (
    <div className="overflow-x-auto">
      <p className="text-xs text-slate-500 mb-2">Matriz centralizada de permissões (módulo × perfil). Conceder um nível inclui os inferiores.</p>
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
                const n = MATRIZ_RBAC[p][m]
                return <td key={m} className="py-1 px-1 text-center"><span className={`inline-block px-1.5 py-0.5 rounded ${cor[n]}`}>{n}</span></td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
