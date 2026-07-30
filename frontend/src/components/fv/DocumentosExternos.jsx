// P5-PROJETO-DOCUMENTOS-EXTERNOS-01
// Índice de pastas externas do projeto (OneDrive, Google Drive, SharePoint, Dropbox...).
// NÃO faz upload. NÃO sincroniza. Apenas exibe e edita links; abre em nova aba.
import { useState } from 'react'
import { ExternalLink, FolderOpen, Pencil, X } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../ui/Card'
import Button from '../ui/Button'

const PASTAS = [
  { campo: 'pasta_principal',   rotulo: 'Pasta Principal',  emoji: '📁' },
  { campo: 'pasta_fotos',       rotulo: 'Fotos',            emoji: '📷' },
  { campo: 'pasta_homologacao', rotulo: 'Homologação',      emoji: '📋' },
  { campo: 'pasta_garantia',    rotulo: 'Garantia',         emoji: '🛡' },
  { campo: 'pasta_medicoes',    rotulo: 'Medições',         emoji: '📊' },
]

function abrirLink(url) {
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

export default function DocumentosExternos({ projeto, onAtualizar }) {
  const doc = projeto?.documentacao_externa || {}
  const [editar, setEditar] = useState(false)
  const [form, setForm] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)

  const temAlgumLink = PASTAS.some(p => doc[p.campo])
  const apenasNasePrincipal = doc.pasta_principal &&
    !doc.pasta_fotos && !doc.pasta_homologacao && !doc.pasta_garantia && !doc.pasta_medicoes

  function iniciarEdicao() {
    setForm({
      pasta_principal:   doc.pasta_principal   || '',
      pasta_fotos:       doc.pasta_fotos       || '',
      pasta_homologacao: doc.pasta_homologacao || '',
      pasta_garantia:    doc.pasta_garantia    || '',
      pasta_medicoes:    doc.pasta_medicoes    || '',
      observacoes:       doc.observacoes       || '',
    })
    setMsg(null)
    setEditar(true)
  }

  async function salvar() {
    setSalvando(true)
    setMsg(null)
    try {
      const payload = {}
      for (const { campo } of PASTAS) payload[campo] = form[campo]?.trim() || null
      payload.observacoes = form.observacoes?.trim() || null

      const r = await fetch(`/api/projetos-fv/${projeto._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentacao_externa: payload }),
      })
      if (!r.ok) throw new Error('Falha ao salvar')
      setEditar(false)
      setMsg('Links salvos com sucesso.')
      onAtualizar?.()
    } catch (e) {
      setMsg(e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen size={16} className="text-blue-600" />
          <span>Documentação Externa</span>
        </div>
        {!editar && (
          <Button tamanho="sm" variante="fantasma" onClick={iniciarEdicao} title="Editar links">
            <Pencil size={13} />
            Editar
          </Button>
        )}
      </CardHeader>

      <CardBody>
        {msg && <p className="text-sm text-emerald-700 mb-3">{msg}</p>}

        {/* Modo leitura — sem links */}
        {!editar && !temAlgumLink && (
          <div className="text-center py-8">
            <FolderOpen size={36} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500">Nenhuma pasta vinculada ainda.</p>
            <p className="text-xs text-slate-400 mt-1">
              Clique em "Editar" para adicionar links do OneDrive, Google Drive, SharePoint ou Dropbox.
            </p>
          </div>
        )}

        {/* Modo leitura — apenas pasta principal */}
        {!editar && temAlgumLink && apenasNasePrincipal && (
          <div className="space-y-2">
            <button
              onClick={() => abrirLink(doc.pasta_principal)}
              className="w-full flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-3 rounded-lg transition-colors text-sm"
            >
              <span>📁</span>
              Abrir Pasta Cliente
              <ExternalLink size={14} />
            </button>
            {doc.observacoes && (
              <p className="text-xs text-slate-500 px-1 mt-2">{doc.observacoes}</p>
            )}
          </div>
        )}

        {/* Modo leitura — pastas específicas */}
        {!editar && temAlgumLink && !apenasNasePrincipal && (
          <div className="space-y-2">
            {PASTAS.map(({ campo, rotulo, emoji }) => doc[campo] && (
              <button
                key={campo}
                onClick={() => abrirLink(doc[campo])}
                className="w-full flex items-center justify-between gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 py-2.5 px-4 rounded-lg transition-colors text-sm"
              >
                <span className="flex items-center gap-2">
                  <span>{emoji}</span>
                  {rotulo}
                </span>
                <ExternalLink size={14} className="text-blue-500 shrink-0" />
              </button>
            ))}
            {doc.observacoes && (
              <p className="text-xs text-slate-500 px-1 mt-2">{doc.observacoes}</p>
            )}
          </div>
        )}

        {/* Modo edição */}
        {editar && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 mb-1">
              Cole aqui os links de compartilhamento das pastas (OneDrive, Google Drive, SharePoint, Dropbox, etc.).
              A plataforma não armazena arquivos — apenas referencia.
            </p>
            {PASTAS.map(({ campo, rotulo, emoji }) => (
              <label key={campo} className="block">
                <span className="text-xs font-medium text-slate-600">{emoji} {rotulo}</span>
                <input
                  type="url"
                  value={form[campo] || ''}
                  onChange={e => setForm(f => ({ ...f, [campo]: e.target.value }))}
                  placeholder="https://..."
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </label>
            ))}
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Observações</span>
              <textarea
                value={form.observacoes || ''}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                rows={2}
                placeholder="Estrutura de pastas, instruções de acesso, etc."
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            </label>
            <div className="flex gap-2 pt-1">
              <Button
                variante="secundario"
                onClick={() => setEditar(false)}
                disabled={salvando}
              >
                <X size={14} />
                Cancelar
              </Button>
              <Button
                onClick={salvar}
                carregando={salvando}
                disabled={salvando}
              >
                Salvar Links
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
