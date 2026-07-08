import { Cliente } from '../models/Cliente.js'
import mongoose from 'mongoose'
import { memoryStore } from '../config/memoryStorage.js'

const usarMemoryStorage = () => mongoose.connection.readyState !== 1

export const listarClientes = async (_req, res) => {
  try {
    let clientes

    // Usar memory storage se MongoDB está offline
    if (usarMemoryStorage()) {
      console.log('⚠️  MongoDB offline - Usando dados em memória')
      clientes = memoryStore.findAllClientes().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      console.log(`✓ GET /api/clientes - Listando ${clientes.length} clientes (memory storage)`)
      return res.json({ data: clientes, origem: 'memory' })
    }

    // Usar MongoDB se disponível
    clientes = await Cliente.find().sort({ createdAt: -1 })
    console.log(`✓ GET /api/clientes - Listando ${clientes.length} clientes (MongoDB)`)
    res.json(clientes)
  } catch (err) {
    console.error('❌ Erro ao listar clientes:', err)
    res.status(500).json({ mensagem: 'Erro ao listar clientes', erro: err.message })
  }
}

export const buscarCliente = async (req, res) => {
  try {
    let cliente

    // Usar memory storage se MongoDB está offline
    if (usarMemoryStorage()) {
      console.log('⚠️  MongoDB offline - Usando dados em memória')
      cliente = memoryStore.findClienteById(req.params.id)
      if (!cliente) return res.status(404).json({ mensagem: 'Cliente não encontrado' })
      return res.json(cliente)
    }

    // Usar MongoDB se disponível
    cliente = await Cliente.findById(req.params.id)
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
      subgrupo, tipo_ligacao, valor_kwh, consumo_kwh,
      carga_instalada_kw, disjuntor_geral_a   // FEATURE-006: disponibilidade elétrica da UC
    } = req.body

    if (!nome || !email) {
      console.warn('❌ Criação de cliente falhou: faltam campos obrigatórios', { nome, email })
      return res.status(400).json({ mensagem: 'Nome e email são obrigatórios', campos: { nome, email } })
    }

    const clienteData = {
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
      // FEATURE-006: null quando não informado (memorial imprime espaço em branco).
      carga_instalada_kw: carga_instalada_kw != null && carga_instalada_kw !== '' ? parseFloat(carga_instalada_kw) : null,
      disjuntor_geral_a: disjuntor_geral_a != null && disjuntor_geral_a !== '' ? parseFloat(disjuntor_geral_a) : null,
      status: 'ativo',
    }

    let novo

    // Usar memory storage se MongoDB está offline
    if (usarMemoryStorage()) {
      console.log('⚠️  MongoDB offline - Salvando em memória')
      novo = memoryStore.createCliente(clienteData)
      console.log('✓ Cliente criado com sucesso (memory storage):', novo._id, `(${nome})`)
      return res.status(201).json(novo)
    }

    // Usar MongoDB se disponível
    novo = new Cliente(clienteData)
    await novo.save()
    console.log('✓ Cliente criado com sucesso (MongoDB):', novo._id, `(${nome})`)
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
