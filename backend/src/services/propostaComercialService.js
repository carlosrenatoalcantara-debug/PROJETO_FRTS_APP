import PDFDocument from 'pdfkit'
import { createWriteStream } from 'fs'
import { join } from 'path'
import { mkdirSync } from 'fs'

const CORES = {
  primaria: '#1e40af',
  secundaria: '#0369a1',
  destaque: '#059669',
  texto: '#1f2937',
  cinza: '#6b7280',
  fundo: '#f3f4f6',
}

const EMPRESA = {
  nome: process.env.EMPRESA_NOME || 'Forte Solar Energia',
  cnpj: process.env.EMPRESA_CNPJ || 'XX.XXX.XXX/XXXX-XX',
  endereco: process.env.EMPRESA_ENDERECO || 'Endereço da Empresa',
  telefone: process.env.EMPRESA_TELEFONE || '(00) 0000-0000',
  email: process.env.EMPRESA_EMAIL || 'contato@fortesolar.com.br',
  website: process.env.EMPRESA_WEBSITE || 'www.fortesolar.com.br',
  cor: process.env.EMPRESA_COR || '#1e40af',
}

export async function gerarPropostaComercial(projeto, cliente, financeiro = {}) {
  const doc = new PDFDocument({ bufferPages: true, margin: 40 })

  // Configurações do PDF
  const largura = doc.page.width
  const altura = doc.page.height
  const dataProposal = new Date()
  const numeroProposal = `PROP-${projeto._id || 'DRAFT'}-${dataProposal.getFullYear()}`

  // Dados para cálculos
  const potenciaKWp = projeto.potencia_kwp || 5
  const geracaoMensal = (potenciaKWp * 131.44 / 12).toFixed(2)
  const geracaoAnual = (potenciaKWp * 131.44).toFixed(2)
  const tarifaMensal = parseFloat(financeiro.tarifa_media || 0.80)
  const economiaGerada = (geracaoMensal * tarifaMensal).toFixed(2)
  const contaAtual = financeiro.conta_media || 500
  const contaApos = Math.max(30, contaAtual - economiaGerada)
  const investimento = financeiro.investimento_total || 25000
  const payback = (investimento / (economiaGerada * 12)).toFixed(1)
  const tir = financeiro.tir || 15.5
  const vpl = financeiro.vpl || 85000
  const economiaTotal25anos = (economiaGerada * 12 * 25 * 0.8).toFixed(0)

  // Funções auxiliares
  function addCabecalho() {
    doc.fillColor(CORES.primaria)
    doc.rect(0, 0, largura, 60).fill()
    doc.fillColor('white')
    doc.fontSize(20).font('Helvetica-Bold').text(EMPRESA.nome, 50, 15)
    doc.fontSize(10).font('Helvetica').text(`CNPJ: ${EMPRESA.cnpj} | ${EMPRESA.telefone}`, 50, 35)
    doc.addPage()
  }

  function addRodape() {
    const yRodape = altura - 30
    doc.fontSize(8).fillColor(CORES.cinza).text(
      `${EMPRESA.website} | ${EMPRESA.email} | ${EMPRESA.telefone}`,
      40, yRodape
    )
    doc.text(`Proposta ${numeroProposal} | Página ${doc.bufferedPageRange().count}`, 40, yRodape + 15)
  }

  // PÁGINA 1 - CAPA
  doc.fillColor(CORES.primaria).rect(0, 0, largura, altura).fill()
  doc.fillColor('white').fontSize(48).font('Helvetica-Bold').text(
    'Proposta Comercial',
    0, 150, { align: 'center', width: largura }
  )
  doc.fontSize(32).text('Sistema Fotovoltaico', 0, 220, { align: 'center', width: largura })
  doc.fontSize(14).text('', 0, 300, { align: 'center', width: largura })
  doc.fontSize(18).font('Helvetica').text(cliente?.nome || 'Cliente', 0, 320, {
    align: 'center',
    width: largura,
  })
  doc.fontSize(12).fillColor('#dbeafe').text(
    `Proposta nº ${numeroProposal}`,
    0, 360, { align: 'center', width: largura }
  )
  doc.fontSize(11).text(
    `Emitida em ${dataProposal.toLocaleDateString('pt-BR')}`,
    0, 385, { align: 'center', width: largura }
  )
  doc.fontSize(11).text(
    'Válida por 30 dias',
    0, 410, { align: 'center', width: largura }
  )
  addRodape()

  // PÁGINA 2 - RESUMO EXECUTIVO
  doc.addPage()
  addCabecalho()
  doc.fillColor(CORES.texto).fontSize(24).font('Helvetica-Bold').text('Resumo Executivo', 40, 80)
  doc.fontSize(11).font('Helvetica').fillColor(CORES.cinza).text(
    'Proposta de um sistema de geração de energia solar fotovoltaica customizado para suas necessidades.',
    40, 120, { width: largura - 80, align: 'justify' }
  )

  // KPIs em destaque
  const kpis = [
    { titulo: 'Potência Instalada', valor: `${potenciaKWp} kWp`, icon: '⚡' },
    { titulo: 'Geração Mensal', valor: `${geracaoMensal} kWh`, icon: '☀️' },
    { titulo: 'Economia Mensal', valor: `R$ ${economiaGerada}`, icon: '💰' },
    { titulo: 'Payback', valor: `${payback} anos`, icon: '📊' },
    { titulo: 'Economia 25 Anos', valor: `R$ ${economiaTotal25anos}`, icon: '🎯' },
  ]

  let yKPI = 200
  kpis.forEach((kpi, idx) => {
    if (idx % 2 === 0) yKPI += 60
    const xKPI = idx % 2 === 0 ? 50 : largura / 2 + 20

    doc.fillColor(CORES.fundo).rect(xKPI, yKPI - 40, 200, 50).fill()
    doc.fillColor(CORES.primaria).fontSize(14).font('Helvetica-Bold').text(
      `${kpi.icon} ${kpi.titulo}`,
      xKPI + 10, yKPI - 30
    )
    doc.fillColor(CORES.destaque).fontSize(16).font('Helvetica-Bold').text(
      kpi.valor,
      xKPI + 10, yKPI - 10
    )
  })
  addRodape()

  // PÁGINA 3 - ANTES vs DEPOIS
  doc.addPage()
  addCabecalho()
  doc.fillColor(CORES.texto).fontSize(24).font('Helvetica-Bold').text('Análise Comparativa', 40, 80)

  // Tabela
  const tableX = 50
  const tableY = 150
  const colWidth = (largura - 100) / 3

  // Cabeçalho tabela
  doc.fillColor(CORES.primaria).rect(tableX, tableY, colWidth * 3, 30).fill()
  doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
  doc.text('Descrição', tableX + 10, tableY + 8, { width: colWidth - 20 })
  doc.text('Conta Atual', tableX + colWidth + 10, tableY + 8, { width: colWidth - 20 })
  doc.text('Com Solar', tableX + colWidth * 2 + 10, tableY + 8, { width: colWidth - 20 })

  // Linhas
  const linhas = [
    { desc: 'Consumo Estimado', atual: `R$ ${contaAtual.toFixed(2)}`, depois: `R$ ${contaApos.toFixed(2)}` },
    { desc: 'Taxa Mínima', atual: '(Incluída)', depois: 'R$ 30-50' },
    { desc: 'Economia Mensal', atual: 'R$ 0', depois: `R$ ${economiaGerada}` },
  ]

  let rowY = tableY + 35
  linhas.forEach((linha) => {
    doc.fillColor(CORES.fundo).rect(tableX, rowY, colWidth * 3, 25).fill()
    doc.fillColor(CORES.texto).fontSize(10).font('Helvetica')
    doc.text(linha.desc, tableX + 10, rowY + 5, { width: colWidth - 20 })
    doc.text(linha.atual, tableX + colWidth + 10, rowY + 5, { width: colWidth - 20 })
    doc.text(linha.depois, tableX + colWidth * 2 + 10, rowY + 5, { width: colWidth - 20 })
    rowY += 30
  })

  // Economia em destaque
  doc.fillColor(CORES.destaque).rect(50, rowY + 10, largura - 100, 40).fill()
  doc.fillColor('white').fontSize(14).font('Helvetica-Bold').text(
    `ECONOMIA MENSAL: R$ ${economiaGerada}`,
    60, rowY + 20, { width: largura - 120 }
  )
  addRodape()

  // PÁGINA 4 - ESPECIFICAÇÃO TÉCNICA
  doc.addPage()
  addCabecalho()
  doc.fillColor(CORES.texto).fontSize(24).font('Helvetica-Bold').text('Especificação Técnica', 40, 80)

  let yTec = 150
  const secoes = [
    { titulo: 'Módulos Fotovoltaicos', conteudo: [
      `${projeto.strings?.totalModulos || 10} módulos ${projeto.painel?.marca || 'Marca'} ${projeto.painel?.modelo || 'Modelo'}`,
      `Potência nominal: ${projeto.painel?.pmpp || 400}W por módulo`,
      `Tecnologia: Silício cristalino`,
      `Garantia: ${projeto.painel?.garantia_produto || 12} anos (produto), ${projeto.painel?.garantia_performance || 25} anos (performance 80%)`,
    ]},
    { titulo: 'Inversor', conteudo: [
      `${projeto.inversor?.modelo || 'Modelo'} - ${projeto.inversor?.potenciaKW || 5}kW`,
      `Tipo: ${projeto.inversor?.tipo || 'String'}`,
      `Fases: ${projeto.inversor?.fases || 3}F`,
      `Garantia: ${projeto.inversor?.garantia || 10} anos`,
    ]},
    { titulo: 'Estrutura', conteudo: [
      `Tipo: ${projeto.estrutura?.tipo || 'Fibrocimento'}`,
      `Material: Alumínio anodizado`,
      `Inclinação: Otimizada para local`,
      `Garantia: ${projeto.estrutura?.garantia || 10} anos`,
    ]},
    { titulo: 'Proteções e Cabeamento', conteudo: [
      'Disjuntor seccionadora DC 125A/1000V',
      'DPS (Proteção contra Surtos) Tipo 2',
      'DR 30mA diferencial residual AC',
      'Condutores de cobre isolado com proteção mecânica',
    ]},
  ]

  secoes.forEach((sec) => {
    doc.fillColor(CORES.primaria).fontSize(12).font('Helvetica-Bold').text(sec.titulo, 50, yTec)
    yTec += 25
    sec.conteudo.forEach((item) => {
      doc.fillColor(CORES.texto).fontSize(10).font('Helvetica').text(`• ${item}`, 60, yTec)
      yTec += 18
    })
    yTec += 10
  })
  addRodape()

  // PÁGINA 5 - ANÁLISE FINANCEIRA
  doc.addPage()
  addCabecalho()
  doc.fillColor(CORES.texto).fontSize(24).font('Helvetica-Bold').text('Análise Financeira', 40, 80)

  let yFin = 150
  const financeirosItems = [
    { label: 'Investimento Total', valor: `R$ ${investimento.toLocaleString('pt-BR')}`, destaque: true },
    { label: 'Payback Simples', valor: `${payback} anos`, destaque: false },
    { label: 'Taxa Interna de Retorno (TIR)', valor: `${tir}% a.a.`, destaque: false },
    { label: 'Valor Presente Líquido (VPL)', valor: `R$ ${vpl.toLocaleString('pt-BR')}`, destaque: false },
    { label: 'Geração Anual Estimada', valor: `${geracaoAnual} kWh`, destaque: false },
    { label: 'Economia Anual', valor: `R$ ${(economiaGerada * 12).toFixed(2)}`, destaque: false },
  ]

  financeirosItems.forEach((item) => {
    if (item.destaque) {
      doc.fillColor(CORES.destaque).rect(50, yFin - 5, largura - 100, 30).fill()
      doc.fillColor('white').fontSize(12).font('Helvetica-Bold').text(item.label, 60, yFin)
      doc.fontSize(14).text(item.valor, largura - 200, yFin)
    } else {
      doc.fillColor(CORES.fundo).rect(50, yFin - 5, largura - 100, 25).fill()
      doc.fillColor(CORES.texto).fontSize(10).font('Helvetica').text(item.label, 60, yFin)
      doc.fontSize(11).font('Helvetica-Bold').text(item.valor, largura - 200, yFin)
    }
    yFin += 35
  })

  doc.fillColor(CORES.primaria).fontSize(12).font('Helvetica-Bold').text('Formas de Pagamento:', 50, yFin + 10)
  doc.fillColor(CORES.texto).fontSize(10).font('Helvetica').text(
    '• À vista com desconto | • Financiamento em até 84 meses | • Leasing | • Consórcio',
    60, yFin + 35, { width: largura - 120 }
  )
  addRodape()

  // PÁGINA 6 - GERAÇÃO MENSAL
  doc.addPage()
  addCabecalho()
  doc.fillColor(CORES.texto).fontSize(24).font('Helvetica-Bold').text('Projeção de Geração Mensal', 40, 80)

  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const geracao_meses = [1.1, 1.05, 1.0, 0.95, 0.9, 0.85, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1]

  let yMeses = 150
  doc.fontSize(9).font('Helvetica-Bold')
  meses.forEach((mes, idx) => {
    const xMes = 50 + (idx % 6) * 100
    const valor = (geracaoMensal * geracao_meses[idx]).toFixed(0)
    doc.fillColor(CORES.fundo).rect(xMes, yMeses, 90, 80).fill()
    doc.fillColor(CORES.primaria).text(mes, xMes + 5, yMeses + 5)
    doc.fillColor(CORES.destaque).fontSize(12).text(valor + ' kWh', xMes + 5, yMeses + 35)
    if ((idx + 1) % 6 === 0) yMeses += 95
  })

  doc.fillColor(CORES.primaria).fontSize(12).font('Helvetica-Bold').text(
    `Total Anual: ${geracaoAnual} kWh`,
    50, yMeses + 20
  )
  addRodape()

  // PÁGINA 7 - GARANTIAS E BENEFÍCIOS
  doc.addPage()
  addCabecalho()
  doc.fillColor(CORES.texto).fontSize(24).font('Helvetica-Bold').text('Garantias e Benefícios', 40, 80)

  let yGar = 150
  const garantias = [
    { titulo: '✓ Garantia dos Equipamentos', items: [
      `Painéis: ${projeto.painel?.garantia_produto || 12} anos produto, ${projeto.painel?.garantia_performance || 25} anos performance`,
      `Inversor: ${projeto.inversor?.garantia || 10} anos`,
      'Estrutura: 10 anos',
    ]},
    { titulo: '✓ Garantia de Instalação', items: [
      'Execução conforme normas ABNT NBR 16690',
      'Inspeção técnica completa',
      'Correção de defeitos em 12 meses',
    ]},
    { titulo: '✓ Suporte Técnico', items: [
      'Atendimento telefônico/WhatsApp 24h',
      'Suporte remoto via acesso ao sistema',
      'Visitas técnicas quando necessário',
    ]},
    { titulo: '✓ Monitoramento Remoto', items: [
      'Plataforma web de monitoramento 24/7',
      'Alertas automáticos de anomalias',
      'Relatórios mensais de desempenho',
    ]},
  ]

  garantias.forEach((g) => {
    doc.fillColor(CORES.primaria).fontSize(12).font('Helvetica-Bold').text(g.titulo, 50, yGar)
    yGar += 20
    g.items.forEach((item) => {
      doc.fillColor(CORES.texto).fontSize(10).font('Helvetica').text(`  ${item}`, 60, yGar)
      yGar += 16
    })
    yGar += 5
  })
  addRodape()

  // PÁGINA 8 - INVESTIMENTO
  doc.addPage()
  addCabecalho()
  doc.fillColor(CORES.texto).fontSize(24).font('Helvetica-Bold').text('Detalhamento do Investimento', 40, 80)

  const invest_items = [
    { desc: 'Kit Fotovoltaico (painéis + inversor)', valor: (investimento * 0.45).toFixed(2) },
    { desc: 'Materiais e Componentes', valor: (investimento * 0.15).toFixed(2) },
    { desc: 'Mão de Obra', valor: (investimento * 0.25).toFixed(2) },
    { desc: 'Projeto Técnico e Homologação', valor: (investimento * 0.10).toFixed(2) },
    { desc: 'Impostos e Taxas', valor: (investimento * 0.05).toFixed(2) },
  ]

  let yInv = 150
  invest_items.forEach((item) => {
    doc.fillColor(CORES.fundo).rect(50, yInv, largura - 100, 25).fill()
    doc.fillColor(CORES.texto).fontSize(10).font('Helvetica').text(item.desc, 60, yInv + 5)
    doc.fontSize(11).font('Helvetica-Bold').text(`R$ ${parseFloat(item.valor).toLocaleString('pt-BR')}`, largura - 150, yInv + 5)
    yInv += 30
  })

  doc.fillColor(CORES.destaque).rect(50, yInv, largura - 100, 35).fill()
  doc.fillColor('white').fontSize(14).font('Helvetica-Bold').text('TOTAL', 60, yInv + 8)
  doc.fontSize(16).text(`R$ ${investimento.toLocaleString('pt-BR')}`, largura - 200, yInv + 5)

  yInv += 50
  doc.fillColor(CORES.texto).fontSize(12).font('Helvetica-Bold').text('Condições Comerciais', 50, yInv)
  yInv += 25
  doc.fontSize(10).font('Helvetica').text(
    `• Entrada: 20% | • Restante em até 84 meses | • Sem juros (conforme aprovação de crédito)`,
    60, yInv
  )
  addRodape()

  // PÁGINA 9 - PRAZO E ETAPAS
  doc.addPage()
  addCabecalho()
  doc.fillColor(CORES.texto).fontSize(24).font('Helvetica-Bold').text('Cronograma de Execução', 40, 80)

  const etapas = [
    { fase: 'Projeto e Aprovação', dias: 10 },
    { fase: 'Homologação na Concessionária', dias: 30 },
    { fase: 'Instalação e Testes', dias: 5 },
    { fase: 'Vistoria Técnica', dias: 7 },
    { fase: 'Conexão à Rede', dias: 15 },
  ]

  let yEtapa = 150
  let diaAcumulado = 0
  etapas.forEach((etapa, idx) => {
    const inicioBar = 150 + diaAcumulado * 2
    const larBar = etapa.dias * 2

    doc.fillColor(CORES.primaria).rect(100, yEtapa, larBar, 30).fill()
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold').text(
      `${etapa.fase}`,
      105, yEtapa + 5, { width: larBar - 10 }
    )
    doc.fontSize(9).text(`${etapa.dias} dias`, 105, yEtapa + 18, { width: larBar - 10 })

    doc.fillColor(CORES.cinza).fontSize(10).font('Helvetica').text(
      `Dia ${diaAcumulado + 1} ao ${diaAcumulado + etapa.dias}`,
      100 + larBar + 20, yEtapa + 10
    )

    yEtapa += 45
    diaAcumulado += etapa.dias
  })

  doc.fillColor(CORES.destaque).fontSize(14).font('Helvetica-Bold').text(
    `PRAZO TOTAL: ${diaAcumulado} dias (${(diaAcumulado / 30).toFixed(1)} meses)`,
    50, yEtapa + 10
  )
  addRodape()

  // PÁGINA 10 - ACEITE
  doc.addPage()
  addCabecalho()
  doc.fillColor(CORES.texto).fontSize(24).font('Helvetica-Bold').text('Termo de Aceite', 40, 80)

  doc.fontSize(11).font('Helvetica').text(
    `Esta proposta foi elaborada especificamente para ${cliente?.nome || 'Cliente'} e está válida por 30 dias a partir de ${dataProposal.toLocaleDateString('pt-BR')}.`,
    50, 150, { width: largura - 100, align: 'justify' }
  )

  let yAceite = 220
  doc.fillColor(CORES.primaria).fontSize(11).font('Helvetica-Bold').text('Responsável Técnico', 50, yAceite)
  doc.fontSize(10).font('Helvetica').text(
    `${process.env.RESPONSAVEL_TECNICO || 'Nome do Responsável'}`,
    50, yAceite + 20
  )
  doc.text(`CREA/CFT: ${process.env.CREA_NÚMERO || 'XXXX/XX-XXXXX'}`, 50, yAceite + 40)
  doc.text('________________________', 50, yAceite + 70)

  doc.fillColor(CORES.primaria).fontSize(11).font('Helvetica-Bold').text('Cliente - Assinatura', 320, yAceite)
  doc.fontSize(10).font('Helvetica').text(`${cliente?.nome || 'Nome do Cliente'}`, 320, yAceite + 20)
  doc.text(`CPF/CNPJ: ${cliente?.cpf_cnpj || 'XXX.XXX.XXX-XX'}`, 320, yAceite + 40)
  doc.text('________________________', 320, yAceite + 70)

  yAceite += 120
  doc.fillColor(CORES.cinza).fontSize(9).font('Helvetica').text(
    `Local: _________________     Data: ____ / ____ / ______`,
    50, yAceite
  )

  yAceite += 30
  doc.fillColor(CORES.texto).fontSize(10).font('Helvetica-Bold').text('Observações:', 50, yAceite)
  yAceite += 20
  doc.fontSize(9).font('Helvetica').text(
    financeiro.observacoes || 'Esta proposta está vinculada aos dados técnicos do projeto e não constitui promessa de venda.',
    50, yAceite, { width: largura - 100, align: 'justify' }
  )

  addRodape()

  return doc
}

export function salvarPropostaEmArquivo(doc, projetoId) {
  mkdirSync(join(process.cwd(), 'uploads', 'propostas'), { recursive: true })
  const caminho = join(process.cwd(), 'uploads', 'propostas', `proposta_${projetoId}.pdf`)
  const stream = createWriteStream(caminho)

  return new Promise((resolve, reject) => {
    doc.pipe(stream)
    doc.end()
    stream.on('finish', () => resolve(caminho))
    stream.on('error', reject)
  })
}

export function obterPropostaComoBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}
