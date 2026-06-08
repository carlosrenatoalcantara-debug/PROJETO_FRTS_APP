/**
 * serieInversor.js — P0-INV-01A (parser multi-variante para o caminho de TEXTO)
 *
 * Quando não há IA (fallback de texto), o motor interno só achava 1 modelo (o
 * primeiro match). Aqui detectamos MÚLTIPLOS modelos de uma série a partir do
 * texto OCR, em dois formatos reais:
 *
 *   1. Enumeração/faixa:  "MID 15-20-25KTL3-X"  ou  "GW 17/20/25K-DT"
 *   2. Lista explícita:   "MID15KTL3-X ... MID20KTL3-X ... MID25KTL3-X"
 *
 * Honesto: o caminho de texto recupera apenas IDENTIDADE (modelos). Os dados
 * técnicos por modelo continuam dependendo de um provider de IA.
 *
 * PURO. Conservador (evita inventar modelos): só expande quando há prefixo
 * alfabético + números + sufixo técnico coerentes.
 */

import { extrairFabricanteModelo } from '../utils/catalogo/fabricanteModeloFallback.js'

/**
 * @param {string} texto  texto OCR
 * @returns {{ fabricante: ?string, modelos: string[] }}
 */
export function expandirModelosInversor(texto) {
  if (!texto || typeof texto !== 'string') return { fabricante: null, modelos: [] }

  const base = extrairFabricanteModelo(texto)
  const modelos = new Set()

  // ── 1. Enumeração/faixa: PREFIX <n1>[-/]<n2>[-/]<n3> SUFFIX ────────────────
  //    Ex.: MID 15-20-25KTL3-X | GW 17/20/25K-DT | SUN 30/40/50K-G
  const reEnum = /\b([A-Z]{2,4})\s*((?:\d{1,3}\s*[-/]\s*){1,}\d{1,3})\s*([A-Z]{0,2}\d?-?[A-Z]{1,3}\d?-?[A-Z0-9]*)/gi
  for (const m of texto.matchAll(reEnum)) {
    const prefixo = m[1].toUpperCase()
    const nums = m[2].split(/[-/]/).map(s => s.trim()).filter(Boolean)
    const sufixo = (m[3] || '').toUpperCase()
    if (nums.length >= 2 && sufixo) {
      for (const n of nums) modelos.add(`${prefixo}${n}${sufixo}`.replace(/\s+/g, ''))
    }
  }

  // ── 2. Lista explícita: coleta TODOS os matches que compartilham o prefixo ──
  //    alfabético do modelo-base (não só o primeiro, como antes).
  if (base.modelo) {
    const prefixoBase = (base.modelo.match(/^[A-Z]+/i) || [''])[0].toUpperCase()
    if (prefixoBase.length >= 2) {
      const reLista = new RegExp(`\\b(${prefixoBase}\\s*\\d{1,3}[A-Z0-9-]*)\\b`, 'gi')
      for (const m of texto.matchAll(reLista)) {
        modelos.add(m[1].replace(/\s+/g, '').toUpperCase())
      }
    }
    modelos.add(base.modelo.toUpperCase())
  }

  // ── 3. Remove modelos FANTASMA (P1-PARSER-CHINT-HUAWEI-FIX-01) ──────────────
  //    Ex.: título combinado "CPS SCA50/60KTL-T" gera "CPSSCA50" (marca colada +
  //    potência inicial), que é PREFIXO de "SCA50KTL-T". Quando o "core" de um modelo
  //    (sem a marca de 2–6 letras à esquerda) é prefixo de OUTRO modelo mais completo,
  //    descarta o incompleto.
  const arr = [...modelos]
  const norm = s => s.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const BRAND = /^(?:CPS|CHINT|HUAWEI|SUNGROW|GOODWE|GROWATT|SOLAX|SOLIS|DEYE|SAJ|KEHUA|GW|SG)/
  const limpo = arr.filter(a => {
    const na = norm(a); const core = na.replace(BRAND, '')
    if (core.length < 4 || core === na) return true            // sem marca colada → mantém
    return !arr.some(b => { const nb = norm(b); return nb !== na && nb.startsWith(core) })
  })

  return { fabricante: base.fabricante, modelos: limpo }
}

/**
 * Converte para o formato de `variantes` consumido por normalizarMulti
 * (modelo_variante, sem specs — caminho de texto).
 * @param {string} texto
 * @returns {{ fabricante: ?string, modelo: ?string, tipo: 'inversor', variantes: Array }}
 */
export function rawMultiDeTexto(texto) {
  const { fabricante, modelos } = expandirModelosInversor(texto)
  return {
    fabricante,
    modelo: modelos[0] || null,
    tipo: 'inversor',
    variantes: modelos.map(modelo_variante => ({ modelo_variante })),
  }
}
