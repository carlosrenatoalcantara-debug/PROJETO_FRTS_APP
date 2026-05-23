/**
 * concessionariaDictionaryService.js
 *
 * Serviço de resolução de concessionárias via Biblioteca Nacional de Concessionárias.
 * Substitui a lógica anterior baseada em aliases hardcoded e fórmula de confiança por
 * comprimento de string (alias.length / 25 + 0.4), que produzia valores não-determinísticos.
 *
 * Comportamento:
 *   - Normaliza o termo de busca (lowercase, sem acento)
 *   - Consulta o índice de aliases pré-construído (O(1) por lookup)
 *   - Retorna o match de maior confiança ou null
 *   - Confiança derivada do nivel semântico: nivel 1 → 0.70 | nivel 2 → 0.90 | nivel 3 → 1.00
 *
 * NÃO usa IA, embeddings ou chamadas externas.
 * 100% determinístico e auditável.
 */

import {
  buscarPorAlias,
  resolverMelhorMatch,
  buscarPorId,
  buscarPorEstado,
  listarTodas,
} from '../data/concessionarias/index.js'

// ─── Helpers internos ────────────────────────────────────────────────────────

/**
 * Normaliza string para matching (mesma função do index.js — duplicada aqui
 * para manter o serviço autossuficiente em testes unitários).
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

/**
 * Extrai candidatos do texto livre por janela deslizante de n-gramas.
 * Testa janelas de 1 a MAX_NGRAM palavras, retornando todos os matches únicos.
 *
 * @param {string} texto — texto bruto do documento
 * @param {number} [maxNgram=5] — tamanho máximo da janela
 * @returns {Array<{distribuidora, nivel, confianca, termo_original, termo_testado}>}
 */
function _extrairCandidatosPorNgrama(texto, maxNgram = 5) {
  const palavras = _normalizar(texto).split(' ').filter(Boolean)
  const vistos   = new Set()
  const resultado = []

  for (let inicio = 0; inicio < palavras.length; inicio++) {
    for (let tam = 1; tam <= Math.min(maxNgram, palavras.length - inicio); tam++) {
      const candidato = palavras.slice(inicio, inicio + tam).join(' ')
      if (vistos.has(candidato)) continue
      vistos.add(candidato)

      const matches = buscarPorAlias(candidato)
      for (const m of matches) {
        resultado.push({ ...m, termo_testado: candidato })
      }
    }
  }

  // Ordena por confiança desc, deduplicando por distribuidora.id (mantém o de maior confiança)
  const porId = new Map()
  for (const m of resultado) {
    const id = m.distribuidora.id
    if (!porId.has(id) || m.confianca > porId.get(id).confianca) {
      porId.set(id, m)
    }
  }

  return [...porId.values()].sort((a, b) => b.confianca - a.confianca || b.nivel - a.nivel)
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Identifica a concessionária de um documento a partir de texto livre.
 *
 * Estratégia em cascata:
 *   1. Busca exata pelo termo normalizado (O(1))
 *   2. N-grama deslizante sobre o texto (O(palavras × maxNgram))
 *
 * @param {string} texto — texto extraído do documento (nome da concessionária, cabeçalho, etc.)
 * @returns {{
 *   distribuidora: object|null,
 *   confianca: number,
 *   nivel: number|null,
 *   termo_identificado: string|null,
 *   metodo: 'exato'|'ngrama'|'nenhum'
 * }}
 */
export function identificarConcessionaria(texto) {
  if (!texto || typeof texto !== 'string') {
    return { distribuidora: null, confianca: 0, nivel: null, termo_identificado: null, metodo: 'nenhum' }
  }

  // 1 — Busca exata
  const exato = resolverMelhorMatch(texto)
  if (exato) {
    return {
      distribuidora:    exato.distribuidora,
      confianca:        exato.confianca,
      nivel:            exato.nivel,
      termo_identificado: exato.termo_original,
      metodo:           'exato',
    }
  }

  // 2 — N-grama sobre o texto
  const candidatos = _extrairCandidatosPorNgrama(texto)
  if (candidatos.length > 0) {
    const top = candidatos[0]
    return {
      distribuidora:    top.distribuidora,
      confianca:        top.confianca,
      nivel:            top.nivel,
      termo_identificado: top.termo_testado,
      metodo:           'ngrama',
    }
  }

  return { distribuidora: null, confianca: 0, nivel: null, termo_identificado: null, metodo: 'nenhum' }
}

/**
 * Retorna todos os candidatos identificados no texto (útil para debug/auditoria).
 * Inclui confiança, nivel e método de match.
 *
 * @param {string} texto
 * @returns {Array<{distribuidora, confianca, nivel, termo_testado}>}
 */
export function listarCandidatos(texto) {
  if (!texto || typeof texto !== 'string') return []
  return _extrairCandidatosPorNgrama(texto)
}

/**
 * Busca distribuidora por id canônico (ex.: 'CEMIG', 'COSERN').
 * @param {string} id
 * @returns {object|null}
 */
export function buscarDistribuidoraPorId(id) {
  return buscarPorId(id)
}

/**
 * Retorna todas as distribuidoras de um estado.
 * @param {string} uf — ex.: 'MG', 'SP'
 * @returns {object[]}
 */
export function distribuidorasPorEstado(uf) {
  return buscarPorEstado(uf)
}

/**
 * Retorna os padrões de campos de uma distribuidora pelo seu id.
 * Usado pelo parecerNormalizerService para saber quais labels procurar.
 *
 * @param {string} idDistribuidora
 * @returns {object|null} — { numero_parecer[], potencia_aprovada_kw[], tensao_conexao[], disjuntor_geral_a[] }
 */
export function padroesDecampos(idDistribuidora) {
  const dist = buscarPorId(idDistribuidora)
  return dist?.padroes_campos ?? null
}

/**
 * Lista todas as distribuidoras cadastradas na biblioteca.
 * @returns {object[]}
 */
export function listarTodasDistribuidoras() {
  return listarTodas()
}

// ─── Compatibilidade com indexador legado (CommonJS) ─────────────────────────
//
// O arquivo legado concessionarias/index.js (CommonJS) expunha:
//
//   encontrarPorTexto(texto) → objeto | null
//
// Problemas do legado que esta versão corrige:
//
//   1. find() curto-circuitava no PRIMEIRO alias que batia — sem ranking.
//      Alias curto ("cpfl") vencia sobre alias específico ("cpfl paulista")
//      dependendo da ordem no array, produzindo matches errados.
//
//   2. Sem normalização de acentos — "Companhia Energética" não batia com
//      "companhia energetica" extraído por OCR.
//
//   3. includes() simples — "cosern" dentro de "subcosern" produzia falso positivo.
//      O indexador novo usa lookup por chave exata no Map (sem substring acidental).
//
//   4. Grupo Enel comentado fora do array — qualquer documento com "Enel" ou
//      "Eletropaulo" retornava null silenciosamente.
//
//   5. CommonJS incompatível com o restante do projeto (ES Modules).
//
// O shim abaixo preserva a assinatura pública para código existente que ainda
// importe esta função pelo nome legado, sem reativar nenhum dos bugs acima.

/**
 * @deprecated Prefira `identificarConcessionaria()` — retorna confiança e método de match.
 * Mantido para compatibilidade com código que usava o indexador legado (CommonJS).
 *
 * @param {string} textoDocumento
 * @returns {object|null} — objeto distribuidora ou null (sem metadados de confiança)
 */
export function encontrarPorTexto(textoDocumento) {
  return identificarConcessionaria(textoDocumento).distribuidora
}
