import { useContrato } from '../../providers/ContratoProvider'

/**
 * EtapaGate — bifurcação Engenharia ∥ Homologação — FV-API-001.
 *
 * A decisão exibida é a MESMA que o domínio usa para bloquear. Não é mais
 * indicativa: vem de `GET /api/projetos-fv/:id/gate`, que avalia com
 * `BaselineService.avaliarGate` — o servidor continua sendo a autoridade, e
 * agora a tela mostra exatamente o que ele decidiu.
 */
export default function EtapaGate() {
  const { fases, gateAutoritativo, baselineRef, carregando, erro } = useContrato()

  if (carregando) return <p className="p-6 text-sm text-slate-500">Carregando…</p>
  if (erro) return <p className="p-6 text-sm text-red-600">{erro}</p>

  const entradas = Object.entries(fases)

  return (
    <section className="mx-auto max-w-2xl p-6">
      <h2 className="text-lg font-semibold text-slate-900">Gate de Bifurcação</h2>
      <p className="mt-1 text-xs text-slate-500">
        {gateAutoritativo ? 'Decisão do domínio (autoritativa).' : 'Decisão não confirmada pelo servidor.'}
        {baselineRef ? ` · baseline ${String(baselineRef).slice(-6)}` : ''}
      </p>

      <ul className="mt-4 space-y-3">
        {entradas.map(([chave, f]) => (
          <li key={chave} className={`rounded border p-4 text-sm ${
            f.liberado ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
            <p className={f.liberado ? 'font-medium text-emerald-800' : 'font-medium text-slate-700'}>
              {chave === 'engenharia' ? 'Engenharia' : 'Homologação'} — {f.liberado ? 'liberada' : 'bloqueada'}
            </p>
            {f.mensagem && <p className="mt-1 text-slate-600">{f.mensagem}</p>}
            {f.motivo && <p className="mt-1 text-xs text-slate-500">Motivo: <code className="font-mono">{f.motivo}</code></p>}
          </li>
        ))}
      </ul>

      {entradas.some(([, f]) => !f.liberado) && (
        <p className="mt-4 text-xs text-slate-500">
          As duas fases só abrem com Baseline válida — aprove um orçamento para congelá-la.
        </p>
      )}
    </section>
  )
}
