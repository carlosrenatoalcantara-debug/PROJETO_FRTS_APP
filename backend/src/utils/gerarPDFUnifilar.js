/**
 * gerarPDFUnifilar.js — P3-F4: PDF a partir do JSON canônico do DiagramEngine.
 *
 * Fluxo único: Projeto → DiagramEngine → JSON canônico → SVG executivo → PDFKit.
 *
 * O diagram-engine é um pacote local (monorepo). Em produção (Railway) o pacote
 * pode não estar disponível no path relativo. Import dinâmico com fallback garante
 * que o servidor inicia mesmo sem o Engine — o endpoint retorna 501 nesse caso.
 */
import PDFDocument from 'pdfkit'
import SVGtoPDF from 'svg-to-pdfkit'
import { desenharMemorialDescritivo } from './gerarMemorialDescritivo.js'

// BUG-013: o DiagramEngine é instalado como DEPENDÊNCIA do backend
// (@fortesolar/diagram-engine, vendorizado em backend/vendor). Assim ele viaja
// DENTRO do artefato de deploy (raiz = backend/ no Railway) e o import resolve em
// produção. Antes usava-se caminho relativo (../../../packages/...) que escapava
// da raiz de deploy → ERR_MODULE_NOT_FOUND → 501.
let _renderSVG = null
let _construirCanonical = null
async function carregarEngine() {
  if (_renderSVG) return true
  try {
    const eng = await import('@fortesolar/diagram-engine')
    const adp = await import('@fortesolar/diagram-engine/adapters/ev')
    _renderSVG = eng.renderSVG
    _construirCanonical = adp.construirCanonicalDeProjetoEV
    return true
  } catch (err) {
    // Não mascarar: registra o erro real no log do servidor (sem vazar no HTTP).
    console.error('❌ DiagramEngine indisponível:', err?.code, String(err?.message || err).split('\n')[0])
    return false
  }
}

/** Normaliza o documento (mongoose ou plain) e garante cliente populado. */
function prepararProjeto(projeto, cliente) {
  const plain = projeto?.toObject ? projeto.toObject() : { ...projeto }
  if (cliente && (!plain.clienteId || typeof plain.clienteId !== 'object' || !plain.clienteId.nome)) {
    plain.clienteId = cliente
  }
  return plain
}

/** Gera PDF e retorna como Buffer. */
export async function gerarPDFUnifilar(projeto, cliente, _tecnico) {
  const disponivel = await carregarEngine()
  if (!disponivel) {
    throw Object.assign(new Error('Diagrama Engine indisponível neste ambiente'), { code: 'ENGINE_UNAVAILABLE' })
  }
  const plain = prepararProjeto(projeto, cliente)
  const canonical = _construirCanonical(plain)
  const svg = _renderSVG(canonical)

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 0 })
      // Página 1: memorial descritivo (laudo técnico, A4 RETRATO) — página 2: unifilar (A4 PAISAGEM, SVG do Engine).
      desenharMemorialDescritivo(doc, plain, plain.clienteId)
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 })
      SVGtoPDF(doc, svg, 0, 0, { width: doc.page.width, height: doc.page.height, preserveAspectRatio: 'xMidYMid meet' })
      const chunks = []
      doc.on('data', (c) => chunks.push(c))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)
      doc.end()
    } catch (erro) {
      reject(erro)
    }
  })
}

/** Gera PDF e retorna o stream (PDFDocument) — o chamador faz pipe + end. */
export async function gerarPDFUnifilarStream(projeto, cliente, _tecnico) {
  const disponivel = await carregarEngine()
  if (!disponivel) {
    throw Object.assign(new Error('Diagrama Engine indisponível neste ambiente'), { code: 'ENGINE_UNAVAILABLE' })
  }
  const plain = prepararProjeto(projeto, cliente)
  const canonical = _construirCanonical(plain)
  const svg = _renderSVG(canonical)

  const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 0 })
  // Página 1: memorial descritivo (laudo técnico, A4 RETRATO) — página 2: unifilar (A4 PAISAGEM, SVG do Engine).
  desenharMemorialDescritivo(doc, plain, plain.clienteId)
  doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 })
  SVGtoPDF(doc, svg, 0, 0, { width: doc.page.width, height: doc.page.height, preserveAspectRatio: 'xMidYMid meet' })
  return doc
}
