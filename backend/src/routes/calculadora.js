import express from 'express'
import { Lead } from '../models/Lead.js'

const router = express.Router()

// POST /api/calculadora - Receber submissões da calculadora solar
router.post('/', async (req, res) => {
  try {
    const {
      nome,
      email,
      telefone,
      cidade,
      consumoMedio,
      sistemaKwp,
      economiaMensal,
      economiaAnual,
      data,
    } = req.body

    // Validação básica
    if (!nome || !email || !telefone || !consumoMedio) {
      return res.status(400).json({
        erro: 'Nome, email, telefone e consumo são obrigatórios'
      })
    }

    // Criar lead a partir da submissão da calculadora
    const novoLead = new Lead({
      nome,
      email,
      telefone,
      empresa: 'N/A',
      origem: 'website',
      status: 'prospect',
      tags: ['calculadora-solar', `cidade-${cidade}`],
      notas: `Consumo: ${consumoMedio} kWh/mês | Sistema necessário: ${sistemaKwp} kWp | Economia anual: R$ ${economiaAnual}`,
      valor_estimado_r: economiaAnual ? parseFloat(economiaAnual) : 0,
      probabilidade_fechamento_pct: 10,
    })

    await novoLead.save()

    res.status(201).json({
      sucesso: true,
      mensagem: 'Calculadora submetida com sucesso! Entraremos em contato em breve.',
      leadId: novoLead._id,
    })
  } catch (erro) {
    console.error('Erro ao processar calculadora:', erro)
    res.status(500).json({
      erro: 'Erro ao processar submissão da calculadora'
    })
  }
})

export default router
