/**
 * variablesNormalizer.js — S2.9.3 Camada Semântica Variables SolarMarket
 *
 * Engine de normalização de variáveis do SolarMarket para o contrato
 * canônico do ProjetoFV v3.
 *
 * Arquitetura:
 *  1. Na carga do módulo, constrói um índice invertido (ALIAS_INDEX):
 *       Map<lowercase_alias → canonical_field>
 *     Custo: O(total_aliases) — pago uma vez, na inicialização.
 *
 *  2. normalizarVariables(rawVariables) aplica o índice por campo:
 *     - Normaliza a chave SM → lowercase + trim
 *     - Consulta o índice: O(1) por campo
 *     - Hit  → usa o nome canônico
 *     - Miss → preserva com prefixo 'unmapped_' para análise posterior
 *
 * Design principles:
 *  - Zero if/else por campo — mapeamento puro por dicionário
 *  - Transparente: campo desconhecido nunca é silenciado
 *  - Stateless: nenhuma mutação de estado global após o build do índice
 *  - Extensível: novos aliases → apenas 1 linha em semantic_aliases.js
 *
 * Para adicionar um novo alias sem quebrar nada:
 *   → Edite SOMENTE semantic_aliases.js. Este arquivo não precisa mudar.
 */

import { SEMANTIC_ALIASES } from './semantic_aliases.js'

// ─── Construção do índice invertido ───────────────────────────────────────────
// Executado uma única vez no module load.
// Resultado: ALIAS_INDEX.get('geracaomensal') === 'geracao_mensal_kwh'

/**
 * @type {Map<string, string>}
 * Map<lowercase_alias → canonical_field_name>
 */
const ALIAS_INDEX = new Map()

for (const [canonical, aliases] of Object.entries(SEMANTIC_ALIASES)) {
  // A chave canônica também é um alias válido de si mesma
  ALIAS_INDEX.set(canonical.toLowerCase(), canonical)

  for (const alias of aliases) {
    const key = alias.toLowerCase().trim()

    // Detecta colisão: dois canônicos mapeando para o mesmo alias
    if (ALIAS_INDEX.has(key) && ALIAS_INDEX.get(key) !== canonical) {
      console.warn(
        `[SM:variablesNormalizer] ⚠️  Alias duplicado detectado: ` +
        `"${alias}" já mapeia para "${ALIAS_INDEX.get(key)}", ` +
        `ignorando mapeamento para "${canonical}". ` +
        `Corrija semantic_aliases.js.`
      )
      continue
    }

    ALIAS_INDEX.set(key, canonical)
  }
}

// Exporta o índice para inspeção/teste
export { ALIAS_INDEX }

// ─── Normalização principal ───────────────────────────────────────────────────

/**
 * Normaliza o objeto `variables` de uma proposta SolarMarket para o
 * contrato canônico do ProjetoFV v3.
 *
 * Comportamento por tipo de chave:
 *  - Alias conhecido → substitui pelo nome canônico, preserva valor
 *  - Chave canônica direta → mantém (ela própria é um alias de si)
 *  - Desconhecida → prefixo 'unmapped_' + chave original, preserva valor
 *
 * @param {object} rawVariables   Objeto `variables` bruto da proposta SM
 * @param {object} [opcoes]
 * @param {boolean} [opcoes.preservarOriginais=false]
 *    Se true, inclui também as chaves originais no output com prefixo '_raw_'
 *    (útil para debugging / auditoria).
 * @returns {NormalizadoVariables}
 *
 * @typedef {object} NormalizadoVariables
 * @property {*}      [campo_canonico]   Valor mapeado para o nome canônico
 * @property {*}      [unmapped_campo]   Campo sem alias conhecido (preservado)
 * @property {string[]} _campos_mapeados    Canônicos que foram preenchidos
 * @property {string[]} _campos_unmapped    Chaves que não tiveram alias
 */
export function normalizarVariables(rawVariables, { preservarOriginais = false } = {}) {
  if (!rawVariables || typeof rawVariables !== 'object' || Array.isArray(rawVariables)) {
    return { _campos_mapeados: [], _campos_unmapped: [] }
  }

  const result          = {}
  const camposMapeados  = []
  const camposUnmapped  = []

  for (const [chaveOriginal, valor] of Object.entries(rawVariables)) {
    // Normaliza chave para lookup (case-insensitive)
    const chaveNorm = chaveOriginal.toLowerCase().trim()
    const canonical = ALIAS_INDEX.get(chaveNorm)

    if (canonical) {
      // ── Hit: alias conhecido ──────────────────────────────────────────────
      // Não sobrescreve se já foi preenchido por um alias anterior no mesmo obj
      if (!(canonical in result)) {
        result[canonical] = valor
        camposMapeados.push(canonical)
      }
      // Se dois aliases do mesmo campo aparecem no mesmo objeto SM,
      // o primeiro vence (ordem de Object.entries — determinística em V8).
    } else {
      // ── Miss: campo desconhecido → preserva com prefixo ──────────────────
      result[`unmapped_${chaveOriginal}`] = valor
      camposUnmapped.push(chaveOriginal)
    }

    // Inclui chave original para auditoria, se solicitado
    if (preservarOriginais) {
      result[`_raw_${chaveOriginal}`] = valor
    }
  }

  // Metadados de rastreabilidade embutidos no resultado
  result._campos_mapeados = camposMapeados
  result._campos_unmapped  = camposUnmapped

  return result
}

// ─── Estatísticas do índice ───────────────────────────────────────────────────

/**
 * Retorna métricas sobre o índice de aliases carregado.
 * Útil para logging e monitoramento da cobertura do mapa.
 *
 * @returns {{ total_aliases: number, total_canonicos: number, canonicos: string[] }}
 */
export function estatisticasAliasIndex() {
  return {
    total_aliases:   ALIAS_INDEX.size,
    total_canonicos: Object.keys(SEMANTIC_ALIASES).length,
    canonicos:       Object.keys(SEMANTIC_ALIASES),
  }
}

/**
 * Retorna o nome canônico para um alias SM dado (para inspeção).
 *
 * @param {string} aliasSM  Nome da variável como vem do SM (qualquer case)
 * @returns {string|null}   Nome canônico ou null se não mapeado
 */
export function resolverAlias(aliasSM) {
  return ALIAS_INDEX.get(aliasSM.toLowerCase().trim()) || null
}
