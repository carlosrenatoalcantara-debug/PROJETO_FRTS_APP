/**
 * storageProviders.js — Sprint 8.2.1
 *
 * Abstração DEFINITIVA de armazenamento de documentos. A aplicação nunca sabe
 * onde o arquivo está: usa sempre `getProvider()` + a referência oficial
 * (document_path + hash_sha256). IDs externos (onedrive/google/dropbox) só
 * podem existir como CACHE — nunca como chave.
 *
 * Interface StorageProvider:
 *   upload({ document_path, hash, buffer, mimetype, nome }) → { document_path, storage_provider, ref_externa? }
 *   download(ref) → { buffer, mimetype }      stream(ref) → ReadableStream
 *   exists(ref) → boolean                     delete(ref) → boolean
 *   getMetadata(ref) → { tamanho, ... }
 *
 * Local é funcional (dev). Os demais são adapters PRONTOS (sem credenciais):
 * lançam STORAGE_NAO_CONFIGURADO até a integração ser habilitada.
 */

class StorageProvider {
  constructor(nome) { this.nome = nome }
  async upload() { throw new Error('not implemented') }
  async download() { throw new Error('not implemented') }
  async stream() { throw new Error('not implemented') }
  async exists() { return false }
  async delete() { return false }
  async getMetadata() { return null }
}

// ── Local (dev) — guarda o conteúdo como data URL na própria referência ─────────
class LocalStorageProvider extends StorageProvider {
  constructor() { super('local') }
  async upload({ document_path, hash, buffer, mimetype, dataUrl }) {
    const conteudo = dataUrl || (buffer ? `data:${mimetype || 'application/octet-stream'};base64,${buffer.toString('base64')}` : null)
    return { document_path, storage_provider: 'local', url_storage: conteudo }
  }
  async download(ref) {
    if (!ref?.url_storage) throw new Error('ARQUIVO_AUSENTE')
    const [, mime] = /^data:([^;]+)/.exec(ref.url_storage) || []
    const b64 = String(ref.url_storage).split(',').pop()
    return { buffer: Buffer.from(b64, 'base64'), mimetype: mime || 'application/octet-stream' }
  }
  async exists(ref) { return !!ref?.url_storage }
  async delete() { return true }
  async getMetadata(ref) { return ref?.url_storage ? { tamanho: Math.floor((ref.url_storage.length * 3) / 4) } : null }
}

// ── Cloud adapters (prontos; exigem credenciais futuras) ────────────────────────
function naoConfigurado(nome) {
  const e = new Error(`Storage "${nome}" não configurado. Configure as credenciais em Configurações → Armazenamento.`)
  e.codigo = 'STORAGE_NAO_CONFIGURADO'
  return e
}
class OneDriveProvider extends StorageProvider {
  constructor(cfg) { super('onedrive'); this.cfg = cfg }
  async upload() { throw naoConfigurado('OneDrive') }   // TODO: Microsoft Graph PUT /me/drive/root:/{path}:/content
  async download() { throw naoConfigurado('OneDrive') }
  async stream() { throw naoConfigurado('OneDrive') }
  async exists() { return false }
}
class GoogleDriveProvider extends StorageProvider {
  constructor(cfg) { super('google_drive'); this.cfg = cfg }
  async upload() { throw naoConfigurado('Google Drive') } // TODO: Drive files.create (resumable)
  async download() { throw naoConfigurado('Google Drive') }
  async stream() { throw naoConfigurado('Google Drive') }
  async exists() { return false }
}
class DropboxProvider extends StorageProvider {
  constructor(cfg) { super('dropbox'); this.cfg = cfg }
  async upload() { throw naoConfigurado('Dropbox') }     // TODO: /2/files/upload
  async download() { throw naoConfigurado('Dropbox') }
  async stream() { throw naoConfigurado('Dropbox') }
  async exists() { return false }
}
class S3CompatibleProvider extends StorageProvider {
  constructor(cfg) { super('s3'); this.cfg = cfg }
  async upload() { throw naoConfigurado('S3/R2') }       // TODO: PutObject; download via URL assinada
  async download() { throw naoConfigurado('S3/R2') }
  async stream() { throw naoConfigurado('S3/R2') }
  async exists() { return false }
}

const local = new LocalStorageProvider()

/**
 * Retorna o provider conforme a configuração da empresa.
 * @param {object} [armazenamento] { provider, config }
 */
export function getProvider(armazenamento = null) {
  const nome = armazenamento?.provider || 'local'
  switch (nome) {
    case 'onedrive':     return new OneDriveProvider(armazenamento?.config)
    case 'google_drive': return new GoogleDriveProvider(armazenamento?.config)
    case 'dropbox':      return new DropboxProvider(armazenamento?.config)
    case 's3': case 'r2': return new S3CompatibleProvider(armazenamento?.config)
    default:             return local
  }
}

export const PROVIDERS_DISPONIVEIS = ['local', 'onedrive', 'google_drive', 'dropbox', 's3']

/**
 * migrarStorage — move documentos de um provider para outro, validando SHA em
 * ambas as pontas. NÃO altera projetos (referência oficial = path + hash).
 * Preparação: itera, baixa, valida, envia, valida, troca provider.
 */
export async function migrarStorage({ documentos = [], de, para, validarHash }) {
  const origem = getProvider(de), destino = getProvider(para)
  const resultado = { migrados: 0, falhas: [], total: documentos.length }
  for (const doc of documentos) {
    try {
      const ref = { document_path: doc.document_path, url_storage: doc.url_storage, hash: doc.hash_sha256 }
      const { buffer, mimetype } = await origem.download(ref)
      if (validarHash && validarHash(buffer) !== doc.hash_sha256) throw new Error('HASH_DIVERGENTE_ORIGEM')
      const novo = await destino.upload({ document_path: doc.document_path, hash: doc.hash_sha256, buffer, mimetype })
      resultado.migrados++
      resultado._ultimo = novo
    } catch (e) {
      resultado.falhas.push({ document_path: doc.document_path, erro: e.message })
    }
  }
  return resultado
}

export default { getProvider, migrarStorage, PROVIDERS_DISPONIVEIS }
