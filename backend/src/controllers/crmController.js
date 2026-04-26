import { CrmFunil } from '../models/CrmFunil.js'
import { CrmColuna } from '../models/CrmColuna.js'
import { CrmLead } from '../models/CrmLead.js'

// ========== FUNIS ==========
export async function listarFunis(req, res) {
  try {
    const funis = await CrmFunil.find({ ativo: true }).sort({ ordem: 1 })
    res.json(funis)
  } catch (erro) {
    res.status(500).json({ erro: erro.message })
  }
}

export async function criarFunil(req, res) {
  try {
    const { nome, descricao } = req.body
    if (!nome) return res.status(400).json({ erro: 'Campo "nome" obrigatório.' })

    // Encontrar a próxima ordem
    const ultimoFunil = await CrmFunil.findOne().sort({ ordem: -1 })
    const novaOrdem = ultimoFunil ? ultimoFunil.ordem + 1 : 1

    const novoFunil = new CrmFunil({
      nome,
      descricao,
      ordem: novaOrdem,
      ativo: true,
    })

    await novoFunil.save()
    res.status(201).json(novoFunil)
  } catch (erro) {
    res.status(500).json({ erro: erro.message })
  }
}

export async function atualizarFunil(req, res) {
  try {
    const { id } = req.params
    const { nome, ordem, descricao, ativo } = req.body

    const funil = await CrmFunil.findById(id)
    if (!funil) return res.status(404).json({ erro: 'Funil não encontrado.' })

    if (nome !== undefined) funil.nome = nome
    if (ordem !== undefined) funil.ordem = ordem
    if (descricao !== undefined) funil.descricao = descricao
    if (ativo !== undefined) funil.ativo = ativo

    await funil.save()
    res.json(funil)
  } catch (erro) {
    res.status(500).json({ erro: erro.message })
  }
}

export async function deletarFunil(req, res) {
  try {
    const { id } = req.params

    const funil = await CrmFunil.findById(id)
    if (!funil) return res.status(404).json({ erro: 'Funil não encontrado.' })

    // Soft delete - marcar como inativo
    funil.ativo = false
    await funil.save()

    // Desativar colunas associadas
    await CrmColuna.updateMany({ funilId: id }, { ativo: false })

    // Arquivar leads associados
    const colunas = await CrmColuna.find({ funilId: id })
    const colunasIds = colunas.map(c => c._id)
    await CrmLead.updateMany({ colunaId: { $in: colunasIds } }, { arquivado: true })

    res.json({ mensagem: 'Funil desativado com sucesso', funil })
  } catch (erro) {
    res.status(500).json({ erro: erro.message })
  }
}

// ========== COLUNAS ==========
export async function listarColunas(req, res) {
  try {
    const { funilId } = req.query
    let query = { ativo: true }

    if (funilId) query.funilId = funilId

    const colunas = await CrmColuna.find(query)
      .populate('funilId', 'nome')
      .sort({ ordem: 1 })

    res.json(colunas)
  } catch (erro) {
    res.status(500).json({ erro: erro.message })
  }
}

export async function criarColuna(req, res) {
  try {
    const { nome, funilId, descricao, limiteWIP } = req.body

    if (!nome) return res.status(400).json({ erro: 'Campo "nome" obrigatório.' })
    if (!funilId) return res.status(400).json({ erro: 'Campo "funilId" obrigatório.' })

    // Validar se funil existe
    const funil = await CrmFunil.findById(funilId)
    if (!funil) return res.status(404).json({ erro: 'Funil não encontrado.' })

    // Encontrar próxima ordem
    const ultimaColuna = await CrmColuna.findOne({ funilId }).sort({ ordem: -1 })
    const novaOrdem = ultimaColuna ? ultimaColuna.ordem + 1 : 1

    const novaColuna = new CrmColuna({
      nome,
      funilId,
      descricao,
      limiteWIP,
      ordem: novaOrdem,
      ativo: true,
    })

    await novaColuna.save()
    await novaColuna.populate('funilId', 'nome')

    res.status(201).json(novaColuna)
  } catch (erro) {
    res.status(500).json({ erro: erro.message })
  }
}

export async function atualizarColuna(req, res) {
  try {
    const { id } = req.params
    const { nome, ordem, descricao, limiteWIP, ativo } = req.body

    const coluna = await CrmColuna.findById(id)
    if (!coluna) return res.status(404).json({ erro: 'Coluna não encontrada.' })

    if (nome !== undefined) coluna.nome = nome
    if (ordem !== undefined) coluna.ordem = ordem
    if (descricao !== undefined) coluna.descricao = descricao
    if (limiteWIP !== undefined) coluna.limiteWIP = limiteWIP
    if (ativo !== undefined) coluna.ativo = ativo

    await coluna.save()
    await coluna.populate('funilId', 'nome')

    res.json(coluna)
  } catch (erro) {
    res.status(500).json({ erro: erro.message })
  }
}

export async function deletarColuna(req, res) {
  try {
    const { id } = req.params

    const coluna = await CrmColuna.findById(id)
    if (!coluna) return res.status(404).json({ erro: 'Coluna não encontrada.' })

    // Soft delete
    coluna.ativo = false
    await coluna.save()

    // Arquivar leads nesta coluna
    await CrmLead.updateMany({ colunaId: id }, { arquivado: true })

    res.json({ mensagem: 'Coluna desativada com sucesso', coluna })
  } catch (erro) {
    res.status(500).json({ erro: erro.message })
  }
}

// ========== LEADS ==========
export async function criarLead(req, res) {
  try {
    const {
      nome,
      colunaId,
      funilId,
      valor,
      clienteId,
      origem = 'manual',
      notas = '',
      endereco = '',
      cidade = '',
      estado = '',
      latitude = null,
      longitude = null,
      email = '',
      telefone = '',
      empresa = '',
      contato = '',
      tags = [],
    } = req.body

    if (!nome) return res.status(400).json({ erro: 'Campo "nome" obrigatório.' })
    if (!colunaId) return res.status(400).json({ erro: 'Campo "colunaId" obrigatório.' })
    if (!funilId) return res.status(400).json({ erro: 'Campo "funilId" obrigatório.' })

    // Validar coluna
    const coluna = await CrmColuna.findById(colunaId)
    if (!coluna) return res.status(404).json({ erro: 'Coluna não encontrada.' })

    // Validar funil
    const funil = await CrmFunil.findById(funilId)
    if (!funil) return res.status(404).json({ erro: 'Funil não encontrado.' })

    // Verificar limite WIP
    if (coluna.limiteWIP) {
      const contagem = await CrmLead.countDocuments({
        colunaId,
        arquivado: false,
      })
      if (contagem >= coluna.limiteWIP) {
        return res.status(400).json({
          erro: `Coluna atingiu o limite de ${coluna.limiteWIP} leads`,
        })
      }
    }

    const novoLead = new CrmLead({
      nome,
      funilId,
      colunaId,
      valor: valor ? Number(valor) : null,
      clienteId: clienteId ? clienteId : null,
      origem,
      notas,
      endereco,
      cidade,
      estado,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      email,
      telefone,
      empresa,
      contato,
      tags,
      data_atualizacao_coluna: new Date(),
    })

    await novoLead.save()
    await novoLead.populate(['funilId', 'colunaId', 'clienteId'])

    res.status(201).json(novoLead)
  } catch (erro) {
    res.status(500).json({ erro: erro.message })
  }
}

export async function listarLeads(req, res) {
  try {
    const { funilId, colunaId, arquivado = false } = req.query

    let query = { arquivado: arquivado === 'true' }

    if (funilId) query.funilId = funilId
    if (colunaId) query.colunaId = colunaId

    const leads = await CrmLead.find(query)
      .populate('funilId', 'nome')
      .populate('colunaId', 'nome')
      .populate('clienteId', 'nome email telefone')
      .sort({ createdAt: -1 })

    res.json(leads)
  } catch (erro) {
    res.status(500).json({ erro: erro.message })
  }
}

export async function obterLead(req, res) {
  try {
    const { id } = req.params

    const lead = await CrmLead.findById(id)
      .populate('funilId', 'nome')
      .populate('colunaId', 'nome')
      .populate('clienteId', 'nome email telefone endereco cidade estado latitude longitude')

    if (!lead) return res.status(404).json({ erro: 'Lead não encontrado.' })

    res.json(lead)
  } catch (erro) {
    res.status(500).json({ erro: erro.message })
  }
}

export async function atualizarLead(req, res) {
  try {
    const { id } = req.params
    const {
      nome,
      colunaId,
      valor,
      clienteId,
      notas,
      endereco,
      cidade,
      estado,
      latitude,
      longitude,
      email,
      telefone,
      empresa,
      contato,
      tags,
      probabilidade_fechamento_pct,
    } = req.body

    const lead = await CrmLead.findById(id)
    if (!lead) return res.status(404).json({ erro: 'Lead não encontrado.' })

    // Se mudou de coluna, validar limite WIP
    if (colunaId && colunaId !== lead.colunaId.toString()) {
      const novaColuna = await CrmColuna.findById(colunaId)
      if (!novaColuna) return res.status(404).json({ erro: 'Coluna não encontrada.' })

      if (novaColuna.limiteWIP) {
        const contagem = await CrmLead.countDocuments({
          colunaId,
          arquivado: false,
          _id: { $ne: id },
        })
        if (contagem >= novaColuna.limiteWIP) {
          return res.status(400).json({
            erro: `Coluna atingiu o limite de ${novaColuna.limiteWIP} leads`,
          })
        }
      }

      lead.colunaId = colunaId
      lead.data_atualizacao_coluna = new Date()
    }

    if (nome !== undefined) lead.nome = nome
    if (valor !== undefined) lead.valor = valor ? Number(valor) : null
    if (clienteId !== undefined) lead.clienteId = clienteId
    if (notas !== undefined) lead.notas = notas
    if (endereco !== undefined) lead.endereco = endereco
    if (cidade !== undefined) lead.cidade = cidade
    if (estado !== undefined) lead.estado = estado
    if (latitude !== undefined) lead.latitude = latitude ? Number(latitude) : null
    if (longitude !== undefined) lead.longitude = longitude ? Number(longitude) : null
    if (email !== undefined) lead.email = email
    if (telefone !== undefined) lead.telefone = telefone
    if (empresa !== undefined) lead.empresa = empresa
    if (contato !== undefined) lead.contato = contato
    if (tags !== undefined) lead.tags = tags
    if (probabilidade_fechamento_pct !== undefined) {
      lead.probabilidade_fechamento_pct = Math.min(100, Math.max(0, probabilidade_fechamento_pct))
    }

    await lead.save()
    await lead.populate(['funilId', 'colunaId', 'clienteId'])

    res.json(lead)
  } catch (erro) {
    res.status(500).json({ erro: erro.message })
  }
}

export async function moverLead(req, res) {
  try {
    const { id } = req.params
    const { colunaId } = req.body

    if (!colunaId) return res.status(400).json({ erro: 'Campo "colunaId" obrigatório.' })

    const lead = await CrmLead.findById(id)
    if (!lead) return res.status(404).json({ erro: 'Lead não encontrado.' })

    // Validar coluna
    const novaColuna = await CrmColuna.findById(colunaId)
    if (!novaColuna) return res.status(404).json({ erro: 'Coluna não encontrada.' })

    // Verificar limite WIP
    if (novaColuna.limiteWIP) {
      const contagem = await CrmLead.countDocuments({
        colunaId,
        arquivado: false,
        _id: { $ne: id },
      })
      if (contagem >= novaColuna.limiteWIP) {
        return res.status(400).json({
          erro: `Coluna atingiu o limite de ${novaColuna.limiteWIP} leads`,
        })
      }
    }

    lead.colunaId = colunaId
    lead.data_atualizacao_coluna = new Date()
    await lead.save()
    await lead.populate(['funilId', 'colunaId', 'clienteId'])

    res.json(lead)
  } catch (erro) {
    res.status(500).json({ erro: erro.message })
  }
}

export async function deletarLead(req, res) {
  try {
    const { id } = req.params

    const lead = await CrmLead.findById(id)
    if (!lead) return res.status(404).json({ erro: 'Lead não encontrado.' })

    // Soft delete
    lead.arquivado = true
    await lead.save()

    res.json({ mensagem: 'Lead arquivado com sucesso', lead })
  } catch (erro) {
    res.status(500).json({ erro: erro.message })
  }
}

// ========== RELATÓRIOS ==========
export async function obterEstatisticasFunil(req, res) {
  try {
    const { funilId } = req.params

    const colunas = await CrmColuna.find({ funilId, ativo: true }).sort({ ordem: 1 })

    const stats = await Promise.all(
      colunas.map(async (coluna) => {
        const total = await CrmLead.countDocuments({
          colunaId: coluna._id,
          arquivado: false,
        })
        const valorTotal = await CrmLead.aggregate([
          { $match: { colunaId: coluna._id, arquivado: false } },
          { $group: { _id: null, total: { $sum: '$valor' } } },
        ])

        return {
          colunaId: coluna._id,
          colunaNome: coluna.nome,
          totalLeads: total,
          valorTotal: valorTotal[0]?.total || 0,
        }
      })
    )

    res.json(stats)
  } catch (erro) {
    res.status(500).json({ erro: erro.message })
  }
}

export async function obterLeadsPorOrigem(req, res) {
  try {
    const stats = await CrmLead.aggregate([
      { $match: { arquivado: false } },
      {
        $group: {
          _id: '$origem',
          total: { $sum: 1 },
          valorTotal: { $sum: '$valor' },
        },
      },
      { $sort: { total: -1 } },
    ])

    res.json(stats)
  } catch (erro) {
    res.status(500).json({ erro: erro.message })
  }
}
