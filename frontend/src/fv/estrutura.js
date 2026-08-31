/**
 * estrutura.js — estrutura de fixação da opção — FV-UX-030 / FV-DOM-039.
 *
 * ── A regra não mora mais aqui ───────────────────────────────────────────────
 * Ela vive em `@fortesolar/fv-shared/estrutura`, o SSOT. Este arquivo reexporta
 * o que a tela consome e mantém apenas o que É de tela: `resumoDaOpcao`, que
 * depende de `TECNOLOGIAS_INVERSOR` do catálogo do frontend.
 *
 * A regra nasceu neste arquivo (FV-UX-030). A FV-UX-037 mediu que a API a
 * ignorava — valia só para quem passasse pela interface —, a FV-UX-038 fechou o
 * buraco com uma segunda cópia no backend, e a FV-DOM-039 unificou as duas.
 * Nenhum comportamento mudou: o SSOT é a união exata das duas cópias.
 *
 * ── O que esta etapa NÃO faz ─────────────────────────────────────────────────
 * Não escolhe material, não conta ganchos, não precifica, não valida telhado.
 * O wizard legado associa preço/painel à estrutura; aqui não há preço algum —
 * catálogo de estruturas e custo ficaram FORA do escopo por decisão da sprint.
 *
 * Puro: sem React, sem I/O.
 */
import { TECNOLOGIAS_INVERSOR } from './catalogo'
import { rotuloDaEstrutura } from '@fortesolar/fv-shared/estrutura'

export {
  TIPOS_ESTRUTURA,
  TIPO_OUTRO,
  estruturaVazia,
  daEquipamentos,
  tipoForaDaLista,
  rotuloDaEstrutura,
  exigeDescricao,
  validarEstrutura,
  paraEquipamentos,
} from '@fortesolar/fv-shared/estrutura'

const texto = (v) => (typeof v === 'string' ? v.trim() : '')

// ─── Resumo da opção ─────────────────────────────────────────────────────────

/**
 * Uma linha que identifica a opção em edição:
 *
 *   Opção 01 · String · Znshine 650 W · Sungrow SG15RT · Estrutura: Fibrocimento
 *
 * Cada segmento vem de um fato já persistido. Segmento sem fato é OMITIDO —
 * nada é preenchido com valor plausível. "Opção 01" é rótulo fixo porque hoje
 * um `ProjetoFV` É uma opção; opções concorrentes são a FV-DOM-032, ainda não
 * decidida.
 */
export function resumoDaOpcao({ composicao = null, estrutura = null, numero = 1 } = {}) {
  /** Rótulos de tecnologia: derivados de `TECNOLOGIAS_INVERSOR`, não redigitados. */
  const TIPOS_TECNOLOGIA = Object.fromEntries(TECNOLOGIAS_INVERSOR)

  const partes = [`Opção ${String(numero).padStart(2, '0')}`]

  const inv = (composicao?.inversores ?? [])[0] ?? null
  const tecnologia = TIPOS_TECNOLOGIA[texto(inv?.tipo)] ?? null
  if (tecnologia) partes.push(tecnologia)

  const mod = (composicao?.paineis ?? [])[0] ?? null
  if (mod) {
    const w = Number(mod.potencia_w)
    partes.push([mod.marca, mod.modelo, Number.isFinite(w) ? `${w} W` : null]
      .filter(Boolean).join(' ') || '—')
  }
  if (inv) {
    partes.push([inv.marca, inv.modelo].filter(Boolean).join(' ') || '—')
  }

  const rotulo = rotuloDaEstrutura(estrutura?.tipo)
  if (rotulo) partes.push(`Estrutura: ${estrutura.tipo}`)

  return partes.join(' · ')
}
