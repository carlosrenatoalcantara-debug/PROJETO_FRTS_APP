/**
 * bancoQa.js — a barreira entre o ambiente de QA e o Atlas de produção — FV-INFRA-058.
 *
 * Toda a série FV foi conduzida com a produção proibida, e a proteção era
 * humana: lembrar de exportar a URI certa. Este módulo torna a regra
 * verificável — um ambiente de QA que aponte para produção não sobe.
 *
 * ── O que conta como produção ───────────────────────────────────────────────
 * Qualquer URI que não seja localhost/127.0.0.1 é tratada como remota, e uma
 * URI remota só é aceita em QA quando o nome do banco a declara explicitamente
 * como de teste (`staging`, `qa`, `homolog`, `teste`) OU quando
 * `QA_URI_REMOTA_AUTORIZADA=sim` foi definido de propósito.
 *
 * Fail-closed: na dúvida, recusa. Um falso positivo custa uma variável de
 * ambiente; um falso negativo custa dados de cliente.
 *
 * PURO: não conecta, não lê rede, não imprime a URI (ela carrega credencial).
 */

export class ErroBancoProibido extends Error {
  constructor(msg, codigo = 'BANCO_DE_PRODUCAO') {
    super(msg)
    this.name = 'ErroBancoProibido'
    this.codigo = codigo
  }
}

/** Marcas de nome de banco que declaram um ambiente de teste. */
const MARCAS_TESTE = ['staging', 'qa', 'homolog', 'teste', 'test', 'sandbox', 'validacao']

/** `mongodb://user:senha@host/base` → `mongodb://***@host/base`. Nunca logue a URI crua. */
export function mascararUri(uri) {
  if (typeof uri !== 'string' || uri === '') return '(vazia)'
  return uri.replace(/\/\/[^@/]*@/, '//***@')
}

/** Partes relevantes de uma URI Mongo. Não lança: entrada ilegível vira `null`. */
export function analisarUri(uri) {
  if (typeof uri !== 'string' || uri.trim() === '') return null
  const m = uri.trim().match(/^mongodb(\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?/i)
  if (!m) return null
  const host = (m[2] || '').toLowerCase()
  const base = decodeURIComponent(m[3] || '').toLowerCase()
  const local = host.startsWith('localhost') || host.startsWith('127.0.0.1')
  return { host, base, local, srv: !!m[1] }
}

/**
 * A URI pode ser usada por um ambiente de QA?
 * @returns {{permitida:boolean, motivo:string|null, codigo:string|null, info:object|null}}
 */
export function avaliarUriQa(uri, env = process.env) {
  const info = analisarUri(uri)
  if (!info) {
    return { permitida: false, codigo: 'URI_ILEGIVEL', info: null,
      motivo: 'MONGODB_URI ausente ou não reconhecida como URI MongoDB.' }
  }
  if (info.local) return { permitida: true, motivo: null, codigo: null, info }

  if (String(env.QA_URI_REMOTA_AUTORIZADA || '').toLowerCase() === 'sim') {
    return { permitida: true, motivo: null, codigo: null, info }
  }
  if (MARCAS_TESTE.some((marca) => info.base.includes(marca))) {
    return { permitida: true, motivo: null, codigo: null, info }
  }
  return {
    permitida: false, codigo: 'BANCO_DE_PRODUCAO', info,
    motivo: `A URI aponta para o host remoto "${info.host}" e o banco "${info.base || '(sem nome)'}" `
      + 'não se declara de teste. Use um banco cujo nome contenha staging/qa/homolog/teste, '
      + 'ou defina QA_URI_REMOTA_AUTORIZADA=sim se essa base for mesmo de QA.',
  }
}

/**
 * Fail-closed para scripts e seeds de QA. Chame ANTES de conectar.
 * @throws {ErroBancoProibido}
 */
export function exigirBancoDeQa(uri, env = process.env) {
  const r = avaliarUriQa(uri, env)
  if (!r.permitida) {
    throw new ErroBancoProibido(
      `${r.motivo}\nURI recebida: ${mascararUri(uri)}`, r.codigo,
    )
  }
  return r.info
}

export default { avaliarUriQa, exigirBancoDeQa, analisarUri, mascararUri, ErroBancoProibido }
