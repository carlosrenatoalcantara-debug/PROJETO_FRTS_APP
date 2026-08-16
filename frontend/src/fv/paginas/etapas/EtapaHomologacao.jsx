import { useFases } from '../../providers/FasesProvider'

/**
 * EtapaHomologacao — fase paralela — FV-API-001.
 *
 * A LIBERAÇÃO vem do Gate (informação real do domínio). A CONCLUSÃO chega
 * `null`: não existe agregado que a registre (FV-DOM-006). Exibir "pendente"
 * afirmaria algo que ninguém sabe — a tela diz que não é rastreável.
 */
export default function EtapaHomologacao() {
  const { lista, carregando, erro } = useFases()
  const fase = lista.find((f) => f.chave === 'homologacao')

  if (carregando) return <p className="p-6 text-sm text-slate-500">Carregando…</p>
  if (erro) return <p className="p-6 text-sm text-red-600">{erro}</p>
  if (!fase) return <p className="p-6 text-sm text-slate-500">Fase não disponível.</p>

  return (
    <section className="mx-auto max-w-2xl p-6">
      <h2 className="text-lg font-semibold text-slate-900">Homologação</h2>

      <div className={`mt-4 rounded border p-4 text-sm ${
        fase.liberada ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
        <p className={fase.liberada ? 'font-medium text-emerald-800' : 'font-medium text-slate-700'}>
          {fase.liberada ? 'Liberada pelo Gate' : 'Bloqueada pelo Gate'}
        </p>
        {fase.motivo_bloqueio && (
          <p className="mt-1 text-xs text-slate-500">
            Motivo: <code className="font-mono">{fase.motivo_bloqueio}</code>
          </p>
        )}
        <p className="mt-2 text-xs text-slate-500">Fase paralela — corre junto com a outra.</p>
      </div>

      <p className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        Conclusão não rastreável: nenhum agregado registra o encerramento desta
        fase. Previsto para {fase.sprint_responsavel}.
      </p>
    </section>
  )
}
