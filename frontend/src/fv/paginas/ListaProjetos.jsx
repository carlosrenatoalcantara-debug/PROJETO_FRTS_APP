import { Link, useNavigate } from 'react-router-dom'
import { ProjetosProvider, useProjetos } from '../providers/ProjetosProvider'
import FormNovoProjeto from '../componentes/FormNovoProjeto'
import { badgeDe, paraDisplay } from '@fortesolar/fv-shared/estados/ciclo-vida'
import CartaoProposta from '../componentes/CartaoProposta'
import { agruparPropostas, resumoDaListagem } from '../propostas'

/**
 * ListaProjetos — entrada principal do módulo FV — FV-UX-011.
 *
 * Cada projeto abre no FLUXO CANÔNICO (`/fv/projetos/:id`), não no wizard.
 * O rótulo do estado vem do vocabulário compartilhado — o mesmo que o backend
 * usa —, não de uma tabela local.
 *
 * ── FV-UX-033: opções agrupadas ──────────────────────────────────────────────
 * Cada opção de proposta é um ProjetoFV completo (FV-DOM-032), então a listagem
 * as devolvia SOLTAS, como se fossem projetos independentes. Aqui elas são
 * agrupadas por `proposta_grupo_id` — reorganização de LEITURA, sem persistir
 * agrupamento nenhum e sem tocar a arquitetura. Projeto que não é opção continua
 * aparecendo exatamente como antes.
 */
function Conteudo() {
  const { lista, total, carregando, erro } = useProjetos()
  const navegar = useNavigate()

  if (carregando) return <p className="p-6 text-sm text-slate-500">Carregando projetos…</p>
  if (erro) return <p className="p-6 text-sm text-red-600">Erro ao carregar: {erro}</p>

  const entradas = agruparPropostas(lista)
  const resumo = resumoDaListagem(entradas)

  return (
    <section className="mx-auto max-w-4xl p-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Projetos Fotovoltaicos</h1>
          <p className="text-sm text-slate-500">
            {total} projeto(s)
            {resumo.propostas > 0 &&
              ` · ${resumo.propostas} proposta(s) com ${resumo.opcoes} opção(ões)`}
          </p>
        </div>
        {/* FV-UX-014: criar projeto na nova UX — o wizard deixa de ser o único caminho. */}
        <FormNovoProjeto aoCriar={(id) => id && navegar(`/fv/projetos/${id}`)} />
      </header>

      {total === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          Nenhum projeto encontrado. Crie o primeiro para iniciar o fluxo.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {entradas.map((e) => {
            if (e.tipo === 'proposta') return <CartaoProposta key={e.chave} proposta={e} />
            // Projeto que não é opção: exatamente o cartão de sempre.
            const p = e.projeto
            const badge = badgeDe(paraDisplay(p.status))
            return (
              <li key={e.chave} className="rounded border border-slate-200 bg-white">
                <Link
                  to={`/fv/projetos/${p._id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{p.nome || 'Sem nome'}</p>
                    <p className="truncate text-xs text-slate-500">
                      {p.clienteId?.nome || 'Sem cliente'}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${badge.cor}`}>
                    {badge.icone} {badge.label}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {/* Convivência: a tela clássica continua acessível e inalterada. */}
      <p className="mt-4 text-xs text-slate-400">
        <Link to="/projetos-fv" className="underline hover:text-slate-600">
          Abrir a listagem clássica
        </Link>
      </p>
    </section>
  )
}

export default function ListaProjetos() {
  return (
    <ProjetosProvider>
      <Conteudo />
    </ProjetosProvider>
  )
}
