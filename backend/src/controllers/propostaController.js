import { gerarPropostaComercial as gerarPDF, salvarPropostaEmArquivo, obterPropostaComoBuffer } from '../services/propostaComercialService.js'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function gerarPropostaComercial(req, res) {
  try {
    const { projetoId } = req.params
    const { projeto, cliente, financeiro } = req.body

    if (!projeto || !cliente) {
      return res.status(400).json({ erro: 'Dados do projeto e cliente obrigatórios' })
    }

    // Gerar PDF
    const doc = await gerarPDF(projeto, cliente, financeiro || {})

    // Obter como buffer
    const buffer = await obterPropostaComoBuffer(doc)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="proposta_${projetoId}.pdf"`)
    res.send(buffer)
  } catch (err) {
    console.error('Erro ao gerar proposta:', err)
    res.status(500).json({ erro: err.message })
  }
}

export async function baixarProposta(req, res) {
  try {
    const { projetoId } = req.params

    const caminho = join(process.cwd(), 'uploads', 'propostas', `proposta_${projetoId}.pdf`)

    try {
      const arquivo = readFileSync(caminho)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="proposta_${projetoId}.pdf"`)
      res.send(arquivo)
    } catch (err) {
      return res.status(404).json({ erro: 'Proposta não encontrada. Gere uma nova.' })
    }
  } catch (err) {
    console.error('Erro ao baixar proposta:', err)
    res.status(500).json({ erro: err.message })
  }
}

export async function visualizarProposta(req, res) {
  try {
    const { projetoId } = req.params
    const { projeto, cliente, financeiro } = req.body

    if (!projeto || !cliente) {
      return res.status(400).json({ erro: 'Dados do projeto e cliente obrigatórios' })
    }

    // Gerar PDF como preview
    const doc = await gerarPDF(projeto, cliente, financeiro || {})

    // Obter como buffer
    const buffer = await obterPropostaComoBuffer(doc)

    // Retornar como base64 para embed em iframe
    const base64 = buffer.toString('base64')

    res.json({
      sucesso: true,
      pdf_base64: `data:application/pdf;base64,${base64}`,
      nome_arquivo: `proposta_${projetoId}.pdf`,
    })
  } catch (err) {
    console.error('Erro ao visualizar proposta:', err)
    res.status(500).json({ erro: err.message })
  }
}
