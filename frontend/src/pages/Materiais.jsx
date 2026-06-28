import { useState, useEffect, useCallback } from 'react'
import { Cable, Plus, Search, Pencil, Clock, X, ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import {
  listarMateriais, criarMaterial, atualizarMaterial,
  alterarStatusMaterial, registrarCompra, listarTemplates,
} from '../services/materiaisApi'

// Unidade de venda do Material (não vem do template — é como o material é medido/comprado).
const UNIDADES = ['un', 'm', 'barra', 'rolo', 'jogo', 'par', 'cento', 'kg', 'm2', 'L', 'cx', 'pc']
const STATUS = [
  { v: 'ativo', label: 'Ativo', cor: 'verde' },
  { v: 'pendente_revisao', label: 'Pendente de revisão', cor: 'amarelo' },
  { v: 'inativo', label: 'Inativo', cor: 'cinza' },
]
const statusInfo = (s) => STATUS.find((x) => x.v === s) || STATUS[0]
const moeda = (v) => v == null ? '—' : `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dataBR = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'
const diasDesde = (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : null
const corStale = (dias) => dias == null ? 'cinza' : dias <= 30 ? 'verde' : dias <= 120 ? 'amarelo' : 'vermelho'

// Pré-visualização da descrição automática (espelha gerarDescricao do backend).
function previewDescricao(template, { fabricante, modelo, valores }) {
  if (!template?.descricaoTemplate) return ''
  const map = { ...valores, fabricante, modelo }
  return template.descricaoTemplate.replace(/\{(\w+)\}/g, (_, k) => (map[k] != null ? String(map[k]) : '')).replace(/\s+/g, ' ').trim()
}

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'text-xs font-semibold text-slate-700 block mb-1'

// ─── Histórico (ícone + tooltip) ──────────────────────────────────────────────
function HistoricoCell({ material, onAbrir }) {
  const ultima = material.historicoCompras?.[material.historicoCompras.length - 1]
  return (
    <button onClick={() => onAbrir(material)} title="Histórico de compras"
      className="relative group inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
      <Clock size={16} />
      {ultima && (
        <span className="pointer-events-none absolute right-0 top-full mt-1 z-10 hidden group-hover:block w-48 p-2 rounded-lg bg-slate-900 text-white text-xs text-left shadow-lg">
          <span className="block font-semibold">Última compra</span>
          <span className="block">{ultima.fornecedor}</span>
          <span className="block">{moeda(ultima.valor)}</span>
          <span className="block text-slate-300">{dataBR(ultima.data)}</span>
        </span>
      )}
    </button>
  )
}

function Modal({ titulo, onFechar, children, largura = 'max-w-lg' }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onFechar}>
      <div className={`bg-white rounded-2xl shadow-xl w-full ${largura} max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">{titulo}</h3>
          <button onClick={onFechar} className="p-1 text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// ─── Form dinâmico baseado no Template de Categoria ────────────────────────────
function FormMaterial({ inicial, templates, onSalvar, onFechar }) {
  const ed = !!inicial?._id
  const [categoria, setCategoria] = useState(inicial?.categoria || '')
  const [unidade, setUnidade] = useState(inicial?.unidade || 'un')
  const [fabricante, setFabricante] = useState(inicial?.fabricante || '')
  const [modelo, setModelo] = useState(inicial?.modelo || '')
  const [valores, setValores] = useState(() => {
    const v = {}; for (const e of inicial?.especificacoes || []) v[e.chave] = e.valor; return v
  })
  const [precoValor, setPrecoValor] = useState(inicial?.precoReferencia?.valor ?? '')
  const [aliases, setAliases] = useState((inicial?.aliases || []).join(', '))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const template = templates.find((t) => t.chave === categoria) || null
  const eng = template?.classe === 'engenharia'
  const setVal = (k, v) => setValores((s) => ({ ...s, [k]: v }))

  // Ao trocar de categoria, descarta atributos que não pertencem ao novo template.
  function trocarCategoria(novaChave) {
    setCategoria(novaChave)
    const t = templates.find((x) => x.chave === novaChave)
    if (t) {
      const permitidas = new Set(t.atributos.map((a) => a.chave))
      setValores((s) => Object.fromEntries(Object.entries(s).filter(([k]) => permitidas.has(k))))
    }
  }

  const descricaoPreview = previewDescricao(template, { fabricante, modelo, valores })

  async function submit() {
    setErro('')
    if (!template) { setErro('Selecione uma categoria.'); return }
    if (eng && (!fabricante.trim() || !modelo.trim())) { setErro('Categoria de engenharia exige fabricante e modelo.'); return }
    // Checagem local de obrigatórios (o backend revalida contra o template).
    const faltando = template.atributos.filter((a) => a.obrigatorio && !String(valores[a.chave] ?? '').trim())
    if (faltando.length) { setErro(`Preencha: ${faltando.map((a) => a.rotulo || a.chave).join(', ')}`); return }

    setSalvando(true)
    try {
      const especificacoes = template.atributos
        .filter((a) => String(valores[a.chave] ?? '').trim() !== '')
        .map((a) => ({ chave: a.chave, valor: String(valores[a.chave]).trim(), unidade: a.unidade || null }))
      const payload = {
        categoria,
        unidade,
        fabricante: eng ? fabricante.trim() : null,
        modelo: eng ? modelo.trim() : null,
        especificacoes,
        aliases: aliases.split(',').map((x) => x.trim()).filter(Boolean),
        precoReferencia: { valor: precoValor === '' ? null : Number(precoValor) },
      }
      await onSalvar(payload, inicial?._id)
      onFechar()
    } catch (e) { setErro(e.message) } finally { setSalvando(false) }
  }

  return (
    <Modal titulo={ed ? 'Editar material' : 'Novo material'} onFechar={onFechar} largura="max-w-xl">
      {templates.length === 0 ? (
        <div className="text-sm text-slate-600">
          Nenhum <strong>Template de Categoria</strong> cadastrado. Rode o seed
          (<code>npm run catalogo:seed-templates</code>) para habilitar o cadastro.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Categoria *</label>
              <select className={inputCls} value={categoria} onChange={(e) => trocarCategoria(e.target.value)}>
                <option value="">Selecione…</option>
                {templates.map((t) => <option key={t.chave} value={t.chave}>{t.rotulo || t.chave}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Unidade *</label>
              <select className={inputCls} value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {template && (
            <>
              <p className="text-xs text-slate-400">
                Classe: <strong>{template.classe}</strong> · a descrição é gerada automaticamente.
              </p>

              {eng && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Fabricante *</label>
                    <input className={inputCls} value={fabricante} onChange={(e) => setFabricante(e.target.value)} placeholder="Ex.: Schneider" />
                  </div>
                  <div>
                    <label className={labelCls}>Modelo *</label>
                    <input className={inputCls} value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Ex.: Acti9" />
                  </div>
                </div>
              )}

              {/* Atributos do template */}
              <div className="grid grid-cols-2 gap-3">
                {template.atributos.map((a) => {
                  const rot = (a.rotulo || a.chave) + (a.obrigatorio ? ' *' : '')
                  const val = valores[a.chave] ?? ''
                  return (
                    <div key={a.chave}>
                      <label className={labelCls}>{rot}{a.unidade ? ` (${a.unidade})` : ''}{a.identidade ? ' 🔑' : ''}</label>
                      {a.tipo === 'enum' ? (
                        <select className={inputCls} value={val} onChange={(e) => setVal(a.chave, e.target.value)}>
                          <option value="">—</option>
                          {a.enumValores.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
                        </select>
                      ) : (
                        <input
                          className={inputCls}
                          type={a.tipo === 'number' || a.tipo === 'int' ? 'number' : 'text'}
                          value={val}
                          onChange={(e) => setVal(a.chave, e.target.value)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Preço de referência (R$)</label>
                  <input type="number" min="0" step="0.01" className={inputCls} value={precoValor} onChange={(e) => setPrecoValor(e.target.value)} placeholder="0,00" />
                </div>
                <div>
                  <label className={labelCls}>Aliases (vírgula)</label>
                  <input className={inputCls} value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="cabo 10mm, ..." />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-xs text-slate-500">Descrição (gerada automaticamente)</p>
                <p className="text-sm font-medium text-slate-900">{descricaoPreview || '—'}</p>
              </div>
            </>
          )}

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variante="secundario" onClick={onFechar}>Cancelar</Button>
            <Button onClick={submit} carregando={salvando} disabled={!template}>{ed ? 'Salvar' : 'Criar'}</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── Modal de histórico (últimas 5 compras + registrar) ───────────────────────
function ModalHistorico({ material, onFechar, onRegistrar }) {
  const [nova, setNova] = useState({ data: '', fornecedor: '', valor: '', observacao: '' })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const compras = [...(material.historicoCompras || [])].reverse()

  async function add() {
    setErro('')
    if (!nova.fornecedor.trim() || nova.valor === '') { setErro('Fornecedor e valor são obrigatórios.'); return }
    setSalvando(true)
    try {
      await onRegistrar(material._id, {
        data: nova.data || undefined, fornecedor: nova.fornecedor.trim(),
        valor: Number(nova.valor), observacao: nova.observacao.trim() || undefined,
      })
      setNova({ data: '', fornecedor: '', valor: '', observacao: '' })
    } catch (e) { setErro(e.message) } finally { setSalvando(false) }
  }

  return (
    <Modal titulo={`Histórico — ${material.descricao}`} onFechar={onFechar}>
      {compras.length === 0 ? (
        <p className="text-sm text-slate-400 mb-4">Nenhuma compra registrada ainda.</p>
      ) : (
        <ul className="divide-y divide-slate-100 mb-4">
          {compras.map((c, i) => (
            <li key={i} className="py-2 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-slate-800">{c.fornecedor}</p>
                <p className="text-xs text-slate-500">{dataBR(c.data)}{c.observacao ? ` · ${c.observacao}` : ''}</p>
              </div>
              <span className="font-semibold text-slate-900">{moeda(c.valor)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-400 mb-2">Mantém apenas as 5 compras mais recentes.</p>
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
        <p className="text-xs font-semibold text-slate-700">Registrar compra</p>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" className={inputCls} value={nova.data} onChange={(e) => setNova({ ...nova, data: e.target.value })} />
          <input className={inputCls} placeholder="Fornecedor" value={nova.fornecedor} onChange={(e) => setNova({ ...nova, fornecedor: e.target.value })} />
          <input type="number" min="0" step="0.01" className={inputCls} placeholder="Valor (R$)" value={nova.valor} onChange={(e) => setNova({ ...nova, valor: e.target.value })} />
          <input className={inputCls} placeholder="Observação (opcional)" value={nova.observacao} onChange={(e) => setNova({ ...nova, observacao: e.target.value })} />
        </div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <div className="flex justify-end">
          <Button tamanho="sm" icone={ShoppingCart} onClick={add} carregando={salvando}>Registrar</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function Materiais() {
  const [dados, setDados] = useState({ itens: [], paginacao: { pagina: 1, totalPaginas: 1, total: 0 } })
  const [templates, setTemplates] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [filtros, setFiltros] = useState({ q: '', categoria: '', status: '' })
  const [pagina, setPagina] = useState(1)
  const [editando, setEditando] = useState(null)
  const [historico, setHistorico] = useState(null)

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('')
    try {
      const r = await listarMateriais({ ...filtros, page: pagina, limit: 50 })
      setDados(r)
    } catch (e) {
      setErro(e.message); setDados({ itens: [], paginacao: { pagina: 1, totalPaginas: 1, total: 0 } })
    } finally { setCarregando(false) }
  }, [filtros, pagina])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { listarTemplates().then(setTemplates).catch(() => setTemplates([])) }, [])

  async function salvar(payload, id) {
    if (id) await atualizarMaterial(id, payload); else await criarMaterial(payload)
    await carregar()
  }
  async function mudarStatus(id, status) { await alterarStatusMaterial(id, status); await carregar() }
  async function registrar(id, compra) { setHistorico(await registrarCompra(id, compra)); await carregar() }

  const { itens, paginacao } = dados

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-100"><Cable size={20} className="text-orange-600" /></div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Catálogo de Materiais</h1>
            <p className="text-sm text-slate-500">Materiais elétricos · preço de referência · histórico</p>
          </div>
        </div>
        <Button icone={Plus} onClick={() => setEditando({})}>Novo material</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input className={`${inputCls} pl-9`} placeholder="Buscar por descrição ou alias…"
            value={filtros.q} onChange={(e) => { setPagina(1); setFiltros({ ...filtros, q: e.target.value }) }} />
        </div>
        <select className={inputCls} value={filtros.categoria} onChange={(e) => { setPagina(1); setFiltros({ ...filtros, categoria: e.target.value }) }}>
          <option value="">Todas as categorias</option>
          {templates.map((t) => <option key={t.chave} value={t.chave}>{t.rotulo || t.chave}</option>)}
        </select>
        <select className={inputCls} value={filtros.status} onChange={(e) => { setPagina(1); setFiltros({ ...filtros, status: e.target.value }) }}>
          <option value="">Todos os status</option>
          {STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>
      </div>

      {erro && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{erro}</div>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Descrição</th>
              <th className="text-left px-4 py-3 font-semibold">Unidade</th>
              <th className="text-right px-4 py-3 font-semibold">Preço ref.</th>
              <th className="text-center px-4 py-3 font-semibold">Atualizado</th>
              <th className="text-center px-4 py-3 font-semibold">Status</th>
              <th className="text-right px-4 py-3 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {carregando ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Carregando…</td></tr>
            ) : itens.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                Nenhum material cadastrado. Clique em <strong>Novo material</strong> para começar.
              </td></tr>
            ) : itens.map((m) => {
              const dias = diasDesde(m.precoReferencia?.atualizadoEm)
              return (
                <tr key={m._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{m.descricao}</p>
                    <p className="text-xs text-slate-400">{m.categoria}{m.classe === 'engenharia' && m.fabricante ? ` · ${m.fabricante} ${m.modelo || ''}` : ''}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{m.unidade}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{moeda(m.precoReferencia?.valor)}</td>
                  <td className="px-4 py-3 text-center">
                    {dias == null ? <span className="text-slate-300">—</span> : <Badge cor={corStale(dias)}>há {dias} {dias === 1 ? 'dia' : 'dias'}</Badge>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <select value={m.status} onChange={(e) => mudarStatus(m._id, e.target.value)} title="Alterar status"
                      className="text-xs border border-slate-200 rounded-md px-1.5 py-1 bg-transparent">
                      {STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <HistoricoCell material={m} onAbrir={setHistorico} />
                      <button onClick={() => setEditando(m)} title="Editar"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                        <Pencil size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {paginacao.total > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{paginacao.total} {paginacao.total === 1 ? 'material' : 'materiais'}</span>
          <div className="flex items-center gap-2">
            <button disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={16} /></button>
            <span>Página {paginacao.pagina} de {paginacao.totalPaginas}</span>
            <button disabled={pagina >= paginacao.totalPaginas} onClick={() => setPagina((p) => p + 1)} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {editando && <FormMaterial inicial={editando} templates={templates} onSalvar={salvar} onFechar={() => setEditando(null)} />}
      {historico && <ModalHistorico material={historico} onFechar={() => setHistorico(null)} onRegistrar={registrar} />}
    </div>
  )
}
