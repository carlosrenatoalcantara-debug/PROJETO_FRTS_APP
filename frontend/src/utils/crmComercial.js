/**
 * crmComercial.js — Sprint 5
 *
 * CRM operacional leve + comunicação auditável. Reutiliza a timeline única
 * (governanca.comercial.historico) — NÃO cria timeline paralela.
 *
 * Comunicação via wa.me e mailto (sem SMTP/fila/workers). Compartilhamento
 * abre snapshot CONGELADO (link público read-only). Pura e determinística.
 */

// ─── Pipeline CRM (separado do workflow jurídico/comercial) ──────────────────────
export const CRM_PIPELINE_CONFIG = {
  LEAD:        { label: 'Lead',        cor: 'cinza',    ordem: 1 },
  QUALIFICADO: { label: 'Qualificado', cor: 'azul',     ordem: 2 },
  PROPOSTA:    { label: 'Proposta',    cor: 'azul',     ordem: 3 },
  NEGOCIACAO:  { label: 'Negociação',  cor: 'amarelo',  ordem: 4 },
  FECHADO:     { label: 'Fechado',     cor: 'verde',    ordem: 5 },
  IMPLANTACAO: { label: 'Implantação', cor: 'verde',    ordem: 6 },
  PERDIDO:     { label: 'Perdido',     cor: 'vermelho', ordem: 99 },
}

export function getPipelineConfig(estado) {
  return CRM_PIPELINE_CONFIG[estado] || CRM_PIPELINE_CONFIG.LEAD
}

export const FOLLOWUP_STATUS = {
  retorno_pendente:      { label: 'Retorno pendente',      cor: 'amarelo' },
  ligar_depois:          { label: 'Ligar depois',          cor: 'azul' },
  aguardando_assinatura: { label: 'Aguardando assinatura', cor: 'laranja' },
  aguardando_cliente:    { label: 'Aguardando cliente',    cor: 'azul' },
  sem_pendencia:         { label: 'Sem pendência',         cor: 'verde' },
}

export function getFollowupConfig(s) {
  return FOLLOWUP_STATUS[s] || { label: s || '—', cor: 'cinza' }
}

// ─── Templates leves ──────────────────────────────────────────────────────────────
// Placeholders: {{cliente}} {{vendedor}} {{potencia}} {{valor}} {{link}} {{empresa}}
export const TEMPLATES_WHATSAPP = {
  primeiro_contato: {
    label: 'Primeiro contato',
    texto: 'Olá {{cliente}}, aqui é {{vendedor}} da {{empresa}}. Tudo bem? Posso te apresentar uma proposta de energia solar sob medida para você? 🌞',
  },
  envio_proposta: {
    label: 'Envio de proposta',
    texto: 'Olá {{cliente}}! Segue sua proposta de sistema solar de {{potencia}} kWp.\nInvestimento: {{valor}}.\nVeja os detalhes: {{link}}\n\nQualquer dúvida, estou à disposição! — {{vendedor}}',
  },
  followup: {
    label: 'Follow-up',
    texto: 'Olá {{cliente}}, tudo bem? Passando para saber se conseguiu analisar a proposta solar que enviei. Posso ajudar com alguma dúvida? — {{vendedor}}',
  },
  cobranca_assinatura: {
    label: 'Cobrança de assinatura',
    texto: 'Olá {{cliente}}! Para garantir as condições da proposta, falta apenas a assinatura. Posso te enviar o link? — {{vendedor}}',
  },
}

export const TEMPLATES_EMAIL = {
  envio_proposta: {
    label: 'Envio de proposta',
    assunto: 'Proposta de Energia Solar — {{potencia}} kWp',
    corpo: 'Olá {{cliente}},\n\nConforme conversamos, segue sua proposta de sistema fotovoltaico de {{potencia}} kWp.\nInvestimento total: {{valor}}.\n\nAcesse a proposta completa: {{link}}\n\nFico à disposição para qualquer dúvida.\n\nAtenciosamente,\n{{vendedor}}\n{{empresa}}',
  },
  followup: {
    label: 'Follow-up',
    assunto: 'Sua proposta de energia solar',
    corpo: 'Olá {{cliente}},\n\nGostaria de saber se conseguiu analisar a proposta enviada. Estou à disposição para esclarecer qualquer ponto.\n\nAtenciosamente,\n{{vendedor}}',
  },
}

export function aplicarTemplate(texto, vars = {}) {
  return String(texto || '').replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''))
}

// ─── Links de comunicação ───────────────────────────────────────────────────────

/** URL pública absoluta para um token de compartilhamento. */
export function urlPublica(token) {
  if (!token) return ''
  const base = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : ''
  return `${base}/p/${token}`
}

export function linkWhatsApp(telefone, texto) {
  const num = String(telefone || '').replace(/\D/g, '')
  const msg = encodeURIComponent(texto || '')
  return num ? `https://wa.me/55${num}?text=${msg}` : `https://wa.me/?text=${msg}`
}

export function linkEmail(email, assunto, corpo) {
  return `mailto:${email || ''}?subject=${encodeURIComponent(assunto || '')}&body=${encodeURIComponent(corpo || '')}`
}
