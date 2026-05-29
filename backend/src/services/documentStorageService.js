/**
 * documentStorageService.js — Sprint 8.2
 *
 * Camada de armazenamento de documentos preparada para Object Storage (S3/R2).
 * Enquanto o storage externo não estiver configurado, usa um ADAPTER LOCAL
 * temporário (data URL base64) — não quebra o ambiente atual. O Mongo guarda
 * apenas a referência (url_storage), nunca o binário grande direto no doc.
 */
const CONFIG = {
  provider: process.env.DOC_STORAGE_PROVIDER || 'local', // 'local' | 's3' | 'r2'
  bucket: process.env.DOC_STORAGE_BUCKET || null,
  endpoint: process.env.DOC_STORAGE_ENDPOINT || null,
}

export function statusStorage() {
  return { provider: CONFIG.provider, configurado: Boolean(CONFIG.bucket), modo: CONFIG.provider === 'local' ? 'adapter_local' : 'object_storage' }
}

/**
 * Salva o conteúdo e devolve a referência de storage.
 * @param {object} p { hash, mimetype, buffer | dataUrl, nome }
 * @returns {Promise<{ url_storage, provider }>}
 */
export async function salvar({ hash, mimetype = 'application/octet-stream', buffer = null, dataUrl = null, nome = null }) {
  if (CONFIG.provider !== 'local' && CONFIG.bucket) {
    // TODO (futuro): PutObject no S3/R2; retornar URL pública/assinada.
    // const key = `documentos/${hash}-${nome}`; await s3.putObject(...)
    // return { url_storage: `${CONFIG.endpoint}/${CONFIG.bucket}/${key}`, provider: CONFIG.provider }
  }
  // Adapter local: mantém o conteúdo como data URL (referência inline).
  const conteudo = dataUrl || (buffer ? `data:${mimetype};base64,${buffer.toString('base64')}` : null)
  return { url_storage: conteudo, provider: 'local' }
}

export default { salvar, statusStorage }
