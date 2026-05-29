/**
 * documentStorageService.js — Sprint 8.2 / 8.2.1
 *
 * Fachada de armazenamento. Delega ao StorageProvider configurado pela empresa
 * (Local/OneDrive/GoogleDrive/Dropbox/S3) via storageProviders. A aplicação
 * nunca conhece o provider concreto; referência oficial = document_path + hash.
 */
import { getProvider, PROVIDERS_DISPONIVEIS } from './storageProviders.js'

export function statusStorage(armazenamento = null) {
  const provider = armazenamento?.provider || 'local'
  return { provider, disponiveis: PROVIDERS_DISPONIVEIS, configurado: provider === 'local' || Boolean(armazenamento?.config) }
}

// Monta um document_path determinístico /ForteSolar/Catalogo/<tipo>/<fabricante>/<arquivo>
export function montarDocumentPath({ tipo = 'documento', fabricante = 'geral', nome = 'arquivo', hash = '' }) {
  const slug = (s) => String(s || '').replace(/[^\w.-]+/g, '_').slice(0, 60)
  const sufixo = hash ? `_${hash.slice(0, 8)}` : ''
  return `/ForteSolar/Catalogo/${slug(tipo)}/${slug(fabricante)}/${slug(nome)}${sufixo}`
}

/**
 * Salva via provider configurado.
 * @returns {Promise<{ url_storage, storage_provider, document_path }>}
 */
export async function salvar({ hash, mimetype = 'application/octet-stream', buffer = null, dataUrl = null, nome = null, tipo = 'documento', fabricante = 'geral', armazenamento = null }) {
  const provider = getProvider(armazenamento)
  const document_path = montarDocumentPath({ tipo, fabricante, nome, hash })
  const r = await provider.upload({ document_path, hash, buffer, mimetype, dataUrl, nome })
  return { url_storage: r.url_storage ?? null, storage_provider: r.storage_provider || provider.nome, document_path }
}

/** Verifica existência física antes do download. */
export async function existe(ref, armazenamento = null) {
  return getProvider(armazenamento).exists(ref)
}

/** Baixa o conteúdo (buffer + mimetype) via provider. */
export async function baixar(ref, armazenamento = null) {
  return getProvider(armazenamento).download(ref)
}

export default { salvar, existe, baixar, statusStorage, montarDocumentPath }
