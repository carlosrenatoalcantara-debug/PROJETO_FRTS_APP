import { UnidadeBeneficiaria } from '../models/UnidadeBeneficiaria.js'
import { ProjetoFV } from '../models/ProjetoFV.js'

export const listarBeneficiarias = async (req, res) => {
  try {
    const { id } = req.params
    const beneficiarias = await UnidadeBeneficiaria.find({ projetoId: id }).sort({ createdAt: 1 })
    res.json(beneficiarias)
  } catch (err) {
    console.error('❌ Erro ao listar beneficiárias:', err)
    res.status(500).json({ mensagem: 'Erro ao listar beneficiárias', erro: err.message })
  }
}

export const criarBeneficiaria = async (req, res) => {
  try {
    const { id } = req.params
    const { contaContrato, tipoRateio, valor } = req.body

    // Validar projeto
    const projeto = await ProjetoFV.findById(id)
    if (!projeto) {
      return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    }

    if (!contaContrato || !tipoRateio || valor === undefined) {
      return res.status(400).json({
        mensagem: 'Campos obrigatórios: contaContrato, tipoRateio, valor'
      })
    }

    // Validação específica por tipo
    if (tipoRateio === 'percentual') {
      if (valor < 0 || valor > 100) {
        return res.status(400).json({
          mensagem: 'Percentual deve estar entre 0 e 100'
        })
      }

      // Verificar se soma dos percentuais não ultrapassa 100
      const beneficiarias = await UnidadeBeneficiaria.find({ projetoId: id })
      const somaPercentuais = beneficiarias
        .filter(b => b.tipoRateio === 'percentual')
        .reduce((sum, b) => sum + b.valor, 0) + valor

      if (somaPercentuais > 100) {
        return res.status(400).json({
          mensagem: `Soma de percentuais ultrapassaria 100%. Máximo disponível: ${100 - (somaPercentuais - valor)}%`
        })
      }
    }

    const nova = new UnidadeBeneficiaria({
      projetoId: id,
      contaContrato,
      tipoRateio,
      valor,
    })

    await nova.save()
    console.log('✓ Beneficiária criada:', nova._id)
    res.status(201).json(nova)
  } catch (err) {
    console.error('❌ Erro ao criar beneficiária:', err)
    res.status(500).json({ mensagem: 'Erro ao criar beneficiária', erro: err.message })
  }
}

export const atualizarBeneficiaria = async (req, res) => {
  try {
    const { id, beneficiariaId } = req.params
    const updates = req.body

    const beneficiaria = await UnidadeBeneficiaria.findByIdAndUpdate(
      beneficiariaId,
      updates,
      { new: true }
    )

    if (!beneficiaria) {
      return res.status(404).json({ mensagem: 'Beneficiária não encontrada' })
    }

    console.log('✓ Beneficiária atualizada:', beneficiariaId)
    res.json(beneficiaria)
  } catch (err) {
    console.error('❌ Erro ao atualizar beneficiária:', err)
    res.status(500).json({ mensagem: 'Erro ao atualizar beneficiária', erro: err.message })
  }
}

export const deletarBeneficiaria = async (req, res) => {
  try {
    const { id, beneficiariaId } = req.params

    const beneficiaria = await UnidadeBeneficiaria.findByIdAndDelete(beneficiariaId)

    if (!beneficiaria) {
      return res.status(404).json({ mensagem: 'Beneficiária não encontrada' })
    }

    console.log('✓ Beneficiária deletada:', beneficiariaId)
    res.status(204).end()
  } catch (err) {
    console.error('❌ Erro ao deletar beneficiária:', err)
    res.status(500).json({ mensagem: 'Erro ao deletar beneficiária', erro: err.message })
  }
}

export const obterResumo = async (req, res) => {
  try {
    const { id } = req.params
    const beneficiarias = await UnidadeBeneficiaria.find({ projetoId: id })

    const totalConsumo = beneficiarias.reduce((sum, b) => sum + b.consumoMensal, 0)
    const titular = beneficiarias.find(b => b.tipo === 'titular')
    const beneficiariasSecundarias = beneficiarias.filter(b => b.tipo === 'beneficiaria')

    res.json({
      total: beneficiarias.length,
      consumoTotal: totalConsumo,
      titular,
      beneficiarias: beneficiariasSecundarias,
    })
  } catch (err) {
    console.error('❌ Erro ao obter resumo:', err)
    res.status(500).json({ mensagem: 'Erro ao obter resumo', erro: err.message })
  }
}
