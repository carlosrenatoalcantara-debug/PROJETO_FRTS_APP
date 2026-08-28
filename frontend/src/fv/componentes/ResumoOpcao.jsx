import { useProjeto } from '../providers/ProjetoProvider'
import { daArranjos } from '../composicao'
import { daEquipamentos, resumoDaOpcao } from '../estrutura'

/**
 * ResumoOpcao — uma linha que identifica a opção em edição — FV-UX-030.
 *
 *   Opção 01 · String · Znshine 650 W · Sungrow SG15RT · Estrutura: Fibrocimento
 *
 * Todos os segmentos vêm de fatos já persistidos no `ProjetoFV`; segmento sem
 * fato é omitido. Não deriva, não calcula, não estima — `resumoDaOpcao()` é uma
 * função pura de formatação.
 *
 * `estrutura` pode ser passada por fora para que a tela de Estrutura mostre o
 * resumo com o rascunho ainda não salvo.
 */
export default function ResumoOpcao({ estrutura = null, className = '' }) {
  const { projeto } = useProjeto()
  if (!projeto) return null

  const dosArranjos = daArranjos(projeto.arranjos)
  const eq = projeto.equipamentos ?? {}
  const inv = eq.inversor
  const composicao = dosArranjos && (dosArranjos.paineis.length || dosArranjos.inversores.length)
    ? dosArranjos
    : { paineis: eq.paineis ?? [], inversores: inv && (inv.marca || inv.modelo) ? [inv] : [] }

  return (
    <p
      data-testid="resumo-opcao"
      className={`rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 ${className}`}
    >
      {resumoDaOpcao({ composicao, estrutura: estrutura ?? daEquipamentos(eq) })}
    </p>
  )
}
