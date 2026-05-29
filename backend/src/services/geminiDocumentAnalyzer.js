/**
 * geminiDocumentAnalyzer.js — Sprint 8.2
 *
 * Analisador de DOCUMENTOS técnicos (certificado/manual/garantia/declaração),
 * separado do analisador de datasheet. Reaproveita o extrator Gemini existente
 * e pós-processa para certificações (INMETRO/IEC/ABNT), laboratório e a
 * EXPANSÃO DE FAMÍLIA de modelos cobertos. NÃO aprova automaticamente.
 */
import { extrairComGemini } from '../controllers/datasheetGeminiUnificado.js'

const NORMAS_CONHECIDAS = [
  { re: /IEC\s*62116/i, norma: 'IEC 62116' },
  { re: /IEC\s*61727/i, norma: 'IEC 61727' },
  { re: /IEC\s*62109/i, norma: 'IEC 62109' },
  { re: /IEC\s*61000/i, norma: 'IEC 61000' },
  { re: /NBR\s*16149/i, norma: 'ABNT NBR 16149' },
  { re: /NBR\s*16150/i, norma: 'ABNT NBR 16150' },
]
const LABS = ['TÜV', 'TUV', 'SGS', 'Intertek', 'UL', 'CSA', 'Bureau Veritas']

export function detectarNormas(texto = '') {
  return NORMAS_CONHECIDAS.filter((n) => n.re.test(texto)).map((n) => n.norma)
}
export function detectarLaboratorio(texto = '') {
  for (const l of LABS) if (new RegExp(l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(texto)) return l.replace('TUV', 'TÜV')
  return null
}
export function detectarTipoDocumento(texto = '') {
  if (/certificad|certificate|IEC\s*\d|INMETRO/i.test(texto)) return 'certificado'
  if (/manual|installation|instala[çc]/i.test(texto)) return 'manual'
  if (/garantia|warranty/i.test(texto)) return 'garantia'
  if (/declara[çc]|declaration/i.test(texto)) return 'declaracao'
  return 'datasheet'
}

/**
 * Expande uma faixa de família de modelos. Ex.: "SUN 75-125K" → lista por passo.
 * Heurística (fallback) — quando o Gemini listar os modelos cobertos, usa-os.
 * @param {string} nominal  texto original (ex.: "SUN 75-125K")
 * @param {number} passo    incremento (default 5)
 * @returns {string[]}
 */
export function expandirFamiliaModelos(nominal, passo = 5) {
  if (!nominal) return []
  // Captura prefixo + faixa "A-B" + sufixo (ex.: K, kW)
  const m = String(nominal).match(/([A-Za-z][\w-]*?)[\s-]*?(\d+)\s*[-–a]\s*(\d+)\s*([A-Za-z]*)/)
  if (!m) {
    // sem faixa → modelo único normalizado
    const u = String(nominal).trim().replace(/\s+/g, '-')
    return u ? [u] : []
  }
  const prefixo = m[1].replace(/[\s-]+$/, '')
  let ini = parseInt(m[2], 10)
  let fim = parseInt(m[3], 10)
  const suf = m[4] || ''
  if (fim < ini) [ini, fim] = [fim, ini]
  if ((fim - ini) / passo > 60) return [`${prefixo}-${ini}${suf}`, `${prefixo}-${fim}${suf}`] // evita explosão
  const out = []
  for (let n = ini; n <= fim; n += passo) out.push(`${prefixo}-${n}${suf}`)
  if (out[out.length - 1] !== `${prefixo}-${fim}${suf}`) out.push(`${prefixo}-${fim}${suf}`)
  return out
}

/**
 * Analisa um documento técnico (PDF/imagem). Reaproveita Gemini + pós-processa.
 * @returns {{ tipo, certificacao, modelos_nominais, modelos_mapeados, confianca, bruto, revisao_humana:true }}
 */
export async function analisarDocumentoTecnico(buffer, { textoBruto = null } = {}) {
  let bruto = null
  try { bruto = await extrairComGemini(buffer, 'auto') } catch (e) { bruto = { _erro: e.message } }
  const texto = textoBruto || JSON.stringify(bruto || {})

  const normas = detectarNormas(texto)
  const laboratorio = detectarLaboratorio(texto)
  const tipo = detectarTipoDocumento(texto)
  const inmetro = (texto.match(/INMETRO[^\d]{0,20}(\d[\d.\-/]+)/i) || [])[1] || null
  const nominal = bruto?.modelos_nominais || bruto?.modelos || bruto?.modelo || null
  const modelos_mapeados = bruto?.modelos_cobertos && Array.isArray(bruto.modelos_cobertos)
    ? bruto.modelos_cobertos
    : (nominal ? expandirFamiliaModelos(nominal) : [])

  return {
    tipo,
    certificacao: { normas, laboratorio, inmetro_registro: inmetro },
    modelos_nominais: nominal,
    modelos_mapeados,
    confianca: bruto?._erro ? 0 : 0.9,
    bruto,
    revisao_humana: true,
  }
}

export default { analisarDocumentoTecnico, expandirFamiliaModelos, detectarNormas, detectarLaboratorio, detectarTipoDocumento }
