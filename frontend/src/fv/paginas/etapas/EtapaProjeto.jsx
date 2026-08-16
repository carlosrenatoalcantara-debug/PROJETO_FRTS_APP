import { useProjeto } from '../../providers/ProjetoProvider'

/** EtapaProjeto — identificação do projeto. Lê o agregado ProjetoFV. */
export default function EtapaProjeto() {
  const { projeto, carregando, erro } = useProjeto()
  if (carregando) return <p className="p-6 text-sm text-slate-500">Carregando…</p>
  if (erro) return <p className="p-6 text-sm text-red-600">{erro}</p>
  if (!projeto) return <p className="p-6 text-sm text-slate-500">Projeto não encontrado.</p>

  const local = projeto.local_resolvido ?? {}
  const linhas = [
    ['Nome', projeto.nome],
    ['Cliente', projeto.clienteId?.nome ?? '—'],
    ['Cidade / UF', [local.cidade, local.estado].filter(Boolean).join(' / ') || '—'],
    ['Tipo', projeto.tipo_projeto ?? '—'],
    ['Instalação (topologia)', projeto.instalacao_ref ? 'vinculada' : 'não vinculada'],
  ]

  return (
    <section className="mx-auto max-w-2xl p-6">
      <h2 className="text-lg font-semibold text-slate-900">Projeto</h2>
      <dl className="mt-4 divide-y divide-slate-200 rounded border border-slate-200 bg-white text-sm">
        {linhas.map(([k, v]) => (
          <div key={k} className="flex gap-2 px-4 py-2">
            <dt className="w-48 shrink-0 text-slate-500">{k}</dt>
            <dd className="text-slate-900">{v || '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
