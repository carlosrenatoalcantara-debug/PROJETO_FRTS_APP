/**
 * geminiDatasheetAnalyzer.js — Sprint 8.0
 *
 * Analisa datasheets (PDF/imagem) multimodalmente, REAPROVEITANDO o extrator
 * Gemini existente (extrairComGemini) — não cria parser concorrente. Normaliza
 * a saída para o formato por-campo { valor, fonte, confianca } usado na revisão
 * humana e na ingestão inteligente.
 */
import { extrairComGemini } from '../controllers/datasheetGeminiUnificado.js'

// Campos esperados por tipo (para marcar ausências na revisão humana)
export const CAMPOS_ESPERADOS = {
  modulo: ['fabricante', 'modelo', 'potencia', 'tecnologia', 'tipo_celula', 'bifacial',
    'voc', 'vmp', 'isc', 'imp', 'eficiencia', 'coef_temp_voc', 'coef_temp_pmax', 'noct',
    'dimensoes', 'peso', 'garantia_produto', 'garantia_performance', 'degradacao_anual'],
  inversor: ['fabricante', 'modelo', 'potencia_ca', 'potencia_cc_max', 'mppts',
    'strings_por_mppt', 'corrente_max_mppt', 'corrente_curto_mppt', 'tensao_max_cc',
    'faixa_mppt_min', 'faixa_mppt_max', 'fases', 'tensao_saida', 'garantia'],
  carregador_ev: ['fabricante', 'modelo', 'potencia', 'tensao', 'corrente', 'fases',
    'conector', 'ocpp', 'protecoes', 'garantia'],
}

// Confiança default por fonte (heurística — refinável quando o extrator retornar score)
const CONF_GEMINI = 0.9

function aplanar(obj, prefixo = '') {
  // Achata um nível de objetos (ex.: especificacoes) para campos simples
  const out = {}
  for (const [k, v] of Object.entries(obj || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, aplanar(v, ''))
    else out[k] = v
  }
  return out
}

/**
 * @param {Buffer} buffer  PDF/imagem do datasheet
 * @param {string} tipo    'modulo' | 'inversor' | 'carregador_ev' | 'auto'
 * @returns {Promise<{ tipo, campos: Record<string,{valor,fonte,confianca}>, bruto, confianca_global }>}
 */
export async function analisarDatasheet(buffer, tipo = 'auto') {
  const bruto = await extrairComGemini(buffer, tipo)
  const tipoDetectado = bruto?.tipo || (tipo !== 'auto' ? tipo : 'modulo')
  const flat = aplanar(bruto)

  const campos = {}
  for (const [k, valor] of Object.entries(flat)) {
    if (k.startsWith('_')) continue // metadados de cache
    if (valor == null || valor === '') continue
    campos[k] = { valor, fonte: bruto?._cache_hit ? 'Gemini (cache)' : 'Gemini', confianca: CONF_GEMINI }
  }

  return {
    tipo: tipoDetectado,
    campos,
    bruto,
    confianca_global: CONF_GEMINI,
    cache_hit: Boolean(bruto?._cache_hit),
  }
}

export default { analisarDatasheet, CAMPOS_ESPERADOS }
