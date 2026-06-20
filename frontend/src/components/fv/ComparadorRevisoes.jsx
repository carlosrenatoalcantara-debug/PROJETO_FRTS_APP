import { useState, useMemo, useEffect } from 'react'
import { GitCompare } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../ui/Card'
import { diffRevisoes, STATUS_DIFF } from '../../utils/diffRevisoes'

/**
 * ComparadorRevisoes — Sprint 7.3.1
 *
 * Compara visualmente duas revisões CONGELADAS de um projeto. Apenas leitura
 * de snapshots (governanca.revisoes + estado atual). Não recalcula nada.
 *
 * @param {object} governanca  — projeto.governanca
 * @param {function} [onEvento] — registra auditoria (acao 'comparacao')
 */
export default function ComparadorRevisoes({ governanca, onEvento }) {
  const gov = governanca || {}

  // Monta a lista de revisões disponíveis (arquivadas + "Atual")
  const revisoes = useMemo(() => {
    const lista = []
    // "Atual" = estado congelado vigente
    lista.push({
      id: 'atual',
      rev: `${gov.revisao_atual || 'A'} (atual)`,
      bundle: {
        tecnico: gov.snapshot_tecnico, geoespacial: gov.snapshot_geoespacial,
        financeiro: gov.snapshot_financeiro, unifilar: gov.snapshot_unifilar,
        memorial: gov.snapshot_memorial, empresa: gov.snapshot_empresa,
        tecnico_identificacao: gov.snapshot_tecnico_identificacao,
      },
    })
    for (const r of (gov.revisoes || [])) {
      lista.push({ id: `rev-${r.rev}-${r.timestamp}`, rev: `Rev ${r.rev}`, bundle: r.snapshots || {}, timestamp: r.timestamp })
    }
    return lista
  }, [gov])

  const [idA, setIdA] = useState(revisoes[1]?.id || revisoes[0]?.id || 'atual')
  const [idB, setIdB] = useState('atual')

  useEffect(() => {
    if (!revisoes.find((r) => r.id === idA)) setIdA(revisoes[0]?.id)
    if (!revisoes.find((r) => r.id === idB)) setIdB(revisoes[0]?.id)
  }, [revisoes]) // eslint-disable-line

  const A = revisoes.find((r) => r.id === idA)
  const B = revisoes.find((r) => r.id === idB)
  const resultado = useMemo(() => (A && B ? diffRevisoes(A.bundle, B.bundle) : null), [A, B])

  useEffect(() => {
    if (A && B && A.id !== B.id) onEvento?.('comparacao', `Comparou ${A.rev} × ${B.rev}`)
  }, [idA, idB]) // eslint-disable-line

  if (revisoes.length < 2) {
    return (
      <Card>
        <CardHeader className="flex items-center gap-2"><GitCompare size={16} className="text-slate-500" /> Comparar Revisões</CardHeader>
        <CardBody><p className="text-sm text-slate-500">É necessário ao menos uma revisão congelada além do estado atual para comparar. Congele o projeto e crie uma revisão para habilitar.</p></CardBody>
      </Card>
    )
  }

  const sel = 'px-2 py-1.5 rounded border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
  const fmt = (v) => v == null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)

  return (
    <Card>
      <CardHeader className="flex items-center gap-2"><GitCompare size={16} className="text-indigo-600" /> Comparar Revisões</CardHeader>
      <CardBody>
        <div className="flex items-end gap-3 flex-wrap mb-4">
          <div>
            <label className="text-xs text-slate-500 block mb-0.5">Origem</label>
            <select className={sel} value={idA} onChange={(e) => setIdA(e.target.value)}>
              {revisoes.map((r) => <option key={r.id} value={r.id}>{r.rev}</option>)}
            </select>
          </div>
          <span className="text-slate-400 pb-1.5">→</span>
          <div>
            <label className="text-xs text-slate-500 block mb-0.5">Destino</label>
            <select className={sel} value={idB} onChange={(e) => setIdB(e.target.value)}>
              {revisoes.map((r) => <option key={r.id} value={r.id}>{r.rev}</option>)}
            </select>
          </div>
          {resultado && (
            <span className="text-xs text-slate-500 pb-1.5">
              {resultado.totalAlteracoes === 0 ? 'Sem diferenças' : `${resultado.totalAlteracoes} alteração(ões)`}
            </span>
          )}
        </div>

        {/* Legenda */}
        <div className="flex gap-3 text-xs text-slate-500 mb-3">
          <span>✓ igual</span><span className="text-amber-700">⚠ alterado</span>
          <span className="text-emerald-700">+ adicionado</span><span className="text-red-700">− removido</span>
        </div>

        {resultado?.secoes.map((sec) => (
          <div key={sec.secao} className="mb-4">
            <p className="text-sm font-semibold text-slate-700 mb-1.5">{sec.label}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-100">
                    <th className="text-left py-1 pr-3 w-6"></th>
                    <th className="text-left py-1 pr-3">Campo</th>
                    <th className="text-left py-1 pr-3">{A?.rev}</th>
                    <th className="text-left py-1 pr-3">{B?.rev}</th>
                  </tr>
                </thead>
                <tbody>
                  {sec.linhas.map((l, i) => {
                    const s = STATUS_DIFF[l.status]
                    return (
                      <tr key={i} className={`border-b border-slate-50 ${s.bg}`}>
                        <td className={`py-1.5 pr-2 font-bold ${s.cor}`}>{s.icone}</td>
                        <td className="py-1.5 pr-3 text-slate-600">{l.campo}</td>
                        <td className="py-1.5 pr-3 text-slate-500">{fmt(l.de)}</td>
                        <td className={`py-1.5 pr-3 font-medium ${l.status === 'alterado' ? 'text-amber-800' : 'text-slate-800'}`}>{fmt(l.para)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  )
}
