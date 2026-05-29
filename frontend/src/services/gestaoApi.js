/**
 * gestaoApi.js — Sprint 7.2
 * CRUD de usuários, empresas, técnicos, vendedores + matriz RBAC.
 */
const API = ''

async function _f(path, options = {}) {
  const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.erro || `HTTP ${res.status}`)
  }
  return res.json()
}

const recurso = (nome) => ({
  listar: () => _f(`/api/gestao/${nome}`).then((d) => d.itens || []),
  criar:  (dados) => _f(`/api/gestao/${nome}`, { method: 'POST', body: JSON.stringify(dados) }),
  atualizar: (id, dados) => _f(`/api/gestao/${nome}/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
  remover: (id) => _f(`/api/gestao/${nome}/${id}`, { method: 'DELETE' }),
})

export const usuariosApi   = recurso('usuarios')
export const empresasApi   = recurso('empresas')
export const tecnicosApi   = recurso('tecnicos')
export const vendedoresApi = recurso('vendedores')

export const buscarMatrizRBAC = () => _f('/api/gestao/rbac/matriz')

/** S7.3.1: registra evento de documento na trilha de auditoria. */
export function registrarEventoPainel(acao, detalhe = null, projeto_id = null, modulo = 'documentos') {
  return _f('/api/painel/evento', { method: 'POST', body: JSON.stringify({ acao, detalhe, projeto_id, modulo }) }).catch(() => {})
}
