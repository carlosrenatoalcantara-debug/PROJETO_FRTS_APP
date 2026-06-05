/**
 * ocr.js — P1-INV-OCR-01
 *
 * OCR LOCAL para PDFs SEM camada de texto (scans / datasheets-imagem). 100%
 * offline, sem dependências de sistema (Ghostscript/ImageMagick/Tesseract nativo):
 *   - mupdf (WASM)      → rasteriza cada página em PNG;
 *   - tesseract.js (WASM) → reconhece o texto da imagem.
 *
 * NÃO usa IA generativa, Vision nem APIs externas. O texto do OCR entra EXATAMENTE
 * onde antes entrava o texto do pdf-parse: o parser matricial/textual, o SSOT e a
 * Importação Assistida seguem sem qualquer alteração de contrato (sem pipeline
 * paralelo). Só roda quando NÃO há texto — caminho de exceção.
 *
 * Escolha: mupdf + tesseract.js por NÃO exigirem binário de sistema (o ambiente
 * não tem gs/magick/tesseract). Custo: rasterização ~0,4 s/página + OCR ~3-5 s/
 * página a 200 dpi. Módulo carregado dinamicamente — não pesa no boot.
 */

const _MIN_CHARS = 120          // abaixo disso, tratamos o PDF como imagem
const _DPI = 200                // resolução de rasterização (equilíbrio nitidez/custo)
let _worker = null              // worker tesseract reutilizado entre páginas

/** PDF é "imagem" (precisa de OCR) quando o texto extraído é irrelevante. */
export function precisaOCR(textoPdf, minChars = _MIN_CHARS) {
  return !textoPdf || String(textoPdf).trim().length < minChars
}

async function _getWorker() {
  if (_worker) return _worker
  const { createWorker } = await import('tesseract.js')
  _worker = await createWorker('eng')   // "eng" cobre números/rótulos PT/EN dos datasheets
  return _worker
}

/**
 * Extrai TEXTO via OCR de um PDF imagem. Rasteriza as primeiras páginas (mupdf) e
 * reconhece cada uma (tesseract). NUNCA lança — em falha retorna texto vazio para
 * o chamador seguir o fluxo normal.
 * @returns {Promise<{texto:string, paginas:number, fonte:'ocr'}>}
 */
export async function extrairTextoOCR(pdfBuffer, { maxPaginas = 3, dpi = _DPI } = {}) {
  try {
    const mupdf = await import('mupdf')
    const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf')
    const n = Math.min(doc.countPages(), maxPaginas)
    const mat = mupdf.Matrix.scale(dpi / 72, dpi / 72)
    const worker = await _getWorker()
    const partes = []
    let usadas = 0
    for (let p = 0; p < n; p++) {
      const page = doc.loadPage(p)
      const pix = page.toPixmap(mat, mupdf.ColorSpace.DeviceRGB, false, true)
      const png = Buffer.from(pix.asPNG())
      const { data } = await worker.recognize(png)
      const t = (data?.text || '').trim()
      if (t) { partes.push(t); usadas++ }
    }
    return { texto: partes.join('\n'), paginas: usadas, fonte: 'ocr' }
  } catch (e) {
    return { texto: '', paginas: 0, fonte: 'ocr', erro: e?.message || String(e) }
  }
}

/** Libera o worker (opcional, no shutdown). */
export async function encerrarOCR() {
  if (_worker) { try { await _worker.terminate() } catch { /* noop */ } _worker = null }
}
