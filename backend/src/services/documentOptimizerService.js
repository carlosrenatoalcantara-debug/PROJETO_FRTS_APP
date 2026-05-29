/**
 * documentOptimizerService.js — Sprint 8.0.2
 *
 * Otimização de documentos técnicos para reduzir armazenamento mantendo leitura
 * em tela / impressão A4 / homologação.
 *
 * NOTA: compressão real de PDF (re-render, downsample de imagens, remoção de
 * metadados) exige biblioteca dedicada (ex.: ghostscript/pdf-lib/sharp) que NÃO
 * está instalada. Esta camada detecta o tipo, registra métricas e devolve o
 * conteúdo (passthrough) com a estrutura pronta; quando a lib for adicionada,
 * basta implementar `comprimir*` mantendo a interface.
 */

function tamanhoBase64(dataUrl) {
  if (!dataUrl) return 0
  const b64 = String(dataUrl).split(',').pop() || ''
  return Math.floor(b64.length * 3 / 4) // bytes aproximados
}

function detectarTipo(dataUrl, nome = '') {
  const mime = /^data:([^;]+)/.exec(dataUrl || '')?.[1] || ''
  if (mime.includes('pdf') || /\.pdf$/i.test(nome)) return 'pdf'
  if (mime.startsWith('image/')) return 'imagem'
  return 'outro'
}

/**
 * @param {string} dataUrl  conteúdo (dataURL base64)
 * @param {object} opts     { nome, dpiAlvo }
 * @returns {{ conteudo, tipo, tamanho_original, tamanho_final, reducao_pct, dpi_final, otimizado }}
 */
export function otimizarDocumento(dataUrl, { nome = '', dpiAlvo = 120 } = {}) {
  const tipo = detectarTipo(dataUrl, nome)
  const original = tamanhoBase64(dataUrl)

  // Passthrough (sem lib de compressão). Estrutura pronta para implementação real.
  const conteudo = dataUrl
  const final = tamanhoBase64(conteudo)
  const reducao = original > 0 ? +(((original - final) / original) * 100).toFixed(1) : 0

  return {
    conteudo,
    tipo,
    tamanho_original: original,
    tamanho_final: final,
    reducao_pct: reducao,
    dpi_final: tipo === 'pdf' ? dpiAlvo : null,
    otimizado: false, // vira true quando houver compressão real
    nota: 'Compressão real requer biblioteca dedicada (ghostscript/pdf-lib/sharp).',
  }
}

export default { otimizarDocumento }
