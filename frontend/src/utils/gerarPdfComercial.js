import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

function hexRGB(cor) {
  if (!cor?.startsWith('#')) return [249, 115, 22]
  const n = parseInt(cor.replace('#', ''), 16)
  if (isNaN(n)) return [249, 115, 22]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const brl = (v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
const pct = (v) => `${Number(v).toFixed(1)}%`
const fmt = (v, u = '') => (v != null && v !== '' ? `${v}${u}` : '—')

// ── Utilitários visuais ───────────────────────────────────────────────────────

function cabecalho(doc, empresa, COR1, COR2) {
  const W = [255, 255, 255], CIN = [148, 163, 184]

  // Fundo superior
  doc.setFillColor(...COR2).rect(0, 0, 210, 22, 'F')

  // Logo
  if (empresa.logo) {
    try {
      const tipo = empresa.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      doc.addImage(empresa.logo, tipo, 10, 4, 28, 14)
    } catch { _blocoLogo(doc, empresa, COR1, W) }
  } else {
    _blocoLogo(doc, empresa, COR1, W)
  }

  // Nome e contato
  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...W)
  doc.text(empresa.nomeEmpresa ?? 'Forte Solar', 46, 10)
  doc.setFontSize(7.5).setFont('helvetica', 'normal').setTextColor(...CIN)
  const contato = [empresa.telefone, empresa.email, empresa.site].filter(Boolean).join('  ·  ')
  doc.text(contato, 46, 15)

  doc.setDrawColor(...COR1).setLineWidth(0.5).line(0, 22, 210, 22)
}

function _blocoLogo(doc, empresa, COR1, W) {
  doc.setFillColor(...COR1).roundedRect(10, 5, 32, 12, 2, 2, 'F')
  doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...W)
  doc.text(empresa.nomeEmpresa ?? 'Forte Solar', 26, 12.5, { align: 'center' })
}

function secTitulo(doc, texto, y, COR1, COR2) {
  doc.setFillColor(...COR1).rect(14, y - 1, 3, 7, 'F')
  doc.setFontSize(9.5).setFont('helvetica', 'bold').setTextColor(...COR2)
  doc.text(texto, 19, y + 4.5)
  doc.setDrawColor(230, 230, 230).setLineWidth(0.3).line(19, y + 6, 196, y + 6)
  return y + 12
}

function rodape(doc, empresa, COR1, COR2) {
  const total = doc.getNumberOfPages()
  const W = [255, 255, 255], CIN = [120, 130, 145]
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFillColor(...COR2).rect(0, 285, 210, 12, 'F')
    doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(...CIN)
    doc.text(
      `${empresa.nomeEmpresa ?? 'Forte Solar'}  ·  ${empresa.email ?? ''}  ·  ${empresa.telefone ?? ''}`,
      105, 291, { align: 'center' }
    )
    doc.setTextColor(...W)
    doc.text(`${i} / ${total}`, 196, 291, { align: 'right' })
    doc.setDrawColor(...COR1).setLineWidth(0.8).line(0, 285, 210, 285)
  }
}

// ── Geração principal ─────────────────────────────────────────────────────────

export function gerarPdfComercial({ resultado, cidadeEstado, empresa = {}, datasheetPainel = {} }) {
  const COR1 = hexRGB(empresa.corPrimaria  ?? '#f97316')
  const COR2 = hexRGB(empresa.corSecundaria ?? '#0f172a')
  const W    = [255, 255, 255]
  const CIN  = [100, 116, 139]
  const ESC  = [15, 23, 42]

  const doc  = new jsPDF({ unit: 'mm', format: 'a4' })
  const { entrada, irradiancia, sistema, geracao, financeiro } = resultado

  // ═══════════════════════════════════════════════════════
  // PÁG 1 — RESUMO EXECUTIVO
  // ═══════════════════════════════════════════════════════
  cabecalho(doc, empresa, COR1, COR2)

  // Título proposta
  doc.setFillColor(...COR1).rect(14, 26, 182, 14, 'F')
  doc.setFontSize(13).setFont('helvetica', 'bold').setTextColor(...W)
  doc.text('PROPOSTA COMERCIAL — ENERGIA SOLAR FOTOVOLTAICA', 105, 35, { align: 'center' })

  let y = 46

  // Resumo executivo em destaque
  doc.setFillColor(248, 250, 252).rect(14, y, 182, 36, 'F')
  doc.setDrawColor(...COR1).setLineWidth(0.5).rect(14, y, 182, 36)
  doc.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(...COR2)
  doc.text('RESUMO EXECUTIVO', 20, y + 7)

  const kpis = [
    { r: 'Potência instalada', v: `${sistema.potenciaRealKwp} kWp` },
    { r: 'Geração/mês',        v: `${geracao.geracaoMediaMensal} kWh` },
    { r: 'Economia anual',     v: brl(financeiro.economiaAnual) },
    { r: 'Payback',            v: `${financeiro.paybackAnos} anos` },
    { r: 'TIR',                v: `${financeiro.tir}% a.a.` },
    { r: 'ROI 25 anos',        v: `${financeiro.roi25Anos}%` },
  ]

  kpis.forEach(({ r, v }, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const x   = 20 + col * 60
    const cy  = y + 16 + row * 11
    doc.setFontSize(7.5).setFont('helvetica', 'normal').setTextColor(...CIN)
    doc.text(r, x, cy)
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...ESC)
    doc.text(v, x, cy + 5)
  })
  y += 42

  // ── Localização e consumo
  y = secTitulo(doc, 'DADOS DO PROJETO', y, COR1, COR2)
  autoTable(doc, {
    startY: y, head: [], body: [
      ['Local de instalação',   cidadeEstado || `Lat ${entrada.lat?.toFixed(4)}, Lon ${entrada.lon?.toFixed(4)}`],
      ['Consumo médio mensal',  `${entrada.consumoMensal} kWh/mês`],
      ['Irradiância média',     `${irradiancia.mediaAnual} kWh/m²/dia (fonte: NASA POWER)`],
      ['Tipo de sistema',       entrada.tipoSistema === 'micro' ? 'Microinversor' : 'Inversor String'],
      ['Tarifa de energia',     `R$ ${entrada.tarifaEnergia}/kWh`],
    ],
    theme: 'grid', styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: [248,250,252], cellWidth: 65, textColor: COR2 }, 1: { cellWidth: 117 } },
    margin: { left: 14, right: 14 },
  })
  y = doc.lastAutoTable.finalY + 8

  // ── Antes vs depois conta de luz
  y = secTitulo(doc, 'ANTES vs DEPOIS — CONTA DE LUZ', y, COR1, COR2)
  const consumoAnual = entrada.consumoMensal * 12
  const gastoAnualSem = consumoAnual * entrada.tarifaEnergia
  const gastoMensalCom = Math.max(0, (entrada.consumoMensal - geracao.geracaoMediaMensal)) * entrada.tarifaEnergia * 0.35 // custo de disponibilidade + excedente

  doc.setFillColor(254, 226, 226).rect(14, y, 86, 26, 'F')
  doc.setFillColor(209, 250, 229).rect(110, y, 86, 26, 'F')
  doc.setFontSize(8).setFont('helvetica', 'bold')
  doc.setTextColor(185, 28, 28); doc.text('SEM ENERGIA SOLAR', 57, y + 7, { align: 'center' })
  doc.setFontSize(11).setTextColor(185, 28, 28)
  doc.text(`R$ ${gastoAnualSem.toLocaleString('pt-BR', {maximumFractionDigits:0})}/ano`, 57, y + 17, { align: 'center' })
  doc.setFontSize(8).setFont('helvetica', 'bold')
  doc.setTextColor(6, 95, 70); doc.text('COM ENERGIA SOLAR', 153, y + 7, { align: 'center' })
  doc.setFontSize(11).setTextColor(6, 95, 70)
  doc.text(`~R$ ${(gastoMensalCom * 12).toLocaleString('pt-BR', {maximumFractionDigits:0})}/ano`, 153, y + 17, { align: 'center' })
  y += 32

  // ═══════════════════════════════════════════════════════
  // PÁG 2 — ESPECIFICAÇÃO TÉCNICA + FINANCEIRO
  // ═══════════════════════════════════════════════════════
  doc.addPage()
  cabecalho(doc, empresa, COR1, COR2)
  y = 30

  y = secTitulo(doc, 'ESPECIFICAÇÃO TÉCNICA', y, COR1, COR2)
  autoTable(doc, {
    startY: y, head: [],
    body: [
      ['Potência do sistema',     `${sistema.potenciaRealKwp} kWp`],
      ['Número de painéis',       `${sistema.numPaineis} módulos de ${entrada.potenciaPainelW} W`],
      ['Número de inversores',    `${sistema.numInversores} × ${sistema.tipoInversor}`],
      ['Perdas do sistema',       sistema.perdasSistema],
      ['Área necessária',         `${sistema.areaNecessaria} m²`],
      ['Geração média mensal',    `${geracao.geracaoMediaMensal} kWh`],
      ['Atendimento do consumo',  `${sistema.percentualAtendimento}%`],
      ['Geração anual estimada',  `${geracao.geracaoAnual} kWh`],
    ],
    theme: 'grid', styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: [248,250,252], cellWidth: 65, textColor: COR2 }, 1: { cellWidth: 117 } },
    margin: { left: 14, right: 14 },
  })
  y = doc.lastAutoTable.finalY + 8

  // Datasheet do painel (se preenchido)
  if (datasheetPainel?.marca || datasheetPainel?.voc) {
    y = secTitulo(doc, 'ESPECIFICAÇÃO DO MÓDULO FOTOVOLTAICO', y, COR1, COR2)
    const rowsDS = [
      datasheetPainel.marca    && ['Fabricante / Modelo', `${datasheetPainel.marca} ${datasheetPainel.modelo}`],
      datasheetPainel.pmpp     && ['Potência (Pmpp)',      `${datasheetPainel.pmpp} W`],
      datasheetPainel.voc      && ['Voc / Isc',            `${datasheetPainel.voc} V / ${datasheetPainel.isc} A`],
      datasheetPainel.vmpp     && ['Vmpp / Impp',          `${datasheetPainel.vmpp} V / ${datasheetPainel.impp} A`],
      datasheetPainel.tempCoefVoc && ['αVoc (temp.)',      `${datasheetPainel.tempCoefVoc}%/°C`],
      datasheetPainel.garantiaProduto && ['Garantia produto', `${datasheetPainel.garantiaProduto} anos`],
      datasheetPainel.garantiaPerformance && ['Garantia performance', `${datasheetPainel.garantiaPerformance} anos (mín. ${datasheetPainel.percentualPerformance}%)`],
    ].filter(Boolean)
    autoTable(doc, {
      startY: y, head: [], body: rowsDS, theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: [248,250,252], cellWidth: 65, textColor: COR2 }, 1: { cellWidth: 117 } },
      margin: { left: 14, right: 14 },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // Viabilidade financeira
  y = secTitulo(doc, 'VIABILIDADE FINANCEIRA (25 ANOS)', y, COR1, COR2)
  autoTable(doc, {
    startY: y, head: [],
    body: [
      ['Investimento estimado',    brl(financeiro.custoTotalEstimado)],
      ['Economia mensal',          brl(financeiro.economiaMensal)],
      ['Economia anual (ano 1)',   brl(financeiro.economiaAnual)],
      ['Payback simples',         `${financeiro.paybackAnos} anos`],
      ['Payback descontado',      `${financeiro.paybackDescontado} anos (TMA ${(financeiro.taxaDesconto*100).toFixed(0)}%)`],
      ['TIR',                     `${financeiro.tir}% a.a.`],
      ['VPL (25 anos)',           `${brl(financeiro.vpl)} (TMA ${(financeiro.taxaDesconto*100).toFixed(0)}%)`],
      ['ROI em 25 anos',          `${financeiro.roi25Anos}%`],
      ['Economia total 25 anos',   brl(financeiro.economiaTotal25)],
      ['Inflação energia (ref.)',  `${(financeiro.inflacaoEnergia*100).toFixed(0)}% a.a.`],
    ],
    theme: 'grid', styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: [248,250,252], cellWidth: 65, textColor: COR2 }, 1: { cellWidth: 117 } },
    margin: { left: 14, right: 14 },
  })
  y = doc.lastAutoTable.finalY + 8

  // ═══════════════════════════════════════════════════════
  // PÁG 3 — GERAÇÃO MENSAL + GARANTIAS + CTA
  // ═══════════════════════════════════════════════════════
  doc.addPage()
  cabecalho(doc, empresa, COR1, COR2)
  y = 30

  y = secTitulo(doc, 'GERAÇÃO MENSAL ESTIMADA', y, COR1, COR2)
  autoTable(doc, {
    startY: y,
    head: [['Mês','Irradiância (kWh/m²/dia)','Geração (kWh)','Consumo (kWh)','Saldo (kWh)','Atend. (%)']],
    body: geracao.mensal.map((m, i) => [
      m.mes,
      irradiancia.mensal[i]?.valor?.toFixed(2) ?? '—',
      m.gerado.toLocaleString('pt-BR'),
      m.consumo.toLocaleString('pt-BR'),
      (m.gerado - m.consumo).toLocaleString('pt-BR', { signDisplay: 'always' }),
      `${Math.min(100, Math.round(m.gerado / m.consumo * 100))}%`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: COR2, textColor: W, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  })
  y = doc.lastAutoTable.finalY + 10

  // Garantias
  y = secTitulo(doc, 'GARANTIAS E NORMAS', y, COR1, COR2)
  const rowsGarantia = [
    ['Módulos fotovoltaicos', datasheetPainel?.garantiaProduto ? `${datasheetPainel.garantiaProduto} anos (produto)` : '10–12 anos (padrão de mercado)'],
    ['Performance dos módulos', datasheetPainel?.garantiaPerformance ? `${datasheetPainel.garantiaPerformance} anos (mín. ${datasheetPainel.percentualPerformance}%)` : '25 anos (mín. 80%)'],
    ['Inversores string', '5–10 anos (conforme fabricante)'],
    ['Estrutura de fixação', '10 anos'],
    ['Norma de instalação', 'ABNT NBR 16690:2019 / ABNT NBR 5410:2004'],
    ['Conexão à rede', 'Lei 14.300/2022 — Marco Legal da Microgeração'],
  ]
  autoTable(doc, {
    startY: y, head: [], body: rowsGarantia, theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: [248,250,252], cellWidth: 65, textColor: COR2 }, 1: { cellWidth: 117 } },
    margin: { left: 14, right: 14 },
  })
  y = doc.lastAutoTable.finalY + 10

  // CTA
  doc.setFillColor(...COR1).roundedRect(14, y, 182, 28, 3, 3, 'F')
  doc.setFontSize(12).setFont('helvetica', 'bold').setTextColor(...W)
  doc.text('Pronto para economizar na conta de luz?', 105, y + 10, { align: 'center' })
  doc.setFontSize(9).setFont('helvetica', 'normal')
  doc.text(`Entre em contato: ${empresa.telefone ?? '—'}  ·  ${empresa.email ?? '—'}`, 105, y + 18, { align: 'center' })
  if (empresa.site) {
    doc.setFontSize(8)
    doc.text(empresa.site, 105, y + 24, { align: 'center' })
  }
  y += 36

  // Disclaimer
  doc.setFontSize(7).setFont('helvetica', 'italic').setTextColor(...CIN)
  const disc = 'Valores baseados em irradiância histórica da NASA POWER e estimativas de mercado. ' +
    'O investimento real depende das marcas e modelos específicos escolhidos, ' +
    'custos de instalação e homologação da concessionária local. Proposta válida por 30 dias.'
  const linhas = doc.splitTextToSize(disc, 182)
  doc.text(linhas, 14, y)

  rodape(doc, empresa, COR1, COR2)
  return doc
}
