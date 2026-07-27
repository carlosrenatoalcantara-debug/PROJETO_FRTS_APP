/**
 * aeHttpProvider.js — Adaptador IAEProvider sobre a API pública do AE
 *
 * Intercambiável com o adaptador de diretório: mesmo contrato, mesma saída.
 * Nem o orquestrador nem as rotas percebem a troca.
 *
 * Endpoints consumidos (somente leitura):
 *   GET {AE_URL}/library/index                     → índice de datasheets
 *   GET {AE_URL}/library/datasheet?ref={ref}       → product.json
 *
 * O Forte Solar nunca escreve no AE.
 */

import { FAMILIAS_AE, resolverFamilia } from './IAEProvider.js'

const TIMEOUT_PADRAO_MS = 15000

function pick(obj, ...chaves) {
  for (const chave of chaves) {
    const v = obj?.[chave]
    if (v !== null && v !== undefined && v !== '') return v
  }
  return null
}

/**
 * Normaliza a resposta do AE para o formato do contrato, tolerando variações
 * de grafia nos metadados (Origin/origin, KnowledgeVersion/knowledgeVersion).
 */
function normalizarDatasheet(bruto, ref) {
  const familia = resolverFamilia(pick(bruto, 'familia', 'Family', 'tipo'))
  const confidence = Number.parseFloat(pick(bruto, 'confidence', 'Confidence'))
  return {
    origin: pick(bruto, 'origin', 'Origin') || 'AE',
    documentType: pick(bruto, 'documentType', 'DocumentType') || 'Technical Datasheet',
    familia,
    fabricante: pick(bruto, 'fabricante', 'Manufacturer', 'manufacturer'),
    modelo: pick(bruto, 'modelo', 'Model', 'model'),
    knowledgeVersion: pick(bruto, 'knowledgeVersion', 'KnowledgeVersion', 'knowledge_version'),
    lastAudit: pick(bruto, 'lastAudit', 'LastAudit', 'last_audit'),
    confidence: Number.isFinite(confidence) ? confidence : null,
    dados: (bruto?.dados && typeof bruto.dados === 'object') ? bruto.dados
      : (bruto?.specs && typeof bruto.specs === 'object') ? bruto.specs
        : {},
    ref,
  }
}

/**
 * @param {object} opcoes
 * @param {string} opcoes.baseUrl        base da API pública do AE
 * @param {number} [opcoes.timeoutMs]
 * @param {typeof fetch} [opcoes.fetchImpl]  injetável para teste
 * @returns {object} implementação de IAEProvider
 */
export function criarAeHttpProvider({ baseUrl, timeoutMs = TIMEOUT_PADRAO_MS, fetchImpl } = {}) {
  if (!baseUrl) throw new Error('aeHttpProvider: "baseUrl" é obrigatória.')
  const base = String(baseUrl).replace(/\/+$/, '')
  const doFetch = fetchImpl || globalThis.fetch
  if (typeof doFetch !== 'function') {
    throw new Error('aeHttpProvider: fetch indisponível neste runtime.')
  }

  async function requisitar(caminho) {
    const controlador = new AbortController()
    const timer = setTimeout(() => controlador.abort(), timeoutMs)
    try {
      const res = await doFetch(`${base}${caminho}`, {
        headers: { Accept: 'application/json' },
        signal: controlador.signal,
      })
      if (!res.ok) {
        const e = new Error(`AE respondeu HTTP ${res.status} em ${caminho}`)
        e.code = res.status === 404 ? 'AE_DATASHEET_AUSENTE' : 'AE_HTTP_ERRO'
        throw e
      }
      return await res.json()
    } catch (err) {
      if (err.name === 'AbortError') {
        const e = new Error(`Tempo limite ao consultar o AE (${timeoutMs} ms).`)
        e.code = 'AE_TIMEOUT'
        throw e
      }
      if (!err.code) err.code = 'AE_INDISPONIVEL'
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    descrever() {
      return { tipo: 'http', origem: base }
    },

    async listarIndice() {
      const corpo = await requisitar('/library/index')
      const itens = Array.isArray(corpo) ? corpo : (corpo?.itens || corpo?.items || [])

      return itens.reduce((acc, item) => {
        const familia = resolverFamilia(pick(item, 'familia', 'Family', 'tipo'))
        // Fora do escopo do AE (cabos, DPS, estruturas…) é descartado.
        if (!familia || !FAMILIAS_AE.includes(familia)) return acc

        const ref = pick(item, 'ref', 'id', 'path')
        if (!ref) return acc

        acc.push({
          familia,
          fabricante: pick(item, 'fabricante', 'Manufacturer', 'manufacturer'),
          modelo: pick(item, 'modelo', 'Model', 'model'),
          knowledgeVersion: pick(item, 'knowledgeVersion', 'KnowledgeVersion', 'knowledge_version'),
          ref: String(ref),
        })
        return acc
      }, [])
    },

    async obterDatasheet(ref) {
      const corpo = await requisitar(`/library/datasheet?ref=${encodeURIComponent(ref)}`)
      return normalizarDatasheet(corpo, ref)
    },
  }
}
