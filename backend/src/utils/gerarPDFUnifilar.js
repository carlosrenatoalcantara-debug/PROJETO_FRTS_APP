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
import mongoose from 'mongoose'
import { desenharMemorialDescritivo } from './gerarMemorialDescritivo.js'
import { EmpresaConfig } from '../models/EmpresaConfig.js'

/** Busca a logomarca da empresa (Configurações) — best-effort, nunca derruba o PDF. */
async function obterLogoEmpresa() {
  try {
    if (mongoose.connection.readyState !== 1) return null
    const cfg = await EmpresaConfig.findOne({ chave: 'default' })
    return cfg?.branding?.logo || null
  } catch {
    return null
  }
}

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

/** "data:image/...;base64,..." → Buffer (aceito por doc.image()). null se inválida. */
function base64ParaBuffer(dataUri) {
  const m = /^data:image\/\w+;base64,(.+)$/.exec(String(dataUri || ''))
  if (!m) return null
  try { return Buffer.from(m[1], 'base64') } catch { return null }
}
const esc2 = (s) => String(s ?? '')

/**
 * FEATURE-006 itens 4 e 5: sobrepõe (via PDFKit, SEM tocar no DiagramEngine/SVG) a MESMA
 * logomarca da página 1 no topo-esquerdo do unifilar e os blocos de assinatura no rodapé.
 * Desenhado DEPOIS do SVG, em área livre — não altera o diagrama nem o layout aprovado.
 */
export function desenharLogoEAssinaturasP2(doc, logoBase64, cliente = {}, tecnico = {}) {
  // Item 4 — logo: cobre o texto "Forte Solar" do cabeçalho do SVG (mesma origem da pág. 1).
  const logoBuf = base64ParaBuffer(logoBase64)
  if (logoBuf) {
    try {
      doc.save()
      doc.rect(22, 16, 160, 32).fill('#ffffff')
      doc.image(logoBuf, 26, 20, { fit: [132, 26], align: 'left' })
      doc.restore()
    } catch { /* logo ilegível — mantém o texto padrão do SVG */ }
  }
  // Item 5 — assinaturas: CLIENTE e RESPONSÁVEL TÉCNICO no rodapé (faixa livre entre a
  // caixa de NOTAS/BOM e o QR). Alinhadas e proporcionais ao restante do documento.
  const W = doc.page.width, H = doc.page.height
  const yTop = H - 90
  const colW = 210
  const rtReg = tecnico?.crea ? `CREA ${esc2(tecnico.crea)}` : (tecnico?.cft ? `CFT ${esc2(tecnico.cft)}` : '')
  const colunas = [
    [270, 'CLIENTE', esc2(cliente?.nome), cliente?.cpf_cnpj ? `CPF/CNPJ ${esc2(cliente.cpf_cnpj)}` : ''],
    [490, 'RESPONSÁVEL TÉCNICO', esc2(tecnico?.nome), rtReg],
  ]
  for (const [x, titulo, nome, linha2] of colunas) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text(titulo, x, yTop, { width: colW })
    doc.font('Helvetica').fontSize(8).fillColor('#334155').text(nome || ' ', x, yTop + 12, { width: colW })
    doc.fontSize(7.5).fillColor('#64748b').text(linha2 || ' ', x, yTop + 22, { width: colW })
    doc.moveTo(x, yTop + 50).lineTo(x + colW, yTop + 50).stroke('#94a3b8')
    doc.font('Helvetica').fontSize(7).fillColor('#64748b').text('Assinatura', x, yTop + 53, { width: colW })
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
  const logo = await obterLogoEmpresa()

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 0 })
      // Página 1: memorial descritivo (laudo técnico, A4 RETRATO) — página 2: unifilar (A4 PAISAGEM, SVG do Engine).
      desenharMemorialDescritivo(doc, plain, plain.clienteId, logo)
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 })
      SVGtoPDF(doc, svg, 0, 0, { width: doc.page.width, height: doc.page.height, preserveAspectRatio: 'xMidYMid meet' })
      desenharLogoEAssinaturasP2(doc, logo, plain.clienteId, plain.tecnico)
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
  const logo = await obterLogoEmpresa()

  const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 0 })
  // Página 1: memorial descritivo (laudo técnico, A4 RETRATO) — página 2: unifilar (A4 PAISAGEM, SVG do Engine).
  desenharMemorialDescritivo(doc, plain, plain.clienteId, logo)
  doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 })
  SVGtoPDF(doc, svg, 0, 0, { width: doc.page.width, height: doc.page.height, preserveAspectRatio: 'xMidYMid meet' })
  desenharLogoEAssinaturasP2(doc, logo, plain.clienteId, plain.tecnico)
  return doc
}
