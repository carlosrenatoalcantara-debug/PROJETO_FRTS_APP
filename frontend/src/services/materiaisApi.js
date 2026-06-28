/**
 * materiaisApi.js — P0-CATALOGO-MESTRE-MATERIAIS (Fase 1)
 * Camada de serviço do Catálogo Mestre de Materiais. URL relativa (proxy Vercel→Railway).
 */
const API = ''

async function _f(path, options = {}) {
  const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    const detalhe = Array.isArray(e.erros) ? e.erros.join('; ') : (e.erro || '')
    throw new Error([e.mensagem, detalhe].filter(Boolean).join(' — ') || `HTTP ${res.status}`)
  }
  return res.json()
}

/** Lista paginada. filtros: { page, limit, categoria, classe, status, q } */
export function listarMateriais(filtros = {}) {
  const qs = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => v !== '' && v != null),
  ).toString()
  return _f(`/api/materiais${qs ? `?${qs}` : ''}`)
}

export const buscarMaterial   = (id)        => _f(`/api/materiais/${id}`)
export const criarMaterial    = (dados)     => _f('/api/materiais', { method: 'POST', body: JSON.stringify(dados) })
export const atualizarMaterial = (id, dados) => _f(`/api/materiais/${id}`, { method: 'PUT', body: JSON.stringify(dados) })
export const alterarStatusMaterial = (id, status) =>
  _f(`/api/materiais/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
export const registrarCompra  = (id, compra) =>
  _f(`/api/materiais/${id}/compras`, { method: 'POST', body: JSON.stringify(compra) })

// Templates de Categoria (form dinâmico)
export const listarTemplates = () => _f('/api/categorias-material').then((d) => d.itens || [])
export const buscarTemplate  = (chave) => _f(`/api/categorias-material/${chave}`)
