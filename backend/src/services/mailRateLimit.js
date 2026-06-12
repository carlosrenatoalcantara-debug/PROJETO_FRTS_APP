/**
 * mailRateLimit.js — P0-AUTH-MAIL-01 (FASE 3)
 *
 * Rate-limit simples por usuário (em memória) para evitar disparos em massa
 * acidentais e spam no servidor Zoho. Janela deslizante de 1h.
 *   - mínimo 60s entre solicitações para o MESMO usuário
 *   - no máximo 5 envios por hora por usuário
 */
const MIN_INTERVALO_MS = 60 * 1000
const JANELA_MS        = 60 * 60 * 1000
const MAX_POR_JANELA   = 5

const disparos = new Map()   // userId -> number[] (timestamps)

function recentes(userId, agora) {
  return (disparos.get(userId) || []).filter(t => agora - t < JANELA_MS)
}

/** @returns {{ok:boolean, motivo?:string, retry_em_s?:number}} */
export function podeDisparar(userId) {
  const agora = Date.now()
  const lista = recentes(userId, agora)
  if (lista.length) {
    const desdeUltimo = agora - lista[lista.length - 1]
    if (desdeUltimo < MIN_INTERVALO_MS) {
      return { ok: false, motivo: 'Aguarde ao menos 60s entre solicitações.', retry_em_s: Math.ceil((MIN_INTERVALO_MS - desdeUltimo) / 1000) }
    }
  }
  if (lista.length >= MAX_POR_JANELA) {
    return { ok: false, motivo: `Limite de ${MAX_POR_JANELA} envios por hora atingido para este usuário.` }
  }
  return { ok: true }
}

export function registrarDisparo(userId) {
  const agora = Date.now()
  const lista = recentes(userId, agora)
  lista.push(agora)
  disparos.set(userId, lista)
}
