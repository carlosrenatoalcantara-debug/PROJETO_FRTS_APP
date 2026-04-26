import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

function hexRGB(cor) {
  if (!cor?.startsWith('#')) return [249, 115, 22]
  const n = parseInt(cor.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const brl = (n) => `R$ ${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
const fmt = (v) => (v != null ? String(v) : '—')

export function gerarPdfSimulacao({ resultado, cidadeEstado, empresa = {} }) {
  const COR1 = hexRGB(empresa.corPrimaria)
  const COR2 = hexRGB(empresa.corSecundaria ?? '#0f172a')
  const W    = [255, 255, 255]
  const CIN  = [100, 116, 139]

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const { entrada, irradiancia, sistema, geracao, financeiro } = resultado

  // ── cabeçalho ─────────────────────────────────────────────────────
  if (empresa.logo) {
    try {
      const tipo = empresa.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      doc.addImage(empresa.logo, tipo, 14, 10, 32, 14)
    } catch { _logoTexto(doc, empresa, COR1, W) }
  } else {
    _logoTexto(doc, empresa, COR1, W)
  }

  doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...CIN)
  if (empresa.email)    doc.text(empresa.email,    196, 14, { align: 'right' })
  if (empresa.telefone) doc.text(empresa.telefone, 196, 19, { align: 'right' })

  doc.setDrawColor(...COR1).setLineWidth(0.8).line(14, 28, 196, 28)

  // título
  doc.setFillColor(...COR2).rect(14, 31, 182, 9, 'F')
  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...W)
  doc.text('RELATÓRIO DE SIMULAÇÃO — SISTEMA FOTOVOLTAICO', 105, 37.5, { align: 'center' })

  let y = 48

  // ── dados de entrada ──────────────────────────────────────────────
  doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...COR2)
  doc.text('DADOS DE ENTRADA', 14, y)
  doc.setDrawColor(...COR1).setLineWidth(0.3).line(14, y + 1.5, 196, y + 1.5)
  y += 6

  autoTable(doc, {
    startY: y,
    head: [],
    body: [
      ['Consumo mensal',      `${entrada.consumoMensal} kWh/mês`],
      ['Localização',         cidadeEstado || `Lat ${entrada.lat?.toFixed(4)}, Lon ${entrada.lon?.toFixed(4)}`],
      ['Área disponível',     entrada.areaDisponivel ? `${entrada.areaDisponivel} m²` : 'Não informada'],
      ['Tipo de sistema',     entrada.tipoSistema === 'micro' ? 'Microinversor' : 'String'],
      ['Potência do painel',  `${entrada.potenciaPainelW} W`],
      ['Tarifa de energia',   `${brl(entrada.tarifaEnergia)}/kWh`],
      ['Irradiância média',   `${irradiancia.mediaAnual} kWh/m²/dia (NASA POWER)`],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.8 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 65, textColor: COR2 },
      1: { cellWidth: 117 },
    },
    margin: { left: 14, right: 14 },
  })
  y = doc.lastAutoTable.finalY + 8

  // ── resultado técnico ─────────────────────────────────────────────
  doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...COR2)
  doc.text('RESULTADO DO DIMENSIONAMENTO', 14, y)
  doc.setDrawColor(...COR1).setLineWidth(0.3).line(14, y + 1.5, 196, y + 1.5)
  y += 6

  autoTable(doc, {
    startY: y,
    head: [],
    body: [
      ['Potência do sistema',     `${sistema.potenciaRealKwp} kWp`],
      ['Número de painéis',       `${sistema.numPaineis} painéis de ${entrada.potenciaPainelW} W`],
      ['Número de inversores',    `${sistema.numInversores} × ${sistema.tipoInversor}`],
      ['Perdas do sistema',       sistema.perdasSistema],
      ['Área necessária',         `${sistema.areaNecessaria} m²${sistema.alertaArea ? ' ⚠ ÁREA INSUFICIENTE' : ''}`],
      ['Atendimento do consumo',  `${sistema.percentualAtendimento}%`],
      ['Geração média mensal',    `${geracao.geracaoMediaMensal} kWh/mês`],
      ['Geração anual estimada',  `${geracao.geracaoAnual} kWh/ano`],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.8 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 65, textColor: COR2 },
      1: { cellWidth: 117 },
    },
    margin: { left: 14, right: 14 },
  })
  y = doc.lastAutoTable.finalY + 8

  // ── viabilidade financeira ────────────────────────────────────────
  doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...COR2)
  doc.text('VIABILIDADE FINANCEIRA (ESTIMATIVA)', 14, y)
  doc.setDrawColor(...COR1).setLineWidth(0.3).line(14, y + 1.5, 196, y + 1.5)
  y += 6

  autoTable(doc, {
    startY: y,
    head: [],
    body: [
      ['Investimento estimado',   brl(financeiro.custoTotalEstimado)],
      ['Economia mensal',         brl(financeiro.economiaMensal)],
      ['Economia anual',          brl(financeiro.economiaAnual)],
      ['Payback simples',         `${financeiro.paybackAnos} anos`],
      ['ROI em 25 anos',          `${financeiro.roi25Anos}%`],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.8 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 65, textColor: COR2 },
      1: { cellWidth: 117 },
    },
    margin: { left: 14, right: 14 },
  })
  y = doc.lastAutoTable.finalY + 8

  // ── geração mensal ────────────────────────────────────────────────
  doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...COR2)
  doc.text('GERAÇÃO MENSAL ESTIMADA', 14, y)
  doc.setDrawColor(...COR1).setLineWidth(0.3).line(14, y + 1.5, 196, y + 1.5)
  y += 6

  autoTable(doc, {
    startY: y,
    head: [['Mês', 'Geração (kWh)', 'Consumo (kWh)', 'Saldo (kWh)', 'Atend. (%)']],
    body: geracao.mensal.map(m => [
      m.mes,
      m.gerado.toLocaleString('pt-BR'),
      m.consumo.toLocaleString('pt-BR'),
      (m.gerado - m.consumo).toLocaleString('pt-BR', { signDisplay: 'always' }),
      `${Math.min(100, Math.round((m.gerado / m.consumo) * 100))}%`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: COR2, textColor: W, fontSize: 8 },
    styles:     { fontSize: 8, cellPadding: 2, halign: 'center' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  })

  // ── total investment box ──────────────────────────────────────────
  const fy = doc.lastAutoTable.finalY + 5
  doc.setFillColor(...COR1).rect(120, fy, 76, 10, 'F')
  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...W)
  doc.text(`INVESTIMENTO: ${brl(financeiro.custoTotalEstimado)}`, 158, fy + 7, { align: 'center' })

  // ── disclaimer ────────────────────────────────────────────────────
  const fd = fy + 18
  doc.setFontSize(7.5).setFont('helvetica', 'italic').setTextColor(...CIN)
  const disc =
    'Este relatório é uma ESTIMATIVA baseada em dados históricos de irradiância da NASA POWER API. ' +
    'Os valores reais podem variar conforme condições locais, sombreamento, degradação dos módulos e inflação tarifária. ' +
    'Recomenda-se projeto técnico detalhado elaborado por engenheiro habilitado.'
  const linhas = doc.splitTextToSize(disc, 182)
  doc.text(linhas, 14, fd)

  // ── rodapé ────────────────────────────────────────────────────────
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFontSize(7).setTextColor(...CIN)
    doc.text(
      `${empresa.nomeEmpresa ?? 'Forte Solar'} · Simulação gerada em ${new Date().toLocaleDateString('pt-BR')} · Pág. ${i}/${total}`,
      105, 292, { align: 'center' }
    )
    doc.setDrawColor(...CIN).setLineWidth(0.2).line(14, 289, 196, 289)
  }

  return doc
}

function _logoTexto(doc, empresa, COR1, W) {
  doc.setFillColor(...COR1).rect(14, 10, 48, 16, 'F')
  doc.setFontSize(11).setFont('helvetica', 'bold').setTextColor(...W)
  doc.text(empresa.nomeEmpresa ?? 'Forte Solar', 38, 19.5, { align: 'center' })
  doc.setFontSize(7).setFont('helvetica', 'normal')
  doc.text('Energia Solar & EV', 38, 24.5, { align: 'center' })
}
