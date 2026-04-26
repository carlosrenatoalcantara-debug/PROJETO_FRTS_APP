import { Cliente } from '../models/Cliente.js'

export const listarClientes = async (_req, res) => {
  try {
    const clientes = await Cliente.find().sort({ createdAt: -1 })
    console.log(`✓ GET /api/clientes - Listando ${clientes.length} clientes`)
    res.json(clientes)
  } catch (err) {
    console.error('❌ Erro ao listar clientes:', err)
    res.status(500).json({ mensagem: 'Erro ao listar clientes', erro: err.message })
  }
}

export const buscarCliente = async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.params.id)
    if (!cliente) return res.status(404).json({ mensagem: 'Cliente não encontrado' })
    res.json(cliente)
  } catch (err) {
    console.error('❌ Erro ao buscar cliente:', err)
    res.status(500).json({ mensagem: 'Erro ao buscar cliente', erro: err.message })
  }
}

export const criarCliente = async (req, res) => {
  try {
    const { nome, email, telefone, cidade, estado, tipo, cpf_cnpj } = req.body

    if (!nome || !email) {
      console.warn('❌ Criação de cliente falhou: faltam campos obrigatórios', { nome, email })
      return res.status(400).json({ mensagem: 'Nome e email são obrigatórios', campos: { nome, email } })
    }

    const novo = new Cliente({
      nome,
      email,
      telefone: telefone || '',
      cidade: cidade || '',
      estado: estado || '',
      tipo: tipo || 'Pessoa Física',
      cpf_cnpj: cpf_cnpj || '',
      status: 'ativo',
    })

    await novo.save()
    console.log('✓ Cliente criado com sucesso:', novo._id)
    res.status(201).json(novo)
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ mensagem: 'Email já cadastrado' })
    }
    console.error('❌ Erro ao criar cliente:', err)
    res.status(500).json({ mensagem: 'Erro ao criar cliente', erro: err.message })
  }
}

export const atualizarCliente = async (req, res) => {
  try {
    const cliente = await Cliente.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!cliente) return res.status(404).json({ mensagem: 'Cliente não encontrado' })
    console.log('✓ Cliente atualizado:', cliente._id)
    res.json(cliente)
  } catch (err) {
    console.error('❌ Erro ao atualizar cliente:', err)
    res.status(500).json({ mensagem: 'Erro ao atualizar cliente', erro: err.message })
  }
}

export const excluirCliente = async (req, res) => {
  try {
    const cliente = await Cliente.findByIdAndDelete(req.params.id)
    if (!cliente) return res.status(404).json({ mensagem: 'Cliente não encontrado' })
    console.log('✓ Cliente excluído:', req.params.id)
    res.status(204).end()
  } catch (err) {
    console.error('❌ Erro ao excluir cliente:', err)
    res.status(500).json({ mensagem: 'Erro ao excluir cliente', erro: err.message })
  }
}

export const listarProjetosPorCliente = async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.params.id)
    if (!cliente) return res.status(404).json({ mensagem: 'Cliente não encontrado' })
    res.json({
      cliente,
      projetos: {
        fv: [],
        ev: []
      }
    })
  } catch (err) {
    console.error('❌ Erro ao listar projetos:', err)
    res.status(500).json({ mensagem: 'Erro ao listar projetos', erro: err.message })
  }
}
