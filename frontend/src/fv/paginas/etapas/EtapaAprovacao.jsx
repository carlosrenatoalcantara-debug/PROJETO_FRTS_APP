import { useOrcamentos } from '../../providers/OrcamentosProvider'
import { useContrato } from '../../providers/ContratoProvider'
import BotaoAcao from '../../componentes/BotaoAcao'

/**
 * EtapaAprovacao — FV-API-002.
 *
 * Cada marco é um FATO lido da API. As ações (emitir, aprovar, rejeitar)
 * delegam ao domínio: o servidor valida o estado, garante a unicidade do
 * aprovado e congela a Baseline. A tela não decide se a ação é permitida —
 * quando não é, o erro do domínio aparece no próprio botão.
 */
export default function EtapaAprovacao() {
  const { vigente, aprovado, estado, acoes, carregando: cO, erro: eO } = useOrcamentos()
  const { temBaseline, baselineIntegra, motivoDe, recarregar: recarregarContrato, carregando: cC, erro: eC } = useContrato()

  if (cO || cC) return <p className="p-6 text-sm text-slate-500">Carregando…</p>
  if (eO || eC) return <p className="p-6 text-sm text-red-600">{eO || eC}</p>
  if (!vigente) return <p className="p-6 text-sm text-slate-500">Nenhum orçamento para aprovar.</p>

  /** Aprovar muda também Baseline e Gate — os dois precisam recarregar. */
  const aprovar = async () => {
    await acoes.aprovar(vigente._id)
    recarregarContrato()
  }

  const passos = [
    ['Orçamento existe', true],
    ['Emitido ao cliente', ['EMITIDO', 'APROVADO'].includes(estado)],
    ['Aprovado', !!aprovado],
    ['Baseline gerada', temBaseline],
    ['Baseline íntegra', baselineIntegra === true],
  ]

  return (
    <section className="mx-auto max-w-2xl p-6">
      <h2 className="text-lg font-semibold text-slate-900">Aprovação</h2>

      <ol className="mt-4 space-y-2">
        {passos.map(([rotulo, feito]) => (
          <li key={rotulo} className="flex items-center gap-3 rounded border border-slate-200 bg-white px-4 py-2 text-sm">
            <span aria-hidden className={feito ? 'text-emerald-600' : 'text-slate-300'}>{feito ? '●' : '○'}</span>
            <span className={feito ? 'text-slate-900' : 'text-slate-500'}>{rotulo}</span>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex flex-wrap items-start gap-3">
        {estado === 'RASCUNHO' && (
          <BotaoAcao onAcao={() => acoes.emitir(vigente._id)}>Emitir ao cliente</BotaoAcao>
        )}
        {estado === 'EMITIDO' && (
          <>
            <BotaoAcao onAcao={aprovar} confirmar="Aprovar congela o orçamento e gera a Baseline. Confirmar?">
              Aprovar e congelar
            </BotaoAcao>
            <BotaoAcao
              variante="secundario"
              onAcao={() => acoes.rejeitar(vigente._id, 'Recusado pelo cliente')}
            >
              Rejeitar
            </BotaoAcao>
          </>
        )}
        {estado === 'APROVADO' && (
          <p className="text-sm text-emerald-700">
            Contrato fechado — o projeto está congelado.
          </p>
        )}
      </div>

      {motivoDe('engenharia') && (
        <p className="mt-4 text-xs text-slate-500">
          Gate: <code className="font-mono">{motivoDe('engenharia')}</code>
        </p>
      )}
    </section>
  )
}
