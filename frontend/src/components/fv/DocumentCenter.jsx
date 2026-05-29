import { FileText, Download, ExternalLink, Lock, Clock, FileSignature, Building2, Zap } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../ui/Card'
import Badge from '../ui/Badge'
import { baixarUnifilarSVG } from '../../utils/gerarUnifilarSVG'
import { useEmpresa } from '../../contexts/EmpresaContext'
import { registrarEventoPainel } from '../../services/gestaoApi'
import { getHistoricoTipoConfig } from '../../utils/engenhariaGovernanca'
import { urlPublica } from '../../utils/crmComercial'

/**
 * DocumentCenter — Sprint 7.3.1
 *
 * Central de documentos do projeto, agrupados por categoria, com status (ligado
 * ao freeze_status), revisão, data e hash. Downloads reutilizam geradores
 * existentes. Histórico via governanca.historico (timeline única). Audita ações.
 */
const STATUS_DOC = {
  RASCUNHO:  { label: 'Rascunho', cor: 'cinza' },
  CONGELADO: { label: 'Congelado', cor: 'laranja' },
  ASSINADO:  { label: 'Assinado', cor: 'azul' },
  HOMOLOGADO:{ label: 'Homologado', cor: 'verde' },
}

function statusDoProjeto(gov) {
  const fz = gov?.freeze_status
  if (fz === 'HOMOLOGADO') return 'HOMOLOGADO'
  if (gov?.comercial?.workflow_status === 'ASSINADO') return 'ASSINADO'
  if (fz === 'CONGELADO') return 'CONGELADO'
  return 'RASCUNHO'
}

function baixarJSON(obj, nome) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `${nome}.json`
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

export default function DocumentCenter({ projeto }) {
  const { empresa } = useEmpresa()
  const gov = projeto?.governanca || {}
  const status = statusDoProjeto(gov)
  const rev = gov.revisao_atual || 'A'
  const dataCong = gov.congelado_em ? new Date(gov.congelado_em).toLocaleDateString('pt-BR') : '—'
  const share = (gov.comercial?.compartilhamentos || []).slice(-1)[0] || null

  function evento(acao, detalhe) { registrarEventoPainel(acao, detalhe, projeto?._id) }

  function baixarUnifilar() {
    const svg = gov.snapshot_unifilar?.svg
    if (!svg) return
    baixarUnifilarSVG(svg, `unifilar-${projeto?.nome || projeto?._id}`)
    evento('download', 'unifilar')
  }

  const grupos = [
    {
      titulo: 'Propostas', icone: FileSignature, cor: 'text-emerald-600',
      docs: [
        {
          nome: 'Proposta comercial', tipo: 'PDF/HTML', rev, status,
          data: dataCong, hash: gov.snapshot_financeiro?.hash || gov.comercial?.snapshot_comercial?.hash,
          acao: share ? { label: 'Abrir link público', onClick: () => { window.open(urlPublica(share.token), '_blank'); evento('visualizacao', 'proposta_publica') }, icone: ExternalLink } : null,
        },
        ...(gov.comercial?.revisoes_comerciais || []).map((r) => ({
          nome: `Proposta — Rev ${r.rev}`, tipo: 'Revisão', rev: r.rev, status: 'CONGELADO',
          data: r.timestamp ? new Date(r.timestamp).toLocaleDateString('pt-BR') : '—',
          hash: r.snapshot_comercial?.hash, acao: null,
        })),
      ],
    },
    {
      titulo: 'Engenharia', icone: Zap, cor: 'text-amber-600',
      docs: [
        { nome: 'Unifilar', tipo: 'SVG', rev, status, data: gov.snapshot_unifilar?.criado_em ? new Date(gov.snapshot_unifilar.criado_em).toLocaleDateString('pt-BR') : '—', hash: gov.snapshot_unifilar?.hash, acao: gov.snapshot_unifilar?.svg ? { label: 'Baixar SVG', onClick: baixarUnifilar, icone: Download } : null },
        { nome: 'Memorial técnico', tipo: 'JSON', rev, status, data: dataCong, hash: gov.snapshot_memorial?.hash, acao: gov.snapshot_memorial ? { label: 'Baixar', onClick: () => { baixarJSON(gov.snapshot_memorial, `memorial-${projeto?._id}`); evento('download', 'memorial') }, icone: Download } : null },
        { nome: 'Dimensionamento', tipo: 'JSON', rev, status, data: dataCong, hash: gov.snapshot_tecnico?.hash, acao: gov.snapshot_tecnico ? { label: 'Baixar', onClick: () => { baixarJSON(gov.snapshot_tecnico, `tecnico-${projeto?._id}`); evento('download', 'tecnico') }, icone: Download } : null },
        { nome: 'Layout geoespacial', tipo: 'JSON', rev, status, data: dataCong, hash: gov.snapshot_geoespacial?.hash, acao: gov.snapshot_geoespacial ? { label: 'Baixar', onClick: () => { baixarJSON(gov.snapshot_geoespacial, `layout-${projeto?._id}`); evento('download', 'layout') }, icone: Download } : null },
      ],
    },
    {
      titulo: 'Homologação', icone: FileText, cor: 'text-blue-600',
      docs: [
        { nome: 'ART/TRT padrão', tipo: 'Anexo', rev: '—', status: empresa?.uploads?.artPadrao ? 'CONGELADO' : 'RASCUNHO', data: '—', hash: null, acao: empresa?.uploads?.artPadrao ? { label: 'Abrir', onClick: () => { window.open(empresa.uploads.artPadrao, '_blank'); evento('visualizacao', 'art_padrao') }, icone: ExternalLink } : null },
        { nome: 'Formulários concessionária', tipo: 'Anexo', rev: '—', status: 'RASCUNHO', data: '—', hash: null, acao: null },
      ],
    },
    {
      titulo: 'Empresa', icone: Building2, cor: 'text-slate-600',
      docs: (empresa?.uploads?.documentos || []).map((d, i) => ({
        nome: d.nome || `Documento ${i + 1}`, tipo: 'Anexo', rev: '—', status: 'CONGELADO', data: '—', hash: null,
        acao: d.dados ? { label: 'Abrir', onClick: () => { window.open(d.dados, '_blank'); evento('visualizacao', 'doc_empresa') }, icone: ExternalLink } : null,
      })),
    },
  ]

  const timeline = [...(gov.historico || [])].reverse().slice(0, 8)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex items-center gap-2">
          <FileText size={16} className="text-indigo-600" /> Central de Documentos
          <Badge cor={STATUS_DOC[status].cor}>{STATUS_DOC[status].label}</Badge>
          <span className="text-xs text-slate-400 font-mono ml-1">Rev {rev}</span>
        </CardHeader>
        <CardBody className="space-y-5">
          {grupos.map((g) => (
            <div key={g.titulo}>
              <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><g.icone size={15} className={g.cor} /> {g.titulo}</p>
              {g.docs.length === 0 ? (
                <p className="text-xs text-slate-400 pl-1">Nenhum documento.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-400 border-b border-slate-100">
                        <th className="text-left py-1 pr-3">Documento</th>
                        <th className="text-left py-1 pr-3">Tipo</th>
                        <th className="text-left py-1 pr-3">Rev</th>
                        <th className="text-left py-1 pr-3">Status</th>
                        <th className="text-left py-1 pr-3">Data</th>
                        <th className="text-left py-1 pr-3">Hash</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.docs.map((d, i) => (
                        <tr key={i} className="border-b border-slate-50">
                          <td className="py-1.5 pr-3 text-slate-700 font-medium">{d.nome}</td>
                          <td className="py-1.5 pr-3 text-slate-500">{d.tipo}</td>
                          <td className="py-1.5 pr-3 text-slate-500">{d.rev}</td>
                          <td className="py-1.5 pr-3"><Badge cor={STATUS_DOC[d.status]?.cor || 'cinza'}>{STATUS_DOC[d.status]?.label || d.status}</Badge></td>
                          <td className="py-1.5 pr-3 text-slate-500">{d.data}</td>
                          <td className="py-1.5 pr-3 font-mono text-[11px] text-slate-400">{d.hash ? String(d.hash).slice(0, 10) : '—'}</td>
                          <td className="py-1.5 text-right">
                            {d.acao && (
                              <button onClick={d.acao.onClick} className="inline-flex items-center gap-1 text-indigo-600 hover:underline text-xs">
                                <d.acao.icone size={13} /> {d.acao.label}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </CardBody>
      </Card>

      {/* Histórico do documento (timeline única) */}
      {timeline.length > 0 && (
        <Card>
          <CardHeader className="flex items-center gap-2"><Clock size={15} className="text-slate-500" /> Histórico</CardHeader>
          <CardBody>
            <div className="space-y-1.5">
              {timeline.map((h, i) => {
                const tc = getHistoricoTipoConfig(h.tipo)
                return (
                  <div key={i} className="text-xs text-slate-600 flex items-start gap-2">
                    <span>{tc.icon}</span>
                    <span className="flex-1">{h.descricao || tc.label}</span>
                    {h.timestamp && <span className="text-slate-400">{new Date(h.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>}
                  </div>
                )
              })}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
