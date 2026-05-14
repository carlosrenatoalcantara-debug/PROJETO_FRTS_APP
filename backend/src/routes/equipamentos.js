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

router.get('/', listarEquipamentos)
router.get('/:id', buscarEquipamento)
router.post('/', criarEquipamento)
router.put('/:id', atualizarEquipamento)
router.delete('/:id', excluirEquipamento)
router.post('/datasheet/extrair', upload.single('pdf'), extrairDatasheet)

export default router
