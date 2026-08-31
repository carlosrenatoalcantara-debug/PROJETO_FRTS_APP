import { useContrato } from '../../providers/ContratoProvider'

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * EtapaBaseline — agregado `Baseline` (M-2) — FV-API-001.
 *
 * Exibe o CONTEÚDO congelado, que é autocontido por construção: os totais e os
 * itens vieram do momento da aprovação, não de uma releitura do catálogo.
 * A integridade é verificada no servidor — só ele recalcula o hash.
 */
export default function EtapaBaseline() {
  const { baseline, temBaseline, baselineIntegra, conteudo, carregando, erro } = useContrato()

  if (carregando) return <p className="p-6 text-sm text-slate-500">Carregando…</p>
  if (erro) return <p className="p-6 text-sm text-red-600">{erro}</p>

  if (!temBaseline) {
    return (
      <section className="mx-auto max-w-2xl p-6">
        <h2 className="text-lg font-semibold text-slate-900">Baseline Contratual</h2>
        <p className="mt-4 text-sm text-slate-500">
          Ainda não há Baseline. Ela nasce da aprovação de um orçamento.
        </p>
      </section>
    )
  }

  const totais = conteudo?.orcamento?.totais ?? {}
  return (
    <section className="mx-auto max-w-3xl p-6">
      <h2 className="text-lg font-semibold text-slate-900">Baseline Contratual</h2>

      <div className={`mt-4 rounded border p-4 text-sm ${
        baselineIntegra ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
        <p className={baselineIntegra ? 'font-medium text-emerald-800' : 'font-medium text-red-800'}>
          {baselineIntegra ? 'Integridade verificada' : 'Falha na verificação de integridade'}
        </p>
        <p className="mt-1 font-mono text-xs text-slate-500 break-all">{baseline.hash}</p>
        <p className="mt-1 text-xs text-slate-500">
          Congelada em {new Date(baseline.congelado_em).toLocaleString('pt-BR')}
          {baseline.congelado_por ? ` por ${baseline.congelado_por}` : ''}
        </p>
      </div>

      <dl className="mt-4 divide-y divide-slate-200 rounded border border-slate-200 bg-white text-sm">
        {[
          ['Total de materiais', MOEDA.format(totais.total_material_r ?? 0)],
          ['Total de serviços', MOEDA.format(totais.total_servicos_r ?? 0)],
          ['Total contratado', MOEDA.format(totais.total_r ?? 0)],
          ['Itens congelados', String(conteudo?.orcamento?.itens?.length ?? 0)],
          ['Tecnologia da cotação', conteudo?.cotacao?.tecnologia ?? '—'],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-2 px-4 py-2">
            <dt className="w-48 shrink-0 text-slate-500">{k}</dt>
            <dd className="text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-xs text-slate-500">
        Conteúdo autocontido: alterar a cotação ou o catálogo não muda o que foi contratado.
      </p>
    </section>
  )
}
