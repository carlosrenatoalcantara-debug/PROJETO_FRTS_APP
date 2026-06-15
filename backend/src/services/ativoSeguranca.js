/**
 * ativoSeguranca.js — P1-ASSET-SECURITY-01
 * Reutiliza o AES-256-GCM existente (src/security/encryption.js) para proteger campos
 * sensíveis do Gêmeo Digital em repouso. Formato tagueado para leitura transparente
 * (legado em texto puro é detectado e tratado como tal até a migração).
 *
 * Não altera arquitetura: apenas persistência/exposição do valor de `conectividade.senha_wifi`.
 */
import EncryptionService from '../security/encryption.js'

const TAG = 'ENCv1:'   // prefixo do blob criptografado (distingue de texto legado)
export const MASCARA = '••••••'

let _svc = null
function svc() {
  if (!_svc) _svc = new EncryptionService()   // usa process.env.ENCRYPTION_KEY
  return _svc
}

/** true se o valor armazenado já está criptografado (formato ENCv1). */
export function estaCriptografado(valor) {
  return typeof valor === 'string' && valor.startsWith(TAG)
}

/** Criptografa um valor sensível. ctx = contexto estável (ex.: ativo._id) p/ derivação de chave. */
export function criptografar(plaintext, ctx) {
  if (plaintext == null || plaintext === '') return null
  const e = svc().encrypt(String(plaintext), String(ctx))
  const blob = { d: e.encryptedData, s: e.salt, i: e.iv, t: e.authTag }
  return TAG + Buffer.from(JSON.stringify(blob), 'utf8').toString('base64')
}

/** Descriptografa INTERNAMENTE. Se for legado (texto puro), retorna como está. */
export function descriptografar(armazenado, ctx) {
  if (armazenado == null) return null
  if (!estaCriptografado(armazenado)) return armazenado   // legado/plaintext
  const o = JSON.parse(Buffer.from(armazenado.slice(TAG.length), 'base64').toString('utf8'))
  return svc().decrypt({ encryptedData: o.d, salt: o.s, iv: o.i, authTag: o.t }, String(ctx))
}

/** Máscara para exposição (nunca devolve o valor). */
export function mascarar(armazenado) {
  return (armazenado == null || armazenado === '') ? null : MASCARA
}
