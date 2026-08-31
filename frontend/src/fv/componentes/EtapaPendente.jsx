/**
 * EtapaPendente — placeholder ESTRUTURAL — FV-UX-010.
 *
 * A sprint estrutura a navegação sem implementar as etapas. Este componente
 * declara o que falta, em vez de mostrar uma tela vazia: quem abrir a rota
 * entende que é lacuna conhecida do domínio, não bug.
 */
export default function EtapaPendente({ titulo, agregado, sprint, endpoint, children }) {
  return (
    <section className="mx-auto max-w-2xl p-6">
      <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
      <p className="mt-2 text-sm text-slate-600">
        Etapa estruturada nesta sprint; funcionalidade ainda não implementada.
      </p>
      <dl className="mt-4 space-y-2 rounded border border-slate-200 bg-slate-50 p-4 text-sm">
        {agregado && (
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 text-slate-500">Agregado necessário</dt>
            <dd className="font-mono text-slate-800">{agregado}</dd>
          </div>
        )}
        {endpoint && (
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 text-slate-500">Endpoint pendente</dt>
            <dd className="font-mono text-xs text-slate-800">{endpoint}</dd>
          </div>
        )}
        {sprint && (
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 text-slate-500">Sprint responsável</dt>
            <dd className="text-slate-800">{sprint}</dd>
          </div>
        )}
      </dl>
      {children}
    </section>
  )
}
