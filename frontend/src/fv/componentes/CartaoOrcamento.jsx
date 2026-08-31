import BotaoAcao from './BotaoAcao'

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Cartão de um orçamento — FV-UX-012.
 *
 * As ações são OFERECIDAS conforme o estado, mas quem decide se são permitidas é
 * o servidor: a máquina de estados vive no `OrcamentoService`. Ocultar um botão
 * é conveniência de interface; se o usuário forçar, o domínio recusa com 422.
 */
export default function CartaoOrcamento({ orcamento: o, destaque = null, acoes = null }) {
  const cor = destaque === 'vigente' ? 'border-slate-900'
    : destaque === 'aprovado' ? 'border-emerald-300'
    : 'border-slate-200'

  return (
    <article className={`rounded border bg-white p-4 ${cor}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-medium text-slate-900">{o.numero || 'Sem número'} · v{o.versao}</p>
        <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
          {o.estado}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {o.itens?.length ?? 0} itens · {MOEDA.format(o.totais?.total_venda_r ?? 0)}
      </p>
      {o.motivo_encerramento && (
        <p className="mt-1 text-xs text-slate-500">Motivo: {o.motivo_encerramento}</p>
      )}
      {destaque === 'aprovado' && (
        <p className="mt-2 text-xs text-emerald-700">Aprovado — originou a Baseline</p>
      )}
      <p className="mt-2 text-xs text-slate-400">
        Criado em {new Date(o.createdAt).toLocaleDateString('pt-BR')}
        {o.aprovado_em ? ` · aprovado em ${new Date(o.aprovado_em).toLocaleDateString('pt-BR')}` : ''}
      </p>

      {acoes && (
        <div className="mt-3 flex flex-wrap gap-2">
          {o.estado === 'RASCUNHO' && (
            <BotaoAcao onAcao={() => acoes.emitir(o._id)}>Emitir</BotaoAcao>
          )}
          {['RASCUNHO', 'EMITIDO'].includes(o.estado) && (
            <BotaoAcao
              variante="secundario"
              confirmar="Cancelar este orçamento? Ele permanece no histórico."
              onAcao={() => acoes.cancelar(o._id, 'Cancelado pela empresa')}
            >
              Cancelar
            </BotaoAcao>
          )}
        </div>
      )}
    </article>
  )
}
