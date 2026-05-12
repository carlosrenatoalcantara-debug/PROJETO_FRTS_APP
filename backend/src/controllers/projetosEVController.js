import { ProjetoEV } from '../models/ProjetoEV.js'
import mongoose from 'mongoose'
import { gerarPDFUnifilarStream } from '../utils/gerarPDFUnifilar.js'

export const listarProjetosEV = async (_req, res) => {
  try {
    const projetos = await ProjetoEV.find().populate('clienteId').sort({ createdAt: -1 })
    console.log(`✓ GET /api/projetos-ev - Listando ${projetos.length} projetos EV`)
    res.json(projetos)
  } catch (err) {
    console.error('❌ Erro ao listar projetos EV:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const buscarProjetoEV = async (req, res) => {
  try {
    const p = await ProjetoEV.findById(req.params.id).populate('clienteId')
    if (!p) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    res.json(p)
  } catch (err) {
    console.error('❌ Erro ao buscar projeto EV:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const criarProjetoEV = async (req, res) => {
  try {
    const { clienteId, nome, tipo_carregamento } = req.body

    if (!clienteId || !nome) {
      return res.status(400).json({ erro: 'Campos clienteId e nome são obrigatórios' })
    }

    if (!mongoose.Types.ObjectId.isValid(clienteId)) {
      return res.status(400).json({ erro: 'ClienteId inválido' })
    }

    const novo = new ProjetoEV({
      clienteId,
      nome,
      tipo_carregamento: tipo_carregamento || 'AC',
      status: 'rascunho',
    })

    await novo.save()
    await novo.populate('clienteId')
    console.log('✓ Projeto EV criado:', novo._id)
    res.status(201).json(novo)
  } catch (err) {
    console.error('❌ Erro ao criar projeto EV:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const atualizarProjetoEV = async (req, res) => {
  try {
    const projeto = await ProjetoEV.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('clienteId')
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    console.log('✓ Projeto EV atualizado:', req.params.id)
    res.json(projeto)
  } catch (err) {
    console.error('❌ Erro ao atualizar projeto EV:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const excluirProjetoEV = async (req, res) => {
  try {
    const projeto = await ProjetoEV.findByIdAndDelete(req.params.id)
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    console.log('✓ Projeto EV excluído:', req.params.id)
    res.status(204).end()
  } catch (err) {
    console.error('❌ Erro ao excluir projeto EV:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const listarProjetosEVPorCliente = async (req, res) => {
  try {
    const { clienteId } = req.params
    if (!mongoose.Types.ObjectId.isValid(clienteId)) {
      return res.status(400).json({ erro: 'ClienteId inválido' })
    }
    const projetosDocliente = await ProjetoEV.find({ clienteId }).sort({ createdAt: -1 })
    console.log(`✓ Listando ${projetosDocliente.length} projetos EV do cliente ${clienteId}`)
    res.json(projetosDocliente)
  } catch (err) {
    console.error('❌ Erro ao listar projetos EV por cliente:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const exportarPDFProjetoEV = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ erro: 'ID do projeto inválido' })
    }

    const projeto = await ProjetoEV.findById(id).populate('clienteId')
    if (!projeto) {
      return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    }

    // Dados do técnico
    const tecnico = projeto.tecnico || {}

    // Gerar PDF
    const doc = gerarPDFUnifilarStream(projeto, projeto.clienteId, tecnico)

    // Configurar resposta
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Unifilar_${projeto.nome.replace(/\s+/g, '_')}.pdf"`
    )

    // Enviar PDF
    doc.pipe(res)
    doc.end()

    console.log(`✓ PDF gerado para projeto: ${projeto.nome}`)
  } catch (err) {
    console.error('❌ Erro ao gerar PDF:', err)
    res.status(500).json({ erro: err.message })
  }
}
