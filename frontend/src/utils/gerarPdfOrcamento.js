import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── helpers ──────────────────────────────────────────────────────────────────

function hex(cor) {
  if (!cor || typeof cor !== 'string' || !cor.startsWith('#')) return [249, 115, 22]
  const n = parseInt(cor.replace('#', ''), 16)
  if (isNaN(n)) return [249, 115, 22]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const fmt = (v, padrao = '—') => (v != null && v !== '' ? String(v) : padrao)
const brl = (n) => {
  const num = Number(n)
  return isNaN(num) ? '—' : `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
}

// ── seções do PDF ─────────────────────────────────────────────────────────────

function desenhaCabecalho(doc, empresa, COR1, COR2) {
  const W   = [255, 255, 255]
  const CIN = [148, 163, 184]

  // Bloco logo/nome
  if (empresa.logo) {
    try {
      const tipo = empresa.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      doc.addImage(empresa.logo, tipo, 14, 10, 34, 15)
    } catch {
      _blocoLogoTexto(doc, empresa.nomeEmpresa, COR1, W)
    }
  } else {
    _blocoLogoTexto(doc, empresa.nomeEmpresa, COR1, W)
  }

  // Informações da empresa (direita)
  doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...CIN)
  if (empresa.email)   doc.text(empresa.email,   196, 14, { align: 'right' })
  if (empresa.site)    doc.text(empresa.site,    196, 19, { align: 'right' })
  if (empresa.telefone)doc.text(empresa.telefone,196, 24, { align: 'right' })

  // Linha divisória cor primária
  doc.setDrawColor(...COR1).setLineWidth(0.8).line(14, 30, 196, 30)
}

function _blocoLogoTexto(doc, nome, COR1, W) {
  doc.setFillColor(...COR1).rect(14, 10, 50, 18, 'F')
  doc.setFontSize(12).setFont('helvetica', 'bold').setTextColor(...W)
  doc.text(nome ?? 'Forte Solar', 39, 19, { align: 'center' })
  doc.setFontSize(7).setFont('helvetica', 'normal')
  doc.text('Energia Solar & EV', 39, 25, { align: 'center' })
}

function desenhaBandaTitulo(doc, y, COR2) {
  const W = [255, 255, 255]
  doc.setFillColor(...COR2).rect(14, y, 182, 9, 'F')
  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...W)
  doc.text('PROPOSTA COMERCIAL — SISTEMA FOTOVOLTAICO', 105, y + 6.5, { align: 'center' })
  return y + 13
}

function secaoTitulo(doc, texto, y, COR1, COR2) {
  doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...COR2)
  doc.text(texto, 14, y)
  doc.setDrawColor(...COR1).setLineWidth(0.3).line(14, y + 1.5, 196, y + 1.5)
  return y + 7
}

function par(doc, rotulo, valor, x, y) {
  doc.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(100, 116, 139)
  doc.text(`${rotulo}:`, x, y)
  doc.setFont('helvetica', 'normal').setTextColor(30, 30, 30)
  doc.text(fmt(valor), x + 36, y)
}

// ── exportação principal ──────────────────────────────────────────────────────

export function gerarPdfOrcamento({
  cliente       = {},
  consumo       = {},
  localizacao   = {},
  dimensionamento: dim = {},
  area          = {},
  equipamentos  = {},
  irradiancia   = {},
  empresa       = {},
}) {
  const COR1 = hex(empresa.corPrimaria)
  const COR2 = hex(empresa.corSecundaria ?? '#0f172a')
  const CIN  = [100, 116, 139]
  const W    = [255, 255, 255]

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  desenhaCabecalho(doc, empresa, COR1, COR2)
  let y = desenhaBandaTitulo(doc, 33, COR2)

  // ── CLIENTE ──────────────────────────────────────────────────────
  y = secaoTitulo(doc, 'DADOS DO CLIENTE', y, COR1, COR2)
  par(doc, 'Cliente',        cliente.nomeCliente || cliente.nome, 14, y)
  par(doc, 'Projeto',        cliente.nomeProjeto,                 110, y)
  y += 6
  par(doc, 'Localização',    localizacao.cidadeEstado || localizacao.endereco, 14, y)
  par(doc, 'Concessionária', consumo.concessionaria,              110, y)
  y += 10

  // ── DADOS TÉCNICOS ────────────────────────────────────────────────
  y = secaoTitulo(doc, 'DADOS TÉCNICOS', y, COR1, COR2)

  const tipo = consumo.tipoLigacao === 'monofasico' ? 'Monofásico'
             : consumo.tipoLigacao === 'bifasico'   ? 'Bifásico'
             : 'Trifásico'

  autoTable(doc, {
    startY:  y,
    head:    [],
    body:    [
      ['Consumo mensal',          `${fmt(consumo.consumoMensal)} kWh/mês`],
      ['Tipo de ligação',          tipo],
      ['Tensão',                  `${fmt(consumo.tensao)} V`],
      ['Irradiância média',       `${fmt(irradiancia.mediaAnual)} kWh/m²/dia${irradiancia.fonte === 'cresesb' ? ' (CRESESB)' : ''}`],
      ['Potência do sistema',     `${fmt(dim.potenciaRealKwp)} kWp`],
      ['Número de painéis',       `${fmt(dim.numPaineis)} painéis de ${fmt(dim.potenciaPainelW)} W`],
      ['Número de inversores',    `${fmt(dim.numInversores)} inversor(es) de ${fmt(dim.capacidadeInversorKW)} kW`],
      ['Área necessária',         `${fmt(dim.areaMinima)} m²`],
      ['Área disponível',         area.areaDisponivel ? `${area.areaDisponivel} m²` : '—'],
      ['Orientação / inclinação', `${fmt(area.orientacao)} / ${fmt(area.inclinacao)}°`],
      ['Geração estimada/mês',    dim.potenciaRealKwp && irradiancia.mediaAnual
        ? `${Math.round(dim.potenciaRealKwp * irradiancia.mediaAnual * 30 * 0.80)} kWh/mês`
        : '—'],
    ],
    theme:   'grid',
    styles:  { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 65, textColor: COR2 },
      1: { cellWidth: 117 },
    },
    margin: { left: 14, right: 14 },
  })
  y = doc.lastAutoTable.finalY + 8

  // ── EQUIPAMENTOS ──────────────────────────────────────────────────
  y = secaoTitulo(doc, 'EQUIPAMENTOS SELECIONADOS', y, COR1, COR2)

  const { painel, inversor, estrutura } = equipamentos
  const linhas = []

  if (painel) {
    const sub = (painel.precoUnitario ?? 0) * (dim.numPaineis ?? 0)
    linhas.push([
      'Módulo FV',
      `${painel.marca ?? ''} ${painel.modelo ?? ''}`.trim(),
      `${painel.potenciaW ?? '—'} W`,
      String(dim.numPaineis ?? '—'),
      brl(painel.precoUnitario),
      brl(sub),
    ])
  }
  if (inversor) {
    const sub = (inversor.precoUnitario ?? 0) * (dim.numInversores ?? 0)
    linhas.push([
      'Inversor',
      `${inversor.marca ?? ''} ${inversor.modelo ?? ''}`.trim(),
      `${inversor.potenciaKW ?? '—'} kW`,
      String(dim.numInversores ?? '—'),
      brl(inversor.precoUnitario),
      brl(sub),
    ])
  }
  if (estrutura) {
    const sub = (estrutura.precoUnitario ?? 0) * (dim.numPaineis ?? 0)
    linhas.push([
      'Estrutura',
      `${estrutura.marca ?? ''} ${estrutura.modelo ?? ''}`.trim(),
      estrutura.tipo ?? '—',
      String(dim.numPaineis ?? '—'),
      brl(estrutura.precoUnitario),
      brl(sub),
    ])
  }

  if (linhas.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Tipo', 'Descrição', 'Especificação', 'Qtd', 'Unit.', 'Subtotal']],
      body: linhas,
      theme: 'striped',
      headStyles: { fillColor: COR2, textColor: W, fontSize: 8, fontStyle: 'bold' },
      styles:     { fontSize: 8, cellPadding: 2.5 },
      columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: 14, right: 14 },
    })
    y = doc.lastAutoTable.finalY + 4
  }

  // ── TOTAL ─────────────────────────────────────────────────────────
  const total =
    ((painel?.precoUnitario    ?? 0) * (dim.numPaineis    ?? 0)) +
    ((inversor?.precoUnitario  ?? 0) * (dim.numInversores ?? 0)) +
    ((estrutura?.precoUnitario ?? 0) * (dim.numPaineis    ?? 0))

  doc.setFillColor(...COR1).rect(120, y, 76, 10, 'F')
  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...W)
  doc.text(`TOTAL: ${brl(total)}`, 158, y + 7, { align: 'center' })
  y += 16

  // ── VALIDADE + ASSINATURA ─────────────────────────────────────────
  if (y > 260) { doc.addPage(); y = 20 }

  doc.setFontSize(8).setFont('helvetica', 'italic').setTextColor(...CIN)
  doc.text('• Proposta válida por 15 dias a partir da data de emissão.', 14, y)
  doc.text('• Valores sujeitos a alteração conforme disponibilidade de estoque.', 14, y + 5)
  y += 16

  doc.setDrawColor(...CIN).setLineWidth(0.3)
  doc.line(14, y, 88, y)
  doc.line(120, y, 194, y)
  doc.setFontSize(8).setTextColor(...CIN)

  const nomeRT = empresa.responsavelTecnico?.nome
  const regRT  = empresa.responsavelTecnico?.registro
    ? `${empresa.responsavelTecnico.tipoRegistro ?? 'CREA'} ${empresa.responsavelTecnico.registro}/${empresa.responsavelTecnico.uf ?? ''}`
    : 'Responsável Técnico'
  doc.text(nomeRT ? `${nomeRT}\n${regRT}` : 'Responsável Técnico', 51, y + 4, { align: 'center' })
  doc.text('Cliente', 157, y + 4, { align: 'center' })

  // ── RODAPÉ ────────────────────────────────────────────────────────
  const totalPag = doc.getNumberOfPages()
  const nomeEmp  = empresa.nomeEmpresa ?? 'Forte Solar'
  const dataHoje = new Date().toLocaleDateString('pt-BR')

  for (let i = 1; i <= totalPag; i++) {
    doc.setPage(i)
    doc.setFontSize(7).setTextColor(...CIN)
    doc.text(
      `${nomeEmp} · Proposta gerada em ${dataHoje} · Página ${i}/${totalPag}`,
      105, 292, { align: 'center' },
    )
    doc.setDrawColor(...CIN).setLineWidth(0.2).line(14, 289, 196, 289)
  }

  return doc
}
