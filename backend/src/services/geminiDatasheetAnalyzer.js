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
  // S8.6.1 FIX: extrairComGemini retorna { sucesso, tipoDocumento, dados, ... }.
  // O nome do tipo é `tipoDocumento` (não `tipo`), e os campos REAIS estão em `dados`.
  // O bug anterior usava bruto?.tipo (undefined) e dependia do flatten para alcançar dados.
  const tipoDetectado = bruto?.tipoDocumento || bruto?.tipo || (tipo !== 'auto' ? tipo : 'modulo')
  // Achata `dados` PRIMEIRO (preserva nomes reais do JSON), depois acrescenta campos do envelope.
  const fonteDados = bruto?.dados || bruto
  const flat = aplanar(fonteDados)

  const campos = {}
  // Whitelist de metadados a NÃO promover para campos do equipamento
  const META = new Set(['sucesso', 'tipoDocumento', 'fonte', 'timestamp', 'erro', 'dados', '_cache_hit', '_hash_pdf', '_hits', '_texto_bruto'])
  for (const [k, valor] of Object.entries(flat)) {
    if (k.startsWith('_') || META.has(k)) continue
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
