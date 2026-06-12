/**
 * emailTemplates.js — P0-AUTH-MAIL-01 (FASE 1)
 *
 * Templates HTML leves e responsivos com a identidade visual do Forte Solar.
 * Sem dependências externas (CSS inline para compatibilidade com clientes de e-mail).
 */

const COR_PRIMARIA = '#f97316'   // laranja Forte Solar
const COR_ESCURA   = '#0f172a'

function moldura({ titulo, corpoHtml, rodapeHtml = '' }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.08);">
        <tr><td style="background:${COR_ESCURA};padding:20px 28px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:.2px;">Forte&nbsp;<span style="color:${COR_PRIMARIA};">Solar</span></span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 12px;font-size:20px;color:${COR_ESCURA};">${titulo}</h1>
          ${corpoHtml}
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">
            ${rodapeHtml || 'Este é um e-mail automático do sistema Forte Solar. Se você não esperava esta mensagem, ignore-a.'}
          </p>
        </td></tr>
      </table>
      <p style="margin:14px 0 0;font-size:11px;color:#cbd5e1;">© ${new Date().getFullYear()} Forte Solar</p>
    </td></tr>
  </table>
</body></html>`
}

function botao(href, texto) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr><td style="border-radius:10px;background:${COR_PRIMARIA};">
    <a href="${href}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${texto}</a>
  </td></tr></table>`
}

/**
 * Convite / Ativação de novo usuário (primeiro acesso). Token expira em 24h.
 */
export function templateConvite({ nome, link, validadeHoras = 24 }) {
  const corpoHtml = `
    <p style="margin:0 0 8px;font-size:14px;color:#334155;line-height:1.6;">Olá, <strong>${escapar(nome || '')}</strong> 👋</p>
    <p style="margin:0 0 4px;font-size:14px;color:#334155;line-height:1.6;">Sua conta no <strong>Forte Solar</strong> foi criada. Para começar, defina sua senha de primeiro acesso clicando no botão abaixo:</p>
    ${botao(link, 'Definir minha senha')}
    <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">Este link é pessoal e expira em <strong>${validadeHoras} horas</strong>. Se o botão não funcionar, copie e cole no navegador:<br><span style="color:${COR_PRIMARIA};word-break:break-all;">${link}</span></p>`
  return { subject: 'Bem-vindo ao Forte Solar — defina sua senha', html: moldura({ titulo: 'Ative seu acesso', corpoHtml }) }
}

/**
 * Redefinição de senha. Token de uso único, expiração curta.
 */
export function templateReset({ nome, link, validadeMinutos = 30 }) {
  const corpoHtml = `
    <p style="margin:0 0 8px;font-size:14px;color:#334155;line-height:1.6;">Olá, <strong>${escapar(nome || '')}</strong></p>
    <p style="margin:0 0 4px;font-size:14px;color:#334155;line-height:1.6;">Recebemos uma solicitação para redefinir a senha da sua conta Forte Solar. Clique abaixo para criar uma nova senha:</p>
    ${botao(link, 'Redefinir senha')}
    <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">Este link é de <strong>uso único</strong> e expira em <strong>${validadeMinutos} minutos</strong>. Se você não solicitou, ignore este e-mail — sua senha atual continua válida.<br><span style="color:${COR_PRIMARIA};word-break:break-all;">${link}</span></p>`
  return { subject: 'Forte Solar — redefinição de senha', html: moldura({ titulo: 'Redefinir senha', corpoHtml }) }
}

function escapar(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}
