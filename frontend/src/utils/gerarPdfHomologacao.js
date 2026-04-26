import { jsPDF } from 'jspdf'

function hexParaRGB(hex) {
  const n = parseInt((hex ?? '#f97316').replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function cabecalhoHomologacao(doc, titulo, empresa = {}) {
  const COR1 = hexParaRGB(empresa.corPrimaria ?? '#f97316')
  const COR2 = hexParaRGB(empresa.corSecundaria ?? '#0f172a')
  const BRANCO = [255, 255, 255]
  const CINZA  = [100, 116, 139]

  // Faixa superior
  doc.setFillColor(...COR2)
  doc.rect(0, 0, 210, 18, 'F')

  // Logo ou nome
  if (empresa.logo) {
    try {
      const fmt = empresa.logo.includes('png') ? 'PNG' : 'JPEG'
      doc.addImage(empresa.logo, fmt, 8, 2, 28, 14)
    } catch {}
  } else {
    doc.setFillColor(...COR1)
    doc.roundedRect(8, 3, 32, 12, 2, 2, 'F')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...BRANCO)
    doc.text(empresa.nomeEmpresa ?? 'Forte Solar', 24, 11, { align: 'center' })
  }

  // Nome empresa e contato
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...BRANCO)
  doc.text(empresa.nomeEmpresa ?? 'Forte Solar', 46, 8)
  doc.setFontSize(7)
  doc.setTextColor(200, 210, 220)
  doc.text(`${empresa.cnpj ?? ''} | ${empresa.telefone ?? ''} | ${empresa.email ?? ''}`, 46, 13)

  // Título do documento
  doc.setFillColor(...COR1)
  doc.rect(0, 18, 210, 10, 'F')
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BRANCO)
  doc.text(titulo, 105, 25, { align: 'center' })

  return 35
}

function rodape(doc, empresa = {}) {
  const paginas = doc.getNumberOfPages()
  const CINZA = [148, 163, 184]
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(...CINZA)
    doc.text(
      `${empresa.nomeEmpresa ?? 'Forte Solar'} · Documento gerado em ${new Date().toLocaleDateString('pt-BR')} · Pág. ${i}/${paginas}`,
      105, 292, { align: 'center' }
    )
    doc.setDrawColor(...CINZA)
    doc.setLineWidth(0.2)
    doc.line(14, 289, 196, 289)
  }
}

export function gerarPdfHomologacao({ tipo, dados, texto }) {
  const doc     = new jsPDF({ unit: 'mm', format: 'a4' })
  const empresa = dados.empresa ?? {}

  const titulos = {
    memorial: 'MEMORIAL DESCRITIVO E DE CALCULO',
    carta:    'CARTA DE SOLICITACAO A CONCESSIONARIA',
    art:      'ROTEIRO DE PREENCHIMENTO DE ART',
    checklist:'CHECKLIST DE DOCUMENTOS',
  }

  let y = cabecalhoHomologacao(doc, titulos[tipo] ?? 'DOCUMENTO TECNICO', empresa)

  const ESCURO = [30, 30, 30]
  doc.setFontSize(8.5)
  doc.setFont('courier', 'normal')
  doc.setTextColor(...ESCURO)

  const linhas = texto.split('\n')
  const margem = 14
  const largura = 182
  const alturaLinha = 4.5

  for (const linha of linhas) {
    // Verifica espaço na página
    if (y > 282) {
      doc.addPage()
      y = 20
    }

    if (linha.startsWith('━━━')) {
      // Linha separadora
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.3)
      doc.line(margem, y, margem + largura, y)
      y += 3
      continue
    }

    const ehTitulo = /^[0-9]+\./.test(linha.trim()) || linha.trim().toUpperCase() === linha.trim() && linha.trim().length > 3
    if (ehTitulo && linha.trim().length > 0) {
      doc.setFont('courier', 'bold')
    } else {
      doc.setFont('courier', 'normal')
    }

    if (linha.trim() === '') {
      y += alturaLinha * 0.6
      continue
    }

    // Quebra linhas longas
    const sublinhas = doc.splitTextToSize(linha, largura)
    for (const sl of sublinhas) {
      if (y > 282) { doc.addPage(); y = 20 }
      doc.text(sl, margem, y)
      y += alturaLinha
    }
  }

  rodape(doc, empresa)
  return doc
}
