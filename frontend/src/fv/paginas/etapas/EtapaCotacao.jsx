import { useState } from 'react'
import { useCotacoes } from '../../providers/CotacoesProvider'
import FormNovaCotacao from '../../componentes/FormNovaCotacao'

/**
 * EtapaCotacao — agregado `Cotacao` — FV-UX-011.
 *
 * Listagem, seleção e visualização. Somente leitura: criar/editar cotação são
 * ações de escrita, e a API canônica desta fase expõe apenas leitura.
 *
 * A seleção é estado LOCAL de tela (qual cotação o usuário está olhando) — não
 * é estado de domínio e por isso não vive em provider.
 */
export default function EtapaCotacao() {
  const { lista, total, refOrigem, carregando, erro } = useCotacoes()
  const [selecionadaId, setSelecionadaId] = useState(null)

  if (carregando) return <p className="p-6 text-sm text-slate-500">Carregando…</p>
  if (erro) return <p className="p-6 text-sm text-red-600">{erro}</p>

  const selecionada = lista.find((c) => String(c._id) === String(selecionadaId))
    ?? lista.find((c) => String(c._id) === String(refOrigem))
    ?? lista[0]
    ?? null

  return (
    <section className="mx-auto max-w-4xl p-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Cotações</h2>
          <p className="text-sm text-slate-500">{total} simulação(ões) técnica(s)</p>
        </div>
        {/* FV-UX-012: criar cotação. N por projeto — o domínio não limita. */}
        <FormNovaCotacao aoCriar={(id) => id && setSelecionadaId(id)} />
      </header>

      {total === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          Nenhuma cotação registrada. Crie a primeira para iniciar o fluxo comercial.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-[18rem_1fr]">
          <ul className="space-y-2">
            {lista.map((c) => {
              const ativa = String(c._id) === String(selecionada?._id)
              const origem = String(c._id) === String(refOrigem)
              return (
                <li key={c._id}>
                  <button
                    type="button"
                    onClick={() => setSelecionadaId(c._id)}
                    aria-pressed={ativa}
                    className={`w-full rounded border px-3 py-2 text-left text-sm transition ${
                      ativa ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <span className="block truncate font-medium">{c.rotulo || 'Sem rótulo'}</span>
                    <span className={`text-xs ${ativa ? 'text-slate-300' : 'text-slate-500'}`}>
                      {c.tecnologia}{origem ? ' · originou o orçamento' : ''}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {selecionada && <DetalheCotacao cotacao={selecionada} ehOrigem={String(selecionada._id) === String(refOrigem)} />}
        </div>
      )}
    </section>
  )
}

/** Visualização da cotação selecionada. Premissas + composição, como vieram do agregado. */
function DetalheCotacao({ cotacao, ehOrigem }) {
  const p = cotacao.premissas ?? {}
  const premissas = [
    ['Consumo', p.consumo_kwh_mes != null ? `${p.consumo_kwh_mes} kWh/mês` : null],
    ['Tarifa', p.tarifa_kwh != null ? `R$ ${p.tarifa_kwh}/kWh` : null],
    ['HSP', p.hsp_kwh_m2_dia != null ? `${p.hsp_kwh_m2_dia} kWh/m²·dia` : null],
    ['Performance ratio', p.performance_ratio != null ? String(p.performance_ratio) : null],
    ['Área disponível', p.area_disponivel_m2 != null ? `${p.area_disponivel_m2} m²` : null],
  ].filter(([, v]) => v)

  return (
    <article className="rounded border border-slate-200 bg-white p-4">
      <header className="flex items-baseline justify-between">
        <h3 className="font-medium text-slate-900">{cotacao.rotulo || 'Sem rótulo'}</h3>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
          {cotacao.tecnologia}
        </span>
      </header>
      {ehOrigem && <p className="mt-1 text-xs text-emerald-700">Originou o orçamento vigente</p>}

      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Premissas</h4>
      {premissas.length === 0 ? (
        <p className="mt-1 text-sm text-slate-500">Sem premissas registradas.</p>
      ) : (
        <dl className="mt-1 space-y-1 text-sm">
          {premissas.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-40 shrink-0 text-slate-500">{k}</dt>
              <dd className="text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Composição ({cotacao.composicao?.length ?? 0})
      </h4>
      {(cotacao.composicao?.length ?? 0) === 0 ? (
        <p className="mt-1 text-sm text-slate-500">Sem composição registrada.</p>
      ) : (
        <ul className="mt-1 space-y-1 text-sm">
          {cotacao.composicao.map((i, n) => (
            <li key={n} className="flex justify-between gap-2">
              <span className="text-slate-700">{i.papel || 'Equipamento'}</span>
              <span className="text-slate-900">{i.quantidade}×</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-slate-400">
        Criada em {new Date(cotacao.createdAt).toLocaleString('pt-BR')}
        {cotacao.criado_por ? ` por ${cotacao.criado_por}` : ''}
      </p>
    </article>
  )
}
