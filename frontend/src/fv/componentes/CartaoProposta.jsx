import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarOpcoes } from '../api/agregadosFvApi'
import { rotuloDaOpcao, rotuloDoGate, situacaoDaOpcao } from '../propostas'

/**
 * CartaoProposta — uma proposta e as suas opções — FV-UX-033.
 *
 * ── De onde vem cada coisa ───────────────────────────────────────────────────
 * O agrupamento sai da própria listagem (`proposta_grupo_id`), sem requisição
 * extra. Orçamento, Baseline e Gate de cada opção vêm de `GET /:id/opcoes`, o
 * leitor canônico do grupo — uma chamada por proposta, não por projeto. Até ela
 * chegar, os três aparecem como "—": não saber é diferente de não haver.
 *
 * Nada é decidido aqui. O Gate exibido é a MESMA decisão que bloqueia no
 * domínio, com o motivo que ele devolveu.
 */

const TOM = {
  ok: 'bg-emerald-100 text-emerald-800',
  bloqueado: 'bg-amber-100 text-amber-800',
  neutro: 'bg-slate-100 text-slate-600',
}

const TOPOLOGIA = { micro: 'Microinversor', string: 'String', hibrido: 'Híbrido', otimizador: 'Otimizador' }

function Campo({ rotulo, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-slate-400">{rotulo}</dt>
      <dd className="truncate text-xs text-slate-700">{children}</dd>
    </div>
  )
}

export default function CartaoProposta({ proposta }) {
  const [detalhe, setDetalhe] = useState(null)
  const [erro, setErro] = useState(null)

  // Uma chamada por proposta, a partir de qualquer irmã — todas enxergam o grupo.
  const primeira = proposta.opcoes[0]?._id
  useEffect(() => {
    let vivo = true
    if (!primeira) return undefined
    listarOpcoes(primeira)
      .then((r) => vivo && setDetalhe(r))
      .catch((e) => vivo && setErro(e.message))
    return () => { vivo = false }
  }, [primeira])

  const detalheDe = (id) =>
    (detalhe?.opcoes ?? []).find((o) => String(o._id) === String(id)) ?? null

  return (
    <li className="rounded border border-slate-300 bg-white">
      <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            Proposta — {proposta.cliente || 'Sem cliente'}
          </p>
          <p className="text-xs text-slate-500">
            {proposta.total} opção(ões)
            {proposta.aceita
              ? ` · aceita: ${rotuloDaOpcao(proposta.aceita)}`
              : ' · nenhuma aceita ainda'}
          </p>
        </div>
        {proposta.aceita && (
          <span className="shrink-0 rounded bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
            aceita
          </span>
        )}
      </div>

      {erro && (
        <p role="alert" className="px-4 py-2 text-xs text-red-600">
          Situação das opções indisponível: {erro}
        </p>
      )}

      <ul className="divide-y divide-slate-100">
        {proposta.opcoes.map((o) => {
          const s = situacaoDaOpcao(o, detalheDe(o._id))
          const gate = rotuloDoGate(s.gate)
          // Item 9: só a aceita é destacada como escolhida.
          const naoEscolhida = proposta.aceita && !s.escolhida
          return (
            <li key={o._id} className={s.escolhida ? 'bg-emerald-50' : undefined}>
              {/* Item 10: entrar direto na opção, no fluxo canônico. */}
              <Link to={`/fv/projetos/${o._id}`} className="block px-4 py-3 hover:bg-slate-50">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {rotuloDaOpcao(o)}
                    {s.topologia && (
                      <span className="ml-2 font-normal text-slate-500">
                        · {TOPOLOGIA[s.topologia] ?? s.topologia}
                      </span>
                    )}
                  </p>
                  {s.escolhida && (
                    <span className="shrink-0 rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-medium text-white">
                      escolhida
                    </span>
                  )}
                  {naoEscolhida && (
                    <span className="shrink-0 rounded bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      não escolhida
                    </span>
                  )}
                </div>

                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
                  <Campo rotulo="Equipamentos">{s.inversor ?? '—'}</Campo>
                  <Campo rotulo="Engenharia">
                    {s.potencia_kwp ? `${s.potencia_kwp} kWp` : '—'}
                    {s.estrutura ? ` · ${s.estrutura}` : ''}
                  </Campo>
                  <Campo rotulo="Orçamento">
                    {s.orcamento === undefined ? '—' : (s.orcamento ?? 'sem orçamento')}
                  </Campo>
                  <Campo rotulo="Baseline">
                    {s.baseline === undefined ? '—' : (s.baseline ? 'congelada' : 'sem baseline')}
                  </Campo>
                  <div className="min-w-0">
                    <dt className="text-[10px] uppercase tracking-wide text-slate-400">Gate</dt>
                    <dd>
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] ${TOM[gate.tom]}`}>
                        {gate.texto}
                      </span>
                    </dd>
                  </div>
                </dl>
              </Link>
            </li>
          )
        })}
      </ul>
    </li>
  )
}
