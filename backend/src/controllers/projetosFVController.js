import { ProjetoFV } from '../models/ProjetoFV.js'
import mongoose from 'mongoose'

export const listarProjetosFV = async (_req, res) => {
  try {
    const projetos = await ProjetoFV.find().populate('clienteId').sort({ createdAt: -1 })
    console.log(`✓ GET /api/projetos-fv - Listando ${projetos.length} projetos`)
    res.json(projetos)
  } catch (err) {
    console.error('❌ Erro ao listar projetos FV:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const buscarProjetoFV = async (req, res) => {
  try {
    const p = await ProjetoFV.findById(req.params.id).populate('clienteId')
    if (!p) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    res.json(p)
  } catch (err) {
    console.error('❌ Erro ao buscar projeto FV:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const criarProjetoFV = async (req, res) => {
  try {
    const {
      clienteId,
      nome,
      status,
      endereco_completo,
      latitude,
      longitude,
      geocoding_origem,
      geocoding_confianca,
      geocodificado_em,
    } = req.body

    if (!clienteId || !nome) {
      return res.status(400).json({ erro: 'Campos clienteId e nome são obrigatórios' })
    }

    // Validar que clienteId é um ObjectId válido
    if (!mongoose.Types.ObjectId.isValid(clienteId)) {
      return res.status(400).json({ erro: 'ClienteId inválido' })
    }

    const novo = new ProjetoFV({
      clienteId,
      nome,
      status: status || 'rascunho',
      endereco_completo: endereco_completo || '',
      latitude: latitude === undefined || latitude === null || latitude === '' ? null : Number(latitude),
      longitude: longitude === undefined || longitude === null || longitude === '' ? null : Number(longitude),
      geocoding_origem: geocoding_origem || null,
      geocoding_confianca: geocoding_confianca !== undefined && geocoding_confianca !== null ? Number(geocoding_confianca) : null,
      geocodificado_em: geocodificado_em ? new Date(geocodificado_em) : null,
      irradiancia_local: 131.44,
    })

    await novo.save()
    await novo.populate('clienteId')
    console.log('✓ Projeto FV criado:', novo._id)
    res.status(201).json(novo)
  } catch (err) {
    console.error('❌ Erro ao criar projeto FV:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const atualizarProjetoFV = async (req, res) => {
  try {
    const projeto = await ProjetoFV.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('clienteId')
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    console.log('✓ Projeto FV atualizado:', req.params.id)
    res.json(projeto)
  } catch (err) {
    console.error('❌ Erro ao atualizar projeto FV:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const excluirProjetoFV = async (req, res) => {
  try {
    const projeto = await ProjetoFV.findByIdAndDelete(req.params.id)
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    console.log('✓ Projeto FV excluído:', req.params.id)
    res.status(204).end()
  } catch (err) {
    console.error('❌ Erro ao excluir projeto FV:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const listarProjetosFVPorCliente = async (req, res) => {
  try {
    const { clienteId } = req.params
    if (!mongoose.Types.ObjectId.isValid(clienteId)) {
      return res.status(400).json({ erro: 'ClienteId inválido' })
    }
    const projetosDocliente = await ProjetoFV.find({ clienteId }).sort({ createdAt: -1 })
    console.log(`✓ Listando ${projetosDocliente.length} projetos do cliente ${clienteId}`)
    res.json(projetosDocliente)
  } catch (err) {
    console.error('❌ Erro ao listar projetos por cliente:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const salvarTelhado = async (req, res) => {
  try {
    const { id } = req.params
    const {
      endereco_completo,
      latitude,
      longitude,
      geocoding_origem,
      geocoding_confianca,
      geocodificado_em,
      telhado,
    } = req.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ erro: 'ID inválido' })
    }

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    if (endereco_completo) projeto.endereco_completo = endereco_completo
    if (latitude !== undefined) {
      projeto.latitude = latitude === null || latitude === '' ? null : Number(latitude)
    }
    if (longitude !== undefined) {
      projeto.longitude = longitude === null || longitude === '' ? null : Number(longitude)
    }
    if (geocoding_origem !== undefined) projeto.geocoding_origem = geocoding_origem || null
    if (geocoding_confianca !== undefined) {
      projeto.geocoding_confianca = geocoding_confianca === null || geocoding_confianca === '' ? null : Number(geocoding_confianca)
    }
    if (geocodificado_em !== undefined) projeto.geocodificado_em = geocodificado_em ? new Date(geocodificado_em) : null
    if (telhado) {
      projeto.telhado = {
        pontos: telhado.pontos || [],
        area_m2: Number(telhado.area_m2) || 0,
      }
    }

    await projeto.save()
    console.log('✓ Telhado salvo para projeto:', id)
    res.json(projeto)
  } catch (err) {
    console.error('❌ Erro ao salvar telhado:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const obterTelhado = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ erro: 'ID inválido' })
    }

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    res.json({
      id: projeto._id,
      nome: projeto.nome,
      endereco_completo: projeto.endereco_completo,
      latitude: projeto.latitude,
      longitude: projeto.longitude,
      geocoding_origem: projeto.geocoding_origem,
      geocoding_confianca: projeto.geocoding_confianca,
      geocodificado_em: projeto.geocodificado_em,
      telhado: projeto.telhado,
    })
  } catch (err) {
    console.error('❌ Erro ao obter telhado:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const gerarUnifilarProjeto = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ erro: 'ID inválido' })
    }

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const dim = projeto.dimensionamento
    if (!dim) {
      return res.status(400).json({ erro: 'Projeto sem dimensionamento' })
    }

    const { gerarUnifilarFV } = await import('../controllers/unifilarController.js')

    const res2 = {
      json: (data) => {
        res.json(data)
      },
      status: (code) => ({
        json: (data) => res.status(code).json(data),
      }),
    }

    gerarUnifilarFV(
      {
        body: {
          paineis: dim.numPaineis,
          strings: Array(dim.numStrings).fill(null),
          inversor: { potenciaKW: dim.potenciaArredondada, modelo: 'Fronius SYMO' },
          tensao_rede: 'trifasico',
          bess: null,
        },
      },
      res2
    )
  } catch (err) {
    console.error('❌ Erro ao gerar unifilar:', err)
    res.status(500).json({ erro: err.message })
  }
}
