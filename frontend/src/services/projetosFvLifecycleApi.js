/**
 * projetosFvLifecycleApi.js — Sprint 8.4.1
 * Wrappers leves dos endpoints S8.4 (duplicar / arquivar / restaurar / excluir).
 * Não cria estado; apenas chama o backend e devolve o payload normalizado.
 */
async function _f(path, options = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.erro || e.mensagem || `HTTP ${res.status}`)
  }
  // DELETE pode devolver 204 sem corpo
  if (res.status === 204) return { sucesso: true }
  return res.json()
}

export function duplicarProjeto(id) {
  return _f(`/api/projetos-fv/${id}/duplicar`, { method: 'POST', body: JSON.stringify({}) })
}

// P1-UX-FRONT-CONNECT-01 (FASE 2) — Ampliação de Usina (clona + congela arranjo existente)
export function ampliarProjeto(id) {
  return _f(`/api/projetos-fv/${id}/ampliar`, { method: 'POST', body: JSON.stringify({}) })
}

export function arquivarProjeto(id, motivo, usuario = null) {
  return _f(`/api/projetos-fv/${id}/arquivar`, { method: 'POST', body: JSON.stringify({ motivo, usuario }) })
}

export function restaurarProjeto(id) {
  return _f(`/api/projetos-fv/${id}/restaurar`, { method: 'POST', body: JSON.stringify({}) })
}

export function excluirProjeto(id, { definitivo = false } = {}) {
  const q = definitivo ? '?definitivo=1' : ''
  return _f(`/api/projetos-fv/${id}${q}`, { method: 'DELETE' })
}

// Lista com filtros (lixeira/arquivados)
export function listarProjetos({ incluirExcluidos = false } = {}) {
  const q = incluirExcluidos ? '?incluir_excluidos=1' : ''
  return _f(`/api/projetos-fv${q}`)
}

// Motivos válidos para o modal de arquivamento (espelha o backend)
export const MOTIVOS_ARQUIVAMENTO = ['Cliente desistiu', 'Duplicado', 'Teste', 'Perdeu venda', 'Outro']
