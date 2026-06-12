/**
 * mailService.js — P0-AUTH-MAIL-01 (FASE 1)
 *
 * Camada de transporte SMTP (Zoho Mail) via Nodemailer. Lê credenciais ESTRITAMENTE
 * de variáveis de ambiente — nenhum segredo no código.
 *
 *   SMTP_HOST=smtp.zoho.com   SMTP_PORT=465 (SSL)   SMTP_USER=...   SMTP_PASS=<app-password 16d>
 *
 * Degrada com segurança: sem SMTP_USER/SMTP_PASS, `enviarEmail` não lança — retorna
 * { enviado:false, motivo } — para que dev/homolog e os fluxos funcionem mesmo sem
 * credenciais, sem quebrar a request.
 */
import nodemailer from 'nodemailer'
import crypto from 'crypto'

const HOST = process.env.SMTP_HOST || 'smtp.zoho.com'
const PORT = parseInt(process.env.SMTP_PORT || '465', 10)
const USER = process.env.SMTP_USER || null
const PASS = process.env.SMTP_PASS || null
const FROM = process.env.MAIL_FROM || process.env.SMTP_FROM || (USER ? `Forte Solar <${USER}>` : null)

let _transporter = null

export function smtpConfigurado() {
  return !!(USER && PASS)
}

function getTransporter() {
  if (!smtpConfigurado()) return null
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: PORT === 465,   // SSL direto na 465 (premissa Zoho)
      auth: { user: USER, pass: PASS },
    })
  }
  return _transporter
}

/**
 * Teste de handshake com o servidor SMTP (não envia e-mail).
 * @returns {Promise<{ok:boolean, host?, port?, motivo?, erro?}>}
 */
export async function verificarTransporte() {
  const t = getTransporter()
  if (!t) return { ok: false, motivo: 'SMTP não configurado (defina SMTP_USER e SMTP_PASS)' }
  try {
    await t.verify()
    return { ok: true, host: HOST, port: PORT, secure: PORT === 465 }
  } catch (e) {
    return { ok: false, erro: e.message, host: HOST, port: PORT }
  }
}

/**
 * Envia um e-mail. Não lança quando SMTP não está configurado.
 * @returns {Promise<{enviado:boolean, messageId?, motivo?}>}
 */
export async function enviarEmail({ to, subject, html, text }) {
  const t = getTransporter()
  if (!t) {
    console.warn(`[mailService] SMTP não configurado — e-mail para ${to} NÃO enviado ("${subject}")`)
    return { enviado: false, motivo: 'SMTP não configurado' }
  }
  const info = await t.sendMail({ from: FROM, to, subject, html, text })
  return { enviado: true, messageId: info.messageId }
}

// ─── Tokens de acesso (convite/reset) ─────────────────────────────────────────

/** Gera um token bruto (enviado por e-mail) + seu hash (persistido no banco). */
export function gerarToken() {
  const raw = crypto.randomBytes(32).toString('hex')
  const hash = hashToken(raw)
  return { raw, hash }
}

/** SHA-256 do token bruto — só o hash é guardado no Atlas. */
export function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex')
}
