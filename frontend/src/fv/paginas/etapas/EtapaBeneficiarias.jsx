import { useState } from 'react'
import { useBeneficiarias } from '../../providers/BeneficiariasProvider'
import BotaoAcao from '../../componentes/BotaoAcao'
import FormNovaBeneficiaria from '../../componentes/FormNovaBeneficiaria'

/** Rótulo e cor do rateio, a partir do `status` que o servidor devolveu. */
const RATEIO = {
  ok:         { rotulo: 'Rateio completo',   classe: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  incompleto: { rotulo: 'Rateio incompleto', classe: 'border-amber-200 bg-amber-50 text-amber-800' },
  excedido:   { rotulo: 'Rateio excedido',   classe: 'border-red-200 bg-red-50 text-red-800' },
}

/**
 * EtapaBeneficiarias — agregado `UnidadeBeneficiaria` — FV-UX-015.
 *
 * Substitui a aba "Beneficiárias" do wizard. Todo o backend já existia (S8.7):
 * agregado próprio, 7 rotas e a regra de rateio compartilhada. Esta sprint só
 * trouxe a interface.
 *
 * O status do rateio é o que o servidor calculou — a tela não soma percentuais.
 */
export default function EtapaBeneficiarias() {
  const { lista, total, ativas, rateio, modalidades, acoes, carregando, erro } = useBeneficiarias()
  const [editandoId, setEditandoId] = useState(null)

  // `modalidade_gd` é persistida como id; o rótulo legível vem da própria resposta.
  const rotuloModalidade = (id) => modalidades.find((m) => m.id === id)?.label ?? id

  if (carregando) return <p className="p-6 text-sm text-slate-500">Carregando…</p>
  if (erro) return <p className="p-6 text-sm text-red-600">{erro}</p>

  const status = RATEIO[rateio?.status] ?? RATEIO.incompleto

  return (
    <section className="mx-auto max-w-3xl p-6">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Beneficiárias</h2>
        <p className="text-sm text-slate-500">
          {total} unidade(s) · {ativas} ativa(s)
        </p>
      </header>

      {rateio && (
        <div className={`mt-4 rounded border p-3 text-sm ${status.classe}`}>
          <p className="font-medium">{status.rotulo}</p>
          <p className="mt-1 text-xs">
            Soma: {rateio.soma}% · {rateio.diferenca > 0
              ? `faltam ${rateio.diferenca}%`
              : rateio.diferenca < 0
                ? `excede ${Math.abs(rateio.diferenca)}%`
                : 'fechado em 100%'}
          </p>
        </div>
      )}

      <div className="mt-4">
        <FormNovaBeneficiaria />
      </div>

      {total === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          Nenhuma unidade beneficiária cadastrada.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {lista.map((b) => (
            <li key={b._id} className={`rounded border bg-white p-4 ${
              b.ativa === false ? 'border-slate-200 opacity-60' : 'border-slate-200'}`}>
              {editandoId === b._id ? (
                <FormNovaBeneficiaria
                  beneficiaria={b}
                  aoConcluir={() => setEditandoId(null)}
                  aoCancelar={() => setEditandoId(null)}
                />
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-medium text-slate-900">{b.contaContrato}</p>
                    <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {b.tipoRateio === 'percentual' ? `${b.valor}%` : `${b.valor} kWh`}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {b.titular || 'Sem titular'}
                    {b.concessionaria ? ` · ${b.concessionaria}` : ''}
                    {b.modalidade_gd ? ` · ${rotuloModalidade(b.modalidade_gd)}` : ''}
                  </p>
                  {b.ativa === false && <p className="mt-1 text-xs text-slate-500">Inativa</p>}

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditandoId(b._id)}
                      className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Editar
                    </button>
                    <BotaoAcao
                      variante="secundario"
                      confirmar={`Remover a beneficiária ${b.contaContrato}?`}
                      onAcao={() => acoes.remover(b._id)}
                    >
                      Remover
                    </BotaoAcao>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
