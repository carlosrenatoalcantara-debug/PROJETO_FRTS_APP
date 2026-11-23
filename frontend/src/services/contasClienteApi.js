/**
 * Contas de energia do cliente — /api/clientes/:id/contas.
 *
 * A conta é guardada como DADOS (o que ela diz), nunca como arquivo: o PDF/imagem
 * só passa pela leitura e é descartado. Dela saem dois arquivos para baixar — JSON
 * e Markdown. Usa o fetch global (o interceptor de services/http.js põe a
 * autenticação).
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

/**
 * Lê a conta (PDF/imagem) e devolve os dados extraídos — o arquivo NÃO sobe para
 * ser guardado, só para ser lido.
 */
export async function lerDadosDaConta(arquivo) {
  const corpo = new FormData()
  corpo.append('fatura', arquivo)
  const res = await fetch('/api/fatura/extrair', { method: 'POST', body: corpo })
  if (!res.ok) throw await falha(res, 'Erro ao ler a conta')
  return res.json()
}

/** Guarda os dados lidos da conta (corpo devolvido por /api/fatura/extrair). */
export async function anexarConta(clienteId, dados) {
  const res = await fetch(base(clienteId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dados }),
  })
  if (!res.ok) throw await falha(res, 'Erro ao guardar a conta')
  return res.json()
}

export async function excluirConta(clienteId, contaId) {
  const res = await fetch(`${base(clienteId)}/${encodeURIComponent(contaId)}`, { method: 'DELETE' })
  if (!res.ok) throw await falha(res, 'Erro ao excluir a conta')
}

/** Contas ANTIGAS (com arquivo): baixa pelo fetch autenticado e devolve um Blob. */
export async function baixarConta(clienteId, contaId) {
  const res = await fetch(`${base(clienteId)}/${encodeURIComponent(contaId)}/arquivo`)
  if (!res.ok) throw await falha(res, 'Erro ao abrir a conta')
  return res.blob()
}

/** `formato`: 'json' | 'md'. Devolve o Blob do arquivo gerado dos dados guardados. */
export async function baixarDadosConta(clienteId, contaId, formato) {
  const res = await fetch(`${base(clienteId)}/${encodeURIComponent(contaId)}/dados.${formato}`)
  if (!res.ok) throw await falha(res, 'Erro ao gerar o arquivo da conta')
  return res.blob()
}

export const TIPOS_CONTA = '.pdf,.jpg,.jpeg,.png,.webp'
export const MIMETYPES_CONTA = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
