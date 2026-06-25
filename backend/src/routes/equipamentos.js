import { Router } from 'express'
import multer from 'multer'
import {
  listarEquipamentos,
  buscarEquipamento,
  criarEquipamento,
  criarInversoresLote,
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

    // P0-EV-CATALOG-SINGLE-SOURCE-OF-TRUTH-01: carregadores vivem SÓ em CarregadorEV.
    // IGNORAR docs Equipamento(carregador_ev) armazenados (mirrors obsoletos/legados) —
    // a visão de carregador é SEMPRE derivada de CarregadorEV (evita duplicação).
    let equipamentos = []
    if (tipoFiltro !== 'carregador_ev') {
      if (!tipoFiltro) filtro.tipo = { $ne: 'carregador_ev' }
      equipamentos = await Equipamento.find(filtro)
        .sort({ fabricante: 1, 'especificacoes.potencia': 1 })
        .lean()
    }

    if (!tipoFiltro || tipoFiltro === 'carregador_ev') {
      const { CarregadorEV } = await import('../models/CarregadorEV.js')
      const { carregadorParaEquipamentoComQualidade } = await import('../utils/catalogo/carregadorEquipamentoView.js')
      const { processarEquipamento } = await import('../services/catalogoQualidade.js')
      const carregadores = await CarregadorEV.find({ ativo: { $ne: false } }).lean()
      for (const cg of carregadores) equipamentos.push(carregadorParaEquipamentoComQualidade(cg, processarEquipamento))
    }

    res.json({ fonte: 'catalogo_mongo', total: equipamentos.length, incluir_bloqueados: incluirBloqueados, equipamentos })
  } catch (err) {
    console.error('[equipamentos/engenharia]', err)
    res.status(500).json({ erro: err.message })
  }
})

router.get('/', listarEquipamentos)
router.get('/:id', buscarEquipamento)
router.post('/', criarEquipamento)
router.post('/lote-inversores', criarInversoresLote)  // P0-INV-01B
router.put('/:id', atualizarEquipamento)
router.delete('/:id', excluirEquipamento)
router.post('/datasheet/extrair', upload.single('pdf'), extrairDatasheet)

export default router
