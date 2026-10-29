/**
 * mailService.js — P0-AUTH-MAIL-01 (FASE 2)
 *
 * Camada de transporte de e-mail via API HTTP do ZeptoMail (Zoho). Lê credenciais
 * ESTRITAMENTE de variáveis de ambiente — nenhum segredo no código.
 *
 *   ZEPTOMAIL_TOKEN=<Send Mail token do Mail Agent>
 *   MAIL_FROM=Forte Solar <nao-responda@fortesolar.com.br>   (remetente verificado)
 *   ZEPTOMAIL_API=https://cpaas.zoho.com/v1.1/email          (opcional; troca de região)
 *
 * POR QUE NÃO SMTP: o egress do Railway descarta as portas 25/465/587 (medido no
 * console do container: FAIL nas três, OK em 443). Nenhuma credencial SMTP funciona
 * de lá — só API HTTP na 443.
 *
 * Degrada com segurança: sem token, `enviarEmail` não lança — retorna
 * { enviado:false, motivo } — para que dev/homolog e os fluxos funcionem mesmo sem
 * credenciais, sem quebrar a request.
 */
import crypto from 'crypto'

const API   = process.env.ZEPTOMAIL_API || 'https://cpaas.zoho.com/v1.1/email'
const TOKEN = process.env.ZEPTOMAIL_TOKEN || null
const FROM  = process.env.MAIL_FROM || process.env.SMTP_FROM || null

const TIMEOUT_MS = 15000

/**
 * O console do Zoho exibe o token já com o prefixo `Zoho-enczapikey `. Aceitar as
 * duas formas evita um 401 cuja única causa é a colagem ter vindo com o prefixo.
 */
function cabecalhoAutorizacao() {
  const t = String(TOKEN || '').trim()
  return /^Zoho-enczapikey\s/i.test(t) ? t : `Zoho-enczapikey ${t}`
}

export function smtpConfigurado() {
  return !!(TOKEN && FROM)
}

/** `Nome <endereco@dominio>` ou `endereco@dominio` → { address, name? }. */
function parseRemetente(valor) {
  const m = String(valor || '').match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/)
  if (m) return m[1] ? { address: m[2], name: m[1] } : { address: m[2] }
  return { address: String(valor || '').trim() }
}

/** POST autenticado no ZeptoMail, com timeout. Devolve { status, corpo }. */
async function chamarApi(payload) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS)
  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: {
        Authorization: cabecalhoAutorizacao(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: ac.signal,
    })
    let corpo = null
    try { corpo = await r.json() } catch { corpo = null }
    return { status: r.status, corpo }
  } finally {
    clearTimeout(t)
  }
}

/**
 * Teste do canal de envio — NÃO envia e-mail.
 *
 * Manda um payload deliberadamente vazio: com token válido o ZeptoMail responde
 * 400 (corpo inválido) sem enviar nada; com token inválido responde 401. É o que
 * separa "credencial errada" de "credencial certa" sem gastar um envio.
 *
 * @returns {Promise<{ok:boolean, api?, motivo?, erro?}>}
 */
export async function verificarTransporte() {
  if (!TOKEN) return { ok: false, motivo: 'ZEPTOMAIL_TOKEN não definido' }
  if (!FROM)  return { ok: false, motivo: 'MAIL_FROM não definido' }
  try {
    const { status, corpo } = await chamarApi({})
    if (status === 400) return { ok: true, api: API, remetente: FROM }
    if (status === 401 || status === 403) {
      return { ok: false, api: API, erro: 'Token recusado pelo ZeptoMail', status }
    }
    return { ok: false, api: API, erro: corpo?.message || `HTTP ${status}`, status }
  } catch (e) {
    return { ok: false, api: API, erro: e.name === 'AbortError' ? 'Timeout na API' : e.message }
  }
}

/**
 * Envia um e-mail. Não lança quando o canal não está configurado.
 * @returns {Promise<{enviado:boolean, messageId?, motivo?}>}
 */
export async function enviarEmail({ to, subject, html, text }) {
  if (!smtpConfigurado()) {
    console.warn(`[mailService] canal de e-mail não configurado — e-mail para ${to} NÃO enviado ("${subject}")`)
    return { enviado: false, motivo: 'Canal de e-mail não configurado' }
  }

  const payload = {
    from: parseRemetente(FROM),
    to: [{ email_address: { address: String(to) } }],
    subject,
    ...(html ? { htmlbody: html } : {}),
    ...(text ? { textbody: text } : {}),
  }

  const { status, corpo } = await chamarApi(payload)
  if (status !== 200 && status !== 201) {
    // A mensagem do ZeptoMail entra no erro; o token nunca é registrado.
    const detalhe = corpo?.data?.message || corpo?.message || `HTTP ${status}`
    throw new Error(`ZeptoMail recusou o envio: ${detalhe}`)
  }
  return { enviado: true, messageId: corpo?.request_id || null }
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
