/**
 * BadgeEngenharia — P1-ENGINEERING-CONSUME-01
 *
 * Exibe o badge de origem (🟢 Extraído · 🔵 Validado · 🟡 Inferido · 🟠 Fallback) de um
 * campo, com tooltip de justificativa (origem/confiança/motivo) para valores de fallback,
 * e um botão "Corrigir Valor" DESABILITADO (apenas engenheiro/técnico/administrador).
 *
 * Puramente visual — NÃO grava nada, NÃO altera o catálogo/Atlas.
 */
import { itemPorChave, podeSubstituir } from '../../utils/engenharia/engenhariaPayload.js'
import { usePermissao } from '../../hooks/usePermissao.js'

const COR = {
  verde: 'bg-emerald-100 text-emerald-700',
  azul: 'bg-sky-100 text-sky-700',
  amarelo: 'bg-amber-100 text-amber-700',
  laranja: 'bg-orange-100 text-orange-700',
}

export default function BadgeEngenharia({ payload, chave, mostrarBotao = true }) {
  const { perfil } = usePermissao()
  const item = payload && chave ? itemPorChave(payload, chave) : null
  if (!item || !item.badge) return null
  const b = item.badge
  const tip = item.justificativa?.texto || b.descricao
  const podeCorrigir = mostrarBotao && item.substituivel && podeSubstituir(perfil)
  return (
    <span className="inline-flex items-center gap-1" title={tip} data-status={item.status}>
      <span className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap ${COR[b.cor] || 'bg-slate-100 text-slate-500'}`}>
        {b.emoji} {b.label}
      </span>
      {podeCorrigir && (
        <button
          type="button"
          disabled
          title="Correção manual — disponível em breve (não implementado)"
          className="text-[10px] px-1.5 py-0.5 rounded border border-slate-300 text-slate-400 opacity-50 cursor-not-allowed"
        >
          Corrigir Valor
        </button>
      )}
    </span>
  )
}
