import { useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef, useMemo } from 'react'
import { Plus, Sun, Filter, Eye, Calculator, Upload, Download, X, Loader, MoreVertical, Copy, Archive, Trash2, RotateCcw, Pencil, AlertTriangle } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import DashboardComercial from '../components/fv/DashboardComercial'
import {
  duplicarProjeto, arquivarProjeto, restaurarProjeto, excluirProjeto,
  listarProjetos, MOTIVOS_ARQUIVAMENTO,
} from '../services/projetosFvLifecycleApi'
import { filtrarProjetos, badgeDe } from '../utils/projetosFiltro'

const FILTROS = [
  { id: 'todos',     label: 'Todos' },
  { id: 'ativos',    label: 'Ativos' },
  { id: 'RASCUNHO',  label: 'Rascunhos' },
  { id: 'PROPOSTA',  label: 'Propostas' },
  { id: 'APROVADO',  label: 'Aprovados' },
  { id: 'PERDIDO',   label: 'Perdidos' },
  { id: 'ARQUIVADO', label: 'Arquivados' },
  { id: 'legados',   label: 'Legados' },
  { id: 'lixeira',   label: 'Lixeira' },
]

export default function ProjetosFV() {
  const navigate = useNavigate()
  const [projetos, setProjetos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [totalPotencia, setTotalPotencia] = useState(0)
  const [filtro, setFiltro] = useState('todos')

  // Parecer Upload States (preservados)
  const [showParecerUpload, setShowParecerUpload] = useState(false)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [uploadSuccess, setUploadSuccess] = useState(null)
  const [resultado, setResultado] = useState(null)
  const fileInputRef = useRef(null)

  // S8.4.1 — controle de ações
  const [menuAberto, setMenuAberto] = useState(null)            // _id do projeto com menu aberto
  const [confirmacao, setConfirmacao] = useState(null)          // { tipo: 'excluir'|'arquivar'|'restaurar', projeto }
  const [acaoMsg, setAcaoMsg] = useState(null)                  // banner pós-ação

  // Recarrega quando o filtro alterna entre normal e lixeira (precisa novo fetch)
  useEffect(() => { carregarProjetos() }, [filtro === 'lixeira'])

  function flash(msg, tipo = 'sucesso') {
    setAcaoMsg({ msg, tipo })
    setTimeout(() => setAcaoMsg(null), 3500)
  }

  async function carregarProjetos() {
    try {
      setLoading(true)
      const dados = await listarProjetos({ incluirExcluidos: filtro === 'lixeira' })
      const projetosReais = (Array.isArray(dados) ? dados : dados.projetos || []).filter(
        (p) => !p.tags?.includes('fake-test')
      )
      setProjetos(projetosReais)
      const total = projetosReais.reduce((sum, p) => sum + (parseFloat(p.potencia_kwp) || 0), 0)
      setTotalPotencia(total)
      setError(null)
    } catch (err) {
      console.error('Erro ao carregar projetos:', err)
      setError(err.message)
      setProjetos([])
    } finally {
      setLoading(false)
    }
  }

  // S8.4.1 — filtragem client-side via helper puro (testável)
  const filtrados = useMemo(() => filtrarProjetos(projetos, filtro), [projetos, filtro])

  // ── Ações ──────────────────────────────────────────────────────────────────
  async function acaoDuplicar(p) {
    try {
      const r = await duplicarProjeto(p._id)
      flash(`Cópia criada como rascunho: ${r.item?.nome || ''}`)
      const novoId = r.item?._id
      await carregarProjetos()
      if (novoId) navigate(`/projetos-fv/${novoId}`)
    } catch (e) { flash(`Erro ao duplicar: ${e.message}`, 'erro') }
  }
  async function acaoArquivar(p, motivo) {
    try {
      await arquivarProjeto(p._id, motivo)
      flash(`Projeto "${p.nome}" arquivado (${motivo}).`)
      carregarProjetos()
    } catch (e) { flash(`Erro ao arquivar: ${e.message}`, 'erro') }
  }
  async function acaoRestaurar(p) {
    try {
      await restaurarProjeto(p._id)
      flash(`Projeto "${p.nome}" restaurado.`)
      carregarProjetos()
    } catch (e) { flash(`Erro ao restaurar: ${e.message}`, 'erro') }
  }
  async function acaoExcluir(p, definitivo) {
    try {
      const r = await excluirProjeto(p._id, { definitivo })
      flash(r.soft ? `Projeto "${p.nome}" enviado para lixeira (soft).` : `Projeto "${p.nome}" removido definitivamente.`)
      carregarProjetos()
    } catch (e) { flash(`Erro ao excluir: ${e.message}`, 'erro') }
  }

  // ── Upload (preservado da versão anterior) ─────────────────────────────────
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.pdf')) { setUploadError('Por favor, selecione um arquivo PDF'); return }
      setFile(selectedFile); setUploadError(null)
    }
  }
  const handleDragOver  = (e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add('border-blue-500', 'bg-blue-100') }
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('border-blue-500', 'bg-blue-100') }
  const handleDrop      = (e) => {
    e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('border-blue-500', 'bg-blue-100')
    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      const selectedFile = droppedFiles[0]
      if (!selectedFile.name.toLowerCase().endsWith('.pdf')) { setUploadError('Por favor, selecione um arquivo PDF'); return }
      setFile(selectedFile); setUploadError(null)
    }
  }
  const handleUploadParecer = async () => {
    if (!file) { setUploadError('Selecione um arquivo PDF'); return }
    try {
      setUploading(true); setUploadError(null)
      const formData = new FormData(); formData.append('pdf', file)
      const response = await fetch('/api/parecer-acesso/extrair', { method: 'POST', body: formData })
      if (!response.ok) { const erro = await response.json(); throw new Error(erro.erro || 'Erro ao processar Parecer') }
      const dados = await response.json()
      setResultado(dados); setUploadSuccess(`✅ Parecer processado com sucesso! Projeto "${dados.projeto.nome}" criado.`); setFile(null)
      setTimeout(() => { carregarProjetos() }, 1500)
    } catch (err) { console.error('Erro:', err); setUploadError(err.message); setUploadSuccess(null) }
    finally { setUploading(false) }
  }
  const downloadUnifilar = () => {
    if (!resultado?.svg) return
    const element = document.createElement('a')
    const blob = new Blob([resultado.svg], { type: 'image/svg+xml' })
    element.href = URL.createObjectURL(blob)
    element.download = `unifilar_${resultado.projeto.nome || 'diagrama'}_${new Date().toISOString().split('T')[0]}.svg`
    document.body.appendChild(element); element.click(); document.body.removeChild(element); URL.revokeObjectURL(element.href)
  }

  const formatarPotencia = (kwp) => !kwp ? 'N/A' : (kwp >= 1 ? `${kwp.toFixed(1)} kWp` : `${(kwp * 1000).toFixed(0)} Wp`)
  const calcularPaineis = (p) => p.equipamentos?.paineis?.[0]?.quantidade || 'N/A'
  const calcularInversores = (p) => p.equipamentos?.inversor?.marca ? 1 : 'N/A'

  return (
    <div className="space-y-5" onClick={() => setMenuAberto(null)}>
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-100"><Sun size={18} className="text-amber-600" /></div>
          <div>
            <p className="text-sm text-slate-500">Total de potência</p>
            <p className="font-bold text-slate-900">{totalPotencia.toFixed(1)} kWp instalados</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variante="secundario" icone={Calculator} tamanho="sm" onClick={() => navigate('/projetos-fv/simulacao')}>Dimensionar</Button>
          <Button icone={Plus} tamanho="sm" onClick={() => navigate('/projetos-fv/novo')}>Novo Projeto FV</Button>
        </div>
      </div>

      {/* Banner pós-ação */}
      {acaoMsg && (
        <div className={`px-4 py-2 rounded border text-sm ${acaoMsg.tipo === 'erro' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          {acaoMsg.msg}
        </div>
      )}

      {/* S4.2: Dashboard comercial */}
      <DashboardComercial projetos={projetos} />

      {/* Parecer Upload Section (preservado) */}
      <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100"><Upload size={20} className="text-blue-600" /></div>
              <div>
                <h3 className="font-bold text-slate-900">Parecer de Acesso</h3>
                <p className="text-sm text-slate-600">Faça upload do parecer em PDF para gerar projeto e diagrama automático</p>
              </div>
            </div>
            {resultado && (
              <button onClick={() => setResultado(null)} className="p-2 hover:bg-blue-100 rounded-lg transition-colors"><X size={20} className="text-slate-600" /></button>
            )}
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {!resultado ? (
            <>
              {uploadError && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">❌ {uploadError}</div>}
              {uploadSuccess && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{uploadSuccess}</div>}
              <div onClick={() => fileInputRef.current?.click()} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-100 transition-all">
                <Upload size={40} className="mx-auto text-blue-400 mb-3" />
                <p className="font-semibold text-slate-900 text-lg">Clique para selecionar PDF</p>
                <p className="text-sm text-slate-500 mt-1">ou arraste e solte aqui</p>
                <p className="text-xs text-slate-400 mt-2">Parecer de Acesso para Conexão de Mini e Microgeração</p>
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />
              {file && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-semibold text-blue-900">📄 {file.name}</p>
                  <p className="text-xs text-blue-600 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleUploadParecer} disabled={!file || uploading} className="flex-1">
                  {uploading ? (<><Loader size={16} className="animate-spin" /> Processando...</>) : (<><Upload size={16} /> Processar Parecer</>)}
                </Button>
                <Button variante="secundario" onClick={() => { setFile(null); setUploadError(null) }} disabled={!file}>Limpar</Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-3">📊 Projeto Criado</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-slate-600 text-xs">Nome</p><p className="font-semibold text-slate-900">{resultado.projeto.nome}</p></div>
                  <div><p className="text-slate-600 text-xs">Cliente</p><p className="font-semibold text-slate-900">{resultado.cliente.nome}</p></div>
                  <div><p className="text-slate-600 text-xs">Painéis</p><p className="font-semibold text-slate-900">{resultado.extractedData.equipamento.paineis.marca} {resultado.extractedData.quantidade_paineis}x</p></div>
                  <div><p className="text-slate-600 text-xs">Inversor</p><p className="font-semibold text-slate-900">{resultado.extractedData.equipamento.inversor.marca} {resultado.extractedData.equipamento.inversor.potencia_kw}kW</p></div>
                </div>
              </div>
              {resultado.svg && resultado.resumo.unifilar_gerado && (
                <div className="border-2 border-blue-200 rounded-lg overflow-hidden bg-white">
                  <div className="bg-blue-50 p-4 border-b border-blue-200"><h4 className="font-semibold text-slate-900">⚡ Diagrama Unifilar</h4></div>
                  <div className="p-4 overflow-auto max-h-96 bg-white"><div dangerouslySetInnerHTML={{ __html: resultado.svg }} className="flex justify-center" /></div>
                  <div className="p-4 bg-blue-50 border-t border-blue-200"><Button onClick={downloadUnifilar} variante="secundario" icone={Download} className="w-full">Baixar Diagrama (SVG)</Button></div>
                </div>
              )}
              <Button onClick={() => { setResultado(null); setFile(null) }} variante="secundario" className="w-full">Processar Outro Parecer</Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Projects List */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-semibold text-slate-900">
                Projetos Fotovoltaicos <span className="text-slate-400 font-normal text-sm ml-1">({filtrados.length}{filtro !== 'todos' ? ` de ${projetos.length}` : ''})</span>
              </h2>
              {filtro === 'lixeira' && <p className="text-xs text-slate-500 mt-1">🗑️ Lixeira — projetos excluídos. Clique em <strong>Restaurar</strong> para reverter.</p>}
            </div>
            <div className="flex flex-wrap gap-1">
              {FILTROS.map((f) => (
                <button key={f.id} onClick={() => setFiltro(f.id)}
                  className={`text-xs px-2.5 py-1 rounded border ${filtro === f.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {loading && <div className="p-8 text-center text-slate-500">Carregando projetos...</div>}
          {error && (
            <div className="p-8 bg-amber-50 border border-amber-200 rounded text-center">
              <div className="text-amber-700 font-medium mb-1">⚠️ Servidor temporariamente indisponível</div>
              <div className="text-slate-500 text-sm mb-3">Os projetos serão exibidos assim que a conexão for restabelecida.</div>
              <button onClick={carregarProjetos} className="text-sm text-blue-600 hover:text-blue-800 underline">Tentar novamente</button>
            </div>
          )}
          {!loading && filtrados.length === 0 && !error && (
            <div className="p-8 text-center text-slate-500">
              {filtro === 'lixeira'
                ? 'Lixeira vazia. Nenhum projeto excluído.'
                : 'Nenhum projeto encontrado para este filtro.'}
            </div>
          )}
          {!loading && filtrados.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Projeto','Cliente','Potência','Painéis','Inversores','Status','Ações'].map(h => (
                      <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtrados.map((p) => {
                    const badge = badgeDe(p.status_display)
                    return (
                      <tr key={p._id} className={`hover:bg-slate-50 transition-colors ${p.excluido ? 'opacity-60' : ''}`}>
                        <td className="px-6 py-4 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{p.nome}</span>
                            {p.legacy && (
                              <span title={`Sinalizadores: ${(p.legacy_motivos || []).join(', ')}`}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 border border-amber-200">
                                <AlertTriangle size={10} /> Precisa revisão
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{p.cliente_nome || 'N/A'}</td>
                        <td className="px-6 py-4 text-slate-600">{formatarPotencia(p.potencia_kwp)}</td>
                        <td className="px-6 py-4 text-slate-600">{calcularPaineis(p)}</td>
                        <td className="px-6 py-4 text-slate-600">{calcularInversores(p)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${badge.cor}`}>
                            <span>{badge.icone}</span>{badge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <MenuAcoes
                            projeto={p}
                            aberto={menuAberto === p._id}
                            onToggle={(e) => { e.stopPropagation(); setMenuAberto(menuAberto === p._id ? null : p._id) }}
                            onAbrir={() => navigate(`/projetos-fv/${p._id}`)}
                            // P0-02: editar abre o WIZARD oficial hidratando do banco via ?id=.
                            // Antes navegava para `/projetos-fv/:id?wizard=1`, que cai na tela
                            // de detalhes (somente leitura) e ignora ?wizard=1 → "não entra em
                            // modo edição". O wizard (ProjetosFVNovo) suporta ?id= e hidrata
                            // todos os slices a partir de GET /api/projetos-fv/:id.
                            onEditar={() => navigate(`/projetos-fv/novo?id=${p._id}`)}
                            onDuplicar={() => acaoDuplicar(p)}
                            onArquivar={() => setConfirmacao({ tipo: 'arquivar', projeto: p })}
                            onExcluir={() => setConfirmacao({ tipo: 'excluir', projeto: p })}
                            onRestaurar={() => acaoRestaurar(p)}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Modal de confirmação */}
      {confirmacao && (
        <ModalConfirmacao
          dados={confirmacao}
          onFechar={() => setConfirmacao(null)}
          onConfirmarExcluir={(definitivo) => { acaoExcluir(confirmacao.projeto, definitivo); setConfirmacao(null) }}
          onConfirmarArquivar={(motivo) => { acaoArquivar(confirmacao.projeto, motivo); setConfirmacao(null) }}
        />
      )}
    </div>
  )
}

/** Menu dropdown de ações por projeto (⋮). */
function MenuAcoes({ projeto, aberto, onToggle, onAbrir, onEditar, onDuplicar, onArquivar, onExcluir, onRestaurar }) {
  const item = 'w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 flex items-center gap-2'
  const podeHard = projeto.pode_excluir_definitivo === true
  const isLixeira = projeto.excluido === true
  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button onClick={onToggle} aria-label="Ações" className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
        <MoreVertical size={16} />
      </button>
      {aberto && (
        <div className="absolute right-0 mt-1 z-20 bg-white border border-slate-200 rounded-md shadow-lg min-w-[200px] py-1">
          {!isLixeira && (
            <>
              <button className={item} onClick={() => { onAbrir(); onToggle({ stopPropagation: () => {} }) }}><Eye size={14} /> Abrir</button>
              <button className={item} onClick={() => { onEditar(); onToggle({ stopPropagation: () => {} }) }}><Pencil size={14} /> Editar</button>
              <button className={item} onClick={() => { onDuplicar(); onToggle({ stopPropagation: () => {} }) }}><Copy size={14} /> Duplicar</button>
              <div className="my-1 border-t border-slate-100" />
              <button className={item} onClick={() => { onArquivar(); onToggle({ stopPropagation: () => {} }) }}>
                <Archive size={14} /> Arquivar
              </button>
              <button className={`${item} text-red-600`} onClick={() => { onExcluir(); onToggle({ stopPropagation: () => {} }) }}>
                <Trash2 size={14} /> {podeHard ? 'Excluir definitivamente' : 'Excluir (mover p/ lixeira)'}
              </button>
            </>
          )}
          {isLixeira && (
            <button className={`${item} text-emerald-700`} onClick={() => { onRestaurar(); onToggle({ stopPropagation: () => {} }) }}>
              <RotateCcw size={14} /> Restaurar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Modal único: trata excluir e arquivar com motivo. */
function ModalConfirmacao({ dados, onFechar, onConfirmarExcluir, onConfirmarArquivar }) {
  const { tipo, projeto } = dados
  const [motivo, setMotivo] = useState(MOTIVOS_ARQUIVAMENTO[0])
  const podeHard = projeto.pode_excluir_definitivo === true

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onFechar}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-semibold text-slate-900">
            {tipo === 'excluir' ? 'Excluir projeto' : 'Arquivar projeto'}
          </h4>
          <button onClick={onFechar} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3 text-sm text-slate-700">
          {tipo === 'excluir' && (
            <>
              <p>Tem certeza?</p>
              <p className="text-xs text-slate-500">
                {podeHard
                  ? <>Projeto <strong>{projeto.nome}</strong> será <strong>removido definitivamente</strong> (rascunho sem freeze, assinatura ou documentos).</>
                  : <>Projeto <strong>{projeto.nome}</strong> possui histórico — será movido para a <strong>lixeira</strong> (soft-delete). Restauração possível.</>}
              </p>
            </>
          )}
          {tipo === 'arquivar' && (
            <>
              <p>Informe o motivo do arquivamento de <strong>{projeto.nome}</strong>:</p>
              <select value={motivo} onChange={(e) => setMotivo(e.target.value)}
                className="w-full px-3 py-2 rounded border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {MOTIVOS_ARQUIVAMENTO.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <p className="text-xs text-slate-500">O projeto fica visível em <strong>Arquivados</strong> e pode ser restaurado.</p>
            </>
          )}
        </div>
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button onClick={onFechar} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
          {tipo === 'excluir' && (
            <button onClick={() => onConfirmarExcluir(podeHard)}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium">
              {podeHard ? 'Excluir definitivamente' : 'Mover para lixeira'}
            </button>
          )}
          {tipo === 'arquivar' && (
            <button onClick={() => onConfirmarArquivar(motivo)}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm font-medium">
              Arquivar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
