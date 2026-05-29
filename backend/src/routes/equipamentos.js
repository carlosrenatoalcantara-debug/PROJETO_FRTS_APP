import { Router } from 'express'
import multer from 'multer'
import {
  listarEquipamentos,
  buscarEquipamento,
  criarEquipamento,
  atualizarEquipamento,
  excluirEquipamento,
  extrairDatasheet,
} from '../controllers/equipamentosController.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

// Debug endpoint
router.get('/debug/status', async (req, res) => {
  try {
    const { Equipamento } = await import('../models/Equipamento.js')
    const { CarregadorEV } = await import('../models/CarregadorEV.js')

    const totalEquipamentos = await Equipamento.countDocuments()
    const totalCarregadores = await CarregadorEV.countDocuments()

    const equipamentosPorTipo = await Equipamento.aggregate([
      { $group: { _id: '$tipo', count: { $sum: 1 } } }
    ])

    res.json({
      mongodb_conectado: true,
      equipamentos: {
        total: totalEquipamentos,
        por_tipo: equipamentosPorTipo
      },
      carregadores_ev: {
        total: totalCarregadores
      }
    })
  } catch (err) {
    res.status(500).json({
      mongodb_conectado: false,
      erro: err.message
    })
  }
})

// S8.1: API oficial de engenharia — fonte única do catálogo p/ E7.
// Por padrão só envia utilizavel_em_projeto=true. ?incluir_bloqueados=true inclui bloqueados.
router.get('/engenharia', async (req, res) => {
  try {
    const mongoose = (await import('mongoose')).default
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ erro: 'DB_OFFLINE' })
    const { Equipamento } = await import('../models/Equipamento.js')
    const incluirBloqueados = req.query.incluir_bloqueados === 'true'
    const tipoFiltro = req.query.tipo || null

    const filtro = { ativo: { $ne: false } }
    if (tipoFiltro) filtro.tipo = tipoFiltro
    if (!incluirBloqueados) filtro.utilizavel_em_projeto = { $ne: false }

    const equipamentos = await Equipamento.find(filtro)
      .sort({ fabricante: 1, 'especificacoes.potencia': 1 })
      .lean()

    res.json({ fonte: 'catalogo_mongo', total: equipamentos.length, incluir_bloqueados: incluirBloqueados, equipamentos })
  } catch (err) {
    console.error('[equipamentos/engenharia]', err)
    res.status(500).json({ erro: err.message })
  }
})

router.get('/', listarEquipamentos)
router.get('/:id', buscarEquipamento)
router.post('/', criarEquipamento)
router.put('/:id', atualizarEquipamento)
router.delete('/:id', excluirEquipamento)
router.post('/datasheet/extrair', upload.single('pdf'), extrairDatasheet)

export default router
