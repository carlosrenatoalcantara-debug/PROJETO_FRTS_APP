/**
 * gerarPDFUnifilar.js — P3-F4: PDF a partir do JSON canônico do DiagramEngine.
 *
 * Fluxo único: Projeto → DiagramEngine → JSON canônico → SVG executivo → PDFKit.
 * O PDFKit NÃO desenha mais componentes, não calcula posições nem layout: apenas
 * embute o SVG produzido pelo Engine (mesma fonte do React Flow e do preview).
 *
 * A4 paisagem. Toda a geometria vem do Engine.
 */
import PDFDocument from 'pdfkit'
import SVGtoPDF from 'svg-to-pdfkit'
import { renderSVG } from '../../../packages/diagram-engine/index.js'
import { construirCanonicalDeProjetoEV } from '../../../packages/diagram-engine/adapters/ev.js'

/** Normaliza o documento (mongoose ou plain) e garante cliente populado. */
function prepararProjeto(projeto, cliente) {
  const plain = projeto?.toObject ? projeto.toObject() : { ...projeto }
  if (cliente && (!plain.clienteId || typeof plain.clienteId !== 'object' || !plain.clienteId.nome)) {
    plain.clienteId = cliente
  }
  return plain
}

/**
 * Monta o PDFDocument (A4 paisagem) com o SVG do Engine embutido.
 * Não chama doc.end() — o chamador decide (stream vs buffer).
 */
function montarDoc(projeto, cliente) {
  const plain = prepararProjeto(projeto, cliente)
  const canonical = construirCanonicalDeProjetoEV(plain)   // mesmo canônico do editor (overrides/viewport aplicados)
  const svg = renderSVG(canonical)

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 })
  SVGtoPDF(doc, svg, 0, 0, {
    width: doc.page.width,
    height: doc.page.height,
    preserveAspectRatio: 'xMidYMid meet',
  })
  return doc
}

/** Gera PDF e retorna como Buffer (mesma fonte canônica). */
export async function gerarPDFUnifilar(projeto, cliente, _tecnico) {
  return new Promise((resolve, reject) => {
    try {
      const doc = montarDoc(projeto, cliente)
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
export function gerarPDFUnifilarStream(projeto, cliente, _tecnico) {
  return montarDoc(projeto, cliente)
}
