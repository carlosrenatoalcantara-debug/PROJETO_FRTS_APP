/**
 * Regras puras da conta de energia anexada ao cliente. Sem I/O.
 */
export const TAMANHO_MAXIMO_CONTA = 10 * 1024 * 1024 // 10 MB

export const MIMETYPES_CONTA = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

/**
 * Valida o arquivo recebido (formato do multer: { originalname, mimetype, size, buffer }).
 * @returns {{ ok: true } | { ok: false, status: number, codigo: string, mensagem: string }}
 */
export function validarArquivoConta(arquivo) {
  if (!arquivo || !arquivo.buffer || !arquivo.size) {
    return { ok: false, status: 400, codigo: 'ARQUIVO_AUSENTE', mensagem: 'Envie o arquivo da conta (campo "conta").' }
  }
  if (!MIMETYPES_CONTA.includes(arquivo.mimetype)) {
    return { ok: false, status: 415, codigo: 'FORMATO_INVALIDO', mensagem: 'A conta precisa ser PDF ou imagem (JPG, PNG, WEBP).' }
  }
  if (arquivo.size > TAMANHO_MAXIMO_CONTA) {
    return { ok: false, status: 413, codigo: 'ARQUIVO_GRANDE', mensagem: 'A conta passa de 10 MB. Envie um arquivo menor.' }
  }
  return { ok: true }
}

/** Visão pública da conta: metadados, nunca o conteúdo. */
export function resumoConta(doc) {
  const d = typeof doc?.toObject === 'function' ? doc.toObject() : (doc || {})
  return {
    _id: d._id,
    clienteId: d.clienteId,
    nome: d.nome,
    mimetype: d.mimetype,
    tamanho: d.tamanho,
    createdAt: d.createdAt ?? null,
  }
}
