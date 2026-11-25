/**
 * compactarPdf.js
 *
 * Os provedores de IA limitam a requisição (Gemini 20 MB, Claude 32 MB) e o PDF
 * vai em base64, que cresce 4/3. Datasheet com foto em alta resolução passa disso
 * (BDM-2500: 15,3 MB numa página, 12,1 MB de uma foto só) e nenhum provedor lê.
 *
 * Acima do limite, as páginas são redesenhadas como JPEG num PDF novo. Só o que
 * vai para a IA muda: o texto continua sendo extraído do arquivo original.
 */

/** 10 MB em binário ≈ 13,4 MB em base64: folga para o prompt nos dois provedores. */
export const LIMITE_PDF_IA_BYTES = 10 * 1024 * 1024

/** Acima disso rasterizar custa demais; o arquivo segue como veio. */
const MAX_PAGINAS = 20
/** Da melhor para a menor qualidade; para na primeira que couber. */
const TENTATIVAS = Object.freeze([
  { dpi: 170, qualidade: 85 },
  { dpi: 130, qualidade: 75 },
  { dpi: 100, qualidade: 65 },
])

/**
 * Devolve o próprio buffer quando ele já cabe, quando tem páginas demais ou
 * quando a compactação falha — nunca lança, e nunca devolve algo maior.
 * @param {Buffer} pdfBuffer
 * @returns {Promise<Buffer>}
 */
export async function compactarPdf(pdfBuffer, { limiteBytes = LIMITE_PDF_IA_BYTES } = {}) {
  if (!pdfBuffer || pdfBuffer.length <= limiteBytes) return pdfBuffer
  let origem = null
  try {
    const mupdf = await import('mupdf')
    origem = mupdf.Document.openDocument(pdfBuffer, 'application/pdf')
    const n = origem.countPages()
    if (n < 1 || n > MAX_PAGINAS) return pdfBuffer

    for (const t of TENTATIVAS) {
      const novo = _redesenhar(mupdf, origem, n, t)
      if (novo.length <= limiteBytes) return novo
    }
    return pdfBuffer
  } catch (e) {
    console.warn('[compactarPdf] seguindo com o original:', e?.message || e)
    return pdfBuffer
  } finally {
    origem?.destroy?.()
  }
}

function _redesenhar(mupdf, origem, paginas, { dpi, qualidade }) {
  const destino = new mupdf.PDFDocument()
  try {
    const escala = mupdf.Matrix.scale(dpi / 72, dpi / 72)
    for (let i = 0; i < paginas; i++) {
      const pagina = origem.loadPage(i)
      const pix = pagina.toPixmap(escala, mupdf.ColorSpace.DeviceRGB, false, true)
      try {
        const [x0, y0, x1, y1] = pagina.getBounds()
        const largura = x1 - x0
        const altura = y1 - y0
        const imagem = new mupdf.Image(pix.asJPEG(qualidade, false))
        const recursos = destino.addObject({ XObject: { Img: destino.addImage(imagem) } })
        destino.insertPage(-1, destino.addPage(
          [0, 0, largura, altura], 0, recursos, `q ${largura} 0 0 ${altura} 0 0 cm /Img Do Q`,
        ))
        imagem.destroy?.()
      } finally {
        pix.destroy?.()
        pagina.destroy?.()
      }
    }
    // `asUint8Array` aponta para a memória do WASM: copiar antes de destruir.
    return Buffer.from(destino.saveToBuffer('compress').asUint8Array().slice())
  } finally {
    destino.destroy?.()
  }
}
