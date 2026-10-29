/**
 * geminiModelos.js — FONTE ÚNICA dos modelos Gemini usados no backend.
 *
 * Motivo: o Google aposenta modelos (gemini-2.0-flash → 404 "no longer available"
 * em 2026-10) e cada controller tinha o nome hardcoded, quebrando OCR de fatura,
 * datasheets e parecer ao mesmo tempo, com erro genérico na UI.
 *
 * Ordem: GEMINI_MODEL (env Railway, override sem deploy) → alias rolante
 * 'gemini-flash-latest' → modelos fixados conhecidos. Erro de MODELO
 * (404/aposentado) ou de CAPACIDADE (503/timeout) cai para o próximo;
 * erro de chave/cota propaga.
 */

const MODELOS_FIXOS = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-2.5-flash']

export function modelosGemini() {
  const override = String(process.env.GEMINI_MODEL || '').trim()
  return [...new Set([override, ...MODELOS_FIXOS].filter(Boolean))]
}

export function ehErroDeModelo(err) {
  const msg = String(err?.message || err || '')
  return /not found|not supported|404|does not exist|no longer available/i.test(msg)
}

/** 503/sobrecarga/timeout: capacidade daquele modelo — vale tentar o próximo. */
export function ehErroDeCapacidade(err) {
  const msg = String(err?.message || err || '')
  return /\b503\b|\b500\b|high demand|overloaded|unavailable|timed? ?out|aborted/i.test(msg)
}

const TIMEOUT_MS = 45000

/**
 * Executa generateContent tentando cada modelo em ordem.
 * @param {import('@google/generative-ai').GoogleGenerativeAI} genAI
 * @param {any} conteudo  argumento repassado a model.generateContent
 * @param {Object} [opcoesModelo]  extras de getGenerativeModel (ex: generationConfig)
 * @returns {Promise<{result:any, modelo:string}>}
 */
export async function gerarComFallback(genAI, conteudo, opcoesModelo = {}) {
  let ultimoErro = null
  for (const modelo of modelosGemini()) {
    try {
      const m = genAI.getGenerativeModel({ ...opcoesModelo, model: modelo }, { timeout: TIMEOUT_MS })
      const result = await m.generateContent(conteudo)
      return { result, modelo }
    } catch (err) {
      if (!ehErroDeModelo(err) && !ehErroDeCapacidade(err)) throw err
      console.warn(`[Gemini] modelo ${modelo} indisponível — tentando próximo: ${err.message}`)
      ultimoErro = err
    }
  }
  throw ultimoErro || new Error('Nenhum modelo Gemini disponível')
}
