import { useState, useEffect, useCallback } from 'react'
import { Shield, Download, Search } from 'lucide-react'
import Card, { CardBody } from '../components/ui/Card'
import { exportarCSV } from '../utils/exportar'

/**
 * Auditoria — Sprint 7.3
 * Interface consultável da trilha persistida pelo auditLogger (/api/painel/auditoria).
 */
const MODULOS = ['', 'fv', 'ev', 'financeiro', 'crm', 'governanca', 'catalogo', 'configuracoes', 'outro']
const ACOES = ['', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE']

export default function Auditoria() {
  const [filtros, setFiltros] = useState({ usuario: '', empresa: '', modulo: '', acao: '', de: '', ate: '' })
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)

  const buscar = useCallback(() => {
    setCarregando(true); setErro(null)
    const qs = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v)).toString()
    fetch(`/api/painel/auditoria?${qs}`)
      .then(r => r.json())
      .then(d => { if (!d.sucesso) throw new Error(d.erro || 'Falha'); setItens(d.itens || []) })
      .catch(e => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [filtros])
  useEffect(() => { buscar() }, []) // eslint-disable-line

  function exportar() {
    exportarCSV(
      itens.map(i => ({ data: new Date(i.timestamp).toLocaleString('pt-BR'), usuario: i.usuario, perfil: i.perfil, empresa: i.empresa, modulo: i.modulo, acao: i.acao, path: i.path, status: i.status, ip: i.ip })),
      'auditoria',
      [
        { chave: 'data', rotulo: 'Data' }, { chave: 'usuario', rotulo: 'Usuário' },
        { chave: 'perfil', rotulo: 'Perfil' }, { chave: 'empresa', rotulo: 'Empresa' },
        { chave: 'modulo', rotulo: 'Módulo' }, { chave: 'acao', rotulo: 'Ação' },
        { chave: 'path', rotulo: 'Entidade' }, { chave: 'status', rotulo: 'Status' }, { chave: 'ip', rotulo: 'IP' },
      ]
    )
  }

  const set = (k) => (e) => setFiltros(f => ({ ...f, [k]: e.target.value }))
  const inp = 'px-2 py-1.5 rounded border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2"><Shield size={26} className="text-indigo-600" /> Auditoria</h1>
        <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700"><Download size={14} /> CSV</button>
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-end gap-2">
            <Campo label="Usuário"><input className={inp} value={filtros.usuario} onChange={set('usuario')} /></Campo>
            <Campo label="Empresa"><input className={inp} value={filtros.empresa} onChange={set('empresa')} /></Campo>
            <Campo label="Módulo">
              <select className={inp} value={filtros.modulo} onChange={set('modulo')}>{MODULOS.map(m => <option key={m} value={m}>{m || 'Todos'}</option>)}</select>
            </Campo>
            <Campo label="Ação">
              <select className={inp} value={filtros.acao} onChange={set('acao')}>{ACOES.map(a => <option key={a} value={a}>{a || 'Todas'}</option>)}</select>
            </Campo>
            <Campo label="De"><input className={inp} type="date" value={filtros.de} onChange={set('de')} /></Campo>
            <Campo label="Até"><input className={inp} type="date" value={filtros.ate} onChange={set('ate')} /></Campo>
            <button onClick={buscar} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium"><Search size={14} /> Filtrar</button>
          </div>
        </CardBody>
      </Card>

      {erro && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{erro}</div>}

      <Card>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-100">
                  {['Data', 'Usuário', 'Perfil', 'Empresa', 'Módulo', 'Ação', 'Entidade', 'Status'].map(h => <th key={h} className="text-left py-1.5 pr-3">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {itens.map((i, k) => (
                  <tr key={k} className="border-b border-slate-50">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{new Date(i.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="py-1.5 pr-3">{i.usuario}</td>
                    <td className="py-1.5 pr-3">{i.perfil || '—'}</td>
                    <td className="py-1.5 pr-3">{i.empresa || '—'}</td>
                    <td className="py-1.5 pr-3">{i.modulo}</td>
                    <td className="py-1.5 pr-3 font-mono">{i.acao}</td>
                    <td className="py-1.5 pr-3 font-mono text-slate-400 truncate max-w-[260px]">{i.path}</td>
                    <td className={`py-1.5 pr-3 font-semibold ${i.status >= 400 ? 'text-red-600' : 'text-emerald-600'}`}>{i.status}</td>
                  </tr>
                ))}
                {!carregando && itens.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-slate-400">Nenhum registro de auditoria.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

function Campo({ label, children }) {
  return <div><label className="text-[11px] text-slate-500 block mb-0.5">{label}</label>{children}</div>
}
