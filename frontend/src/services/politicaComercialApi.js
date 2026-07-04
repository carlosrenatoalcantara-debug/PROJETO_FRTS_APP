/**
 * politicaComercialApi.js — FEATURE-004.
 * Lê/grava a Política Comercial EV da EMPRESA (singleton EmpresaConfig).
 * { padrao: {política}, perfis: [{política}] }. URL relativa (proxy Vercel→Railway).
 */
const API = ''

async function _f(path, options = {}) {
  const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.mensagem || e.erro || `HTTP ${res.status}`)
  }
  return res.json()
}

/** Retorna { padrao, perfis } (ou {} se ainda não configurado). */
export async function buscarPoliticaComercialEmpresa() {
  const d = await _f('/api/empresa')
  return d?.config?.politica_comercial_ev || {}
}

/** Grava a política comercial da empresa (padrão + perfis). Não toca projetos. */
export function salvarPoliticaComercialEmpresa(politica_comercial_ev) {
  return _f('/api/empresa', { method: 'PUT', body: JSON.stringify({ politica_comercial_ev }) })
}
