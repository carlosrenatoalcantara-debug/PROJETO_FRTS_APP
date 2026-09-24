import { NavLink } from 'react-router-dom'
import { ETAPAS_FLUXO, GRUPOS_FLUXO, etapasRaizDoGrupo, subEtapasDe, progressoDosGrupos } from '../fluxo'

/**
 * Um item de navegação. Extraído para que etapa e sub-etapa compartilhem
 * exatamente o mesmo comportamento — inclusive o bloqueio por agregado ausente.
 */
function ItemEtapa({ etapa, projetoId, miuda = false }) {
  const indisponivel = etapa.agregado == null
  return (
    <NavLink
      to={`/fv/projetos/${projetoId}/${etapa.chave}`}
      aria-disabled={indisponivel}
      title={indisponivel ? 'Agregado ainda não implementado no domínio' : etapa.rotulo}
      className={({ isActive }) => [
        'rounded px-2 py-1 transition',
        miuda ? 'text-xs' : 'text-sm',
        indisponivel ? 'cursor-not-allowed text-slate-300' : 'text-slate-700 hover:bg-slate-100',
        isActive && !indisponivel ? 'bg-slate-900 text-white hover:bg-slate-900' : '',
      ].join(' ')}
      onClick={(ev) => { if (indisponivel) ev.preventDefault() }}
    >
      {etapa.rotulo}
      {etapa.paralela && <span className="ml-1 text-[10px] text-slate-400">∥</span>}
    </NavLink>
  )
}
import { useOrcamentos } from '../providers/OrcamentosProvider'
import { useContrato } from '../providers/ContratoProvider'

/**
 * FluxoNav — navegação do fluxo canônico — FV-UX-010.
 *
 * Diferente do `Stepper` do wizard antigo: não há numeração nem "próximo passo".
 * O fluxo canônico não é linear (Engenharia ∥ Homologação) e as etapas não são
 * passos de formulário — são estados do projeto.
 *
 * Etapas cujo agregado ainda não existe aparecem, mas desabilitadas: esconder
 * daria a impressão de que o fluxo termina no Gate.
 */
export default function FluxoNav({ projetoId }) {
  const { temOrcamento, aprovado } = useOrcamentos()
  // FV-UX-011: a liberação vem POR FASE, direto da API. Nada é recalculado aqui.
  const { liberadaPara } = useContrato()
  const grupos = progressoDosGrupos({
    temOrcamento,
    orcamentoAprovado: !!aprovado,
    // O grupo "execução" é alcançável quando o Gate liberou a bifurcação.
    execucaoLiberada: liberadaPara('engenharia') === true,
  })

  return (
    <nav aria-label="Fluxo do projeto" className="border-b border-slate-200 bg-white">
      <ol className="flex flex-wrap gap-x-6 gap-y-2 px-4 py-3">
        {grupos.map((g) => (
          <li key={g.chave} className="min-w-[9rem]">
            <p className={`text-xs font-semibold uppercase tracking-wide ${
              g.alcancado ? 'text-emerald-700' : 'text-slate-400'}`}>
              {g.rotulo}
            </p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {etapasRaizDoGrupo(g.chave).map((e) => {
                const subs = subEtapasDe(e.chave)
                return (
                  <li key={e.chave}>
                    <ItemEtapa etapa={e} projetoId={projetoId} />
                    {/* Sub-etapas de Equipamentos: mesma rota de sempre, apenas
                        aninhadas sob o pai — configuração da composição, não
                        etapa independente do fluxo. */}
                    {subs.length > 0 && (
                      <ul className="ml-3 mt-1 flex flex-wrap gap-1 border-l border-slate-200 pl-2">
                        {subs.map((s) => (
                          <li key={s.chave}>
                            <ItemEtapa etapa={s} projetoId={projetoId} miuda />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ol>
      <p className="px-4 pb-2 text-[11px] text-slate-400">
        {ETAPAS_FLUXO.filter((e) => e.agregado == null).length} etapas aguardam agregados do domínio ·
        ∥ = fases paralelas
      </p>
    </nav>
  )
}
