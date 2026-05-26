import { Router } from 'express'
import mongoose from 'mongoose'
import { ProjetoFV } from '../models/ProjetoFV.js'
import { ProjetoEV } from '../models/ProjetoEV.js'
import { Cliente } from '../models/Cliente.js'

const router = Router()

const STATUS_ATIVOS_FV = ['rascunho', 'em_simulacao', 'dimensionado', 'proposta', 'aprovado', 'em_execucao']
const STATUS_ATIVOS_EV = ['rascunho', 'em_simulacao', 'dimensionado', 'proposta', 'aprovado', 'em_execucao']

// GET /api/dashboard/resumo — contagens reais do MongoDB
router.get('/resumo', async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        projetosFVAtivos: 0,
        projetosEVAtivos: 0,
        totalClientes: 0,
        receitaMes: 0,
        _aviso: 'MongoDB desconectado — exibindo zeros',
      })
    }

    const inicioMes = new Date()
    inicioMes.setDate(1)
    inicioMes.setHours(0, 0, 0, 0)

    const [projetosFVAtivos, projetosEVAtivos, totalClientes, receitaAgg] = await Promise.all([
      ProjetoFV.countDocuments({ status: { $in: STATUS_ATIVOS_FV } }),
      ProjetoEV.countDocuments({ status: { $in: STATUS_ATIVOS_EV } }),
      Cliente.countDocuments({}),
      ProjetoFV.aggregate([
        { $match: { status: 'aprovado', updatedAt: { $gte: inicioMes } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$financeiro.valor_total', 0] } } } },
      ]),
    ])

    res.json({
      projetosFVAtivos,
      projetosEVAtivos,
      totalClientes,
      receitaMes: receitaAgg[0]?.total || 0,
    })
  } catch (err) {
    console.error('❌ Erro dashboard/resumo:', err)
    res.status(500).json({ erro: err.message })
  }
})

// GET /api/dashboard/projetos-recentes — últimos N projetos (FV+EV)
router.get('/projetos-recentes', async (req, res) => {
  try {
    const limite = parseInt(req.query.limite) || 5

    if (mongoose.connection.readyState !== 1) {
      return res.json([])
    }

    const [fvRecentes, evRecentes] = await Promise.all([
      ProjetoFV.find({})
        .sort({ updatedAt: -1 })
        .limit(limite)
        .populate('clienteId', 'nome')
        .lean(),
      ProjetoEV.find({})
        .sort({ updatedAt: -1 })
        .limit(limite)
        .populate('clienteId', 'nome')
        .lean(),
    ])

    const todos = [
      ...fvRecentes.map((p) => ({
        id: p._id,
        nome: p.nome || 'Projeto sem nome',
        cliente: p.clienteId?.nome || '—',
        tipo: 'FV',
        status: p.status || 'rascunho',
        data: p.updatedAt,
      })),
      ...evRecentes.map((p) => ({
        id: p._id,
        nome: p.nome || 'Projeto sem nome',
        cliente: p.clienteId?.nome || '—',
        tipo: 'EV',
        status: p.status || 'rascunho',
        data: p.updatedAt,
      })),
    ]
      .sort((a, b) => new Date(b.data) - new Date(a.data))
      .slice(0, limite)

    res.json(todos)
  } catch (err) {
    console.error('❌ Erro dashboard/projetos-recentes:', err)
    res.status(500).json({ erro: err.message })
  }
})

// Backward-compat: rota raiz retorna resumo
router.get('/', (req, res, next) => {
  req.url = '/resumo'
  router.handle(req, res, next)
})

export default router
