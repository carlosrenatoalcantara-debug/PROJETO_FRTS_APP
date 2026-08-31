/**
 * composicao.js — composição de equipamentos da opção — FV-UX-029.
 *
 * Converte entre o que o operador edita (uma lista de itens com quantidade) e
 * `ProjetoFV.arranjos[]`, que a FV-UX-029 elegeu como composição canônica.
 *
 * ── Por que `arranjos[]` e não `equipamentos` ────────────────────────────────
 * `equipamentos.paineis[]` já é array com `quantidade`, mas `equipamentos.
 * inversor` é um objeto ÚNICO e sem quantidade. `arranjos[]` é o único lugar do
 * schema que modela `paineis[]` E `inversores[]`, ambos com quantidade — que é
 * exatamente a composição pedida. Nada foi criado: o array, a etapa de escrita
 * (`PUT /:id/etapa` com `etapa: 'arranjos'`) e o normalizador
 * (`arranjosService.normalizarArranjos`) já existiam.
 *
 * ── A projeção de compatibilidade ────────────────────────────────────────────
 * Oito leitores fora do fluxo canônico ainda leem `equipamentos.paineis[0]` e
 * `equipamentos.inversor` — parecer de acesso, homologação, alertcenter, e as
 * três telas da nova UX (Dimensionamento, MPPT, Unifilar). Enquanto eles não
 * migrarem, `equipamentos` continua sendo escrito, mas DERIVADO da composição
 * por `projecaoLegado()` — nunca editado por conta própria.
 *
 * É a mesma relação que `arranjosService` já mantinha na direção inversa
 * (deriva `arranjos` do legado quando `arranjos` está vazio): uma fonte, uma
 * projeção. A direção é que se inverteu.
 *
 * Puro: sem React, sem I/O.
 */

/** Inteiro > 0 ou `null`. Campo vazio é ausência; `0` não é quantidade válida. */
export function quantidade(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

/**
 * Soma de quantidades de uma lista de itens.
 * Item sem quantidade simplesmente não entra na soma — não vira zero somado.
 */
const somar = (itens) => (itens ?? [])
  .map((i) => quantidade(i?.quantidade))
  .filter((q) => q !== null)
  .reduce((s, q) => s + q, 0)

/** Total de módulos da composição. */
export function totalModulos(composicao) {
  return somar(composicao?.paineis)
}

/** Total de inversores da composição. */
export function totalInversores(composicao) {
  return somar(composicao?.inversores)
}

/**
 * Potência CC da composição (kWp). É soma de dados do catálogo, não estimativa:
 * `Σ quantidade × potencia_w / 1000`. Item sem potência declarada não entra e é
 * reportado por `lacunasDaComposicao`.
 */
export function potenciaCcKwp(composicao) {
  const total = (composicao?.paineis ?? []).reduce((s, p) => {
    const q = quantidade(p?.quantidade)
    const w = Number(p?.potencia_w)
    return s + (q !== null && Number.isFinite(w) ? q * w : 0)
  }, 0)
  return total === 0 ? null : +(total / 1000).toFixed(3)
}

/** Potência CA instalada (kW): `Σ quantidade × potencia_kw`. */
export function potenciaCaKw(composicao) {
  const total = (composicao?.inversores ?? []).reduce((s, i) => {
    const q = quantidade(i?.quantidade)
    const p = Number(i?.potencia_kw)
    return s + (q !== null && Number.isFinite(p) ? q * p : 0)
  }, 0)
  return total === 0 ? null : +total.toFixed(3)
}

/** Itens cujo catálogo não declarou a potência — viram lacuna, não zero. */
export function lacunasDaComposicao(composicao) {
  const faltando = []
  for (const p of composicao?.paineis ?? []) {
    if (p?.potencia_w === null || p?.potencia_w === undefined) {
      faltando.push(`módulo ${p?.modelo ?? '—'}: potência não declarada`)
    }
  }
  for (const i of composicao?.inversores ?? []) {
    if (i?.potencia_kw === null || i?.potencia_kw === undefined) {
      faltando.push(`inversor ${i?.modelo ?? '—'}: potência não declarada`)
    }
  }
  return faltando
}

/**
 * Coerência com o dimensionamento — objetivo 9.
 *
 * NÃO decide quem manda: apenas compara e devolve a diferença. O dimensionamento
 * continua sendo a fonte de `num_paineis` (FV-UX-020); a composição é o que foi
 * efetivamente escolhido. Divergência é informação para o operador, não erro.
 */
export function coerenciaComDimensionamento(composicao, numPaineisDimensionamento) {
  const naComposicao = totalModulos(composicao)
  const previsto = quantidade(numPaineisDimensionamento)
  if (previsto === null) return { previsto: null, naComposicao, diferenca: null }
  return { previsto, naComposicao, diferenca: naComposicao - previsto }
}

/** A composição tem mais de um modelo de módulo? Decide o que a engenharia consegue fazer. */
export function multiModelo(composicao) {
  return (composicao?.paineis ?? []).length > 1
}

/** A composição tem mais de um modelo de inversor? */
export function multiInversor(composicao) {
  return (composicao?.inversores ?? []).length > 1
}

// ─── Conversão ⇄ `arranjos[]` ────────────────────────────────────────────────

/** Rótulo e tipo do arranjo que a nova UX edita. Um por opção. */
export const ARRANJO_PRINCIPAL = Object.freeze({ id: 'principal', rotulo: 'Arranjo principal', tipo: 'principal' })

/**
 * Composição → `arranjos[]` (o que `etapa: 'arranjos'` persiste).
 * Preserva os campos do arranjo que esta tela não edita (fornecedor, orçamento
 * do distribuidor, somente_leitura), quando já existirem.
 */
export function paraArranjos(composicao, arranjoExistente = null) {
  return [{
    ...(arranjoExistente ?? {}),
    id: arranjoExistente?.id ?? ARRANJO_PRINCIPAL.id,
    rotulo: arranjoExistente?.rotulo ?? ARRANJO_PRINCIPAL.rotulo,
    tipo: arranjoExistente?.tipo ?? ARRANJO_PRINCIPAL.tipo,
    paineis: (composicao?.paineis ?? []).map((p) => ({
      id: p.id, marca: p.marca, modelo: p.modelo,
      potencia_w: p.potencia_w, quantidade: quantidade(p.quantidade),
      equipamento_id: p.equipamento_id,
    })),
    inversores: (composicao?.inversores ?? []).map((i) => ({
      id: i.id, marca: i.marca, modelo: i.modelo,
      potencia_kw: i.potencia_kw, tipo: i.tipo, fases: i.fases,
      quantidade: quantidade(i.quantidade),
      equipamento_id: i.equipamento_id,
    })),
  }]
}

/** `arranjos[]` → composição editável. Lê o arranjo principal. */
export function daArranjos(arranjos) {
  const a = (arranjos ?? []).find((x) => x?.tipo === 'principal') ?? (arranjos ?? [])[0] ?? null
  if (!a) return null
  return {
    paineis: (a.paineis ?? []).map((p) => ({ ...p, quantidade: p.quantidade ?? null })),
    inversores: (a.inversores ?? []).map((i) => ({ ...i, quantidade: i.quantidade ?? null })),
  }
}

/**
 * Composição → `equipamentos` legado (PROJEÇÃO, não fonte).
 *
 * Os leitores fora do fluxo canônico esperam um módulo e um inversor. A projeção
 * entrega o PRIMEIRO de cada, que é o que eles sempre receberam. Com composição
 * de um modelo só — o caso corrente — é exata.
 *
 * `estrutura` é preservada: esta tela não a edita (FV-UX-030).
 */
export function projecaoLegado(composicao, equipamentosExistentes = null) {
  const p = (composicao?.paineis ?? [])[0] ?? null
  const i = (composicao?.inversores ?? [])[0] ?? null
  return {
    ...(equipamentosExistentes ?? {}),
    paineis: p
      ? [{
          id: p.id, marca: p.marca, modelo: p.modelo, potencia_w: p.potencia_w,
          // O legado espera a quantidade TOTAL de módulos do sistema, não a do
          // item — é assim que `ProjetosFV.jsx` e o parecer a leem.
          quantidade: totalModulos(composicao) || null,
          equipamento_id: p.equipamento_id,
        }]
      : [],
    // `equipamentos.inversor` NÃO tem campo `quantidade` no schema — o
    // strict-mode do Mongoose descartaria a escrita em silêncio, que é
    // exatamente o defeito que a FV-UX-018 encontrou com `localizacao.estado`.
    // A quantidade vive em `arranjos[].inversores[].quantidade`, que é a fonte.
    inversor: i
      ? {
          id: i.id, marca: i.marca, modelo: i.modelo, potencia_kw: i.potencia_kw,
          tipo: i.tipo, fases: i.fases, equipamento_id: i.equipamento_id,
        }
      : {},
  }
}
