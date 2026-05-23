/**
 * concessionarias/index.js — Concentrador e Indexador da Biblioteca Nacional de Concessionárias
 *
 * Importa todos os grupos e a lista de independentes e constrói os índices de busca:
 *   - por id          → Map<string, Distribuidora>
 *   - por estado      → Map<string, Distribuidora[]>
 *   - por alias       → Map<string, AliasMatch[]>   (normalizado, sem acento, lowercase)
 *   - por codigo_aneel → Map<string, Distribuidora>
 *
 * Campos de cada distribuidora:
 *   aliases[]              — termos de matching com nivel/confiança
 *   padroes_campos{}       — labels que precedem cada campo nos documentos
 *   nomenclaturas_regionais{} — como a concessionária nomeia seus campos (pode ser null)
 *   padroes_documentais{}  — regex de extração: regex_parecer, formato_contrato (pode ser null)
 *   readiness{}            — flags de funcionalidade habilitada
 *   tokens_semanticos[]    — tokens para embeddings futuros
 *
 * Funções exportadas:
 *   buscarPorId(id)                → Distribuidora | null
 *   buscarPorAlias(termo)          → AliasMatch[]          (ordenado por confianca desc)
 *   buscarPorEstado(uf)            → Distribuidora[]
 *   buscarPorCodigoAneel(codigo)   → Distribuidora | null
 *   resolverMelhorMatch(termo)     → AliasMatch | null      (top-1)
 *   padroesDocumentais(id)         → { regex_parecer, formato_contrato } | null
 *   listarTodas()                  → Distribuidora[]
 *   listarGrupos()                 → string[]
 *
 * @module concessionarias
 */

import { GRUPO_NEOENERGIA }  from './grupos/neoenergia.js'
import { GRUPO_ENEL }        from './grupos/enel.js'
import { GRUPO_ENERGISA }    from './grupos/energisa.js'
import { GRUPO_EQUATORIAL }  from './grupos/equatorial.js'
import { GRUPO_CPFL }        from './grupos/cpfl.js'
import { CONCESSIONARIAS_INDEPENDENTES } from './independentes.js'

// ─── 1. Coleta todas as distribuidoras ──────────────────────────────────────

const GRUPOS = Object.freeze([
  GRUPO_NEOENERGIA,
  GRUPO_ENEL,
  GRUPO_ENERGISA,
  GRUPO_EQUATORIAL,
  GRUPO_CPFL,
])

/** Lista plana de todas as distribuidoras (grupos + independentes) */
const TODAS = Object.freeze([
  ...GRUPOS.flatMap(g => g.distribuidoras),
  ...CONCESSIONARIAS_INDEPENDENTES,
])

// ─── 2. Helpers de normalização ─────────────────────────────────────────────

/**
 * Normaliza string para matching:
 *   - lowercase
 *   - remove acentos (NFD + regex de combining marks)
 *   - colapsa espaços múltiplos
 */
function _normalizar(str) {
  if (typeof str !== 'string') return ''
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── 3. Construção dos índices ───────────────────────────────────────────────

/** @type {Map<string, object>} id → Distribuidora */
const IDX_ID = new Map()

/** @type {Map<string, object[]>} estado (UF) → Distribuidora[] */
const IDX_ESTADO = new Map()

/** @type {Map<string, Array<{distribuidora: object, nivel: number, confianca: number}>>} */
const IDX_ALIAS = new Map()

/** @type {Map<string, object>} codigo_aneel → Distribuidora */
const IDX_ANEEL = new Map()

for (const dist of TODAS) {
  // — por id (case-insensitive)
  IDX_ID.set(dist.id.toLowerCase(), dist)

  // — por estado
  const uf = (dist.estado || '').toUpperCase()
  if (uf) {
    if (!IDX_ESTADO.has(uf)) IDX_ESTADO.set(uf, [])
    IDX_ESTADO.get(uf).push(dist)
  }

  // — por alias (normalized)
  for (const alias of (dist.aliases || [])) {
    const chave = _normalizar(alias.termo)
    if (!chave) continue
    if (!IDX_ALIAS.has(chave)) IDX_ALIAS.set(chave, [])
    IDX_ALIAS.get(chave).push({
      distribuidora: dist,
      nivel:         alias.nivel,
      confianca:     alias.confianca,
      termo_original: alias.termo,
    })
  }

  // — por codigo_aneel (ignora duplicatas — dois distribuidores no mesmo código
  //   ocorrem em áreas sobrepostas; o primeiro registrado vence no índice exato,
  //   mas buscarPorEstado() retorna ambos)
  if (dist.codigo_aneel && !IDX_ANEEL.has(dist.codigo_aneel)) {
    IDX_ANEEL.set(dist.codigo_aneel, dist)
  }
}

// ─── 4. API pública ─────────────────────────────────────────────────────────

/**
 * Busca distribuidora pelo id canônico (ex.: 'CEMIG', 'COSERN', 'CPFL_PAULISTA').
 * Case-insensitive.
 * @param {string} id
 * @returns {object|null}
 */
export function buscarPorId(id) {
  if (typeof id !== 'string') return null
  return IDX_ID.get(id.toLowerCase()) ?? null
}

/**
 * Busca candidatos por termo de alias.
 * Aplica normalização idêntica à usada na indexação.
 * Retorna array ordenado por confiança descendente.
 *
 * @param {string} termo
 * @returns {Array<{distribuidora: object, nivel: number, confianca: number, termo_original: string}>}
 */
export function buscarPorAlias(termo) {
  if (typeof termo !== 'string') return []
  const chave = _normalizar(termo)
  const matches = IDX_ALIAS.get(chave) ?? []
  // Ordena por confianca desc, depois por nivel desc (maior nivel = mais específico)
  return [...matches].sort((a, b) => b.confianca - a.confianca || b.nivel - a.nivel)
}

/**
 * Retorna todas as distribuidoras de um estado (UF 2 letras maiúsculas).
 * @param {string} uf
 * @returns {object[]}
 */
export function buscarPorEstado(uf) {
  if (typeof uf !== 'string') return []
  return IDX_ESTADO.get(uf.toUpperCase()) ?? []
}

/**
 * Busca distribuidora pelo código ANEEL.
 * Atenção: alguns estados têm concessionárias em áreas sobrepostas (ex.: RJ tem Light e Equatorial Rio
 * com codigos distintos; SP tem múltiplos distribuidores). Use buscarPorEstado() quando precisar
 * de todos para um estado.
 * @param {string} codigo
 * @returns {object|null}
 */
export function buscarPorCodigoAneel(codigo) {
  if (codigo === null || codigo === undefined) return null
  return IDX_ANEEL.get(String(codigo)) ?? null
}

/**
 * Resolve o melhor match (top-1 por confiança) para um termo.
 * Retorna null se nenhum alias corresponder.
 *
 * @param {string} termo
 * @returns {{distribuidora: object, nivel: number, confianca: number, termo_original: string}|null}
 */
export function resolverMelhorMatch(termo) {
  const matches = buscarPorAlias(termo)
  return matches.length > 0 ? matches[0] : null
}

/**
 * Retorna os padrões documentais (regex) de uma distribuidora.
 * Usado pelo parecerNormalizerService para extração por regex quando disponível.
 * Retorna null quando a distribuidora ainda não tem regex mapeada (campo TODO).
 *
 * @param {string} id
 * @returns {{ regex_parecer: RegExp|null, formato_contrato: RegExp|null } | null}
 */
export function padroesDocumentais(id) {
  const dist = buscarPorId(id)
  return dist?.padroes_documentais ?? null
}

/**
 * Retorna as nomenclaturas regionais de uma distribuidora.
 * Mapeamento de campo canônico → label usado nos documentos impressos/digitais da concessionária.
 *
 * @param {string} id
 * @returns {{ codigo_cliente?: string, numero_parecer?: string } | null}
 */
export function nomenclaturasRegionais(id) {
  const dist = buscarPorId(id)
  return dist?.nomenclaturas_regionais ?? null
}

/**
 * Retorna lista plana de todas as distribuidoras cadastradas.
 * @returns {object[]}
 */
export function listarTodas() {
  return [...TODAS]
}

/**
 * Retorna os ids dos grupos econômicos disponíveis.
 * @returns {string[]}
 */
export function listarGrupos() {
  return GRUPOS.map(g => g.id)
}

/**
 * Retorna o objeto completo de um grupo econômico pelo seu id.
 * @param {string} id — ex.: 'cpfl', 'neoenergia', 'equatorial'
 * @returns {object|null}
 */
export function buscarGrupo(id) {
  if (typeof id !== 'string') return null
  return GRUPOS.find(g => g.id === id.toLowerCase()) ?? null
}

// ─── 5. Exportações de conveniência ─────────────────────────────────────────

export { GRUPOS, TODAS as TODAS_DISTRIBUIDORAS }

// Re-exporta os grupos individualmente para quem precisar do objeto completo
export { GRUPO_NEOENERGIA, GRUPO_ENEL, GRUPO_ENERGISA, GRUPO_EQUATORIAL, GRUPO_CPFL }
export { CONCESSIONARIAS_INDEPENDENTES }
