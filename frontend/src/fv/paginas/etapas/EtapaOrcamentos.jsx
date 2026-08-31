import { useOrcamentos } from '../../providers/OrcamentosProvider'
import CartaoOrcamento from '../../componentes/CartaoOrcamento'
import FormNovoOrcamento from '../../componentes/FormNovoOrcamento'
import ResumoOpcao from '../../componentes/ResumoOpcao'

/**
 * EtapaOrcamentos — agregado `Orcamento` — FV-UX-011.
 *
 * Três recortes do mesmo conjunto: vigente, aprovado e histórico. Nenhum
 * orçamento é escondido — INV-ORC-2 garante que nada é sobrescrito, e a tela
 * reflete isso.
 */
export default function EtapaOrcamentos() {
  const { vigente, aprovado, historico, total, acoes, carregando, erro } = useOrcamentos()

  if (carregando) return <p className="p-6 text-sm text-slate-500">Carregando…</p>
  if (erro) return <p className="p-6 text-sm text-red-600">{erro}</p>

  if (total === 0) {
    return (
      <section className="mx-auto max-w-3xl p-6">
        <h2 className="text-lg font-semibold text-slate-900">Orçamentos</h2>
        {/* FV-UX-030: identifica a opção que este orçamento vai precificar. */}
        <ResumoOpcao className="mt-3 block" />
        <p className="mt-4 text-sm text-slate-500">
          Nenhum orçamento registrado. Ele deriva de uma cotação (M-1).
        </p>
        <div className="mt-4"><FormNovoOrcamento /></div>
      </section>
    )
  }

  const aprovadoSeparado = aprovado && String(aprovado._id) !== String(vigente?._id)

  return (
    <section className="mx-auto max-w-3xl p-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Orçamentos</h2>
          <p className="text-sm text-slate-500">{total} no total · histórico preservado</p>
        </div>
        <FormNovoOrcamento />
      </header>

      {/* FV-UX-030: identifica a opção que estes orçamentos precificam. */}
      <ResumoOpcao className="mt-3 block" />

      {vigente && (
        <>
          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">Vigente</h3>
          <div className="mt-2">
            <CartaoOrcamento
              orcamento={vigente}
              destaque={String(vigente._id) === String(aprovado?._id) ? 'aprovado' : 'vigente'}
              acoes={acoes}
            />
          </div>
        </>
      )}

      {aprovadoSeparado && (
        <>
          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">Aprovado</h3>
          <div className="mt-2"><CartaoOrcamento orcamento={aprovado} destaque="aprovado" /></div>
        </>
      )}

      {historico.length > 0 && (
        <>
          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Histórico ({historico.length})
          </h3>
          <div className="mt-2 space-y-3">
            {historico.map((o) => (
              <CartaoOrcamento
                key={o._id}
                orcamento={o}
                destaque={String(o._id) === String(aprovado?._id) ? 'aprovado' : null}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
