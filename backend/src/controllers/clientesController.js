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
    const {
      nome, email, telefone, cidade, estado, tipo, cpf_cnpj,
      endereco_completo, cep,
      numero_cliente, codigo_instalacao, distribuidora, classificacao,
      subgrupo, tipo_ligacao, valor_kwh, consumo_kwh
    } = req.body

    if (!nome || !email) {
      console.warn('❌ Criação de cliente falhou: faltam campos obrigatórios', { nome, email })
      return res.status(400).json({ mensagem: 'Nome e email são obrigatórios', campos: { nome, email } })
    }

    const novo = new Cliente({
      nome: nome.trim(),
      email: email.toLowerCase().trim(),
      telefone: telefone || '',
      cpf_cnpj: cpf_cnpj || '',
      tipo: tipo || 'Pessoa Física',
      endereco_completo: endereco_completo || '',
      cep: cep || '',
      cidade: cidade || '',
      estado: estado || '',
      numero_cliente: numero_cliente || '',
      codigo_instalacao: codigo_instalacao || '',
      distribuidora: distribuidora || '',
      classificacao: classificacao || '',
      subgrupo: subgrupo || '',
      tipo_ligacao: tipo_ligacao || '',
      valor_kwh: parseFloat(valor_kwh) || 0,
      consumo_kwh: parseFloat(consumo_kwh) || 0,
      status: 'ativo',
    })

    await novo.save()
    console.log('✓ Cliente criado com sucesso:', novo._id, `(${nome})`)
    res.status(201).json(novo)
  } catch (err) {
    if (err.code === 11000) {
      console.warn('❌ Email duplicado:', req.body.email)
      return res.status(400).json({ mensagem: 'Email já cadastrado' })
    }
    console.error('❌ Erro ao criar cliente:', err.message)
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
