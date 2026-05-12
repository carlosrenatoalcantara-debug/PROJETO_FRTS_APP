import PDFDocument from 'pdfkit'
import { Readable } from 'stream'

/**
 * Gera PDF do Diagrama Unifilar para Projeto EV
 * Segue o modelo criado pelo usuário
 */
export async function gerarPDFUnifilar(projeto, cliente, tecnico) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
      })

      const chunks = []
      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks)
        resolve(pdfBuffer)
      })
      doc.on('error', reject)

      // ========== CABEÇALHO ==========
      doc.fontSize(18).font('Helvetica-Bold').text('DIAGRAMA UNIFILAR', { align: 'center' })
      doc.fontSize(12).font('Helvetica').text('INSTALAÇÃO DE CARREGADOR VEICULAR EV', { align: 'center' })
      doc.moveDown(0.5)

      // ========== DADOS DO CLIENTE ==========
      doc.fontSize(11).font('Helvetica-Bold').text('DADOS DO CLIENTE', { underline: true })
      doc.fontSize(10).font('Helvetica')

      const clienteNome = cliente?.nome || 'N/A'
      const clienteCPF = cliente?.cpf || 'N/A'
      const clienteEnd = cliente?.endereco_completo || 'N/A'
      const clienteCEP = cliente?.cep || 'N/A'

      doc.text(
        `Nome: ${clienteNome}${clienteCPF ? ` CPF: ${clienteCPF}` : ''}`
      )
      doc.text(`Endereço: ${clienteEnd}`)
      if (clienteCEP) doc.text(`CEP: ${clienteCEP}`)

      // Adicionar campo de unidade consumidora se disponível
      if (cliente?.unidade_consumidora) {
        doc.text(`Unidade Consumidora: ${cliente.unidade_consumidora}`)
      }
      if (cliente?.carga_instalada_w) {
        const cargaKW = (cliente.carga_instalada_w / 1000).toFixed(1)
        doc.text(`Carga Instalada Atual: ${cliente.carga_instalada_w} W (${cargaKW} kW)`)
      }

      doc.moveDown(0.5)

      // ========== CARREGADOR EV ==========
      doc.fontSize(11).font('Helvetica-Bold').text('CARREGADOR VEICULAR EV', { underline: true })
      doc.fontSize(10).font('Helvetica')

      if (projeto.carregadores && projeto.carregadores.length > 0) {
        const cg = projeto.carregadores[0]
        doc.text(`Modelo: ${cg.modelo || 'N/A'}`)
        doc.text(`Fabricante: ${cg.marca || 'N/A'}`)
        doc.text(`Tipo: ${cg.tipo || 'AC'} - ${cg.potencia_kw || 0} kW`)
        if (cg.tensao_entrada_v) doc.text(`Tensão: ${cg.tensao_entrada_v}V`)
        if (cg.corrente_entrada_a) doc.text(`Corrente Máxima: ${cg.corrente_entrada_a} A`)
      }

      doc.moveDown(0.5)

      // ========== CÁLCULOS NBR 5410 ==========
      if (projeto.calculos_nbr) {
        doc.fontSize(11).font('Helvetica-Bold').text('CÁLCULOS NBR 5410', { underline: true })
        doc.fontSize(10).font('Helvetica')

        const calc = projeto.calculos_nbr
        if (calc.corrente_projeto_a)
          doc.text(`Corrente de Projeto: ${calc.corrente_projeto_a.toFixed(1)} A`)
        if (calc.corrente_maxima_a)
          doc.text(`Corrente Máxima: ${calc.corrente_maxima_a.toFixed(1)} A`)
        if (calc.bitola_cabo_mm2)
          doc.text(`Bitola do Cabo: ${calc.bitola_cabo_mm2} mm²`)
        if (calc.disjuntor_a)
          doc.text(`Disjuntor: ${calc.disjuntor_a} A`)
        if (calc.dr_ma)
          doc.text(`DR: ${calc.dr_ma} mA`)
        if (calc.queda_tensao_pct)
          doc.text(`Queda de Tensão: ${calc.queda_tensao_pct.toFixed(2)}%`)
      }

      doc.moveDown(0.5)

      // ========== LISTA DE MATERIAIS ==========
      if (projeto.calculos_nbr?.materiais && projeto.calculos_nbr.materiais.length > 0) {
        doc.fontSize(11).font('Helvetica-Bold').text('LISTA DE MATERIAIS', { underline: true })
        doc.fontSize(9).font('Helvetica')

        const materiais = projeto.calculos_nbr.materiais
        let itemNum = 1

        // Cabeçalhos da tabela
        const startX = 40
        const col1X = startX
        const col2X = startX + 30
        const col3X = startX + 280
        const col4X = startX + 380

        doc.font('Helvetica-Bold')
        doc.text('ITEM', col1X, doc.y, { width: 30 })
        doc.text('DESCRIÇÃO', col2X, doc.y - 12, { width: 250 })
        doc.text('ESPECIFICAÇÃO', col3X, doc.y + 12, { width: 100 })
        doc.text('QTD', col4X, doc.y, { width: 40 })

        doc.moveTo(startX, doc.y + 2).lineTo(540, doc.y + 2).stroke()
        doc.moveDown(0.3)

        doc.font('Helvetica')
        materiais.forEach((mat) => {
          doc.text(itemNum.toString().padStart(2, '0'), col1X, doc.y, { width: 30 })
          doc.text(mat.item || '', col2X, doc.y - 12, { width: 250 })
          doc.text(mat.especificacao || '', col3X, doc.y + 12, { width: 100 })
          doc.text((mat.quantidade || 1).toString(), col4X, doc.y, { width: 40 })
          doc.moveDown(0.4)
          itemNum++
        })
      }

      doc.moveDown(0.5)

      // ========== DADOS DO TÉCNICO ==========
      if (tecnico) {
        doc.fontSize(11).font('Helvetica-Bold').text('RESPONSÁVEL TÉCNICO', { underline: true })
        doc.fontSize(10).font('Helvetica')
        if (tecnico.nome) doc.text(`Nome: ${tecnico.nome}`)
        if (tecnico.crea) doc.text(`CREA: ${tecnico.crea}`)
        if (tecnico.cft) doc.text(`CFT: ${tecnico.cft}`)
        if (tecnico.tipo_profissional) {
          const tipo = tecnico.tipo_profissional === 'crea' ? 'Engenheiro Eletricista' : 'Eletrotécnico'
          doc.text(`Profissional: ${tipo}`)
        }
      }

      // ========== RODAPÉ ==========
      const pageCount = doc.bufferedPageRange().count
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i)

        // Linha divisória
        doc.moveTo(40, doc.page.height - 50).lineTo(540, doc.page.height - 50).stroke()

        // Rodapé
        doc.fontSize(9).font('Helvetica')
        doc.text('Forte Solar', 40, doc.page.height - 40)
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 200, doc.page.height - 40)
        if (projeto.nome) {
          doc.text(`Projeto: ${projeto.nome}`, 400, doc.page.height - 40)
        }
      }

      doc.end()
    } catch (erro) {
      reject(erro)
    }
  })
}

/**
 * Gera PDF e retorna como stream
 */
export function gerarPDFUnifilarStream(projeto, cliente, tecnico) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    bufferPages: true,
  })

  // ========== CABEÇALHO ==========
  doc.fontSize(18).font('Helvetica-Bold').text('DIAGRAMA UNIFILAR', { align: 'center' })
  doc.fontSize(12).font('Helvetica').text('INSTALAÇÃO DE CARREGADOR VEICULAR EV', { align: 'center' })
  doc.moveDown(0.5)

  // ========== DADOS DO CLIENTE ==========
  doc.fontSize(11).font('Helvetica-Bold').text('DADOS DO CLIENTE', { underline: true })
  doc.fontSize(10).font('Helvetica')

  const clienteNome = cliente?.nome || 'N/A'
  const clienteCPF = cliente?.cpf || 'N/A'
  const clienteEnd = cliente?.endereco_completo || 'N/A'
  const clienteCEP = cliente?.cep || 'N/A'

  doc.text(`Nome: ${clienteNome}${clienteCPF ? ` CPF: ${clienteCPF}` : ''}`)
  doc.text(`Endereço: ${clienteEnd}`)
  if (clienteCEP) doc.text(`CEP: ${clienteCEP}`)

  if (cliente?.unidade_consumidora) {
    doc.text(`Unidade Consumidora: ${cliente.unidade_consumidora}`)
  }
  if (cliente?.carga_instalada_w) {
    const cargaKW = (cliente.carga_instalada_w / 1000).toFixed(1)
    doc.text(`Carga Instalada Atual: ${cliente.carga_instalada_w} W (${cargaKW} kW)`)
  }

  doc.moveDown(0.5)

  // ========== CARREGADOR EV ==========
  doc.fontSize(11).font('Helvetica-Bold').text('CARREGADOR VEICULAR EV', { underline: true })
  doc.fontSize(10).font('Helvetica')

  if (projeto.carregadores && projeto.carregadores.length > 0) {
    const cg = projeto.carregadores[0]
    doc.text(`Modelo: ${cg.modelo || 'N/A'}`)
    doc.text(`Fabricante: ${cg.marca || 'N/A'}`)
    doc.text(`Tipo: ${cg.tipo || 'AC'} - ${cg.potencia_kw || 0} kW`)
    if (cg.tensao_entrada_v) doc.text(`Tensão: ${cg.tensao_entrada_v}V`)
    if (cg.corrente_entrada_a) doc.text(`Corrente Máxima: ${cg.corrente_entrada_a} A`)
  }

  doc.moveDown(0.5)

  // ========== CÁLCULOS NBR 5410 ==========
  if (projeto.calculos_nbr) {
    doc.fontSize(11).font('Helvetica-Bold').text('CÁLCULOS NBR 5410', { underline: true })
    doc.fontSize(10).font('Helvetica')

    const calc = projeto.calculos_nbr
    if (calc.corrente_projeto_a)
      doc.text(`Corrente de Projeto: ${calc.corrente_projeto_a.toFixed(1)} A`)
    if (calc.corrente_maxima_a)
      doc.text(`Corrente Máxima: ${calc.corrente_maxima_a.toFixed(1)} A`)
    if (calc.bitola_cabo_mm2)
      doc.text(`Bitola do Cabo: ${calc.bitola_cabo_mm2} mm²`)
    if (calc.disjuntor_a)
      doc.text(`Disjuntor: ${calc.disjuntor_a} A`)
    if (calc.dr_ma)
      doc.text(`DR: ${calc.dr_ma} mA`)
    if (calc.queda_tensao_pct)
      doc.text(`Queda de Tensão: ${calc.queda_tensao_pct.toFixed(2)}%`)
  }

  doc.moveDown(0.5)

  // ========== LISTA DE MATERIAIS ==========
  if (projeto.calculos_nbr?.materiais && projeto.calculos_nbr.materiais.length > 0) {
    doc.fontSize(11).font('Helvetica-Bold').text('LISTA DE MATERIAIS', { underline: true })
    doc.fontSize(9).font('Helvetica')

    const materiais = projeto.calculos_nbr.materiais
    let itemNum = 1

    const startX = 40
    const col1X = startX
    const col2X = startX + 30
    const col3X = startX + 280
    const col4X = startX + 380

    doc.font('Helvetica-Bold')
    doc.text('ITEM', col1X, doc.y, { width: 30 })
    doc.text('DESCRIÇÃO', col2X, doc.y - 12, { width: 250 })
    doc.text('ESPECIFICAÇÃO', col3X, doc.y + 12, { width: 100 })
    doc.text('QTD', col4X, doc.y, { width: 40 })

    doc.moveTo(startX, doc.y + 2).lineTo(540, doc.y + 2).stroke()
    doc.moveDown(0.3)

    doc.font('Helvetica')
    materiais.forEach((mat) => {
      doc.text(itemNum.toString().padStart(2, '0'), col1X, doc.y, { width: 30 })
      doc.text(mat.item || '', col2X, doc.y - 12, { width: 250 })
      doc.text(mat.especificacao || '', col3X, doc.y + 12, { width: 100 })
      doc.text((mat.quantidade || 1).toString(), col4X, doc.y, { width: 40 })
      doc.moveDown(0.4)
      itemNum++
    })
  }

  doc.moveDown(0.5)

  // ========== DADOS DO TÉCNICO ==========
  if (tecnico) {
    doc.fontSize(11).font('Helvetica-Bold').text('RESPONSÁVEL TÉCNICO', { underline: true })
    doc.fontSize(10).font('Helvetica')
    if (tecnico.nome) doc.text(`Nome: ${tecnico.nome}`)
    if (tecnico.crea) doc.text(`CREA: ${tecnico.crea}`)
    if (tecnico.cft) doc.text(`CFT: ${tecnico.cft}`)
    if (tecnico.tipo_profissional) {
      const tipo =
        tecnico.tipo_profissional === 'crea' ? 'Engenheiro Eletricista' : 'Eletrotécnico'
      doc.text(`Profissional: ${tipo}`)
    }
  }

  // ========== RODAPÉ ==========
  const pageCount = doc.bufferedPageRange().count
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i)

    doc.moveTo(40, doc.page.height - 50).lineTo(540, doc.page.height - 50).stroke()

    doc.fontSize(9).font('Helvetica')
    doc.text('Forte Solar', 40, doc.page.height - 40)
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 200, doc.page.height - 40)
    if (projeto.nome) {
      doc.text(`Projeto: ${projeto.nome}`, 400, doc.page.height - 40)
    }
  }

  return doc
}
