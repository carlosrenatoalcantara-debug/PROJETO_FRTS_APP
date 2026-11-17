/**
 * Contas de energia anexadas ao cliente — /api/clientes/:id/contas.
 * Usa o fetch global (o interceptor de services/http.js põe a autenticação).
 */
const base = (clienteId) => `/api/clientes/${encodeURIComponent(clienteId)}/contas`

async function falha(res, padrao) {
  const corpo = await res.json().catch(() => ({}))
  return new Error(corpo.mensagem || corpo.erro || padrao)
}

export async function listarContas(clienteId) {
  const res = await fetch(base(clienteId))
  if (!res.ok) throw await falha(res, 'Erro ao listar as contas')
  const dados = await res.json()
  return Array.isArray(dados) ? dados : []
}

export async function anexarConta(clienteId, arquivo) {
  const corpo = new FormData()
  corpo.append('conta', arquivo)
  const res = await fetch(base(clienteId), { method: 'POST', body: corpo })
  if (!res.ok) throw await falha(res, 'Erro ao anexar a conta')
  return res.json()
}

export async function excluirConta(clienteId, contaId) {
  const res = await fetch(`${base(clienteId)}/${encodeURIComponent(contaId)}`, { method: 'DELETE' })
  if (!res.ok) throw await falha(res, 'Erro ao excluir a conta')
}

/** Baixa pelo fetch autenticado (link direto não leva o token) e devolve um Blob. */
export async function baixarConta(clienteId, contaId) {
  const res = await fetch(`${base(clienteId)}/${encodeURIComponent(contaId)}/arquivo`)
  if (!res.ok) throw await falha(res, 'Erro ao abrir a conta')
  return res.blob()
}

export const TIPOS_CONTA = '.pdf,.jpg,.jpeg,.png,.webp'
export const MIMETYPES_CONTA = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
