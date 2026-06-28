/**
 * chaveCanonicaMaterial.js — P0-CATALOGO-MESTRE-MATERIAIS (Fase 1)
 *
 * Derivação DETERMINÍSTICA da chave canônica de um material.
 *
 * Identidade:
 *   - commodity : classe + categoria + especificações  (fabricante/modelo NÃO entram)
 *   - engenharia: classe + categoria + fabricante + modelo + especificações
 *
 * Puro e síncrono (sem I/O) — testável isoladamente e reutilizado pelo hook do model.
 * A versão do algoritmo é uma constante no código (NÃO persistida). Se o algoritmo
 * mudar no futuro, recalcular via migração one-shot.
 */

import crypto from 'crypto'

export const CHAVE_CANONICA_ALGO = 'v1'

/**
 * Normaliza texto p/ identidade: minúsculas, sem acento, alfanumérico, espaços colapsados.
 * Usa NFKD (decomposição de compatibilidade) p/ unificar superscritos: "10mm²" ≡ "10mm2".
 */
export function normalizarTexto(texto) {
  return String(texto ?? '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')   // remove diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Serializa especificacoes [{chave,valor,unidade}] de forma estável (ordenada por chave).
 * Se `atributosIdentidade` (lista de chaves) for informado, considera SOMENTE essas
 * chaves — é o caminho usado com Template de Categoria (identidade declarada).
 * Sem a lista (back-compat), considera todas as especificações.
 */
function serializarEspecificacoes(especificacoes, atributosIdentidade = null) {
  if (!Array.isArray(especificacoes)) return ''
  const filtroId = Array.isArray(atributosIdentidade)
    ? new Set(atributosIdentidade.map(c => String(c).trim()))
    : null
  return especificacoes
    .filter(e => e && e.chave != null && e.valor != null && String(e.valor).trim() !== '')
    .filter(e => !filtroId || filtroId.has(String(e.chave).trim()))
    .map(e => `${normalizarTexto(e.chave)}=${normalizarTexto(e.valor)}${e.unidade ? ':' + normalizarTexto(e.unidade) : ''}`)
    .sort()                            // ordem independente da entrada
    .join(';')
}

/**
 * Monta a string canônica legível (pré-hash). Exposta para depuração/testes.
 * @param {{classe?:string, categoria?:string, fabricante?:string, modelo?:string, especificacoes?:Array}} material
 * @param {{atributosIdentidade?:string[]}} [opts] lista de chaves de identidade do template
 */
export function montarStringCanonica(material = {}, opts = {}) {
  const classe = normalizarTexto(material.classe)
  const categoria = normalizarTexto(material.categoria)
  const specs = serializarEspecificacoes(material.especificacoes, opts.atributosIdentidade)
  const partes = [CHAVE_CANONICA_ALGO, classe, categoria]
  if (classe === 'engenharia') {
    partes.push(normalizarTexto(material.fabricante), normalizarTexto(material.modelo))
  }
  partes.push(specs)
  return partes.join('|')
}

/**
 * Deriva a chave canônica (sha1 hex de 40 chars) a partir dos campos de identidade.
 * @param {object} material
 * @param {{atributosIdentidade?:string[]}} [opts]
 * @returns {string}
 */
export function derivarChaveCanonica(material = {}, opts = {}) {
  const base = montarStringCanonica(material, opts)
  return crypto.createHash('sha1').update(base).digest('hex')
}
