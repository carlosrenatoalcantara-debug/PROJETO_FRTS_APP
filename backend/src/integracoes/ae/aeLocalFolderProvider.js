/**
 * aeLocalFolderProvider.js — Adaptador IAEProvider para biblioteca em diretório
 *
 * Lê a biblioteca do AE a partir do sistema de arquivos:
 *
 *   {raiz}/{familia}/{fabricante}/{modelo}/product.json
 *                                          product.md
 *
 * O índice é montado a partir de `product.json` (fonte estruturada). O
 * `product.md` representa o mesmo conhecimento em forma legível e é usado
 * apenas como fallback do frontmatter quando o JSON não traz metadados.
 *
 * PDFs são insumos da auditoria do AE e são ignorados aqui.
 *
 * Este adaptador é intercambiável com qualquer outro (HTTP, Git, S3, ZIP):
 * a Auditoria Rápida não sabe qual está em uso.
 */

import fs from 'node:fs'
import path from 'node:path'
import { FAMILIAS_AE, resolverFamilia } from './IAEProvider.js'

const ARQUIVO_JSON = 'product.json'
const ARQUIVO_MD = 'product.md'

// ─── Leitura de metadados ────────────────────────────────────────────────────

/**
 * Extrai pares chave: valor do frontmatter YAML do product.md.
 * Parser deliberadamente mínimo: o contrato do Datasheet Técnico AE define
 * apenas campos escalares no cabeçalho.
 *
 * @param {string} texto
 * @returns {object}
 */
export function lerFrontmatter(texto) {
  if (typeof texto !== 'string') return {}
  const linhas = texto.split(/\r?\n/)
  let inicio = 0
  // Frontmatter delimitado por --- é opcional.
  if (linhas[0]?.trim() === '---') {
    inicio = 1
  }
  const meta = {}
  for (let i = inicio; i < linhas.length; i++) {
    const linha = linhas[i]
    if (linha.trim() === '---') break
    if (inicio === 0 && /^\s*#/.test(linha)) break // começou o corpo markdown
    const m = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(linha)
    if (!m) continue
    const valor = m[2].trim().replace(/^["']|["']$/g, '')
    meta[m[1]] = valor === '' ? null : valor
  }
  return meta
}

/** Primeiro valor não vazio entre várias grafias possíveis de uma chave. */
function pick(obj, ...chaves) {
  for (const chave of chaves) {
    const v = obj?.[chave]
    if (v !== null && v !== undefined && v !== '') return v
  }
  return null
}

function lerJsonSeguro(arquivo) {
  try {
    return JSON.parse(fs.readFileSync(arquivo, 'utf-8'))
  } catch (err) {
    const e = new Error(`product.json inválido em ${arquivo}: ${err.message}`)
    e.code = 'AE_JSON_INVALIDO'
    throw e
  }
}

/**
 * Consolida os metadados oficiais de um Datasheet Técnico AE.
 * Precedência: product.json > frontmatter do product.md > caminho no disco.
 */
function montarMetadados(json, frontmatter, { familiaPasta, fabricantePasta, modeloPasta }) {
  const familia =
    resolverFamilia(pick(json, 'familia', 'Family', 'tipo')) ||
    resolverFamilia(pick(frontmatter, 'Family', 'Familia', 'Tipo')) ||
    resolverFamilia(familiaPasta)

  return {
    familia,
    fabricante: pick(json, 'fabricante', 'Manufacturer', 'manufacturer')
      || pick(frontmatter, 'Manufacturer', 'Fabricante')
      || fabricantePasta,
    modelo: pick(json, 'modelo', 'Model', 'model')
      || pick(frontmatter, 'Model', 'Modelo')
      || modeloPasta,
    knowledgeVersion: pick(json, 'knowledgeVersion', 'KnowledgeVersion', 'knowledge_version')
      ?? pick(frontmatter, 'KnowledgeVersion', 'Knowledge_Version'),
    lastAudit: pick(json, 'lastAudit', 'LastAudit', 'last_audit')
      ?? pick(frontmatter, 'LastAudit', 'Last_Audit'),
    confidence: (() => {
      const c = pick(json, 'confidence', 'Confidence') ?? pick(frontmatter, 'Confidence')
      const n = Number.parseFloat(c)
      return Number.isFinite(n) ? n : null
    })(),
    origin: pick(json, 'origin', 'Origin') || pick(frontmatter, 'Origin') || 'AE',
    documentType: pick(json, 'documentType', 'DocumentType')
      || pick(frontmatter, 'DocumentType') || 'Technical Datasheet',
  }
}

/**
 * Conhecimento técnico propriamente dito, separado dos metadados.
 * Aceita tanto `{ dados: {...} }` quanto o objeto plano com metadados no topo.
 */
const CHAVES_META = new Set([
  'origin', 'Origin', 'documentType', 'DocumentType', 'familia', 'Family', 'tipo',
  'fabricante', 'Manufacturer', 'manufacturer', 'modelo', 'Model', 'model',
  'knowledgeVersion', 'KnowledgeVersion', 'knowledge_version',
  'lastAudit', 'LastAudit', 'last_audit', 'confidence', 'Confidence',
])

function extrairDados(json) {
  if (json && typeof json.dados === 'object' && json.dados !== null) return json.dados
  if (json && typeof json.specs === 'object' && json.specs !== null) return json.specs
  const dados = {}
  for (const [k, v] of Object.entries(json || {})) {
    if (!CHAVES_META.has(k)) dados[k] = v
  }
  return dados
}

// ─── Varredura ───────────────────────────────────────────────────────────────

function subdiretorios(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
  } catch {
    return []
  }
}

/**
 * Cria um provider que lê a biblioteca do AE de um diretório local.
 *
 * @param {object} opcoes
 * @param {string} opcoes.raiz  diretório raiz da biblioteca do AE
 * @returns {object} implementação de IAEProvider
 */
export function criarAeLocalFolderProvider({ raiz } = {}) {
  if (!raiz) throw new Error('aeLocalFolderProvider: "raiz" é obrigatória.')

  /** ref opaca = caminho relativo do diretório do produto */
  const caminhoDoRef = (ref) => path.join(raiz, ref)

  function lerProduto(ref) {
    const dir = caminhoDoRef(ref)
    const arquivoJson = path.join(dir, ARQUIVO_JSON)
    if (!fs.existsSync(arquivoJson)) {
      const e = new Error(`Datasheet Técnico AE ausente: ${path.join(ref, ARQUIVO_JSON)}`)
      e.code = 'AE_DATASHEET_AUSENTE'
      throw e
    }
    const json = lerJsonSeguro(arquivoJson)

    const arquivoMd = path.join(dir, ARQUIVO_MD)
    const frontmatter = fs.existsSync(arquivoMd)
      ? lerFrontmatter(fs.readFileSync(arquivoMd, 'utf-8'))
      : {}

    const partes = ref.split(/[\\/]/)
    const meta = montarMetadados(json, frontmatter, {
      familiaPasta: partes[0],
      fabricantePasta: partes[1],
      modeloPasta: partes[2],
    })

    return { meta, json }
  }

  return {
    descrever() {
      return { tipo: 'local-folder', origem: raiz }
    },

    async listarIndice() {
      if (!fs.existsSync(raiz)) {
        const e = new Error(`Biblioteca AE não encontrada: ${raiz}`)
        e.code = 'AE_BIBLIOTECA_AUSENTE'
        throw e
      }

      const entradas = []
      for (const pastaFamilia of subdiretorios(raiz)) {
        // Fora do escopo do AE (cabos, DPS, estruturas…) é ignorado silenciosamente.
        if (!resolverFamilia(pastaFamilia)) continue

        for (const pastaFabricante of subdiretorios(path.join(raiz, pastaFamilia))) {
          for (const pastaModelo of subdiretorios(path.join(raiz, pastaFamilia, pastaFabricante))) {
            const ref = path.join(pastaFamilia, pastaFabricante, pastaModelo)
            if (!fs.existsSync(path.join(raiz, ref, ARQUIVO_JSON))) continue

            let meta
            try {
              ({ meta } = lerProduto(ref))
            } catch {
              continue // datasheet ilegível não entra no índice
            }
            if (!meta.familia || !FAMILIAS_AE.includes(meta.familia)) continue

            entradas.push({
              familia: meta.familia,
              fabricante: meta.fabricante,
              modelo: meta.modelo,
              knowledgeVersion: meta.knowledgeVersion ?? null,
              ref,
            })
          }
        }
      }
      return entradas
    },

    async obterDatasheet(ref) {
      const { meta, json } = lerProduto(ref)
      return {
        origin: meta.origin,
        documentType: meta.documentType,
        familia: meta.familia,
        fabricante: meta.fabricante,
        modelo: meta.modelo,
        knowledgeVersion: meta.knowledgeVersion ?? null,
        lastAudit: meta.lastAudit ?? null,
        confidence: meta.confidence,
        dados: extrairDados(json),
        ref,
      }
    },
  }
}
