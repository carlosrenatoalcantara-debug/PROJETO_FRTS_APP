/**
 * gestaoDelta.js — Sprint 8.3.1
 * Helpers PUROS (sem dependências) para a gestão corporativa:
 *  - calcularDelta: produz auditoria inteligente { campo: { antes, depois } }
 *  - filtroEmailUnico: monta o filtro Mongo que NÃO bloqueia o próprio usuário
 *  - apenasAtivos: filtra entidades ativas (integridade histórica nos seletores)
 * Mantidos isolados para teste unitário (vitest) sem subir mongoose.
 */

/** Compara `antes` (doc atual) com `mudancas` e devolve só o que mudou. */
export function calcularDelta(antes, mudancas) {
  const delta = {}
  for (const [k, v] of Object.entries(mudancas || {})) {
    const a = antes?.[k]
    const aStr = a && typeof a === 'object' ? JSON.stringify(a) : a
    const vStr = v && typeof v === 'object' ? JSON.stringify(v) : v
    if (String(aStr ?? '') !== String(vStr ?? '')) delta[k] = { antes: a ?? null, depois: v }
  }
  return delta
}

/**
 * Filtro de e-mail único que exclui o próprio registro.
 * Regra (spec): email igual E _id diferente → { email, _id: { $ne: usuarioAtual } }.
 */
export function filtroEmailUnico(email, idAtual) {
  return { email: String(email ?? '').toLowerCase(), _id: { $ne: idAtual } }
}

/** Integridade histórica: seletores de novo projeto só veem entidades ativas. */
export function apenasAtivos(lista) {
  return (lista || []).filter((x) => x && x.ativo !== false)
}
